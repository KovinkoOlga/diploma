from PIL import Image

from app.providers.sd15_ip_adapter_inpaint import Sd15IpAdapterInpaintProvider
from app.settings import Settings


class DummyTokenizer:
    model_max_length = 77

    def __call__(self, *args, **kwargs):
        return {"input_ids": list(range(12))}


class DummyPipeline:
    def __init__(self) -> None:
        self.loaded_ip_adapter = None
        self.ip_scale = None
        self.device = None
        self.calls = []
        self.attention_slicing_enabled = False
        self.vae_slicing_enabled = False
        self.tokenizer = DummyTokenizer()

    def load_ip_adapter(self, model_id, subfolder, weight_name, local_files_only):
        self.loaded_ip_adapter = {
            "model_id": model_id,
            "subfolder": subfolder,
            "weight_name": weight_name,
            "local_files_only": local_files_only,
        }

    def set_ip_adapter_scale(self, scale):
        self.ip_scale = scale

    def to(self, device):
        self.device = device
        return self

    def enable_attention_slicing(self):
        self.attention_slicing_enabled = True
        return None

    def enable_vae_slicing(self):
        self.vae_slicing_enabled = True
        return None

    def __call__(self, **kwargs):
        self.calls.append(kwargs)
        class Result:
            images = [Image.new("RGB", (512, 512), "white")]

        return Result()


def test_provider_lazy_load_and_generation(monkeypatch):
    pipeline = DummyPipeline()
    image_encoder_calls = []
    pipeline_calls = []

    def fake_image_encoder_from_pretrained(*args, **kwargs):
        image_encoder_calls.append((args, kwargs))
        return object()

    def fake_pipeline_from_pretrained(*args, **kwargs):
        pipeline_calls.append((args, kwargs))
        return pipeline

    monkeypatch.setattr(
        "app.providers.sd15_ip_adapter_inpaint.CLIPVisionModelWithProjection.from_pretrained",
        fake_image_encoder_from_pretrained,
    )
    monkeypatch.setattr(
        "app.providers.sd15_ip_adapter_inpaint.StableDiffusionInpaintPipeline.from_pretrained",
        fake_pipeline_from_pretrained,
    )

    settings = Settings(
        catalog_num_threads=1,
        catalog_deterministic=True,
        catalog_seed=123,
    )
    provider = Sd15IpAdapterInpaintProvider(settings)

    output = provider.generate(
        Image.new("RGB", (512, 512), "white"),
        Image.new("L", (512, 512), 255),
        Image.new("RGB", (512, 512), "white"),
        "prompt",
        "negative prompt",
    )

    assert len(image_encoder_calls) == 1
    assert len(pipeline_calls) == 1
    assert pipeline_calls[0][1]["safety_checker"] is None
    assert pipeline_calls[0][1]["feature_extractor"] is None
    assert pipeline_calls[0][1]["requires_safety_checker"] is False
    assert pipeline.loaded_ip_adapter["weight_name"] == settings.catalog_ip_adapter_weight_name
    assert pipeline.ip_scale == settings.catalog_ip_adapter_scale
    assert pipeline.attention_slicing_enabled is False
    assert pipeline.vae_slicing_enabled is True
    assert pipeline.calls[0]["ip_adapter_image"].size == (512, 512)
    assert pipeline.calls[0]["negative_prompt"] == "negative prompt"
    assert output.seed == 123
    assert output.debug["mask_mode"] == settings.catalog_mask_mode
    assert "prompt_token_limit" in output.debug

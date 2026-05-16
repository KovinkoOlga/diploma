import base64
import io
import json
import sys
from contextlib import nullcontext
from functools import lru_cache
from pathlib import Path

import torch
from diffusers import AutoencoderKL, EulerDiscreteScheduler
from fastapi import FastAPI, File, Form, UploadFile
from huggingface_hub import hf_hub_download
from PIL import Image
from pydantic_settings import BaseSettings, SettingsConfigDict
from torchvision.transforms.functional import pil_to_tensor


REPO_ROOT = Path(__file__).resolve().parents[2]
TRYOFFDIFF_ROOT = REPO_ROOT / "temp" / "tryoffdiff"
if TRYOFFDIFF_ROOT.exists():
    sys.path.insert(0, str(TRYOFFDIFF_ROOT))

from tryoffdiff.modeling.model import create_model


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    hf_repo_id: str = "rizavelioglu/tryoffdiff"
    catalog_device: str = "auto"
    catalog_enable_stub: bool = False
    catalog_force_primary_failure: bool = False
    catalog_num_inference_steps: int = 20
    catalog_guidance_scale: float = 2.0
    catalog_seed: int = 42
    catalog_scheduler_filename: str = "scheduler/scheduler_config_v2.json"
    catalog_model_upper: str = "tryoffdiffv2_upper.pth"
    catalog_model_lower: str = "tryoffdiffv2_lower.pth"
    catalog_model_dress: str = "tryoffdiffv2_dress.pth"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def _to_rgba(content: bytes) -> Image.Image:
    return Image.open(io.BytesIO(content)).convert("RGBA")


def _to_mask(content: bytes) -> Image.Image:
    return Image.open(io.BytesIO(content)).convert("L")


def _encode_png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _paste_center(canvas: Image.Image, image: Image.Image) -> Image.Image:
    offset = ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2)
    canvas.paste(image, offset)
    return canvas


def _square_resize(image: Image.Image, size: int = 512) -> Image.Image:
    side = max(image.width, image.height)
    square = Image.new("RGB", (side, side), color=(255, 255, 255))
    _paste_center(square, image.convert("RGB"))
    return square.resize((size, size), Image.Resampling.LANCZOS)


def _composite_catalog(cutout_bytes: bytes) -> bytes:
    cutout = _to_rgba(cutout_bytes)
    background = Image.new("RGBA", cutout.size, color=(255, 255, 255, 255))
    background.alpha_composite(cutout)
    return _encode_png(background)


def _prepare_condition_image(original_bytes: bytes, cutout_bytes: bytes, mask_bytes: bytes) -> Image.Image:
    original = _to_rgba(original_bytes)
    cutout = _to_rgba(cutout_bytes)
    mask = _to_mask(mask_bytes)

    if cutout.size != original.size:
        cutout = cutout.resize(original.size, Image.Resampling.LANCZOS)
    if mask.size != original.size:
        mask = mask.resize(original.size, Image.Resampling.NEAREST)

    bbox = mask.getbbox() or cutout.getbbox() or original.getbbox() or (0, 0, original.width, original.height)
    original_crop = original.crop(bbox)
    cutout_crop = cutout.crop(bbox)
    mask_crop = mask.crop(bbox)

    if cutout_crop.getchannel("A").getbbox() is None:
        transparent = Image.new("RGBA", original_crop.size, (0, 0, 0, 0))
        foreground = Image.composite(original_crop, transparent, mask_crop)
    else:
        foreground = cutout_crop

    background = Image.new("RGBA", foreground.size, color=(255, 255, 255, 255))
    background.alpha_composite(foreground)
    return _square_resize(background.convert("RGB"))


def _resolve_device(device_name: str) -> str:
    if device_name == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    if device_name == "cuda" and not torch.cuda.is_available():
        return "cpu"
    return device_name


def _category_to_model_key(category_hint: str | None) -> str | None:
    if not category_hint:
        return None
    normalized = category_hint.strip().lower()
    if normalized in {"tops", "outerwear"}:
        return "upper"
    if normalized in {"bottoms"}:
        return "lower"
    if normalized in {"dresses"}:
        return "dress"
    return None


class TryOffDiffRuntime:
    MODEL_CONFIGS = {
        "upper": ("TryOffDiffv2Single", "catalog_model_upper"),
        "lower": ("TryOffDiffv2Single", "catalog_model_lower"),
        "dress": ("TryOffDiffv2Single", "catalog_model_dress"),
    }

    def __init__(self) -> None:
        self.settings = get_settings()
        self.device = _resolve_device(self.settings.catalog_device)
        self._scheduler_config: dict | None = None
        self._vae: AutoencoderKL | None = None
        self._models: dict[str, torch.nn.Module] = {}

        torch.set_float32_matmul_precision("high")
        if torch.cuda.is_available():
            torch.backends.cuda.matmul.allow_tf32 = True

    def _ensure_shared_models(self) -> None:
        if self._vae is None:
            self._vae = AutoencoderKL.from_pretrained("stabilityai/sd-vae-ft-mse").eval().to(self.device)
            self._vae.requires_grad_(False)
        if self._scheduler_config is None:
            scheduler_path = hf_hub_download(
                repo_id=self.settings.hf_repo_id,
                filename=self.settings.catalog_scheduler_filename,
            )
            with open(scheduler_path, encoding="utf-8") as fh:
                self._scheduler_config = json.load(fh)

    def _build_scheduler(self) -> EulerDiscreteScheduler:
        assert self._scheduler_config is not None
        scheduler = EulerDiscreteScheduler.from_config(self._scheduler_config, use_karras_sigmas=True)
        scheduler.is_scale_input_called = True
        return scheduler

    def _load_model(self, model_key: str) -> torch.nn.Module:
        if model_key in self._models:
            return self._models[model_key]

        model_class_name, settings_attr = self.MODEL_CONFIGS[model_key]
        checkpoint_name = getattr(self.settings, settings_attr)
        checkpoint_path = hf_hub_download(repo_id=self.settings.hf_repo_id, filename=checkpoint_name)
        state_dict = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        state_dict = {key.replace("_orig_mod.", ""): value for key, value in state_dict.items()}

        model = create_model(model_class_name)
        model.load_state_dict(state_dict, strict=True)
        model = model.eval().to(self.device)
        model.requires_grad_(False)
        self._models[model_key] = model
        return model

    def _autocast(self):
        if self.device == "cuda":
            return torch.autocast(device_type="cuda", dtype=torch.float16)
        return nullcontext()

    def _condition_tensor(self, image: Image.Image) -> torch.Tensor:
        image_tensor = pil_to_tensor(image).to(dtype=torch.float32) / 255.0
        image_tensor = (image_tensor - 0.5) / 0.5
        return image_tensor.unsqueeze(0).to(self.device)

    @torch.no_grad()
    def generate(self, original_bytes: bytes, cutout_bytes: bytes, mask_bytes: bytes, category_hint: str | None) -> tuple[bytes, str]:
        model_key = _category_to_model_key(category_hint)
        if model_key is None:
            raise ValueError(f"Unsupported category for TryOffDiff: {category_hint or 'unknown'}")

        self._ensure_shared_models()
        model = self._load_model(model_key)
        scheduler = self._build_scheduler()
        scheduler.set_timesteps(self.settings.catalog_num_inference_steps)

        condition_image = _prepare_condition_image(original_bytes, cutout_bytes, mask_bytes)
        cond_tensor = self._condition_tensor(condition_image)
        guidance_scale = self.settings.catalog_guidance_scale
        generator = torch.Generator(device=self.device).manual_seed(self.settings.catalog_seed)
        latents = torch.randn(1, 4, 64, 64, generator=generator, device=self.device)
        uncond_tensor = torch.zeros_like(cond_tensor) if guidance_scale > 1 else None

        with self._autocast():
            for timestep in scheduler.timesteps:
                timestep = timestep.to(self.device)
                if guidance_scale > 1:
                    noise_pred = model(torch.cat([latents] * 2), timestep, torch.cat([uncond_tensor, cond_tensor])).chunk(2)
                    noise_pred = noise_pred[0] + guidance_scale * (noise_pred[1] - noise_pred[0])
                else:
                    noise_pred = model(latents, timestep, cond_tensor)
                scheduler_output = scheduler.step(noise_pred, timestep, latents)
                latents = scheduler_output.prev_sample

            assert self._vae is not None
            decoded = self._vae.decode(1 / self._vae.config.scaling_factor * scheduler_output.pred_original_sample).sample

        image_tensor = ((decoded / 2) + 0.5).clamp(0, 1).cpu()[0]
        image_array = (image_tensor.permute(1, 2, 0).numpy() * 255).round().astype("uint8")
        image = Image.fromarray(image_array, mode="RGB")
        return _encode_png(image), f"tryoffdiffv2-{model_key}"


class TryOffDiffGenerator:
    def __init__(self) -> None:
        self.runtime = TryOffDiffRuntime()

    def generate(
        self,
        original_bytes: bytes,
        cutout_bytes: bytes,
        mask_bytes: bytes,
        *,
        category_hint: str | None = None,
    ) -> tuple[bytes, str]:
        settings = get_settings()
        if settings.catalog_force_primary_failure:
            raise RuntimeError("Forced TryOffDiff failure")
        if settings.catalog_enable_stub:
            return _composite_catalog(cutout_bytes), "tryoffdiff-stub"
        return self.runtime.generate(original_bytes, cutout_bytes, mask_bytes, category_hint)


class CompositeFallbackGenerator:
    def generate(self, original_bytes: bytes, cutout_bytes: bytes, mask_bytes: bytes) -> tuple[bytes, str]:
        return _composite_catalog(cutout_bytes), "catalog-composite-fallback"


primary_generator = TryOffDiffGenerator()
fallback_generator = CompositeFallbackGenerator()
app = FastAPI(title="ML Catalog Service", version="0.1.0")


@app.get("/health")
async def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "device": _resolve_device(settings.catalog_device),
        "stub_enabled": settings.catalog_enable_stub,
        "tryoffdiff_root_exists": TRYOFFDIFF_ROOT.exists(),
    }


@app.post("/v1/generate-catalog")
async def generate_catalog(
    original_image: UploadFile = File(...),
    cutout_image: UploadFile = File(...),
    mask_image: UploadFile = File(...),
    category_hint: str | None = Form(None),
) -> dict:
    original_bytes = await original_image.read()
    cutout_bytes = await cutout_image.read()
    mask_bytes = await mask_image.read()

    fallback_used = False
    try:
        result_bytes, model_used = primary_generator.generate(
            original_bytes,
            cutout_bytes,
            mask_bytes,
            category_hint=category_hint,
        )
    except Exception:
        result_bytes, model_used = fallback_generator.generate(original_bytes, cutout_bytes, mask_bytes)
        fallback_used = True

    return {
        "catalog_image": base64.b64encode(result_bytes).decode("utf-8"),
        "mime_type": "image/png",
        "model_used": model_used,
        "fallback_used": fallback_used,
    }

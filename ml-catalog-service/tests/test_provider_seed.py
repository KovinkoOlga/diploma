from types import SimpleNamespace

from PIL import Image

from app.providers.sd_turbo_img2img import SdTurboImage2ImageProvider, resolve_generation_seed
from app.settings import Settings


def test_resolve_generation_seed_is_stable_in_deterministic_mode():
    settings = Settings(catalog_deterministic=True, catalog_seed=123)

    first_seed, first_deterministic = resolve_generation_seed(settings)
    second_seed, second_deterministic = resolve_generation_seed(settings)

    assert first_deterministic is True
    assert second_deterministic is True
    assert first_seed == 123
    assert second_seed == 123


def test_resolve_generation_seed_changes_in_nondeterministic_mode():
    settings = Settings(catalog_deterministic=False, catalog_seed=123)

    first_seed, first_deterministic = resolve_generation_seed(settings)
    second_seed, second_deterministic = resolve_generation_seed(settings)

    assert first_deterministic is False
    assert second_deterministic is False
    assert first_seed != second_seed


class _FakeTokenizer:
    def __init__(self, model_max_length: int, token_count: int) -> None:
        self.model_max_length = model_max_length
        self._token_count = token_count

    def __call__(self, _prompt: str, truncation: bool = False, return_tensors=None):
        assert truncation is False
        return {"input_ids": list(range(self._token_count))}


class _FailingTokenizer:
    model_max_length = 77

    def __call__(self, *_args, **_kwargs):
        raise RuntimeError("tokenizer failed")


class _FakePipe:
    def __init__(self, tokenizer) -> None:
        self.tokenizer = tokenizer

    def __call__(self, **_kwargs):
        return SimpleNamespace(images=[Image.new("RGB", (64, 64), (128, 128, 128))])


def test_provider_collects_prompt_tokenization_debug(monkeypatch):
    settings = Settings(catalog_deterministic=True, catalog_seed=42)
    provider = SdTurboImage2ImageProvider(settings)
    provider._dtype = "float32"
    provider._load_time_ms = 10
    monkeypatch.setattr(provider, "_load_pipeline", lambda: _FakePipe(_FakeTokenizer(model_max_length=77, token_count=20)))

    output = provider.generate(Image.new("RGB", (64, 64), (100, 100, 100)), "short prompt")

    assert output.debug["prompt_token_count"] == 20
    assert output.debug["prompt_token_limit"] == 77
    assert output.debug["prompt_truncated"] is False


def test_provider_sets_prompt_truncated_when_token_count_exceeds_limit(monkeypatch):
    settings = Settings(catalog_deterministic=True, catalog_seed=42)
    provider = SdTurboImage2ImageProvider(settings)
    provider._dtype = "float32"
    provider._load_time_ms = 10
    monkeypatch.setattr(provider, "_load_pipeline", lambda: _FakePipe(_FakeTokenizer(model_max_length=77, token_count=120)))

    output = provider.generate(Image.new("RGB", (64, 64), (100, 100, 100)), "long prompt")

    assert output.debug["prompt_token_count"] == 120
    assert output.debug["prompt_token_limit"] == 77
    assert output.debug["prompt_truncated"] is True


def test_provider_tokenizer_error_does_not_break_generation(monkeypatch):
    settings = Settings(catalog_deterministic=True, catalog_seed=42)
    provider = SdTurboImage2ImageProvider(settings)
    provider._dtype = "float32"
    provider._load_time_ms = 10
    monkeypatch.setattr(provider, "_load_pipeline", lambda: _FakePipe(_FailingTokenizer()))

    output = provider.generate(Image.new("RGB", (64, 64), (100, 100, 100)), "prompt")

    assert output.image.mode == "RGB"
    assert output.debug["prompt_token_count"] is None
    assert output.debug["prompt_token_limit"] == 77
    assert output.debug["prompt_truncated"] is None
    assert "prompt_tokenization_error" in output.debug

import logging
import secrets
import time
from dataclasses import dataclass
from typing import Any

import torch
from diffusers import AutoPipelineForImage2Image
from PIL import Image

from app.settings import Settings, resolve_device

logger = logging.getLogger(__name__)


def resolve_generation_seed(settings: Settings) -> tuple[int, bool]:
    deterministic = bool(settings.catalog_deterministic)
    if deterministic:
        return int(settings.catalog_seed if settings.catalog_seed is not None else 42), True
    return secrets.randbits(32), False


@dataclass
class CatalogProviderOutput:
    image: Image.Image
    provider: str
    model_used: str
    debug: dict[str, Any]


class SdTurboImage2ImageProvider:
    provider_name = "sd_turbo_img2img"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.device = resolve_device(settings.catalog_device)
        self._pipe = None
        self._dtype = None
        self._load_time_ms: int | None = None
        if settings.catalog_num_threads is not None:
            torch.set_num_threads(settings.catalog_num_threads)

    def _load_pipeline(self):
        if self._pipe is not None:
            return self._pipe

        load_started = time.perf_counter()
        last_exc: Exception | None = None
        for dtype in (torch.float32, torch.float16):
            try:
                pipe = AutoPipelineForImage2Image.from_pretrained(
                    self.settings.catalog_model_id,
                    torch_dtype=dtype,
                    variant=self.settings.catalog_model_variant,
                    use_safetensors=True,
                    local_files_only=self.settings.catalog_local_files_only,
                )
                pipe = pipe.to(self.device)
                if hasattr(pipe, "enable_attention_slicing"):
                    pipe.enable_attention_slicing()
                if hasattr(pipe, "enable_vae_slicing"):
                    pipe.enable_vae_slicing()
                self._pipe = pipe
                self._dtype = dtype
                self._load_time_ms = int((time.perf_counter() - load_started) * 1000)
                return pipe
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if dtype is torch.float32:
                    logger.warning("Failed to load SD-Turbo with float32 on CPU, trying float16 fallback")
                    continue
                raise

        if last_exc is not None:
            raise last_exc
        raise RuntimeError("Failed to initialize SD-Turbo pipeline")

    def _collect_prompt_tokenization_debug(self, pipe: Any, prompt: str) -> dict[str, Any]:
        tokenization_debug: dict[str, Any] = {
            "prompt_token_count": None,
            "prompt_token_limit": 77,
            "prompt_truncated": None,
        }
        tokenizer = getattr(pipe, "tokenizer", None)
        if tokenizer is None:
            return tokenization_debug

        raw_limit = getattr(tokenizer, "model_max_length", 77)
        try:
            token_limit = int(raw_limit)
        except (TypeError, ValueError):
            token_limit = 77
        if token_limit <= 0 or token_limit > 10_000:
            token_limit = 77
        tokenization_debug["prompt_token_limit"] = token_limit

        try:
            encoded = tokenizer(prompt, truncation=False, return_tensors=None)
            token_ids = encoded.get("input_ids") if isinstance(encoded, dict) else None
            if isinstance(token_ids, list) and token_ids and isinstance(token_ids[0], list):
                token_count = len(token_ids[0])
            elif isinstance(token_ids, list):
                token_count = len(token_ids)
            else:
                token_count = None
            tokenization_debug["prompt_token_count"] = token_count
            tokenization_debug["prompt_truncated"] = bool(token_count and token_count > token_limit)
            if tokenization_debug["prompt_truncated"]:
                logger.warning(
                    "Prompt exceeds CLIP token limit and may be truncated: token_count=%s token_limit=%s",
                    token_count,
                    token_limit,
                )
        except Exception as exc:  # noqa: BLE001
            tokenization_debug["prompt_tokenization_error"] = str(exc)
        return tokenization_debug

    def generate(self, image: Image.Image, prompt: str) -> CatalogProviderOutput:
        product = self.settings.catalog_num_inference_steps * self.settings.catalog_strength
        if product < 1:
            raise ValueError("Invalid generation parameters: num_inference_steps * strength must be >= 1")

        pipe = self._load_pipeline()
        tokenization_debug = self._collect_prompt_tokenization_debug(pipe, prompt)

        seed, deterministic = resolve_generation_seed(self.settings)
        try:
            generator = torch.Generator(device="cpu").manual_seed(seed)
        except Exception:  # noqa: BLE001
            generator = torch.Generator().manual_seed(seed)

        started = time.perf_counter()
        result = pipe(
            prompt=prompt,
            image=image,
            num_inference_steps=self.settings.catalog_num_inference_steps,
            strength=self.settings.catalog_strength,
            guidance_scale=self.settings.catalog_guidance_scale,
            generator=generator,
        )
        generation_time_ms = int((time.perf_counter() - started) * 1000)
        output_image = result.images[0].convert("RGB")

        debug = {
            "provider": self.provider_name,
            "model_id": self.settings.catalog_model_id,
            "model_variant": self.settings.catalog_model_variant,
            "local_files_only": self.settings.catalog_local_files_only,
            "device": self.device,
            "dtype": str(self._dtype).replace("torch.", "") if self._dtype is not None else None,
            "steps": self.settings.catalog_num_inference_steps,
            "strength": self.settings.catalog_strength,
            "guidance_scale": self.settings.catalog_guidance_scale,
            "seed": seed,
            "deterministic": deterministic,
            "load_time_ms": self._load_time_ms,
            "generation_time_ms": generation_time_ms,
            "output_size": [output_image.width, output_image.height],
            "cpu_only": True,
        }
        debug.update(tokenization_debug)

        return CatalogProviderOutput(
            image=output_image,
            provider=self.provider_name,
            model_used=self.settings.catalog_model_id,
            debug=debug,
        )

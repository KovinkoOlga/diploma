from __future__ import annotations

import os
import secrets
import time
from dataclasses import dataclass
from pathlib import Path

import torch
from diffusers import StableDiffusionInpaintPipeline
from PIL import Image
from transformers import CLIPVisionModelWithProjection

from app.settings import Settings, resolve_device, resolve_torch_dtype


@dataclass
class CatalogProviderOutput:
    image: Image.Image
    provider: str
    model_used: str
    deterministic: bool
    seed: int
    debug: dict


class Sd15IpAdapterInpaintProvider:
    provider_name = "sd15_ip_adapter_inpaint"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.device = resolve_device(settings.catalog_device)
        self.torch_dtype = resolve_torch_dtype(settings.catalog_torch_dtype)
        self._pipeline: StableDiffusionInpaintPipeline | None = None
        self._load_time_ms = 0
        self._model_used = (
            f"{Path(self.settings.catalog_sd15_inpaint_model_id).name}+"
            f"{Path(self.settings.catalog_ip_adapter_weight_name).stem}"
        )

    def _load_pipeline(self) -> StableDiffusionInpaintPipeline:
        if self._pipeline is not None:
            return self._pipeline

        load_started = time.perf_counter()
        if self.settings.catalog_num_threads:
            torch.set_num_threads(self.settings.catalog_num_threads)
            os.environ.setdefault("OMP_NUM_THREADS", str(self.settings.catalog_num_threads))

        image_encoder = CLIPVisionModelWithProjection.from_pretrained(
            self.settings.catalog_ip_adapter_model_id,
            subfolder="models/image_encoder",
            local_files_only=self.settings.catalog_local_files_only,
            torch_dtype=torch.float32,
        )
        pipe = StableDiffusionInpaintPipeline.from_pretrained(
            self.settings.catalog_sd15_inpaint_model_id,
            variant=self.settings.catalog_model_variant,
            use_safetensors=True,
            local_files_only=self.settings.catalog_local_files_only,
            torch_dtype=self.torch_dtype,
            image_encoder=image_encoder,
            safety_checker=None,
            feature_extractor=None,
            requires_safety_checker=False,
        )
        pipe.load_ip_adapter(
            self.settings.catalog_ip_adapter_model_id,
            subfolder=self.settings.catalog_ip_adapter_subfolder,
            weight_name=self.settings.catalog_ip_adapter_weight_name,
            local_files_only=self.settings.catalog_local_files_only,
        )
        pipe.set_ip_adapter_scale(self.settings.catalog_ip_adapter_scale)
        pipe.to(self.device)
        if hasattr(pipe, "enable_vae_slicing"):
            pipe.enable_vae_slicing()

        self._pipeline = pipe
        self._load_time_ms = int((time.perf_counter() - load_started) * 1000)
        return pipe

    def _tokenize_prompt_debug(self, pipe: StableDiffusionInpaintPipeline, prompt: str, negative_prompt: str) -> dict:
        tokenizer = getattr(pipe, "tokenizer", None)
        if tokenizer is None:
            return {
                "prompt_token_count": None,
                "prompt_token_limit": 77,
                "prompt_truncated": False,
                "negative_prompt_token_count": None,
                "negative_prompt_truncated": False,
            }

        try:
            token_limit = getattr(tokenizer, "model_max_length", 77) or 77
            if not isinstance(token_limit, int) or token_limit > 10000:
                token_limit = 77
            prompt_tokens = tokenizer(prompt, truncation=False)
            negative_tokens = tokenizer(negative_prompt, truncation=False)
            prompt_count = len(prompt_tokens["input_ids"])
            negative_count = len(negative_tokens["input_ids"])
            return {
                "prompt_token_count": prompt_count,
                "prompt_token_limit": token_limit,
                "prompt_truncated": prompt_count > token_limit,
                "negative_prompt_token_count": negative_count,
                "negative_prompt_truncated": negative_count > token_limit,
            }
        except Exception as exc:
            return {
                "prompt_token_count": None,
                "prompt_token_limit": 77,
                "prompt_truncated": False,
                "negative_prompt_token_count": None,
                "negative_prompt_truncated": False,
                "prompt_tokenization_error": str(exc),
            }

    def resolve_generation_seed(self) -> tuple[bool, int]:
        deterministic = bool(self.settings.catalog_deterministic)
        if deterministic:
            return True, int(self.settings.catalog_seed if self.settings.catalog_seed is not None else 42)
        return False, secrets.randbits(32)

    def generate(
        self,
        init_image: Image.Image,
        mask_image: Image.Image,
        ip_adapter_image: Image.Image,
        prompt: str,
        negative_prompt: str,
    ) -> CatalogProviderOutput:
        pipe = self._load_pipeline()
        token_debug = self._tokenize_prompt_debug(pipe, prompt, negative_prompt)
        deterministic, seed = self.resolve_generation_seed()

        try:
            generator = torch.Generator(device="cpu").manual_seed(seed)
        except Exception:
            generator = torch.Generator().manual_seed(seed)

        started = time.perf_counter()
        result = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image=init_image,
            mask_image=mask_image,
            ip_adapter_image=ip_adapter_image,
            num_inference_steps=self.settings.catalog_num_inference_steps,
            guidance_scale=self.settings.catalog_guidance_scale,
            strength=self.settings.catalog_strength,
            generator=generator,
        ).images[0]
        generation_time_ms = int((time.perf_counter() - started) * 1000)

        debug = {
            "provider": self.provider_name,
            "model_used": self._model_used,
            "ip_adapter_model_id": self.settings.catalog_ip_adapter_model_id,
            "ip_adapter_weight_name": self.settings.catalog_ip_adapter_weight_name,
            "ip_adapter_scale": self.settings.catalog_ip_adapter_scale,
            "device": self.device,
            "torch_dtype": str(self.torch_dtype).replace("torch.", ""),
            "local_files_only": self.settings.catalog_local_files_only,
            "model_variant": self.settings.catalog_model_variant,
            "output_size": self.settings.catalog_output_size,
            "num_inference_steps": self.settings.catalog_num_inference_steps,
            "guidance_scale": self.settings.catalog_guidance_scale,
            "strength": self.settings.catalog_strength,
            "mask_mode": self.settings.catalog_mask_mode,
            "mask_expand_px": self.settings.catalog_mask_expand_px,
            "mask_blur_px": self.settings.catalog_mask_blur_px,
            "deterministic": deterministic,
            "seed": seed,
            "load_time_ms": self._load_time_ms,
            "generation_time_ms": generation_time_ms,
            **token_debug,
        }
        return CatalogProviderOutput(
            image=result.convert("RGB"),
            provider=self.provider_name,
            model_used=self._model_used,
            deterministic=deterministic,
            seed=seed,
            debug=debug,
        )

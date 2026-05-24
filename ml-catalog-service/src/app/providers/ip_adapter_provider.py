from __future__ import annotations

import logging
from pathlib import Path

import torch
from diffusers import StableDiffusionImg2ImgPipeline

from app.image_utils import prepare_cutout_on_white
from app.model_paths import (
    ip_adapter_required_files,
    resolve_ip_adapter_image_encoder_dir,
    resolve_ip_adapter_weight_path,
)
from app.providers.base import CatalogProvider, GenerationInput, ProviderOutput, RouteDecision
from app.providers.errors import MissingModelFileError, ProviderDisabledError
from app.settings import Settings, resolve_device

LOGGER = logging.getLogger(__name__)

SHOES_PROMPT = (
    "high quality studio product photo of the same pair of shoes, white background, centered composition, "
    "ecommerce catalog image, realistic material, realistic details, sharp focus"
)

BAGS_PROMPT = (
    "high quality studio product photo of the same fashion accessory, white background, centered composition, "
    "ecommerce catalog image, realistic material, realistic details, sharp focus"
)

NEGATIVE_PROMPT = (
    "person, body, hand, foot, mannequin, extra object, duplicate, distorted shape, changed logo, "
    "changed pattern, text artifacts, blurry, low quality"
)


class IPAdapterProductProvider(CatalogProvider):
    name = "ip_adapter"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.device = resolve_device(settings.catalog_device)
        self._pipeline: StableDiffusionImg2ImgPipeline | None = None
        self._adapter_weight_used: str | None = None

        if self.device == "cpu":
            LOGGER.warning("IP-Adapter inference is running on CPU and may be slow")

    def required_files(self) -> dict[str, Path]:
        return ip_adapter_required_files(self.settings)

    def _ensure_path_exists(self, path: Path, *, label: str) -> None:
        if not path.exists():
            raise MissingModelFileError(f"Missing IP-Adapter {label}: {path}")

    def _resolve_weight_path(self) -> Path:
        return resolve_ip_adapter_weight_path(self.settings)

    def _resolve_image_encoder_dir(self) -> Path:
        return resolve_ip_adapter_image_encoder_dir(self.settings)

    def _apply_memory_optimizations(self, pipeline: StableDiffusionImg2ImgPipeline) -> None:
        if hasattr(pipeline, "enable_attention_slicing"):
            pipeline.enable_attention_slicing()
        if hasattr(pipeline, "enable_vae_slicing"):
            pipeline.enable_vae_slicing()
        if hasattr(pipeline, "enable_vae_tiling"):
            pipeline.enable_vae_tiling()

    def _load_pipeline(self) -> StableDiffusionImg2ImgPipeline:
        if self._pipeline is not None:
            return self._pipeline

        if not self.settings.catalog_enable_ip_adapter:
            raise ProviderDisabledError("IP-Adapter provider is disabled")
        if self.settings.catalog_ip_base_model.strip().lower() != "sd15":
            raise RuntimeError(f"Unsupported IP-Adapter base model: {self.settings.catalog_ip_base_model}")

        for name, path in self.required_files().items():
            self._ensure_path_exists(path, label=name)

        dtype = torch.float16 if self.device == "cuda" else torch.float32
        pipeline = StableDiffusionImg2ImgPipeline.from_pretrained(
            str(self.settings.catalog_sd15_dir),
            torch_dtype=dtype,
            local_files_only=True,
            safety_checker=None,
            requires_safety_checker=False,
        )

        weight_path = self._resolve_weight_path()
        image_encoder_dir = self._resolve_image_encoder_dir()
        pipeline.load_ip_adapter(
            str(self.settings.catalog_ip_adapter_dir),
            subfolder="models",
            weight_name=weight_path.name,
            image_encoder_folder=str(image_encoder_dir),
            local_files_only=True,
        )
        pipeline.set_ip_adapter_scale(self.settings.catalog_ip_adapter_scale)
        self._apply_memory_optimizations(pipeline)

        pipeline = pipeline.to(self.device)
        self._pipeline = pipeline
        self._adapter_weight_used = weight_path.name
        return pipeline

    def _prompt_for_route(self, route: RouteDecision) -> str:
        if route.prompt_type == "shoes":
            return SHOES_PROMPT
        return BAGS_PROMPT

    @torch.no_grad()
    def generate(self, request: GenerationInput, route: RouteDecision) -> ProviderOutput:
        pipeline = self._load_pipeline()
        prompt = self._prompt_for_route(route)
        input_image = prepare_cutout_on_white(request.cutout, self.settings.catalog_output_size)
        generator = torch.Generator(device=self.device).manual_seed(self.settings.catalog_seed)

        result = pipeline(
            prompt=prompt,
            negative_prompt=NEGATIVE_PROMPT,
            image=input_image,
            ip_adapter_image=input_image,
            strength=self.settings.catalog_ip_adapter_strength,
            num_inference_steps=self.settings.catalog_ip_adapter_steps,
            guidance_scale=self.settings.catalog_ip_adapter_guidance_scale,
            num_images_per_prompt=1,
            generator=generator,
        )

        image = result.images[0]
        adapter_weight = self._adapter_weight_used or self.settings.catalog_ip_adapter_weight
        return ProviderOutput(image=image, model_used=f"ip-adapter:{adapter_weight}")

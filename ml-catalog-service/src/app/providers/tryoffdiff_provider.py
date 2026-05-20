from __future__ import annotations

import json
import logging
from contextlib import nullcontext
from pathlib import Path

import torch
from diffusers import AutoencoderKL, EulerDiscreteScheduler
from PIL import Image
from torchvision.transforms.functional import pil_to_tensor
from tryoffdiff.modeling.model import create_model

from app.image_utils import prepare_tryoffdiff_condition
from app.model_paths import tryoffdiff_required_files
from app.providers.base import CatalogProvider, GenerationInput, ProviderOutput, RouteDecision
from app.settings import Settings, resolve_device

LOGGER = logging.getLogger(__name__)


class TryOffDiffProvider(CatalogProvider):
    name = "tryoffdiff"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.device = resolve_device(settings.catalog_device)
        self._vae: AutoencoderKL | None = None
        self._scheduler_config: dict | None = None
        self._models: dict[str, torch.nn.Module] = {}

        if self.device == "cpu":
            LOGGER.warning("TryOffDiff inference is running on CPU and may be slow")

        torch.set_float32_matmul_precision("high")
        if torch.cuda.is_available():
            torch.backends.cuda.matmul.allow_tf32 = True

    def required_files(self) -> dict[str, Path]:
        return tryoffdiff_required_files(self.settings)

    def _load_scheduler_config(self) -> dict:
        if self._scheduler_config is None:
            config_path = self.settings.catalog_tryoffdiff_dir / self.settings.catalog_scheduler_filename
            with config_path.open("r", encoding="utf-8") as handle:
                self._scheduler_config = json.load(handle)
        return self._scheduler_config

    def _build_scheduler(self) -> EulerDiscreteScheduler:
        scheduler_config = self._load_scheduler_config()
        scheduler = EulerDiscreteScheduler.from_config(scheduler_config, use_karras_sigmas=True)
        scheduler.is_scale_input_called = True
        return scheduler

    def _load_vae(self) -> AutoencoderKL:
        if self._vae is None:
            vae = AutoencoderKL.from_pretrained(
                str(self.settings.catalog_vae_dir),
                local_files_only=True,
            )
            self._vae = vae.eval().to(self.device)
            self._vae.requires_grad_(False)
        return self._vae

    def _checkpoint_for_key(self, model_key: str) -> Path:
        if model_key == "upper":
            return self.settings.catalog_tryoffdiff_dir / self.settings.catalog_model_upper
        if model_key == "lower":
            return self.settings.catalog_tryoffdiff_dir / self.settings.catalog_model_lower
        if model_key == "dress":
            return self.settings.catalog_tryoffdiff_dir / self.settings.catalog_model_dress
        raise ValueError(f"Unsupported TryOffDiff model key: {model_key}")

    def _load_model(self, model_key: str) -> torch.nn.Module:
        if model_key in self._models:
            return self._models[model_key]

        checkpoint_path = self._checkpoint_for_key(model_key)
        state_dict = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        state_dict = {key.replace("_orig_mod.", ""): value for key, value in state_dict.items()}

        model = create_model("TryOffDiffv2Single")
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
    def generate(self, request: GenerationInput, route: RouteDecision) -> ProviderOutput:
        model_key = route.model_key
        model = self._load_model(model_key)
        scheduler = self._build_scheduler()
        scheduler.set_timesteps(self.settings.catalog_num_inference_steps)

        condition_image = prepare_tryoffdiff_condition(
            request.original,
            request.cutout,
            request.mask,
            self.settings.catalog_output_size,
        )

        cond_tensor = self._condition_tensor(condition_image)
        guidance_scale = self.settings.catalog_guidance_scale
        latent_size = self.settings.catalog_output_size // 8
        generator = torch.Generator(device=self.device).manual_seed(self.settings.catalog_seed)
        latents = torch.randn(1, 4, latent_size, latent_size, generator=generator, device=self.device)
        uncond_tensor = torch.zeros_like(cond_tensor) if guidance_scale > 1 else None

        with self._autocast():
            for timestep in scheduler.timesteps:
                timestep = timestep.to(self.device)
                if guidance_scale > 1:
                    noise_pred = model(
                        torch.cat([latents] * 2),
                        timestep,
                        torch.cat([uncond_tensor, cond_tensor]),
                    ).chunk(2)
                    noise_pred = noise_pred[0] + guidance_scale * (noise_pred[1] - noise_pred[0])
                else:
                    noise_pred = model(latents, timestep, cond_tensor)
                scheduler_output = scheduler.step(noise_pred, timestep, latents)
                latents = scheduler_output.prev_sample

            vae = self._load_vae()
            decoded = vae.decode(1 / vae.config.scaling_factor * scheduler_output.pred_original_sample).sample

        image_tensor = ((decoded / 2) + 0.5).clamp(0, 1).cpu()[0]
        image_array = (image_tensor.permute(1, 2, 0).numpy() * 255).round().astype("uint8")
        image = Image.fromarray(image_array, mode="RGB")
        return ProviderOutput(image=image, model_used=f"tryoffdiffv2-{model_key}")

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from PIL import Image


@dataclass(frozen=True)
class GenerationInput:
    original: Image.Image
    cutout: Image.Image
    mask: Image.Image
    category: str


@dataclass(frozen=True)
class RouteDecision:
    normalized_category: str
    provider: str
    model_key: str
    prompt_type: str | None


@dataclass(frozen=True)
class ProviderOutput:
    image: Image.Image
    model_used: str


class CatalogProvider(Protocol):
    name: str

    def required_files(self) -> dict[str, Path]:
        ...

    def generate(self, request: GenerationInput, route: RouteDecision) -> ProviderOutput:
        ...

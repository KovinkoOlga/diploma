from __future__ import annotations

from io import BytesIO

import cv2
import numpy as np
from PIL import Image

from app.services.color_prediction_service import ColorPredictionService, hex_to_rgb


def png_bytes(array: np.ndarray, mode: str) -> bytes:
    image = Image.fromarray(array.astype(np.uint8), mode=mode)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def palette_entry(
    color_id: str,
    name: str,
    parent_color_id: str,
    hex_value: str,
    sort_order: int,
    *,
    kind: str = "solid",
) -> dict[str, object]:
    return {
        "id": color_id,
        "name": name,
        "parent_color_id": parent_color_id,
        "parent_name": parent_color_id,
        "hex": hex_value,
        "kind": kind,
        "sort_order": sort_order,
    }


def make_palette() -> list[dict[str, object]]:
    return [
        palette_entry("white_pure", "white", "white", "#FFFFFF", 11),
        palette_entry("white_milky", "milky", "white", "#F6F1E7", 12),
        palette_entry("black_pure", "black", "black", "#111111", 21),
        palette_entry("black_graphite", "graphite", "black", "#30343A", 22),
        palette_entry("gray_light", "gray light", "gray", "#D1D5DB", 31),
        palette_entry("gray_neutral", "gray", "gray", "#8B929B", 32),
        palette_entry("gray_dark", "gray dark", "gray", "#5C626A", 33),
        palette_entry("beige_light", "beige light", "beige", "#E7D7BD", 41),
        palette_entry("beige_neutral", "beige", "beige", "#D6BE9A", 42),
        palette_entry("beige_sand", "sand", "beige", "#D8B887", 43),
        palette_entry("beige_taupe", "taupe", "beige", "#9A8778", 44),
        palette_entry("brown_neutral", "brown", "brown", "#765033", 51),
        palette_entry("brown_dark", "brown dark", "brown", "#3A2418", 52),
        palette_entry("brown_chocolate", "chocolate", "brown", "#4B2D22", 53),
        palette_entry("pink_neutral", "pink", "pink", "#E8A3B5", 71),
        palette_entry("pink_powder", "pink powder", "pink", "#DDB8C0", 72),
        palette_entry("blue_light", "blue light", "blue", "#76B9E8", 91),
        palette_entry("blue_neutral", "blue", "blue", "#3467B7", 92),
        palette_entry("blue_dark", "blue dark", "blue", "#203B73", 93),
        palette_entry("red_neutral", "red", "red", "#E32626", 101),
        palette_entry("green_neutral", "green", "green", "#4B8A55", 111),
        palette_entry("multicolor", "multicolor", "special", "#E94B5B", 141, kind="multicolor"),
        palette_entry("transparent", "transparent", "special", "#DDE6EE", 142, kind="transparent"),
    ]


def soft_mask(size: int = 160, inset: int = 12) -> np.ndarray:
    mask = np.zeros((size, size), dtype=np.uint8)
    cv2.rectangle(mask, (inset, inset), (size - inset, size - inset), 255, thickness=-1)
    return cv2.GaussianBlur(mask, (0, 0), sigmaX=3.2, sigmaY=3.2)


def shaded_solid(hex_value: str, *, shadow_strength: float, highlight_strength: float = 0.08, size: int = 160) -> np.ndarray:
    base = np.full((size, size, 3), hex_to_rgb(hex_value), dtype=np.float32)
    x = np.linspace(-1.0, 1.0, size, dtype=np.float32)
    y = np.linspace(-1.0, 1.0, size, dtype=np.float32)
    xx, yy = np.meshgrid(x, y)
    folds = 1.0 - shadow_strength * (0.5 + 0.5 * np.sin((xx + 0.15) * np.pi * 3.0)) * (0.45 + 0.55 * np.exp(-(yy * 1.5) ** 2))
    highlight = 1.0 + highlight_strength * np.exp(-(((xx - 0.55) ** 2) + ((yy + 0.2) ** 2)) / 0.03)
    return np.clip(base * folds[..., None] * highlight[..., None], 0, 255).astype(np.uint8)


def striped_item(base_hex: str, stripe_hex: str, *, stripe_width: int = 10, gap: int = 22, size: int = 160) -> np.ndarray:
    image = np.full((size, size, 3), hex_to_rgb(base_hex), dtype=np.uint8)
    for start in range(18, size - 18, gap):
        image[:, start : start + stripe_width] = hex_to_rgb(stripe_hex)
    return image


def black_with_highlights(size: int = 160) -> np.ndarray:
    base = np.full((size, size, 3), hex_to_rgb("#111111"), dtype=np.float32)
    x = np.linspace(-1.0, 1.0, size, dtype=np.float32)
    y = np.linspace(-1.0, 1.0, size, dtype=np.float32)
    xx, yy = np.meshgrid(x, y)
    highlight = 1.0 + 0.55 * np.exp(-(((xx - 0.35) ** 2) + ((yy + 0.1) ** 2)) / 0.025)
    folds = 1.0 - 0.18 * (0.5 + 0.5 * np.sin((xx - 0.25) * np.pi * 2.6))
    return np.clip(base * highlight[..., None] * folds[..., None], 0, 255).astype(np.uint8)


def predict(image: np.ndarray, mask: np.ndarray) -> object:
    return ColorPredictionService().predict(png_bytes(image, "RGB"), png_bytes(mask, "L"), make_palette())


def test_powder_solid_with_shadow_is_single_pink_powder():
    image = shaded_solid("#DDB8C0", shadow_strength=0.28)
    result = predict(image, soft_mask())

    assert result is not None
    assert result.color_ids == ["pink_powder"]
    assert result.is_multicolor is False


def test_brown_solid_with_dark_folds_is_single_brown():
    image = shaded_solid("#765033", shadow_strength=0.42)
    result = predict(image, soft_mask())

    assert result is not None
    assert result.color_ids[0] in {"brown_neutral", "brown_chocolate", "brown_dark"}
    assert len(result.color_ids) == 1
    assert result.colors[0].parent_color_id == "brown"


def test_light_blue_white_stripes_are_two_colors_not_multicolor():
    image = striped_item("#76B9E8", "#FFFFFF")
    result = predict(image, soft_mask(inset=10))

    assert result is not None
    assert result.is_multicolor is False
    assert result.color_ids == ["blue_light", "white_pure"]


def test_gray_solid_is_gray_not_blue_or_white():
    image = shaded_solid("#8B929B", shadow_strength=0.22, highlight_strength=0.05)
    result = predict(image, soft_mask())

    assert result is not None
    assert result.color_ids[0] in {"gray_neutral", "gray_dark", "gray_light"}
    assert len(result.color_ids) == 1
    assert result.colors[0].parent_color_id == "gray"


def test_light_blue_highlights_do_not_add_milky_second_color():
    image = shaded_solid("#76B9E8", shadow_strength=0.12, highlight_strength=0.42)
    result = predict(image, soft_mask())

    assert result is not None
    assert result.color_ids[0] in {"blue_light", "blue_neutral"}
    assert len(result.color_ids) == 1
    assert "white_milky" not in result.color_ids


def test_pale_blue_solid_prefers_blue_over_gray():
    image = shaded_solid("#A8CEE8", shadow_strength=0.08, highlight_strength=0.18)
    result = predict(image, soft_mask())

    assert result is not None
    assert result.color_ids[0] == "blue_light"
    assert len(result.color_ids) == 1
    assert "gray_light" not in result.color_ids
    assert "gray_neutral" not in result.color_ids


def test_pale_pink_solid_prefers_pink_over_milky():
    image = shaded_solid("#E6C7CF", shadow_strength=0.10, highlight_strength=0.24)
    result = predict(image, soft_mask())

    assert result is not None
    assert result.color_ids[0] in {"pink_powder", "pink_neutral"}
    assert len(result.color_ids) == 1
    assert "white_milky" not in result.color_ids


def test_black_solid_with_highlights_is_single_black():
    image = black_with_highlights()
    result = predict(image, soft_mask())

    assert result is not None
    assert result.color_ids[0] in {"black_pure", "black_graphite"}
    assert len(result.color_ids) == 1
    assert result.colors[0].parent_color_id == "black"


def test_dark_blue_shadows_do_not_add_black_second_color():
    image = shaded_solid("#203B73", shadow_strength=0.62, highlight_strength=0.04)
    result = predict(image, soft_mask())

    assert result is not None
    assert result.color_ids[0] == "blue_dark"
    assert len(result.color_ids) == 1
    assert "black_pure" not in result.color_ids
    assert "black_graphite" not in result.color_ids


def test_multicolor_requires_three_distinct_color_families():
    size = 180
    image = np.zeros((size, size, 3), dtype=np.uint8)
    image[:, :70] = hex_to_rgb("#76B9E8")
    image[:, 70:125] = hex_to_rgb("#FFFFFF")
    image[:, 125:] = hex_to_rgb("#4B8A55")
    result = predict(image, soft_mask(size=size, inset=8))

    assert result is not None
    assert result.is_multicolor is True
    assert result.color_ids == ["multicolor"]


def test_background_outside_mask_is_ignored():
    image = np.full((160, 160, 3), hex_to_rgb("#4B8A55"), dtype=np.uint8)
    image[18:142, 18:142] = shaded_solid("#DDB8C0", shadow_strength=0.24, size=124)
    mask = np.zeros((160, 160), dtype=np.uint8)
    mask[18:142, 18:142] = soft_mask(size=124, inset=8)

    result = predict(image, mask)

    assert result is not None
    assert result.color_ids == ["pink_powder"]


def test_transparent_is_not_selected_as_regular_color():
    image = np.full((140, 140, 3), hex_to_rgb("#DDE6EE"), dtype=np.uint8)
    result = predict(image, soft_mask(size=140, inset=8))

    assert result is not None
    assert "transparent" not in result.color_ids

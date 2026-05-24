import io

import pytest
from PIL import Image, ImageDraw

from app.image_utils import apply_soft_post_sharpen, postprocess_catalog_result, prepare_catalog_input


def _png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _build_inputs(size: tuple[int, int] = (256, 192)) -> tuple[bytes, bytes, bytes]:
    original = Image.new("RGB", size, (220, 220, 220))

    cutout = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(cutout)
    draw.rectangle((50, 30, 180, 160), fill=(30, 60, 180, 255))

    mask = Image.new("L", size, 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rectangle((50, 30, 180, 160), fill=255)

    return _png_bytes(original), _png_bytes(cutout), _png_bytes(mask)


def test_prepare_catalog_input_returns_rgb_square():
    original_bytes, cutout_bytes, mask_bytes = _build_inputs()

    output = prepare_catalog_input(original_bytes, cutout_bytes, mask_bytes, output_size=512)

    assert output.mode == "RGB"
    assert output.size == (512, 512)


def test_prepare_catalog_input_handles_cutout_and_mask_with_different_sizes():
    original_bytes, cutout_bytes, _ = _build_inputs()

    mask = Image.new("L", (128, 128), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse((20, 20, 100, 100), fill=255)
    mask_bytes = _png_bytes(mask)

    output = prepare_catalog_input(original_bytes, cutout_bytes, mask_bytes, output_size=512)

    assert output.mode == "RGB"
    assert output.size == (512, 512)


def test_prepare_catalog_input_raises_for_invalid_images():
    with pytest.raises(ValueError, match="image"):
        prepare_catalog_input(b"", b"not-an-image", b"also-not-image", output_size=512)


def test_postprocess_catalog_result_returns_rgba_and_reduces_empty_space():
    image = Image.new("RGB", (320, 320), (245, 245, 245))
    draw = ImageDraw.Draw(image)
    draw.rectangle((120, 70, 220, 260), fill=(205, 210, 218))

    output, debug = postprocess_catalog_result(
        image,
        output_size=256,
        margin_ratio=0.06,
        transparent_background=True,
        threshold=30.0,
        feather=20.0,
    )

    assert output.mode == "RGBA"
    assert output.size == (256, 256)
    assert debug["transparent_background"] is True
    alpha = output.getchannel("A")
    assert alpha.getbbox() is not None
    # corner should become transparent after light-background removal
    assert alpha.getpixel((0, 0)) < 20
    # object should remain visible and relatively large after recrop+fit
    bbox = alpha.getbbox()
    assert bbox is not None
    assert (bbox[2] - bbox[0]) >= 90
    assert (bbox[3] - bbox[1]) >= 170


def test_postprocess_catalog_result_disables_aggressive_cut_on_dark_background():
    image = Image.new("RGB", (256, 256), (70, 70, 70))
    draw = ImageDraw.Draw(image)
    draw.rectangle((70, 40, 185, 220), fill=(100, 125, 160))

    output, debug = postprocess_catalog_result(
        image,
        output_size=256,
        margin_ratio=0.06,
        transparent_background=True,
        threshold=30.0,
        feather=20.0,
    )

    assert output.mode == "RGBA"
    alpha = output.getchannel("A")
    # Safety guard: dark background should skip aggressive background removal.
    assert debug["pass1_background_removal_disabled"] is True
    assert alpha.getpixel((128, 128)) >= 240
    assert debug["pass1_corner_lightness_ok"] is False


def test_apply_soft_post_sharpen_keeps_rgb_mode_for_rgb_input():
    image = Image.new("RGB", (64, 64), (120, 130, 140))
    output = apply_soft_post_sharpen(image, enabled=True, radius=0.6, percent=80, threshold=3)
    assert output.mode == "RGB"


def test_apply_soft_post_sharpen_keeps_alpha_channel_for_rgba_input():
    image = Image.new("RGBA", (64, 64), (120, 130, 140, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 20, 20), fill=(120, 130, 140, 0))
    original_alpha = image.getchannel("A").copy()

    output = apply_soft_post_sharpen(image, enabled=True, radius=0.6, percent=80, threshold=3)

    assert output.mode == "RGBA"
    assert output.getchannel("A").tobytes() == original_alpha.tobytes()


def test_postprocess_catalog_result_debug_contains_post_sharpen_params():
    image = Image.new("RGB", (256, 256), (245, 245, 245))
    output, debug = postprocess_catalog_result(
        image,
        output_size=256,
        margin_ratio=0.06,
        transparent_background=True,
        threshold=30.0,
        feather=20.0,
        post_sharpen_enabled=True,
        post_sharpen_radius=0.6,
        post_sharpen_percent=80,
        post_sharpen_threshold=3,
    )

    assert output.mode == "RGBA"
    assert debug["post_sharpen_enabled"] is True
    assert debug["post_sharpen_radius"] == 0.6
    assert debug["post_sharpen_percent"] == 80
    assert debug["post_sharpen_threshold"] == 3

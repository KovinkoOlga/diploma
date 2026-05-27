from io import BytesIO

from PIL import Image, ImageDraw

from app.image_utils import (
    build_full_item_inpaint_mask,
    build_inpaint_init_image,
    build_ip_adapter_reference_image,
    encode_png,
    postprocess_catalog_result,
)


def _png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_init_and_reference_images_keep_square_layout_without_recrop():
    source = Image.new("RGBA", (512, 512), (248, 248, 248, 255))
    ImageDraw.Draw(source).rectangle((80, 110, 420, 460), fill=(20, 80, 220, 255))
    cutout = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    cutout.alpha_composite(source)

    init_image = build_inpaint_init_image(_png_bytes(source), 512)
    reference_image = build_ip_adapter_reference_image(_png_bytes(cutout), 512)

    assert init_image.size == (512, 512)
    assert reference_image.size == (512, 512)


def test_full_item_mask_uses_white_as_repaint_and_has_debug():
    mask = Image.new("L", (512, 512), 0)
    ImageDraw.Draw(mask).rectangle((120, 140, 390, 430), fill=255)
    cutout = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    ImageDraw.Draw(cutout).rectangle((120, 140, 390, 430), fill=(120, 20, 20, 255))

    inpaint_mask = build_full_item_inpaint_mask(_png_bytes(mask), _png_bytes(cutout), 512, 8, 16, 8)

    assert inpaint_mask.mode == "L"
    assert inpaint_mask.getbbox() is not None
    assert inpaint_mask.info["mask_debug"]["mask_semantics"] == {"white": "repaint", "black": "preserve"}


def test_empty_mask_falls_back_without_crashing():
    empty_mask = Image.new("L", (512, 512), 0)
    empty_cutout = Image.new("RGBA", (512, 512), (0, 0, 0, 0))

    inpaint_mask = build_full_item_inpaint_mask(_png_bytes(empty_mask), _png_bytes(empty_cutout), 512, 8, 16, 8)

    assert inpaint_mask.getbbox() is not None
    assert "fallback" in " ".join(inpaint_mask.info["mask_debug"]["warnings"])


def test_postprocess_returns_rgba_and_preserves_alpha():
    generated = Image.new("RGBA", (512, 512), (248, 248, 248, 255))
    ImageDraw.Draw(generated).rectangle((120, 80, 390, 430), fill=(255, 255, 255, 255))

    result = postprocess_catalog_result(
        generated,
        output_size=512,
        transparent_background=True,
        background_threshold=34.0,
        background_feather=20.0,
        result_margin_ratio=0.06,
        post_sharpen_enabled=True,
        post_sharpen_radius=0.6,
        post_sharpen_percent=80,
        post_sharpen_threshold=3,
    )

    assert result.mode == "RGBA"
    assert result.size == (512, 512)
    assert result.getchannel("A").getbbox() is not None
    encode_png(result)

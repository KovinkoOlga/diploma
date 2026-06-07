from datetime import datetime, timezone
from io import BytesIO

import pytest
from PIL import Image, ImageDraw
from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.metadata import item_drafts, metadata, users, wardrobe_catalogs
from app.modules.files import service as file_service
from app.modules.files.service import create_image_file_with_variants
from app.modules.wardrobe import service as wardrobe_service
from app.modules.wardrobe.image_processing import compose_square_cutout, prepare_square_editor_assets


CANVAS_SIZE = 512


def png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def build_original_and_mask(size: tuple[int, int], bbox: tuple[int, int, int, int]) -> tuple[bytes, bytes]:
    original = Image.new("RGBA", size, (255, 255, 255, 255))
    ImageDraw.Draw(original).rectangle(bbox, fill=(40, 80, 220, 255))
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rectangle(bbox, fill=255)
    return png_bytes(original), png_bytes(mask)


def load_mask_bbox(mask_bytes: bytes, threshold: int = 8) -> tuple[int, int, int, int] | None:
    mask = Image.open(BytesIO(mask_bytes)).convert("L")
    return mask.point(lambda value: 255 if int(value) >= threshold else 0).getbbox()


def load_cutout_alpha_bbox(cutout_bytes: bytes, threshold: int = 8) -> tuple[int, int, int, int] | None:
    cutout = Image.open(BytesIO(cutout_bytes)).convert("RGBA")
    return cutout.getchannel("A").point(lambda value: 255 if int(value) >= threshold else 0).getbbox()


def bbox_center(bbox: tuple[int, int, int, int]) -> tuple[float, float]:
    left, top, right, bottom = bbox
    return ((left + right) / 2, (top + bottom) / 2)


@pytest.fixture()
async def connection():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(metadata.create_all)
        await conn.execute(
            insert(users).values(
                id="user_1",
                email="user@example.com",
                email_verified_at=datetime.now(timezone.utc),
                display_name="User",
            )
        )
        await conn.execute(
            insert(wardrobe_catalogs).values(id="catalog_main", user_id="user_1", name="Основное", sort_order=10, is_default=True)
        )
        yield conn
    await engine.dispose()


@pytest.fixture()
def mock_storage(monkeypatch):
    objects: dict[str, bytes] = {}

    async def put_object(object_key: str, body: bytes, mime_type: str) -> None:
        objects[object_key] = body

    async def get_object(bucket: str, object_key: str) -> bytes | None:
        return objects.get(object_key)

    async def presigned_get_url(bucket: str, object_key: str) -> str:
        return f"memory://{bucket}/{object_key}"

    monkeypatch.setattr(file_service.storage, "put_object", put_object)
    monkeypatch.setattr(file_service.storage, "get_object", get_object)
    monkeypatch.setattr(file_service.storage, "presigned_get_url", presigned_get_url)
    return objects


def test_prepare_square_editor_assets_returns_512_square_outputs():
    original_bytes, mask_bytes = build_original_and_mask((420, 260), (80, 70, 340, 170))

    prepared = prepare_square_editor_assets(
        original_bytes,
        mask_bytes,
        canvas_size=CANVAS_SIZE,
        padding_ratio=0.22,
        min_padding_px=48,
        alpha_threshold=8,
    )

    assert Image.open(BytesIO(prepared["square_source_bytes"])).size == (CANVAS_SIZE, CANVAS_SIZE)
    assert Image.open(BytesIO(prepared["square_mask_bytes"])).size == (CANVAS_SIZE, CANVAS_SIZE)
    assert Image.open(BytesIO(prepared["square_cutout_bytes"])).size == (CANVAS_SIZE, CANVAS_SIZE)


def test_prepare_square_editor_assets_centers_horizontal_object():
    original_bytes, mask_bytes = build_original_and_mask((420, 220), (40, 80, 380, 140))

    prepared = prepare_square_editor_assets(
        original_bytes,
        mask_bytes,
        canvas_size=CANVAS_SIZE,
        padding_ratio=0.22,
        min_padding_px=48,
        alpha_threshold=8,
    )
    bbox = load_mask_bbox(prepared["square_mask_bytes"])

    assert bbox is not None
    center_x, center_y = bbox_center(bbox)
    assert abs(center_x - CANVAS_SIZE / 2) <= 4
    assert abs(center_y - CANVAS_SIZE / 2) <= 4


def test_prepare_square_editor_assets_centers_vertical_object():
    original_bytes, mask_bytes = build_original_and_mask((220, 420), (80, 40, 140, 380))

    prepared = prepare_square_editor_assets(
        original_bytes,
        mask_bytes,
        canvas_size=CANVAS_SIZE,
        padding_ratio=0.22,
        min_padding_px=48,
        alpha_threshold=8,
    )
    bbox = load_mask_bbox(prepared["square_mask_bytes"])

    assert bbox is not None
    center_x, center_y = bbox_center(bbox)
    assert abs(center_x - CANVAS_SIZE / 2) <= 4
    assert abs(center_y - CANVAS_SIZE / 2) <= 4


def test_prepare_square_editor_assets_preserves_padding():
    original_bytes, mask_bytes = build_original_and_mask((400, 400), (150, 150, 250, 250))

    prepared = prepare_square_editor_assets(
        original_bytes,
        mask_bytes,
        canvas_size=CANVAS_SIZE,
        padding_ratio=0.22,
        min_padding_px=48,
        alpha_threshold=8,
    )
    left, top, right, bottom = load_mask_bbox(prepared["square_mask_bytes"])

    assert left > 80
    assert top > 80
    assert right < CANVAS_SIZE - 80
    assert bottom < CANVAS_SIZE - 80


def test_prepare_square_editor_assets_handles_object_at_image_edge():
    original_bytes, mask_bytes = build_original_and_mask((320, 260), (0, 30, 160, 220))

    prepared = prepare_square_editor_assets(
        original_bytes,
        mask_bytes,
        canvas_size=CANVAS_SIZE,
        padding_ratio=0.22,
        min_padding_px=48,
        alpha_threshold=8,
    )

    bbox = load_mask_bbox(prepared["square_mask_bytes"])
    assert bbox is not None
    assert bbox[0] >= 0
    assert bbox[1] >= 0
    assert bbox[2] <= CANVAS_SIZE
    assert bbox[3] <= CANVAS_SIZE


def test_prepare_square_editor_assets_handles_empty_mask_without_crash():
    original = Image.new("RGBA", (300, 200), (255, 255, 255, 255))
    mask = Image.new("L", (300, 200), 0)

    prepared = prepare_square_editor_assets(
        png_bytes(original),
        png_bytes(mask),
        canvas_size=CANVAS_SIZE,
        padding_ratio=0.22,
        min_padding_px=48,
        alpha_threshold=8,
    )

    assert Image.open(BytesIO(prepared["square_source_bytes"])).size == (CANVAS_SIZE, CANVAS_SIZE)
    assert Image.open(BytesIO(prepared["square_mask_bytes"])).size == (CANVAS_SIZE, CANVAS_SIZE)
    assert load_cutout_alpha_bbox(prepared["square_cutout_bytes"]) is None


def test_square_cutout_keeps_transparent_background():
    original_bytes, mask_bytes = build_original_and_mask((320, 320), (80, 90, 240, 250))

    prepared = prepare_square_editor_assets(
        original_bytes,
        mask_bytes,
        canvas_size=CANVAS_SIZE,
        padding_ratio=0.22,
        min_padding_px=48,
        alpha_threshold=8,
    )
    cutout = Image.open(BytesIO(prepared["square_cutout_bytes"])).convert("RGBA")

    assert cutout.getpixel((0, 0))[3] == 0
    assert cutout.getchannel("A").getbbox() is not None


def test_compose_square_cutout_uses_square_mask_alpha():
    source = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (255, 0, 0, 255))
    mask = Image.new("L", (CANVAS_SIZE, CANVAS_SIZE), 0)
    ImageDraw.Draw(mask).rectangle((128, 96, 384, 416), fill=255)

    cutout = Image.open(BytesIO(compose_square_cutout(png_bytes(source), png_bytes(mask)))).convert("RGBA")

    assert cutout.getpixel((10, 10))[3] == 0
    assert cutout.getpixel((256, 256))[3] == 255


def test_repeated_compose_after_mask_edit_keeps_canvas_coordinates():
    original_bytes, mask_bytes = build_original_and_mask((280, 420), (100, 40, 180, 380))
    prepared = prepare_square_editor_assets(
        original_bytes,
        mask_bytes,
        canvas_size=CANVAS_SIZE,
        padding_ratio=0.22,
        min_padding_px=48,
        alpha_threshold=8,
    )
    edited_mask = Image.open(BytesIO(prepared["square_mask_bytes"])).convert("L")
    ImageDraw.Draw(edited_mask).rectangle((0, 0, CANVAS_SIZE, 190), fill=0)
    edited_mask_bytes = png_bytes(edited_mask)

    recomposed = compose_square_cutout(prepared["square_source_bytes"], edited_mask_bytes)

    assert Image.open(BytesIO(recomposed)).size == (CANVAS_SIZE, CANVAS_SIZE)
    assert load_cutout_alpha_bbox(recomposed) == load_mask_bbox(edited_mask_bytes)


async def store_file(connection, user_id: str, filename: str, variants: dict[str, bytes]) -> str:
    return await create_image_file_with_variants(connection, user_id, variants, filename, "image/png")


@pytest.mark.asyncio
async def test_get_draft_generates_square_legacy_assets_and_returns_editor_image_url(connection, mock_storage):
    original_bytes, mask_bytes = build_original_and_mask((360, 240), (70, 40, 290, 210))
    original_file_id = await store_file(connection, "user_1", "original.png", {"original": original_bytes, "card": original_bytes, "thumbnail": original_bytes})
    mask_file_id = await store_file(connection, "user_1", "mask.png", wardrobe_service.square_mask_variants(mask_bytes))
    processed_file_id = await store_file(
        connection,
        "user_1",
        "cutout.png",
        wardrobe_service.square_cutout_variants(compose_square_cutout(original_bytes, mask_bytes)),
    )

    await connection.execute(
        insert(item_drafts).values(
            id="draft_legacy",
            user_id="user_1",
            source_type="photo",
            processing_status=wardrobe_service.PRIMARY_READY_STATUS,
            catalog_id="catalog_main",
            original_file_id=original_file_id,
            editor_file_id=None,
            processed_file_id=processed_file_id,
            mask_file_id=mask_file_id,
            suggested_payload_json={"primaryImageFileId": processed_file_id},
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
    )

    draft = await wardrobe_service.get_draft(connection, "user_1", "draft_legacy")
    row = (
        await connection.execute(select(item_drafts).where(item_drafts.c.id == "draft_legacy"))
    ).mappings().first()

    assert draft.editorImageUrl is not None
    assert draft.originalImageUrl == draft.editorImageUrl
    assert draft.maskBitmap == {
        "width": CANVAS_SIZE,
        "height": CANVAS_SIZE,
        "dataBase64": draft.maskBitmap["dataBase64"],
    }
    assert row["editor_file_id"] is not None
    assert row["processed_file_id"] != processed_file_id
    assert row["mask_file_id"] != mask_file_id
    assert draft.draft["primaryImageFileId"] == row["processed_file_id"]


@pytest.mark.asyncio
async def test_edit_draft_mask_updates_square_asset_ids_and_primary_image(connection, mock_storage):
    original_bytes, mask_bytes = build_original_and_mask((300, 420), (90, 50, 210, 380))
    prepared = prepare_square_editor_assets(
        original_bytes,
        mask_bytes,
        canvas_size=CANVAS_SIZE,
        padding_ratio=0.22,
        min_padding_px=48,
        alpha_threshold=8,
    )
    original_file_id = await store_file(connection, "user_1", "original.png", {"original": original_bytes, "card": original_bytes, "thumbnail": original_bytes})
    square_files = await wardrobe_service.save_square_draft_artifacts(
        connection,
        "user_1",
        "draft_ready",
        square_source_bytes=prepared["square_source_bytes"],
        square_mask_bytes=prepared["square_mask_bytes"],
        square_cutout_bytes=prepared["square_cutout_bytes"],
    )
    await connection.execute(
        insert(item_drafts).values(
            id="draft_ready",
            user_id="user_1",
            source_type="photo",
            processing_status=wardrobe_service.PRIMARY_READY_STATUS,
            catalog_id="catalog_main",
            original_file_id=original_file_id,
            editor_file_id=square_files["editor_file_id"],
            processed_file_id=square_files["processed_file_id"],
            mask_file_id=square_files["mask_file_id"],
            suggested_payload_json={"primaryImageFileId": square_files["processed_file_id"]},
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
    )

    edited_mask = Image.open(BytesIO(prepared["square_mask_bytes"])).convert("L")
    ImageDraw.Draw(edited_mask).rectangle((0, 0, CANVAS_SIZE, 180), fill=0)
    updated = await wardrobe_service.edit_draft_mask(
        connection,
        "user_1",
        "draft_ready",
        mask_bytes=png_bytes(edited_mask),
        mask_image_base64=None,
        flip_horizontal=True,
        rotation_degrees=90,
        strokes_json=None,
    )
    row = (
        await connection.execute(select(item_drafts).where(item_drafts.c.id == "draft_ready"))
    ).mappings().first()

    assert updated.editorImageUrl is not None
    assert updated.maskBitmap["width"] == CANVAS_SIZE
    assert updated.maskBitmap["height"] == CANVAS_SIZE
    assert row["editor_file_id"] != square_files["editor_file_id"]
    assert row["processed_file_id"] != square_files["processed_file_id"]
    assert row["mask_file_id"] != square_files["mask_file_id"]
    assert updated.draft["primaryImageFileId"] == row["processed_file_id"]

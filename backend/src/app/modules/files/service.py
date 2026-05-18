import inspect
from io import BytesIO
from uuid import uuid4

from aiobotocore.session import get_session
from PIL import Image
from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.config import get_settings
from app.db.metadata import file_variants, files


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


class S3Storage:
    def __init__(self) -> None:
        self.settings = get_settings()

    def configured(self) -> bool:
        return bool(self.settings.s3_endpoint_url and self.settings.s3_access_key and self.settings.s3_secret_key)

    def _client_kwargs(self) -> dict:
        return {
            "endpoint_url": self.settings.s3_endpoint_url,
            "aws_access_key_id": self.settings.s3_access_key,
            "aws_secret_access_key": self.settings.s3_secret_key,
            "region_name": self.settings.s3_region,
        }

    async def put_object(self, object_key: str, body: bytes, mime_type: str) -> None:
        if not self.configured():
            return
        session = get_session()
        async with session.create_client("s3", **self._client_kwargs(), verify=False) as client:
            await client.put_object(
                Bucket=self.settings.s3_bucket_private,
                Key=object_key,
                Body=body,
                ContentType=mime_type,
            )

    async def get_object(self, bucket: str, object_key: str) -> bytes | None:
        if not self.configured():
            return None
        session = get_session()
        async with session.create_client("s3", **self._client_kwargs(), verify=False) as client:
            response = await client.get_object(Bucket=bucket, Key=object_key)
            stream = response["Body"]
            try:
                return await stream.read()
            finally:
                close_result = stream.close()
                if inspect.isawaitable(close_result):
                    await close_result

    async def presigned_get_url(self, bucket: str, object_key: str) -> str | None:
        if not self.configured():
            return None
        session = get_session()
        async with session.create_client("s3", **self._client_kwargs(), verify=False) as client:
            return await client.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket, "Key": object_key},
                ExpiresIn=self.settings.s3_presigned_expire_seconds,
            )


storage = S3Storage()


async def create_file_record(
    connection: AsyncConnection,
    filename: str,
    mime_type: str,
    *,
    file_id: str | None = None,
) -> str:
    file_id = file_id or new_id("file")
    await connection.execute(
        insert(files).values(
            id=file_id,
            mime_type=mime_type,
            original_filename=filename,
        )
    )
    return file_id


async def save_file_variant(
    connection: AsyncConnection,
    user_id: str,
    file_id: str,
    variant_type: str,
    content: bytes,
    mime_type: str,
) -> None:
    object_key = f"users/{user_id}/wardrobe/{file_id}/{variant_type}"
    await storage.put_object(object_key, content, mime_type)
    existing = (
        await connection.execute(
            select(file_variants.c.id).where(
                file_variants.c.file_id == file_id,
                file_variants.c.variant_type == variant_type,
            )
        )
    ).scalar_one_or_none()
    values = {
        "file_id": file_id,
        "variant_type": variant_type,
        "bucket": get_settings().s3_bucket_private,
        "object_key": object_key,
        "mime_type": mime_type,
        "size_bytes": len(content),
    }
    if existing:
        await connection.execute(update(file_variants).where(file_variants.c.id == existing).values(**values))
        return
    await connection.execute(insert(file_variants).values(id=new_id("variant"), **values))


async def create_image_file_with_variants(
    connection: AsyncConnection,
    user_id: str,
    content_by_variant: dict[str, bytes],
    filename: str,
    mime_type: str,
) -> str:
    file_id = await create_file_record(connection, filename, mime_type)
    for variant_type, variant_content in content_by_variant.items():
        await save_file_variant(connection, user_id, file_id, variant_type, variant_content, mime_type)
    return file_id


def _png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def transparent_cutout_variants(content: bytes, *, padding_ratio: float = 0.08) -> dict[str, bytes]:
    image = Image.open(BytesIO(content)).convert("RGBA")
    alpha_bbox = image.getchannel("A").getbbox()
    if not alpha_bbox:
        return {"cutout": content, "card": content, "thumbnail": content}

    left, top, right, bottom = alpha_bbox
    padding = max(8, int(max(right - left, bottom - top) * padding_ratio))
    crop_box = (
        max(0, left - padding),
        max(0, top - padding),
        min(image.width, right + padding),
        min(image.height, bottom + padding),
    )
    cropped = image.crop(crop_box)
    cropped_bytes = _png_bytes(cropped)
    return {"cutout": content, "card": cropped_bytes, "thumbnail": cropped_bytes}


async def create_image_file(
    connection: AsyncConnection,
    user_id: str,
    content: bytes,
    filename: str,
    mime_type: str,
) -> str:
    return await create_image_file_with_variants(
        connection,
        user_id,
        {"original": content, "card": content, "thumbnail": content},
        filename,
        mime_type,
    )


async def get_file_variant_record(connection: AsyncConnection, file_id: str | None, variant_type: str) -> dict | None:
    if not file_id:
        return None
    return (
        await connection.execute(
            select(file_variants).where(
                file_variants.c.file_id == file_id,
                file_variants.c.variant_type == variant_type,
            )
        )
    ).mappings().first()


async def get_file_bytes(connection: AsyncConnection, file_id: str | None, variant_type: str = "original") -> bytes | None:
    row = await get_file_variant_record(connection, file_id, variant_type)
    if row is None:
        return None
    return await storage.get_object(row["bucket"], row["object_key"])


async def get_file_url(connection: AsyncConnection, file_id: str | None, variant_type: str = "card") -> str | None:
    row = await get_file_variant_record(connection, file_id, variant_type)
    if row is None:
        return None
    return await storage.presigned_get_url(row["bucket"], row["object_key"])

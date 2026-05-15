from uuid import uuid4

from aiobotocore.session import get_session
from sqlalchemy import insert, select
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


async def create_image_file(
    connection: AsyncConnection,
    user_id: str,
    content: bytes,
    filename: str,
    mime_type: str,
) -> str:
    file_id = new_id("file")
    await connection.execute(
        insert(files).values(
            id=file_id,
            mime_type=mime_type,
            original_filename=filename,
        )
    )

    for variant_type in ("original", "card", "thumbnail"):
        object_key = f"users/{user_id}/wardrobe/{file_id}/{variant_type}"
        await storage.put_object(object_key, content, mime_type)
        await connection.execute(
            insert(file_variants).values(
                id=new_id("variant"),
                file_id=file_id,
                variant_type=variant_type,
                bucket=get_settings().s3_bucket_private,
                object_key=object_key,
                mime_type=mime_type,
                size_bytes=len(content),
            )
        )
    return file_id


async def get_file_url(connection: AsyncConnection, file_id: str | None, variant_type: str = "card") -> str | None:
    if not file_id:
        return None
    row = (
        await connection.execute(
            select(file_variants.c.bucket, file_variants.c.object_key).where(
                file_variants.c.file_id == file_id,
                file_variants.c.variant_type == variant_type,
            )
        )
    ).mappings().first()
    if row is None:
        return None
    return await storage.presigned_get_url(row["bucket"], row["object_key"])

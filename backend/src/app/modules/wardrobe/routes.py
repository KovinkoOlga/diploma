from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncConnection

from app.db.database import get_connection
from app.modules.auth.dependencies import get_current_user
from app.modules.files.service import create_image_file
from app.modules.wardrobe import service
from app.modules.wardrobe.schemas import (
    BootstrapResponse,
    BulkDeletePayload,
    BulkUpdatePayload,
    CatalogCreatePayload,
    CatalogPatchPayload,
    CatalogResponse,
    DictionariesResponse,
    DictionaryBrandResponse,
    DictionaryNamePatchPayload,
    DictionaryStyleResponse,
    DictionarySubcategoryResponse,
    DraftCreatePayload,
    DraftResponse,
    ItemPatch,
    ItemPayload,
    ItemResponse,
)


router = APIRouter(prefix="/wardrobe", tags=["wardrobe"])


def _user_id(user: dict) -> str:
    return user["id"]


@router.get("/bootstrap", response_model=BootstrapResponse)
async def bootstrap(
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> BootstrapResponse:
    return await service.get_bootstrap(connection, _user_id(current_user))


@router.get("/categories")
async def categories(
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
):
    return (await service.get_bootstrap(connection, _user_id(current_user))).categories


@router.get("/subcategories")
async def subcategory_list(
    categoryId: str | None = None,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
):
    categories = (await service.get_bootstrap(connection, _user_id(current_user))).categories
    if categoryId:
        return next((category.subcategories for category in categories if category.id == categoryId), [])
    return {category.id: category.subcategories for category in categories}


@router.post("/catalogs", response_model=CatalogResponse)
async def create_catalog(
    payload: CatalogCreatePayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> CatalogResponse:
    return await service.create_catalog(connection, _user_id(current_user), payload.title)


@router.patch("/catalogs/{catalog_id}", response_model=CatalogResponse)
async def update_catalog(
    catalog_id: str,
    payload: CatalogPatchPayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> CatalogResponse:
    try:
        return await service.update_catalog(connection, _user_id(current_user), catalog_id, payload.title)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog not found")


@router.get("/dictionaries", response_model=DictionariesResponse)
async def dictionaries(
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> DictionariesResponse:
    return await service.get_dictionaries(connection, _user_id(current_user))


@router.patch("/subcategories/{subcategory_id}", response_model=DictionarySubcategoryResponse)
async def update_subcategory(
    subcategory_id: str,
    payload: DictionaryNamePatchPayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> DictionarySubcategoryResponse:
    try:
        return await service.rename_subcategory(connection, _user_id(current_user), subcategory_id, payload.name)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Подкатегория не найдена")
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.delete("/subcategories/{subcategory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_subcategory(
    subcategory_id: str,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> None:
    try:
        await service.delete_subcategory(connection, _user_id(current_user), subcategory_id)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Подкатегория не найдена")
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.patch("/styles/{style_id}", response_model=DictionaryStyleResponse)
async def update_style(
    style_id: str,
    payload: DictionaryNamePatchPayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> DictionaryStyleResponse:
    try:
        return await service.rename_style(connection, _user_id(current_user), style_id, payload.name)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Стиль не найден")
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.delete("/styles/{style_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_style(
    style_id: str,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> None:
    try:
        await service.delete_style(connection, _user_id(current_user), style_id)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Стиль не найден")
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.patch("/brands/{brand_id}", response_model=DictionaryBrandResponse)
async def update_brand(
    brand_id: str,
    payload: DictionaryNamePatchPayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> DictionaryBrandResponse:
    try:
        return await service.rename_brand(connection, _user_id(current_user), brand_id, payload.name)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Бренд не найден")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.delete("/brands/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_brand(
    brand_id: str,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> None:
    try:
        await service.delete_brand(connection, _user_id(current_user), brand_id)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Бренд не найден")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.get("/items", response_model=list[ItemResponse])
async def items(
    q: str = "",
    catalogId: list[str] = Query(default=[]),
    categoryId: list[str] = Query(default=[]),
    subcategory: list[str] = Query(default=[]),
    color: list[str] = Query(default=[]),
    season: list[str] = Query(default=[]),
    style: list[str] = Query(default=[]),
    brand: list[str] = Query(default=[]),
    status: list[str] = Query(default=[]),
    outfitParticipation: str = "",
    sortBy: str = "recent",
    includeArchived: bool = False,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> list[ItemResponse]:
    return await service.list_items(
        connection,
        _user_id(current_user),
        {
            "q": q,
            "catalogId": catalogId,
            "categoryId": categoryId,
            "subcategory": subcategory,
            "color": color,
            "season": season,
            "style": style,
            "brand": brand,
            "status": status,
            "outfitParticipation": outfitParticipation,
            "sortBy": sortBy,
            "includeArchived": includeArchived,
        },
    )


@router.get("/items/{item_id}", response_model=ItemResponse)
async def item_detail(
    item_id: str,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> ItemResponse:
    try:
        return await service.get_item(connection, _user_id(current_user), item_id)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")


@router.post("/items", response_model=ItemResponse)
async def create_item(
    payload: ItemPayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> ItemResponse:
    try:
        return await service.create_item(connection, _user_id(current_user), payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.patch("/items/{item_id}", response_model=ItemResponse)
async def patch_item(
    item_id: str,
    payload: ItemPatch,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> ItemResponse:
    try:
        return await service.patch_item(connection, _user_id(current_user), item_id, payload)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: str,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> None:
    await service.delete_item(connection, _user_id(current_user), item_id)


@router.post("/items/bulk-update", response_model=list[ItemResponse])
async def bulk_update(
    payload: BulkUpdatePayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> list[ItemResponse]:
    try:
        result = []
        for item_id in payload.itemIds:
            result.append(await service.patch_item(connection, _user_id(current_user), item_id, payload.patch))
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/items/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete(
    payload: BulkDeletePayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> None:
    for item_id in payload.itemIds:
        await service.delete_item(connection, _user_id(current_user), item_id)


@router.post("/items/{item_id}/archive", response_model=ItemResponse)
async def archive_item(
    item_id: str,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> ItemResponse:
    try:
        return await service.patch_item(connection, _user_id(current_user), item_id, ItemPatch(status="archived"))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/items/{item_id}/restore", response_model=ItemResponse)
async def restore_item(
    item_id: str,
    catalogId: str | None = None,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> ItemResponse:
    try:
        return await service.patch_item(connection, _user_id(current_user), item_id, ItemPatch(status="active", catalogId=catalogId))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/drafts", response_model=DraftResponse)
async def create_draft(
    payload: DraftCreatePayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> DraftResponse:
    try:
        return await service.create_draft(connection, _user_id(current_user), payload.sourceType, payload.catalogId, payload.templateId)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/drafts/upload", response_model=DraftResponse)
async def upload_draft(
    sourceType: str = Form("photo"),
    catalogId: str = Form(...),
    file: UploadFile | None = File(None),
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> DraftResponse:
    file_id = None
    if file is not None:
        content = await file.read()
        file_id = await create_image_file(
            connection,
            _user_id(current_user),
            content,
            file.filename or "wardrobe-image",
            file.content_type or "application/octet-stream",
        )
    try:
        return await service.create_draft(connection, _user_id(current_user), sourceType, catalogId, file_id=file_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/drafts/from-template", response_model=DraftResponse)
async def draft_from_template(
    payload: DraftCreatePayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> DraftResponse:
    try:
        return await service.create_draft(connection, _user_id(current_user), "catalog", payload.catalogId, payload.templateId)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/drafts/{draft_id}/mask-edit", response_model=DraftResponse)
@router.post("/drafts/{draft_id}/mask-edit/", response_model=DraftResponse, include_in_schema=False)
async def edit_draft_mask(
    draft_id: str,
    flipHorizontal: bool = Form(False),
    rotationDegrees: int = Form(0),
    maskImageBase64: str | None = Form(None),
    strokes: str | None = Form(None),
    mask: UploadFile | None = File(None),
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> DraftResponse:
    try:
        mask_bytes = await mask.read() if mask is not None else None
        return await service.edit_draft_mask(
            connection,
            _user_id(current_user),
            draft_id,
            mask_bytes=mask_bytes,
            mask_image_base64=maskImageBase64,
            flip_horizontal=flipHorizontal,
            rotation_degrees=rotationDegrees,
            strokes_json=strokes,
        )
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.get("/drafts/{draft_id}", response_model=DraftResponse)
async def get_draft(
    draft_id: str,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> DraftResponse:
    try:
        return await service.get_draft(connection, _user_id(current_user), draft_id)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")


@router.post("/drafts/{draft_id}/enhance", response_model=DraftResponse)
async def enhance_draft(
    draft_id: str,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> DraftResponse:
    try:
        return await service.enhance_draft(connection, _user_id(current_user), draft_id)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/drafts/{draft_id}/confirm", response_model=ItemResponse)
async def confirm_draft(
    draft_id: str,
    payload: ItemPatch | None = None,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> ItemResponse:
    try:
        return await service.confirm_draft(connection, _user_id(current_user), draft_id, payload)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    except ValidationError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Проверьте заполнение обязательных полей карточки вещи",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

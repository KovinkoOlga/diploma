from typing import Any, Literal

from pydantic import BaseModel, Field


class CatalogResponse(BaseModel):
    id: str
    title: str
    description: str = ""
    sortOrder: int = 0
    isDefault: bool = False


class CategoryResponse(BaseModel):
    id: str
    title: str
    icon: str
    subcategories: list[str] = Field(default_factory=list)


class StatusResponse(BaseModel):
    id: str
    title: str


class TemplateResponse(BaseModel):
    id: str
    title: str
    categoryId: str
    subcategory: str
    colors: list[str]
    styles: list[str]
    seasons: list[str]
    brand: str = ""
    material: str = ""
    size: str = ""
    image: str | None = None


class BootstrapResponse(BaseModel):
    catalogs: list[CatalogResponse]
    categories: list[CategoryResponse]
    colors: list[str]
    seasons: list[str]
    sizes: list[str]
    styles: list[str]
    statuses: list[StatusResponse]
    templates: list[TemplateResponse]


class ItemPayload(BaseModel):
    title: str = Field(min_length=1)
    catalogId: str
    categoryId: str
    subcategory: str = ""
    colors: list[str] = Field(default_factory=list)
    brand: str = ""
    size: str = ""
    material: str = ""
    seasons: list[str] = Field(default_factory=list)
    styles: list[str] = Field(default_factory=list)
    status: str = "active"
    notes: str = ""
    primaryImageFileId: str | None = None


class ItemPatch(BaseModel):
    title: str | None = None
    catalogId: str | None = None
    categoryId: str | None = None
    subcategory: str | None = None
    colors: list[str] | None = None
    brand: str | None = None
    size: str | None = None
    material: str | None = None
    seasons: list[str] | None = None
    styles: list[str] | None = None
    status: str | None = None
    notes: str | None = None
    primaryImageFileId: str | None = None


class ItemResponse(BaseModel):
    id: str
    title: str
    catalogId: str
    categoryId: str
    subcategory: str = ""
    colors: list[str] = Field(default_factory=list)
    color: str = ""
    brand: str = ""
    size: str = ""
    material: str = ""
    seasons: list[str] = Field(default_factory=list)
    season: list[str] = Field(default_factory=list)
    styles: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    status: str
    isArchived: bool
    createdAt: str
    outfitCount: int = 0
    notes: str = ""
    image: str | None = None
    imageUrl: str | None = None
    primaryImageFileId: str | None = None


class BulkUpdatePayload(BaseModel):
    itemIds: list[str]
    patch: ItemPatch


class BulkDeletePayload(BaseModel):
    itemIds: list[str]


class CatalogCreatePayload(BaseModel):
    title: str = Field(min_length=1)


class CatalogPatchPayload(BaseModel):
    title: str = Field(min_length=1)


class DraftCreatePayload(BaseModel):
    sourceType: Literal["photo", "gallery", "catalog"] = "photo"
    catalogId: str
    templateId: str | None = None


class DraftImageAsset(BaseModel):
    fileId: str
    imageUrl: str | None = None


class DraftImagesResponse(BaseModel):
    cutout: DraftImageAsset | None = None
    catalog: DraftImageAsset | None = None


class DraftResponse(BaseModel):
    id: str
    sourceType: str
    processingStatus: str
    catalogProcessingStatus: str = "not_requested"
    ready: bool
    draft: dict[str, Any] | None = None
    errorMessage: str | None = None
    catalogErrorMessage: str | None = None
    images: DraftImagesResponse | None = None
    maskImageUrl: str | None = None
    mlResult: dict[str, Any] | None = None

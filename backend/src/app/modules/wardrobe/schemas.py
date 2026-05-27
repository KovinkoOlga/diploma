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


class DictionarySubcategoryResponse(BaseModel):
    id: str
    name: str
    categoryId: str
    categoryTitle: str
    isSystem: bool = False
    itemCount: int = 0


class DictionaryStyleResponse(BaseModel):
    id: str
    name: str
    isSystem: bool = False
    itemCount: int = 0
    outfitCount: int = 0


class DictionaryBrandResponse(BaseModel):
    id: str
    name: str
    itemCount: int = 0


class DictionariesResponse(BaseModel):
    subcategories: list[DictionarySubcategoryResponse] = Field(default_factory=list)
    styles: list[DictionaryStyleResponse] = Field(default_factory=list)
    brands: list[DictionaryBrandResponse] = Field(default_factory=list)


class StatusResponse(BaseModel):
    id: str
    title: str


class ColorResponse(BaseModel):
    id: str
    name: str
    parentColorId: str | None = None
    parentName: str | None = None
    hex: str | None = None
    kind: str
    sortOrder: int


class TemplateResponse(BaseModel):
    id: str
    title: str
    categoryId: str
    subcategory: str
    colorIds: list[str] = Field(default_factory=list)
    styles: list[str] = Field(default_factory=list)
    seasons: list[str] = Field(default_factory=list)
    brand: str = ""
    image: str | None = None


class BootstrapResponse(BaseModel):
    catalogs: list[CatalogResponse]
    categories: list[CategoryResponse]
    colorOptions: list[ColorResponse]
    seasons: list[str]
    styles: list[str]
    statuses: list[StatusResponse]
    templates: list[TemplateResponse]


class ItemPayload(BaseModel):
    title: str = Field(min_length=1)
    catalogId: str
    categoryId: str
    subcategory: str = ""
    colorIds: list[str] = Field(default_factory=list)
    brand: str = ""
    seasons: list[str] = Field(default_factory=list)
    styles: list[str] = Field(default_factory=list)
    status: str = "active"
    notes: str = ""
    primaryImageFileId: str | None = None
    categoryPrediction: dict[str, Any] | None = None
    colorPrediction: dict[str, Any] | None = None


class ItemPatch(BaseModel):
    title: str | None = None
    catalogId: str | None = None
    categoryId: str | None = None
    subcategory: str | None = None
    colorIds: list[str] | None = None
    brand: str | None = None
    seasons: list[str] | None = None
    styles: list[str] | None = None
    status: str | None = None
    notes: str | None = None
    primaryImageFileId: str | None = None
    categoryPrediction: dict[str, Any] | None = None
    colorPrediction: dict[str, Any] | None = None


class ItemResponse(BaseModel):
    id: str
    title: str
    catalogId: str
    categoryId: str
    subcategory: str = ""
    colorIds: list[str] = Field(default_factory=list)
    colorDetails: list[ColorResponse] = Field(default_factory=list)
    brand: str = ""
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


class DictionaryNamePatchPayload(BaseModel):
    name: str = Field(min_length=1)


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
    editorImageUrl: str | None = None
    originalImageUrl: str | None = None
    originalImagePreviewDataUrl: str | None = None
    maskImageUrl: str | None = None
    maskBitmap: dict[str, Any] | None = None
    mlResult: dict[str, Any] | None = None


class InternalDraftProgressPayload(BaseModel):
    status: Literal[
        "preparing",
        "background_removing",
        "category_recognizing",
        "colors_extracting",
        "attributes_suggested",
        "failed",
    ]
    message: str | None = None
    source: str | None = None
    event: str | None = None
    timingsMs: dict[str, int] | None = None

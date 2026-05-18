from typing import Any, Literal

from pydantic import BaseModel, Field


OutfitCoverMode = Literal["none", "gallery", "composition"]


class OutfitPayload(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    itemIds: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    season: list[str] = Field(default_factory=list)
    coverMode: OutfitCoverMode = "none"
    coverFileId: str | None = None
    coverEditorStateJson: dict[str, Any] | None = None


class OutfitPatch(BaseModel):
    title: str | None = None
    description: str | None = None
    itemIds: list[str] | None = None
    tags: list[str] | None = None
    season: list[str] | None = None
    coverMode: OutfitCoverMode | None = None
    coverFileId: str | None = None
    coverEditorStateJson: dict[str, Any] | None = None


class OutfitResponse(BaseModel):
    id: str
    title: str
    description: str = ""
    itemIds: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    season: list[str] = Field(default_factory=list)
    createdAt: str
    coverMode: OutfitCoverMode = "none"
    coverFileId: str | None = None
    coverImageUrl: str | None = None
    coverTransparentImageUrl: str | None = None
    coverEditorStateJson: dict[str, Any] | None = None


class OutfitCoverUploadResponse(BaseModel):
    fileId: str
    coverImageUrl: str | None = None
    coverTransparentImageUrl: str | None = None

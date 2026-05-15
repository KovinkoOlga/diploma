from pydantic import BaseModel, Field


class OutfitPayload(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    itemIds: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    season: list[str] = Field(default_factory=list)


class OutfitPatch(BaseModel):
    title: str | None = None
    description: str | None = None
    itemIds: list[str] | None = None
    tags: list[str] | None = None
    season: list[str] | None = None


class OutfitResponse(BaseModel):
    id: str
    title: str
    description: str = ""
    itemIds: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    season: list[str] = Field(default_factory=list)


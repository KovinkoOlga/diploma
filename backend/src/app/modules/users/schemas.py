from pydantic import BaseModel, Field


class ProfilePatch(BaseModel):
    displayName: str | None = Field(default=None, min_length=1, max_length=255)

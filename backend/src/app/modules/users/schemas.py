from pydantic import BaseModel, EmailStr, Field


class ProfilePatch(BaseModel):
    email: EmailStr | None = None
    displayName: str | None = Field(default=None, min_length=1, max_length=255)


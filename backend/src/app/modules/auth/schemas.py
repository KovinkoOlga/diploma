from pydantic import BaseModel, EmailStr, Field


class AuthRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    displayName: str
    avatarFileId: str | None = None
    avatarUrl: str | None = None
    createdAt: str = ""


class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    tokenType: str = "bearer"
    user: UserResponse


class RefreshRequest(BaseModel):
    refreshToken: str = Field(min_length=20)


class LogoutRequest(BaseModel):
    refreshToken: str | None = None


class ChangePasswordRequest(BaseModel):
    currentPassword: str = Field(min_length=6, max_length=72)
    newPassword: str = Field(min_length=6, max_length=72)

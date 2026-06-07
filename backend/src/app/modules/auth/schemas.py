from pydantic import BaseModel, EmailStr, Field


class EmailRequest(BaseModel):
    email: EmailStr


class EmailCodeVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class BackupEmailRequest(BaseModel):
    backupEmail: EmailStr


class VerifyCodeRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class PrimaryEmailChangeRequest(BaseModel):
    newEmail: EmailStr


class PrimaryEmailVerifyRequest(BaseModel):
    newEmail: EmailStr
    code: str = Field(min_length=6, max_length=6)


class CodeRequestResponse(BaseModel):
    ok: bool
    cooldownSeconds: int | None = None
    nextResendAt: str | None = None
    devCode: str | None = None


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    emailVerified: bool
    backupEmail: EmailStr | None = None
    backupEmailVerified: bool
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

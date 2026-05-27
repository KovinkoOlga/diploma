from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from sqlalchemy.orm import DeclarativeBase
from starlette.requests import Request

from app.core.config import get_settings
from app.db.database import engine
from app.db.metadata import (
    categories,
    file_variants,
    files,
    item_drafts,
    item_statuses,
    refresh_sessions,
    subcategories,
    users,
    wardrobe_catalogs,
    wardrobe_item_templates,
    wardrobe_items,
)


class Base(DeclarativeBase):
    pass


class User(Base):
    __table__ = users


class File(Base):
    __table__ = files


class FileVariant(Base):
    __table__ = file_variants


class Catalog(Base):
    __table__ = wardrobe_catalogs


class Category(Base):
    __table__ = categories


class Subcategory(Base):
    __table__ = subcategories


class Status(Base):
    __table__ = item_statuses


class WardrobeItem(Base):
    __table__ = wardrobe_items


class ItemDraft(Base):
    __table__ = item_drafts


class ItemTemplate(Base):
    __table__ = wardrobe_item_templates


class RefreshSession(Base):
    __table__ = refresh_sessions


class SimpleAdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        settings = get_settings()
        if form.get("username") == settings.sqladmin_username and form.get("password") == settings.sqladmin_password:
            request.session.update({"sqladmin": True})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return bool(request.session.get("sqladmin"))


class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.email, User.display_name, User.created_at]


class CatalogAdmin(ModelView, model=Catalog):
    column_list = [Catalog.id, Catalog.user_id, Catalog.name, Catalog.sort_order, Catalog.is_default]


class CategoryAdmin(ModelView, model=Category):
    column_list = [Category.id, Category.name, Category.icon_key, Category.sort_order]
    can_create = False
    can_edit = False
    can_delete = False


class SubcategoryAdmin(ModelView, model=Subcategory):
    column_list = [Subcategory.id, Subcategory.category_id, Subcategory.user_id, Subcategory.name, Subcategory.is_system]


class WardrobeItemAdmin(ModelView, model=WardrobeItem):
    column_list = [WardrobeItem.id, WardrobeItem.user_id, WardrobeItem.name, WardrobeItem.catalog_id, WardrobeItem.category_id, WardrobeItem.status_id]


class StatusAdmin(ModelView, model=Status):
    column_list = [Status.id, Status.code, Status.name, Status.sort_order]
    can_create = False
    can_edit = False
    can_delete = False


class FileAdmin(ModelView, model=File):
    column_list = [File.id, File.mime_type, File.original_filename, File.created_at]


class FileVariantAdmin(ModelView, model=FileVariant):
    column_list = [FileVariant.id, FileVariant.file_id, FileVariant.variant_type, FileVariant.bucket, FileVariant.object_key]


class ItemDraftAdmin(ModelView, model=ItemDraft):
    column_list = [
        ItemDraft.id,
        ItemDraft.user_id,
        ItemDraft.source_type,
        ItemDraft.processing_status,
        ItemDraft.catalog_processing_status,
        ItemDraft.catalog_id,
        ItemDraft.original_file_id,
        ItemDraft.editor_file_id,
        ItemDraft.processed_file_id,
        ItemDraft.mask_file_id,
        ItemDraft.catalog_file_id,
    ]


class ItemTemplateAdmin(ModelView, model=ItemTemplate):
    column_list = [ItemTemplate.id, ItemTemplate.name, ItemTemplate.category_id, ItemTemplate.subcategory_name, ItemTemplate.sort_order]


class RefreshSessionAdmin(ModelView, model=RefreshSession):
    column_list = [RefreshSession.id, RefreshSession.user_id, RefreshSession.created_at, RefreshSession.expires_at, RefreshSession.revoked_at]


def setup_admin(app) -> None:
    admin = Admin(app, engine, authentication_backend=SimpleAdminAuth(secret_key=get_settings().jwt_secret_key))
    for view in (
        UserAdmin,
        CatalogAdmin,
        CategoryAdmin,
        SubcategoryAdmin,
        WardrobeItemAdmin,
        StatusAdmin,
        FileAdmin,
        FileVariantAdmin,
        ItemDraftAdmin,
        ItemTemplateAdmin,
        RefreshSessionAdmin,
    ):
        admin.add_view(view)

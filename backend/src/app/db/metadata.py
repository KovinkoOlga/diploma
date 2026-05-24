from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)


metadata = MetaData()

users = Table(
    "users",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("email", String(255), nullable=False, unique=True),
    Column("password_hash", String(255), nullable=False),
    Column("display_name", String(255), nullable=False, default=""),
    Column("avatar_file_id", String(48), ForeignKey("files.id"), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

refresh_sessions = Table(
    "refresh_sessions",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("user_id", String(48), ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("refresh_token_hash", String(128), nullable=False, unique=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("revoked_at", DateTime(timezone=True), nullable=True),
    Column("replaced_by_session_id", String(48), ForeignKey("refresh_sessions.id"), nullable=True),
    Column("user_agent", String(255), nullable=False, default=""),
    Column("device_name", String(120), nullable=False, default=""),
)

files = Table(
    "files",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("mime_type", String(120), nullable=False),
    Column("original_filename", String(255), nullable=False, default=""),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

file_variants = Table(
    "file_variants",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("file_id", String(48), ForeignKey("files.id", ondelete="CASCADE"), nullable=False),
    Column("variant_type", String(40), nullable=False),
    Column("bucket", String(255), nullable=False),
    Column("object_key", String(512), nullable=False),
    Column("mime_type", String(120), nullable=False),
    Column("size_bytes", Integer, nullable=False, default=0),
    Column("width", Integer, nullable=True),
    Column("height", Integer, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint("file_id", "variant_type", name="uq_file_variants_file_type"),
)

wardrobe_catalogs = Table(
    "wardrobe_catalogs",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("user_id", String(48), ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("name", String(120), nullable=False),
    Column("sort_order", Integer, nullable=False, default=0),
    Column("is_default", Boolean, nullable=False, default=False),
    UniqueConstraint("user_id", "name", name="uq_catalogs_user_name"),
)

categories = Table(
    "categories",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("name", String(120), nullable=False, unique=True),
    Column("icon_key", String(80), nullable=False, default="pricetag-outline"),
    Column("sort_order", Integer, nullable=False, default=0),
)

subcategories = Table(
    "subcategories",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("category_id", String(48), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False),
    Column("user_id", String(48), ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
    Column("name", String(120), nullable=False),
    Column("normalized_name", String(120), nullable=False),
    Column("is_system", Boolean, nullable=False, default=False),
    UniqueConstraint("category_id", "user_id", "normalized_name", name="uq_subcategories_category_user_name"),
    CheckConstraint(
        "(is_system = true AND user_id IS NULL) OR (is_system = false AND user_id IS NOT NULL)",
        name="ck_subcategories_owner_matches_type",
    ),
)

colors = Table(
    "colors",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("name", String(80), nullable=False, unique=True),
    Column("parent_color_id", String(48), ForeignKey("colors.id"), nullable=True),
    Column("hex", String(16), nullable=True),
    Column("kind", String(24), nullable=False, default="solid"),
    Column("sort_order", Integer, nullable=False, default=0),
)

brands = Table(
    "brands",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("name", String(120), nullable=False),
    Column("normalized_name", String(120), nullable=False),
    Column("user_id", String(48), ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    UniqueConstraint("user_id", "normalized_name", name="uq_brands_user_name"),
)

seasons = Table(
    "seasons",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("name", String(80), nullable=False, unique=True),
    Column("sort_order", Integer, nullable=False, default=0),
)

styles = Table(
    "styles",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("user_id", String(48), ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
    Column("name", String(80), nullable=False),
    Column("normalized_name", String(80), nullable=False),
    Column("is_system", Boolean, nullable=False, default=True),
    UniqueConstraint("user_id", "normalized_name", name="uq_styles_user_name"),
)

item_statuses = Table(
    "item_statuses",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("code", String(40), nullable=False, unique=True),
    Column("name", String(120), nullable=False),
    Column("sort_order", Integer, nullable=False, default=0),
)

wardrobe_items = Table(
    "wardrobe_items",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("user_id", String(48), ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("catalog_id", String(48), ForeignKey("wardrobe_catalogs.id"), nullable=False),
    Column("category_id", String(48), ForeignKey("categories.id"), nullable=False),
    Column("subcategory_id", String(48), ForeignKey("subcategories.id"), nullable=True),
    Column("primary_image_file_id", String(48), ForeignKey("files.id"), nullable=True),
    Column("status_id", String(48), ForeignKey("item_statuses.id"), nullable=False),
    Column("name", String(160), nullable=False),
    Column("brand_id", String(48), ForeignKey("brands.id"), nullable=True),
    Column("notes", Text, nullable=True),
    Column("attributes_json", JSON, nullable=True),
    Column("last_worn_at", DateTime(timezone=True), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

item_colors = Table(
    "item_colors",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("item_id", String(48), ForeignKey("wardrobe_items.id", ondelete="CASCADE"), nullable=False),
    Column("color_id", String(48), ForeignKey("colors.id"), nullable=False),
    Column("position", Integer, nullable=False, default=0),
    Column("coverage_percent", Float, nullable=True),
    Column("source", String(24), nullable=True),
    Column("confidence", Float, nullable=True),
    UniqueConstraint("item_id", "color_id", name="uq_item_colors_item_color"),
)

item_seasons = Table(
    "item_seasons",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("item_id", String(48), ForeignKey("wardrobe_items.id", ondelete="CASCADE"), nullable=False),
    Column("season_id", String(48), ForeignKey("seasons.id"), nullable=False),
    UniqueConstraint("item_id", "season_id", name="uq_item_seasons_item_season"),
)

item_styles = Table(
    "item_styles",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("item_id", String(48), ForeignKey("wardrobe_items.id", ondelete="CASCADE"), nullable=False),
    Column("style_id", String(48), ForeignKey("styles.id"), nullable=False),
    UniqueConstraint("item_id", "style_id", name="uq_item_styles_item_style"),
)

outfits = Table(
    "outfits",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("user_id", String(48), ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("name", String(160), nullable=False),
    Column("description", Text, nullable=True),
    Column("cover_file_id", String(48), ForeignKey("files.id"), nullable=True),
    Column("cover_mode", String(24), nullable=False, default="none"),
    Column("cover_editor_state_json", JSON, nullable=True),
    Column("style_id", String(48), ForeignKey("styles.id"), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

outfit_seasons = Table(
    "outfit_seasons",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("outfit_id", String(48), ForeignKey("outfits.id", ondelete="CASCADE"), nullable=False),
    Column("season_id", String(48), ForeignKey("seasons.id"), nullable=False),
    UniqueConstraint("outfit_id", "season_id", name="uq_outfit_seasons_outfit_season"),
)

outfit_items = Table(
    "outfit_items",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("outfit_id", String(48), ForeignKey("outfits.id", ondelete="CASCADE"), nullable=False),
    Column("item_id", String(48), ForeignKey("wardrobe_items.id", ondelete="CASCADE"), nullable=False),
    Column("role_code", String(80), nullable=False, default="item"),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint("outfit_id", "item_id", name="uq_outfit_items_outfit_item"),
)

outfit_collections = Table(
    "outfit_collections",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("user_id", String(48), ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("name", String(120), nullable=False),
    Column("normalized_name", String(120), nullable=False),
    Column("sort_order", Integer, nullable=False, default=0),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint("user_id", "normalized_name", name="uq_outfit_collections_user_name"),
)

outfit_collection_outfits = Table(
    "outfit_collection_outfits",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("outfit_id", String(48), ForeignKey("outfits.id", ondelete="CASCADE"), nullable=False),
    Column("collection_id", String(48), ForeignKey("outfit_collections.id", ondelete="CASCADE"), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint("outfit_id", "collection_id", name="uq_outfit_collection_outfits_pair"),
)

wardrobe_item_templates = Table(
    "wardrobe_item_templates",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("name", String(160), nullable=False),
    Column("category_id", String(48), ForeignKey("categories.id"), nullable=False),
    Column("subcategory_name", String(120), nullable=False),
    Column("brand", String(120), nullable=False, default=""),
    Column("color_ids_json", JSON, nullable=False, default=list),
    Column("seasons_json", JSON, nullable=False, default=list),
    Column("styles_json", JSON, nullable=False, default=list),
    Column("sort_order", Integer, nullable=False, default=0),
)

item_drafts = Table(
    "item_drafts",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("user_id", String(48), ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("source_type", String(40), nullable=False),
    Column("processing_status", String(60), nullable=False),
    Column("catalog_id", String(48), ForeignKey("wardrobe_catalogs.id"), nullable=False),
    Column("original_file_id", String(48), ForeignKey("files.id"), nullable=True),
    Column("processed_file_id", String(48), ForeignKey("files.id"), nullable=True),
    Column("mask_file_id", String(48), ForeignKey("files.id"), nullable=True),
    Column("catalog_file_id", String(48), ForeignKey("files.id"), nullable=True),
    Column("catalog_processing_status", String(60), nullable=False, default="not_requested"),
    Column("suggested_payload_json", JSON, nullable=True),
    Column("error_message", Text, nullable=True),
    Column("catalog_error_message", Text, nullable=True),
    Column("ml_result_json", JSON, nullable=True),
    Column("started_at", DateTime(timezone=True), nullable=True),
    Column("finished_at", DateTime(timezone=True), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("expires_at", DateTime(timezone=True), nullable=True),
)

outfit_calendar_entries = Table(
    "outfit_calendar_entries",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("user_id", String(48), ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("date", Date, nullable=False),
    Column("outfit_id", String(48), ForeignKey("outfits.id", ondelete="CASCADE"), nullable=True),
    Column("status", String(24), nullable=False, default="planned"),
    Column("weather_snapshot_json", JSON, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint("user_id", "date", name="uq_outfit_calendar_entries_user_date"),
    CheckConstraint(
        "status IN ('planned', 'worn', 'skipped')",
        name="ck_outfit_calendar_entries_status",
    ),
)

Index("ix_outfit_calendar_entries_user_date", outfit_calendar_entries.c.user_id, outfit_calendar_entries.c.date)

outfit_wear_logs = Table(
    "outfit_wear_logs",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("user_id", String(48), ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("outfit_id", String(48), ForeignKey("outfits.id", ondelete="CASCADE"), nullable=False),
    Column("worn_date", Date, nullable=False),
    Column("calendar_entry_id", String(48), ForeignKey("outfit_calendar_entries.id", ondelete="SET NULL"), nullable=True),
    Column("source", String(32), nullable=False),
    Column("weather_snapshot_json", JSON, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint(
        "source IN ('calendar_confirmation', 'manual_outfit', 'weekly_checkin')",
        name="ck_outfit_wear_logs_source",
    ),
)

Index("ix_outfit_wear_logs_user_worn_date", outfit_wear_logs.c.user_id, outfit_wear_logs.c.worn_date)

item_wear_logs = Table(
    "item_wear_logs",
    metadata,
    Column("id", String(48), primary_key=True),
    Column("user_id", String(48), ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("item_id", String(48), ForeignKey("wardrobe_items.id", ondelete="CASCADE"), nullable=False),
    Column("outfit_id", String(48), ForeignKey("outfits.id", ondelete="SET NULL"), nullable=True),
    Column("calendar_entry_id", String(48), ForeignKey("outfit_calendar_entries.id", ondelete="SET NULL"), nullable=True),
    Column("worn_date", Date, nullable=False),
    Column("source", String(32), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint(
        "source IN ('calendar_confirmation', 'manual_outfit', 'weekly_checkin')",
        name="ck_item_wear_logs_source",
    ),
)

Index("ix_item_wear_logs_user_worn_date", item_wear_logs.c.user_id, item_wear_logs.c.worn_date)

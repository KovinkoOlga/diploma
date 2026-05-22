import pytest
from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.metadata import (
    categories,
    colors,
    item_colors,
    item_seasons,
    item_statuses,
    item_styles,
    metadata,
    seasons,
    styles,
    subcategories,
    users,
    wardrobe_catalogs,
    wardrobe_item_templates,
)
from app.modules.wardrobe.colors import SYSTEM_COLOR_CATALOG
from app.modules.wardrobe.schemas import ItemPayload
from app.modules.wardrobe.service import (
    create_draft,
    create_item,
    delete_brand,
    delete_style,
    delete_subcategory,
    get_bootstrap,
    get_dictionaries,
    list_items,
    rename_style,
)


@pytest.fixture()
async def connection():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(metadata.create_all)
        await conn.execute(insert(users).values(id="user_1", email="user@example.com", password_hash="hash", display_name="User"))
        await conn.execute(
            insert(wardrobe_catalogs).values(id="catalog_main", user_id="user_1", name="Основное", sort_order=10, is_default=True)
        )
        await conn.execute(insert(categories).values(id="tops", name="Верх", icon_key="tops", sort_order=10))
        await conn.execute(
            insert(subcategories).values(
                id="subcategory_top",
                category_id="tops",
                user_id=None,
                name="Топ",
                normalized_name="топ",
                is_system=True,
            )
        )
        await conn.execute(insert(item_statuses).values(id="status_active", code="active", name="Активна", sort_order=10))
        await conn.execute(
            insert(seasons),
            [
                {"id": "season_summer", "name": "лето", "sort_order": 10},
                {"id": "season_winter", "name": "зима", "sort_order": 20},
                {"id": "season_transitional", "name": "осень/весна", "sort_order": 30},
            ],
        )
        await conn.execute(
            insert(styles),
            [
                {"id": "style_casual", "user_id": None, "name": "casual", "normalized_name": "casual", "is_system": True},
                {"id": "style_office", "user_id": None, "name": "office", "normalized_name": "office", "is_system": True},
            ],
        )
        await conn.execute(insert(colors), SYSTEM_COLOR_CATALOG)
        await conn.execute(
            insert(wardrobe_item_templates).values(
                id="template_1",
                name="Белый топ",
                category_id="tops",
                subcategory_name="Топ",
                brand="",
                color_ids_json=["white_pure"],
                seasons_json=["лето", "осень/весна"],
                styles_json=["office"],
                sort_order=10,
            )
        )
        yield conn
    await engine.dispose()


@pytest.mark.asyncio
async def test_bootstrap_returns_color_options(connection):
    bootstrap = await get_bootstrap(connection, "user_1")

    assert not hasattr(bootstrap, "colors")
    assert bootstrap.colorOptions
    white_group = next(option for option in bootstrap.colorOptions if option.id == "white")
    white_leaf = next(option for option in bootstrap.colorOptions if option.id == "white_pure")

    assert white_group.name == "Белый"
    assert white_leaf.name == "белый"
    assert white_leaf.parentName == "Белый"
    assert white_leaf.kind == "solid"
    assert white_leaf.hex.startswith("#")
    assert isinstance(white_leaf.sortOrder, int)


@pytest.mark.asyncio
async def test_bootstrap_returns_only_current_seasons_and_no_sizes(connection):
    bootstrap = await get_bootstrap(connection, "user_1")
    payload = bootstrap.model_dump()

    assert bootstrap.seasons == ["лето", "зима", "осень/весна"]
    assert "sizes" not in payload


@pytest.mark.asyncio
async def test_create_item_persists_color_positions(connection):
    item = await create_item(
        connection,
        "user_1",
        ItemPayload(
            title="Тестовая вещь",
            catalogId="catalog_main",
            categoryId="tops",
            subcategory="Топ",
            colorIds=["gold", "black_pure"],
            seasons=["лето"],
            styles=["casual"],
        ),
    )

    rows = (
        await connection.execute(
            select(item_colors.c.color_id, item_colors.c.position, item_colors.c.source)
            .where(item_colors.c.item_id == item.id)
            .order_by(item_colors.c.position)
        )
    ).all()

    assert item.colorIds == ["gold", "black_pure"]
    assert [row.color_id for row in rows] == ["gold", "black_pure"]
    assert [row.position for row in rows] == [0, 1]
    assert [row.source for row in rows] == ["manual", "manual"]


@pytest.mark.asyncio
async def test_item_response_does_not_expose_size_or_material(connection):
    item = await create_item(
        connection,
        "user_1",
        ItemPayload(
            title="Белый топ",
            catalogId="catalog_main",
            categoryId="tops",
            subcategory="Топ",
            colorIds=["white_pure"],
            seasons=["лето"],
            styles=["casual"],
        ),
    )
    payload = item.model_dump()

    assert "size" not in payload
    assert "material" not in payload


@pytest.mark.asyncio
async def test_create_item_creates_and_reuses_user_style(connection):
    first_item = await create_item(
        connection,
        "user_1",
        ItemPayload(
            title="Черный топ",
            catalogId="catalog_main",
            categoryId="tops",
            subcategory="Топ",
            colorIds=["black_pure"],
            seasons=["лето"],
            styles=["  Smart Casual  ", "smart casual", "", "casual"],
        ),
    )
    second_item = await create_item(
        connection,
        "user_1",
        ItemPayload(
            title="Белый топ",
            catalogId="catalog_main",
            categoryId="tops",
            subcategory="Топ",
            colorIds=["white_pure"],
            seasons=["зима"],
            styles=["smart casual"],
        ),
    )

    saved_styles = (
        await connection.execute(
            select(styles.c.id, styles.c.name, styles.c.normalized_name, styles.c.user_id, styles.c.is_system)
            .where(styles.c.normalized_name == "smart casual")
        )
    ).mappings().all()
    style_links = (
        await connection.execute(
            select(item_styles.c.item_id, item_styles.c.style_id).order_by(item_styles.c.item_id, item_styles.c.style_id)
        )
    ).mappings().all()
    bootstrap = await get_bootstrap(connection, "user_1")

    assert len(saved_styles) == 1
    assert saved_styles[0]["name"] == "Smart Casual"
    assert saved_styles[0]["user_id"] == "user_1"
    assert not saved_styles[0]["is_system"]
    assert any(link["item_id"] == first_item.id and link["style_id"] == saved_styles[0]["id"] for link in style_links)
    assert any(link["item_id"] == second_item.id and link["style_id"] == saved_styles[0]["id"] for link in style_links)
    assert "Smart Casual" in bootstrap.styles


@pytest.mark.asyncio
async def test_create_draft_defaults_to_all_seasons_and_empty_styles(connection):
    draft = await create_draft(connection, "user_1", "catalog", "catalog_main", template_id="template_1")

    assert draft.draft is not None
    assert draft.draft["seasons"] == ["лето", "зима", "осень/весна"]
    assert draft.draft["styles"] == []
    assert draft.draft["title"] == ""


@pytest.mark.asyncio
async def test_get_dictionaries_returns_user_entries_with_item_counts(connection):
    await create_item(
        connection,
        "user_1",
        ItemPayload(
            title="Образцовая вещь",
            catalogId="catalog_main",
            categoryId="tops",
            subcategory="Мой топ",
            colorIds=["white_pure"],
            brand="Uniqlo",
            styles=["Smart Casual"],
        ),
    )

    dictionaries = await get_dictionaries(connection, "user_1")

    assert any(
        entry.name == "Мой топ" and entry.categoryId == "tops" and entry.itemCount == 1
        for entry in dictionaries.subcategories
    )
    assert any(entry.name == "Smart Casual" and entry.itemCount == 1 and not entry.isSystem for entry in dictionaries.styles)
    assert any(entry.name == "Uniqlo" and entry.itemCount == 1 for entry in dictionaries.brands)


@pytest.mark.asyncio
async def test_dictionary_delete_conflicts_and_style_rename_checks_uniqueness(connection):
    await create_item(
        connection,
        "user_1",
        ItemPayload(
            title="Тестовая вещь",
            catalogId="catalog_main",
            categoryId="tops",
            subcategory="Моя блузка",
            colorIds=["black_pure"],
            brand="COS",
            styles=["Smart Casual"],
        ),
    )

    dictionaries = await get_dictionaries(connection, "user_1")
    subcategory_entry = next(entry for entry in dictionaries.subcategories if entry.name == "Моя блузка")
    style_entry = next(entry for entry in dictionaries.styles if entry.name == "Smart Casual")
    brand_entry = next(entry for entry in dictionaries.brands if entry.name == "COS")

    with pytest.raises(ValueError, match="Подкатегория используется в вещах"):
        await delete_subcategory(connection, "user_1", subcategory_entry.id)

    with pytest.raises(ValueError, match="Стиль используется в вещах"):
        await delete_style(connection, "user_1", style_entry.id)

    with pytest.raises(ValueError, match="Бренд используется в вещах"):
        await delete_brand(connection, "user_1", brand_entry.id)

    with pytest.raises(ValueError, match="Стиль уже существует"):
        await rename_style(connection, "user_1", style_entry.id, " casual ")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("color_ids", "should_raise"),
    [
        (["multicolor", "black_pure"], True),
        (["transparent", "gold"], True),
        (["black_pure", "white_pure", "blue_neutral"], True),
        (["blue", "blue_denim"], True),
        (["gold", "silver"], False),
        (["gold", "black_pure"], False),
    ],
)
async def test_color_selection_rules(connection, color_ids, should_raise):
    payload = ItemPayload(
        title="Проверка цвета",
        catalogId="catalog_main",
        categoryId="tops",
        subcategory="Топ",
        colorIds=color_ids,
    )

    if should_raise:
        with pytest.raises(ValueError):
            await create_item(connection, "user_1", payload)
        return

    saved = await create_item(connection, "user_1", payload)
    assert saved.colorIds == color_ids


@pytest.mark.asyncio
async def test_list_items_color_filter_matches_shade_and_parent(connection):
    await create_item(
        connection,
        "user_1",
        ItemPayload(title="Джинсовая куртка", catalogId="catalog_main", categoryId="tops", subcategory="Топ", colorIds=["blue_denim"]),
    )
    await create_item(
        connection,
        "user_1",
        ItemPayload(title="Темно-синяя рубашка", catalogId="catalog_main", categoryId="tops", subcategory="Топ", colorIds=["blue_dark"]),
    )

    parent_filtered = await list_items(connection, "user_1", {"color": ["blue"], "includeArchived": True})
    shade_filtered = await list_items(connection, "user_1", {"color": ["blue_denim"], "includeArchived": True})

    assert {item.title for item in parent_filtered} == {"Джинсовая куртка", "Темно-синяя рубашка"}
    assert [item.title for item in shade_filtered] == ["Джинсовая куртка"]


@pytest.mark.asyncio
async def test_create_item_persists_deduplicated_seasons(connection):
    item = await create_item(
        connection,
        "user_1",
        ItemPayload(
            title="Синий топ",
            catalogId="catalog_main",
            categoryId="tops",
            subcategory="Топ",
            colorIds=["blue_dark"],
            seasons=["лето", "лето", "осень/весна"],
        ),
    )

    links = (
        await connection.execute(select(item_seasons.c.season_id).where(item_seasons.c.item_id == item.id))
    ).scalars().all()

    assert len(links) == 2

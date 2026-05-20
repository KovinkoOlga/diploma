import pytest
from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.metadata import (
    categories,
    colors,
    item_colors,
    item_statuses,
    metadata,
    seasons,
    styles,
    subcategories,
    users,
    wardrobe_catalogs,
)
from app.modules.wardrobe.colors import SYSTEM_COLOR_CATALOG
from app.modules.wardrobe.schemas import ItemPayload
from app.modules.wardrobe.service import create_item, get_bootstrap, list_items


@pytest.fixture()
async def connection():
  engine = create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as conn:
    await conn.run_sync(metadata.create_all)
    await conn.execute(insert(users).values(id="user_1", email="user@example.com", password_hash="hash", display_name="User"))
    await conn.execute(insert(wardrobe_catalogs).values(id="catalog_main", user_id="user_1", name="Основное", sort_order=10, is_default=True))
    await conn.execute(insert(categories).values(id="tops", name="Верх", icon_key="tops", sort_order=10))
    await conn.execute(
      insert(subcategories).values(
        id="subcategory_shirts",
        category_id="tops",
        user_id=None,
        name="Рубашки",
        normalized_name="рубашки",
        is_system=True,
      )
    )
    await conn.execute(insert(item_statuses).values(id="status_active", code="active", name="Активна", sort_order=10))
    await conn.execute(insert(seasons).values(id="season_spring", name="весна", sort_order=10))
    await conn.execute(insert(styles).values(id="style_casual", user_id=None, name="casual", normalized_name="casual", is_system=True))
    await conn.execute(insert(colors), SYSTEM_COLOR_CATALOG)
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
async def test_create_item_persists_color_positions(connection):
  item = await create_item(
    connection,
    "user_1",
    ItemPayload(
      title="Тестовая вещь",
      catalogId="catalog_main",
      categoryId="tops",
      subcategory="Рубашки",
      colorIds=["gold", "black_pure"],
      seasons=["весна"],
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
    subcategory="Рубашки",
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
    ItemPayload(title="Джинсовая куртка", catalogId="catalog_main", categoryId="tops", subcategory="Рубашки", colorIds=["blue_denim"]),
  )
  await create_item(
    connection,
    "user_1",
    ItemPayload(title="Темно-синяя рубашка", catalogId="catalog_main", categoryId="tops", subcategory="Рубашки", colorIds=["blue_dark"]),
  )

  parent_filtered = await list_items(connection, "user_1", {"color": ["blue"], "includeArchived": True})
  shade_filtered = await list_items(connection, "user_1", {"color": ["blue_denim"], "includeArchived": True})

  assert {item.title for item in parent_filtered} == {"Джинсовая куртка", "Темно-синяя рубашка"}
  assert [item.title for item in shade_filtered] == ["Джинсовая куртка"]

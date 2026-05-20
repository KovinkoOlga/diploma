import pytest

from app.providers.router import resolve_route


@pytest.mark.parametrize(
    ("raw_category", "normalized", "provider", "model_key", "prompt_type"),
    [
        ("Верх", "tops", "tryoffdiff", "upper", None),
        ("tops", "tops", "tryoffdiff", "upper", None),
        ("Низ", "bottoms", "tryoffdiff", "lower", None),
        ("bottoms", "bottoms", "tryoffdiff", "lower", None),
        ("Слитное", "onepiece", "tryoffdiff", "dress", None),
        ("dresses", "onepiece", "tryoffdiff", "dress", None),
        ("onepiece", "onepiece", "tryoffdiff", "dress", None),
        ("Верхняя одежда", "outerwear", "tryoffdiff", "upper", None),
        ("outerwear", "outerwear", "tryoffdiff", "upper", None),
        ("Обувь", "shoes", "ip_adapter", "product", "shoes"),
        ("shoes", "shoes", "ip_adapter", "product", "shoes"),
        ("Сумки и аксессуары", "bags_accessories", "ip_adapter", "product", "bag_accessory"),
        ("accessories", "bags_accessories", "ip_adapter", "product", "bag_accessory"),
        ("bags", "bags_accessories", "ip_adapter", "product", "bag_accessory"),
        ("bags_accessories", "bags_accessories", "ip_adapter", "product", "bag_accessory"),
    ],
)
def test_resolve_route(raw_category: str, normalized: str, provider: str, model_key: str, prompt_type: str | None) -> None:
    route = resolve_route(raw_category)

    assert route.normalized_category == normalized
    assert route.provider == provider
    assert route.model_key == model_key
    assert route.prompt_type == prompt_type


def test_resolve_route_raises_for_unknown_category() -> None:
    with pytest.raises(ValueError, match="Unsupported category"):
        resolve_route("unknown")

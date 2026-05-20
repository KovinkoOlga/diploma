from __future__ import annotations

from app.providers.base import RouteDecision

_CATEGORY_ALIASES: dict[str, str] = {
    "верх": "tops",
    "tops": "tops",
    "низ": "bottoms",
    "bottoms": "bottoms",
    "слитное": "onepiece",
    "onepiece": "onepiece",
    "dresses": "onepiece",
    "верхняя одежда": "outerwear",
    "outerwear": "outerwear",
    "обувь": "shoes",
    "shoes": "shoes",
    "сумки и аксессуары": "bags_accessories",
    "bags_accessories": "bags_accessories",
    "accessories": "bags_accessories",
    "bags": "bags_accessories",
}


_ROUTE_MAP: dict[str, RouteDecision] = {
    "tops": RouteDecision("tops", "tryoffdiff", "upper", None),
    "bottoms": RouteDecision("bottoms", "tryoffdiff", "lower", None),
    "onepiece": RouteDecision("onepiece", "tryoffdiff", "dress", None),
    "outerwear": RouteDecision("outerwear", "tryoffdiff", "upper", None),
    "shoes": RouteDecision("shoes", "ip_adapter", "product", "shoes"),
    "bags_accessories": RouteDecision("bags_accessories", "ip_adapter", "product", "bag_accessory"),
}


class CategoryRoutingError(ValueError):
    pass


def normalize_category(raw_category: str | None) -> str:
    if not raw_category:
        raise CategoryRoutingError("Category is required")
    normalized = raw_category.strip().lower()
    resolved = _CATEGORY_ALIASES.get(normalized)
    if not resolved:
        raise CategoryRoutingError(f"Unsupported category: {raw_category}")
    return resolved


def resolve_route(category: str | None) -> RouteDecision:
    normalized = normalize_category(category)
    return _ROUTE_MAP[normalized]

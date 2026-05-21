from __future__ import annotations

import csv
import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any


CATEGORY_ID_MAP = {
    "верх": "tops",
    "верхняя одежда": "outerwear",
    "низ": "bottoms",
    "обувь": "shoes",
    "слитное": "one_piece",
    "сумки и аксессуары": "bags_accessories",
}

CATEGORY_TITLE_MAP = {
    "верх": "Верх",
    "верхняя одежда": "Верхняя одежда",
    "низ": "Низ",
    "обувь": "Обувь",
    "слитное": "Слитное",
    "сумки и аксессуары": "Сумки и аксессуары",
}

CYRILLIC_TRANSLITERATION = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "e",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "i",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "kh",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "shch",
    "ъ": "",
    "ы": "y",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
}


class ClassifierConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class CategoryDescriptor:
    raw_label: str
    category_id: str
    title: str


@dataclass(frozen=True)
class SubcategoryDescriptor:
    raw_label: str
    raw_category_label: str
    category_id: str
    category_title: str
    subcategory_id: str
    display_name: str


@dataclass(frozen=True)
class TaxonomySuggestion:
    rank: int
    confidence: float
    raw_category: str
    raw_subcategory: str
    category_id: str
    category_title: str
    subcategory_id: str
    display_name: str


def normalize_nfc(value: str) -> str:
    return unicodedata.normalize("NFC", str(value or "")).strip()


def normalize_lookup_key(value: str) -> str:
    normalized = normalize_nfc(value)
    normalized = re.sub(r"\s*[_/\\-]+\s*", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.lower().strip()


def format_subcategory_display_name(value: str) -> str:
    normalized = normalize_nfc(value)
    normalized = re.sub(r"\s*_\s*", " / ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def slugify_subcategory(value: str) -> str:
    normalized = normalize_nfc(value).lower()
    normalized = re.sub(r"\s*[_/\\-]+\s*", "_", normalized)

    pieces: list[str] = []
    for char in normalized:
        if char in CYRILLIC_TRANSLITERATION:
            pieces.append(CYRILLIC_TRANSLITERATION[char])
        elif char.isascii() and char.isalnum():
            pieces.append(char)
        else:
            pieces.append("_")

    slug = re.sub(r"_+", "_", "".join(pieces)).strip("_")
    return f"subcategory_{slug}"


def extract_top_k(probabilities: list[float] | tuple[float, ...], top_k: int) -> list[tuple[int, float]]:
    indexed = [(index, float(value)) for index, value in enumerate(probabilities)]
    indexed.sort(key=lambda item: item[1], reverse=True)
    return indexed[: max(0, int(top_k))]


def _read_json_file(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _normalized_json_list(path: Path) -> list[str]:
    data = _read_json_file(path)
    if not isinstance(data, list):
        raise ClassifierConfigurationError(f"Expected JSON list in {path}")
    return [normalize_nfc(value) for value in data]


def _normalized_json_mapping(path: Path) -> dict[str, Any]:
    data = _read_json_file(path)
    if not isinstance(data, dict):
        raise ClassifierConfigurationError(f"Expected JSON object in {path}")
    return {normalize_nfc(key): value for key, value in data.items()}


def _read_taxonomy_rows(path: Path) -> list[tuple[str, str]]:
    with path.open(encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        rows = []
        for row in reader:
            category = normalize_nfc(row.get("target_category") or "")
            subcategory = normalize_nfc(row.get("target_subcategory") or "")
            if not category or not subcategory:
                raise ClassifierConfigurationError(f"Invalid taxonomy row in {path}: {row}")
            rows.append((category, subcategory))
    return rows


@dataclass
class ClassifierTaxonomy:
    categories_by_index: list[CategoryDescriptor]
    subcategories_by_index: list[SubcategoryDescriptor]
    warnings: list[str]

    @classmethod
    def from_artifacts(cls, artifacts_dir: str | Path) -> ClassifierTaxonomy:
        base_path = Path(artifacts_dir)
        taxonomy_path = base_path / "taxonomy.csv"
        if not base_path.exists():
            raise ClassifierConfigurationError(f"Classifier artifacts directory not found: {base_path}")
        if not taxonomy_path.exists():
            raise ClassifierConfigurationError(f"Classifier taxonomy file not found: {taxonomy_path}")

        category_names = _normalized_json_list(base_path / "category_names.json")
        subcategory_names = _normalized_json_list(base_path / "subcategory_names.json")
        category_to_id = _normalized_json_mapping(base_path / "category_to_id.json")
        subcategory_to_id = _normalized_json_mapping(base_path / "subcategory_to_id.json")
        subcategory_to_category = _normalized_json_mapping(base_path / "subcategory_to_category.json")
        taxonomy_rows = _read_taxonomy_rows(taxonomy_path)

        warnings: list[str] = []
        taxonomy_subcategory_to_category: dict[str, str] = {}
        for category, subcategory in taxonomy_rows:
            existing = taxonomy_subcategory_to_category.get(subcategory)
            if existing and existing != category:
                raise ClassifierConfigurationError(
                    f"Subcategory {subcategory!r} has conflicting taxonomy categories: {existing!r} vs {category!r}"
                )
            taxonomy_subcategory_to_category[subcategory] = category

        categories_by_index: list[CategoryDescriptor] = []
        for index, raw_category in enumerate(category_names):
            if CATEGORY_ID_MAP.get(raw_category) is None or CATEGORY_TITLE_MAP.get(raw_category) is None:
                raise ClassifierConfigurationError(f"Unsupported classifier category label: {raw_category}")
            file_index = category_to_id.get(raw_category)
            if file_index != index:
                raise ClassifierConfigurationError(
                    f"Category index mismatch for {raw_category!r}: expected {index}, got {file_index}"
                )
            categories_by_index.append(
                CategoryDescriptor(
                    raw_label=raw_category,
                    category_id=CATEGORY_ID_MAP[raw_category],
                    title=CATEGORY_TITLE_MAP[raw_category],
                )
            )

        subcategories_by_index: list[SubcategoryDescriptor] = []
        for index, raw_subcategory in enumerate(subcategory_names):
            file_index = subcategory_to_id.get(raw_subcategory)
            if file_index != index:
                raise ClassifierConfigurationError(
                    f"Subcategory index mismatch for {raw_subcategory!r}: expected {index}, got {file_index}"
                )

            raw_category = taxonomy_subcategory_to_category.get(raw_subcategory) or subcategory_to_category.get(raw_subcategory)
            if not raw_category:
                raise ClassifierConfigurationError(f"Missing category mapping for subcategory: {raw_subcategory}")

            mapping_category = subcategory_to_category.get(raw_subcategory)
            if mapping_category and mapping_category != raw_category:
                warnings.append(
                    f"taxonomy.csv overrides subcategory_to_category for {raw_subcategory!r}: {mapping_category!r} -> {raw_category!r}"
                )

            category_id = CATEGORY_ID_MAP.get(raw_category)
            category_title = CATEGORY_TITLE_MAP.get(raw_category)
            if category_id is None or category_title is None:
                raise ClassifierConfigurationError(f"Unsupported raw category label: {raw_category}")

            subcategories_by_index.append(
                SubcategoryDescriptor(
                    raw_label=raw_subcategory,
                    raw_category_label=raw_category,
                    category_id=category_id,
                    category_title=category_title,
                    subcategory_id=slugify_subcategory(raw_subcategory),
                    display_name=format_subcategory_display_name(raw_subcategory),
                )
            )

        if len(subcategories_by_index) != len(taxonomy_rows):
            warnings.append(
                f"taxonomy row count ({len(taxonomy_rows)}) differs from subcategory count ({len(subcategories_by_index)})"
            )

        return cls(
            categories_by_index=categories_by_index,
            subcategories_by_index=subcategories_by_index,
            warnings=warnings,
        )

    def build_suggestion(self, *, subcategory_index: int, confidence: float, rank: int) -> TaxonomySuggestion:
        descriptor = self.subcategories_by_index[subcategory_index]
        return TaxonomySuggestion(
            rank=rank,
            confidence=float(confidence),
            raw_category=descriptor.raw_category_label,
            raw_subcategory=descriptor.raw_label,
            category_id=descriptor.category_id,
            category_title=descriptor.category_title,
            subcategory_id=descriptor.subcategory_id,
            display_name=descriptor.display_name,
        )

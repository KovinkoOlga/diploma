from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from math import sqrt
from typing import Any

import cv2
import numpy as np
from PIL import Image

from app.core.config import get_settings
from app.schemas.analysis import ColorPredictionItem, ColorPredictionResponse
from app.utils.image_io import load_rgb_image


NEUTRAL_FAMILIES = {"white", "black", "gray"}
SPECIAL_PALETTE_KINDS = {"transparent", "multicolor", "metallic"}


@dataclass(frozen=True)
class ColorFeatures:
    rgb: tuple[float, float, float]
    lightness: float
    a: float
    b: float
    chroma: float
    hue: float | None
    saturation: float
    value: float

    @property
    def lab(self) -> tuple[float, float, float]:
        return (self.lightness, self.a, self.b)


@dataclass(frozen=True)
class PaletteReference:
    entry: dict[str, Any]
    family: str
    features: ColorFeatures


def hex_to_rgb(hex_value: str) -> tuple[int, int, int]:
    value = str(hex_value or "").strip().lstrip("#")
    if len(value) != 6:
        raise ValueError(f"Invalid HEX color: {hex_value}")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def load_mask(mask_image_bytes: bytes) -> np.ndarray:
    return np.array(Image.open(BytesIO(mask_image_bytes)).convert("L"))


def rgb_pixels_to_lab(rgb_pixels: np.ndarray) -> np.ndarray:
    if rgb_pixels.size == 0:
        return np.empty((0, 3), dtype=np.float32)
    lab = cv2.cvtColor(rgb_pixels.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    lab[:, 0] = lab[:, 0] * (100.0 / 255.0)
    lab[:, 1] -= 128.0
    lab[:, 2] -= 128.0
    return lab


def rgb_to_features(rgb: np.ndarray | tuple[float, float, float]) -> ColorFeatures:
    rgb_array = np.clip(np.round(np.asarray(rgb, dtype=np.float32)), 0, 255).astype(np.uint8).reshape(1, 1, 3)
    lab = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2LAB).reshape(3).astype(np.float32)
    hsv = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2HSV).reshape(3).astype(np.float32)
    lightness = float(lab[0] * (100.0 / 255.0))
    a = float(lab[1] - 128.0)
    b = float(lab[2] - 128.0)
    saturation = float(hsv[1] / 255.0)
    value = float(hsv[2] / 255.0)
    hue = float(hsv[0] * 2.0) if saturation > 0.02 else None
    chroma = float(sqrt(a * a + b * b))
    rgb_tuple = tuple(float(channel) for channel in rgb_array.reshape(3))
    return ColorFeatures(
        rgb=rgb_tuple,
        lightness=lightness,
        a=a,
        b=b,
        chroma=chroma,
        hue=hue,
        saturation=saturation,
        value=value,
    )


def circular_hue_distance(first: float | None, second: float | None) -> float:
    if first is None or second is None:
        return 180.0
    distance = abs(first - second) % 360.0
    return min(distance, 360.0 - distance)


def is_low_chroma(features: ColorFeatures) -> bool:
    settings = get_settings()
    return (
        features.saturation <= settings.color_neutral_saturation_max
        and features.chroma <= settings.color_neutral_chroma_max
    )


def is_soft_chromatic(features: ColorFeatures) -> bool:
    settings = get_settings()
    return (
        features.hue is not None
        and (
            features.saturation >= settings.color_soft_chromatic_saturation_min
            or features.chroma >= settings.color_soft_chromatic_chroma_min
        )
    )


def remove_small_components(mask: np.ndarray) -> np.ndarray:
    settings = get_settings()
    if not np.any(mask):
        return mask
    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    filtered = np.zeros_like(mask, dtype=np.uint8)
    for component_index in range(1, component_count):
        area = int(stats[component_index, cv2.CC_STAT_AREA])
        if area >= settings.color_min_mask_component_pixels:
            filtered[labels == component_index] = 1
    return filtered


def erode_mask(mask: np.ndarray) -> np.ndarray:
    settings = get_settings()
    kernel_size = max(1, int(settings.color_mask_erode_kernel))
    if kernel_size <= 1 or not np.any(mask):
        return mask
    kernel = np.ones((kernel_size, kernel_size), dtype=np.uint8)
    return cv2.erode(mask.astype(np.uint8), kernel, iterations=1)


def build_core_mask(mask: np.ndarray) -> tuple[np.ndarray, dict[str, Any]]:
    settings = get_settings()
    reliable = (mask >= settings.color_reliable_alpha_threshold).astype(np.uint8)
    reliable = remove_small_components(reliable)
    if not np.any(reliable):
        return reliable.astype(bool), {
            "reliable_alpha_threshold": settings.color_reliable_alpha_threshold,
            "core_alpha_threshold": settings.color_core_alpha_threshold,
            "erode_kernel": settings.color_mask_erode_kernel,
            "core_distance_px": settings.color_mask_core_distance_px,
            "reliable_pixels": 0,
            "core_pixels": 0,
            "selected_stage": "empty",
        }

    distance = cv2.distanceTransform(reliable, cv2.DIST_L2, 5)
    alpha_core = reliable.copy()
    if settings.color_core_alpha_threshold > settings.color_reliable_alpha_threshold:
        alpha_core = alpha_core & (mask >= settings.color_core_alpha_threshold).astype(np.uint8)
    eroded = erode_mask(alpha_core)
    distance_core = reliable & (distance >= float(settings.color_mask_core_distance_px)).astype(np.uint8)
    candidates = [
        ("eroded+distance", eroded & distance_core),
        ("eroded", eroded),
        ("distance", distance_core),
        ("alpha-core", alpha_core),
        ("reliable", reliable),
    ]

    selected_name = "reliable"
    selected_mask = reliable
    reliable_pixels = int(np.count_nonzero(reliable))
    minimum_pixels = max(64, min(512, reliable_pixels // 6 if reliable_pixels else 64))
    for candidate_name, candidate_mask in candidates:
        candidate_pixels = int(np.count_nonzero(candidate_mask))
        if candidate_pixels >= minimum_pixels:
            selected_name = candidate_name
            selected_mask = candidate_mask
            break

    return selected_mask.astype(bool), {
        "reliable_alpha_threshold": settings.color_reliable_alpha_threshold,
        "core_alpha_threshold": settings.color_core_alpha_threshold,
        "erode_kernel": settings.color_mask_erode_kernel,
        "core_distance_px": settings.color_mask_core_distance_px,
        "reliable_pixels": reliable_pixels,
        "core_pixels": int(np.count_nonzero(selected_mask)),
        "selected_stage": selected_name,
    }


def sample_masked_pixels(image_rgb: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, int]:
    settings = get_settings()
    flat_pixels = image_rgb[mask]
    total_pixels = int(flat_pixels.shape[0])
    if total_pixels == 0:
        return np.empty((0, 3), dtype=np.uint8), 0
    if total_pixels <= settings.color_max_pixels:
        return flat_pixels.astype(np.uint8), total_pixels
    rng = np.random.default_rng(42)
    indices = rng.choice(total_pixels, size=settings.color_max_pixels, replace=False)
    return flat_pixels[indices].astype(np.uint8), total_pixels


def trim_lightness_outliers(sampled_pixels: np.ndarray) -> tuple[np.ndarray, dict[str, Any]]:
    settings = get_settings()
    if sampled_pixels.shape[0] < 64:
        return sampled_pixels, {"trimmed_pixels": int(sampled_pixels.shape[0]), "applied": False}

    lab_pixels = rgb_pixels_to_lab(sampled_pixels)
    lightness = lab_pixels[:, 0]
    percentile = float(settings.color_lightness_trim_percentile)
    lower_bound = float(np.percentile(lightness, percentile))
    upper_bound = float(np.percentile(lightness, 100.0 - percentile))
    keep_mask = (lightness >= lower_bound) & (lightness <= upper_bound)
    trimmed = sampled_pixels[keep_mask]
    minimum_pixels = max(64, sampled_pixels.shape[0] // 2)
    if trimmed.shape[0] < minimum_pixels:
        return sampled_pixels, {
            "applied": False,
            "lower_lightness": lower_bound,
            "upper_lightness": upper_bound,
            "trimmed_pixels": int(sampled_pixels.shape[0]),
        }
    return trimmed.astype(np.uint8), {
        "applied": True,
        "lower_lightness": lower_bound,
        "upper_lightness": upper_bound,
        "trimmed_pixels": int(trimmed.shape[0]),
    }


def run_kmeans(lab_pixels: np.ndarray) -> tuple[np.ndarray, np.ndarray] | None:
    settings = get_settings()
    if lab_pixels.size == 0:
        return None
    sample_count = int(lab_pixels.shape[0])
    cluster_count = max(1, min(settings.color_kmeans_k, 5, sample_count))
    weighted_lab = lab_pixels.astype(np.float32).copy()
    weighted_lab[:, 0] *= float(settings.color_kmeans_lightness_weight)
    _compactness, labels, centers = cv2.kmeans(
        weighted_lab,
        cluster_count,
        None,
        (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.15),
        4,
        cv2.KMEANS_PP_CENTERS,
    )
    return centers.astype(np.float32), labels.reshape(-1)


def palette_to_references(palette: list[dict[str, Any]]) -> dict[str, list[PaletteReference]]:
    references: dict[str, list[PaletteReference]] = {}
    for entry in palette:
        parent_color_id = entry.get("parent_color_id")
        if not parent_color_id or entry.get("kind") in SPECIAL_PALETTE_KINDS:
            continue
        try:
            rgb = np.array(hex_to_rgb(str(entry.get("hex") or "")), dtype=np.uint8)
        except ValueError:
            continue
        references.setdefault(str(parent_color_id), []).append(
            PaletteReference(
                entry=entry,
                family=str(parent_color_id),
                features=rgb_to_features(rgb),
            )
        )
    return references


def hue_range_penalty(hue: float | None, center: float, tolerance: float, *, missing_penalty: float = 18.0) -> float:
    if hue is None:
        return missing_penalty
    return max(0.0, circular_hue_distance(hue, center) - tolerance)


def family_penalty(features: ColorFeatures, family: str) -> tuple[float, list[str]]:
    settings = get_settings()
    penalties: list[tuple[float, str]] = []

    def add(condition: bool, score: float, reason: str) -> None:
        if condition and score > 0:
            penalties.append((score, reason))

    low_chroma = is_low_chroma(features)
    if family == "white":
        add(features.lightness < settings.color_white_lightness_min, (settings.color_white_lightness_min - features.lightness) * 1.8, "too_dark_for_white")
        add(features.saturation > settings.color_neutral_saturation_max * 1.35, (features.saturation - settings.color_neutral_saturation_max * 1.35) * 70.0, "too_saturated_for_white")
        add(features.chroma > settings.color_neutral_chroma_max * 1.35, (features.chroma - settings.color_neutral_chroma_max * 1.35) * 1.2, "too_colorful_for_white")
        add(is_soft_chromatic(features), settings.color_neutral_chromatic_penalty, "soft-chromatic-not-white")
    elif family == "black":
        add(features.lightness > settings.color_black_lightness_max, (features.lightness - settings.color_black_lightness_max) * 1.4, "too_light_for_black")
        add(features.saturation > settings.color_neutral_saturation_max * 1.5 and features.chroma > settings.color_neutral_chroma_max * 1.4, (features.chroma - settings.color_neutral_chroma_max * 1.4) * 0.7, "too_colorful_for_black")
        add(is_soft_chromatic(features), settings.color_neutral_chromatic_penalty * 0.8, "soft-chromatic-not-black")
    elif family == "gray":
        add(features.lightness < settings.color_black_lightness_max, (settings.color_black_lightness_max - features.lightness) * 1.2, "too_dark_for_gray")
        add(features.lightness > settings.color_white_lightness_min, (features.lightness - settings.color_white_lightness_min) * 1.2, "too_light_for_gray")
        add(not low_chroma, max(0.0, features.chroma - settings.color_neutral_chroma_max) * 1.0 + max(0.0, features.saturation - settings.color_neutral_saturation_max) * 65.0, "too_colorful_for_gray")
        add(is_soft_chromatic(features), settings.color_neutral_chromatic_penalty, "soft-chromatic-not-gray")
    elif family == "beige":
        add(features.lightness < settings.color_beige_lightness_min, (settings.color_beige_lightness_min - features.lightness) * 1.2, "too_dark_for_beige")
        add(features.saturation > 0.45, (features.saturation - 0.45) * 55.0, "too_saturated_for_beige")
        add(True, hue_range_penalty(features.hue, 38.0, 34.0, missing_penalty=10.0) * 0.9, "beige_hue_range")
    elif family == "brown":
        add(features.lightness > settings.color_brown_lightness_max + 12.0, (features.lightness - (settings.color_brown_lightness_max + 12.0)) * 1.1, "too_light_for_brown")
        add(True, hue_range_penalty(features.hue, 28.0, 26.0, missing_penalty=9.0) * 1.0, "brown_hue_range")
        add(features.value > 0.8 and features.lightness > settings.color_beige_lightness_min, (features.value - 0.8) * 25.0, "too_bright_for_brown")
    elif family == "pink":
        add(True, min(hue_range_penalty(features.hue, 340.0, 30.0), hue_range_penalty(features.hue, 355.0, 30.0)) * 0.9, "pink_hue_range")
        add(features.lightness < 42.0 and features.saturation < 0.22, (42.0 - features.lightness) * 0.5, "too_dark_muted_for_pink")
    elif family == "red":
        add(True, hue_range_penalty(features.hue, 5.0, 18.0) * 1.1, "red_hue_range")
    elif family == "purple":
        add(True, hue_range_penalty(features.hue, 285.0, 36.0) * 0.9, "purple_hue_range")
    elif family == "blue":
        add(True, hue_range_penalty(features.hue, 218.0, 42.0) * 0.9, "blue_hue_range")
    elif family == "green":
        add(True, hue_range_penalty(features.hue, 130.0, 52.0) * 0.75, "green_hue_range")
    elif family == "yellow":
        add(True, hue_range_penalty(features.hue, 60.0, 20.0) * 1.0, "yellow_hue_range")
    elif family == "orange":
        add(True, hue_range_penalty(features.hue, 28.0, 18.0) * 1.0, "orange_hue_range")

    return sum(score for score, _ in penalties), [reason for _score, reason in penalties]


def reference_score(features: ColorFeatures, reference: PaletteReference) -> float:
    lab_distance = float(np.linalg.norm(np.array(features.lab, dtype=np.float32) - np.array(reference.features.lab, dtype=np.float32)))
    hue_distance = 0.0
    if features.hue is not None and reference.features.hue is not None:
        hue_distance = circular_hue_distance(features.hue, reference.features.hue)
    elif features.hue is not None or reference.features.hue is not None:
        hue_distance = 16.0
    return (
        lab_distance
        + abs(features.lightness - reference.features.lightness) * 0.30
        + abs(features.saturation - reference.features.saturation) * 18.0
        + abs(features.chroma - reference.features.chroma) * 0.18
        + hue_distance * 0.10
    )


def match_family_and_shade(
    features: ColorFeatures,
    palette_references: dict[str, list[PaletteReference]],
    *,
    allowed_families: set[str] | None = None,
) -> dict[str, Any] | None:
    rankings: list[dict[str, Any]] = []
    for family, references in palette_references.items():
        if allowed_families is not None and family not in allowed_families:
            continue
        penalty, penalty_reasons = family_penalty(features, family)
        best_reference: PaletteReference | None = None
        best_reference_score = float("inf")
        for reference in references:
            current_score = reference_score(features, reference)
            if current_score < best_reference_score:
                best_reference_score = current_score
                best_reference = reference
        if best_reference is None:
            continue
        total_score = best_reference_score + penalty
        rankings.append(
            {
                "family": family,
                "entry": best_reference.entry,
                "reference_score": best_reference_score,
                "family_penalty": penalty,
                "total_score": total_score,
                "penalty_reasons": penalty_reasons,
            }
        )

    if not rankings:
        return None

    rankings.sort(key=lambda item: (item["total_score"], item["reference_score"], item["entry"].get("sort_order", 0)))
    best = rankings[0]
    settings = get_settings()
    if best["family"] in NEUTRAL_FAMILIES and is_soft_chromatic(features):
        chromatic_alternatives = [candidate for candidate in rankings if candidate["family"] not in NEUTRAL_FAMILIES]
        if chromatic_alternatives:
            best_chromatic = chromatic_alternatives[0]
            if float(best_chromatic["total_score"]) <= float(best["total_score"]) + settings.color_neutral_primary_override_margin:
                best = best_chromatic
    confidence = max(0.0, min(1.0, 1.0 - (best["total_score"] / settings.color_match_max_score)))
    entry = best["entry"]
    return {
        "id": entry["id"],
        "name": entry["name"],
        "parent_color_id": entry.get("parent_color_id"),
        "parent_name": entry.get("parent_name"),
        "hex": entry.get("hex"),
        "kind": entry.get("kind"),
        "sort_order": entry.get("sort_order", 0),
        "distance": float(best["total_score"]),
        "confidence": confidence,
        "family": best["family"],
        "family_score_rankings": rankings[:4],
        "family_penalty_reasons": best["penalty_reasons"],
    }


def aggregate_features(clusters: list[dict[str, Any]]) -> ColorFeatures:
    weights = np.array([float(cluster["coverage_percent"]) for cluster in clusters], dtype=np.float32)
    total = float(weights.sum()) or 1.0
    rgb_values = np.array([cluster["rgb"] for cluster in clusters], dtype=np.float32)
    weighted_rgb = (rgb_values * weights[:, None]).sum(axis=0) / total
    return rgb_to_features(weighted_rgb)


def mostly_lightness_difference(first: dict[str, Any], second: dict[str, Any]) -> bool:
    features_a: ColorFeatures = first["features"]
    features_b: ColorFeatures = second["features"]
    ab_distance = float(np.linalg.norm(np.array([features_a.a - features_b.a, features_a.b - features_b.b], dtype=np.float32)))
    lightness_delta = abs(features_a.lightness - features_b.lightness)
    hue_delta = circular_hue_distance(features_a.hue, features_b.hue) if features_a.hue is not None and features_b.hue is not None else 0.0
    chroma_delta = abs(features_a.chroma - features_b.chroma)
    if first["family"] in NEUTRAL_FAMILIES and second["family"] in NEUTRAL_FAMILIES:
        return ab_distance <= 8.0
    return ab_distance <= 10.0 and hue_delta <= 16.0 and chroma_delta <= 12.0 and lightness_delta >= 8.0


def merge_family_groups(groups: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    merged: list[dict[str, Any]] = []
    merge_events: list[dict[str, Any]] = []
    for group in sorted(groups, key=lambda item: -float(item["coverage_percent"])):
        absorbed = False
        for existing in merged:
            if group["family"] == existing["family"]:
                reason = "same-family"
            elif mostly_lightness_difference(existing, group):
                reason = "lightness-variant"
            else:
                continue
            existing["clusters"].extend(group["clusters"])
            existing["coverage_percent"] = float(existing["coverage_percent"]) + float(group["coverage_percent"])
            existing["features"] = aggregate_features(existing["clusters"])
            absorbed = True
            merge_events.append(
                {
                    "from_family": group["family"],
                    "to_family": existing["family"],
                    "coverage_percent": group["coverage_percent"],
                    "reason": reason,
                }
            )
            break
        if not absorbed:
            merged.append(group)
    return merged, merge_events


def rescore_group_for_family(group: dict[str, Any], palette_references: dict[str, list[PaletteReference]]) -> dict[str, Any] | None:
    rescored = match_family_and_shade(group["features"], palette_references, allowed_families={group["family"]})
    if rescored is None:
        return None
    return {
        **rescored,
        "family": group["family"],
        "coverage_percent": group["coverage_percent"],
        "features": group["features"],
        "clusters": sorted(group["clusters"], key=lambda cluster: -float(cluster["coverage_percent"])),
    }


def neutral_secondary_absorption_reason(
    primary: dict[str, Any],
    secondary: dict[str, Any],
    palette_references: dict[str, list[PaletteReference]],
) -> dict[str, Any] | None:
    settings = get_settings()
    if primary["family"] in NEUTRAL_FAMILIES or secondary["family"] not in NEUTRAL_FAMILIES:
        return None

    primary_features: ColorFeatures = primary["features"]
    secondary_features: ColorFeatures = secondary["features"]
    lightness_delta = float(secondary_features.lightness - primary_features.lightness)
    chroma_delta = float(abs(secondary_features.chroma - primary_features.chroma))
    ab_distance = float(
        np.linalg.norm(
            np.array(
                [secondary_features.a - primary_features.a, secondary_features.b - primary_features.b],
                dtype=np.float32,
            )
        )
    )
    primary_family_match = match_family_and_shade(
        secondary_features,
        palette_references,
        allowed_families={primary["family"]},
    )
    if primary_family_match is None:
        return None

    score_gap = float(primary_family_match["distance"]) - float(secondary["distance"])
    secondary_coverage = float(secondary["coverage_percent"])
    neutral_like = is_low_chroma(secondary_features)
    if not neutral_like:
        return None

    if secondary["family"] == "white":
        illumination_like = lightness_delta >= 4.0 and secondary_features.chroma <= primary_features.chroma + 4.0
    elif secondary["family"] == "black":
        illumination_like = lightness_delta <= -4.0 and secondary_features.chroma <= primary_features.chroma + 4.0
    else:
        illumination_like = abs(lightness_delta) >= 5.0 and secondary_features.chroma <= primary_features.chroma + 4.0

    if not illumination_like:
        return None

    if secondary_coverage < settings.color_neutral_second_color_min_percent:
        if score_gap <= settings.color_neutral_secondary_score_margin or ab_distance <= settings.color_neutral_secondary_max_ab_distance:
            return {
                "reason": "neutral-secondary-low-coverage",
                "score_gap": score_gap,
                "ab_distance": ab_distance,
                "secondary_coverage": secondary_coverage,
            }

    if score_gap <= settings.color_neutral_secondary_strict_score_margin and ab_distance <= settings.color_neutral_secondary_max_ab_distance:
        return {
            "reason": "neutral-secondary-ambiguous-family",
            "score_gap": score_gap,
            "ab_distance": ab_distance,
            "secondary_coverage": secondary_coverage,
            "primary_family_color_id": primary_family_match["id"],
        }

    return None


def absorb_neutral_secondary_groups(
    groups: list[dict[str, Any]],
    palette_references: dict[str, list[PaletteReference]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not groups:
        return groups, []

    absorptions: list[dict[str, Any]] = []
    working = sorted(groups, key=lambda item: -float(item["coverage_percent"]))
    changed = True
    while changed and working:
        changed = False
        primary = working[0]
        kept = [primary]
        for group in working[1:]:
            absorption = neutral_secondary_absorption_reason(primary, group, palette_references)
            if absorption is None:
                kept.append(group)
                continue
            primary["clusters"].extend(group["clusters"])
            primary["coverage_percent"] = float(primary["coverage_percent"]) + float(group["coverage_percent"])
            primary["features"] = aggregate_features(primary["clusters"])
            rescored_primary = rescore_group_for_family(primary, palette_references)
            if rescored_primary is not None:
                primary.update(rescored_primary)
            absorptions.append(
                {
                    "absorbed_family": group["family"],
                    "absorbed_color_id": group["id"],
                    "into_family": primary["family"],
                    "into_color_id": primary["id"],
                    **absorption,
                }
            )
            changed = True
        working = sorted(kept, key=lambda item: -float(item["coverage_percent"]))
    return working, absorptions


def absorb_primary_neutral_into_chromatic(
    groups: list[dict[str, Any]],
    palette_references: dict[str, list[PaletteReference]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    settings = get_settings()
    if len(groups) < 2:
        return groups, []

    working = sorted(groups, key=lambda item: (-float(item["coverage_percent"]), -float(item["confidence"])))
    primary = working[0]
    if primary["family"] not in NEUTRAL_FAMILIES:
        return working, []

    chromatic_candidates = [group for group in working[1:] if group["family"] not in NEUTRAL_FAMILIES]
    if not chromatic_candidates:
        return working, []

    anchor = chromatic_candidates[0]
    absorption = neutral_secondary_absorption_reason(anchor, primary, palette_references)
    if absorption is None:
        return working, []

    if float(anchor["distance"]) > float(primary["distance"]) + settings.color_neutral_primary_override_margin:
        return working, []

    anchor["clusters"].extend(primary["clusters"])
    anchor["coverage_percent"] = float(anchor["coverage_percent"]) + float(primary["coverage_percent"])
    anchor["features"] = aggregate_features(anchor["clusters"])
    rescored_anchor = rescore_group_for_family(anchor, palette_references)
    if rescored_anchor is not None:
        anchor.update(rescored_anchor)

    remaining = [group for group in working[1:] if group is not anchor]
    result = sorted([anchor, *remaining], key=lambda item: (-float(item["coverage_percent"]), -float(item["confidence"])))
    return result, [
        {
            "absorbed_family": primary["family"],
            "absorbed_color_id": primary["id"],
            "into_family": anchor["family"],
            "into_color_id": anchor["id"],
            "reason": "primary-neutral-overridden",
            **absorption,
        }
    ]


def build_prediction(
    candidates: list[dict[str, Any]],
    *,
    strategy: str,
    confidence: float,
    is_multicolor: bool = False,
    debug: dict[str, Any] | None = None,
) -> ColorPredictionResponse:
    return ColorPredictionResponse(
        color_ids=[candidate["id"] for candidate in candidates],
        colors=[
            ColorPredictionItem(
                id=candidate["id"],
                name=candidate["name"],
                parent_color_id=candidate.get("parent_color_id"),
                parent_name=candidate.get("parent_name"),
                hex=candidate["hex"],
                kind=candidate["kind"],
                coverage_percent=float(candidate["coverage_percent"]),
                confidence=float(candidate["confidence"]),
                distance=float(candidate["distance"]) if candidate.get("distance") is not None else None,
            )
            for candidate in candidates
        ],
        strategy=strategy,
        is_multicolor=is_multicolor,
        confidence=float(max(0.0, min(1.0, confidence))),
        debug=debug,
    )


class ColorPredictionService:
    def predict(
        self,
        image_bytes: bytes,
        mask_image_bytes: bytes,
        palette: list[dict[str, Any]],
    ) -> ColorPredictionResponse | None:
        if not palette:
            return None

        settings = get_settings()
        palette_references = palette_to_references(palette)
        if not palette_references:
            return None

        image_rgb = np.array(load_rgb_image(image_bytes))
        mask = load_mask(mask_image_bytes)
        if mask.shape[:2] != image_rgb.shape[:2]:
            mask = cv2.resize(mask, (image_rgb.shape[1], image_rgb.shape[0]), interpolation=cv2.INTER_NEAREST)

        core_mask, mask_debug = build_core_mask(mask)
        sampled_pixels, total_mask_pixels = sample_masked_pixels(image_rgb, core_mask)
        if total_mask_pixels == 0 or sampled_pixels.shape[0] < 32:
            return build_prediction([], strategy="empty-mask", confidence=0.0, debug={"mask": mask_debug} if settings.color_debug else None)

        filtered_pixels, trim_debug = trim_lightness_outliers(sampled_pixels)
        lab_pixels = rgb_pixels_to_lab(filtered_pixels)
        kmeans_result = run_kmeans(lab_pixels)
        if kmeans_result is None:
            return build_prediction([], strategy="empty-mask", confidence=0.0, debug={"mask": mask_debug, "lightness_trim": trim_debug} if settings.color_debug else None)

        centers, labels = kmeans_result
        coverage_by_cluster = np.bincount(labels, minlength=len(centers)).astype(np.float32) / float(len(labels))
        matched_clusters: list[dict[str, Any]] = []
        debug_clusters: list[dict[str, Any]] = []

        for cluster_index, center in enumerate(centers):
            coverage = float(coverage_by_cluster[cluster_index])
            cluster_pixels = filtered_pixels[labels == cluster_index]
            if cluster_pixels.shape[0] == 0:
                continue
            mean_rgb = cluster_pixels.mean(axis=0)
            features = rgb_to_features(mean_rgb)
            cluster_debug = {
                "cluster_index": cluster_index,
                "coverage_percent": coverage,
                "pixel_count": int(cluster_pixels.shape[0]),
                "rgb": [round(float(value), 2) for value in features.rgb],
                "lab": [round(features.lightness, 2), round(features.a, 2), round(features.b, 2)],
                "hsv": [
                    round(features.hue, 2) if features.hue is not None else None,
                    round(features.saturation, 4),
                    round(features.value, 4),
                ],
                "chroma": round(features.chroma, 2),
            }
            if coverage < settings.color_min_cluster_percent:
                cluster_debug["discarded_reason"] = "min_cluster_percent"
                debug_clusters.append(cluster_debug)
                continue

            matched = match_family_and_shade(features, palette_references)
            if matched is None:
                cluster_debug["discarded_reason"] = "no_family_match"
                debug_clusters.append(cluster_debug)
                continue

            matched_clusters.append(
                {
                    **matched,
                    "coverage_percent": coverage,
                    "features": features,
                    "cluster_indices": [cluster_index],
                    "rgb": [float(value) for value in features.rgb],
                }
            )
            cluster_debug.update(
                {
                    "family": matched["family"],
                    "matched_color_id": matched["id"],
                    "matched_color_name": matched["name"],
                    "distance": round(float(matched["distance"]), 3),
                    "confidence": round(float(matched["confidence"]), 4),
                    "family_penalty_reasons": matched["family_penalty_reasons"],
                    "family_rankings": [
                        {
                            "family": candidate["family"],
                            "color_id": candidate["entry"]["id"],
                            "score": round(float(candidate["total_score"]), 3),
                            "family_penalty": round(float(candidate["family_penalty"]), 3),
                        }
                        for candidate in matched["family_score_rankings"]
                    ],
                }
            )
            debug_clusters.append(cluster_debug)

        if not matched_clusters:
            debug_payload = None
            if settings.color_debug:
                debug_payload = {
                    "mask": mask_debug,
                    "lightness_trim": trim_debug,
                    "sampled_pixels": int(sampled_pixels.shape[0]),
                    "filtered_pixels": int(filtered_pixels.shape[0]),
                    "clusters": debug_clusters,
                }
            return build_prediction([], strategy="no-match", confidence=0.0, debug=debug_payload)

        grouped_by_family: dict[str, list[dict[str, Any]]] = {}
        for cluster in matched_clusters:
            grouped_by_family.setdefault(cluster["family"], []).append(cluster)

        family_groups: list[dict[str, Any]] = []
        for family, family_clusters in grouped_by_family.items():
            features = aggregate_features(family_clusters)
            family_match = match_family_and_shade(features, palette_references, allowed_families={family})
            if family_match is None:
                continue
            family_groups.append(
                {
                    **family_match,
                    "family": family,
                    "coverage_percent": float(sum(float(cluster["coverage_percent"]) for cluster in family_clusters)),
                    "features": features,
                    "clusters": sorted(family_clusters, key=lambda cluster: -float(cluster["coverage_percent"])),
                }
            )

        if not family_groups:
            debug_payload = None
            if settings.color_debug:
                debug_payload = {
                    "mask": mask_debug,
                    "lightness_trim": trim_debug,
                    "sampled_pixels": int(sampled_pixels.shape[0]),
                    "filtered_pixels": int(filtered_pixels.shape[0]),
                    "clusters": debug_clusters,
                }
            return build_prediction([], strategy="no-match", confidence=0.0, debug=debug_payload)

        merged_groups, merge_events = merge_family_groups(family_groups)
        rescored_groups: list[dict[str, Any]] = []
        for group in merged_groups:
            rescored = rescore_group_for_family(group, palette_references)
            if rescored is not None:
                rescored_groups.append(rescored)
        if not rescored_groups:
            debug_payload = None
            if settings.color_debug:
                debug_payload = {
                    "mask": mask_debug,
                    "lightness_trim": trim_debug,
                    "sampled_pixels": int(sampled_pixels.shape[0]),
                    "filtered_pixels": int(filtered_pixels.shape[0]),
                    "clusters": debug_clusters,
                    "merge_events": merge_events,
                }
            return build_prediction([], strategy="no-match", confidence=0.0, debug=debug_payload)
        rescored_groups, neutral_absorptions = absorb_neutral_secondary_groups(rescored_groups, palette_references)
        rescored_groups, primary_neutral_overrides = absorb_primary_neutral_into_chromatic(rescored_groups, palette_references)
        candidates = sorted(
            rescored_groups,
            key=lambda entry: (-float(entry["coverage_percent"]), -float(entry["confidence"]), entry.get("sort_order", 0)),
        )
        top_candidate = candidates[0]
        significant_groups = [entry for entry in candidates if float(entry["coverage_percent"]) >= settings.color_second_color_min_percent]
        significant_multicolor_groups = [
            entry for entry in candidates if float(entry["coverage_percent"]) >= settings.color_multicolor_min_percent
        ]

        debug_payload = None
        if settings.color_debug:
            debug_payload = {
                "mask": mask_debug,
                "lightness_trim": trim_debug,
                "total_mask_pixels": total_mask_pixels,
                "sampled_pixels": int(sampled_pixels.shape[0]),
                "filtered_pixels": int(filtered_pixels.shape[0]),
                "clusters": debug_clusters,
                "merge_events": merge_events,
                "neutral_absorptions": [*neutral_absorptions, *primary_neutral_overrides],
                "family_candidates": [
                    {
                        "family": entry["family"],
                        "color_id": entry["id"],
                        "coverage_percent": round(float(entry["coverage_percent"]), 4),
                        "confidence": round(float(entry["confidence"]), 4),
                        "distance": round(float(entry["distance"]), 3),
                        "rgb": [round(float(value), 2) for value in entry["features"].rgb],
                        "lab": [
                            round(float(entry["features"].lightness), 2),
                            round(float(entry["features"].a), 2),
                            round(float(entry["features"].b), 2),
                        ],
                        "hsv": [
                            round(float(entry["features"].hue), 2) if entry["features"].hue is not None else None,
                            round(float(entry["features"].saturation), 4),
                            round(float(entry["features"].value), 4),
                        ],
                        "cluster_indices": [index for cluster in entry["clusters"] for index in cluster["cluster_indices"]],
                    }
                    for entry in candidates
                ],
            }

        multicolor_entry = next((entry for entry in palette if entry.get("id") == "multicolor"), None)
        if (
            len(significant_multicolor_groups) >= settings.color_multicolor_min_families
            and multicolor_entry is not None
        ):
            multicolor_confidence = min(
                1.0,
                0.45
                + float(sum(float(entry["coverage_percent"]) for entry in significant_multicolor_groups[:3])) * 0.35
                + min(0.2, (len(significant_multicolor_groups) - settings.color_multicolor_min_families) * 0.08),
            )
            return build_prediction(
                [
                    {
                        "id": multicolor_entry["id"],
                        "name": multicolor_entry["name"],
                        "parent_color_id": multicolor_entry.get("parent_color_id"),
                        "parent_name": multicolor_entry.get("parent_name"),
                        "hex": multicolor_entry["hex"],
                        "kind": multicolor_entry["kind"],
                        "coverage_percent": 1.0,
                        "confidence": multicolor_confidence,
                        "distance": None,
                    }
                ],
                strategy="multicolor-families",
                confidence=multicolor_confidence,
                is_multicolor=True,
                debug=debug_payload,
            )

        if len(significant_groups) >= 2:
            selected = significant_groups[:2]
            confidence = sum(float(entry["coverage_percent"]) * float(entry["confidence"]) for entry in selected)
            return build_prediction(selected, strategy="two-families", confidence=confidence, debug=debug_payload)

        same_family_secondary: list[dict[str, Any]] = []
        if len(candidates) == 1:
            cluster_variants = candidates[0]["clusters"]
            if len(cluster_variants) >= 2:
                primary_cluster = cluster_variants[0]
                for secondary_cluster in cluster_variants[1:]:
                    if float(secondary_cluster["coverage_percent"]) < settings.color_second_color_min_percent:
                        continue
                    if secondary_cluster["id"] == primary_cluster["id"]:
                        continue
                    hue_delta = circular_hue_distance(primary_cluster["features"].hue, secondary_cluster["features"].hue)
                    chroma_delta = abs(primary_cluster["features"].chroma - secondary_cluster["features"].chroma)
                    if (
                        hue_delta >= settings.color_same_family_hue_delta
                        or chroma_delta >= settings.color_same_family_chroma_delta
                    ):
                        same_family_secondary = [primary_cluster, secondary_cluster]
                        break
        if same_family_secondary:
            selected = [
                {
                    key: value
                    for key, value in cluster.items()
                    if key
                    in {
                        "id",
                        "name",
                        "parent_color_id",
                        "parent_name",
                        "hex",
                        "kind",
                        "coverage_percent",
                        "confidence",
                        "distance",
                    }
                }
                for cluster in same_family_secondary
            ]
            confidence = sum(float(entry["coverage_percent"]) * float(entry["confidence"]) for entry in selected)
            return build_prediction(selected, strategy="same-family-two-shades", confidence=confidence, debug=debug_payload)

        return build_prediction(
            [top_candidate],
            strategy="single-family" if float(top_candidate["coverage_percent"]) >= settings.color_single_color_percent else "single-fallback",
            confidence=top_candidate["confidence"],
            debug=debug_payload,
        )

from __future__ import annotations

import cv2
import numpy as np


def normalize_probability_mask(mask: np.ndarray) -> np.ndarray:
    if mask.ndim == 3:
        mask = np.squeeze(mask)
    mask = mask.astype(np.float32)
    if mask.max() > 1:
        mask = mask / 255.0
    return np.clip(mask, 0.0, 1.0)


def threshold_mask(mask: np.ndarray, threshold: float) -> np.ndarray:
    return (normalize_probability_mask(mask) >= threshold).astype(np.uint8)


def ensure_odd_kernel_size(kernel_size: int) -> int:
    kernel_size = max(1, int(kernel_size))
    if kernel_size % 2 == 0:
        kernel_size += 1
    return kernel_size


def connected_components(mask: np.ndarray) -> tuple[int, np.ndarray, np.ndarray]:
    mask_uint8 = (mask.astype(np.uint8) * 255).astype(np.uint8)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask_uint8, connectivity=8)
    return num_labels, labels, stats


def largest_component_mask(mask: np.ndarray) -> np.ndarray:
    num_labels, labels, stats = connected_components(mask)
    if num_labels <= 1:
        return np.zeros_like(mask, dtype=np.uint8)

    largest_label = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return (labels == largest_label).astype(np.uint8)


def keep_components_by_area(mask: np.ndarray, min_area: int) -> np.ndarray:
    num_labels, labels, stats = connected_components(mask)
    if num_labels <= 1:
        return np.zeros_like(mask, dtype=np.uint8)

    cleaned = np.zeros_like(mask, dtype=np.uint8)
    for label in range(1, num_labels):
        if stats[label, cv2.CC_STAT_AREA] >= min_area:
            cleaned[labels == label] = 1
    return cleaned


def keep_low_components_linked_to_core(low_mask: np.ndarray, high_mask: np.ndarray) -> np.ndarray:
    num_labels, labels, _ = connected_components(low_mask)
    if num_labels <= 1:
        return np.zeros_like(low_mask, dtype=np.uint8)

    linked = np.zeros_like(low_mask, dtype=np.uint8)
    for label in range(1, num_labels):
        component = labels == label
        if np.any(high_mask[component] > 0):
            linked[component] = 1
    return linked


def fill_small_holes(mask: np.ndarray, max_hole_area: int) -> np.ndarray:
    inverted = 1 - mask.astype(np.uint8)
    num_labels, labels, stats = connected_components(inverted)
    filled = mask.copy().astype(np.uint8)
    height, width = mask.shape

    for label in range(1, num_labels):
        area = stats[label, cv2.CC_STAT_AREA]
        if area > max_hole_area:
            continue

        x = stats[label, cv2.CC_STAT_LEFT]
        y = stats[label, cv2.CC_STAT_TOP]
        w = stats[label, cv2.CC_STAT_WIDTH]
        h = stats[label, cv2.CC_STAT_HEIGHT]
        touches_border = x == 0 or y == 0 or (x + w) >= width or (y + h) >= height
        if touches_border:
            continue

        filled[labels == label] = 1
    return filled


def smoothstep(values: np.ndarray, low: float, high: float) -> np.ndarray:
    if high <= low:
        return (values >= high).astype(np.float32)
    scaled = np.clip((values - low) / (high - low), 0.0, 1.0)
    return scaled * scaled * (3.0 - 2.0 * scaled)


def resize_mask(mask: np.ndarray, width: int, height: int, interpolation: int = cv2.INTER_NEAREST) -> np.ndarray:
    return cv2.resize(mask.astype(np.float32), (width, height), interpolation=interpolation)


def resize_mask_to_image(mask: np.ndarray, image: np.ndarray, interpolation: int = cv2.INTER_NEAREST) -> np.ndarray:
    height, width = image.shape[:2]
    return resize_mask(mask, width, height, interpolation=interpolation)


def close_mask(mask: np.ndarray, kernel_size: int) -> np.ndarray:
    kernel_size = ensure_odd_kernel_size(kernel_size)
    if kernel_size <= 1:
        return mask.astype(np.uint8)
    kernel = np.ones((kernel_size, kernel_size), dtype=np.uint8)
    return cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel)


def blur_mask(mask: np.ndarray, kernel_size: int) -> np.ndarray:
    kernel_size = ensure_odd_kernel_size(kernel_size)
    if kernel_size <= 1:
        return mask.astype(np.float32)
    return cv2.GaussianBlur(mask.astype(np.float32), (kernel_size, kernel_size), 0)


def postprocess_mask(
    probability_mask: np.ndarray,
    *,
    threshold: float,
    low_threshold: float,
    high_threshold: float,
    min_area: int,
    min_area_ratio: float,
    max_hole_area: int,
    close_kernel_size: int,
    blur_kernel_size: int,
) -> tuple[np.ndarray, np.ndarray]:
    del close_kernel_size
    del blur_kernel_size

    probabilities = normalize_probability_mask(probability_mask)

    low = float(np.clip(min(low_threshold, high_threshold, threshold), 0.0, 1.0))
    high = float(np.clip(max(low_threshold, high_threshold, threshold), 0.0, 1.0))
    if high <= low:
        high = min(1.0, low + 0.1)

    low_mask = (probabilities >= low).astype(np.uint8)
    high_mask = (probabilities >= high).astype(np.uint8)

    if np.any(high_mask):
        support_mask = keep_low_components_linked_to_core(low_mask, high_mask)
    elif np.any(low_mask):
        support_mask = largest_component_mask(low_mask)
    else:
        return np.zeros_like(probabilities, dtype=np.uint8), np.zeros_like(probabilities, dtype=np.float32)

    largest_support = largest_component_mask(support_mask)
    largest_area = int(np.count_nonzero(largest_support))
    dynamic_min_area = max(int(min_area), int(largest_area * max(0.0, min_area_ratio)))
    support_mask = keep_components_by_area(support_mask, dynamic_min_area)
    support_mask = fill_small_holes(support_mask, max_hole_area)

    if not np.any(support_mask):
        support_mask = largest_support

    alpha = smoothstep(probabilities, low, high)
    alpha *= support_mask.astype(np.float32)

    core_mask = (high_mask & support_mask).astype(np.uint8)
    if np.any(core_mask):
        alpha = np.maximum(alpha, core_mask.astype(np.float32))

    return support_mask.astype(np.uint8), np.clip(alpha, 0.0, 1.0)

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence

import numpy as np

EARTH_RADIUS_M = 6_371_000.0

GPS_FEATURE_COLUMNS: list[str] = [
    "total_path_distance_m",
    "straight_distance_m",
    "displacement_ratio",
    "elapsed_time_s",
    "avg_speed_mps",
    "max_speed_mps",
    "speed_std_mps",
    "stationary_ratio",
    "time_stationary_s",
    "heading_change_mean_deg",
    "heading_change_std_deg",
    "mean_dist_from_route_m",
    "max_dist_from_route_m",
]


@dataclass(frozen=True)
class GPSPoint:
    lat: float
    lon: float
    ts: float


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    return EARTH_RADIUS_M * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_lambda = math.radians(lon2 - lon1)
    x = math.sin(d_lambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(d_lambda)
    return (math.degrees(math.atan2(x, y)) + 360.0) % 360.0


def _angular_diff_deg(a: float, b: float) -> float:
    diff = abs(a - b) % 360.0
    return min(diff, 360.0 - diff)


def _to_local_xy_m(lat: float, lon: float, ref_lat: float, ref_lon: float) -> tuple[float, float]:
    x = math.radians(lon - ref_lon) * EARTH_RADIUS_M * math.cos(math.radians(ref_lat))
    y = math.radians(lat - ref_lat) * EARTH_RADIUS_M
    return x, y


def _point_to_segment_distance_m(
    point_xy: tuple[float, float],
    seg_a: tuple[float, float],
    seg_b: tuple[float, float],
) -> float:
    px, py = point_xy
    ax, ay = seg_a
    bx, by = seg_b
    abx, aby = bx - ax, by - ay
    apx, apy = px - ax, py - ay
    ab_sq = abx * abx + aby * aby
    if ab_sq == 0.0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, (apx * abx + apy * aby) / ab_sq))
    cx = ax + t * abx
    cy = ay + t * aby
    return math.hypot(px - cx, py - cy)


def distances_to_route_m(points: Sequence[GPSPoint], route: Sequence[tuple[float, float]] | None) -> np.ndarray:
    if route is None or len(route) < 2:
        return np.zeros(len(points), dtype=float)
    ref_lat, ref_lon = route[0]
    route_xy = [_to_local_xy_m(lat, lon, ref_lat, ref_lon) for lat, lon in route]
    point_xy = [_to_local_xy_m(p.lat, p.lon, ref_lat, ref_lon) for p in points]
    dists = []
    for p in point_xy:
        best = min(_point_to_segment_distance_m(p, route_xy[i], route_xy[i + 1]) for i in range(len(route_xy) - 1))
        dists.append(best)
    return np.asarray(dists, dtype=float)


def extract_window_features(
    points: Sequence[GPSPoint],
    route: Sequence[tuple[float, float]] | None = None,
) -> dict[str, float]:
    if len(points) < 3:
        raise ValueError("At least 3 points are required.")

    ordered = sorted(points, key=lambda p: p.ts)
    deltas_t = np.diff(np.asarray([p.ts for p in ordered], dtype=float))
    if np.any(deltas_t <= 0):
        raise ValueError("Timestamps must be strictly increasing.")

    deltas_d = np.asarray(
        [
            haversine_m(ordered[i].lat, ordered[i].lon, ordered[i + 1].lat, ordered[i + 1].lon)
            for i in range(len(ordered) - 1)
        ],
        dtype=float,
    )
    speeds = deltas_d / deltas_t

    total_path_distance = float(np.sum(deltas_d))
    straight_distance = float(haversine_m(ordered[0].lat, ordered[0].lon, ordered[-1].lat, ordered[-1].lon))
    elapsed = float(ordered[-1].ts - ordered[0].ts)
    displacement_ratio = float(straight_distance / max(total_path_distance, 1e-6))

    stationary_mask = speeds < 0.2
    stationary_ratio = float(np.mean(stationary_mask))
    time_stationary = float(np.sum(deltas_t[stationary_mask])) if np.any(stationary_mask) else 0.0

    bearings = np.asarray(
        [
            bearing_deg(ordered[i].lat, ordered[i].lon, ordered[i + 1].lat, ordered[i + 1].lon)
            for i in range(len(ordered) - 1)
        ],
        dtype=float,
    )
    heading_changes = np.asarray(
        [_angular_diff_deg(bearings[i], bearings[i + 1]) for i in range(len(bearings) - 1)],
        dtype=float,
    )
    dists_to_route = distances_to_route_m(ordered, route)

    return {
        "total_path_distance_m": total_path_distance,
        "straight_distance_m": straight_distance,
        "displacement_ratio": displacement_ratio,
        "elapsed_time_s": elapsed,
        "avg_speed_mps": float(np.mean(speeds)),
        "max_speed_mps": float(np.max(speeds)),
        "speed_std_mps": float(np.std(speeds)),
        "stationary_ratio": stationary_ratio,
        "time_stationary_s": time_stationary,
        "heading_change_mean_deg": float(np.mean(heading_changes)) if len(heading_changes) else 0.0,
        "heading_change_std_deg": float(np.std(heading_changes)) if len(heading_changes) else 0.0,
        "mean_dist_from_route_m": float(np.mean(dists_to_route)),
        "max_dist_from_route_m": float(np.max(dists_to_route)),
    }

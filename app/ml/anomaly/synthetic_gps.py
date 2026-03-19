from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd

from app.ml.anomaly.feature_engineering import GPS_FEATURE_COLUMNS, GPSPoint, extract_window_features

TrackType = Literal["normal", "stuck", "circling", "off_route"]


@dataclass(frozen=True)
class TrackSample:
    points: list[GPSPoint]
    route: list[tuple[float, float]]
    track_type: TrackType


def _meters_to_latlon(dx_m: float, dy_m: float, ref_lat: float) -> tuple[float, float]:
    d_lat = (dy_m / 6_371_000.0) * (180.0 / math.pi)
    d_lon = (dx_m / (6_371_000.0 * math.cos(math.radians(ref_lat)))) * (180.0 / math.pi)
    return d_lat, d_lon


def _base_route(start_lat: float, start_lon: float, n: int, dt_s: float, rng: np.random.Generator) -> TrackSample:
    points: list[GPSPoint] = []
    route: list[tuple[float, float]] = []
    x, y = 0.0, 0.0
    t = 0.0
    heading = rng.uniform(0, 2 * math.pi)
    for _ in range(n):
        speed = float(rng.uniform(1.0, 1.6))
        heading += float(rng.normal(0.0, 0.07))
        x += math.cos(heading) * speed * dt_s
        y += math.sin(heading) * speed * dt_s
        d_lat, d_lon = _meters_to_latlon(x, y, start_lat)
        lat = start_lat + d_lat
        lon = start_lon + d_lon
        route.append((lat, lon))
        lat_obs = lat + float(rng.normal(0.0, 2.0 / 111_111.0))
        lon_obs = lon + float(rng.normal(0.0, 2.0 / (111_111.0 * max(math.cos(math.radians(start_lat)), 1e-6))))
        points.append(GPSPoint(lat=lat_obs, lon=lon_obs, ts=t))
        t += dt_s
    return TrackSample(points=points, route=route, track_type="normal")


def generate_track(track_type: TrackType, rng: np.random.Generator, n_points: int = 12, dt_s: float = 10.0) -> TrackSample:
    start_lat, start_lon = 43.238949, 76.889709
    base = _base_route(start_lat, start_lon, n_points, dt_s, rng)

    if track_type == "normal":
        return base

    pts = list(base.points)
    route = list(base.route)

    if track_type == "stuck":
        freeze_start = n_points // 2
        frozen = pts[freeze_start]
        for i in range(freeze_start, n_points):
            pts[i] = GPSPoint(
                lat=frozen.lat + float(rng.normal(0.0, 0.3 / 111_111.0)),
                lon=frozen.lon + float(
                    rng.normal(0.0, 0.3 / (111_111.0 * max(math.cos(math.radians(start_lat)), 1e-6)))
                ),
                ts=pts[i].ts,
            )
        return TrackSample(points=pts, route=route, track_type=track_type)

    if track_type == "circling":
        center = pts[n_points // 2]
        radius_m = float(rng.uniform(4.0, 10.0))
        for i in range(n_points):
            angle = (2 * math.pi * i) / n_points
            dx = radius_m * math.cos(angle)
            dy = radius_m * math.sin(angle)
            d_lat, d_lon = _meters_to_latlon(dx, dy, center.lat)
            pts[i] = GPSPoint(lat=center.lat + d_lat, lon=center.lon + d_lon, ts=pts[i].ts)
        return TrackSample(points=pts, route=route, track_type=track_type)

    if track_type == "off_route":
        for i in range(n_points // 2, n_points):
            shift_m = float(rng.uniform(35.0, 75.0))
            d_lat, d_lon = _meters_to_latlon(shift_m, shift_m * 0.4, pts[i].lat)
            pts[i] = GPSPoint(lat=pts[i].lat + d_lat, lon=pts[i].lon + d_lon, ts=pts[i].ts)
        return TrackSample(points=pts, route=route, track_type=track_type)

    raise ValueError(f"Unsupported track_type: {track_type}")


def build_synthetic_feature_dataset(
    *,
    n_normal: int = 1400,
    n_stuck: int = 250,
    n_circling: int = 200,
    n_off_route: int = 200,
    seed: int = 42,
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows: list[dict[str, float | int | str]] = []

    for _ in range(n_normal):
        sample = generate_track("normal", rng)
        features = extract_window_features(sample.points, sample.route)
        rows.append({**features, "track_type": sample.track_type, "is_anomaly": 0})

    for _ in range(n_stuck):
        sample = generate_track("stuck", rng)
        features = extract_window_features(sample.points, sample.route)
        rows.append({**features, "track_type": sample.track_type, "is_anomaly": 1})

    for _ in range(n_circling):
        sample = generate_track("circling", rng)
        features = extract_window_features(sample.points, sample.route)
        rows.append({**features, "track_type": sample.track_type, "is_anomaly": 1})

    for _ in range(n_off_route):
        sample = generate_track("off_route", rng)
        features = extract_window_features(sample.points, sample.route)
        rows.append({**features, "track_type": sample.track_type, "is_anomaly": 1})

    df = pd.DataFrame(rows)
    for col in GPS_FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0.0
    return df

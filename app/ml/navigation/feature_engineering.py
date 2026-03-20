from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Literal

import numpy as np
import pandas as pd

UserType = Literal["wheelchair", "blind", "elderly"]

FEATURE_COLUMNS: list[str] = [
    "edge_length_m",
    "surface_quality",
    "has_sidewalk",
    "has_tactile_paving",
    "wheelchair_accessibility",
    "width_m",
    "incline_pct",
    "is_lit",
    "crossing_score",
    "highway_score",
]


@dataclass(frozen=True)
class EdgeFeatureRow:
    u: str | int
    v: str | int
    key: str | int
    edge_length_m: float
    surface_quality: float
    has_sidewalk: float
    has_tactile_paving: float
    wheelchair_accessibility: float
    width_m: float
    incline_pct: float
    is_lit: float
    crossing_score: float
    highway_score: float

    def as_dict(self) -> dict[str, float | int]:
        return {
            "u": self.u,
            "v": self.v,
            "key": self.key,
            "edge_length_m": self.edge_length_m,
            "surface_quality": self.surface_quality,
            "has_sidewalk": self.has_sidewalk,
            "has_tactile_paving": self.has_tactile_paving,
            "wheelchair_accessibility": self.wheelchair_accessibility,
            "width_m": self.width_m,
            "incline_pct": self.incline_pct,
            "is_lit": self.is_lit,
            "crossing_score": self.crossing_score,
            "highway_score": self.highway_score,
        }


def _first_value(value: Any) -> Any:
    if isinstance(value, (list, tuple)) and value:
        return value[0]
    return value


def _as_text(value: Any) -> str:
    value = _first_value(value)
    return str(value).strip().lower()


def _parse_float(value: Any, *, default: float) -> float:
    value = _first_value(value)
    if value is None:
        return default
    try:
        text = str(value).strip().lower().replace("m", "")
        return float(text)
    except (TypeError, ValueError):
        return default


def _parse_incline(value: Any) -> float:
    value = _first_value(value)
    if value is None:
        return 0.0
    text = str(value).strip().lower()
    if text.endswith("%"):
        text = text[:-1]
    if text in {"up", "down", "yes", "unknown"}:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def _surface_quality(surface: Any) -> float:
    mapping = {
        "asphalt": 1.0,
        "paved": 0.95,
        "concrete": 0.9,
        "concrete:plates": 0.85,
        "paving_stones": 0.8,
        "sett": 0.65,
        "cobblestone": 0.55,
        "gravel": 0.35,
        "compacted": 0.7,
        "ground": 0.3,
        "dirt": 0.2,
        "sand": 0.15,
        "unpaved": 0.1,
    }
    return mapping.get(_as_text(surface), 0.6)


def _crossing_score(crossing: Any) -> float:
    mapping = {
        "traffic_signals": 1.0,
        "controlled": 0.95,
        "marked": 0.8,
        "zebra": 0.8,
        "uncontrolled": 0.5,
        "unmarked": 0.3,
        "no": 0.25,
    }
    return mapping.get(_as_text(crossing), 0.6)


def _highway_score(highway: Any) -> float:
    text = _as_text(highway)
    mapping = {
        "footway": 1.0,
        "pedestrian": 1.0,
        "living_street": 0.9,
        "path": 0.75,
        "residential": 0.75,
        "service": 0.65,
        "tertiary": 0.55,
        "secondary": 0.45,
        "primary": 0.35,
        "trunk": 0.2,
    }
    return mapping.get(text, 0.6)


def _yes_no(value: Any, *, yes: Iterable[str], default: float = 0.0) -> float:
    text = _as_text(value)
    return 1.0 if text in set(yes) else default


def _wheelchair_score(value: Any) -> float:
    text = _as_text(value)
    if text == "yes":
        return 1.0
    if text == "limited":
        return 0.5
    if text == "no":
        return 0.0
    return 0.5


def extract_edge_features(u: str | int, v: str | int, key: str | int, edge: dict[str, Any]) -> EdgeFeatureRow:
    return EdgeFeatureRow(
        u=u,
        v=v,
        key=key,
        edge_length_m=_parse_float(edge.get("length"), default=20.0),
        surface_quality=_surface_quality(edge.get("surface")),
        has_sidewalk=_yes_no(
            edge.get("sidewalk"),
            yes=("yes", "both", "left", "right", "separate"),
            default=0.0,
        ),
        has_tactile_paving=_yes_no(edge.get("tactile_paving"), yes=("yes",), default=0.0),
        wheelchair_accessibility=_wheelchair_score(edge.get("wheelchair")),
        width_m=max(_parse_float(edge.get("width"), default=2.0), 0.5),
        incline_pct=abs(_parse_incline(edge.get("incline"))),
        is_lit=_yes_no(edge.get("lit"), yes=("yes",), default=0.0),
        crossing_score=_crossing_score(edge.get("crossing")),
        highway_score=_highway_score(edge.get("highway")),
    )


def build_edge_dataframe(graph: Any) -> pd.DataFrame:
    rows: list[dict[str, float | int]] = []
    for u, v, key, edge_data in graph.edges(keys=True, data=True):
        row = extract_edge_features(u, v, key, edge_data).as_dict()
        rows.append(row)
    df = pd.DataFrame(rows)
    if df.empty:
        raise ValueError("No edges found in graph. Cannot train navigation model.")
    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0.0
    return df


def accessibility_cost(df: pd.DataFrame, user_type: UserType) -> np.ndarray:
    length = df["edge_length_m"].to_numpy(dtype=float)
    surface = df["surface_quality"].to_numpy(dtype=float)
    sidewalk = df["has_sidewalk"].to_numpy(dtype=float)
    tactile = df["has_tactile_paving"].to_numpy(dtype=float)
    wheelchair = df["wheelchair_accessibility"].to_numpy(dtype=float)
    width = df["width_m"].to_numpy(dtype=float)
    incline = df["incline_pct"].to_numpy(dtype=float)
    lit = df["is_lit"].to_numpy(dtype=float)
    crossing = df["crossing_score"].to_numpy(dtype=float)
    highway = df["highway_score"].to_numpy(dtype=float)

    penalty = np.ones_like(length)

    if user_type == "wheelchair":
        penalty *= np.where(surface < 0.5, 4.0, 1.0)
        penalty *= np.where(wheelchair < 0.5, 5.0, 1.0)
        penalty *= np.where(incline > 3.0, 6.0, 1.0)
        penalty *= np.where(sidewalk < 0.5, 3.0, 1.0)
        penalty *= 1.0 + np.clip(1.8 - width, 0.0, 1.8) * 0.55
        penalty *= 1.0 + (1.0 - crossing) * 1.1
    elif user_type == "blind":
        penalty *= np.where(tactile == 0.0, 4.0, 1.0)
        penalty *= np.where(crossing < 0.7, 5.0, 1.0)
        penalty *= np.where(lit == 0.0, 2.0, 1.0)
        penalty *= np.where(incline > 5.0, 3.0, 1.0)
        penalty *= 1.0 + (1.0 - sidewalk) * 0.6
        penalty *= 1.0 + (1.0 - highway) * 0.5
    elif user_type == "elderly":
        penalty *= np.where(incline > 2.0, 2.5, 1.0)
        penalty *= np.where(lit == 0.0, 3.0, 1.0)
        penalty *= np.where(surface < 0.7, 2.0, 1.0)
        penalty *= np.where(crossing < 0.7, 2.5, 1.0)
        penalty *= np.where(width < 1.5, 2.0, 1.0)
        penalty *= 1.0 + (1.0 - sidewalk) * 0.45
        penalty *= 1.0 + (1.0 - highway) * 0.35
    else:
        raise ValueError(f"Unsupported user_type: {user_type}")

    return length * penalty

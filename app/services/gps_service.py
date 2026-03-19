from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from app.ml.anomaly.feature_engineering import GPSPoint, extract_window_features

AnomalyType = Literal["none", "stuck", "circling", "off_route", "unknown"]


class GPSAnomalyService:
    def __init__(self, *, model_path: Path, metadata_path: Path) -> None:
        if not model_path.exists():
            raise FileNotFoundError(f"GPS model not found: {model_path}")
        if not metadata_path.exists():
            raise FileNotFoundError(f"GPS metadata not found: {metadata_path}")
        self.model: IsolationForest = joblib.load(model_path)
        self.metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        self.feature_columns: list[str] = list(self.metadata["feature_columns"])
        self.score_threshold: float = float(self.metadata.get("score_threshold", -0.1))

    @staticmethod
    def _derive_anomaly_type(features: dict[str, float], pred_flag: int) -> AnomalyType:
        if pred_flag == 0:
            return "none"
        if features["time_stationary_s"] >= 50.0 and features["avg_speed_mps"] < 0.25:
            return "stuck"
        if features["displacement_ratio"] < 0.25 and features["heading_change_mean_deg"] > 60.0:
            return "circling"
        if features["max_dist_from_route_m"] > 40.0:
            return "off_route"
        return "unknown"

    def check(
        self,
        *,
        points: list[GPSPoint],
        expected_route: list[tuple[float, float]] | None = None,
    ) -> dict:
        features = extract_window_features(points, expected_route)
        x = np.asarray([[features[col] for col in self.feature_columns]], dtype=float)
        raw_pred = int(self.model.predict(x)[0])
        anomaly_flag = 1 if raw_pred == -1 else 0
        anomaly_score = float(self.model.decision_function(x)[0])
        calibrated_flag = 1 if anomaly_score < self.score_threshold else 0
        anomaly_type = self._derive_anomaly_type(features, anomaly_flag)
        if calibrated_flag == 0 and anomaly_type == "unknown":
            anomaly_type = "none"
        final_flag = 1 if (calibrated_flag == 1 and anomaly_type in {"stuck", "circling", "off_route"}) else 0
        if final_flag == 0 and anomaly_type == "unknown":
            anomaly_type = "none"
        last = points[-1]
        return {
            "is_anomaly": bool(final_flag),
            "anomaly_type": anomaly_type,
            "score": anomaly_score,
            "location": (last.lat, last.lon),
            "features": features,
        }

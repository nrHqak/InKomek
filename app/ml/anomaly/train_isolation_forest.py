from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from app.ml.anomaly.feature_engineering import GPS_FEATURE_COLUMNS
from app.ml.anomaly.synthetic_gps import build_synthetic_feature_dataset

logger = logging.getLogger(__name__)


def _classification_report(pred_flags: np.ndarray, true_flags: np.ndarray) -> dict[str, float]:
    tp = int(np.sum((pred_flags == 1) & (true_flags == 1)))
    tn = int(np.sum((pred_flags == 0) & (true_flags == 0)))
    fp = int(np.sum((pred_flags == 1) & (true_flags == 0)))
    fn = int(np.sum((pred_flags == 0) & (true_flags == 1)))
    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    f1 = (2 * precision * recall) / max(precision + recall, 1e-9)
    accuracy = (tp + tn) / max(tp + tn + fp + fn, 1)
    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "tp": tp,
        "tn": tn,
        "fp": fp,
        "fn": fn,
    }


def train_gps_anomaly_model(
    *,
    model_path: Path,
    metadata_path: Path,
    dataset_csv_path: Path | None = None,
    seed: int = 42,
) -> dict[str, float]:
    model_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)

    df = build_synthetic_feature_dataset(seed=seed)
    if dataset_csv_path is not None:
        dataset_csv_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(dataset_csv_path, index=False)
        logger.info("Saved synthetic GPS dataset to %s (%s rows).", dataset_csv_path, len(df))

    x = df[GPS_FEATURE_COLUMNS]
    y_true = df["is_anomaly"].to_numpy(dtype=int)

    train_mask = y_true == 0
    x_train = x[train_mask]

    model = IsolationForest(
        n_estimators=300,
        contamination=0.18,
        max_samples="auto",
        random_state=seed,
        n_jobs=-1,
    )
    model.fit(x_train)

    normal_scores = model.decision_function(x_train)
    score_threshold = float(np.quantile(normal_scores, 0.02))
    all_scores = model.decision_function(x)
    pred_flags = np.where(all_scores < score_threshold, 1, 0)
    metrics = _classification_report(pred_flags, y_true)

    joblib.dump(model, model_path)
    logger.info("Saved IsolationForest model to %s.", model_path)

    metadata = {
        "feature_columns": GPS_FEATURE_COLUMNS,
        "rows": int(len(df)),
        "normal_rows": int(np.sum(y_true == 0)),
        "anomaly_rows": int(np.sum(y_true == 1)),
        "metrics": metrics,
        "contamination": 0.18,
        "n_estimators": 300,
        "score_threshold": score_threshold,
        "seed": seed,
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    logger.info("Saved training metadata to %s.", metadata_path)
    return metrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train GPS anomaly model using synthetic trajectories.")
    parser.add_argument("--model-path", default="artifacts/models/gps/isolation_forest.joblib")
    parser.add_argument("--metadata-path", default="artifacts/models/gps/isolation_forest_metadata.json")
    parser.add_argument("--dataset-csv-path", default="artifacts/data/synthetic_gps_features.csv")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--log-level", default="INFO")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )
    metrics = train_gps_anomaly_model(
        model_path=Path(args.model_path),
        metadata_path=Path(args.metadata_path),
        dataset_csv_path=Path(args.dataset_csv_path),
        seed=args.seed,
    )
    logger.info("Training metrics: %s", metrics)


if __name__ == "__main__":
    main()

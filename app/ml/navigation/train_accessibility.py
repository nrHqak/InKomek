from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from app.ml.navigation.feature_engineering import FEATURE_COLUMNS, accessibility_cost, build_edge_dataframe
from app.ml.navigation.graph_builder import build_and_save_graph, load_graph

logger = logging.getLogger(__name__)

USER_TYPES = ("wheelchair", "blind", "elderly")


def train_models(
    *,
    city_name: str,
    graph_path: Path,
    model_dir: Path,
    network_type: str = "walk",
    random_state: int = 42,
) -> dict[str, dict[str, float]]:
    model_dir.mkdir(parents=True, exist_ok=True)

    if graph_path.exists():
        graph = load_graph(graph_path)
    else:
        build_and_save_graph(city_name=city_name, output_graph_path=graph_path, network_type=network_type)
        graph = load_graph(graph_path)

    edges_df = build_edge_dataframe(graph)
    edges_cache_path = model_dir / "edge_features.csv"
    edges_df.to_csv(edges_cache_path, index=False)
    logger.info("Saved edge features to %s (%s rows).", edges_cache_path, len(edges_df))

    metrics: dict[str, dict[str, float]] = {}
    x_data = edges_df[FEATURE_COLUMNS]

    for user_type in USER_TYPES:
        y_data = accessibility_cost(edges_df, user_type=user_type)
        x_train, x_test, y_train, y_test = train_test_split(
            x_data, y_data, test_size=0.2, random_state=random_state
        )

        model = GradientBoostingRegressor(
            n_estimators=350,
            learning_rate=0.05,
            max_depth=5,
            subsample=0.9,
            min_samples_leaf=10,
            random_state=random_state,
        )
        model.fit(x_train, y_train)
        pred = model.predict(x_test)

        mae = float(mean_absolute_error(y_test, pred))
        r2 = float(r2_score(y_test, pred))
        metrics[user_type] = {"mae": mae, "r2": r2}

        model_path = model_dir / f"gb_accessibility_{user_type}.joblib"
        joblib.dump(model, model_path)
        logger.info(
            "Model saved user_type=%s path=%s (MAE=%.4f, R2=%.4f).",
            user_type,
            model_path,
            mae,
            r2,
        )

    metadata = {
        "city_name": city_name,
        "network_type": network_type,
        "feature_columns": FEATURE_COLUMNS,
        "edge_count": int(len(edges_df)),
        "metrics": metrics,
    }
    metadata_path = model_dir / "navigation_training_metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    logger.info("Training metadata saved to %s.", metadata_path)
    return metrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train accessibility weight models for navigation.")
    parser.add_argument("--city", default="Almaty, Kazakhstan", help="City name for OSM graph download.")
    parser.add_argument(
        "--graph-path",
        default="artifacts/graph/almaty_walk.graphml",
        help="Path to GraphML file for cached city graph.",
    )
    parser.add_argument(
        "--model-dir",
        default="artifacts/models/navigation",
        help="Directory where trained models and metadata are stored.",
    )
    parser.add_argument("--network-type", default="walk", help="OSMnx network type.")
    parser.add_argument("--log-level", default="INFO", help="Python log level.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )
    train_models(
        city_name=args.city,
        graph_path=Path(args.graph_path),
        model_dir=Path(args.model_dir),
        network_type=args.network_type,
    )


if __name__ == "__main__":
    main()

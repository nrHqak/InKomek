from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal

import joblib
import networkx as nx
import osmnx as ox
from sklearn.ensemble import GradientBoostingRegressor

from app.ml.navigation.feature_engineering import FEATURE_COLUMNS, extract_edge_features
from app.ml.navigation.graph_builder import load_graph

UserType = Literal["wheelchair", "blind", "elderly"]
logger = logging.getLogger(__name__)


class NavigationService:
    def __init__(self, *, graph_path: Path, model_dir: Path, city_name: str) -> None:
        self.city_name = city_name
        self.graph = load_graph(graph_path)
        self.models: dict[UserType, GradientBoostingRegressor] = {}
        self._load_models(model_dir=model_dir)
        self._attach_predicted_weights()

    def _load_models(self, *, model_dir: Path) -> None:
        for user_type in ("wheelchair", "blind", "elderly"):
            model_path = model_dir / f"gb_accessibility_{user_type}.joblib"
            if not model_path.exists():
                raise FileNotFoundError(
                    f"Missing trained model: {model_path}. "
                    "Train first via app.ml.navigation.train_accessibility."
                )
            self.models[user_type] = joblib.load(model_path)
        logger.info("Loaded accessibility models from %s.", model_dir)

    def _attach_predicted_weights(self) -> None:
        logger.info("Computing predicted edge weights for all user types.")
        for user_type, model in self.models.items():
            weight_key = f"weight_{user_type}"
            for u, v, key, edge_data in self.graph.edges(keys=True, data=True):
                row = extract_edge_features(u, v, key, edge_data)
                x_input = [[getattr(row, col) for col in FEATURE_COLUMNS]]
                weight = float(model.predict(x_input)[0])
                edge_data[weight_key] = max(weight, 0.01)
        logger.info("Edge weight projection complete.")

    def navigate(
        self,
        *,
        user_type: UserType,
        start_coords: tuple[float, float],
        end_coords: tuple[float, float],
    ) -> dict:
        start_lat, start_lon = start_coords
        end_lat, end_lon = end_coords

        start_node = ox.distance.nearest_nodes(self.graph, X=start_lon, Y=start_lat)
        end_node = ox.distance.nearest_nodes(self.graph, X=end_lon, Y=end_lat)

        weight_key = f"weight_{user_type}"
        node_path = nx.shortest_path(self.graph, source=start_node, target=end_node, weight=weight_key)

        route_coords: list[tuple[float, float]] = []
        total_length = 0.0
        total_cost = 0.0

        for node in node_path:
            node_data = self.graph.nodes[node]
            route_coords.append((float(node_data["y"]), float(node_data["x"])))

        for current_node, next_node in zip(node_path[:-1], node_path[1:]):
            edge_bundle = self.graph[current_node][next_node]
            best_edge = min(
                edge_bundle.values(),
                key=lambda edge_attr: float(edge_attr.get(weight_key, edge_attr.get("length", 0.0))),
            )
            total_length += float(best_edge.get("length", 0.0))
            total_cost += float(best_edge.get(weight_key, best_edge.get("length", 0.0)))

        return {
            "user_type": user_type,
            "city": self.city_name,
            "route_coords": route_coords,
            "node_ids": [str(node) for node in node_path],
            "summary": {
                "total_length_m": round(total_length, 3),
                "total_accessibility_cost": round(total_cost, 3),
                "node_count": len(node_path),
                "edge_count": max(len(node_path) - 1, 0),
            },
        }

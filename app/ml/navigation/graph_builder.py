from __future__ import annotations

import logging
from pathlib import Path

import osmnx as ox

logger = logging.getLogger(__name__)


def build_and_save_graph(
    *,
    city_name: str,
    output_graph_path: Path,
    network_type: str = "walk",
    simplify: bool = True,
) -> Path:
    output_graph_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info("Downloading OSM graph for city='%s' network_type='%s'.", city_name, network_type)
    graph = ox.graph_from_place(city_name, network_type=network_type, simplify=simplify)

    logger.info(
        "Graph downloaded with %s nodes and %s edges.",
        graph.number_of_nodes(),
        graph.number_of_edges(),
    )

    ox.save_graphml(graph, output_graph_path)
    logger.info("Graph saved to %s.", output_graph_path)
    return output_graph_path


def load_graph(graph_path: Path):
    if not graph_path.exists():
        raise FileNotFoundError(f"Graph file does not exist: {graph_path}")
    logger.info("Loading graph from %s.", graph_path)
    graph = ox.load_graphml(graph_path)
    logger.info(
        "Graph loaded with %s nodes and %s edges.",
        graph.number_of_nodes(),
        graph.number_of_edges(),
    )
    return graph

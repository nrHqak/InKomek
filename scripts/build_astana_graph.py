from __future__ import annotations

from pathlib import Path

from app.ml.navigation.graph_builder import build_and_save_graph


def main() -> None:
    build_and_save_graph(
        city_name="Astana, Kazakhstan",
        output_graph_path=Path("artifacts/graph/astana_walk.graphml"),
        network_type="walk",
    )


if __name__ == "__main__":
    main()

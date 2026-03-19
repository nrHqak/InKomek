from __future__ import annotations

from pathlib import Path

import modal

APP_NAME = "inclusive-city-navigation-training"
VOLUME_NAME = "inclusive-city-artifacts"
MOUNT_PATH = "/root/project"
ARTIFACTS_PATH = "/root/artifacts"

app = modal.App(APP_NAME)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "numpy==1.26.4",
        "pandas==2.2.3",
        "scikit-learn==1.6.1",
        "osmnx==2.1.0",
        "networkx==3.4.2",
        "joblib==1.4.2",
    )
    .add_local_dir(".", remote_path=MOUNT_PATH)
)

volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)


@app.function(
    image=image,
    cpu=4.0,
    memory=8192,
    timeout=60 * 30,
    volumes={ARTIFACTS_PATH: volume},
)
def train_navigation_remote(
    city_name: str = "Almaty, Kazakhstan",
    network_type: str = "walk",
) -> dict[str, dict[str, float]]:
    import sys

    sys.path.append(MOUNT_PATH)

    from app.ml.navigation.train_accessibility import train_models

    graph_path = Path(f"{ARTIFACTS_PATH}/graph/{city_name.split(',')[0].strip().lower()}_walk.graphml")
    model_dir = Path(f"{ARTIFACTS_PATH}/models/navigation")
    metrics = train_models(
        city_name=city_name,
        graph_path=graph_path,
        model_dir=model_dir,
        network_type=network_type,
    )
    volume.commit()
    return metrics


@app.local_entrypoint()
def run(city_name: str = "Almaty, Kazakhstan", network_type: str = "walk") -> None:
    metrics = train_navigation_remote.remote(city_name=city_name, network_type=network_type)
    print("Training finished:")
    print(metrics)

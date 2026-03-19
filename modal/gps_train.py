from __future__ import annotations

from pathlib import Path

import modal

APP_NAME = "inclusive-city-gps-training"
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
        "joblib==1.4.2",
    )
    .add_local_dir(".", remote_path=MOUNT_PATH)
)

volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)


@app.function(
    image=image,
    cpu=2.0,
    memory=4096,
    timeout=60 * 15,
    volumes={ARTIFACTS_PATH: volume},
)
def train_gps_remote(seed: int = 42) -> dict[str, float]:
    import sys

    sys.path.append(MOUNT_PATH)

    from app.ml.anomaly.train_isolation_forest import train_gps_anomaly_model

    model_path = Path(f"{ARTIFACTS_PATH}/models/gps/isolation_forest.joblib")
    metadata_path = Path(f"{ARTIFACTS_PATH}/models/gps/isolation_forest_metadata.json")
    dataset_path = Path(f"{ARTIFACTS_PATH}/data/synthetic_gps_features.csv")
    metrics = train_gps_anomaly_model(
        model_path=model_path,
        metadata_path=metadata_path,
        dataset_csv_path=dataset_path,
        seed=seed,
    )
    volume.commit()
    return metrics


@app.local_entrypoint()
def run(seed: int = 42) -> None:
    metrics = train_gps_remote.remote(seed=seed)
    print("GPS anomaly model training complete:")
    print(metrics)

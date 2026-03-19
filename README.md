# Inclusive City ML Backend

Production-ready FastAPI backend for personalized accessible navigation.

## 1) Setup

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Optional:

```bash
copy .env.example .env
```

## 2) Train navigation models locally (CPU)

Almaty graph (default):

```bash
python -m app.ml.navigation.train_accessibility --city "Almaty, Kazakhstan" --graph-path "artifacts/graph/almaty_walk.graphml" --model-dir "artifacts/models/navigation"
```

Astana graph:

```bash
python -m app.ml.navigation.train_accessibility --city "Astana, Kazakhstan" --graph-path "artifacts/graph/astana_walk.graphml" --model-dir "artifacts/models/navigation"
```

## 3) Train on Modal (remote)

```bash
modal run modal/navigation_train.py --city-name "Almaty, Kazakhstan" --network-type walk
```

The Modal job writes graph/model artifacts into the Modal volume `inclusive-city-artifacts`.

## 4) Run API

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 5) Endpoint

### `POST /navigate`

Request:

```json
{
  "user_type": "wheelchair",
  "start_coords": [43.238949, 76.889709],
  "end_coords": [43.246998, 76.923778]
}
```

Response:

```json
{
  "user_type": "wheelchair",
  "city": "Almaty, Kazakhstan",
  "route_coords": [[43.23901, 76.88971], [43.2392, 76.89011]],
  "node_ids": ["1234", "5678"],
  "summary": {
    "total_length_m": 1450.2,
    "total_accessibility_cost": 2720.9,
    "node_count": 57,
    "edge_count": 56
  }
}
```

## Notes

- Gradient boosting training is CPU-efficient and runs locally fast.
- Modal support is included for scalable remote execution and future GPU-heavy models (for example image models).

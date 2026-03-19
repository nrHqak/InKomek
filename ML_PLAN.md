# Alatau Inclusive City — ML Implementation Plan

**Author:** Sutaniese (sole ML engineer)
**Hackathon:** Alatau Smart City — 24h
**Track:** Инклюзивный город (Inclusive City)
**Time budget:** 20 hours ML (4h buffer for integration + sleep)

---

## Table of Contents

1. [Environment & Dependencies](#1-environment--dependencies)
2. [Feature 1 — Personalized Accessible Navigation](#2-feature-1--personalized-accessible-navigation)
3. [Feature 2 — GPS Anomaly Detection](#3-feature-2--gps-anomaly-detection)
4. [Feature 3 — Accessibility Problem Classification](#4-feature-3--accessibility-problem-classification)
5. [Feature 4 — Personalization & Recommendations](#5-feature-4--personalization--recommendations)
6. [FastAPI Serving Layer](#6-fastapi-serving-layer)
7. [Time Budget Breakdown](#7-time-budget-breakdown)
8. [Blockers & Fallbacks](#8-blockers--fallbacks)
9. [File Structure](#9-file-structure)

---

## 1. Environment & Dependencies

### Python version
- **Python 3.10 or 3.11** (3.11 preferred for speed; avoid 3.12+ due to potential ultralytics issues)

### `requirements.txt` — exact versions

```
# Core
fastapi==0.115.6
uvicorn[standard]==0.34.0
pydantic==2.10.4
python-multipart==0.0.18
joblib==1.4.2

# ML
scikit-learn==1.6.1
numpy==1.26.4
pandas==2.2.3

# Geo / Routing
osmnx==2.1.0
networkx==3.4.2
geopandas==1.0.1
shapely==2.0.6

# Vision (primary path — YOLOv8)
ultralytics==8.3.57
torch==2.5.1
torchvision==0.20.1
opencv-python-headless==4.10.0.84
Pillow==11.1.0

# Vision (fallback path — Gemini)
google-genai==1.5.0

# Data
requests==2.32.3
```

### Install command (single shot)
```bash
pip install -r requirements.txt
```

### GPU note
- If a GPU is available (CUDA), `torch` will use it automatically for YOLOv8 training.
- If NO GPU: skip YOLOv8 fine-tuning entirely → use Gemini Vision API fallback (see Feature 3).
- Check GPU: `python -c "import torch; print(torch.cuda.is_available())"`

---

## 2. Feature 1 — Personalized Accessible Navigation

**Goal:** Given origin, destination, and disability type → return the most accessible route.

### 2.1 Architecture

```
[User request: origin, destination, disability_type]
        │
        ▼
[OSMnx: download walk network for Alatau/Almaty]
        │
        ▼
[Extract edge features from OSM tags]
        │
        ▼
[GradientBoosting model predicts accessibility_cost per edge]
        │
        ▼
[Assign predicted costs as edge weights]
        │
        ▼
[NetworkX Dijkstra shortest path on weighted graph]
        │
        ▼
[Return route as list of coordinates]
```

### 2.2 Step-by-step implementation

#### Step 1: Download the walking network (cache it)

```python
import osmnx as ox

G = ox.graph_from_place("Almaty, Kazakhstan", network_type="walk")
# or if "Alatau" is a specific district:
# G = ox.graph_from_place("Alatau, Almaty, Kazakhstan", network_type="walk")
# or by bounding box:
# G = ox.graph_from_bbox(north=43.28, south=43.18, east=76.98, west=76.85, network_type="walk")

ox.save_graphml(G, "data/almaty_walk.graphml")
```

**IMPORTANT:** Cache the graph to disk. Loading from disk is 10x faster than re-downloading.

#### Step 2: Extract edge features from OSM tags

For each edge in the graph, extract these features. Many will be `None` — handle with defaults.

| Feature | OSM Tag | Default | Type |
|---------|---------|---------|------|
| `has_sidewalk` | `sidewalk` ∈ {yes, both, left, right} | 0 | binary |
| `surface_quality` | `surface` → encode: asphalt=1.0, paved=0.9, concrete=0.8, cobblestone=0.5, gravel=0.3, unpaved=0.1 | 0.5 | float |
| `has_tactile_paving` | `tactile_paving` = yes | 0 | binary |
| `wheelchair_accessible` | `wheelchair` ∈ {yes, limited, no} → 1.0 / 0.5 / 0.0 | 0.5 | float |
| `width` | `width` (parse to float, meters) | 2.0 | float |
| `incline` | `incline` (parse percentage) | 0.0 | float |
| `lit` | `lit` = yes | 0 | binary |
| `crossing_type` | `crossing` → traffic_signals=1.0, marked=0.7, unmarked=0.3 | 0.5 | float |
| `edge_length` | `length` (built-in from OSMnx) | — | float |
| `highway_type` | `highway` → one-hot or ordinal encode | — | categorical |

```python
import pandas as pd

edge_data = []
for u, v, k, data in G.edges(keys=True, data=True):
    features = extract_features(data)  # your function mapping tags → features
    edge_data.append({"u": u, "v": v, "k": k, **features})

edges_df = pd.DataFrame(edge_data)
```

#### Step 3: Generate synthetic accessibility cost labels

**Reality:** There is no pre-existing labeled dataset of "accessibility cost per edge for Almaty." You must create one.

**Approach — Rule-based label generation (not true ML training, but defensible for a hackathon):**

Define cost functions per disability type using domain knowledge:

```python
def wheelchair_cost(row):
    cost = row["edge_length"]
    if row["surface_quality"] < 0.5:
        cost *= 3.0
    if row["wheelchair_accessible"] < 0.5:
        cost *= 2.5
    if row["incline"] > 5.0:
        cost *= 4.0
    if not row["has_sidewalk"]:
        cost *= 2.0
    return cost

def blind_cost(row):
    cost = row["edge_length"]
    if not row["has_tactile_paving"]:
        cost *= 2.0
    if row["crossing_type"] < 0.7:
        cost *= 3.0
    if not row["lit"]:
        cost *= 1.5
    return cost

def elderly_cost(row):
    cost = row["edge_length"]
    if row["surface_quality"] < 0.7:
        cost *= 2.0
    if row["incline"] > 3.0:
        cost *= 3.0
    if not row["lit"]:
        cost *= 1.5
    return cost
```

Then use GradientBoosting to learn these patterns (this lets the model generalize and smooth out the hand-coded rules):

```python
from sklearn.ensemble import GradientBoostingRegressor

feature_cols = ["edge_length", "surface_quality", "has_sidewalk", 
                "has_tactile_paving", "wheelchair_accessible", 
                "width", "incline", "lit", "crossing_type"]

for disability in ["wheelchair", "blind", "elderly"]:
    X = edges_df[feature_cols].fillna(0)
    y = edges_df[f"{disability}_cost"]  # generated by rule functions above
    
    model = GradientBoostingRegressor(
        n_estimators=200, max_depth=4, learning_rate=0.1, random_state=42
    )
    model.fit(X, y)
    joblib.dump(model, f"models/route_{disability}.joblib")
```

#### Step 4: Route computation

```python
import networkx as nx

def get_accessible_route(G, origin_coords, dest_coords, disability_type):
    model = joblib.load(f"models/route_{disability_type}.joblib")
    
    origin_node = ox.nearest_nodes(G, origin_coords[1], origin_coords[0])
    dest_node = ox.nearest_nodes(G, dest_coords[1], dest_coords[0])
    
    # Assign predicted costs as edge attribute
    for u, v, k, data in G.edges(keys=True, data=True):
        features = extract_features_vector(data)  # same extraction
        data["accessibility_cost"] = model.predict([features])[0]
    
    route = nx.shortest_path(G, origin_node, dest_node, weight="accessibility_cost")
    
    route_coords = [(G.nodes[n]["y"], G.nodes[n]["x"]) for n in route]
    return route_coords
```

#### Step 5: FastAPI endpoint

```
POST /api/route
Body: { "origin": [lat, lon], "destination": [lat, lon], "disability_type": "wheelchair" }
Response: { "route": [[lat, lon], ...], "total_cost": 1234.5 }
```

### 2.3 Datasets

| Source | What | How to get |
|--------|------|------------|
| OSMnx | Walk network + all edge tags for Almaty | `ox.graph_from_place("Almaty, Kazakhstan", network_type="walk")` |
| OSM Overpass (via OSMnx) | Additional POI accessibility data | Built into OSMnx queries |
| doskaz.kz | Almaty accessibility ratings (green/yellow/red) | Web scrape if time permits (OPTIONAL) |

**Vesper queries (if using Vesper for supplementary data):**
```
vesper search "OpenStreetMap sidewalk accessibility surface wheelchair"
vesper search "urban walkability features dataset"
```

### 2.4 Time estimate: **4 hours**

| Task | Time |
|------|------|
| Download & cache graph | 30 min |
| Feature extraction function | 60 min |
| Rule-based label generation | 30 min |
| Train GradientBoosting models (3x) | 30 min |
| Route computation function | 30 min |
| FastAPI endpoint + testing | 30 min |
| Debug & edge cases | 30 min |

---

## 3. Feature 2 — GPS Anomaly Detection

**Goal:** Detect when a user is "stuck" (not moving for abnormal duration) and auto-alert.

### 3.1 Architecture

```
[GPS stream: lat, lon, timestamp every 5-10 sec]
        │
        ▼
[Feature extraction: rolling window]
        │
        ▼
[IsolationForest.predict() → anomaly or not]
        │
        ▼
[If anomaly → POST alert to /api/alert with location]
```

### 3.2 Feature engineering (critical)

IsolationForest works on point data, not raw time series. Transform the GPS stream into features using a **rolling window of N=6 points (~30-60 seconds)**:

| Feature | Calculation |
|---------|-------------|
| `distance_moved` | Haversine distance from point N-5 to point N |
| `speed` | `distance_moved / time_elapsed` |
| `heading_change` | Absolute bearing change over window |
| `displacement_ratio` | `straight_line_distance / total_path_distance` (detects circling) |
| `time_stationary` | Seconds where speed < 0.1 m/s in window |
| `distance_from_route` | Meters off the expected route (if route exists) |

```python
from math import radians, sin, cos, sqrt, atan2

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # meters
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi/2)**2 + cos(phi1)*cos(phi2)*sin(dlambda/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))
```

### 3.3 Training data (synthetic generation)

**There is no "person stuck" GPS dataset.** Generate synthetic data:

1. **Normal trajectories (80%):** Simulate walking at 1.0-1.5 m/s with slight GPS noise (±3m), occasional stops at crossings (5-15 sec).
2. **Anomalous trajectories (20%):**
   - **Stuck:** Speed drops to 0 for >60 seconds
   - **Circling:** Person moves but displacement_ratio < 0.2
   - **Off-route:** distance_from_route > 50m for >30 seconds

```python
import numpy as np

def generate_normal_walk(n_points=100):
    lat, lon = 43.238949, 76.945527  # Almaty center
    points = []
    for i in range(n_points):
        lat += np.random.normal(0.00001, 0.000003)
        lon += np.random.normal(0.00001, 0.000003)
        points.append({"lat": lat, "lon": lon, "ts": i * 5})
    return points

def generate_stuck(n_points=100, stuck_at=50):
    points = generate_normal_walk(stuck_at)
    last = points[-1]
    for i in range(stuck_at, n_points):
        points.append({
            "lat": last["lat"] + np.random.normal(0, 0.0000005),
            "lon": last["lon"] + np.random.normal(0, 0.0000005),
            "ts": i * 5
        })
    return points
```

Generate ~2000 normal windows, ~500 anomalous windows.

### 3.4 Model training

```python
from sklearn.ensemble import IsolationForest
import joblib

feature_cols = ["distance_moved", "speed", "heading_change",
                "displacement_ratio", "time_stationary"]

model = IsolationForest(
    n_estimators=150,
    contamination=0.15,    # expect ~15% anomalous
    max_samples="auto",
    random_state=42
)
model.fit(X_train[feature_cols])
joblib.dump(model, "models/gps_anomaly.joblib")
```

### 3.5 Inference (real-time)

```python
def check_anomaly(gps_buffer: list[dict]) -> bool:
    """gps_buffer = last 6 GPS points with lat, lon, timestamp"""
    features = extract_window_features(gps_buffer)
    prediction = model.predict([features])[0]
    return prediction == -1  # -1 = anomaly
```

### 3.6 FastAPI endpoints

```
POST /api/gps/check
Body: { "user_id": "abc", "points": [{"lat": 43.23, "lon": 76.94, "ts": 1710000000}, ...] }
Response: { "is_anomaly": true, "type": "stuck", "location": [43.23, 76.94] }

POST /api/alert
Body: { "user_id": "abc", "location": [lat, lon], "type": "stuck" }
Response: { "status": "ok", "alert_sent": true }
```

The frontend should:
1. Call `/api/gps/check` every 30 seconds with the last 6 GPS points
2. If `is_anomaly == true` → trigger phone vibration + show alert
3. Optionally auto-POST to `/api/alert` to pin location on the shared map

### 3.7 Time estimate: **3 hours**

| Task | Time |
|------|------|
| Haversine + feature extraction functions | 30 min |
| Synthetic data generation | 45 min |
| IsolationForest training + tuning contamination | 30 min |
| Inference function + endpoint | 30 min |
| Testing with edge cases | 30 min |
| Buffer | 15 min |

---

## 4. Feature 3 — Accessibility Problem Classification

**Goal:** User takes a photo of an accessibility problem → model classifies it into categories.

### 4.1 Classes (5 classes)

| Class | Label | Description |
|-------|-------|-------------|
| 0 | `no_ramp` | Missing wheelchair ramp at a crossing or entrance |
| 1 | `broken_elevator` | Non-functional or damaged elevator/lift |
| 2 | `high_curb` | Curb too high for wheelchair (>2cm without ramp) |
| 3 | `dangerous_zone` | Broken sidewalk, hole, ice, construction debris |
| 4 | `other` | Any other accessibility problem |

### 4.2 Decision: YOLOv8-cls vs Gemini Vision API

| Criterion | YOLOv8-cls | Gemini Vision API |
|-----------|-----------|-------------------|
| Requires GPU for training | YES | NO |
| Requires labeled dataset | YES (≥50 imgs/class) | NO (zero-shot) |
| Latency | ~50ms (local) | ~1-3s (API call) |
| Accuracy with small data | Medium | High (zero-shot) |
| Offline capable | YES | NO |
| Hackathon speed | Slow (data collection) | FAST |

### **PRIMARY PATH: Gemini Vision API (recommended for hackathon)**

This is the pragmatic choice. Collecting and labeling 250+ images during a hackathon is unrealistic. Gemini can classify zero-shot with a well-crafted prompt.

#### Implementation

```python
from google import genai
from google.genai import types
import json

client = genai.Client(api_key="YOUR_GEMINI_API_KEY")

CLASSIFICATION_PROMPT = """You are an accessibility inspector for urban infrastructure.

Analyze this image and classify the accessibility problem into EXACTLY ONE of these categories:
- "no_ramp": Missing wheelchair ramp at crossing or building entrance
- "broken_elevator": Non-functional, damaged, or missing elevator/lift
- "high_curb": Curb higher than 2cm without a ramp transition
- "dangerous_zone": Broken sidewalk, holes, ice, construction debris, blocked path
- "other": Other accessibility problem not fitting above categories
- "no_problem": No accessibility problem detected

Return ONLY a JSON object with these fields:
{
  "category": "one of the categories above",
  "confidence": 0.0 to 1.0,
  "description": "brief description of the problem in 1 sentence"
}"""

def classify_image(image_bytes: bytes) -> dict:
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
            CLASSIFICATION_PROMPT
        ]
    )
    return json.loads(response.text)
```

#### Cost estimate
- Gemini 2.0 Flash: ~$0.10 per 1M input tokens
- Each image ≈ 258 tokens → cost per classification ≈ $0.00003
- 1000 classifications during hackathon demo ≈ $0.03

### **FALLBACK PATH: YOLOv8-cls (if GPU available AND time permits)**

Only do this AFTER all other features are working (hour 16+).

#### Dataset sourcing via Vesper

```
vesper search "sidewalk accessibility problems images labeled"
vesper search "curb ramp detection urban infrastructure"
vesper search "broken sidewalk pavement defect classification"
```

Key datasets to pull:
1. **projectsidewalk/rampnet-dataset** (HuggingFace) — 214k panoramas with curb ramp labels. Filter for "no ramp" and "has ramp" classes.
2. **segments/sidewalk-semantic** (HuggingFace) — sidewalk semantic segmentation, can extract damaged areas.
3. Google Images (manual) — search "broken elevator accessibility", "high curb wheelchair" → save 30-50 per class.

#### Dataset structure
```
data/accessibility/
├── train/
│   ├── no_ramp/          (≥40 images)
│   ├── broken_elevator/  (≥40 images)
│   ├── high_curb/        (≥40 images)
│   ├── dangerous_zone/   (≥40 images)
│   └── other/            (≥40 images)
└── val/
    ├── no_ramp/          (≥10 images)
    ├── broken_elevator/  (≥10 images)
    ├── high_curb/        (≥10 images)
    ├── dangerous_zone/   (≥10 images)
    └── other/            (≥10 images)
```

#### Training

```python
from ultralytics import YOLO

model = YOLO("yolov8n-cls.pt")  # nano — fastest, fine for 5 classes
results = model.train(
    data="data/accessibility",
    epochs=30,           # small dataset → fewer epochs to avoid overfit
    imgsz=224,
    batch=16,
    lr0=0.001,
    patience=5,
    project="runs/classify",
    name="accessibility"
)
```

Training time: ~10 min on GPU, ~40 min on CPU (nano model).

#### Export for serving
```python
model = YOLO("runs/classify/accessibility/weights/best.pt")
model.export(format="onnx")  # optional: faster inference
```

### 4.3 FastAPI endpoint

```
POST /api/classify
Body: multipart/form-data with "image" file
Response: {
    "category": "high_curb",
    "confidence": 0.87,
    "description": "High curb at pedestrian crossing without ramp transition"
}
```

```python
from fastapi import UploadFile

@app.post("/api/classify")
async def classify(image: UploadFile):
    image_bytes = await image.read()
    result = classify_image(image_bytes)  # Gemini or YOLO
    return result
```

### 4.4 Time estimate: **4 hours**

| Task | Time |
|------|------|
| Gemini API setup + prompt engineering | 60 min |
| Testing with sample images (10-20 test images) | 45 min |
| FastAPI endpoint + file upload handling | 30 min |
| Prompt iteration for accuracy | 45 min |
| YOLOv8 fallback setup (OPTIONAL) | 60 min |

---

## 5. Feature 4 — Personalization & Recommendations

**Goal:** Suggest accessible places based on user profile + history.

### 5.1 Two parts

**Part A: Rule-based profile system (NOT ML — frontend handles UX)**
- Map disability_type → UX mode (larger text, voice output, haptic feedback, etc.)
- ML only provides an endpoint to store/retrieve profile settings.

**Part B: Collaborative filtering for place recommendations (ML)**

### 5.2 Architecture

```
[User visits/rates accessible places]
        │
        ▼
[User-Item interaction matrix]
        │
        ▼
[NearestNeighbors (cosine similarity)]
        │
        ▼
[Find similar users → recommend their top-rated places]
        │
        ▼
[Filter by accessibility match for user's disability type]
```

### 5.3 Data model

```python
# interactions table (simulated for hackathon)
interactions = [
    {"user_id": "u1", "place_id": "p1", "rating": 5, "disability_type": "wheelchair"},
    {"user_id": "u1", "place_id": "p3", "rating": 4, "disability_type": "wheelchair"},
    {"user_id": "u2", "place_id": "p1", "rating": 3, "disability_type": "blind"},
    ...
]
```

### 5.4 Implementation

```python
from sklearn.neighbors import NearestNeighbors
from scipy.sparse import csr_matrix
import numpy as np

def build_recommendation_model(interactions_df):
    # Pivot to user-item matrix
    matrix = interactions_df.pivot_table(
        index="user_id", columns="place_id", values="rating", fill_value=0
    )
    
    sparse_matrix = csr_matrix(matrix.values)
    
    model = NearestNeighbors(
        n_neighbors=5,
        metric="cosine",
        algorithm="brute"
    )
    model.fit(sparse_matrix)
    
    return model, matrix

def get_recommendations(user_id, model, matrix, n_recs=5):
    user_idx = list(matrix.index).index(user_id)
    user_vector = matrix.iloc[user_idx].values.reshape(1, -1)
    
    distances, indices = model.kneighbors(user_vector, n_neighbors=6)
    
    similar_users = indices[0][1:]  # exclude self
    
    # Aggregate ratings from similar users for unvisited places
    user_rated = set(matrix.columns[matrix.iloc[user_idx] > 0])
    recommendations = {}
    
    for sim_idx in similar_users:
        sim_ratings = matrix.iloc[sim_idx]
        for place, rating in sim_ratings.items():
            if rating > 0 and place not in user_rated:
                recommendations[place] = recommendations.get(place, [])
                recommendations[place].append(rating)
    
    # Average and sort
    scored = {p: np.mean(r) for p, r in recommendations.items()}
    return sorted(scored.items(), key=lambda x: -x[1])[:n_recs]
```

### 5.5 Cold start strategy (critical for demo)

At hackathon start, there are zero real users. Seed the database:

1. Pull accessible places from OSM:
```python
tags = {"amenity": True, "wheelchair": ["yes", "limited"]}
pois = ox.features_from_place("Almaty, Kazakhstan", tags=tags)
```

2. Generate 20-30 synthetic users with varied disability types and random ratings for a subset of places.

3. As real users interact during demo, their data gets added to the matrix → model improves.

### 5.6 FastAPI endpoints

```
GET /api/recommend?user_id=abc&n=5
Response: {
    "recommendations": [
        {"place_id": "p42", "name": "Cafe Accessible", "predicted_rating": 4.2, "lat": 43.24, "lon": 76.95},
        ...
    ]
}

POST /api/rate
Body: { "user_id": "abc", "place_id": "p42", "rating": 5 }
Response: { "status": "ok" }
```

### 5.7 Time estimate: **3 hours**

| Task | Time |
|------|------|
| Seed data: pull POIs from OSM | 30 min |
| Generate synthetic users + ratings | 30 min |
| NearestNeighbors model | 30 min |
| Recommendation function | 30 min |
| FastAPI endpoints | 30 min |
| Integration testing | 30 min |

---

## 6. FastAPI Serving Layer

### 6.1 Single unified API server

All ML models served from ONE FastAPI app. No microservices complexity.

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Alatau Inclusive City ML API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers
from app.routers import routing, gps, classify, recommend

app.include_router(routing.router, prefix="/api", tags=["routing"])
app.include_router(gps.router, prefix="/api", tags=["gps"])
app.include_router(classify.router, prefix="/api", tags=["classify"])
app.include_router(recommend.router, prefix="/api", tags=["recommend"])

@app.get("/health")
def health():
    return {"status": "ok"}
```

### 6.2 Startup model loading

```python
@app.on_event("startup")
def load_models():
    app.state.route_models = {
        "wheelchair": joblib.load("models/route_wheelchair.joblib"),
        "blind": joblib.load("models/route_blind.joblib"),
        "elderly": joblib.load("models/route_elderly.joblib"),
    }
    app.state.gps_model = joblib.load("models/gps_anomaly.joblib")
    app.state.graph = ox.load_graphml("data/almaty_walk.graphml")
    app.state.rec_model, app.state.rec_matrix = load_recommendation_model()
```

### 6.3 Run command

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 6.4 Full endpoint summary

| Method | Endpoint | Feature | Input | Output |
|--------|----------|---------|-------|--------|
| POST | `/api/route` | Accessible nav | origin, dest, disability_type | route coordinates + cost |
| POST | `/api/gps/check` | Anomaly detection | last 6 GPS points | is_anomaly + location |
| POST | `/api/alert` | Alert system | user_id, location, type | alert confirmation |
| POST | `/api/classify` | Photo classification | image file | category + confidence |
| GET | `/api/recommend` | Recommendations | user_id, n | list of recommended places |
| POST | `/api/rate` | Record rating | user_id, place_id, rating | confirmation |
| GET | `/health` | Health check | — | status |

---

## 7. Time Budget Breakdown

### Priority order (build in this exact sequence)

| # | Feature | Hours | Cumulative | Priority |
|---|---------|-------|------------|----------|
| 0 | Environment setup + deps | 0.5 | 0.5 | P0 |
| 1 | GPS Anomaly Detection | 3.0 | 3.5 | P0 — simplest, high demo impact |
| 2 | Photo Classification (Gemini) | 4.0 | 7.5 | P0 — high demo impact |
| 3 | Accessible Navigation | 4.0 | 11.5 | P0 — core feature |
| 4 | Recommendations | 3.0 | 14.5 | P1 — nice to have |
| 5 | FastAPI integration + CORS | 1.5 | 16.0 | P0 |
| 6 | End-to-end testing | 1.5 | 17.5 | P0 |
| 7 | Polish + YOLOv8 (if time) | 2.5 | 20.0 | P2 — optional |

**Total: 20 hours** → leaves 4 hours for integration with frontend team + sleep.

### Recommended timeline (24h hackathon)

```
HOUR 0-1    → Setup: install deps, get API keys, test imports
HOUR 1-4    → Feature 2: GPS anomaly detection (simplest, builds confidence)
HOUR 4-8    → Feature 3: Photo classification with Gemini
HOUR 8-12   → Feature 1: Accessible navigation (hardest, most code)
HOUR 12-15  → Feature 4: Recommendations + FastAPI integration
HOUR 15-17  → End-to-end testing + bug fixes
HOUR 17-19  → Integration with frontend team
HOUR 19-20  → Demo preparation
HOUR 20-24  → Buffer / sleep / presentation prep
```

---

## 8. Blockers & Fallbacks

### Feature 1: Accessible Navigation

| Blocker | Likelihood | Fallback |
|---------|-----------|----------|
| OSMnx download fails or takes too long | Medium | Pre-download the graph. Use `ox.graph_from_bbox()` for smaller area. |
| Almaty OSM data lacks accessibility tags | HIGH | Use only `surface`, `highway`, `length` (always present). Degrade gracefully: fewer features → simpler cost model. |
| GradientBoosting overfits on synthetic labels | Low | Use the raw rule-based cost functions directly (skip ML). This is equally valid for a hackathon. |
| Route computation is slow (>5s) | Low | Pre-compute edge weights at startup instead of per-request. Cache popular routes. |

### Feature 2: GPS Anomaly Detection

| Blocker | Likelihood | Fallback |
|---------|-----------|----------|
| IsolationForest gives too many false positives | Medium | Tune `contamination` parameter (try 0.05-0.20). Add minimum duration threshold (only flag if anomaly persists for 3+ consecutive windows). |
| Synthetic data doesn't match real GPS patterns | Medium | Use simple threshold rules: if speed < 0.1 m/s for > 90 seconds → anomaly. No ML needed. |

### Feature 3: Photo Classification

| Blocker | Likelihood | Fallback |
|---------|-----------|----------|
| Gemini API key issues or rate limits | Low | Use free tier: 1500 req/day on Gemini 2.0 Flash. More than enough. |
| Gemini gives inconsistent JSON output | Medium | Wrap in try/except, retry up to 3 times. Add `response_mime_type="application/json"` to force JSON output. |
| Need offline → must use YOLOv8 | Low | Only attempt if GPU available. Use `yolov8n-cls` (smallest). Minimum viable: 30 images per class. |
| No suitable dataset on Vesper/Kaggle | Medium | Manual collection: Google Images + phone camera. 30 images per class = 150 total. Takes ~1 hour. |

### Feature 4: Recommendations

| Blocker | Likelihood | Fallback |
|---------|-----------|----------|
| No real user data → cold start | CERTAIN | Pre-seed with synthetic users. This is expected. |
| Too few places have wheelchair tags in Almaty OSM | High | Use ALL amenities, not just wheelchair-tagged ones. Add accessibility score as a field. |
| Collaborative filtering gives bad results with <20 users | High | Fallback to content-based: recommend places with highest wheelchair/accessibility ratings nearest to user's location. Simple distance + rating sort. |

### General blockers

| Blocker | Likelihood | Fallback |
|---------|-----------|----------|
| `pip install` conflicts | Medium | Use `pip install --no-deps` for problematic packages. Or use conda. |
| No GPU available | High | Skip YOLOv8 entirely. Gemini Vision works on CPU. All scikit-learn models are CPU-only anyway. |
| Internet connectivity issues | Low | Pre-download: OSM graph, model weights, pip packages. Cache everything. |
| Vesper setup fails | Medium | Skip Vesper. Download datasets directly from HuggingFace/Kaggle CLI. |

---

## 9. File Structure

```
model/
├── ML_PLAN.md                    ← this file
├── requirements.txt
├── app/
│   ├── main.py                   ← FastAPI app entry point
│   ├── config.py                 ← API keys, paths, constants
│   ├── routers/
│   │   ├── routing.py            ← /api/route
│   │   ├── gps.py                ← /api/gps/check, /api/alert
│   │   ├── classify.py           ← /api/classify
│   │   └── recommend.py          ← /api/recommend, /api/rate
│   ├── ml/
│   │   ├── navigation.py         ← graph loading, feature extraction, routing
│   │   ├── anomaly.py            ← GPS anomaly detection
│   │   ├── classifier.py         ← Gemini / YOLOv8 classification
│   │   └── recommender.py        ← collaborative filtering
│   └── utils/
│       ├── geo.py                ← haversine, coordinate utils
│       └── data_gen.py           ← synthetic data generators
├── data/
│   ├── almaty_walk.graphml       ← cached OSM graph
│   ├── edges_features.csv        ← extracted edge features
│   ├── synthetic_gps.csv         ← generated GPS training data
│   └── accessibility/            ← image dataset (if using YOLOv8)
│       ├── train/
│       └── val/
├── models/
│   ├── route_wheelchair.joblib
│   ├── route_blind.joblib
│   ├── route_elderly.joblib
│   └── gps_anomaly.joblib
├── scripts/
│   ├── 01_download_graph.py      ← run first: downloads OSM data
│   ├── 02_extract_features.py    ← extracts edge features
│   ├── 03_train_routing.py       ← trains 3 routing models
│   ├── 04_train_gps.py           ← generates synthetic GPS + trains IsolationForest
│   └── 05_seed_recommendations.py ← seeds recommendation data
└── tests/
    ├── test_route.py
    ├── test_gps.py
    └── test_classify.py
```

---

## Appendix A: API Keys Required

| Service | Key | Where to get | Free tier |
|---------|-----|--------------|-----------|
| Google Gemini | `GEMINI_API_KEY` | https://aistudio.google.com/apikey | 1500 req/day (Gemini 2.0 Flash) |

No other API keys needed. OSMnx uses public Overpass API (no key). scikit-learn is fully local.

## Appendix B: Vesper Setup (if using)

```bash
npx vesper-wizard@latest
```

Then in your agent / terminal:
```
vesper search "sidewalk curb ramp detection images labeled"
vesper search "urban accessibility wheelchair dataset"
vesper search "pavement defect classification images"
vesper evaluate <dataset_id>
vesper prepare <dataset_id> --split 0.8/0.1/0.1
vesper export <dataset_id> --format folder
```

## Appendix C: Quick Test Commands

```bash
# Test 1: Verify all imports work
python -c "import osmnx, networkx, sklearn, fastapi, joblib; print('All imports OK')"

# Test 2: Download a small graph (fast check)
python -c "import osmnx as ox; G = ox.graph_from_place('Almaty, Kazakhstan', network_type='walk'); print(f'Nodes: {len(G.nodes)}, Edges: {len(G.edges)}')"

# Test 3: Run the API server
uvicorn app.main:app --reload --port 8000

# Test 4: Hit health endpoint
curl http://localhost:8000/health
```

## Appendix D: Demo Script (for presentation)

1. Open the map → show accessible route from point A to B (wheelchair mode)
2. Switch to blind mode → route changes (avoids unmarked crossings)
3. Start walking → GPS tracking shows live position
4. Stop moving for 60+ seconds → "Are you stuck?" alert triggers
5. Take photo of a high curb → app classifies it as "high_curb"
6. Problem is pinned on the map automatically
7. Show recommendations: "Places nearby that are wheelchair-accessible"

---

*This plan is designed to be executed sequentially, feature by feature, with each feature being independently demoable. If time runs short, cut Feature 4 (recommendations) first — it has the least demo impact.*

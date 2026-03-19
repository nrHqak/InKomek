# Inclusive City Backend

FastAPI backend for project "Инклюзивный город" with Supabase Auth (JWT) and Supabase Postgres.

## Run

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## Env

Set values in `.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `GEMINI_API_KEY` (optional)
- `UPLOAD_DIR`

`DATABASE_URL` must be psycopg driver URL, example:

`postgresql+psycopg://postgres:password@db.<project>.supabase.co:5432/postgres`

If you still pass `postgresql://...`, backend now auto-converts it to `postgresql+psycopg://...`.

If `db.<project-ref>.supabase.co` resolves only to IPv6 in your network, use Supabase **Session Pooler** connection string (IPv4-friendly) from Dashboard -> Database -> Connection string.

## Endpoint Examples

### 1) Auth

`POST /register`

```json
{
  "name": "Ali",
  "email": "ali@example.com",
  "password": "Password123",
  "type_of_disability": "wheelchair"
}
```

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

`POST /login`

```json
{
  "email": "ali@example.com",
  "password": "Password123"
}
```

`GET /me` with `Authorization: Bearer <jwt>`

```json
{
  "id": "b9b2f4fd-e726-4e58-80c4-6756ad8dc41d",
  "name": "Ali",
  "email": "ali@example.com",
  "type_of_disability": "wheelchair",
  "created_at": "2026-03-19T12:00:00+00:00"
}
```

### 2) Reports

`POST /reports`

```json
{
  "type": "broken_ramp",
  "description": "Пандус сломан",
  "location": {"lat": 41.31, "lng": 69.24}
}
```

`GET /reports`

`PATCH /reports/{id}`

```json
{
  "status": "reviewed"
}
```

### 3) Places

`POST /places`

```json
{
  "name": "Central Park",
  "type": "park",
  "location": {"lat": 41.30, "lng": 69.26},
  "accessibility_info": "Есть пандусы и тактильная плитка"
}
```

`GET /places`

`GET /places?type=park`

### 4) Route

`GET /route?from=41.31,69.24&to=41.29,69.21&type=wheelchair`

```json
{
  "type": "wheelchair",
  "path": [{"lat": 41.31, "lng": 69.24}],
  "segments": [
    {
      "start": {"lat": 41.31, "lng": 69.24},
      "end": {"lat": 41.306, "lng": 69.234},
      "accessibility_weight": 0.82
    }
  ]
}
```

### 5) Alerts

`POST /alerts`

```json
{
  "type": "manual_alert",
  "message": "Нужна помощь",
  "location": {"lat": 41.315, "lng": 69.245},
  "vibration_values": [2.2, 1.9, 2.1],
  "speed_values": [0.1, 0.0, 0.1]
}
```

`GET /alerts?user_id=<uuid>`

### 6) Photos

`POST /photos` as multipart:

- `file`: image
- `lat`: `41.31`
- `lng`: `69.24`

Returns:

```json
{
  "id": "0a33d20b-58d8-42cc-bfd6-73f8cbb5f3db",
  "user_id": "b9b2f4fd-e726-4e58-80c4-6756ad8dc41d",
  "location": {"lat": 41.31, "lng": 69.24},
  "result": "ramp_present",
  "created_at": "2026-03-19T12:00:00+00:00"
}
```

## Notes

- All endpoints except `/register` and `/login` require JWT.
- DB schema initializes on app startup.
- Route/anomaly/photo ML services are prepared as pluggable adapters.

from __future__ import annotations

import argparse
import json
import sys
from itertools import combinations

import httpx


USER_TYPES = ("wheelchair", "blind", "elderly")


def parse_lat_lng(raw: str) -> tuple[float, float]:
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) != 2:
        raise ValueError(f"Invalid coordinate format: {raw}. Use 'lat,lng'.")
    return float(parts[0]), float(parts[1])


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Smoke regression check for ML /navigate endpoint.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="ML API base URL.")
    parser.add_argument("--start", default="43.238949,76.889709", help="Start coordinate in 'lat,lng'.")
    parser.add_argument("--end", default="43.246998,76.923778", help="End coordinate in 'lat,lng'.")
    parser.add_argument("--timeout", type=float, default=90.0, help="HTTP timeout in seconds.")
    parser.add_argument(
        "--min-cost-diff",
        type=float,
        default=0.001,
        help="Minimum cost difference between at least one pair of user types.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    start = parse_lat_lng(args.start)
    end = parse_lat_lng(args.end)
    url = f"{args.base_url.rstrip('/')}/navigate"

    results: dict[str, dict] = {}
    failures: list[str] = []

    with httpx.Client(timeout=args.timeout) as client:
        for user_type in USER_TYPES:
            payload = {
                "user_type": user_type,
                "start_coords": [start[0], start[1]],
                "end_coords": [end[0], end[1]],
            }
            try:
                resp = client.post(url, json=payload)
            except Exception as exc:
                failures.append(f"{user_type}: request failed: {exc}")
                continue

            if resp.status_code != 200:
                failures.append(f"{user_type}: HTTP {resp.status_code} -> {resp.text[:300]}")
                continue

            try:
                data = resp.json()
            except Exception as exc:
                failures.append(f"{user_type}: invalid JSON: {exc}")
                continue

            route_coords = data.get("route_coords") or []
            summary = data.get("summary") or {}
            edge_count = int(summary.get("edge_count", 0))
            node_count = int(summary.get("node_count", 0))
            total_cost = float(summary.get("total_accessibility_cost", 0.0))
            total_length = float(summary.get("total_length_m", 0.0))

            if len(route_coords) < 2:
                failures.append(f"{user_type}: route too short ({len(route_coords)} points)")
            if edge_count < 1 or node_count < 2:
                failures.append(f"{user_type}: invalid graph summary edge_count={edge_count}, node_count={node_count}")

            results[user_type] = {
                "edge_count": edge_count,
                "node_count": node_count,
                "total_length_m": total_length,
                "total_accessibility_cost": total_cost,
            }

    if len(results) == len(USER_TYPES):
        diffs = []
        for left, right in combinations(USER_TYPES, 2):
            diffs.append(abs(results[left]["total_accessibility_cost"] - results[right]["total_accessibility_cost"]))
        if max(diffs) < args.min_cost_diff:
            failures.append(
                "Costs for all user types are almost identical; expected at least one noticeable difference."
            )

    print("=== Navigation Smoke Result ===")
    print(json.dumps(results, indent=2, ensure_ascii=False))
    if failures:
        print("\n=== FAILURES ===")
        for item in failures:
            print(f"- {item}")
        return 1

    print("\nStatus: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

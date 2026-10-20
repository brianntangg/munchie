import json
import os
import sys
from pathlib import Path
from typing import Any

from supabase import create_client

from netnutrition_scraper import HALL_IDS


def build_menu_rows(
    raw_data: list[dict[str, Any]] | dict[str, Any],
) -> list[dict[str, str | None]]:
    menus = raw_data.get("menus", []) if isinstance(raw_data, dict) else raw_data
    rows: dict[tuple[str, str], dict[str, str | None]] = {}
    skipped: set[str] = set()

    for menu in menus:
        location = menu.get("location", "")
        hall_id = HALL_IDS.get(location)
        if hall_id is None:
            if location:
                skipped.add(location)
            continue

        for item in menu.get("items", []):
            raw_name = item.get("name", "")
            name = raw_name.strip() if isinstance(raw_name, str) else ""
            if not 1 <= len(name) <= 200:
                continue

            raw_category = item.get("category", "")
            category = raw_category.strip() if isinstance(raw_category, str) else ""
            if len(category) > 100:
                continue

            rows.setdefault(
                (hall_id, name),
                {
                    "dining_hall_id": hall_id,
                    "name": name,
                    "category": category or None,
                },
            )

    if skipped:
        print("Skipped locations: " + ", ".join(sorted(skipped)))
    return list(rows.values())


def import_menus(json_path: Path, url: str, key: str, batch_size: int = 500) -> int:
    with json_path.open(encoding="utf-8") as file:
        rows = build_menu_rows(json.load(file))

    client = create_client(url, key)
    for start in range(0, len(rows), batch_size):
        batch = rows[start:start + batch_size]
        client.table("menu_items").upsert(
            batch,
            on_conflict="dining_hall_id,name",
        ).execute()
    return len(rows)


def main() -> int:
    url = os.getenv("EXPO_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing Supabase environment variables", file=sys.stderr)
        return 2

    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("vanderbilt_all_menus.json")
    try:
        count = import_menus(path, url, key)
    except Exception as error:
        print(f"Menu import failed: {error}", file=sys.stderr)
        return 1

    if count == 0:
        print("No menu items found; the scrape may have failed", file=sys.stderr)
        return 1

    print(f"Imported {count} menu items")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

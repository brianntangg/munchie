import json
import os

from supabase import create_client


client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

with open("vanderbilt_all_menus.json", encoding="utf-8") as file:
    menus = json.load(file)

halls = client.table("dining_halls").select("id, name").execute().data
hall_ids = {
    hall["name"].strip().lower(): hall["id"]
    for hall in halls
}

rows = []

for menu in menus:
    location = menu["location"].strip().lower()
    hall_id = hall_ids.get(location)

    if hall_id is None:
        raise RuntimeError(
            f"Dining hall was not found in Supabase: {menu['location']}"
        )

    for item in menu["items"]:
        rows.append({
            "dining_hall_id": hall_id,
            "name": item["name"].strip(),
            "category": item.get("category"),
        })

if rows:
    client.table("menu_items").upsert(
        rows,
        on_conflict="dining_hall_id,name",
    ).execute()

print(f"Imported {len(rows)} menu items")
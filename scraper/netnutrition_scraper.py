import json
import os
import re
import sys
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


URL = "https://netnutrition.cbord.com/nn-prod/vucampusdining#"
# {"hours": {location: weekly hours}, "menus": [menu records]}. Hours cover every location,
# including ones with no menus published right now.
OUTPUT_FILE = "vanderbilt_all_menus.json"

# Scraper location name (NetNutrition) -> dining_halls.id, as inserted by the sprint 2 migration.
HALL_IDS = {
    "Rand Dining Center": "10000000-0000-4000-8000-000000000001",
    "The Commons Dining Center": "10000000-0000-4000-8000-000000000002",
    "E. Bronson Ingram Dining Center": "10000000-0000-4000-8000-000000000003",
    "Rothschild Dining Center - Contains Peanuts & Tree Nuts": "10000000-0000-4000-8000-000000000004",
    "Zeppos Dining": "10000000-0000-4000-8000-000000000005",
}

# Created by main() so importing this file (or exporting SQL) does not start Chrome.
driver = None
wait = None


def get_locations():

    elements = driver.find_elements(
        By.CSS_SELECTOR,
        '#nav-unit-selector a[data-type="UN"]'
    )

    locations = []

    for el in elements:

        unit_id = el.get_attribute("data-unitoid")
        name = el.get_attribute("title")

        if not unit_id or unit_id == "-1":
            continue

        if not name or name == "Show All Units":
            continue

        locations.append({
            "unit_id": int(unit_id),
            "name": name.strip()
        })

    return locations


def select_location(unit_id):

    selector = (
        '#nav-unit-selector '
        f'a[data-type="UN"][data-unitoid="{unit_id}"]'
    )

    el = wait.until(
        EC.presence_of_element_located(
            (By.CSS_SELECTOR, selector)
        )
    )

    name = el.get_attribute("title")

    print(f"    Selecting location: {name}")

    driver.execute_script(
        "NetNutrition.UI.handleNavBarSelection(arguments[0]);",
        el
    )

    wait.until(
        lambda d: len(
            d.find_elements(
                By.CSS_SELECTOR,
                '#nav-date-selector a[data-type="DT"]'
            )
        ) > 0
    )

    return name


def get_dates():

    wait.until(
        lambda d: len(
            d.find_elements(
                By.CSS_SELECTOR,
                '#nav-date-selector a[data-type="DT"]'
            )
        ) > 0
    )

    elements = driver.find_elements(
        By.CSS_SELECTOR,
        '#nav-date-selector a[data-type="DT"]'
    )

    dates = []

    for el in elements:

        date_value = el.get_attribute("data-date")
        date_name = el.get_attribute("title")

        if not date_value:
            continue

        if not date_name:
            continue

        dates.append({
            "date": date_name.strip(),
            "date_value": date_value
        })

    return dates


def select_date(date_value):

    selector = (
        '#nav-date-selector '
        f'a[data-type="DT"][data-date="{date_value}"]'
    )

    # Re-query the date element because menu navigation replaces the DOM.
    el = wait.until(
        EC.presence_of_element_located(
            (By.CSS_SELECTOR, selector)
        )
    )

    date_name = el.get_attribute("title")

    print(f"    Selecting date: {date_name}")

    driver.execute_script(
        """
        arguments[0].scrollIntoView({
            block: 'center'
        });
        """,
        el
    )

    driver.execute_script(
        "NetNutrition.UI.handleNavBarSelection(arguments[0]);",
        el
    )

    # The selected-date header can lag; allow menu results to update instead.

    time.sleep(0.5)

    return date_name


def get_menus(date_name):

    try:
        wait.until(
            lambda d: len(
                d.find_elements(
                    By.CSS_SELECTOR,
                    "#navBarResults .list-group-item"
                )
            ) > 0
        )
    except:
        return []

    elements = driver.find_elements(
        By.CSS_SELECTOR,
        "#navBarResults .list-group-item"
    )

    pattern = re.compile(
        r"menuListSelectUnitAndMenu"
        r"\(\s*(\d+)\s*,\s*(\d+)\s*\)"
    )

    menus = []

    for el in elements:

        onclick = el.get_attribute("onclick") or ""

        match = pattern.search(onclick)

        if not match:
            continue

        unit_id = int(match.group(1))
        menu_id = int(match.group(2))

        text = el.get_attribute(
            "textContent"
        ).strip()

        if not text:
            continue

        # Menu labels combine the date and meal, e.g. Wednesday, September 30, 2026-Lunch.

        if not text.startswith(date_name):
            continue

        meal = text[len(date_name):].strip()

        if meal.startswith("-"):
            meal = meal[1:].strip()

        if not meal:
            continue

        menus.append({
            "unit_id": unit_id,
            "menu_id": menu_id,
            "meal": meal
        })

    unique = {}

    for menu in menus:
        unique[menu["menu_id"]] = menu

    return list(unique.values())


def load_menu(unit_id, menu_id):

    driver.execute_script(
        f"""
        NetNutrition.UI.menuListSelectUnitAndMenu(
            {unit_id},
            {menu_id}
        );
        """
    )

    try:
        wait.until(
            lambda d: len(
                d.find_elements(
                    By.CSS_SELECTOR,
                    "tr.cbo_nn_itemPrimaryRow, "
                    "tr.cbo_nn_itemAlternateRow"
                )
            ) > 0
        )
    except:
        pass


def scrape_items():

    rows = driver.find_elements(
        By.CSS_SELECTOR,
        "tr.cbo_nn_itemGroupRow, "
        "tr.cbo_nn_itemPrimaryRow, "
        "tr.cbo_nn_itemAlternateRow"
    )

    items = []

    current_category = None

    for row in rows:

        classes = row.get_attribute("class") or ""


        if "cbo_nn_itemGroupRow" in classes:

            text = row.get_attribute(
                "textContent"
            ).strip()

            if text:
                current_category = re.sub(
                    r"\s+",
                    " ",
                    text
                ).strip()

            continue


        if (
            "cbo_nn_itemPrimaryRow" not in classes
            and
            "cbo_nn_itemAlternateRow" not in classes
        ):
            continue

        name_elements = row.find_elements(
            By.CSS_SELECTOR,
            "a[id^='showNutrition_']"
        )

        if not name_elements:
            continue

        name = name_elements[0].get_attribute(
            "textContent"
        ).strip()

        if not name:
            continue

        name = re.sub(
            r"\s+",
            " ",
            name
        ).strip()

        items.append({
            "name": name,
            "category": current_category
        })

    return items


DAYS = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday"
]


def to_24h(text):

    match = re.fullmatch(
        r"\s*(\d{1,2}):(\d{2})\s*([AP]M)\s*",
        text,
        re.IGNORECASE
    )

    if not match:
        raise ValueError(f"Unrecognized time: {text!r}")

    hour = int(match.group(1)) % 12
    minute = int(match.group(2))

    if match.group(3).upper() == "PM":
        hour += 12

    return f"{hour:02d}:{minute:02d}"


def parse_hours(rows):

    # rows are the cell texts of each table row: [day, open, close] or [day, "Closed"].
    # A day can appear on several rows (split shifts) and rows are not sorted.
    hours = {day: [] for day in DAYS}

    for cells in rows:

        if not cells or cells[0] not in hours:
            continue

        if len(cells) < 3:
            continue

        hours[cells[0]].append(
            [to_24h(cells[1]), to_24h(cells[2])]
        )

    for shifts in hours.values():
        shifts.sort()

    return hours


def get_hours(unit_id):

    # Weekly hours of operation from the unit's modal, as {"Monday": [["07:00", "15:00"]], ...}.
    # A close time at or before the open time means the shift ends after midnight.
    # Returns None on failure so a missing modal does not stop menu scraping.
    try:

        driver.execute_script(
            f"NetNutrition.UI.openHoursInModal({unit_id});"
        )

        table = wait.until(
            EC.visibility_of_element_located(
                (
                    By.CSS_SELECTOR,
                    "#cbo_nn_hoursOfOperationDialogInner table"
                )
            )
        )

        rows = [
            [
                cell.get_attribute("textContent").strip()
                for cell in row.find_elements(By.TAG_NAME, "td")
            ]
            for row in table.find_elements(By.TAG_NAME, "tr")
        ]

        hours = parse_hours(rows)

        driver.execute_script(
            "$('#cbo_nn_hoursOfOperation').modal('hide');"
        )

        wait.until(
            EC.invisibility_of_element_located(
                (By.ID, "cbo_nn_hoursOfOperation")
            )
        )

        return hours

    except Exception as e:

        print(f"    ERROR hours for unit {unit_id}: {e}")

        return None


def load_output():

    # The saved menus and hours, so refreshing one does not discard the other.
    try:
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            saved = json.load(f)

    except FileNotFoundError:
        return [], {}

    if isinstance(saved, dict):
        return saved.get("menus", []), saved.get("hours", {})

    # Older output was a bare list of menu records.
    return saved, {}


def save_output(menus, hours):

    # Write to a temporary file first so a crash cannot leave a half-written output file.
    temp = OUTPUT_FILE + ".tmp"

    with open(
        temp,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            {"hours": hours, "menus": menus},
            f,
            indent=2,
            ensure_ascii=False
        )

    os.replace(temp, OUTPUT_FILE)


def scrape_hours():

    # Hours only, no menus: quick, and covers locations with no menus right now.
    # Saved menus in the output file are kept as they are.
    driver.get(URL)

    wait.until(
        EC.presence_of_element_located(
            (By.ID, "nav-unit-selector")
        )
    )

    time.sleep(1)

    menus, _ = load_output()
    all_hours = {}

    for location in get_locations():

        print(f"Hours: {location['name']}")

        hours = get_hours(location["unit_id"])

        if hours is not None:
            all_hours[location["name"]] = hours

    save_output(menus, all_hours)

    print(
        f"Saved hours for {len(all_hours)} locations to "
        f"{OUTPUT_FILE}"
    )


def scrape():

    driver.get(URL)

    wait.until(
        EC.presence_of_element_located(
            (By.ID, "nav-unit-selector")
        )
    )

    time.sleep(1)

    locations = get_locations()

    print(
        f"Found {len(locations)} locations"
    )

    all_data = []
    all_hours = {}


    for location_index, location in enumerate(
        locations,
        start=1
    ):

        unit_id = location["unit_id"]
        location_name = location["name"]

        print()
        print("=" * 70)
        print(
            f"LOCATION "
            f"{location_index}/{len(locations)}: "
            f"{location_name}"
        )
        print("=" * 70)

        try:


            select_location(unit_id)

            hours = get_hours(unit_id)

            if hours is not None:
                all_hours[location_name] = hours
                save_output(all_data, all_hours)


            dates = get_dates()

            print(
                f"  Found {len(dates)} dates"
            )


            for date_index, date in enumerate(
                dates,
                start=1
            ):

                date_value = date["date_value"]
                date_name = date["date"]

                print()
                print(
                    f"  DATE "
                    f"{date_index}/{len(dates)}: "
                    f"{date_name}"
                )

                try:

                    # Reselect the location before each date to restore the date selector after a menu load.

                    select_location(unit_id)


                    current_dates = get_dates()

                    found_date = None

                    for current_date in current_dates:

                        if (
                            current_date["date_value"]
                            == date_value
                        ):
                            found_date = current_date
                            break

                    if found_date is None:

                        print(
                            f"    Could not find "
                            f"{date_name}"
                        )

                        continue


                    selected_date = select_date(
                        date_value
                    )


                    menus = get_menus(
                        selected_date
                    )

                    print(
                        f"    Found {len(menus)} menus"
                    )


                    for menu_index, menu in enumerate(
                        menus,
                        start=1
                    ):

                        menu_id = menu["menu_id"]
                        menu_unit_id = menu["unit_id"]
                        meal = menu["meal"]

                        print(
                            f"      MENU "
                            f"{menu_index}/{len(menus)}: "
                            f"{meal}"
                        )

                        try:

                            load_menu(
                                menu_unit_id,
                                menu_id
                            )

                            items = scrape_items()

                            print(
                                f"        "
                                f"{len(items)} foods"
                            )

                            all_data.append({
                                "location": location_name,
                                "unit_id": unit_id,
                                "date": selected_date,
                                "date_value": date_value,
                                "meal": meal,
                                "menu_id": menu_id,
                                "items": items
                            })

                            # Persist each menu so later failures retain collected results.
                            save_output(all_data, all_hours)

                        except Exception as e:

                            print(
                                f"      ERROR menu "
                                f"{menu_id}: {e}"
                            )

                except Exception as e:

                    print(
                        f"    ERROR date "
                        f"{date_name}: {e}"
                    )

        except Exception as e:

            print(
                f"ERROR location "
                f"{location_name}: {e}"
            )


    save_output(all_data, all_hours)

    print()
    print("=" * 70)
    print("DONE")
    print("=" * 70)

    print(
        f"Total menus scraped: "
        f"{len(all_data)}"
    )

    print(
        "Saved to "
        f"{OUTPUT_FILE}"
    )


def build_hours_sql(all_hours):

    # SQL that loads the scraped hours ({location: hours}) into dining_halls.hours.
    lines = [
        "-- Weekly hours of operation scraped from NetNutrition "
        "(scraper/netnutrition_scraper.py --export-sql).",
        ""
    ]

    for location, hall_id in HALL_IDS.items():

        if location not in all_hours:
            print(
                f"warning: no hours scraped for {location}",
                file=sys.stderr
            )
            continue

        payload = json.dumps(
            all_hours[location],
            separators=(",", ":")
        ).replace("'", "''")

        lines.append(
            f"update public.dining_halls "
            f"set hours = '{payload}'::jsonb "
            f"where id = '{hall_id}';"
        )

    return "\n".join(lines) + "\n"


def export_sql(path):

    with open(path, encoding="utf-8") as f:
        saved = json.load(f)

    if not isinstance(saved, dict) or "hours" not in saved:
        sys.exit(f"{path} has no hours; run with --hours-only first")

    sys.stdout.write(build_hours_sql(saved["hours"]))


def main(hours_only=False):

    global driver, wait

    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)

    try:
        if hours_only:
            scrape_hours()

        else:
            scrape()

    finally:
        driver.quit()


if __name__ == "__main__":

    # python netnutrition_scraper.py                       scrape menus and hours into the JSON file
    # python netnutrition_scraper.py --hours-only          refresh only the hours in the JSON file
    # python netnutrition_scraper.py --export-sql [json]   print SQL for dining_halls.hours from the JSON file
    if len(sys.argv) > 1 and sys.argv[1] == "--export-sql":
        export_sql(sys.argv[2] if len(sys.argv) > 2 else OUTPUT_FILE)

    else:
        main(hours_only="--hours-only" in sys.argv[1:])

import json
import re
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


URL = "https://netnutrition.cbord.com/nn-prod/vucampusdining#"

driver = webdriver.Chrome()
wait = WebDriverWait(driver, 10)


# ============================================================
# LOCATIONS
# ============================================================

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


# ============================================================
# SELECT LOCATION
# ============================================================

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

    # Directly trigger NetNutrition's own handler
    driver.execute_script(
        "NetNutrition.UI.handleNavBarSelection(arguments[0]);",
        el
    )

    # Wait until the date selector is rebuilt
    wait.until(
        lambda d: len(
            d.find_elements(
                By.CSS_SELECTOR,
                '#nav-date-selector a[data-type="DT"]'
            )
        ) > 0
    )

    return name


# ============================================================
# GET DATES
# ============================================================

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


# ============================================================
# SELECT DATE
# ============================================================

def select_date(date_value):

    selector = (
        '#nav-date-selector '
        f'a[data-type="DT"][data-date="{date_value}"]'
    )

    # IMPORTANT:
    # Find the date AGAIN immediately before clicking it.
    # This avoids using a stale element from a previous page state.
    el = wait.until(
        EC.presence_of_element_located(
            (By.CSS_SELECTOR, selector)
        )
    )

    date_name = el.get_attribute("title")

    print(f"    Selecting date: {date_name}")

    # Scroll it into view
    driver.execute_script(
        """
        arguments[0].scrollIntoView({
            block: 'center'
        });
        """,
        el
    )

    # Trigger the exact NetNutrition handler
    driver.execute_script(
        "NetNutrition.UI.handleNavBarSelection(arguments[0]);",
        el
    )

    # --------------------------------------------------------
    # DO NOT WAIT FOR cbo_nn_HeaderSelectedDate
    #
    # That header is not reliable enough.
    #
    # Instead, wait for NetNutrition's menu results to update.
    # --------------------------------------------------------

    time.sleep(0.5)

    return date_name


# ============================================================
# GET MENUS
# ============================================================

def get_menus(date_name):

    # Give NetNutrition a moment to populate results
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

        # Example:
        # Wednesday, September 30, 2026-Lunch

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

    # Remove duplicate menus
    unique = {}

    for menu in menus:
        unique[menu["menu_id"]] = menu

    return list(unique.values())


# ============================================================
# LOAD MENU
# ============================================================

def load_menu(unit_id, menu_id):

    driver.execute_script(
        f"""
        NetNutrition.UI.menuListSelectUnitAndMenu(
            {unit_id},
            {menu_id}
        );
        """
    )

    # Wait for food rows
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


# ============================================================
# SCRAPE FOOD NAME + CATEGORY
# ============================================================

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

        # ----------------------------------------------------
        # CATEGORY
        # ----------------------------------------------------

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

        # ----------------------------------------------------
        # FOOD
        # ----------------------------------------------------

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


# ============================================================
# SAVE
# ============================================================

def save_data(data):

    with open(
        "vanderbilt_all_menus.json",
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            data,
            f,
            indent=2,
            ensure_ascii=False
        )


# ============================================================
# MAIN
# ============================================================

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

    # ========================================================
    # LOCATIONS
    # ========================================================

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

            # ------------------------------------------------
            # SELECT LOCATION
            # ------------------------------------------------

            select_location(unit_id)

            # ------------------------------------------------
            # GET DATES
            # ------------------------------------------------

            dates = get_dates()

            print(
                f"  Found {len(dates)} dates"
            )

            # =================================================
            # DATES
            # =================================================

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

                    # =================================================
                    # RESET TO LOCATION
                    # =================================================
                    #
                    # After loading a menu, NetNutrition is no longer
                    # in the clean date-selector state.
                    #
                    # So re-select the location before every date.
                    # =================================================

                    select_location(unit_id)

                    # ------------------------------------------------
                    # GET FRESH DATE ELEMENTS
                    # ------------------------------------------------

                    current_dates = get_dates()

                    # Find requested date again
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

                    # ------------------------------------------------
                    # SELECT DATE
                    # ------------------------------------------------

                    selected_date = select_date(
                        date_value
                    )

                    # ------------------------------------------------
                    # GET MENUS
                    # ------------------------------------------------

                    menus = get_menus(
                        selected_date
                    )

                    print(
                        f"    Found {len(menus)} menus"
                    )

                    # ------------------------------------------------
                    # MENUS
                    # ------------------------------------------------

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

                            # Load menu
                            load_menu(
                                menu_unit_id,
                                menu_id
                            )

                            # Only get:
                            # food name
                            # category
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

                            # Save continuously
                            save_data(all_data)

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

    # ========================================================
    # DONE
    # ========================================================

    save_data(all_data)

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
        "vanderbilt_all_menus.json"
    )


# ============================================================
# RUN
# ============================================================

try:
    scrape()

finally:
    driver.quit()
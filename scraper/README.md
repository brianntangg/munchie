# Vanderbilt dining scraper

`netnutrition_scraper.py` is a standalone Selenium script that opens Vanderbilt's
NetNutrition site in Chrome and collects menu items by location, date, and meal.
It is not called by the mobile app or imported into Supabase. The checked-in
`vanderbilt_all_menus.json` is a snapshot, not a live menu feed.

## Run separately from the app

Requirements: Python 3, Chrome, Selenium, and network access. Use a virtual
environment outside the repository if you do not want local Python environment
files in the working tree. For example, on macOS/Linux:

```sh
python3 -m venv /tmp/munchie-scraper-venv
source /tmp/munchie-scraper-venv/bin/activate
python -m pip install selenium
```

No pinned Python dependency file is currently provided. Selenium Manager may
need network access to obtain a matching browser driver; see the
[official Selenium Manager documentation](https://www.selenium.dev/documentation/selenium_manager/).

From the repository root:

```sh
cd scraper
python netnutrition_scraper.py
```

The script writes `vanderbilt_all_menus.json` in the **current working directory**
and overwrites it as results accumulate. Running in `scraper` replaces the tracked
snapshot, so inspect the diff before committing. To keep that snapshot intact,
run the script by absolute path from a separate output directory instead.

## Output and limitations

The checked-in `vanderbilt_all_menus.json` is an older snapshot: a bare list of menu records with no
hours. Running the scraper, or `--hours-only`, rewrites it in the shape below (keeping any saved menus).

The output file has two keys:

- `menus`: one record per menu, with `location`, `unit_id`, `date`, `date_value`, `meal`,
  `menu_id`, and `items`; each item has a `name` and `category`.
- `hours`: weekly hours of operation for every location, keyed by location name, from
  NetNutrition's "Hours of Operation" dialog, as `{"Monday": [["07:00", "15:00"]], ...}` with
  24-hour times, one entry per split shift, and an empty list for a closed day. A close time at or
  before the open time means the shift ends after midnight. A location with no menus published
  right now still has hours. A location whose dialog could not be read is left out.

The output does not include complete nutrition/allergen data or populate app ratings or
dining-hall records.

The scraper reselects locations and date elements because NetNutrition changes
its UI state when menus load. It catches errors at menu/date/location levels and
continues, so an output file may be partial. Check console errors as well as the
file. Changes to the external site's selectors or handlers may require repairs.
Chrome starts only when the script is run as `python netnutrition_scraper.py`, not when the
file is imported.

## Tests

The hours logic (`to_24h`, `parse_hours`, `build_hours_sql`, `load_output`) has pytest tests that
need no browser or network. With `selenium` and `pytest` installed, run from `scraper`:

```sh
python -m pytest
```

CI does not run these yet; it only runs the mobile app's jobs.

## Loading hours into the database

Scraped `hours` reach the app through `dining_halls.hours`. To refresh only hours (about a minute;
the saved `menus` are kept as they are):

```sh
python netnutrition_scraper.py --hours-only
```

Then generate the SQL from the saved file (this does not start Chrome):

```sh
python netnutrition_scraper.py --export-sql [vanderbilt_all_menus.json] > ../supabase/migrations/<timestamp>_hall_hours_data.sql
```

It matches scraper location names to hall IDs (`HALL_IDS` in the script) and warns about any
hall with no scraped hours. Review the SQL, then apply it with `npx supabase db reset` locally.

Hours have an import path (above); menu items still need a mapping/import pipeline before they can power the app.

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
cd Scripts
python netnutrition_scraper.py
```

The script writes `vanderbilt_all_menus.json` in the **current working directory**
and overwrites it as results accumulate. Running in `Scripts` replaces the tracked
snapshot, so inspect the diff before committing. To keep that snapshot intact,
run the script by absolute path from a separate output directory instead.

## Output and limitations

Each menu record contains `location`, `unit_id`, `date`, `date_value`, `meal`,
`menu_id`, and `items`; each item has a `name` and `category`. This does not include
complete nutrition/allergen data or populate app ratings or dining-hall records.

The scraper reselects locations and date elements because NetNutrition changes
its UI state when menus load. It catches errors at menu/date/location levels and
continues, so an output file may be partial. Check console errors as well as the
file. Changes to the external site's selectors or handlers may require repairs.
The script starts Chrome and runs at module load; do not import it as a library.

The documentation/comment cleanup did not rerun the scraper against the live site.
Its output still needs a mapping/import pipeline before it can power the app.

"""Tests for the hours-of-operation logic in netnutrition_scraper.py.

Importing the scraper does not start Chrome, but it does import selenium, so install it first:
    pip install selenium pytest
Run from the scraper directory:  python -m pytest
"""
import json

import pytest

import netnutrition_scraper as scraper
from netnutrition_scraper import DAYS, HALL_IDS, build_hours_sql, load_output, parse_hours, to_24h

RAND, COMMONS = "Rand Dining Center", "The Commons Dining Center"
RAND_ID = HALL_IDS[RAND]


def week(**days):
    """A full week of hours, with every day closed unless given."""
    return {day: days.get(day, []) for day in DAYS}


class TestTo24h:
    @pytest.mark.parametrize(
        "text, expected",
        [
            ("7:00 AM", "07:00"),
            ("3:00 PM", "15:00"),
            ("11:59 PM", "23:59"),
            ("1:05 AM", "01:05"),
            ("10:30 AM", "10:30"),
        ],
    )
    def test_converts_to_24_hour_time(self, text, expected):
        assert to_24h(text) == expected

    def test_midnight_is_00_and_noon_is_12(self):
        assert to_24h("12:00 AM") == "00:00"
        assert to_24h("12:30 AM") == "00:30"
        assert to_24h("12:00 PM") == "12:00"
        assert to_24h("12:45 PM") == "12:45"

    def test_ignores_case_and_surrounding_spaces(self):
        assert to_24h("  8:15 pm ") == "20:15"
        assert to_24h("8:15 Pm") == "20:15"

    @pytest.mark.parametrize(
        "text",
        [
            "",
            "Closed",
            "7 AM",  # no minutes
            "7:00",  # no AM/PM
            "07:00 XM",
            "13:00 PM",  # not on a 12-hour clock
            "0:30 AM",
            "7:75 AM",  # no such minute
            "99:99 PM",
        ],
    )
    def test_rejects_anything_that_is_not_a_12_hour_time(self, text):
        with pytest.raises(ValueError):
            to_24h(text)


class TestParseHours:
    def test_always_returns_all_seven_days_in_order(self):
        assert list(parse_hours([])) == DAYS

    def test_a_day_with_no_rows_is_closed(self):
        hours = parse_hours([["Monday", "7:00 AM", "3:00 PM"]])
        assert hours["Monday"] == [["07:00", "15:00"]]
        assert hours["Tuesday"] == []

    def test_a_closed_row_leaves_the_day_empty(self):
        # NetNutrition renders a closed day as just ["Saturday", "Closed"].
        assert parse_hours([["Saturday", "Closed"]])["Saturday"] == []

    def test_keeps_split_shifts_and_sorts_them_by_opening_time(self):
        # The site lists Friday's 4 PM dinner before its 7 AM breakfast.
        hours = parse_hours([["Friday", "4:00 PM", "8:00 PM"], ["Friday", "7:00 AM", "3:00 PM"]])
        assert hours["Friday"] == [["07:00", "15:00"], ["16:00", "20:00"]]

    def test_keeps_a_shift_that_ends_after_midnight_as_scraped(self):
        # A close at or before the open means the shift runs past midnight; the app interprets that.
        assert parse_hours([["Friday", "6:00 PM", "12:30 AM"]])["Friday"] == [["18:00", "00:30"]]

    def test_ignores_rows_for_unknown_days(self):
        hours = parse_hours([["Funday", "7:00 AM", "3:00 PM"], ["Holiday hours", "9:00 AM", "1:00 PM"]])
        assert all(shifts == [] for shifts in hours.values())

    def test_ignores_blank_rows(self):
        assert parse_hours([[], [""]]) == week()

    def test_rejects_a_row_with_an_unreadable_time(self):
        with pytest.raises(ValueError):
            parse_hours([["Monday", "soon", "3:00 PM"]])

    def test_matches_a_real_week(self):
        rows = [
            ["Monday", "7:00 AM", "3:00 PM"],
            ["Tuesday", "7:00 AM", "3:00 PM"],
            ["Wednesday", "7:00 AM", "3:00 PM"],
            ["Thursday", "7:00 AM", "3:00 PM"],
            ["Friday", "4:00 PM", "8:00 PM"],
            ["Friday", "7:00 AM", "3:00 PM"],
            ["Saturday", "8:00 AM", "8:00 PM"],
            ["Sunday", "8:00 AM", "8:00 PM"],
        ]
        hours = parse_hours(rows)
        assert hours["Sunday"] == [["08:00", "20:00"]]
        assert hours["Friday"] == [["07:00", "15:00"], ["16:00", "20:00"]]


class TestBuildHoursSql:
    def statements(self, sql):
        return [line for line in sql.splitlines() if line.startswith("update ")]

    def test_writes_one_update_per_hall_with_the_hall_id(self):
        sql = build_hours_sql({RAND: week(Monday=[["07:00", "15:00"]]), COMMONS: week()})
        updates = self.statements(sql)
        assert len(updates) == 2
        assert updates[0].startswith("update public.dining_halls set hours = '")
        assert updates[0].endswith(f"'::jsonb where id = '{RAND_ID}';")
        assert f"where id = '{HALL_IDS[COMMONS]}';" in updates[1]

    def test_the_hours_in_the_sql_round_trip(self):
        hours = week(Monday=[["07:00", "15:00"]], Friday=[["07:00", "15:00"], ["16:00", "20:00"]])
        update = self.statements(build_hours_sql({RAND: hours}))[0]
        payload = update.split("set hours = '", 1)[1].split("'::jsonb", 1)[0]
        assert json.loads(payload) == hours

    def test_escapes_single_quotes_so_the_sql_stays_valid(self):
        update = self.statements(build_hours_sql({RAND: {"Note": "it's closed"}}))[0]
        assert "it''s closed" in update

    def test_warns_about_a_hall_with_no_hours_and_skips_it(self, capsys):
        sql = build_hours_sql({RAND: week()})
        assert len(self.statements(sql)) == 1
        warned = capsys.readouterr().err
        assert "no hours scraped for Zeppos Dining" in warned
        assert "Rand Dining Center" not in warned

    def test_ignores_locations_that_are_not_dining_halls(self):
        sql = build_hours_sql({RAND: week(), "VandyBlenz": week(), "Wasabi": week()})
        assert len(self.statements(sql)) == 1
        assert "VandyBlenz" not in sql

    def test_with_nothing_scraped_it_writes_only_the_header(self, capsys):
        sql = build_hours_sql({})
        assert self.statements(sql) == []
        assert sql.startswith("-- Weekly hours of operation")
        assert capsys.readouterr().err.count("no hours scraped") == len(HALL_IDS)


class TestLoadOutput:
    @pytest.fixture(autouse=True)
    def in_temp_dir(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)

    def test_a_missing_file_means_nothing_saved_yet(self):
        assert load_output() == ([], {})

    def test_reads_menus_and_hours_from_the_current_shape(self, tmp_path):
        (tmp_path / scraper.OUTPUT_FILE).write_text(json.dumps({"hours": {RAND: week()}, "menus": [{"meal": "Lunch"}]}))
        assert load_output() == ([{"meal": "Lunch"}], {RAND: week()})

    def test_reads_the_older_bare_list_of_menus(self, tmp_path):
        (tmp_path / scraper.OUTPUT_FILE).write_text(json.dumps([{"meal": "Lunch"}]))
        assert load_output() == ([{"meal": "Lunch"}], {})


class TestScrapeHours:
    """scrape_hours with the browser and the hours dialog faked out."""

    class FakeDriver:
        def get(self, url):
            pass

    class FakeWait:
        def until(self, condition):
            pass

    @pytest.fixture(autouse=True)
    def fake_browser(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr(scraper, "driver", self.FakeDriver())
        monkeypatch.setattr(scraper, "wait", self.FakeWait())
        monkeypatch.setattr(scraper.time, "sleep", lambda seconds: None)
        monkeypatch.setattr(scraper, "get_locations", lambda: [{"unit_id": 1, "name": RAND}, {"unit_id": 2, "name": COMMONS}])

    def saved(self):
        with open(scraper.OUTPUT_FILE, encoding="utf-8") as f:
            return json.load(f)

    def test_saves_fresh_hours_for_every_location_and_keeps_the_menus(self, monkeypatch, tmp_path):
        (tmp_path / scraper.OUTPUT_FILE).write_text(json.dumps({"hours": {}, "menus": [{"meal": "Lunch"}]}))
        fresh = {1: week(Monday=[["07:00", "15:00"]]), 2: week(Monday=[["08:00", "16:00"]])}
        monkeypatch.setattr(scraper, "get_hours", lambda unit_id: fresh[unit_id])
        scraper.scrape_hours()
        assert self.saved() == {"hours": {RAND: fresh[1], COMMONS: fresh[2]}, "menus": [{"meal": "Lunch"}]}

    def test_a_location_that_fails_keeps_its_saved_hours(self, monkeypatch, tmp_path, capsys):
        old = week(Monday=[["07:00", "15:00"]])
        new = week(Monday=[["09:00", "17:00"]])
        (tmp_path / scraper.OUTPUT_FILE).write_text(json.dumps({"hours": {RAND: old, COMMONS: old}, "menus": []}))
        monkeypatch.setattr(scraper, "get_hours", lambda unit_id: new if unit_id == 1 else None)  # Commons fails
        scraper.scrape_hours()
        assert self.saved()["hours"] == {RAND: new, COMMONS: old}
        assert f"Keeping the saved hours for {COMMONS}" in capsys.readouterr().out

    def test_a_location_that_fails_with_nothing_saved_is_left_out(self, monkeypatch):
        monkeypatch.setattr(scraper, "get_hours", lambda unit_id: week() if unit_id == 1 else None)
        scraper.scrape_hours()
        assert list(self.saved()["hours"]) == [RAND]

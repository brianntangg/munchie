"""Characterization tests: they pin down what calc() does TODAY, right or wrong.
Keep every one green while you refactor. Run:  pytest -q
"""
import pytest

from legacy_pricing import calc

STUDENT_V = {"role": "student", "verified": True}
STUDENT_U = {"role": "student", "verified": False}
STAFF = {"role": "staff"}
ALUM_OLD = {"role": "alumni", "years": 12}
ALUM_NEW = {"role": "alumni", "years": 3}
FIRST = {"role": "student", "verified": True, "first_purchase": True}


@pytest.mark.parametrize("t,d,expected", [
    ("concert", 2, 22.5),   # 20 + fee 2.5
    ("concert", 5, 27.5),   # weekend 25 + 2.5
    ("concert", 6, 27.5),
    ("lecture", 0, 6.0),    # 5 + fee 1
    ("sports", 3, 13.0),    # 12 + 1
    ("sports", 6, 16.0),    # 15 + 1
    ("workshop", 1, 32.5),  # 30 + 2.5
])
def test_base_prices_no_user(t, d, expected):
    assert calc(t, 1, None, d) == expected


@pytest.mark.parametrize("user,expected", [
    (STUDENT_V, 17.0),   # 20*0.8 = 16, under 20 -> fee 1
    (STUDENT_U, 19.0),   # 18 + 1
    (STAFF, 18.0),       # 17 + 1
    (ALUM_OLD, 18.0),    # 17 + 1
    (ALUM_NEW, 20.0),    # 19 + 1
    ({"role": "visitor"}, 22.5),
])
def test_role_discounts_concert_weekday(user, expected):
    assert calc("concert", 1, user, 2) == expected


def test_bulk_discount_not_for_workshops():
    assert calc("concert", 5, None, 2) == 97.5     # 100 - 5 = 95, fee 2.5
    assert calc("workshop", 5, None, 2) == 155.0   # 150, fee 5


def test_welcome_coupon_needs_first_purchase():
    assert calc("concert", 2, FIRST, 2, c="WELCOME10") == 31.3      # 40*.8=32*.9=28.8 + 2.5
    assert calc("concert", 2, STUDENT_V, 2, c="WELCOME10") == 34.5  # 32 + 2.5
    assert calc("concert", 2, None, 2, c="WELCOME10") == 42.5       # 40 + 2.5


def test_halfoff_only_lectures():
    assert calc("lecture", 2, None, 2, c="HALFOFF") == 6.0   # 10*.5=5 + 1
    assert calc("sports", 2, None, 2, c="HALFOFF") == 26.5   # 24 + 2.5


def test_freedrink_changes_nothing():
    assert calc("sports", 1, None, 2, c="FREEDRINK") == 13.0


def test_waitlist_fee():
    assert calc("lecture", 1, None, 2, w=True) == 8.0   # 5 + 2 = 7, fee 1


def test_bulk_discount_applies_before_coupon():
    # order matters: 5 lectures, verified student: 25*.8=20 - 5 = 15, HALFOFF -> 7.5, fee 1
    assert calc("lecture", 5, STUDENT_V, 2, c="HALFOFF") == 8.5


@pytest.mark.parametrize("args", [
    ("party", 1, None, 2),
    ("concert", 0, None, 2),
    ("concert", 11, None, 2),
])
def test_invalid_inputs(args):
    with pytest.raises(ValueError):
        calc(*args)


def test_bad_coupon():
    with pytest.raises(ValueError):
        calc("concert", 1, None, 2, c="FREE100")


def test_fee_bands():
    assert calc("workshop", 3, None, 2) == 92.5     # 90 + 2.5
    assert calc("workshop", 4, None, 2) == 125.0    # 120 + 5

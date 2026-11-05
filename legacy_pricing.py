"""Ticket pricing for CampusEvents -- legacy module (ICA 24A).

This works, and it is tested (see test_legacy_pricing.py), but nobody wants to touch it.
Your job: refactor it without changing behavior, and measure the result with radon.
"""

MAX_QUANTITY = 10
BULK_MIN_QUANTITY = 5
BULK_DISCOUNT = 5.0
WAITLIST_SURCHARGE = 2.0
STUDENT_VERIFIED_MULT = 0.8
STUDENT_UNVERIFIED_MULT = 0.9
STAFF_MULT = 0.85
ALUMNI_LONG_MULT = 0.85
ALUMNI_SHORT_MULT = 0.95
ALUMNI_LONG_YEARS = 10
WELCOME10_MULT = 0.9
HALFOFF_MULT = 0.5
FEE_LOW_LIMIT, FEE_LOW = 20, 1.0
FEE_MID_LIMIT, FEE_MID = 100, 2.5
FEE_HIGH = 5.0


# event type -> (weekday price, weekend price)
BASE_PRICES = {
    "concert": (20.0, 25.0),
    "lecture": (5.0, 5.0),
    "sports": (12.0, 15.0),
    "workshop": (30.0, 30.0),
}
WEEKEND_DAYS = (5, 6)


def base_price(t, d):
    try:
        weekday_price, weekend_price = BASE_PRICES[t]
    except (KeyError, TypeError):
        raise ValueError("bad type")
    return weekend_price if d in WEEKEND_DAYS else weekday_price


def calc(t, q, u, d, c=None, w=False):
    # t = event type, q = quantity, u = user dict, d = day of week (0=Mon..6=Sun),
    # c = coupon code, w = waitlist
    p = base_price(t, d)
    if q <= 0:
        raise ValueError("bad qty")
    if q > MAX_QUANTITY:
        raise ValueError("too many")
    total = p * q
    if u is not None:
        if u.get("role") == "student":
            if u.get("verified"):
                total = total * STUDENT_VERIFIED_MULT
            else:
                total = total * STUDENT_UNVERIFIED_MULT
        elif u.get("role") == "staff":
            total = total * STAFF_MULT
        elif u.get("role") == "alumni":
            if u.get("years", 0) >= ALUMNI_LONG_YEARS:
                total = total * ALUMNI_LONG_MULT
            else:
                total = total * ALUMNI_SHORT_MULT
    if q >= BULK_MIN_QUANTITY:
        if t != "workshop":
            total = total - BULK_DISCOUNT
    if c is not None:
        if c == "WELCOME10":
            if u is not None and u.get("first_purchase"):
                total = total * WELCOME10_MULT
        elif c == "HALFOFF":
            if t == "lecture":
                total = total * HALFOFF_MULT
        elif c == "FREEDRINK":
            pass
        else:
            raise ValueError("bad coupon")
    if w:
        total = total + WAITLIST_SURCHARGE
    if total < 0:
        total = 0.0
    fee = 0.0
    if total > 0:
        if total < FEE_LOW_LIMIT:
            fee = FEE_LOW
        elif total < FEE_MID_LIMIT:
            fee = FEE_MID
        else:
            fee = FEE_HIGH
    return round(total + fee, 2)

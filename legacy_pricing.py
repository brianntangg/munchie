"""Ticket pricing for CampusEvents -- legacy module (ICA 24A).

This works, and it is tested (see test_legacy_pricing.py), but nobody wants to touch it.
Your job: refactor it without changing behavior, and measure the result with radon.
"""


def calc(t, q, u, d, c=None, w=False):
    # t = event type, q = quantity, u = user dict, d = day of week (0=Mon..6=Sun),
    # c = coupon code, w = waitlist
    p = 0
    if t == "concert":
        if d == 5 or d == 6:
            p = 25.0
        else:
            p = 20.0
    elif t == "lecture":
        p = 5.0
    elif t == "sports":
        if d == 5 or d == 6:
            p = 15.0
        else:
            p = 12.0
    elif t == "workshop":
        p = 30.0
    else:
        raise ValueError("bad type")
    if q <= 0:
        raise ValueError("bad qty")
    if q > 10:
        raise ValueError("too many")
    total = p * q
    if u is not None:
        if u.get("role") == "student":
            if u.get("verified"):
                total = total * 0.8
            else:
                total = total * 0.9
        elif u.get("role") == "staff":
            total = total * 0.85
        elif u.get("role") == "alumni":
            if u.get("years", 0) >= 10:
                total = total * 0.85
            else:
                total = total * 0.95
    if q >= 5:
        if t != "workshop":
            total = total - 5.0
    if c is not None:
        if c == "WELCOME10":
            if u is not None and u.get("first_purchase"):
                total = total * 0.9
        elif c == "HALFOFF":
            if t == "lecture":
                total = total * 0.5
        elif c == "FREEDRINK":
            pass
        else:
            raise ValueError("bad coupon")
    if w:
        total = total + 2.0
    if total < 0:
        total = 0.0
    fee = 0.0
    if total > 0:
        if total < 20:
            fee = 1.0
        elif total < 100:
            fee = 2.5
        else:
            fee = 5.0
    return round(total + fee, 2)

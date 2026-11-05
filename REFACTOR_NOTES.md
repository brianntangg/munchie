# REFACTOR_NOTES — Legacy Pricing Module

## Worksheet 1 — Understanding

| Question | Answer |
|---|---|
| What do t, q, u, d, c, w mean? | `t` event type (concert, lecture, sports, workshop). `q` ticket quantity, must be 1–10. `u` user dict or `None` with `role`, `verified`, `years`, `first_purchase`. `d` day of week, 0=Mon..6=Sun; only 5 and 6 (weekend) change the price. `c` optional coupon code. `w` waitlist flag. |
| In what order are discounts applied? Does the order matter? | Base price × `q`, then role multiplier, then flat $5 bulk discount (`q >= 5`, not workshops), then coupon, then +$2 waitlist surcharge, then fee band, then round. Yes, order matters: a flat amount and percentages don't commute, and `test_bulk_discount_applies_before_coupon` pins bulk before coupon. The waitlist surcharge comes after the coupon so it is never discounted; the fee is computed on the final total. |
| Which code can never run? How do you know? | The `if total < 0: total = 0.0` clamp. A brute-force run of 20,160 combinations of type, quantity, user, day, coupon and waitlist gave a minimum pre-clamp total of 2.0 (verified student, 1 lecture ticket, HALFOFF). So `if total > 0` before the fee is always true and the initial `fee = 0.0` is never used. |
| What looks like a bug but is pinned by a test? | Unknown role ("visitor") gets no discount and no error. WELCOME10 silently does nothing without `first_purchase`. HALFOFF silently does nothing on non-lectures. FREEDRINK is accepted and does nothing. |

Also preserved but NOT pinned by any test (tests only use `q=5` and `q=1`): the bulk discount is a flat $5 for any `q` from 5 to 10, and the waitlist surcharge is a flat $2, not per ticket. Unverified or missing `verified` gives students 10% off; missing `years` counts as under 10 for alumni; `d` is not validated; a non-integer `q` is accepted.

## Worksheet 2 — Refactoring Log

All steps were done by Claude (AI) and read and checked by diff before committing. After every step: `pytest -q test_legacy_pricing.py` and an equivalence check of old vs new `calc()` on 72,072 inputs (including invalid types, quantities, coupons and days), comparing return values and exceptions.

| # | Refactoring | AI or by hand? | Tests after | Kept or reverted? Why |
|---|---|---|---|---|
| 1a | Replace magic numbers with constants (scripted find/replace) | AI | not run | Reverted: the diff read showed a mangled name (`STUDENT_VERIFIED_MULT5`) and one leftover `0.9`; the replace of `* 0.8` also matched the start of `* 0.85` |
| 1b | Name magic numbers as constants (redone with asserted single-match replacements) | AI | pass | Kept |
| 2 | Extract `base_price(t, d)` using a price table | AI | pass | Kept. Catches `TypeError` too so an unhashable `t` still raises `ValueError("bad type")` |
| 3 | Extract `validate_quantity(q)` | AI | pass | Kept |
| 4 | Extract `role_multiplier(u)` | AI | pass | Kept. Returns `1.0` for no discount; multiplying by 1.0 is exact in floats |
| 5 | Extract `bulk_discount(t, q)` | AI | pass | Kept |
| 6 | Extract `apply_coupon(c, t, u, total)` | AI | pass | Kept |
| 7 | Extract `fee_for(total)` | AI | pass | Kept |
| 8 | Remove unreachable `total < 0` clamp and `total > 0` guard | AI | pass | Kept. Justified by the brute-force check in Worksheet 1 |

## Worksheet 3 — Before and After (radon)

| Measure | Before | After |
|---|---|---|
| Highest function CC (grade) | calc: E (31) | apply_coupon: B (8); calc: A (2) |
| Average CC | 31.0 | 4.14 (A) |
| Number of functions | 1 | 7 |
| Maintainability index (radon mi) | A (53.94) | A (53.66) |
| Lines of code (radon raw: SLOC) | 63 | 81 |
| Tests passing | 24 / 24 | 24 / 24 |

Notes on the numbers: complexity dropped sharply because each branch group now lives in its own small function, but the total code grew (SLOC 63 to 81) because of the constants and function headers. The maintainability index is essentially unchanged (it is a per-file number, and it dipped slightly because the file got longer), so CC is the more informative measure here. The 24-test suite remains the same and unmodified.

## Trade-offs

- Dead code (`total < 0` clamp) was removed because it is provably unreachable for the inputs the function accepts. If `calc` ever gains a way to produce negative totals (new coupon types, larger flat discounts), the clamp would need to come back.
- Quirks that look like bugs (silent coupon no-ops, unknown roles getting no discount, flat bulk discount and waitlist surcharge) were deliberately preserved. Fixing them is a separate decision.
- The existing tests are weaker than the code: they would not catch a change from a flat $5 bulk discount to a per-ticket one, or a per-ticket waitlist fee. The old-vs-new equivalence check covered this gap during the refactor, but it is not part of the repo.
- The constants make values easy to find but one-use names such as `FEE_LOW_LIMIT` add indirection; a table of fee bands would be a reasonable next step.

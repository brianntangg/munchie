# ICA — Refactor the Legacy Pricing Module

**Prerequisite:** Python 3.12, pip install pytest radon

## Learning Goals

- Refactor in small, behavior-preserving steps, running the tests after every step.
- Use an AI assistant for one refactoring at a time and verify each suggestion with tests and a diff read.
- Measure complexity and maintainability with radon before and after, and interpret the numbers.
- Document trade-offs, including behavior that looks wrong but must be preserved for now.
- Teams that finish early should apply the same loop to the most complex function in their own project.

## Before Class

- Starter files: legacy_pricing.py, test_legacy_pricing.py (24 tests, all passing), README.md.
- Verified: pytest -q → 24 passed; radon cc -s legacy_pricing.py → calc - E (31); radon mi -s → A (53.94).

## Group Roles

- Pair A — prices and quantity validation (base price, role multiplier).
- Pair B — discounts, coupons, fees.
- Navigator — owns main of the refactor branch: merges the pairs' green steps, re-runs tests and radon, records the worksheet.
- Swap driver and navigator inside each pair every 8 minutes.

## The 40 Minutes

| Time | Phase | What happens |
|---|---|---|
| 0:00 – 0:05 | Baseline | Run the tests and radon (cc and mi). Read calc() together and write in Worksheet 1 what each parameter means and any behavior that looks surprising. |
| 0:05 – 0:10 | Plan | List 5–7 refactoring steps (rename, extract function, replace conditional with table, introduce parameter object...). Split by pair. Agree: the public calc(t, q, u, d, c=None, w=False) signature stays. |
| 0:10 – 0:30 | Refactor loop | One step per prompt to the assistant ("Extract the coupon logic into a function. Do not change behavior or the public signature."). Read the diff, run pytest -q, commit if green, revert if red. Log every step in Worksheet 2. |
| 0:30 – 0:35 | Measure | radon cc -s and radon mi -s on the result. Fill Worksheet 3. |
| 0:35 – 0:40 | Trade-offs | Answer the trade-off questions and the debrief. Push the branch. |

## Starter: The Function (first lines)

```python
Radon cc -def calc(t, q, u, d, c=None, w=False):
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
    ...   # 60 more lines: roles, bulk discount, coupons, waitlist, fee bands
```

## Rules

- Never change a test's expected value. If you think a behavior is a bug, write it in Worksheet 1; fixing it is a separate decision.
- Never accept an AI change you have not read and run.
- Commit after every green step (git commit -am "refactor: extract coupon_multiplier") so you can roll back one move.

## Worksheet 1 — Understanding (before changing anything)

| Question | Answer |
|---|---|
| What do t, q, u, d, c, w mean? | t is the event type (concert, lecture, sports or workshop). q is the ticket quantity, which must be 1–10. u is a user dict (or None) with role, verified, years and first_purchase. d is the day of week, 0=Mon to 6=Sun, and only 5 and 6 (weekend) change the price. c is an optional coupon code. w is the waitlist flag. |
| In what order are discounts applied? Does the order matter? | The order is: base price × q, then the role multiplier, then the flat $5 bulk discount (q >= 5, not workshops), then the coupon, then the +$2 waitlist surcharge, then the fee band. Yes, the order matters. A flat $5 and percentages don't commute, and test_bulk_discount_applies_before_coupon pins bulk before coupon. The waitlist surcharge comes after the coupon, so it is never discounted. The fee is based on the final total. |
| Which code can never run? How do you know? | The if total < 0: total = 0.0 clamp can never run. A brute-force run of 20,160 combinations of type, quantity, user, day, coupon and waitlist gave a smallest pre-clamp total of 2.0, which is never negative. As a result, if total > 0 before the fee is always true, and the initial fee = 0.0 is never used. |
| What looks like a bug but is pinned by a test? | An unknown role ("visitor") gets no discount and no error. WELCOME10 silently does nothing unless first_purchase is set. HALFOFF silently does nothing on non-lectures. FREEDRINK is accepted but has no effect. All four are pinned by tests. |

*Note.* It isn't pinned by tests but must be preserved. The bulk discount is a flat $5 for any q from 5 to 10. The waitlist surcharge is a flat $2, not per ticket. The tests only use q=5 and q=1, so a refactor that changed either would still pass.

## Worksheet 2 — Refactoring Log

| # | Refactoring (name it) | AI or by hand? | Tests after (pass / fail) | Kept or reverted? Why |
|---|---|---|---|---|
| 1 | Replace magic numbers with named constants (first attempt, scripted find/replace) | By hand | Not run | Reverted. Reading the diff showed a mangled name (STUDENT_VERIFIED_MULT5) and a leftover 0.9. |
| 2 | Name magic numbers as constants (redone with strict single-match replacements) | AI | Pass | Kept. The diff is clean and behavior is identical. |
| 3 | Extract function base_price(t, d), replacing the if/elif chain with a price table | AI | Pass | Kept. It also catches TypeError so a bad type still raises ValueError("bad type"). |
| 4 | Extract function validate_quantity(q) | AI | Pass | Kept. The error messages and the order of checks are unchanged. |
| 5 | Extract function role_multiplier(u) | AI | Pass | Kept. Returning 1.0 for "no discount" doesn't change any result. |
| 6 | Extract function bulk_discount(t, q) | AI | Pass | Kept. It runs before the coupon, as before. |
| 7 | Extract function apply_coupon(c, t, u, total) | AI | Pass | Kept. The silent no-ops for unmet coupon conditions are preserved. |
| 8 | Extract function fee_for(total) | AI | Pass | Kept. The band boundaries are unchanged. |
| 9 | Remove dead code (the total < 0 clamp and the total > 0 guard) | AI | Pass | Kept. The brute-force check showed the smallest total is 2.0, so these branches can never run. |

## Worksheet 3 — Before and After (radon)

| Measure | Before | After |
|---|---|---|
| Highest function CC (grade) | calc: E (31) | apply_coupon: B (8); calc: A (2) |
| Average CC | 31.0 | 4.14 (A) |
| Number of functions | 1 | 7 |
| Maintainability index (radon mi) | A (53.94) | A (53.66) |
| Lines of code (radon raw: SLOC) | 63 | 81 |
| Tests passing | 24 / 24 | 24/24, unmodified |

## Trade-offs

- Dead code was removed because it is provably unreachable for the inputs calc accepts. If calc ever gains a way to produce negative totals, such as a new coupon type or a larger flat discount, the clamp would need to come back.
- Behavior that looks like a bug was deliberately preserved, including the silent coupon no-ops, unknown roles getting no discount, and the flat $5 bulk discount and flat $2 waitlist surcharge. Fixing these is a separate decision.
- The existing tests are weaker than the code. They would not catch the bulk discount becoming per-ticket or the waitlist fee becoming per-ticket, because they only use q=5 and q=1. An old-versus-new comparison on 72,072 inputs covered that gap during the refactor, but it is not part of the repo.
- Complexity dropped sharply (E 31 to A 2 for calc), but the file grew from 63 to 81 SLOC and the maintainability index barely moved (53.94 to 53.66). The named constants make values easy to find but add indirection. A table of fee bands would be a reasonable next step.

## Submit

- Push the refactor branch with all tests green; include the filled worksheet as REFACTOR_NOTES.md.
- One member posts the branch link on Brightspace.

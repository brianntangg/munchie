# Test Plan — Munchie            Sprint 3   Owner: Brian Tang (Test Lead)

## Baseline (2026-10-08)       tests: 9 + 1 passing, branch coverage: not measured

| | |
| --- | --- |
| Tests / passing | 9/9 pgTAP database tests ([membership.test.sql](supabase/tests/database/membership.test.sql)); 1/1 backend integration script ([test-backend.mjs](apps/mobile/scripts/test-backend.mjs) + [test-product-model.mjs](apps/mobile/scripts/test-product-model.mjs), 56 assert statements, stops at first failure) |
| Branch coverage (total) | Not measurable: no unit test runner or coverage tool is installed. Effective app coverage from unit tests is 0%. |
| Least-covered module | [src/lib/posts.ts](apps/mobile/src/lib/posts.ts), 0%. The integration script calls Supabase directly, so none of the app's own functions (`publishPost`, `loadPosts`, `loadPost`) run under test. |
| Test levels today | Integration (pgTAP, backend script) and manual E2E ([testing.md](docs/testing.md) checklist). No unit tests. CI runs only lint and typecheck. |

## Targets

- **Enforced in CI:** branch and line coverage >= 50% on `apps/mobile/src/lib/**` (Sprint 3 plan). A pull request below the threshold fails CI.
- **Goal:** >= 80% on `src/lib/posts.ts` (core module) and on each new logic file in `src/lib`.
- Review the threshold at the end of Sprint 3 and raise it to the coverage the team actually reached.
- Excluded from the coverage denominator: generated `database.types.ts`, `auth.tsx` (a React provider; see Not testing), and screens/components in `src/app` and `src/components`.
- **Rule that keeps the target honest:** new logic goes into `src/lib` as plain functions that screens call. That includes rating validation, the paging cursor and page merge, auto-refresh timing, and scraper parsing. Screens stay thin, and the logic that can break is the logic we measure.
- Tools: Jest (`jest-expo` preset) for unit tests and coverage; pgTAP and the backend tests for integration.
- CI runs unit tests with coverage on every PR; integration tests join CI in Week 2 (Supabase CLI job).

## Priorities (from risk map)

Likelihood: complex logic, external services, new code score higher. Impact: data loss, privacy, the core journey score higher.

| Feature / user story | L | I | Priority | Unit | Integration | E2E | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create food post with photo (Story 4) | 3 | 3 | **9** | Y | Y (exists; extend to run `posts.ts`) | Y | Brian Tang |
| Sign in with Vanderbilt email code (Stories 1–3) | 2 | 3 | **6** | – | Y (extend with EP/BVA) | Y | Brian Tang |
| Submit a rating (Story 7, new) | 3 | 2 | **6** | Y (when built) | Y (when built) | – | David Lee (backend), Justin Kong (UI) |
| Feed paging and auto-refresh (Stories 5–6) | 3 | 2 | **6** | Y (auto-refresh when built) | Y | – | Tevin Park |
| Dining menu info from scraper (Story 15) | 3 | 2 | **6** | Y (after parser refactor) | Y (saved HTML, no live site) | – | Tevin Park |
| Dining hall open/closed status (new) | 2 | 2 | 4 | Y | – | – | Justin Kong |
| Food by dining location (Story 14) | 1 | 2 | 2 | Y | Y (exists) | – | David Lee |

Owners make sure their feature is tested; feature authors write the tests for their own code. The Test Lead keeps the plan current and the CI that runs every test.

Why these scores:

- **Posting (9):** the most complex code we have (5 MB limit, retry without duplicates, re-upload after a 409, photo cleanup), and it is the core journey. Bugs here lose users' photos or duplicate posts.
- **Sign-in (6):** logic is small and mostly enforced by the database, but a bug either locks students out or lets non-Vanderbilt users read private content.
- **Rating (6):** new code with input rules (score range, one rating per user per dish). Wrong scores corrupt averages, but nothing is lost permanently.
- **Paging and auto-refresh (6):** the cursor is a hand-built filter string with tie-breaking on `created_at`, and pages are appended in [Feed.tsx](apps/mobile/src/components/Feed.tsx) without deduplication; auto-refresh is not built yet. Bugs show duplicate or missing posts.
- **Scraper (6):** depends on a third-party site's HTML, which can change without warning. Wrong menus mislead students, but menus are informational (see non-goals in [product-vision.md](docs/product-vision.md)).
- **Open/closed status (4):** time logic with edge cases (hours that cross midnight, the moment of opening and closing). A wrong answer sends students to a closed hall, but nothing is lost. Pure functions make it easy to unit-test.
- **Food by location (2):** a single equality filter that integration tests already cover.

**Dependency:** rating a dish (Story 7) needs a menu-items table, which the scraper (Story 15) fills. Build and test Story 15's menu data first; until then, rating tests use seeded menu items.

## Integration seams to test

- App `src/lib/posts.ts` → supabase-js → Storage upload → `posts` insert policy (photo must exist, path must match author and post ID). Requires running `posts.ts` in Node: tests must stub the Expo-only `expo-sqlite/localStorage/install` import in [supabase.ts](apps/mobile/src/lib/supabase.ts) or pass in their own client.
- Supabase Auth OTP → `require_campus_email` trigger → `private.is_member()` → every RLS policy
- Storage delete policy ↔ `posts` table (only unpublished uploads can be removed)
- Scraper → NetNutrition (external, replaced by saved HTML in tests) → menus table
- App → ratings table (score constraint and one-rating-per-user rule enforced by the database)

## Critical E2E journeys (max 3)

Manual for now (checklist in [testing.md](docs/testing.md)); run in browser and on a physical phone.

1. Sign in with a `@vanderbilt.edu` code → choose display name → land on feed
2. Create a post (photo + hall + caption) → appears in feed and on that hall's page → a second account sees it after refresh
3. Sign out → protected screens are unreachable, including via back navigation

## Not testing (and why)

- **React Native screens, components and `auth.tsx`:** thin UI over `src/lib`; no React Native test renderer is set up. Covered by the manual E2E journeys. Logic found in them moves to `src/lib` (see Targets).
- **Email delivery and the OTP mechanism itself:** provided by Supabase Auth. We test our domain rule and use the local captured inbox.
- **Camera and photo picker:** native Expo modules; checked manually on a phone.
- **The live NetNutrition site:** we will not run tests against it (slow, flaky, and not ours). Scraper tests use saved HTML pages, which first requires moving parsing out of the Selenium code (the script currently launches Chrome on import).
- **Generated `database.types.ts`:** generated by the Supabase CLI; typecheck covers it.
- **Hosted deployment:** not deployed yet.

## How to run

```sh
# Unit (apps/mobile; added with the Jest setup PR)
npm test
# Integration (local Supabase must be running: npx supabase start)
npx supabase test db                 # from repo root
npm run test:backend                 # from apps/mobile
# Coverage
npm test -- --coverage               # Jest coverage, scoped to src/lib
```

## Work order

Each item is one small pull request. Owner: Brian Tang unless noted.

### Week 1 (Oct 13)

1. Pull request workflow: PR template, CODEOWNERS, CI badge.
2. Align this test plan with the Sprint 3 plan.
3. Campus email boundary tests (pgTAP); update the Worksheet 3 table.
4. Jest setup with `publishPost` unit tests, run in CI on every pull request.

### Week 2 (Oct 20)

1. Integration job in CI: start local Supabase, run pgTAP and backend tests.
2. Split the backend integration script into individually reported Jest tests (at least six integration tests).
3. Enforce the 50% coverage threshold in CI.
4. Publish a web build artifact on every merge to `main`.

### Feature owners, as their stories land

Open/closed unit tests (Justin), rating constraint and failure-path tests (David), rating UI integration test (Justin), feed refresh tests and scraper parser tests on saved HTML (Tevin), hall-filter integration test (David).

---

## Appendix: EP and BVA on one real function

**Function:** `private.require_campus_email()` ([sprint2.sql:19](supabase/migrations/20260929000000_sprint2.sql#L19))
**Rule:** an account email must be exactly `<local>@vanderbilt.edu`: one `@`, a non-empty local part with no whitespace, domain matched case-insensitively, no subdomains or suffixes. Applies on insert and on email change.

| Partition | Expected | Representative | Boundary values | Test written? |
| --- | --- | --- | --- | --- |
| Valid campus address | Accept | `alice@vanderbilt.edu` | 1-char local part `a@vanderbilt.edu` | Representative only |
| Different letter case | Accept | `Alice@VANDERBILT.EDU` | `a@Vanderbilt.Edu` | N |
| Other domain | Reject | `outsider@example.com` | `a@vanderbilt.ed` | Representative only |
| Subdomain | Reject | `a@mail.vanderbilt.edu` | `a@.vanderbilt.edu` | N |
| Look-alike suffix | Reject | `a@vanderbilt.edu.evil.com` | `a@vanderbilt.educ`, `a@vanderbiltXedu` (unescaped dot) | N |
| Empty local part | Reject | `@vanderbilt.edu` | — | N |
| Whitespace | Reject | `a b@vanderbilt.edu` | `a@vanderbilt.edu` followed by a trailing space | N |
| Multiple `@` | Reject | `a@b@vanderbilt.edu` | — | N |
| Email changed to outside domain | Reject | update to `outside@example.com` | — | Y (existing) |

Second candidate for a unit-level EP/BVA: `publishPost` photo size, where 5,242,880 bytes is accepted and 5,242,881 is rejected (matches the storage bucket limit).

## Appendix: group debrief

- **Riskier than we assumed:** photo posting. The retry, 409 handling and cleanup logic in `publishPost` is the most complex code we have, and no automated test runs it; the integration script exercises the database directly instead of our app functions.
- **Suite shape today:** an ice-cream cone without a base: integration tests and a manual E2E checklist, no unit tests.
- **First test tomorrow:** the campus email boundary tests above (pgTAP, runs today), then `publishPost` returns early without re-uploading when the post already exists.

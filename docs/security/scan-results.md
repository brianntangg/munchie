# Automated scan results (Sprint 4)

Scanned on 11/11/2026, against `main` at `5e12bd4` plus the `ci/security-scan` branch (#63). The same tools run in
the **Security scan** CI job on every pull request, and any High finding fails it.

## Tools

| Scan type | Tool (version) | Scope | Command | Fails CI on |
| --- | --- | --- | --- | --- |
| Dependency audit (SCA) | npm audit (npm 11) | `apps/mobile` production dependencies | `npm audit --omit=dev --json` | High or critical, unless allowlisted with a reason in `.github/npm-audit-allowlist.txt` |
| Dependency audit (SCA) | pip-audit 2.10.1 | `scraper/requirements.txt` | `pip-audit -r scraper/requirements.txt` | Any known vulnerability |
| Static analysis (SAST) | Semgrep 1.142.0 | Whole repo (app, scripts, scraper, workflows) | `semgrep scan --config p/javascript --config p/typescript --config p/react --config p/python --config p/github-actions` | ERROR (High) severity |
| Static analysis (SAST) | Bandit 1.8.6 | `scraper/` | `bandit -r scraper` | High severity |
| Secret scan | gitleaks 8.28.0 | Every commit in the git history (74 commits) | `gitleaks git . --redact` | Any finding |
| Supply chain | grep check in CI | `.github/workflows/*.yml` | Every `uses:` must be pinned to a 40-character commit SHA | Any unpinned action |

## Results by severity

Counted before any fix. "Accepted" means accepted risk.

| Tool | Critical | High | Medium | Low | True positive | False positive | Accepted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| npm audit | 0 | 7 packages | 9 | 1 | All 7 High: 4 packages fixed, 3 packages accepted | 0 | 1 advisory covering 3 packages (`decode-uri-component` → `query-string` → `expo-router`). Medium/Low not triaged one by one, since they don't block |
| pip-audit | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Semgrep | 0 | 1 | 0 | 0 | 1 (fixed) | 0 | 0 |
| Bandit | 0 | 0 | 1 | 39 | 0 | 40 | 0 |
| gitleaks | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Pin check | n/a | 9 actions unpinned | | | 9 (fixed) | 0 | 0 |

## Triage

| Result | Location | Triage | Reason / action | Owner |
| --- | --- | --- | --- | --- |
| npm: `@expo/cli` (via `glob`, `zod`), `node-forge`, `source-map-js`, `zod` High advisories | `apps/mobile/package-lock.json` | True positive, fixed | `npm audit fix` updated the lock file to patched versions; `package.json` unchanged; lint, typecheck and unit tests pass (#63) | Brian |
| npm: `decode-uri-component` (GHSA-qr28-fpjm-wq7f), reached through `query-string` in `expo-router` | `apps/mobile/package-lock.json` | Accepted risk | Denial of service on malformed percent-encoded URLs; it runs only in the viewer's own browser and can't touch data. The only fix is expo-router 58, which needs the Expo SDK 58 upgrade. Allowlisted with a reason; tracked as DEBT-01 | Brian |
| Semgrep `run-shell-injection` | `.github/workflows/ci.yml`, release job | True positive, fixed | `${{ github.ref_name }}` was pasted into a shell script, so a tag name containing shell syntax could run commands with the release token. Now passed as an environment variable. Low real-world risk, since only collaborators can push tags (#63) | Brian |
| Bandit B608 (SQL from strings) | `scraper/netnutrition_scraper.py`, `build_hours_sql` | False positive | Writes a migration file that is reviewed in a PR, not a query run against the database; `hall_id` comes from the hard-coded `HALL_IDS` table and quotes in the JSON are escaped. Suppressed with `# nosec B608` and a comment explaining why | Brian |
| Bandit B101 (`assert` used) x39 | `scraper/tests/test_hours.py` | False positive | pytest tests use `assert` by design. CI excludes `scraper/tests` from Bandit | Brian |
| Unpinned actions (9 distinct, both workflows) | `.github/workflows/*.yml` | True positive, fixed | Pinned to commit SHAs with the version in a comment; Dependabot updates them weekly (ADR-001) | Brian |
| gitleaks | whole history | No findings | GitHub secret scanning and push protection are also on | Brian |

## How CI proves each fix (regression checks)

Each check fails on `main` before the fix and passes after it:

- **npm audit step:** `main`'s lock file has 7 High advisories, so it fails; with #63's lock file it passes.
- **Semgrep step:** `main`'s `ci.yml` has the shell-injection pattern, so it fails; with #63 it passes.
- **Pin check step:** reports `actions/checkout@v4` and the other tags on `main` (exit 1); with #63 it passes.

# ADR-001: Pin CI actions to commit SHAs and block merges on High scan findings

- **Status:** Accepted, 11/11/2026
- **Owner:** Brian
- **Related:** threat model T10, T11 and finding F3; OWASP A06 and A08; PR #63

## Context

The Sprint 4 audit found two ways untrusted code could reach our pipeline or our users:

1. **CI actions were referenced by tag** (`actions/checkout@v4`, `supabase/setup-cli@v1` and others). Whoever controls
   a tag can point it at different code. The `migrate` job runs those actions with the hosted database password, and
   the sync job runs them with the service-role key, which bypasses every row-level security rule.
2. **Nothing checked dependencies or code for known problems.** `npm audit` found 7 High advisories in the app's
   production dependencies, and Semgrep found a shell injection in the release job.

## Decision

- Every third-party action is pinned to a full commit SHA, with the version in a comment. A CI step fails on any
  unpinned `uses:`. Dependabot proposes updates weekly, so the pins don't go stale.
- A **Security scan** job runs on every pull request: npm audit, pip-audit, Semgrep, Bandit and a gitleaks scan of
  the whole history. Any High finding fails it, and it is a required check on `main`, so a High finding blocks the
  merge. The build waits for it, so nothing deploys without it.
- A High advisory with no fix available may be allowlisted only in `.github/npm-audit-allowlist.txt`, with the reason
  and the condition for removing it, and a matching debt register item. A suppression in code (`# nosec`) needs a
  comment explaining why.
- Workflows default to a read-only `GITHUB_TOKEN`; jobs that need more (deploy, release) ask for it explicitly.

## Consequences

- A compromised or re-tagged action can no longer change what runs in our pipeline without a reviewed PR.
- Pull requests can be blocked by advisories published after they were opened. The fix is to update the dependency,
  or allowlist it with a reason if no fix exists yet.
- Dependabot opens a few PRs a week that someone has to review.
- Registry rules for Semgrep can change between runs, so a new rule can flag old code. We triage it like any other
  finding.

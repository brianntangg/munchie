# Debt register

Known gaps we chose to defer, each with the reason and when it gets done. Review comments with the disposition
"Accepted – deferred" link to an item here.

| ID | Item | Source | Why deferred | Plan / remove when | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| DEBT-01 | `decode-uri-component` High advisory (GHSA-qr28-fpjm-wq7f) inside `expo-router` | npm audit, `docs/security/scan-results.md` | Only fixed in expo-router 58, which needs the Expo SDK 58 upgrade | Upgrade to SDK 58, then delete the entry in `.github/npm-audit-allowlist.txt` | Brian | Open |
| DEBT-02 | CAPTCHA on sign-in (Cloudflare Turnstile) | Threat model F1 | Needs the widget in the app before the Supabase setting can be switched on, or every sign-in breaks. Meanwhile codes expire after 10 minutes, verifications are limited to 30 per 5 minutes per IP, and emails to one address are spaced 60 s apart | Add the Turnstile widget to sign-in, then turn on CAPTCHA in the dashboard | Tevin | Open |
| DEBT-03 | Photos uploaded but never attached to a post stay in storage | Threat model F4, issue #38, review of #58 | The uploader can already delete them; a scheduled cleanup needs a server-side job | Scheduled cleanup of unattached photos older than a day | Justin | Open |
| DEBT-04 | A post's stars show the author's current rating of the dish, so re-rating changes older posts | Cross-team review of #56 (seampeterm) | Ratings keep one current score per member per dish, which the dish average needs. A per-post copy of the score belongs with #58's per-photo dish labels, which already keep a fixed score for typed labels | Save the score on `post_photos` when a post is published, and add a test that two posts of the same dish keep their own scores | JKong05 | Open |
| DEBT-05 | The post form says "No dishes are listed" while the hall's menu is still loading | Cross-team review of #56 (kylexu12345) | `new-post.tsx` and the dish list are rewritten in #58, so a fix on `main` would conflict | Show "Loading dishes…" until the menu request finishes, in the #58 photo screen | JKong05 | Open |

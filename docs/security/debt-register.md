# Debt register

Known gaps we chose to defer, each with the reason and when it gets done. Review comments with the disposition
"Accepted – deferred" link to an item here.

| ID | Item | Source | Why deferred | Plan / remove when | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| DEBT-01 | `decode-uri-component` High advisory (GHSA-qr28-fpjm-wq7f) inside `expo-router` | npm audit, `docs/security/scan-results.md` | Only fixed in expo-router 58, which needs the Expo SDK 58 upgrade | Upgrade to SDK 58, then delete the entry in `.github/npm-audit-allowlist.txt` | Brian | Open |
| DEBT-02 | CAPTCHA on sign-in (Cloudflare Turnstile) | Threat model F1 | Needs the widget in the app before the Supabase setting can be switched on, or every sign-in breaks. Meanwhile codes expire after 10 minutes, verifications are limited to 30 per 5 minutes per IP, and emails to one address are spaced 60 s apart | Add the Turnstile widget to sign-in, then turn on CAPTCHA in the dashboard | Tevin | Open |
| DEBT-03 | Photos uploaded but never attached to a post stay in storage | Threat model F4, issue #38, review of #58 | The uploader can already delete them; a scheduled cleanup needs a server-side job | Scheduled cleanup of unattached photos older than a day | Justin | Open |

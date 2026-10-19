# Sending sign-in codes to real email addresses

The hosted project behind <https://brianntangg.github.io/munchie> sends sign-in
codes through Gmail SMTP from a dedicated Munchie Gmail account. Local Supabase
still captures email at http://localhost:54324 and never sends to real mailboxes.

Supabase's default hosted email service only delivers to authorized project-team
addresses and has restrictive limits, so custom SMTP is required for testers.
See [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

## Configure delivery

1. Set up the hosted project and apply migrations using the
   [hosted development instructions](architecture.md#hosted-development).
2. Create a dedicated personal Gmail account for sending (not a teammate's own
   mailbox). Turn on 2-Step Verification, then create an
   [app password](https://myaccount.google.com/apppasswords) named `Supabase`.
3. In the Supabase dashboard, **Authentication → Emails → SMTP Settings**, enable
   custom SMTP: host `smtp.gmail.com`, port `587`, the Gmail address as both
   sender email and username, the app password, and sender name `Munchie`.
   Supabase warns that Gmail is a personal provider; that is expected. The app
   password belongs only in this setting; never commit it or put it in an
   `EXPO_PUBLIC_*` variable.
4. **Authentication → Emails → Templates** unlocks once custom SMTP is enabled.
   In **Confirm signup** (subject `Your Munchie verification code`) and
   **Magic Link** (subject `Your Munchie sign-in code`), paste the contents of
   [`supabase/templates/code.html`](../supabase/templates/code.html).
   The `{{ .Token }}` variable displays the sign-in code. The app uses code entry,
   so sending only a magic link will not match its UI.
5. **Authentication → Rate Limits**: set emails sent per hour to `60`. Gmail
   allows about 500 messages a day.
6. Request a code on the live site with your actual `@vanderbilt.edu` address,
   read the message, and enter the code. Test both a new account and a returning user.

To try hosted delivery from a local Expo session instead, set the hosted URL and
publishable key in `apps/mobile/.env.local` and restart Expo; switch back to local
Supabase before running the integration tests.

For higher volume or better deliverability, a transactional provider such as
[Resend](https://resend.com/docs/send-with-supabase-smtp) can replace Gmail, but
it needs a sending domain you control. Do not use Vanderbilt as the sending
domain without authorization.

The app's Vanderbilt domain restriction still applies when custom SMTP is enabled.
Local test users do not exist in the hosted database, and should never be created there.

## If the message does not arrive

- Confirm the app is pointing at the hosted project, not local Supabase.
- Check Supabase Auth logs and the sending Gmail account's Sent folder, then the
  recipient's junk folder or Vanderbilt's Microsoft 365 quarantine.
- If Gmail rejects the login, recreate the app password and confirm 2-Step Verification is on.
- Inspect project and provider rate limits before repeatedly requesting codes.
- If you receive a link without a code, update both email templates above.

Local Supabase can also be configured with external SMTP via `[auth.email.smtp]`
in `supabase/config.toml`, but that changes the captured-email workflow used by
our automated test. Keep the standard local setup for tests and use a separate
hosted development project for real delivery.

Template reference: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

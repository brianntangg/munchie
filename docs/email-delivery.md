# Sending sign-in codes to real email addresses

The current local Supabase setup captures email at http://localhost:54324.
It does not send messages to recipients' real mailboxes. The app already requests
and verifies codes; real delivery is an Auth/SMTP configuration task.

For a shared demo, use a hosted Supabase development project with custom SMTP.
Supabase's default hosted email service only delivers to authorized project-team
addresses and has restrictive limits; it is not general student email delivery.
See [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

## Configure delivery

1. Set up the hosted project and apply migrations using the
   [hosted development instructions](architecture.md#hosted-development).
2. Choose an SMTP provider, such as Resend, and verify a sending domain you
   control using its required DNS records. The sender can be an address on your
   app's domain; recipients remain Vanderbilt addresses. Do not use Vanderbilt
   as the sending domain unless you have authorization and DNS control.
3. In the Supabase project's Authentication email/SMTP settings, enable custom
   SMTP and enter the provider's host, port, username, password, sender email,
   and sender name (`Munchie`). Use the exact settings from the provider.
   For an example, follow [Resend's Supabase guide](https://resend.com/docs/send-with-supabase-smtp).
4. Keep email confirmation enabled. In the **Confirm signup** and **Magic Link**
   email templates, paste the contents of
   [`supabase/templates/code.html`](../supabase/templates/code.html).
   The `{{ .Token }}` variable displays the sign-in code. The app uses code entry,
   so sending only a magic link will not match its UI.
5. In `apps/mobile/.env.local`, set the hosted project's HTTPS URL and publishable
   key. Restart Expo. Keep SMTP credentials exclusively in server/provider
   settings; never place them in `EXPO_PUBLIC_*` variables or commit them.
6. Request a code using your actual `@vanderbilt.edu` address, read the message,
   and enter the code in Munchie. Test both a new account and a returning user.

The app's Vanderbilt domain restriction still applies when custom SMTP is enabled.
Your Google/Expo login does not send or verify Munchie codes. Local test users do
not exist in the hosted database unless you create accounts there separately.

## If the message does not arrive

- Confirm the app is pointing at the hosted project, not local Supabase.
- Check Supabase Auth logs and the provider's delivery logs, then the recipient's
  junk folder or university mail quarantine.
- Confirm the sender domain is verified and the provider permits that recipient.
- Inspect project and provider rate limits before repeatedly requesting codes.
- If you receive a link without a code, update both email templates above.

Local Supabase can also be configured with external SMTP via `[auth.email.smtp]`
in `supabase/config.toml`, but that changes the captured-email workflow used by
our automated test. Keep the standard local setup for tests and use a separate
hosted development project for real delivery.

Template reference: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

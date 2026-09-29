# Sprint 2 MVP

The milestone is: two verified campus users can sign in, choose a display name,
upload a meal photo with a dining hall and optional caption, and see each other's
posts. This sprint includes camera/library selection, JPEG resizing, private
photo storage, a newest-first paginated feed, pull-to-refresh, session persistence,
and sign-out.

Deferred to sprints 3–5: ratings, likes, comments, friends/following, enforced meal
windows, automatic/realtime refresh, dining-data integration, moderation, profile
editing, and post editing/deletion. Posting is available at any time in this MVP.
Vanderbilt email verification establishes access to a campus email address; it
does not independently verify current student enrollment.

## Run locally

Requirements: Node 22.13+ (CI uses 24), npm, and running Docker Desktop.
Run these commands from the repository root:

```sh
npx --yes supabase start
cd apps/mobile
npm ci
cp .env.example .env.local
```

Set `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` to the publishable key
printed by `supabase start` (or `npx --yes supabase status`). Never put a secret or
service-role key in the app. `.env.local` is ignored by Git.

Set `EXPO_PUBLIC_SUPABASE_URL` for the device you use:

- iOS simulator: `http://127.0.0.1:54321`.
- Android emulator: `http://10.0.2.2:54321`.
- Physical device: `http://YOUR_COMPUTER_LAN_IP:54321`; use the same Wi-Fi and allow
  access through your firewall. All local Supabase services are development only.

Then run `npm start`. Use a compatible Expo Go installation or an Expo development
build. Restart Expo after changing environment variables. The app supports mobile;
web is not part of Sprint 2 acceptance.

Local tools:

- Supabase Studio: http://127.0.0.1:54323
- Captured email inbox: http://127.0.0.1:54324
- API: http://127.0.0.1:54321

Use any test address ending in `@vanderbilt.edu` locally. The code appears in the
captured inbox; local Supabase does not send real email. Request a code, enter it,
and choose your display name. Repeat on another device or sign out and use a
second address. Templates in `supabase/templates/code.html` show the code for both
new-account confirmation and returning-user login.

After editing auth configuration/templates, run `npx --yes supabase stop` and
`npx --yes supabase start` from the root. Stopping preserves local database data.
To rebuild a disposable local database from migrations, run
`npx --yes supabase db reset --local`; **this deletes local app data**.

## Validate

From `apps/mobile`:

```sh
npm run lint
npm run typecheck
npx expo export --platform ios --platform android
npm run test:backend
```

The backend test requires `.env.local` pointing to `127.0.0.1` or `localhost` and
running local Supabase. If using a physical-device URL, override it for the test:

```sh
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 npm run test:backend
```

It signs in two accounts using codes from local email, uploads a tiny fixture,
creates a post, reads it and its photo as the other user, and checks denied actions.
It leaves its test accounts and one demo post in the local database. It will refuse
to run against a hosted URL. It never uses a service-role key.

From the root, also run `npx --yes supabase test db` for membership/permission
checks (the SQL test rolls back its fixtures).

Manual sprint acceptance:

1. Reject a non-Vanderbilt email. A Vanderbilt account needs a valid email code.
2. Create a display name; close/reopen the app and confirm the session persists.
3. Select or take a photo, select a hall, and publish with an optional caption.
4. Sign in as another user and pull to refresh. Confirm the photo, author, hall,
   caption, and timestamp appear.
5. Deny camera permission and confirm the library option still works.
6. Disconnect networking while posting. Confirm an error appears and the draft
   remains available for retry; retrying the same submission does not duplicate it.
7. Sign out and confirm the feed is no longer accessible.
8. With more than 20 posts, use Load more meals and check ordering.

## Implementation notes

- Migrations create `profiles`, `dining_halls`, `posts`, access policies, and a
  private `food-photos` bucket limited to JPEGs up to 5 MB. Hall names are a starter
  list, not live dining availability; adjust reference data through migrations.
- Database rules check the current verified address in `auth.users`, not mutable
  metadata. A trigger rejects non-campus signups and email changes. All client
  writes are constrained by row-level security and column grants.
- Post IDs are generated once per draft. Storage paths are `user-id/post-id.jpg`.
  Posts require an existing uploaded object; retries check whether the post already
  committed. Failed inserts attempt cleanup when commit status is known. Published
  photos cannot be deleted through the client. An app crash or lost connectivity
  can leave an unused upload; periodic orphan cleanup is deferred.
- Images use one-hour signed URLs. Pull to refresh renews URLs for the newest page.
- `src/lib/database.types.ts` is generated from the migration. Regenerate from root:
  `npx --yes supabase gen types typescript --local > apps/mobile/src/lib/database.types.ts`.

## Later hosted setup

Create a separate development Supabase project and apply migrations using the
Supabase CLI (`supabase link`, then review and `supabase db push`). Reference dining
halls are included in the migration, so hosted setup does not depend on a seed.
Hosted Auth settings are not automatically copied from `config.toml`: enable email
confirmation, set both Confirm signup and Magic Link templates to the contents of
`supabase/templates/code.html`, and configure an SMTP provider for real recipients.
Use the hosted project URL and publishable key in the app. Verify the same two-user
flow before a sprint demo with real email. Deployment was not part of local setup.

# Codebase and backend

## App structure

`apps/mobile/package.json` starts Expo Router through `expo-router/entry`.
There is no `App.tsx` or custom `index.ts` entry point. The `@/` import alias maps
to `src/` in `tsconfig.json`; restart Metro after changing aliases or entry points.

| File or directory under `apps/mobile/src/` | Responsibility |
| --- | --- |
| `app/_layout.tsx` | Auth provider and session-protected navigation |
| `app/(auth)/sign-in.tsx` | Email-code sign-in and missing-configuration screen |
| `app/(tabs)/_layout.tsx` | Feed, Dining, Post, Friends, Account; profile setup gate |
| `app/(tabs)/new-post.tsx` | Camera/library selection, JPEG preparation, publishing |
| `app/dining/[id].tsx` | Feed filtered by dining hall |
| `app/post/[id].tsx` | Single post from Supabase |
| `components/ui.tsx`, `theme.ts` | Shared visual components and design tokens |
| `components/form-ui.tsx` | Form helpers and styles used by login, profile, post, and feed; wraps the shared Button |
| `components/Feed.tsx`, `PostCard.tsx` | Paginated feed and actual uploaded photos |
| `components/ProfileGate.tsx` | Loads profile or asks a signed-in user to create one |
| `lib/auth.tsx` | Session restoration, auth events, foreground token refresh |
| `lib/supabase.ts` | Client configuration and persistent session storage |
| `lib/posts.ts` | Joined post queries, signed photo URLs, upload/insert workflow |
| `lib/ratings.ts` | Score validation (whole numbers 1–5), submit or replace a dish rating, the current user's score, dish averages |
| `lib/database.types.ts` | Generated database types; regenerate after schema changes |

## Authentication and data flow

1. The app calls Supabase Auth `signInWithOtp` with a Vanderbilt email address.
2. The user enters the emailed code; `verifyOtp` creates the session.
3. `ProfileGate` checks `profiles` and asks for a display name if needed.
4. Client requests use the publishable key plus the signed-in user's token.
   Database row-level security and column grants enforce access on the server.
5. Session storage persists login; the auth provider manages token refresh as
   the app changes foreground/background state.

The migration's trigger rejects non-Vanderbilt addresses on account creation and
email changes. The membership helper checks the current `auth.users` record for
a confirmed campus email, rather than trusting editable user metadata. Navigation
protection is a UI convenience, not a substitute for database permissions.

## Database and storage

| Resource | Data and access |
| --- | --- |
| `profiles` | Auth user ID and display name (1–40 trimmed characters); members read, users create/update their own profile |
| `dining_halls` | Seeded ID/name reference list; members read; app clients cannot write |
| `menu_items` | Dish name and optional station/category per dining hall, one row per dish per hall; members read; app clients cannot write (the menu importer loads them) |
| `posts` | Author, hall, photo path, caption (up to 280 characters), server timestamp; members read and create their own posts |
| `ratings` | Author, menu item, score (whole number 1–5), server timestamps; one rating per member per dish; members read all ratings and create or change only their own score; no deletes |
| `food-photos` bucket | Private JPEGs up to 5 MB; members read; uploads must be in the current user's folder |

Posts require an existing uploaded photo at `user-id/post-id.jpg`. Clients cannot
set post timestamps or update/delete posts. Storage policies permit removing an
owner's unused uploads, but protect objects already referenced by a post.

Dining halls are inserted by the migration so local and hosted databases agree.
`supabase/seed.sql` adds demo menu items for local development and tests; it does
not create users or posts, and hosted projects do not run it. Hall names are reference data, not a live operating-hours feed.

## Posting and reading

The post screen resizes large photos to a maximum dimension of 1440 pixels and
encodes JPEGs before upload. It generates a stable post ID for retries, uploads
the object, then inserts the post. On an insert error, it checks whether the post
committed before attempting cleanup. Unknown commit status preserves the photo.
Drafts remain in component memory after a failed request; they do not survive an
app restart. Crashes or network loss can leave unused objects; scheduled cleanup
is not implemented.

Feeds read 20 posts per page, sorted by `created_at` and `id` descending. Queries
can filter by author or hall. Profile and hall names are joined from their tables.
Photos use signed URLs valid for one hour. Refreshing or revisiting a feed loads
fresh data and URLs. A manual Refresh feed button also supports browser demos.
There are no realtime subscriptions or server-enforced meal windows yet.

## Database changes

Run Supabase CLI commands from the repository root:

```sh
npx --yes supabase migration new describe_change
```

Write SQL in the new migration, then apply it to the running local database:

```sh
npx --yes supabase migration up --local
npx --yes supabase test db
npx --yes supabase gen types typescript --local > apps/mobile/src/lib/database.types.ts
```

Commit migrations and generated types together. Create new migrations for future
schema changes instead of rewriting migrations already applied by teammates.
Keep the existing access controls when adding features. Prefer reproducible
migrations over changes made only through Studio.

See [Supabase's migration guide](https://supabase.com/docs/guides/local-development/database-migrations).

## Hosted development

The web app is hosted at <https://brianntangg.github.io/munchie>, backed by a
hosted Supabase project. CI deploys it on every merge to `main` (see the
[pipeline](pipeline.md#continuous-delivery)). The app reads the project URL and
publishable key from the repository Actions variables `EXPO_PUBLIC_SUPABASE_URL`
and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

The hosted database holds only real data. Keep it that way:

- Apply schema changes with `npx --yes supabase db push`. Never run
  `supabase db push --include-seed` or `supabase db reset --linked`; `seed.sql`
  holds demo dishes for local development only.
- Migrations do not reach the hosted database automatically. After merging a pull
  request that adds one, run `npx --yes supabase db push --dry-run`, then
  `npx --yes supabase db push`, so the deployed app never queries columns that do
  not exist yet.
- Integration tests run only against local Supabase. `apps/mobile/scripts/helpers.ts`
  refuses non-localhost URLs, so they cannot create test accounts in the hosted project.
- Only the publishable key goes in GitHub variables or the app. The service-role
  key goes only in Actions secrets, for the menu sync job.

To set up a new hosted project (for example, a fresh copy for another team):

1. Create a development project in the [Supabase dashboard](https://supabase.com/dashboard).
2. From the repository root, run `npx --yes supabase login`, then
   `npx --yes supabase link --project-ref YOUR_PROJECT_REF` with the real reference.
3. Review the target project and pending migrations with
   `npx --yes supabase db push --dry-run`; apply with `npx --yes supabase db push`.
4. Enable email authentication and email confirmation in hosted Auth settings.
   Local `config.toml` Auth settings and templates are not automatically applied
   by a database migration.
5. Follow [real email delivery](email-delivery.md) to configure SMTP and code templates.
6. Set the app's URL and publishable key to that hosted project, restart Expo,
   and repeat the two-user acceptance flow with real campus mailboxes.

7. Set the repository variables above and enable GitHub Pages with the source
   **GitHub Actions**; the next merge to `main` deploys the site.

Local accounts and photos do not automatically transfer to the hosted project.
Use the manual checklist for a hosted demo.

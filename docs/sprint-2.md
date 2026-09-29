# Sprint 2 demo and testing

## Scope

Two campus users can verify their email, choose display names, share dining
photos, and view each other's posts. Feed, Dining, Post, Account, and detail
screens use Supabase data. Friends is explicitly marked coming soon.

Later work: ratings, likes, comments, following, meal posting windows, automatic
feed updates, editing/deleting posts, profile editing, moderation, orphan-upload
cleanup, and menu integration. The standalone scraper is not connected to the
Dining tab. Posting is currently available at any time.

Start with [local setup](local-development.md). For real mailbox delivery, see
[email setup](email-delivery.md); local codes appear only in the captured inbox.

## Browser demo (about three minutes)

Prepare a food photo on your computer and keep the captured inbox open in another
tab. Start the web app and enable Chrome's
[phone-sized view](local-development.md#phone-sized-browser-view).

| Step | Action | What it demonstrates |
| --- | --- | --- |
| Login | Request a code for `alice@vanderbilt.edu`, retrieve it at localhost:54324, and verify | Campus email-code flow |
| Profile | Choose a display name for a new account | Profile stored in the database |
| Feed | Browse posts or explain the empty state | Shared dining feed |
| Post | Choose a file, select a hall, add a caption, submit | Actual photo storage and post creation |
| Dining | Open that hall and the meal detail | Hall filtering and detail navigation |
| Account | Show your name and posts | Current user's profile and author filter |
| Second user | Use a private window to sign in as `bob@vanderbilt.edu` and refresh | Shared data across accounts |

Describe it as a Sprint 2 MVP. Do not present Friends, sample menu data, or phone
camera behavior as completed features. Test fixtures may appear in the feed from
previous automated runs. Real food photos make the demo clearer than tiny fixtures.

## Automated checks

From `apps/mobile`:

```sh
npm run lint
npm run typecheck
npx expo export --platform web --platform ios --platform android
npm run test:backend
```

The backend test needs running local Supabase, its default captured-email service,
and a configured `.env.local`. With a phone URL in that file, on macOS/Linux use:

```sh
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 npm run test:backend
```

The test refuses hosted URLs, uses no service-role key, and creates two accounts
plus a demo post in your local database. It verifies OTP, profile creation,
uploads, cross-user reads, sign-out, and rejected unauthorized operations.
It leaves its accounts and post in place; it does not send real email.

From the repository root:

```sh
npx --yes supabase test db
```

The database suite checks verified membership, domain restrictions, and write
permissions. Its fixture changes roll back. GitHub Actions currently runs
`npm ci`, lint, and typecheck; it does not run Docker/backend tests or device tests.

## Manual acceptance

Run against the browser, then repeat on a physical phone. Use
[phone setup](local-development.md#physical-iphone-or-android-phone) first.

- [ ] An outside-domain email is rejected; invalid/expired codes cannot sign in.
- [ ] A valid code signs in; a new user can create a display name.
- [ ] Closing and reopening the app restores the session.
- [ ] Library photo selection works; on a phone, taking a camera photo works.
- [ ] Camera denial leaves the library option usable; canceling selection is safe.
- [ ] Posting requires a photo and hall; caption is optional and limited to 280 characters.
- [ ] A submitted post has the right photo, author, hall, caption, and timestamp.
- [ ] A second account sees the post after refreshing.
- [ ] Hall detail shows only that hall's posts; Account shows only your own posts.
- [ ] Post detail opens, and tabs/back navigation work.
- [ ] With more than 20 posts, Load more meals preserves order without duplicates.
- [ ] A failed submission shows an error and permits retry without duplicating the post.
- [ ] Sign-out removes access to protected screens, including when navigating back.

Drafts are held in memory, not persisted through app restarts. Browser device mode
is not a substitute for the physical-phone checks.

## Validation status

During Sprint 2 implementation and frontend integration, lint/typecheck,
web/iOS/Android bundle exports, the two-user backend test, nine SQL permission
tests, and Expo Doctor checks passed. These are historical results, not a
promise that future changes pass; rerun relevant checks before merging changes.

Physical iPhone testing confirmed backend reachability through the Mac's LAN
address. Expo Go then required matching CLI/phone accounts; browser login was
identified for Google-linked accounts. A complete native login/upload/session
walkthrough has **not yet been confirmed**. Hosted deployment and actual email
delivery have also not been verified.

## Before sharing changes

Create a descriptive feature branch for new work. Inspect `git status`, the staged
diff, and `git diff --cached --check`. Include migrations, generated types, tests,
and the npm lockfile when relevant. Do not commit `.env.local`, credentials,
`node_modules`, or build output.

Resolve merge markers before starting a demo. After branch changes affecting
routing, import aliases, dependencies, or app configuration, install dependencies
as needed and restart Expo with `--clear`. Push your feature branch and open a PR;
record the tests actually run and any outstanding manual checks in the description.

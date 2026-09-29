# Munchie

Munchie lets Vanderbilt students share campus dining photos and discover what
others are eating. The current Sprint 2 MVP uses an Expo/React Native app with
Supabase authentication, PostgreSQL, and private image storage.

## Start here

- [Local setup](docs/local-development.md): first checkout, browser, physical phone,
  simulators, email codes, and troubleshooting.
- [Sprint 2 demo and testing](docs/sprint-2.md): walkthrough, acceptance checks,
  automated tests, and remaining work.
- [Codebase and backend](docs/architecture.md): routes, data flow, access rules,
  migrations, and hosted setup.
- [Real email delivery](docs/email-delivery.md): hosted SMTP and sign-in code templates.
- [Dining scraper](Scripts/README.md): optional standalone menu collection.

## What works today

- Sign in or create an account with a Vanderbilt email verification code.
- Choose a display name and retain the session between app launches.
- Upload a camera/library photo with a dining hall and optional caption.
- Browse a paginated shared feed, refresh it, and open a post.
- Browse dining halls and their posts; view your profile and your own posts.
- Sign out. Database and storage permissions enforce member access and ownership.

Friends is a coming-soon screen. Ratings, likes, comments, meal-time restrictions,
automatic feed updates, editing/deleting posts, and live menu integration are not
implemented. The scraper's JSON output is not connected to the app.

Email verification establishes access to a Vanderbilt mailbox, not independently
verified student enrollment. Local development captures verification emails on
your computer instead of sending them to real mailboxes.

## Repository map

| Path | Purpose |
| --- | --- |
| `apps/mobile/src/app/` | Expo Router screens and navigation |
| `apps/mobile/src/components/` | Shared UI, feed, login, and profile setup |
| `apps/mobile/src/lib/` | Supabase client, authentication, post queries, generated types |
| `apps/mobile/src/theme.ts` | Colors, typography, spacing |
| `apps/mobile/scripts/` | Local backend integration test |
| `supabase/` | Local services, migrations, email templates, database tests |
| `Scripts/` | Standalone Python dining scraper and captured menu data |
| `.github/workflows/ci.yml` | Mobile dependency installation, lint, and typecheck |

## Development

Use Node.js 24, npm, and Docker Desktop. Follow the [setup guide](docs/local-development.md)
after cloning or pulling; `.env.local`, databases, and uploaded files are not shared
through Git. Use `npx expo install` from `apps/mobile` when adding app dependencies.

Browser demos and native bundle builds are available. Physical-phone testing is
still in progress; a successful bundle build does not verify camera permissions
or the complete phone flow. See the [validation status](docs/sprint-2.md#validation-status).

Developed for Vanderbilt University's Principles of Software Engineering course.
Team: Brian Tang, David Lee, Justin Kong, and Tevin Park.

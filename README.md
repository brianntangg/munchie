# Munchie

Munchie lets Vanderbilt students share campus dining photos and discover what
others are eating. It is an Expo/React Native app backed by Supabase
authentication, PostgreSQL, and private image storage.

## Start here

- [Local setup](docs/local-development.md): first checkout, browser, physical phone,
  simulators, email codes, and troubleshooting.
- [Product vision](docs/product-vision.md): goals and the full feature list,
  built and planned.
- [Demo and testing](docs/testing.md): walkthrough, automated tests, and
  acceptance checks.
- [Codebase and backend](docs/architecture.md): routes, data flow, access rules,
  migrations, and hosted setup.
- [Real email delivery](docs/email-delivery.md): hosted SMTP and sign-in code templates.
- [Dining scraper](scraper/README.md): optional standalone menu collection.

## What works today

- Sign in or create an account with a Vanderbilt email verification code.
- Choose a display name and retain the session between app launches.
- Upload a camera/library photo with a dining hall and optional caption.
- Browse a paginated shared feed, refresh it, and open a post.
- Browse dining halls and their posts; view your profile and your own posts.
- Sign out. Database and storage permissions enforce member access and ownership.

Friends is a coming-soon screen, and the scraper's output is not yet connected to
the app. See the [product vision](docs/product-vision.md) for planned features.

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
| `scraper/` | Standalone Python dining scraper and captured menu data |
| `.github/workflows/ci.yml` | Mobile dependency installation, lint, and typecheck |

## Development

Use Node.js 24, npm, and Docker Desktop. Follow the [setup guide](docs/local-development.md)
after cloning or pulling; `.env.local`, databases, and uploaded files are not shared
through Git. Use `npx expo install` from `apps/mobile` when adding app dependencies.

Browser demos and native bundle builds are available. Physical-phone testing is
still in progress; a successful bundle build does not verify camera permissions
or the complete phone flow. See the [known gaps](docs/testing.md#known-gaps).

Developed for Vanderbilt University's Principles of Software Engineering course.
Team: Brian Tang, David Lee, Justin Kong, and Tevin Park.

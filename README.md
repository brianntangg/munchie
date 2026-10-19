# Munchie

[![Mobile CI](https://github.com/brianntangg/munchie/actions/workflows/ci.yml/badge.svg)](https://github.com/brianntangg/munchie/actions/workflows/ci.yml)

Munchie lets Vanderbilt students share campus dining photos and discover what
others are eating. It is an Expo/React Native app backed by Supabase
authentication, PostgreSQL, and private image storage.

## Start here

- **Try it:** <https://brianntangg.github.io/munchie>. Sign in with your
  `@vanderbilt.edu` email; the code arrives in your real inbox.
- [Local setup](docs/local-development.md): first checkout, browser, physical phone,
  simulators, email codes, and troubleshooting.
- [Product vision](docs/product-vision.md): goals and the full feature list,
  built and planned.
- [Demo and testing](docs/testing.md): walkthrough, automated tests, and
  acceptance checks.
- [CI/CD pipeline](docs/pipeline.md) and [integration tests](docs/integration-tests.md):
  stages, delivery, branch protection, and what each test covers.
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
verified student enrollment. The [live site](https://brianntangg.github.io/munchie)
sends real codes to `@vanderbilt.edu` inboxes; local development captures them on
your computer instead.

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
| `.github/workflows/ci.yml` | CI/CD: lint, typecheck, unit tests with a coverage gate, integration tests against local Supabase, coverage report, scraper lint and tests; web build and GitHub Pages deploy on merge, and a release on sprint tags |
| `docs/pipeline.md`, `docs/integration-tests.md` | Pipeline stages and delivery; what each integration test covers |

## Development

Use Node.js 24, npm, and Docker Desktop. Follow the [setup guide](docs/local-development.md)
after cloning or pulling; `.env.local`, databases, and uploaded files are not shared
through Git. Use `npx expo install` from `apps/mobile` when adding app dependencies.

Browser demos and native bundle builds are available. Physical-phone testing is
still in progress; a successful bundle build does not verify camera permissions
or the complete phone flow. See the [known gaps](docs/testing.md#known-gaps).

### Run a release build

Every merge to `main` uploads a web build named `munchie-web-<commit>` to its
[Actions run](https://github.com/brianntangg/munchie/actions/workflows/ci.yml), and each
sprint tag (for example `sprint3`) publishes it as a
[release](https://github.com/brianntangg/munchie/releases). The build talks to the
same hosted Supabase project as the [live site](https://brianntangg.github.io/munchie),
so it needs no local backend:

```sh
unzip munchie-web-sprint3.zip -d munchie-web
npx serve -s munchie-web             # open the printed URL
```

Sign in with a real `@vanderbilt.edu` address; the code arrives in that inbox.
Data you create there is shared with the hosted site. For a fully local build,
follow the [setup guide](docs/local-development.md) instead.

## Contributing

`main` is protected; all changes go through a pull request.

1. Create a branch from `main` for one feature or fix.
2. Open a pull request and fill in the template.
3. Enable **Auto-merge (squash)** on your own pull request.
4. A pull request merges after one teammate approves and CI passes. Reviewers
   approve but do not merge someone else's pull request; auto-merge does it.
5. If `main` changes while your pull request is open, select **Update branch**.
6. Stacked pull requests: when your branch builds on another open pull request, set
   its base to that branch so the diff shows only your work, but **never merge a pull
   request whose base is not `main`**. Branch protection (required review and CI)
   only applies to `main`. Wait for the pull request below yours to merge; GitHub then
   switches yours to `main`, and it merges through the normal review.

Every pull request automatically requests review from the team
(see [CODEOWNERS](.github/CODEOWNERS)).

Developed for Vanderbilt University's Principles of Software Engineering course.
Team: Brian Tang, David Lee, Justin Kong, and Tevin Park.

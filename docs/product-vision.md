# Product vision

## Goal

Munchie is a social dining app for Vanderbilt students. It shows what each dining
hall is serving, lets students share real-time photos of their meals, and collects
ratings for individual dishes so everyone can make better decisions about where
and what to eat.

## Users

Vanderbilt students who sign in with a verified `@vanderbilt.edu` email address.
Content is visible only to signed-in campus members.

## Features

Status reflects the `main` branch. Update this table as features land.

### Accounts

| Feature | Description | Status |
| --- | --- | --- |
| Campus sign-in | Email verification code restricted to Vanderbilt addresses | Built |
| Profiles | Display name chosen on first sign-in; session persists across launches | Built |
| Profile editing | Change display name and other profile details after setup | Planned |

### Feed and posts

| Feature | Description | Status |
| --- | --- | --- |
| Photo posts | Camera or library photo, dining hall, and optional caption | Built |
| Shared feed | Paginated feed of all members' posts, pull-to-refresh, and post detail pages | Built |
| Automatic refresh | Feed reloads on its own when the app returns to the foreground | Planned |
| Edit and delete posts | Authors can correct or remove their own posts | Planned |
| Likes and comments | React to and discuss other members' posts | Planned |

### Dining halls

| Feature | Description | Status |
| --- | --- | --- |
| Hall pages | Each dining hall lists only the posts made there | Built |
| Open/closed status | Each hall shows whether it is currently open, based on its operating hours | Planned |
| Live menus | Menus synced on a schedule from NetNutrition and attached to the correct hall | Planned |
| Meal posting windows | Posting limited to the meal periods a hall is serving | Planned |

### Ratings

| Feature | Description | Status |
| --- | --- | --- |
| Dish ratings | Select a menu item and rate it; invalid scores are rejected by the database | Planned |
| Aggregate ratings | Average ratings shown for dishes and dining halls | Planned |

### Social

| Feature | Description | Status |
| --- | --- | --- |
| Friends | Follow other students and see their posts | Planned |

### Trust and safety

| Feature | Description | Status |
| --- | --- | --- |
| Member-only access | Database and storage policies enforce membership and ownership | Built |
| Moderation | Report and remove inappropriate content | Planned |
| Upload cleanup | Scheduled removal of photos never attached to a post | Planned |

## Quality bar

- Every pull request runs lint, typecheck, unit tests, and integration tests
  against a real Supabase database in CI, with at least 50% code coverage.
- `main` is protected: changes merge through reviewed pull requests with passing checks.
- Every merge to `main` publishes a build artifact.
- Database permissions, not app navigation, enforce who can read and write data.

## Non-goals

- Email verification proves access to a Vanderbilt mailbox, not enrollment status.
- Munchie displays NetNutrition menus but is not a source of official nutrition
  or allergen information.

# EvoLift

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

EvoLift is a mobile-first workout logging application built with Next.js and Supabase.

It focuses on fast session creation, compact in-session logging, and practical defaults for recurring exercises so lifters can log training with minimal friction.

## Highlights

- Mobile-first workout flow from planning to set-by-set logging
- Email/password authentication via Supabase Auth
- Session tracking with planned vs completed views
- Per-exercise user defaults (target sets/reps/weight, base weight)
- Local draft persistence for new session creation
- Read-only mode for session details to prevent accidental edits
- OpenAPI endpoint for API contract visibility
- Supabase migration + seed workflow committed in-repo

## Tech Stack

- **Frontend/App:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Icons/UI:** lucide-react
- **Backend/Data:** Supabase (Postgres + Auth + RLS-aware querying)
- **Charting:** Recharts
- **Linting:** ESLint + `eslint-config-next`

## Repository Structure

This repository is organized as a root project with two main folders:

- `evo-lift/` - Next.js web application
- `supabase/` - Supabase local project config, migrations, and seed SQL

Useful app paths:

- `evo-lift/app/` - App Router pages and API routes
- `evo-lift/app/sessions/new/` - New workout session flow
- `evo-lift/app/sessions/[id]/` - Session detail and set logging
- `evo-lift/app/account/` - Account + exercise defaults management
- `evo-lift/app/api/exercises/route.ts` - Authenticated exercise API endpoint
- `evo-lift/app/api/openapi/route.ts` - OpenAPI spec endpoint
- `evo-lift/server/db/` - Thin server-side data access layer
- `evo-lift/lib/supabase/` - Supabase browser/server clients

## Core Product Flows

### 1) Authentication

- Users can register and log in with email + password
- Post-login navigation redirects users to the main dashboard
- Unauthenticated access to protected pages redirects to `/login`

### 2) Session Planning and Creation

- Create sessions with:
  - `performed_on` date
  - Session notes
  - One or more exercise rows
  - Optional per-exercise targets (sets/reps/weight)
- Draft data is saved in local storage so in-progress work is not lost

### 3) Session Logging

- View each session with its ordered exercises and logged sets
- Add/edit/delete workout sets
- Mark warm-up sets
- Toggle session read-only mode for safety
- Update exercise-level targets within a session

### 4) Account Preferences

- Update email
- Update password (with re-auth flow)
- Save and clear per-exercise default values to prefill future planning

## Data Model (High Level)

The app is centered around the following entities in Supabase/Postgres:

- `workout_sessions`
- `workout_session_exercises`
- `workout_sets`
- `exercises`
- `exercise_translations` (currently `en` / `de`)
- `user_exercise_defaults`

Schema evolution lives in:

- `supabase/migrations/`

Seed data lives in:

- `supabase/seeds/001_exercises.sql`
- `supabase/seeds/002_exercise_translations.sql`
- `supabase/seeds/003_user_exercise_defaults_barbell_20kg.sql`

## Prerequisites

- Node.js 20+ recommended
- npm
- Supabase CLI (for local DB and migration workflow)

## Local Development

### 1) Install dependencies

From the app directory:

```bash
cd evo-lift
npm install
```

### 2) Configure environment variables

Create `evo-lift/.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` must be the base URL (not `/rest/v1`)
- `NEXT_PUBLIC_*` variables are embedded at build time
- `SUPABASE_SERVICE_ROLE_KEY` must remain server-side only

### 3) Run the app

```bash
cd evo-lift
npm run dev
```

App runs at:

- `http://localhost:3000`

### 4) Quality checks

```bash
cd evo-lift
npm run lint
npm run build
```

## Supabase Workflow

Use migrations for all schema changes instead of ad-hoc dashboard edits.

### Create migration

```bash
supabase migration new <descriptive_name>
```

### Validate locally from clean state

```bash
supabase db reset
```

### Push unapplied migrations to linked project

```bash
supabase db push
```

### Run seed files on linked remote (when needed)

```bash
supabase db query --linked --file supabase/seeds/001_exercises.sql
supabase db query --linked --file supabase/seeds/002_exercise_translations.sql
supabase db query --linked --file supabase/seeds/003_user_exercise_defaults_barbell_20kg.sql
```

## API

### `GET /api/exercises`

Returns exercises with translations.

- Requires bearer token in `Authorization` header
- Optional query parameter: `lang` (`en` or `de`)

Example:

```bash
curl -H "Authorization: Bearer <access_token>" \
  "http://localhost:3000/api/exercises?lang=en"
```

### `GET /api/openapi`

Returns OpenAPI 3.0 JSON for documented endpoints.

## Security Notes

- Never commit `.env.local`
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- Rotate credentials immediately if leaked
- Prefer anon-key + user JWT (RLS-aware) for user-scoped server endpoints

## Deployment Notes

Typical deployment flow:

1. Apply migrations (`supabase db push --linked`)
2. Apply production-safe seed files as needed
3. Ensure environment variables are set correctly in hosting platform
4. Deploy app (`evo-lift/`)
5. Smoke test login, dashboard, and authenticated `/api/exercises`

## Branding and UX Consistency

For copy, terminology, action tone, and UI behavior conventions, refer to:

- `evo-lift/BRAND_GUIDELINES.md`

## Scripts

From `evo-lift/`:

- `npm run dev` - Start local dev server
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## License

This project is licensed under the MIT License. See [`LICENSE`](LICENSE).

## Contributing

Contributions are welcome.

- Open an issue first for larger changes so approach and scope are clear.
- Keep pull requests focused and include validation steps (for example `npm run lint` and `npm run build` from `evo-lift/`).
- If you change schema or seed behavior, include the relevant updates under `supabase/migrations/` or `supabase/seeds/`.

## Support

- Bug reports and feature requests: open a GitHub issue in this repository.
- Security-related concerns: follow [`SECURITY.md`](SECURITY.md) and do not disclose sensitive details publicly.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Supabase DB Workflow

Use this workflow for all database schema changes so local and remote stay in sync.

### 1) Create a new migration

```bash
supabase migration new <descriptive_name>
```

This generates a new timestamped SQL file in `supabase/migrations`.

### 2) Edit the generated migration SQL

Open the new migration file and add your schema changes (`create table`, `alter table`, indexes, RLS policies, etc.).

### 3) Validate locally

```bash
supabase db reset
```

This replays all migrations (and seed data if configured) against your local database to verify everything works from scratch.

### 4) Push to remote

```bash
supabase db push
```

Apply unapplied local migrations to your linked Supabase project.

### Recommended habit

- Make schema changes via migrations (avoid dashboard-only changes).
- Run `supabase db reset` before pushing.
- Commit each migration file to Git.

### Seed file structure

Store seeds by domain in `supabase/seeds` and keep them ordered:

- `supabase/seeds/001_exercises.sql` inserts base `exercises` rows by slug.
- `supabase/seeds/002_exercise_translations.sql` inserts `exercise_translations` for `en` and `de`.

The order matters when one seed depends on data from another seed. Configure this in `supabase/config.toml`:

```toml
[db.seed]
enabled = true
sql_paths = ["./seeds/*.sql"]
```

When adding future seeds, append a new numbered file (for example `003_defaults.sql`).

### Run seeds on linked remote

`supabase db push` applies migrations only. To run seed files on the linked remote database, execute:

```bash
supabase db query --linked --file supabase/seeds/001_exercises.sql
supabase db query --linked --file supabase/seeds/002_exercise_translations.sql
```

## Backend Supabase usage

Supabase server clients live in `lib/supabase/server.ts`:

- `createPublicServerClient(accessToken?)` uses anon key and obeys RLS.
- `createServiceRoleClient()` uses service role and bypasses RLS.

Backend query logic lives in:

- `server/db/exercises.ts`
- `server/db/workouts.ts`

Route handlers stay thin and call that data layer:

- `app/api/exercises/route.ts`

### Browser API testing (Swagger UI)

- Open `http://localhost:3000/docs` for interactive API docs.
- The OpenAPI spec is served from `http://localhost:3000/api/openapi`.
- Click `Authorize` in Swagger UI and paste `Bearer <your_access_token>` for authenticated endpoints.

### RLS choice guidelines

- Use `createPublicServerClient` for user-scoped endpoints and pass a valid user JWT as bearer token (`Authorization: Bearer <token>`).
- Use `createServiceRoleClient` only for trusted internal/admin operations.
- If an endpoint should never bypass policies, do not use the service role in that path.

## Environment variables

Set these in each environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` must be the project base URL (for example `https://<project-ref>.supabase.co`), not `/rest/v1`.
- `NEXT_PUBLIC_*` values are embedded at build time, so redeploy after changing them.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed in client code.

### Environment matrix

| Environment | Supabase project | Where to configure |
| --- | --- | --- |
| Local | dev/local Supabase | `evo-lift/.env.local` |
| Preview | preview/staging Supabase (recommended) | Vercel Project Settings -> Environment Variables (Preview) |
| Production | production Supabase | Vercel Project Settings -> Environment Variables (Production) |

## Deployment checklist

1. Apply schema changes from migrations:
   - `supabase db push --linked`
2. Run only production-safe seeds:
   - `supabase db query --linked --file supabase/seeds/001_exercises.sql`
   - `supabase db query --linked --file supabase/seeds/002_exercise_translations.sql`
3. Verify Vercel env vars are set for the target environment.
4. Redeploy application.
5. Smoke test:
   - `/login`
   - `/docs`
   - authenticated `GET /api/exercises?lang=en`

## Auth and API usage

- Users authenticate via Supabase Auth (email/password, OAuth, magic link, etc.).
- Frontend gets `access_token` from Supabase session.
- Backend routes use `Authorization: Bearer <access_token>` for RLS-aware requests.
- In Swagger (`/docs`), use Authorize and paste the raw token value (without adding an extra `Bearer` prefix).

## Seed policy

- Keep production-safe seeds under `supabase/seeds` (catalog/reference data).
- Keep dev-only sample/test data in separate files (for example `9xx_dev_*.sql`) and do not run these in production.
- Prefer idempotent seeds using `on conflict do nothing` or `on conflict ... do update`.

## Security notes

- Never commit `.env.local`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser/client code.
- Rotate any leaked keys/passwords immediately.

# Supabase (this project)

You **do not need Docker** unless you want the full local Supabase stack. The app talks to Postgres over `DATABASE_URL` (Drizzle + `pg`). A **hosted Supabase project** is enough.

## Cloud setup (recommended)

1. **Create a project** at [Supabase Dashboard](https://supabase.com/dashboard) (save the database password).
2. **Connection string:** **Project Settings → Database**  
   - Use **URI** and prefer **Direct connection** (port `5432`) for migrations and Drizzle.  
   - Append **`?sslmode=require`** if it is not already in the URL.  
   - Paste the full URI into **`.env.local`** as `DATABASE_URL` (never commit real URLs or passwords).
3. **Apply schema** (pick one):
   - **New empty database:** `npm run db:migrate` then `npm run db:seed`
   - **Quick dev / already in sync issues:** `npm run db:supabase:sync` (`db:push` + `db:seed`)
4. **App env:** Copy `.env.example` → `.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `DEFAULT_ORGANIZATION_ID` (see repo `README.md`).
5. **Site URL + Redirect URLs:** In Supabase **Authentication → URL Configuration**, set Site URL to your public origin (e.g. `https://aetherops-govw.vercel.app`) and add it to Redirect URLs as `https://aetherops-govw.vercel.app/**`. Add `http://localhost:3000/**` for local dev.

## What Supabase provides here

- **Managed Postgres** — primary requirement for this app
- **Auth** — sign-up, sign-in, sessions, magic links, OAuth (via `@supabase/ssr`)
- **Dashboard** — SQL editor, logs, backups, connection strings, auth user management
- **Optional later** — Storage and Realtime if you add features

## Optional CLI (no Docker required)

Link this repo folder to your cloud project if you use other Supabase CLI commands:

```bash
npm run supabase:login
npm run supabase:projects
npm run supabase:link -- --project-ref YOUR_PROJECT_REF
```

## Optional local stack (**needs Docker**)

Only if you want API + Studio + local Postgres on your machine:

```bash
npm run db:supabase:local
```

See `config.toml` for local ports (DB default `54322`).

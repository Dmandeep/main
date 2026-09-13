# Deploying to Vercel

Written for the first deploy of the CSE pilot. Everything here is a decision
someone has to make deliberately — none of it should be copied blind.

## Before anything goes public

**The seed must never run against the deployed database.** It creates an ADMIN
and an HOD account with the password `ideaspace-dev-password`, which is written
in this repository. `prisma/seed-guard.ts` refuses any non-local database, and
the override (`ALLOW_REMOTE_SEED=true`) exists only for throwaway staging.

If you want demo data in a deployed environment, create the accounts by hand
with real passwords, or point a staging deploy at a database you are willing to
throw away.

## 1. Database

Any Postgres 17 reachable from Vercel. Neon and Supabase both work; Vercel
Postgres is Neon underneath.

Two connection strings matter and they are not the same:

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | the running app | Use the **pooled** URL. Serverless functions open many short connections and will exhaust a direct connection limit. |
| `DIRECT_URL` | `prisma migrate deploy` | Use the **direct** URL. Migrations cannot run through a transaction pooler. |

`prisma/schema.prisma` currently declares only `url`. If your provider gives
separate pooled and direct URLs, add `directUrl` to the datasource block before
the first migration:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Apply migrations once, from your machine, against the production database:

```bash
DATABASE_URL="<direct url>" npx prisma migrate deploy
```

## 2. Environment variables on Vercel

Set these in Project → Settings → Environment Variables, for **Production**.

| Variable | Value | Why it changes from local |
| --- | --- | --- |
| `DATABASE_URL` | pooled Postgres URL | — |
| `DIRECT_URL` | direct Postgres URL | migrations only |
| `AUTH_SECRET` | **a new 32-byte secret** | The local one is short and has been on a developer machine. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | `https://<your-domain>` | Must match the deployed origin exactly, or OAuth callbacks fail. |
| `NEXTAUTH_URL` | `https://<your-domain>` | Same. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from Google Cloud console | — |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | from GitHub OAuth app | — |
| `REDIS_URL` | optional | Without it every background job runs inline in the request, which is a supported configuration. With it, run a worker (below). |
| `ALLOW_DEV_AUTH` | **never set this** | `src/lib/auth.ts` throws on boot if it is set in production. It enables passwordless sign-in as any user. |

`GITHUB_PAT` and the Pusher variables are optional. Without Pusher, upvotes
still persist correctly; only live updates to other people's open tabs stop.

## 3. OAuth callback URLs

Both providers must be told the new origin, or sign-in fails with a redirect
mismatch. Add these **alongside** the localhost ones so local development keeps
working:

- Google Cloud → Credentials → your OAuth client → Authorised redirect URIs:
  `https://<your-domain>/api/auth/callback/google`
- GitHub → Settings → Developer settings → OAuth Apps → Authorization callback URL:
  `https://<your-domain>/api/auth/callback/github`

Vercel preview deployments get a different URL each time, so OAuth will not work
on previews unless you add those URLs too. Password sign-in still works there.

## 4. Domain allowlist

Sign-in is restricted to institutional domains, read from the `Institution`
table rather than hard-coded. A fresh production database has no rows, so
**nobody can sign in** until you add one:

```bash
DATABASE_URL="<direct url>" npx tsx prisma/.checks/allow-domain.ts add lendi.edu.in
```

## 5. The worker (optional)

Only if `REDIS_URL` is set. Vercel does not run long-lived processes, so the
worker needs somewhere else — a small VM, Railway, or Fly:

```bash
npm run worker
```

Without it, queued jobs are never consumed. The app still works: every job has
an inline fallback, but scheduled maintenance (evidence-counter reconcile,
standing recompute, waitlist sweep) will not run on its own. If you are not
running a worker, leave `REDIS_URL` unset so jobs execute inline.

## 6. After the first deploy

```bash
# Does the deployed app behave for every role?
AUDIT_BASE=https://<your-domain> npm run audit
AUDIT_BASE=https://<your-domain> npm run matrix
```

Both sign in with seeded passwords, so they only work against an environment
that has those accounts — which production should not. Treat them as staging
tools.

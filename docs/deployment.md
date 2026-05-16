# SpliceForge — Deployment & Operations Guide

This document covers environment setup, local development, production deployment, and common troubleshooting for IT managers and DevOps engineers.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Variables](#2-environment-variables)
3. [Supabase Project Setup](#3-supabase-project-setup)
4. [Local Development](#4-local-development)
5. [Production Deployment (Vercel)](#5-production-deployment-vercel)
6. [Self-Hosted Deployment (Docker)](#6-self-hosted-deployment-docker)
7. [Auth Flow Overview](#7-auth-flow-overview)
8. [Common Troubleshooting](#8-common-troubleshooting)
9. [Database Maintenance](#9-database-maintenance)

---

## 1. Prerequisites

| Tool | Minimum Version | Notes |
|---|---|---|
| Node.js | 20 LTS | Required by Next.js 16 |
| npm | 10+ | Comes with Node 20 |
| Git | any | |
| Supabase account | — | Free tier sufficient for development |

---

## 2. Environment Variables

Create a `.env.local` file at the repository root (never commit this file):

```env
# ── Supabase (required) ──────────────────────────────────────
# Found in: Supabase Dashboard → Project Settings → API

# Public URL of your Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co

# Anon (public) key — safe to expose to the browser
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Service role key — NEVER expose to the browser or commit to git
# Used only in server-side code for admin operations (org management, invites)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ── App URL (required for invite emails) ─────────────────────
# Full public URL of your deployment (no trailing slash)
# Used as the redirect base in organization invite emails
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# ── Rate limiting (recommended in production) ────────────────
# When both are set, the invite-validation rate limiter switches from a
# per-instance in-memory bucket to a shared Upstash Redis store, so the
# limit holds across serverless instances.
# Get them from: https://console.upstash.com → REST API
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# ── Tier configuration ───────────────────────────────────────
# Optional. Defaults to 5. Number of users allowed per organization.
MAX_MEMBERS_PER_ORG=5
```

### Variable Reference

| Variable | Required | Exposure | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public | Anon key for browser + SSR |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Server only** | Admin operations (org tables, invite emails) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public | Base URL for invite email callback links |
| `UPSTASH_REDIS_REST_URL` | Recommended | **Server only** | Distributed rate limiter backend |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | **Server only** | Distributed rate limiter backend |
| `MAX_MEMBERS_PER_ORG` | Optional | **Server only** | Org size cap (default 5) |

> Env vars are validated at boot by `src/env.ts` (Zod schema). A missing required var fails fast at startup with a clear "Missing env var X" message instead of a cryptic runtime crash on the first request.

> **Security:** The `SUPABASE_SERVICE_ROLE_KEY` bypasses all Row-Level Security policies. It must never be included in client-side bundles. In the codebase it is only imported inside `src/lib/supabase/admin.ts`, which is called exclusively from Server Actions (files with `"use server"` directive).

---

## 3. Supabase Project Setup

### 3.1 Create the Project

1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region close to your users.
3. Note down the **Project URL** and both API keys (Settings → API).

### 3.2 Run the Schema

Open the **SQL Editor** in the Supabase dashboard and run the full contents of `docs/sql-schema.sql`.

This creates all tables, indexes, foreign-key constraints, RLS policies, and the `splice_summary` view in the correct order.

### 3.2.1 Apply RPC Migrations

After running the base schema, apply the RPC migrations in `docs/migrations/`, in date order:

1. `docs/migrations/2026-05-12-org-rpc.sql` — adds `create_org_with_owner(name, user_id)` for atomic org + owner provisioning.
2. `docs/migrations/2026-05-12-invite-rpc.sql` — adds `consume_invite_token(token_hash, user_id)` for atomic invite consumption with a row-level lock.

Both files use `CREATE OR REPLACE FUNCTION` and revoke privileges from `anon`/`authenticated`, so they are safe to re-apply.

> **Tip:** You can also use the Supabase CLI:
> ```bash
> supabase db push --db-url "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
> ```

### 3.3 Enable Email Auth

1. In Supabase Dashboard → **Authentication → Providers**, ensure **Email** is enabled.
2. Under **Email Templates**, customize the invite email if desired.
3. Under **URL Configuration**, add your site URL and the callback route to the allowed list:
   - **Site URL:** `https://your-domain.com`
   - **Redirect URLs:** `https://your-domain.com/auth/callback`

### 3.4 SMTP (Optional but Recommended for Production)

For organization invite emails to be deliverable, configure a custom SMTP provider in Supabase Dashboard → **Authentication → SMTP Settings**. The default Supabase SMTP has strict rate limits.

---

## 4. Local Development

```bash
# 1. Clone the repository
git clone <repo-url> SpliceForge
cd SpliceForge

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Run the development server
npm run dev
```

The app is available at **http://localhost:3000**.

### First Run Checklist

- [ ] Open http://localhost:3000/signup and create the first user account.
- [ ] Verify you are redirected to `/dashboard` after signup.
- [ ] Create a project and bedsheet from the dashboard.
- [ ] Open the canvas and add a Cable node — if it persists after reload, Supabase is connected correctly.

---

## 5. Production Deployment (Vercel)

Vercel is the recommended platform for Next.js App Router apps.

### 5.1 Connect the Repository

1. In [vercel.com](https://vercel.com), click **Add New → Project**.
2. Import the repository from GitHub/GitLab.
3. Framework preset should auto-detect as **Next.js**.

### 5.2 Set Environment Variables

In Vercel → Project → **Settings → Environment Variables**, add all four variables from Section 2. Set `NEXT_PUBLIC_SITE_URL` to your Vercel deployment URL (e.g., `https://spliceforge.vercel.app`).

### 5.3 Deploy

Push to your main branch. Vercel automatically builds and deploys.

Verify:
- `/login` renders without errors.
- Signing in redirects to `/dashboard`.
- Canvas saves and loads nodes correctly.

---

## 6. Self-Hosted Deployment (Docker)

For air-gapped or on-premises environments you can run the app as a Docker container.

```dockerfile
# Dockerfile (add to repo root if not present)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
# Build
docker build -t spliceforge .

# Run (pass all env vars)
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e NEXT_PUBLIC_SITE_URL=http://your-internal-host:3000 \
  spliceforge
```

> **Note:** `next.config.ts` must include `output: "standalone"` for the Docker build to work. Verify this setting before building.

---

## 7. Auth Flow Overview

```
User visits /login or /signup
    │
    ▼
Supabase Auth (email + password)
    │
    │── Success ──► middleware.ts checks session
    │                    │
    │                    ├── /dashboard or /canvas → allow
    │                    └── /login or /signup with session → redirect to /dashboard
    │
    │── Invite email flow:
    │       Owner clicks "Invite" → inviteUserByEmail() sends Supabase magic link
    │       Link → /auth/callback?token=...
    │       /auth/callback exchanges token for session → redirect to /dashboard
    │
    └── Join by link flow:
            User receives /join?token=<hex>
            Page validates token → joinOrganizationByToken()
            User is added as 'editor' to the organization
```

### Auth Routes

| Route | Description |
|---|---|
| `/login` | Email + password sign-in |
| `/signup` | New account registration |
| `/auth/callback` | Supabase OAuth / magic-link callback |
| `/join?token=<hex>` | Accept organization invite by link |

### Protected Routes

`/dashboard` and `/canvas/*` require an authenticated session. The `middleware.ts` at the project root enforces this — unauthenticated requests are redirected to `/login`.

---

## 8. Common Troubleshooting

### "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"

The server action that manages organizations or sends invites cannot find the required env vars. Ensure `.env.local` exists locally or that all four variables are set in your hosting dashboard.

### Canvas loads but nodes don't save / "Splice failed" toast

1. Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct.
2. In Supabase Dashboard → **Table Editor**, check that the `elements` and `ports` tables exist and have the RLS policies from `docs/sql-schema.sql`.
3. Check browser console for `403` errors — this means RLS is denying the write. Re-run the policy section of the schema.

### Invite emails not received

1. Check Supabase Dashboard → **Authentication → Logs** for email delivery errors.
2. Ensure `NEXT_PUBLIC_SITE_URL` matches the allowed redirect URL registered in Supabase Auth settings.
3. For production, configure a custom SMTP provider (see Section 3.4).

### "Maximum 5 users per company in test mode"

The `inviteMember` server action enforces a hard cap of 5 members per organization. To raise this limit, edit the check in `src/lib/actions/organizations.ts`:

```typescript
// Current:
if ((count ?? 0) >= 5) throw new Error("Maximum 5 users per company in test mode");

// To raise to 25:
if ((count ?? 0) >= 25) throw new Error("Maximum 25 users per organization");
```

### Page loads slowly with >500 ports

Port fetching is paginated in 1000-row batches (`getPortsByElements`). If a single page has more than 1000 ports, multiple sequential Supabase requests fire. Consider splitting very large pages across multiple bedsheet pages using Continuation nodes.

### Undo after page refresh reverts DB changes

The undo/redo system performs DB sync on undo (deletes splices and elements added after the undo target). However, history is in-memory only — refreshing clears it. If a user undoes, then refreshes, the canvas reloads from the current DB state (which was already synced by the undo). This is expected behavior.

---

## 9. Database Maintenance

### Checking splice counts per page

```sql
SELECT
  p.title,
  COUNT(s.id) AS splice_count
FROM splices s
JOIN ports pf      ON pf.id = s.port_from
JOIN elements e    ON e.id  = pf.element_id
JOIN pages p       ON p.id  = e.page_id
GROUP BY p.id, p.title
ORDER BY splice_count DESC;
```

### Finding orphaned ports (element deleted but ports remain)

This should not occur due to `ON DELETE CASCADE`, but to verify:

```sql
SELECT p.id, p.element_id
FROM ports p
LEFT JOIN elements e ON e.id = p.element_id
WHERE e.id IS NULL;
```

### Purging a project and all its data

```sql
-- Cascades through bedsheets → pages → elements → ports → splices
DELETE FROM projects WHERE id = '<project-uuid>';
```

### Backing up before schema changes

```bash
pg_dump "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
  --no-acl --no-owner -F c -f spliceforge_backup_$(date +%Y%m%d).dump
```

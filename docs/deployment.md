# SpliceForge — Self-Hosting Guide

SpliceForge is an open-source (AGPL-3.0) fiber-optic network editor. It runs on **Node.js + PostgreSQL** with **Better Auth** for sessions. No managed services required — you own your database and your users.

This guide covers local development, production self-hosting, and troubleshooting for the people who actually run the servers.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Environment variables](#2-environment-variables)
3. [Database setup](#3-database-setup)
4. [Local development](#4-local-development)
5. [Production self-hosting](#5-production-self-hosting)
   - [Bare-metal / VM (Node + systemd)](#51-bare-metal--vm-node--systemd)
   - [Docker](#52-docker)
   - [Behind a reverse proxy (nginx / Caddy)](#53-behind-a-reverse-proxy)
6. [Auth flow overview](#6-auth-flow-overview)
7. [Common troubleshooting](#7-common-troubleshooting)
8. [Database maintenance](#8-database-maintenance)
9. [Upgrading](#9-upgrading)

---

## 1. Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 20 LTS | Required by Next.js 16 |
| npm | 10+ | Comes with Node 20 |
| Git | any | |
| PostgreSQL | 13+ | Vanilla — any distribution (Postgres.app, EDB installer, apt/brew, RDS, Neon, Fly.io Postgres, etc.) |

No account is required with any third party. You never need Docker unless you choose to use it as your process manager.

---

## 2. Environment variables

Create `.env.local` at the repository root (never commit this file — `.gitignore` already excludes it):

```env
# ── Required ────────────────────────────────────────────────
# Postgres connection string. Example for a local install:
DATABASE_URL=postgres://postgres:postgres@localhost:5432/spliceforge

# 32+ character secret used by Better Auth to sign session cookies.
# Generate on Linux/macOS:  openssl rand -base64 32
# Generate on Windows:      [Convert]::ToBase64String((1..32|%{[byte](Get-Random -Max 256)}))
BETTER_AUTH_SECRET=change-me-to-a-32-character-random-string

# ── Recommended ─────────────────────────────────────────────
# Public base URL of your deployment. Used by Better Auth for callbacks
# and CSRF checks. Defaults to http://localhost:7000 if unset.
NEXT_PUBLIC_SITE_URL=https://spliceforge.example.com

# ── Optional ────────────────────────────────────────────────
# Per-organization member cap. Raise it for larger teams.
MAX_MEMBERS_PER_ORG=50

# When both Upstash vars are present, the in-memory invite-validation
# rate limiter is replaced by a shared Redis-backed limiter — useful when
# you run more than one Node process behind a load balancer.
# UPSTASH_REDIS_REST_URL=https://...upstash.io
# UPSTASH_REDIS_REST_TOKEN=...
```

### Variable reference

| Variable | Required | Exposure | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | **Server only** | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes (prod) | **Server only** | Signs session cookies; must be 16+ chars |
| `NEXT_PUBLIC_SITE_URL` | No | Public | Public URL of the deployment |
| `MAX_MEMBERS_PER_ORG` | No | **Server only** | Per-org member cap (default `5`) |
| `UPSTASH_REDIS_REST_URL` | No | **Server only** | Distributed rate-limit backend |
| `UPSTASH_REDIS_REST_TOKEN` | No | **Server only** | Distributed rate-limit backend |

> **Env vars are validated lazily** in `src/env.ts`. `next build` supplies placeholders during the build phase so CI/CD can produce a build image without touching real credentials. Runtime start-up will still fail fast if a required var is missing.

> **Never** expose `DATABASE_URL` or `BETTER_AUTH_SECRET` in a `NEXT_PUBLIC_*` variable, or embed them in a client bundle.

---

## 3. Database setup

### 3.1 Create the database

Local (native Postgres install):

```bash
createdb spliceforge
```

Local (Docker Postgres, one-liner):

```bash
docker run --name spliceforge-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
docker exec -it spliceforge-pg createdb -U postgres spliceforge
```

Managed Postgres (Neon, RDS, Fly.io Postgres, Railway, Render, DigitalOcean, etc.): create the database through the provider's UI and copy the connection string into `DATABASE_URL`. Any provider that exposes standard Postgres works — SpliceForge doesn't rely on any vendor-specific extension.

### 3.2 Apply the schema

```bash
npm run db:init
```

This runs `scripts/db-init.mjs`, which loads `.env.local`, resolves `psql` (checking `$PSQL` first for a custom path), and applies `db/schema.sql` with `ON_ERROR_STOP=1`. The schema is idempotent (`CREATE TABLE IF NOT EXISTS`), so it's safe to re-apply after upgrades.

The schema creates:

- **4 auth tables** owned by Better Auth (`user`, `session`, `account`, `verification`)
- **10 domain tables** for multi-tenant isolation and canvas data
- **1 view** (`splice_summary`)
- **3 RPCs** (`create_org_with_owner`, `consume_invite_token`, `import_bundle`) — plain PL/pgSQL, no vendor extensions.

The only Postgres extension required is `pgcrypto` (for `gen_random_uuid()`), which is bundled with every mainstream Postgres distribution.

### 3.3 Windows tip

If `psql` isn't on your PATH after installing PostgreSQL, point the runner at the binary:

```powershell
$env:PSQL = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
npm run db:init
```

---

## 4. Local development

```bash
git clone https://github.com/wascal191/SpliceForge.git
cd SpliceForge
npm install
cp .env.local.example .env.local        # then edit values
createdb spliceforge                     # or use Docker; see 3.1
npm run db:init
npm run dev
```

The dev server listens on **http://localhost:7000**. To try the app without creating an account, visit **http://localhost:7000/demo** — a read-only canvas preview.

### First-run checklist

- [ ] `/signup` → create the first user (no phone, org name is optional).
- [ ] Auto-redirects to `/dashboard` with a seeded FTTH demo project.
- [ ] Open the canvas, drag a node, add a splice — the change persists after refresh.
- [ ] From the Team menu, generate an invite link and open it in a private window to confirm the join flow.
- [ ] Sign out and sign back in.

Email verification is **disabled by default**; the account is active the moment you click "Create account". To require verification, see [Enabling email verification](#61-enabling-email-verification) below.

---

## 5. Production self-hosting

You need three things running:

1. A PostgreSQL instance you control.
2. A Node.js process serving the built app.
3. A reverse proxy fronting HTTPS (recommended).

Nothing else is required — no CDN, no managed auth, no vendor lock-in.

### 5.1 Bare-metal / VM (Node + systemd)

```bash
# On the target server
git clone https://github.com/wascal191/SpliceForge.git /opt/spliceforge
cd /opt/spliceforge
npm ci --omit=dev
npm run build

# Set env vars (choose your preferred mechanism)
cp .env.local.example /etc/spliceforge.env
# edit /etc/spliceforge.env with your production values
```

Example systemd unit at `/etc/systemd/system/spliceforge.service`:

```ini
[Unit]
Description=SpliceForge
After=network.target postgresql.service

[Service]
Type=simple
User=spliceforge
WorkingDirectory=/opt/spliceforge
EnvironmentFile=/etc/spliceforge.env
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/spliceforge/.next

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now spliceforge
sudo systemctl status spliceforge
```

> `.next/standalone/server.js` is produced by `npm run build` when `output: "standalone"` is set in `next.config.ts`. If you prefer the plain runtime, `ExecStart=/usr/bin/npm start` works too but has a larger memory footprint.

### 5.2 Docker

A minimal multi-stage Dockerfile:

```dockerfile
# ── Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/db ./db
EXPOSE 7000
ENV PORT=7000
CMD ["node", "server.js"]
```

Build and run:

```bash
docker build -t spliceforge .

docker run --rm -p 7000:7000 \
  -e DATABASE_URL='postgres://user:pass@db.internal:5432/spliceforge' \
  -e BETTER_AUTH_SECRET='<32-plus-char-secret>' \
  -e NEXT_PUBLIC_SITE_URL='https://spliceforge.example.com' \
  spliceforge
```

Apply the schema once against your production database:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

You can also run `npm run db:init` from inside a one-shot container that mounts the repo, or bake a small init container that runs the SQL and exits.

### 5.3 Behind a reverse proxy

TLS termination should happen in your reverse proxy, not in Node. Point the proxy at `localhost:7000`.

**Caddy** (`/etc/caddy/Caddyfile`):

```
spliceforge.example.com {
    reverse_proxy localhost:7000
}
```

**nginx** (excerpt):

```
server {
    listen 443 ssl http2;
    server_name spliceforge.example.com;

    ssl_certificate     /etc/letsencrypt/live/spliceforge.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/spliceforge.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:7000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Set `NEXT_PUBLIC_SITE_URL=https://spliceforge.example.com` so Better Auth generates correct callback URLs.

---

## 6. Auth flow overview

```
Visitor → /signup
    │
    ├─ authClient.signUp.email({email, password, name})
    │        POST /api/auth/sign-up/email  (Better Auth)
    │        Inserts row in "user"; opens a "session" row
    │
    ├─ createOrganization(orgName) server action
    │        Runs create_org_with_owner RPC atomically:
    │            organizations row + organization_members(role='owner')
    │
    └─ Redirect → /dashboard
             │
             └─ Seeded FTTH demo project appears on first visit
```

```
Owner → Team menu → Create invite link
    │
    ├─ createInviteToken()
    │        Insert into organization_invites (token_hash, max_uses, expires_at)
    │        Returns the raw token exactly once → owner copies the /join/<token> URL
    │
Visitor → /join/<token>
    │
    ├─ validateInviteToken(token)   [read-only, rate-limited per IP]
    │
    ├─ Not signed in: authClient.signUp.email(...) → session
    │
    └─ joinOrganizationByToken(token)
              consume_invite_token RPC:
                  locks the invite row, checks cap + expiry,
                  inserts organization_members(role='editor'),
                  decrements uses (or deletes if drained)
```

### Auth routes

| Route | Description |
|---|---|
| `/login` | Email + password sign-in |
| `/signup` | New account (name, email, password; org name optional) |
| `/join/<token>` | Accept an org invite link |
| `/api/auth/[...all]` | Better Auth catch-all (sign-in, sign-up, sign-out, session, etc.) |

### Protected routes

`/dashboard` and `/canvas/*` require an authenticated session. `src/proxy.ts` (Next.js 16 middleware) reads the Better Auth cookie and redirects unauthenticated requests to `/login`.

The `/demo` route is unauthenticated by design — anyone can preview the canvas without an account.

### 6.1 Enabling email verification

Email verification is off by default so self-hosters can run the app without configuring an SMTP transport. To turn it on:

1. Edit `src/lib/auth.ts` and set `requireEmailVerification: true`.
2. Configure a transactional email provider (Resend, Postmark, SES, etc.) — see Better Auth's docs for the `emailVerification.sendVerificationEmail` hook.
3. Rebuild and redeploy.

Existing users won't be affected retroactively; only new signups are gated.

---

## 7. Common troubleshooting

### `db:init` prompts for a password or errors "connection refused"

- Postgres isn't running, or `DATABASE_URL` in `.env.local` is wrong. Confirm the service:
  - Linux: `systemctl status postgresql`
  - macOS: `brew services list`
  - Windows: `services.msc` → `postgresql-x64-<version>`
  - Docker: `docker ps` should show your Postgres container.
- Windows: if `psql` can't be found, set `$env:PSQL = "C:\Program Files\PostgreSQL\<version>\bin\psql.exe"` before running `npm run db:init`.

### "Invalid server env vars — DATABASE_URL: Required"

`.env.local` is missing or doesn't include `DATABASE_URL`. This message can appear at runtime even if you set the value in `Program Files → Environment Variables` on Windows — Node reads from the process environment at start, so ensure the systemd unit / Docker `-e` flag / shell session actually carries the value.

### Canvas nodes don't persist after a reload

- Confirm the database has the domain tables: `psql "$DATABASE_URL" -c "\dt"` should list `elements`, `ports`, `splices` (and others). If they're missing, re-run `npm run db:init`.
- Look at the server log — server actions log errors with `[actions.<name>]` prefixes.

### Users can't see each other's data (expected)

Multi-tenant isolation is enforced at the application layer: every server-action query filters by `organization_id = ctx.orgId`. There is intentionally no RLS. Users only see rows in their own organization.

### "Maximum N members per organization"

The cap comes from `MAX_MEMBERS_PER_ORG`. Raise it and restart the app. Note that the same limit is hard-coded in the `consume_invite_token` RPC — if you raise the app-level cap, also update the `v_max_members` constant in `db/schema.sql` and re-apply.

### Sessions get invalidated after each redeploy

Better Auth signs cookies with `BETTER_AUTH_SECRET`. If the secret changes between restarts, all sessions become invalid. Persist the same secret across deploys (secret manager, `EnvironmentFile`, Docker secret, etc.).

### `npm run build` errors while collecting page data

Ensure your build environment either supplies `DATABASE_URL` and `BETTER_AUTH_SECRET` (any values pass validation) **or** relies on the built-in build-phase placeholders (default). If your build tool strips `NEXT_PHASE`, set the two vars to any non-empty strings during the build step.

### Page loads slowly with >500 ports

Port fetching is paginated in 1000-row batches (`getPortsByElements`). If a single page has more than 1000 ports, multiple sequential queries fire. Split very large pages across bedsheet pages using Continuation nodes.

### Undo after page refresh looks unexpected

Undo/redo is in-memory only — refreshing clears the history. The canvas reloads from the current DB state (which reflects all committed writes, including the ones you had undone before refreshing).

---

## 8. Database maintenance

### Splice counts per page

```sql
SELECT
  p.title,
  COUNT(s.id) AS splice_count
FROM splices s
JOIN ports pf   ON pf.id = s.port_from
JOIN elements e ON e.id  = pf.element_id
JOIN pages p    ON p.id  = e.page_id
GROUP BY p.id, p.title
ORDER BY splice_count DESC;
```

### Finding orphaned ports

Cascades should prevent this, but to double-check:

```sql
SELECT p.id, p.element_id
FROM ports p
LEFT JOIN elements e ON e.id = p.element_id
WHERE e.id IS NULL;
```

### Purging a project

```sql
-- Cascades through bedsheets → pages → elements → ports → splices
DELETE FROM projects WHERE id = '<project-uuid>';
```

### Removing a user (GDPR / account deletion)

Deleting the row in `"user"` cascades through `"session"`, `"account"`, `organization_members`, and `organization_invites.created_by`. Domain data owned by their organization stays in place unless you also delete the org:

```sql
DELETE FROM "user" WHERE id = '<user-id>';
```

If they were the last owner of an org and you want to remove that data too:

```sql
DELETE FROM organizations WHERE id = '<org-id>';
```

### Backup

```bash
pg_dump "$DATABASE_URL" \
  --no-acl --no-owner -F c \
  -f spliceforge_$(date +%Y%m%d).dump
```

Restore into a fresh database:

```bash
createdb spliceforge_restore
pg_restore -d spliceforge_restore -F c spliceforge_YYYYMMDD.dump
```

### Analyze / vacuum

Autovacuum handles the common case, but for very active deployments a nightly `VACUUM (ANALYZE)` on the busy tables (`ports`, `splices`, `elements`) keeps the query planner honest.

---

## 9. Upgrading

1. Pull the new code: `git pull`.
2. Reinstall dependencies: `npm ci`.
3. Re-apply the schema: `npm run db:init`. The schema is idempotent — new tables/columns/functions are added, existing ones are left alone. If a release ships a breaking schema change, its release notes will call out a required migration script.
4. Rebuild: `npm run build`.
5. Restart the service: `systemctl restart spliceforge` (or your equivalent).

Because `BETTER_AUTH_SECRET` is preserved, users stay signed in across upgrades.

---

## Anything missing?

Deployment gaps, ambiguous instructions, and platform-specific gotchas all deserve issues. Open one at https://github.com/wascal191/SpliceForge/issues and tag it `docs`.

# SpliceForge — Pre-Launch Checklist

Working document. Tick boxes as you go. Sections are ordered by blocker severity: **A** must pass before *any* production traffic; **B** before public launch / charging money; **C** is post-launch hardening that can wait.

Owner: ___________ Target launch date: ___________

---

## A. Hard blockers (no prod traffic until all green)

### A1. Database migrations applied

- [x] In Supabase Studio → SQL Editor, run [`docs/migrations/2026-05-12-org-rpc.sql`](migrations/2026-05-12-org-rpc.sql).
- [x] Run [`docs/migrations/2026-05-12-invite-rpc.sql`](migrations/2026-05-12-invite-rpc.sql).
- [x] Verify both RPCs exist:
  ```sql
  SELECT proname FROM pg_proc
  WHERE proname IN ('create_org_with_owner', 'consume_invite_token');
  -- expect 2 rows
  ```
- [x] Verify `anon` and `authenticated` cannot call them:
  ```sql
  SELECT grantee, privilege_type FROM information_schema.routine_privileges
  WHERE routine_name IN ('create_org_with_owner','consume_invite_token');
  -- only postgres / service_role should appear
  ```

### A2. Schema parity

The runtime DB must have every column the app references.

- [x] `organization_id` exists on `projects`, `bedsheets`, `pages`, `elements`, `ports`, `splices`, `library_cables`:
  ```sql
  SELECT table_name FROM information_schema.columns
  WHERE column_name = 'organization_id'
    AND table_schema = 'public'
  ORDER BY table_name;
  -- expect all 7 tenant tables
  ```
- [x] `organization_invites` has `token_hash`, `expires_at`, `uses`, `max_uses`:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'organization_invites' AND table_schema = 'public';
  ```
- [x] `ports.fiber_count` exists (used by `duplicatePage`).
- [x] No rows have `NULL` in `organization_id` on tenant tables:
  ```sql
  SELECT 'projects'      AS t, count(*) FROM projects      WHERE organization_id IS NULL
  UNION ALL SELECT 'bedsheets', count(*) FROM bedsheets    WHERE organization_id IS NULL
  UNION ALL SELECT 'pages',     count(*) FROM pages        WHERE organization_id IS NULL
  UNION ALL SELECT 'elements',  count(*) FROM elements     WHERE organization_id IS NULL
  UNION ALL SELECT 'ports',     count(*) FROM ports        WHERE organization_id IS NULL
  UNION ALL SELECT 'splices',   count(*) FROM splices      WHERE organization_id IS NULL
  UNION ALL SELECT 'library',   count(*) FROM library_cables WHERE organization_id IS NULL;
  -- expect all counts = 0; backfill before tightening RLS policies
  ```

### A3. Required env vars set in Vercel (Production environment)

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_SITE_URL` — exact production domain, no trailing slash, scheme included
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — needed for distributed rate limiting; without them, the in-app limiter is per-instance only and gives no real DoS protection
- [ ] `MAX_MEMBERS_PER_ORG` if changing from the default of 5 (⚠️ also update the constant in [`docs/migrations/2026-05-12-invite-rpc.sql`](migrations/2026-05-12-invite-rpc.sql) — see C5)

### A4. Supabase auth configuration

- [ ] **Site URL** = `${NEXT_PUBLIC_SITE_URL}`
- [ ] **Redirect URLs** allow-list includes `${NEXT_PUBLIC_SITE_URL}/auth/callback`
- [ ] Custom SMTP configured (not Supabase's default — it throttles after ~3 invites/hour). Resend / SendGrid / SES all work.
- [ ] Email templates customized (especially the invite email — default is generic).

### A5. End-to-end smoke test

Do this in **incognito tabs** against the production deploy, not localhost.

- [ ] **Signup A.** New user signs up with company name → confirmation email arrives → click link → lands on `/dashboard` with org created.
  - Verify in SQL Editor: `SELECT * FROM organizations ORDER BY created_at DESC LIMIT 1;` shows the new org.
  - Verify: `SELECT * FROM organization_members WHERE user_id = '<user-id>';` shows role = `owner`.
- [ ] **Invite flow.** From user A's dashboard, generate invite link → copy it.
- [ ] **Signup B.** Incognito tab, paste link → join page shows org name → sign up → lands on dashboard. Verify user B is `editor` in the same org.
- [ ] **Cap enforcement.** Repeat to add users C, D, E. Try a 6th — should see "This organization is full" message, no extra row in `organization_members`.
- [ ] **Canvas.** As owner, open a fresh bedsheet → Page 1 seeds automatically → add a cable → splice two ports → reload page → data persists.
- [ ] **Page-switch save.** In PageSidebar, type into the header field, immediately switch pages. Wait 5 seconds. Switch back. The header should be saved on the original page, not the new one (validates the timer-cleanup fix).
- [ ] **Cross-tenant isolation.** With user from org A logged in, attempt to fetch a bedsheet from org B via URL guess (`/canvas/<known-bedsheet-id-in-other-org>`). Should 404, not show data.

### A6. Build & CI green

- [x] `npm run typecheck` — clean locally
- [x] `npm run lint` — 0 errors (warnings OK)
- [x] `npm test -- --run` — 38/38 pass
- [x] `npm run build` — succeeds
- [x] GitHub Actions CI passes on the commit being deployed
- [x] Vercel deployment shows "Ready" with no build warnings

---

## B. Should-do before public launch / paid customers

### B1. Observability

- [ ] Sentry (or Logflare/Axiom) wired to capture server errors. Without this, the `console.error` calls in [errors.ts](../src/lib/errors.ts), [guards.ts](../src/lib/guards.ts), and the auth callback are screaming into the void.
- [ ] Source maps uploaded to Sentry so stack traces are readable.
- [ ] Alert configured: notify on >5 errors / 5 minutes.

### B2. Rate limiting beyond the app

- [ ] Vercel WAF rule or Cloudflare-in-front: limit `POST /auth/callback`, `/login`, `/signup`, `/join/*` to ~30 req/min per IP.
- [ ] Test it works: hammer `/login` from a single IP with `wrk` or `curl` loop, confirm 429s.

### B3. Backups

- [ ] Supabase project is on a paid tier with **Point-in-Time Recovery** enabled (free tier = nightly snapshots only).
- [ ] Restore procedure documented somewhere a non-Claude human can find it (1 paragraph: "log into supabase.com, project → Database → Backups → Restore to new project").
- [ ] Test restore once on a throwaway project — proves the backup is real.

### B4. Security headers verified in production

Run after deploy:
```bash
curl -I https://your-domain.com | grep -iE "content-security-policy|strict-transport|x-frame"
```
- [ ] `Content-Security-Policy` present
- [ ] `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- [ ] `X-Frame-Options: DENY`

### B5. Vulnerability sweep

- [ ] `npm audit` — investigate the current 7 findings (6 moderate, 1 high). `npm audit fix` or document why they're false positives.
- [ ] No `process.env.*` references in client bundles. Check with:
  ```bash
  grep -rl "process.env" .next/static 2>/dev/null
  # expect empty
  ```

### B6. Legal & compliance

- [ ] Privacy policy linked in footer (especially if marketing to EU customers — GDPR).
- [ ] Terms of service.
- [ ] Cookie banner if you ever add analytics — currently the app has no cookies beyond the auth session, which is essential and exempt.
- [ ] Account deletion flow (or a "contact us to delete" mailto: as a stopgap).

### B7. Email deliverability

- [ ] SPF, DKIM, DMARC records published for the sender domain.
- [ ] Send-from address uses your domain, not `noreply@supabase.io`.
- [ ] Test invite email lands in Gmail / Outlook **inbox** (not spam) — send to test accounts on each major provider.

### B8. Support inbox

- [ ] Real email (`support@your-domain.com` or whatever) monitored. Surfaced somewhere in the UI when an error happens.
- [ ] Add the error `digest` from [`src/app/error.tsx`](../src/app/error.tsx) into your support workflow so users referencing it can be cross-checked against Sentry.

---

## C. Post-launch hardening (can wait)

### C1. Performance

- [ ] Lighthouse on `/dashboard` and `/canvas/[id]` — note the LCP and TBT. If TBT > 500ms, dynamically import MapLibre and ReactFlow (P2 item from the review).
- [ ] Test canvas with 50+ elements & 500+ splices — measure FPS during drag and trace. Profile if jank appears.

### C2. Test coverage gaps

- [ ] Integration test for the full signup → invite → join flow using Supabase's `supabase-test-db` or a disposable project.
- [ ] Test for the `joinOrganizationByToken` cap enforcement (currently only the RPC has been tested via the live smoke test).
- [ ] Test for `updateSpliceWithPropagation` — splice color/comment propagation across closure ports.

### C3. Deferred lint cleanup

The React 19 hooks-plugin warnings are currently downgraded to warnings in [`eslint.config.mjs`](../eslint.config.mjs). Fix incrementally as you touch the affected files:
- [ ] `FiberCanvas.tsx` — refs assigned in render body (`nodesRef.current = nodes` at line ~194)
- [ ] `Toolbar.tsx` — `IconBtn` and `ToolBtn` declared inside the component → move outside
- [ ] `SpliceEdge.tsx` — `setState` inside effects → refactor to derived state
- [ ] `BedsheetGrid.tsx` — `setLoading(true)` synchronously inside effect

### C4. Refactor opportunities (P2 from the original review)

- [ ] Dynamic import for MapLibre/ReactFlow (drops initial bundle on login/dashboard)
- [ ] `canvasStore.traceEntries: Map` → `Record<string, string>` (enables future Zustand persist)
- [ ] Extract `useCanvasData` / `useBulkPortConnect` / `useCanvasClipboard` hooks from the 600-line `FiberCanvas`

### C5. Member-cap constant drift

The cap is hard-coded in two places:
- App: `MAX_MEMBERS_PER_ORG` in [`src/env.ts`](../src/env.ts) (default 5, env-configurable)
- DB: `v_max_members CONSTANT INTEGER := 5;` in [`docs/migrations/2026-05-12-invite-rpc.sql`](migrations/2026-05-12-invite-rpc.sql)

If you change the env value, the RPC won't reflect it. Pick one:
- [ ] Pass the cap to the RPC as a parameter (call site: [`src/lib/actions/invites.ts`](../src/lib/actions/invites.ts))
- [ ] Accept that it's two values and document both must be updated together

### C6. Operational runbook

A short doc (or pinned Slack thread) for the next person on call. Cover:
- [ ] How to read Vercel logs / Sentry
- [ ] How to roll back a deploy (`vercel rollback`)
- [ ] How to restore from Supabase backup
- [ ] How to rotate `SUPABASE_SERVICE_ROLE_KEY` if leaked (Supabase Studio → Settings → API → Reset, then update Vercel env, then redeploy)
- [ ] Common error messages and what they actually mean

---

## Quick reference — known-good queries

**Org member counts:**
```sql
SELECT o.name, count(m.id) AS members
FROM organizations o
LEFT JOIN organization_members m ON m.organization_id = o.id
GROUP BY o.id ORDER BY members DESC;
```

**Orphaned data check (shouldn't return rows after A2):**
```sql
SELECT 'pages' AS table, count(*) FROM pages p
  LEFT JOIN bedsheets b ON b.id = p.bedsheet_id
  WHERE b.id IS NULL OR p.organization_id <> b.organization_id;
```

**Active invites:**
```sql
SELECT organization_id, expires_at, uses, max_uses
FROM organization_invites
WHERE expires_at > now()
ORDER BY created_at DESC;
```

---

*Last updated: 2026-05-12. Generated as part of the P0+P1 production-readiness review.*

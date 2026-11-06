# Production readiness audit — 2026-11-06

> **Update 2026-11-07:** the Hostinger packaging and the remaining high/medium risks below were addressed; see "Status of open findings" at the end and `docs/HOSTINGER_DEPLOYMENT.md`.

Method: production build (`next build`, `next start`, `NODE_ENV=production`) against an isolated, seeded PostgreSQL schema on the local database (dropped afterwards; no live data touched). Load, spike, abuse, authorization and failure tests were run against that instance only. Reusable scripts are in `scripts/load/`.

**Test machine caveat:** 20 logical cores / 34 GB RAM, load generator on the same machine. Absolute numbers are *higher* than a Hostinger plan will deliver; the shape of the curves (where it bends) is what transfers.

## Verdict

**Requires Important Fixes Before Deployment** (on Hostinger). The application code is in good shape and was fixed where it was weak (below). What blocks a Hostinger go-live is infrastructure, not code: PostgreSQL, scheduled jobs and proxy settings (section "Hostinger").

| Area | Score | Evidence |
|---|---|---|
| Architecture | 7.5/10 | Clean Next.js App Router + Prisma split, server-only guards, central `api()` wrapper (same-origin check, body-size cap, safe errors). Costs: 408 raw-SQL call sites tied to PostgreSQL, JSON "body" columns for commerce, per-offer N+1 (fixed for the hot path). |
| Database integrity | 8.5/10 | 99 tables, 91 FKs, every table has a PK, 0 orphans in 11 checks, no duplicate phones/emails, unique constraints on identity columns. Gaps: 24 unindexed FK columns (fixed), expired auth rows never purged (fixed), one ownerless seed vendor. |
| Performance | 6.5/10 → 7.5 | Catalog API 66 → ~600 req/s after fix. Pages are SSR on every hit (`no-store`) and cap at ~150–200 req/s per process. |
| Scalability | 6/10 | Single Node process is the ceiling; no load shedding (requests queue to ~9 s instead of failing fast); Postgres rate limiter adds DB writes to every limited call. |
| Security | 8.5/10 | Scrypt hashing, 12-char password policy, device+account lockout with backoff, TOTP 2FA, HttpOnly/Secure/SameSite session cookie, hashed session tokens, CSP, same-origin enforcement, no CORS. IP-trust flaw and unthrottled registration fixed. |
| Hostinger readiness | 4/10 → 6/10 with the checklist done | Netlify-specific pieces (Blobs, scheduled functions, Netlify DB) have local/HTTP fallbacks, but PostgreSQL is mandatory. |
| Production readiness | 7/10 on Netlify · 5.5/10 on Hostinger today | |

## Measured results (one Node process, production build)

Mixed browsing (home, marketplace, packages, catalog API, services API, stats, features), closed-loop users, 10 s per level:

| Users | req/s | p50 | p95 | Errors / timeouts | Before fix |
|---|---|---|---|---|---|
| 10 | 142 | 30 ms | 184 ms | 0 | 96 req/s, p95 451 ms |
| 50 | 158 | 173 ms | 757 ms | 0 | 102 req/s, p95 2.2 s |
| 100 | 161 | 291 ms | 1.5 s | 0 | 96 req/s, p95 4.2 s |
| 250 | 196 | 785 ms | 3.2 s | 0 | 77 req/s, 72 timeouts |
| 500 | 206 | 1.6 s | 5.0 s | 0 | 103 req/s, 143 timeouts |
| 1000 | 178 | 2.8 s | 8.0 s | 437 timeouts (10 s client limit) | 108 req/s, 504 timeouts + 73 conn errors |

Public APIs only (catalog/services/stats): 544–707 req/s at every level up to 1000 users, 0 errors, p95 29 ms → 3.7 s. CPU ≈ 1.7–1.9 cores, RSS 263 → 722 MB.

Health endpoint alone: 1,084 req/s, p95 51 ms — the framework is not the limit; rendering is.

**Where it bends:** healthy to ~50 concurrent browsers (p95 < 1 s), acceptable to ~100 (p95 ~1.5 s), degraded 250+ (p95 3–5 s), saturated 1000 (timeouts). **Bottleneck:** server-side rendering of 70+ KB pages on one JS thread (~8 ms CPU each), plus — before the fix — `GET /api/commerce/catalog` doing one query chain per offer (105 ms/request, ~10 req/s ceiling).

Logins (scrypt): ~100 ms each, ~70 logins/s sustained; 80 simultaneous logins all succeeded, p95 1.1 s. Expect roughly a third to a half of that on a 1–2 vCPU plan.

Spike (20 → 500 users instantly, 10 s, then back to 20): no crash, 0 errors, 0 corrupted rows; p95 8.8 s during the spike; back to baseline (p50 40 ms) within ~5 s of the drop.

Database down (unreachable server): process stays up; API calls return a controlled `503` with a generic Arabic message; no credentials, host, stack or SQL in any response body; recovers on reconnect.

**Estimated safe concurrency (estimate, not measured on Hostinger):** one Node process on a 1–2 vCPU plan ≈ 40–60 simultaneous active browsers with acceptable latency, ≈ 100+ if the public pages are cached by a CDN. Re-run `scripts/load/` on the real plan before launch.

## Fixes made in this audit

| # | Severity found | Change | Verified by |
|---|---|---|---|
| 1 | Critical (Hostinger) | `clientIp()` trusted `X-Forwarded-For`'s first entry and `x-nf-client-connection-ip` from any client, so every per-IP limit could be dodged by rotating a header. Now: Netlify header only when running on Netlify; otherwise the entry the last trusted proxy appended (`TRUSTED_PROXY_HOPS`, default 1). Three other routes that read the header directly now use it. | Before: 60/60 rotated-header logins passed. After: 60/60 `429`. `test:login-lockout` passes. |
| 2 | High | Registration had no per-address limit (30 accounts in 1.5 s). Added 10/hour/address. | After: 30/40 attempts `429`. |
| 3 | High | `/api/commerce/catalog` ran N+1 queries (≥6 per offer) per request. Public copy is now built once per 15 s and shared by concurrent requests (`CATALOG_CACHE_MS`; cart/checkout never read it). | 66 → ~600 req/s; commerce, pricing, exceptions suites pass. |
| 4 | High | 24 foreign-key columns had no index (e.g. `Occasion.userId`, `Review.serviceId`, `CommerceOrderItem.*`). New migration `202611060001_missing_foreign_key_indexes.sql` + `@@index` in `schema.prisma`. | 200k rows: 54 ms → 0.05 ms; audit query now reports 0 unindexed FKs. |
| 5 | Medium | No HSTS. Added `Strict-Transport-Security` (production only). | Header present in production build. |
| 6 | Medium | Expired `AuthAttempt`/`AuthSession` rows were never purged. The 15-minute cron now deletes them. | Type-checked; 283 stale rows seen in test. |
| 7 | Medium | `/api/health/db` returned `200` when the database was down. Now `503`; added `/api/health/live` (no DB). | Observed `200` + `offline_fallback` before. |
| 8 | Low | Prisma pool fixed at 2 connections (right for Netlify functions, too small for a long-running server). Now `DB_CONNECTION_LIMIT`. | Config only. |

## Open findings

**Critical (before deploying to Hostinger)**

1. *PostgreSQL is required.* Prisma provider is `postgresql` and there are 408 raw-SQL call sites plus JSON/`ON CONFLICT` usage; MySQL/MariaDB cannot be swapped in. Hostinger's shared/Cloud Node.js plans provide MySQL databases only (confirm against the plan page). Use a managed Postgres (Neon, Supabase, DigitalOcean) over TLS, or a Hostinger VPS with Postgres installed. Verify: `GET /api/health/db` → `200`, then `npm run db:push`/apply `netlify/database/migrations/*.sql` in order.
2. *Scheduled jobs exist only as Netlify functions.* Notifications (every 15 min) and backups (hourly) must be re-created as Hostinger cron jobs calling `POST /api/internal/notifications-cron` and `/api/internal/backup-cron` with header `x-backup-token`. Without them: no reminders, no price-change detection, no auth-table purge, no backups. Verify: call each once with `curl` and check a `200`.
3. *Environment.* Set `NEXT_PUBLIC_APP_URL` (https), `CHANNEL_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY`, `BACKUP_CRON_TOKEN`, `DATABASE_URL`, `DB_CONNECTION_LIMIT=10`, `TRUSTED_PROXY_HOPS` (number of proxies in front; confirm Hostinger's proxy appends to `X-Forwarded-For` — test with the abuse script), `NODE_ENV=production`. Two-factor sign-in is inactive until `AUTH_ENCRYPTION_KEY` is set (an earlier version of this report wrongly named `CHANNEL_ENCRYPTION_KEY`). Verify: `scripts/load/abuse-check.mjs` against staging — rotating forged headers must give `429`.

**High**

4. *No self-service password reset, email or phone verification, or CAPTCHA.* Accounts are admin-reset. Risk: fake accounts (now capped per address, but a botnet is not) and support load. Fix: SMS/email OTP at sign-up and a reset flow; add Cloudflare Turnstile on register/login after N failures. Verify: scripted sign-up without a verified channel is refused.
5. *No load shedding.* Under 500+ users requests wait up to ~9 s instead of failing fast. Fix: run 2+ processes (PM2 cluster or the host's instances), put Cloudflare in front, and cache anonymous pages (they are `no-store` today because the layout reads cookies/headers). Verify: spike test p95 < 3 s at 500.
6. *Backups on Hostinger go to a local folder* (`isCloud()` is Netlify-only). Keep them outside the web root, copy off-server daily, and keep `BACKUP_ENCRYPTION_KEY` elsewhere. The restore path itself passes `npm run test:backup` (17 checks: full, incremental, point-in-time, tamper, wrong key, restore).

**Medium**

7. *Account lock-out can be used against a victim:* 20 wrong guesses (from any addresses) lock the real owner out for 15 min+, doubling to 24 h. Observed in testing. Fix: keep account-level lock but let a verified second factor/recovery code bypass it.
8. *Registration reveals existing numbers/emails*: by code reading, a unique-constraint violation returns `409` "already registered" (not exercised in testing because the rate limit and password policy answered first). Fix: generic message plus verification flow (item 4).
9. *Dependency:* `npm audit` reports 3 high (all one chain: `prisma` CLI → `@prisma/config` → `deepmerge-ts` stack exhaustion). Build-time CLI only, not in the request path; fix needs Prisma 7 (major) — plan and test separately. Patch updates available: `next` 15.5.29, `postcss` 8.5.32, `@netlify/*`.
10. *Unbounded catalog payload:* `/api/commerce/catalog` returns every service/offer (50 KB with 15 services) and ignores `?q=`. At thousands of services this becomes MBs per page view. Fix: server-side search + pagination (`limit`/`cursor`).
11. *Tables without retention:* `SystemAuditLog` (keep, but archive yearly), notification logs, `CommerceOfferVersion`, abandoned drafts. Add an archive job once any exceeds ~1M rows.
12. *CSP uses `'unsafe-inline'`* for scripts (Next.js inline bootstrap). Moving to nonces is possible with middleware changes; XSS surface is otherwise small (3 `dangerouslySetInnerHTML`, all fed by generated SVG/JSON-LD with `<` escaped).

**Low**

13. `scripts/seed-postgres.mjs` fails on a fresh DB (subcategory foreign-key order) and seeds ownerless demo vendor `vendor-1`; fine for demos, do not run in production.
14. Redundant duplicate index on `User.phone` (unique plus plain).
15. Repo hygiene: ~50 untracked `.overflow-browser-*` / `.pricing-browser-*` test folders and stray `tsconfig` files in the working tree; add them to `.gitignore`. Docs still say "Next.js 14" in `DEPLOY_NETLIFY.md`.
16. No error reporting or uptime monitoring wired (see below).

## Verified OK (no action)

Authorization: 166 method/route combinations probed as anonymous, customer and vendor — every admin/system route returned 401/403; other users' occasions/guests/floor-plans return 404 (no existence leak) for GET/PATCH/DELETE/POST; role field in registration is ignored. CSRF: cross-origin POSTs rejected (`403`). Input: malformed JSON, arrays, NoSQL-style objects, `__proto__` keys, 100 KB bodies → `400`/`413`, no 5xx. Errors: no stack, SQL or path in any response (regex-scanned across all endpoints). Cookies: `HttpOnly; Secure; SameSite=Lax`. No file-upload endpoint exists (images are HTTPS URLs restricted by `next/image` allow-list; outbound `fetch` targets are fixed hosts or admin-configured with `redirect:'error'`), so upload/path-traversal/SSRF-by-user-URL surface is minimal. Secrets: none in source; `.env` gitignored and not served (404). Static assets: `immutable` one-year cache; no CORS headers.

## Monitoring to set up

Uptime monitor on `/api/health/live` (process) and `/api/health/db` (database, alerts on `503`); alert on 5xx rate > 2 %, p95 > 2 s, memory > 80 % of plan, DB connections > 80 % of limit; log-based alerts for repeated `429` on `/api/auth/*` and for `SystemAuditLog` admin changes; check the hourly backup job's result in `/admin/backups` daily until stable.

## Scaling path

1. Cloudflare in front (TLS, DDoS, cache anonymous pages and `/_next/static`). 2. Two or more Node processes behind the proxy. 3. Managed Postgres with PgBouncer, move rate-limit counters to Redis. 4. Server-side search/pagination for the catalog. 5. Split background jobs into a worker.

## Status of open findings (2026-11-07)

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | PostgreSQL required | **Resolved by design:** VPS or external Postgres; `scripts/migrate.cjs` builds a fresh database from the 18 migrations (no Netlify needed); `scripts/seed-base.cjs` seeds production-safe base data | Fresh schema migrated, standalone build served it; re-run is a no-op |
| 2 | Jobs only on Netlify | **Resolved:** `scripts/hostinger/cron.sh` + crontab lines | Same endpoints, token-protected; nginx blocks `/api/internal/` from outside |
| 3 | Environment | **Resolved:** `.env.hostinger.example`, `TRUSTED_PROXY_HOPS` documented, acceptance checks in the guide | |
| 4 | No reset / verification / CAPTCHA | **Resolved:** password reset (1 h, single-use, hashed tokens, newest link wins, all sessions revoked), e-mail verification, Cloudflare Turnstile on sign-up and reset and, after 3 wrong passwords, on sign-in (fails closed, off until keys are set) | `npm run test:account-security` (verification, reset, expiry, no enumeration, CAPTCHA gating) |
| 5 | No load shedding / single process | **Mitigated:** PM2 cluster + nginx flood guard (`ecosystem.config.cjs`, `deploy/hostinger/nginx.conf`) | Standalone: 1 process 200-240 req/s, no timeouts at 1,000 users (was 437); 3 generators on 4 workers 441 req/s combined; spike p95 8.8 s -> 4.2 s |
| 6 | Backups local on Hostinger | **Documented:** `BACKUP_STORAGE_DIR` outside web root + off-server copy; restore tested (17 checks) | `npm run test:backup` |
| 7 | Account lock-out against a victim | **Resolved:** a device that has signed in before (signed cookie) bypasses the account-wide lock but not its own per-device limit; a password reset lifts the lock | account-security test: stranger 429, forged cookie 429, owner on known device 200 |
| 8 | Registration reveals duplicates | **Mitigated, not removed:** per-address cap (10/h) and CAPTCHA make harvesting expensive; hiding it fully needs verify-before-create sign-up | by design decision |
| 9 | Dependency audit | **Resolved:** `deepmerge-ts` overridden to 8.0.2, `nodemailer` 10.3.1; `npm audit --omit=dev`: **0 vulnerabilities** (2 moderate remain in ESLint tooling, dev only) | `npm audit` |
| 10-16 | Catalog pagination, retention of audit/notification logs, CSP nonces, seed script, duplicate index, repo hygiene | Open (low/medium); `.gitignore` now covers test artifacts | |

Remaining prerequisites that only you can do: provision PostgreSQL, set the secrets and SMTP, add the cron jobs, create Turnstile keys, run one restore drill, and re-measure on the real plan.

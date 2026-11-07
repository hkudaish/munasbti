# Deploying to Hostinger (PostgreSQL)

The app needs **PostgreSQL** (Prisma + ~400 raw SQL queries). Hostinger's shared/Cloud web hosting offers MySQL databases only, so pick one of:

| Path | What you need | Use when |
|---|---|---|
| **A. Hostinger VPS** (recommended) | Ubuntu VPS, 2 vCPU / 4 GB or more | Full control: Postgres on the same server or external, PM2 cluster, nginx, cron, backups |
| **B. Hostinger Node.js Web App** + external Postgres | Node.js hosting plan **and** a managed Postgres (Neon, Supabase, DigitalOcean) over TLS | You prefer no server administration; no PM2/nginx control, one process |

Everything below was verified on a production standalone build against a database created **only** from the migrations (`scripts/migrate.cjs`), served by 1 and 4 workers.

## 0. Before you start

1. A domain pointing at the server (A record), and an e-mail mailbox (Hostinger e-mail: `smtp.hostinger.com`, port 465) for password-reset mail.
2. Generate secrets (hex, one per variable; **except `BACKUP_ENCRYPTION_KEY`, which must be base64: use `node scripts/backup.cjs keygen`**) and **store a copy outside the server** (password manager): `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
3. Optional but recommended: a free Cloudflare Turnstile site (site key + secret key) for the CAPTCHA.

## A. VPS

```bash
# 1. Server basics (Ubuntu 22.04/24.04)
sudo apt update && sudo apt install -y nginx git curl postgresql postgresql-contrib certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable        # 5432 stays closed

# 2. Database (skip if you use an external Postgres)
sudo -u postgres psql -c "CREATE USER munasbti WITH PASSWORD 'CHANGE-ME';" -c "CREATE DATABASE munasbti OWNER munasbti;"
#   DATABASE_URL=postgresql://munasbti:CHANGE-ME@127.0.0.1:5432/munasbti

# 3. App
sudo mkdir -p /srv/munasbti /var/backups/munasbti && sudo chown -R $USER /srv/munasbti /var/backups/munasbti
git clone <your repo> /srv/munasbti && cd /srv/munasbti
cp .env.hostinger.example .env.production && chmod 600 .env.production && nano .env.production   # fill every value
npm ci --legacy-peer-deps
node scripts/migrate.cjs              # builds all tables (18 migrations, transactional, re-runnable)
npm run build:hostinger               # standalone build (needs NEXT_PUBLIC_APP_URL=https://... in .env.production)
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup        # follow the printed command

# 4. First data (once): cities, geography, feature switches. No demo vendors or coupons (do NOT run seed-postgres.mjs in production).
node scripts/seed-base.cjs
#    Register your own account on the site, then make it the system administrator:
ACCOUNT_IDENTIFIER=your-phone-or-email node scripts/provision-system-admin.cjs      # see docs/SYSTEM_ADMIN.md

# 5. nginx + HTTPS
sudo cp deploy/hostinger/nginx.conf /etc/nginx/sites-available/munasbti   # replace munasbti.biz
sudo ln -s /etc/nginx/sites-available/munasbti /etc/nginx/sites-enabled/
sudo certbot --nginx -d munasbti.biz -d www.munasbti.biz && sudo nginx -t && sudo systemctl reload nginx

# 6. Scheduled jobs
chmod +x scripts/hostinger/cron.sh deploy/hostinger/deploy.sh
( crontab -l 2>/dev/null; echo '*/15 * * * * /srv/munasbti/scripts/hostinger/cron.sh notifications >> /var/log/munasbti-cron.log 2>&1'; echo '7 * * * * /srv/munasbti/scripts/hostinger/cron.sh backup >> /var/log/munasbti-cron.log 2>&1' ) | crontab -
```

Updates later: `./deploy/hostinger/deploy.sh` (pull, install, migrate, build, zero-downtime `pm2 reload`, smoke test).

## B. Node.js Web App + external Postgres

1. Create the database at Neon/Supabase (any region near your users); copy the connection string with `sslmode=require`. Run once from your computer: `DATABASE_URL="..." node scripts/migrate.cjs && DATABASE_URL="..." node scripts/seed-base.cjs`.
2. In hPanel create the Node.js app from the Git repo; Node 22, build command `npm ci --legacy-peer-deps && npm run build`, start command `npm start`.
3. Add every variable from `.env.hostinger.example` in the app's environment settings (`PORT` is supplied by the platform; set `DB_CONNECTION_LIMIT=5` on small plans; `TRUSTED_PROXY_HOPS=1`, then confirm with the check below). **Do not set `NODE_ENV` there**: the builder loads these variables before `npm install`, so `NODE_ENV=production` makes npm skip the development packages (Tailwind, TypeScript) that `next build` needs, and the build fails with `Cannot find module 'tailwindcss'`. Next.js sets production mode itself. For a Neon database use the pooled address as `DATABASE_URL` and the direct one as `DATABASE_URL_UNPOOLED`.
4. Cron jobs (hPanel > Cron Jobs): every 15 minutes `curl -fsS -X POST -H "x-backup-token: <BACKUP_CRON_TOKEN>" https://munasbti.biz/api/internal/notifications-cron`, hourly the same for `/api/internal/backup-cron`.
5. Backups need a writable folder outside `public_html`: set `BACKUP_STORAGE_DIR=/home/<user>/backups/munasbti` and download the folder regularly.

## After deploying: acceptance checks

```bash
curl -fsS https://munasbti.biz/api/health/live          # 200 {"status":"ok"}
curl -fsS https://munasbti.biz/api/health/db            # 200 when PostgreSQL answers, 503 when it does not
curl -sI https://munasbti.biz | grep -i strict-transport # HSTS present
# Client-address trust (must print 429s, not 401s, after the first ~40): run from your computer against YOUR domain only
BASE=https://munasbti.biz APP_ORIGIN=https://munasbti.biz node scripts/load/abuse-check.mjs
BASE=https://munasbti.biz SPID= LEVELS=10,50,100 DUR=10 node scripts/load/load.mjs      # measure your plan
```

If forged `X-Forwarded-For` values still defeat the login limit, `TRUSTED_PROXY_HOPS` does not match the proxies in front of the app (nginx = 1; Cloudflare + nginx = 2).

## What runs where

| Concern | Netlify (before) | Self-hosted (now) |
|---|---|---|
| Database | Netlify Database | Any PostgreSQL via `DATABASE_URL`; schema from `scripts/migrate.cjs` |
| Processes | serverless functions | PM2 cluster (`ecosystem.config.cjs`), one worker per vCPU |
| Scheduled jobs | Netlify scheduled functions | cron + `scripts/hostinger/cron.sh` |
| Backups | Netlify Blobs | encrypted files in `BACKUP_STORAGE_DIR` (+ copy off-server) |
| Client IP | Netlify header | `X-Forwarded-For` from your proxy, `TRUSTED_PROXY_HOPS` |
| HTTPS / compression / static caching | platform | nginx + certbot (`deploy/hostinger/nginx.conf`) |

The Netlify deployment keeps working unchanged (`npm run build`); `BUILD_STANDALONE` is only set by `build:hostinger`.

## Backup and restore (test it before launch)

`npm run backup:auto` (or the hourly cron) writes encrypted full/incremental backups; `npm run backup:verify` checks them and `npm run backup:restore` restores (see `docs/BACKUP.md`). Do one full restore into a scratch database on the server before go-live, and keep `BACKUP_ENCRYPTION_KEY` outside the server.

## Monitoring

Uptime monitor (UptimeRobot/Better Stack) on `/api/health/live` and `/api/health/db` (alert on non-200); `pm2 monit` / `pm2 logs`; alert when memory > 80 %, 5xx > 2 %, repeated `429` on `/api/auth/*`; check `/var/log/munasbti-cron.log` for non-200 job results.

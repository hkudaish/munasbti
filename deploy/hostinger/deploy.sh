#!/usr/bin/env bash
# Update a running Hostinger VPS install:  ./deploy/hostinger/deploy.sh
# Order matters: dependencies -> database migrations -> build -> zero-downtime reload. A failed step stops the script before anything is restarted.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f .env.production ] || { echo "Create .env.production first (see .env.hostinger.example)"; exit 1; }

git pull --ff-only
npm ci --legacy-peer-deps            # runs prisma generate (postinstall)
node scripts/migrate.cjs             # idempotent; each migration is transactional
npm run build:hostinger
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

# Smoke test the new build before calling it done.
sleep 5
curl -fsS http://127.0.0.1:${PORT:-3000}/api/health/live >/dev/null && curl -fsS http://127.0.0.1:${PORT:-3000}/api/health/db >/dev/null && echo "Deployed: process and database healthy."

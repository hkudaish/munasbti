#!/usr/bin/env bash
# Scheduled jobs for a self-hosted server (replaces the Netlify scheduled functions).
#   */15 * * * *  /srv/munasabati/scripts/hostinger/cron.sh notifications
#   7 * * * *     /srv/munasabati/scripts/hostinger/cron.sh backup
# Reads BACKUP_CRON_TOKEN (and optionally NOTIFICATIONS_CRON_TOKEN, APP_LOCAL_URL) from .env.production next to the app.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f .env.production ] && set -a && . ./.env.production && set +a
BASE="${APP_LOCAL_URL:-http://127.0.0.1:${PORT:-3000}}"   # call the app directly, not through the public address
case "${1:-}" in
  notifications) TOKEN="${NOTIFICATIONS_CRON_TOKEN:-${BACKUP_CRON_TOKEN:-}}"; PATH_="/api/internal/notifications-cron" ;;
  backup)        TOKEN="${BACKUP_CRON_TOKEN:-}"; PATH_="/api/internal/backup-cron" ;;
  *) echo "usage: cron.sh notifications|backup" >&2; exit 2 ;;
esac
[ -n "$TOKEN" ] || { echo "cron.sh: token is not set in .env.production" >&2; exit 1; }
code=$(curl -sS -o /tmp/munasabati-cron.out -w '%{http_code}' --max-time 120 -X POST -H "x-backup-token: $TOKEN" "$BASE$PATH_") || code=000
echo "$(date -u +%FT%TZ) $1 -> HTTP $code $(head -c 300 /tmp/munasabati-cron.out | tr '\n' ' ')"
[ "$code" = "200" ]

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$ROOT/.env" ]]; then echo "Missing root .env" >&2; exit 1; fi
set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a
: "${DATABASE_URL:?DATABASE_URL is required}"
command -v pg_dump >/dev/null || { echo "pg_dump is required" >&2; exit 1; }
mkdir -p "$ROOT/backups"
umask 077
OUT="$ROOT/backups/coffee-$(date -u +%Y%m%dT%H%M%SZ).sql"
pg_dump --dbname="$DATABASE_URL" --no-owner --no-privileges --file="$OUT"
echo "Backup saved: $OUT"

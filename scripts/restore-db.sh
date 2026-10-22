#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ $# -ne 1 || ! -f "$1" ]]; then echo "Usage: CONFIRM_RESTORE=YES bash scripts/restore-db.sh backup.sql" >&2; exit 1; fi
if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then echo "Refusing restore. Set CONFIRM_RESTORE=YES after verifying the target is an EMPTY recovery database." >&2; exit 1; fi
if [[ ! -f "$ROOT/.env" ]]; then echo "Missing root .env" >&2; exit 1; fi
set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a
: "${DATABASE_URL:?DATABASE_URL is required}"
command -v psql >/dev/null || { echo "psql is required" >&2; exit 1; }
echo "WARNING: This will import SQL into the database configured by DATABASE_URL in $ROOT/.env"
read -r -p 'Type RESTORE to continue (use an EMPTY recovery database): ' confirmation
[[ "$confirmation" == "RESTORE" ]] || { echo "Aborted"; exit 1; }
psql --dbname="$DATABASE_URL" -v ON_ERROR_STOP=1 --file="$1"

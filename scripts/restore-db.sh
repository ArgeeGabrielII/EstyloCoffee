#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 1 ]]; then echo 'Usage: restore-db.sh backup.sql (target must be an empty recovery database)'; exit 1; fi
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U estylo -d estylo_coffee < "$1"

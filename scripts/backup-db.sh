#!/usr/bin/env bash
set -euo pipefail
mkdir -p backups
docker compose exec -T db pg_dump -U estylo -d estylo_coffee > "backups/coffee-$(date -u +%Y%m%dT%H%M%SZ).sql"

# Estylo Coffee — native Node.js and PostgreSQL commands (no Docker)
.DEFAULT_GOAL := help
.PHONY: help install backend frontend db-check db-generate db-migrate db-deploy db-seed build test lint backup restore
help:
	@echo "  make install       Install npm dependencies"
	@echo "  make backend       Start NestJS API (loads root .env)"
	@echo "  make frontend      Start Vite frontend on port 5174"
	@echo "  make db-check      Check PostgreSQL connectivity"
	@echo "  make db-generate   Generate Prisma client"
	@echo "  make db-migrate    Run development migrations"
	@echo "  make db-deploy     Apply existing migrations"
	@echo "  make db-seed       Seed catalog / initial Admin"
	@echo "  make backup        Backup database via pg_dump"
	@echo "  make restore FILE=path.sql  Restore to recovery DB (CONFIRM_RESTORE=YES)"
	@echo "  make build         Build API and web"
	@echo "  make test          Run tests"
	@echo "  make lint          Typecheck"
install:
	npm ci
backend:
	@set -a; . ./.env; set +a; npm run dev:api
frontend:
	npm run dev:web
db-check:
	@set -a; . ./.env; set +a; pg_isready -d "$$DATABASE_URL"
db-generate:
	@set -a; . ./.env; set +a; npm run db:generate
db-migrate:
	@set -a; . ./.env; set +a; npm -w apps/api run prisma:migrate
db-deploy:
	@set -a; . ./.env; set +a; npm run db:deploy
db-seed:
	@set -a; . ./.env; set +a; npm run db:seed
backup:
	bash scripts/backup-db.sh
restore:
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=backups/backup.sql CONFIRM_RESTORE=YES"; exit 1)
	@CONFIRM_RESTORE=$(CONFIRM_RESTORE) bash scripts/restore-db.sh "$(FILE)"
build:
	npm run build
test:
	npm test
lint:
	npm run lint

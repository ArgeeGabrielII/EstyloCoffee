# Estylo Coffee — development commands
# Run from the repository root, e.g. make backend or make frontend.
.DEFAULT_GOAL := help
.PHONY: help install backend frontend db db-stop db-logs db-generate db-migrate db-seed build test lint up down logs
help:
	@echo "Estylo Coffee commands:"
	@echo "  make install       Install npm dependencies"
	@echo "  make backend       Run NestJS API (watch mode, port 3000)"
	@echo "  make frontend      Run React/Vite frontend (watch mode)"
	@echo "  make db            Start PostgreSQL via Docker Compose"
	@echo "  make db-stop       Stop PostgreSQL container"
	@echo "  make db-logs       Stream PostgreSQL logs"
	@echo "  make db-generate   Generate Prisma client"
	@echo "  make db-migrate    Apply Prisma migrations (development)"
	@echo "  make db-seed       Seed the database"
	@echo "  make build         Build API and frontend"
	@echo "  make test          Run API tests"
	@echo "  make lint          Typecheck API and frontend"
	@echo "  make up            Start full stack using Docker Compose"
	@echo "  make down          Stop full stack containers"
	@echo "  make logs          Stream all Docker Compose logs"
install:
	npm install
backend:
	@set -a; . ./.env; set +a; npm run dev:api
frontend:
	npm -w apps/web run dev -- --port 5174 --strictPort
db:
	docker compose up -d db
db-stop:
	docker compose stop db
db-logs:
	docker compose logs -f db
db-generate:
	npm run db:generate
db-migrate:
	npm -w apps/api run prisma:migrate
db-seed:
	npm run db:seed
build:
	npm run build
test:
	npm test
lint:
	npm run lint
up:
	docker compose up -d --build
down:
	docker compose down
logs:
	docker compose logs -f

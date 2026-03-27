COMPOSE = docker compose -f infra/compose.yml

.PHONY: install install-frontend install-backend dev-frontend dev-backend up down re logs migrate test smoke

up:
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

re: down
	$(COMPOSE) up --build

logs:
	$(COMPOSE) logs -f

migrate:
	$(COMPOSE) run --rm backend python -m app.migrate

test:
	$(COMPOSE) run --rm backend pytest
	$(COMPOSE) run --rm frontend npm run build

install: install-frontend install-backend

install-frontend:
	cd frontend && npm install

install-backend:
	cd backend && python -m pip install -e .[dev]

dev-frontend:
	cd frontend && npm run dev

dev-backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

smoke:
	$(COMPOSE) up -d --build
	curl --fail http://localhost:8000/api/v1/health
	curl --fail http://localhost:3000

PYTHON ?= python3
VENV ?= .venv
BIN := $(VENV)/bin

.PHONY: venv install dev run test migrate compile clean

venv:
	$(PYTHON) -m venv $(VENV)

install: venv
	$(BIN)/pip install --upgrade pip
	$(BIN)/pip install -e .[dev]

dev:
	$(BIN)/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

run:
	$(BIN)/uvicorn app.main:app --host 0.0.0.0 --port 8000

test:
	$(BIN)/pytest

migrate:
	$(BIN)/python -m app.migrate

compile:
	$(BIN)/python -m compileall app

clean:
	rm -rf $(VENV)

# Circuit Engine

Analyzes a circuit (sample, plain-English description, KiCad netlist, or JSON) against the 13-block rulebook and returns
scored, explained suggestions: cost, efficiency, sustainability, simplification, and verification.

**Stack:** Next.js + React (frontend) · FastAPI (backend) · PostgreSQL (SQLite by default locally) · Groq API (optional) · ngspice (optional)

## Run with Docker
    cp .env.example .env
    docker compose up --build        # web: http://localhost:3000   api: http://localhost:8000/docs

## Run locally
    cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
    cd frontend && npm install && npm run dev          # set BACKEND_URL if the API is not on :8000

## Test
    cd backend && python -m pytest -q

## How the rulebook maps to code
| Rulebook block | Code |
|---|---|
| 1-3 Power, 4-6 Signal, 7-9 Switching, 10-11 Sensing, 13 Decoupling | `backend/app/engine.py` (one function per block; HARD FLAGs use severity `hard`) |
| 12 Discrete-to-IC patterns | `FINGERPRINTS` + `simplify()` in `engine.py` |
| Phase 2 prompt-to-circuit | `design.py` (Groq forced tool schema, keyword fallback, template library) |
| Phase 3 KiCad | `kicad.py` |
| Phase 5 verification | `verify.py` (ngspice if installed, analytic otherwise) |
| Phase 6 accounts, projects, reports | `store.py`, `main.py`, `report.py` |

## Known limits
- `parts.py` uses sample seed data. Replace `lookup()` with a live Octopart/Nexar client for real price, stock and lifecycle.
- ngspice verification covers voltage dividers and RC filters; other blocks are rule-based or analytic.
- KiCad import infers regulator input and load unless you provide them (confidence is lowered when inferred).
- The netlist view is read-only; drag-and-drop editing is not built.
- Set a strong `JWT_SECRET` and restrict `CORS_ORIGINS` before any public deployment.

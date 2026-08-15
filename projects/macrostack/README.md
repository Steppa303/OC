# MacroStack

Fokus-Stacking WebApp für Makrofotografie. Bis zu 30 Bilder mit unterschiedlichen
Schärfe-Ebenen werden zu einem komplett scharfen Makro-Foto zusammengesetzt.

## Stack

- **Frontend:** React 18 + Vite + TailwindCSS + Zustand + Framer Motion
- **Backend:** FastAPI + Pydantic
- **Queue:** Redis + RQ
- **Core:** OpenCV (headless) — ECC Alignment + Laplacian Pyramid Fusion

## Struktur

```
macrostack/
├── docker/          # Dockerfile.backend, Dockerfile.frontend, docker-compose.yml, Caddyfile
├── backend/         # FastAPI App + Core-Algorithmus (macrostack.core)
├── frontend/        # React App
└── PLAN.md          # Detaillierter Phasen-Plan
```

## Entwicklung

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3723
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Alles via Docker

```bash
cd docker
docker compose up --build
```

- Frontend: http://localhost:3722
- Backend Health: http://localhost:3723/api/health

## Status

Phase 0 (Setup) — in Arbeit.

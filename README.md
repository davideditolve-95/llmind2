# ICD-11 Explorer & Clinical AI

A research-grade web application for exploring the ICD-11 taxonomy in 3D, running multi-model LLM benchmarks against clinical cases from the DSM-5-TR, and providing a clinical AI chatbot for differential diagnosis.

Built for university research. Deployable locally via Docker Compose or on Coolify.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TailwindCSS, React Three Fiber |
| Backend | Python FastAPI, SQLAlchemy |
| Database | PostgreSQL 16 |
| AI Engine | Ollama (**external** — not in Docker) |
| ICD-11 Source | WHO offline Docker container |
| Infrastructure | Docker Compose, Coolify-ready |

---

## Prerequisites

- Docker Desktop (with Compose V2)
- Ollama installed on host machine with `gemma4` pulled:
  ```bash
  ollama pull gemma4
  ollama serve
  ```
- The DSM-5-TR PDF (placed at `backend/data/dsm5_cases.pdf`)

---

## Quick Start (Local)

```bash
# 1. Clone and enter the repository
git clone <repo-url>
cd llmind2

# 2. Copy env file (already pre-filled for local dev)
cp .env.example .env

# 3. Build and start all services
docker compose up --build -d

# 4. Wait for services to be healthy, then run ICD-11 ETL
docker compose exec backend python scripts/extract_icd11_data.py

# 5. (Optional) Extract DSM-5 cases from PDF
#    First copy your PDF:
cp /path/to/your/dsm5_cases.pdf backend/data/dsm5_cases.pdf
docker compose exec backend python scripts/extract_dsm5_cases.py --pdf-path /app/data/dsm5_cases.pdf

# 6. Open in browser
open http://localhost:3000
```

---

## Services & Ports

| Service | Local Port | Internal URL |
|---|---|---|
| Frontend (Next.js) | 3000 | — |
| Backend (FastAPI) | 8000 | `http://backend:8000` |
| ICD-11 API | — (internal only) | `http://icd11-api` |
| PostgreSQL | — (internal only) | `db:5432` |
| **Ollama** | **11434 (host)** | `http://host.docker.internal:11434` |

---

## Features

### 🌐 3D ICD-11 Universe
Interactive force-directed 3D graph of the entire ICD-11 taxonomy. Click nodes to expand chapters. Breadcrumb trail shows your navigation path.

### 📊 Tabular Explorer
Paginated, searchable, filterable data grid of all ICD-11 codes with descriptions.

### 🤖 AI Chatbot
- **ICD-11 Search mode**: Ask questions about ICD codes. Context-aware responses.
- **Clinical Well-being mode**: Simulates a Clinical Psychologist Supervisor. Performs differential diagnosis with follow-up questions before concluding.

### 🔬 Benchmarking Module
- Import DSM-5-TR clinical cases from PDF (auto-splits into Anamnesis / Discussion / Gold Standard Diagnosis)
- Edit and correct extracted cases manually
- Run multi-model inference (compare Gemma vs Llama vs Mistral etc.)
- Automatic semantic similarity scoring vs Gold Standard
- Human-in-the-Loop 1–5 star evaluation
- Full history persistence and KPI dashboard

---

## Deployment on Coolify

1. Create a new service in Coolify, point to this repository.
2. In the **Environment Variables** panel, inject all variables from `.env.example` with production values.
3. For Ollama: set `OLLAMA_BASE_URL` to your Ollama instance URL (e.g., `https://ollama.yourdomain.com`).
4. The `.env` file is **ignored in production** — Coolify variables take priority.

> **Note**: Coolify does not need extra_hosts configuration. Simply update `OLLAMA_BASE_URL` to the publicly accessible Ollama address.

---

## Environment Variables Reference

See `.env.example` for the full list. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ICD11_API_URL` | Internal URL of the ICD-11 container |
| `OLLAMA_BASE_URL` | **External** Ollama URL (not in Docker) |
| `OLLAMA_DEFAULT_MODEL` | Default model (e.g., `gemma4`) |
| `NEXT_PUBLIC_API_URL` | Public backend URL reachable by the browser |

---

## Project Structure

```
llmind2/
├── docker-compose.yml
├── .env
├── backend/
│   ├── app/             # FastAPI application
│   ├── scripts/         # ETL scripts
│   ├── data/            # PDF uploads
│   └── Dockerfile
└── frontend/
    ├── app/             # Next.js App Router pages
    ├── components/      # React components
    ├── lib/             # API client, i18n
    └── Dockerfile
```

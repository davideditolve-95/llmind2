# Dockerfile per il backend FastAPI
# Build multi-stage per ottimizzare la dimensione dell'immagine

FROM python:3.11-slim AS base

# Variabili d'ambiente per Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Installa dipendenze di sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copia e installa le dipendenze Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Scarica il modello sentence-transformers durante il build (evita cold start)
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copia il codice sorgente
COPY . .

# Crea la directory per i dati (PDF DSM-5-TR)
RUN mkdir -p /app/data

# Espone la porta del server FastAPI
EXPOSE 8000

# Avvia il server con uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

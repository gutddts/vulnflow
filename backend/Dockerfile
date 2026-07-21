# VulnFlow Backend Dockerfile - Multi-stage build
# Stage 1: Build dependencies
FROM python:3.11-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install --prefix=/install -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/usr/local/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r vulnflow && useradd -r -g vulnflow -d /app vulnflow

COPY --from=builder /install /usr/local

WORKDIR /app

COPY --chown=vulnflow:vulnflow alembic.ini .
COPY --chown=vulnflow:vulnflow alembic/ ./alembic/
COPY --chown=vulnflow:vulnflow app/ ./app/

RUN mkdir -p /app/data /app/logs /app/reports && \
    chown -R vulnflow:vulnflow /app/data /app/logs /app/reports

USER vulnflow

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]

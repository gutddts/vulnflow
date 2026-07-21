FROM python:3.12-slim

LABEL org.vulnflow.skill="dirbrute"
LABEL org.vulnflow.version="1.0.0"

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash skill && \
    mkdir -p /app /input /output && \
    chown -R skill:skill /app /input /output

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

USER skill

ENTRYPOINT ["python", "main.py"]

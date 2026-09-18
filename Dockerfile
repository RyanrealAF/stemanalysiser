FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    OMP_NUM_THREADS=4 \
    MKL_NUM_THREADS=4 \
    TORCH_NUM_THREADS=4 \
    STEMFLOW_DEMUCS_MODEL=htdemucs_6s \
    STEMFLOW_DEMUCS_SHIFTS=1 \
    STEMFLOW_DEMUCS_SEGMENT=7 \
    STEMFLOW_DEMUCS_OVERLAP=0.25

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY inference/requirements.txt /app/inference/requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install -r /app/inference/requirements.txt

COPY inference /app/inference
COPY cloudflare/container_server.py /app/container_server.py

EXPOSE 8080

ENTRYPOINT ["python", "/app/container_server.py"]

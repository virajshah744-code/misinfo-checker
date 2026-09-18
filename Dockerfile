# The API as a container: Hugging Face Spaces (Docker SDK) runs this as-is,
# and so does any host that builds a Dockerfile and sets $PORT.
#
# Only the API ships here. The browser client is built from web/ and hosted
# separately (Vercel), pointed at this server with VITE_API_ORIGIN; set
# CORS_ORIGINS to that site's origin so the browser is allowed to call us.

FROM python:3.11-slim

# ffmpeg: frame and audio extraction for video checks.
# libglib2.0-0 / libgl1: OpenCV, which easyocr pulls in.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Spaces run as uid 1000; give it a home so model downloads have somewhere
# writable to land.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface \
    CACHE_DIR=/home/user/cache \
    PYTHONUNBUFFERED=1 \
    PORT=7860

WORKDIR /home/user/app

# CPU-only torch first, so requirements.txt doesn't pull the CUDA build.
RUN pip install --no-cache-dir --user \
        torch torchvision --index-url https://download.pytorch.org/whl/cpu
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt \
    && pip install --no-cache-dir --user gunicorn openai-whisper easyocr yt-dlp

COPY --chown=user backend ./backend
COPY --chown=user config ./config
COPY --chown=user data ./data

EXPOSE 7860

# One worker so the models load once; threads for concurrent requests.
# The long timeout covers the first request, which downloads the models.
CMD gunicorn backend.api.flask_app:app \
    --bind 0.0.0.0:${PORT} --workers 1 --threads 4 --timeout 600

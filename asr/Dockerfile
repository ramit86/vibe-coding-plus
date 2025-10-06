FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
COPY asr_server.py ./
RUN pip install --no-cache-dir fastapi uvicorn faster-whisper python-multipart
EXPOSE 8080
CMD ["uvicorn", "asr_server:app", "--host", "0.0.0.0", "--port", "8080"]

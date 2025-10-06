from fastapi import FastAPI, UploadFile, File
from faster_whisper import WhisperModel
import tempfile, shutil, os

app = FastAPI()
MODEL_ID = os.environ.get("FWH_MODEL", "base")
DEVICE = os.environ.get("FWH_DEVICE", "cpu")
COMPUTE = os.environ.get("FWH_COMPUTE", "int8")
model = WhisperModel(MODEL_ID, device=DEVICE, compute_type=COMPUTE)

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "")[-1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    parts = []
    segments, info = model.transcribe(tmp_path, vad_filter=True)
    for seg in segments:
        parts.append(seg.text)
    text = "".join(parts).strip()
    try:
        os.remove(tmp_path)
    except Exception:
        pass
    return {"text": text}

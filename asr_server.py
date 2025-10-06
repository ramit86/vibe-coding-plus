from fastapi import FastAPI, UploadFile, File
from faster_whisper import WhisperModel
import tempfile, shutil, os

app = FastAPI()

# Start small; you can switch to "small"/"medium"/"large-v3" later
MODEL_ID = os.environ.get("FWH_MODEL", "base")
# CPU-only; 8-bit compute keeps RAM low
model = WhisperModel(MODEL_ID, device="cpu", compute_type="int8")

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    # save upload to a temp file
    suffix = os.path.splitext(file.filename or "")[-1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    # transcribe
    parts = []
    segments, info = model.transcribe(tmp_path, vad_filter=True)
    for seg in segments:
        parts.append(seg.text)
    text = "".join(parts).strip()

    # cleanup
    try:
        os.remove(tmp_path)
    except Exception:
        pass

    return {"text": text}

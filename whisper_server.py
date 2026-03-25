"""
Norvexis Local Whisper Server
Speech-to-text via faster-whisper with NVIDIA GPU acceleration.
Exposes OpenAI-compatible /v1/audio/transcriptions endpoint.

Usage:
    python whisper_server.py

Server runs at http://localhost:8765
"""

import os
import sys
import tempfile
import logging
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# ─── Configuration ──────────────────────────────────────────────────────────
MODEL_SIZE = "large-v3-turbo"  # Best quality with turbo speed
DEVICE = "cuda"                # Use NVIDIA GPU (change to "cpu" if no GPU)
COMPUTE_TYPE = "float16"       # float16 for GPU, int8 for CPU
HOST = "0.0.0.0"
PORT = 8765

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("whisper-server")

# ─── FastAPI App ────────────────────────────────────────────────────────────
app = FastAPI(title="Norvexis Whisper Server", version="1.0.0")

# Allow CORS from localhost (our PWA)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Load Model (once at startup) ──────────────────────────────────────────
whisper_model = None

@app.on_event("startup")
async def load_model():
    global whisper_model
    from faster_whisper import WhisperModel

    logger.info(f"Loading Whisper model '{MODEL_SIZE}' on {DEVICE} ({COMPUTE_TYPE})...")
    logger.info("This may take 30-60 seconds on first run (downloads model)...")

    try:
        whisper_model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
        logger.info("✅ Whisper model loaded successfully on GPU!")
    except Exception as e:
        logger.warning(f"⚠️ GPU loading failed: {e}")
        logger.info("Trying CPU fallback...")
        try:
            whisper_model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
            logger.info("✅ Whisper model loaded on CPU (slower but works)")
        except Exception as e2:
            logger.error(f"❌ CPU fallback also failed: {e2}")
            sys.exit(1)

    logger.info(f"🎤 Server ready at http://localhost:{PORT}")
    logger.info(f"📡 Endpoint: POST http://localhost:{PORT}/v1/audio/transcriptions")

# ─── Health Check ───────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_SIZE, "device": DEVICE}

# ─── OpenAI-Compatible Transcription Endpoint ──────────────────────────────
@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None),
    temperature: Optional[float] = Form(0.0),
    response_format: Optional[str] = Form("json"),
):
    """OpenAI Whisper API compatible endpoint."""
    if whisper_model is None:
        return JSONResponse(status_code=503, content={"error": "Model not loaded"})

    # Save uploaded audio to temp file
    suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    tmp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        logger.info(f"Transcribing {file.filename} ({len(content)} bytes)...")

        # Transcribe with faster-whisper
        segments, info = whisper_model.transcribe(
            tmp_path,
            language=language or None,
            initial_prompt=prompt or None,
            temperature=temperature or 0.0,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
            ),
        )

        # Collect all segments
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())

        full_text = " ".join(text_parts)

        logger.info(f"✅ Transcribed: \"{full_text[:80]}{'...' if len(full_text) > 80 else ''}\"")
        logger.info(f"   Language: {info.language} (prob: {info.language_probability:.2f})")

        # Return OpenAI-compatible response
        return {"text": full_text}

    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        # Clean up temp file
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except:
                pass

# ─── Run Server ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  🎤 Norvexis Local Whisper Server")
    print("  Model: whisper-large-v3-turbo")
    print("  GPU:   NVIDIA RTX Studio (CUDA)")
    print(f"  URL:   http://localhost:{PORT}")
    print("=" * 60)

    uvicorn.run(app, host=HOST, port=PORT, log_level="info")

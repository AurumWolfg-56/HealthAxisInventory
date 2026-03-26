"""
Norvexis Local Whisper Server
Speech-to-text via faster-whisper (CPU float32 for maximum accuracy).
Exposes OpenAI-compatible /v1/audio/transcriptions endpoint.

Usage:
    python whisper_server.py

Server runs at http://localhost:8765
"""

import os
import sys
import tempfile
import logging
import glob
from typing import Optional

# ─── Ensure CUDA DLLs are findable ─────────────────────────────────────────
# Add CUDA Toolkit bin to PATH so cublas64_12.dll, cudnn, etc. are found
cuda_paths = glob.glob(r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v*\bin")
for p in cuda_paths:
    if p not in os.environ.get("PATH", ""):
        os.environ["PATH"] = p + os.pathsep + os.environ.get("PATH", "")
        print(f"[CUDA] Added to PATH: {p}")

from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import uvicorn
import httpx

# ─── Configuration ──────────────────────────────────────────────────────────
MODEL_SIZE = "large-v3-turbo"  # Best quality with turbo speed
DEVICE = "cuda"                # NVIDIA RTX 4050 GPU acceleration
COMPUTE_TYPE = "float16"       # float16 on GPU = fastest + best quality
HOST = "0.0.0.0"
PORT = 8765
CPU_THREADS = 8                # Use multiple CPU threads for speed
LM_STUDIO_URL = "http://127.0.0.1:1234"  # LM Studio API

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("whisper-server")

# ─── FastAPI App ────────────────────────────────────────────────────────────
app = FastAPI(title="Norvexis Local AI Gateway", version="2.0.0")

# Allow CORS from any origin (production site + localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── HTTP client for LM Studio proxy ───────────────────────────────────────
http_client = httpx.AsyncClient(base_url=LM_STUDIO_URL, timeout=120.0)

# ─── Load Model (once at startup) ──────────────────────────────────────────
whisper_model = None
actual_device = "unknown"

@app.on_event("startup")
async def load_model():
    global whisper_model, actual_device
    from faster_whisper import WhisperModel

    logger.info(f"Loading Whisper model '{MODEL_SIZE}' on {DEVICE} ({COMPUTE_TYPE})...")
    logger.info("This may take 30-60 seconds on first run (downloads model)...")

    try:
        whisper_model = WhisperModel(
            MODEL_SIZE,
            device=DEVICE,
            compute_type=COMPUTE_TYPE,
            cpu_threads=CPU_THREADS,
        )
        actual_device = DEVICE
        logger.info(f"✅ Whisper model loaded on {DEVICE} ({COMPUTE_TYPE}, {CPU_THREADS} threads)")
    except Exception as e:
        logger.error(f"❌ Failed to load model: {e}")
        sys.exit(1)

    logger.info(f"🎤 Server ready at http://localhost:{PORT}")
    logger.info(f"📡 Whisper:  POST http://localhost:{PORT}/v1/audio/transcriptions")
    logger.info(f"🤖 LLM:     POST http://localhost:{PORT}/v1/chat/completions")
    logger.info(f"📋 Models:  GET  http://localhost:{PORT}/v1/models")

# ─── Health Check ───────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    # Also check LM Studio connectivity
    lm_status = "unknown"
    try:
        r = await http_client.get("/v1/models")
        lm_status = "connected" if r.status_code == 200 else f"error:{r.status_code}"
    except:
        lm_status = "offline"

    return {
        "status": "ok",
        "whisper": {"model": MODEL_SIZE, "device": actual_device, "compute": COMPUTE_TYPE},
        "lm_studio": lm_status,
    }

# ─── LM Studio Proxy: /v1/chat/completions ─────────────────────────────────
@app.post("/v1/chat/completions")
async def proxy_chat_completions(request: Request):
    """Proxy chat completion requests to LM Studio."""
    try:
        body = await request.body()
        logger.info(f"[LLM Proxy] Forwarding chat/completions ({len(body)} bytes)")

        response = await http_client.post(
            "/v1/chat/completions",
            content=body,
            headers={"Content-Type": "application/json"},
        )

        logger.info(f"[LLM Proxy] ✅ Response {response.status_code}")
        return JSONResponse(
            status_code=response.status_code,
            content=response.json(),
        )
    except httpx.ConnectError:
        logger.error("[LLM Proxy] ❌ Cannot connect to LM Studio")
        return JSONResponse(status_code=502, content={"error": "LM Studio is not running at 127.0.0.1:1234"})
    except Exception as e:
        logger.error(f"[LLM Proxy] ❌ Error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

# ─── LM Studio Proxy: /v1/models ───────────────────────────────────────────
@app.get("/v1/models")
async def proxy_models():
    """Proxy model list from LM Studio."""
    try:
        response = await http_client.get("/v1/models")
        return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.ConnectError:
        return JSONResponse(status_code=502, content={"error": "LM Studio is not running"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

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

        # Transcribe with faster-whisper — tuned for accuracy
        segments, info = whisper_model.transcribe(
            tmp_path,
            language=language or None,
            initial_prompt=prompt or None,
            temperature=temperature or 0.0,
            beam_size=5,
            best_of=5,                # Generate 5 candidates, pick best
            patience=1.5,             # Wait longer for better results
            condition_on_previous_text=True,  # Better context continuity
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=300,   # Catch shorter pauses
                speech_pad_ms=200,             # Pad speech segments
            ),
        )

        # Collect all segments
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())

        full_text = " ".join(text_parts)

        logger.info(f"✅ Transcribed: \"{full_text[:100]}{'...' if len(full_text) > 100 else ''}\"")
        logger.info(f"   Language: {info.language} (prob: {info.language_probability:.2f})")
        logger.info(f"   Duration: {info.duration:.1f}s")

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
    print(f"  Mode:  CPU float32 ({CPU_THREADS} threads)")
    print(f"  URL:   http://localhost:{PORT}")
    print("=" * 60)

    uvicorn.run(app, host=HOST, port=PORT, log_level="info")

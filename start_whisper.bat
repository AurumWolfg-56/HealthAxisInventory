@echo off
echo ============================================================
echo   Norvexis Local Whisper Server
echo   Model: whisper-large-v3-turbo (NVIDIA GPU)
echo   URL:   http://localhost:8765
echo ============================================================
echo.
echo Starting server...
echo (First run downloads the model - may take a few minutes)
echo.
python whisper_server.py
pause

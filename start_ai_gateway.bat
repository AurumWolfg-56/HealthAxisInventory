@echo off
title Norvexis AI Gateway
color 0A

echo ============================================================
echo   Norvexis Local AI Gateway - Auto-Restart Watchdog
echo   Whisper STT + LLM Proxy (localhost:8765)
echo ============================================================
echo.

cd /d "R:\APPS\healthaxis-inventory-pwa"

:loop
echo [%date% %time%] Starting AI Gateway...
python whisper_server.py
echo.
echo [%date% %time%] AI Gateway stopped (exit code: %errorlevel%)
echo [%date% %time%] Restarting in 5 seconds... (Ctrl+C to stop)
timeout /t 5 /nobreak >nul
goto loop

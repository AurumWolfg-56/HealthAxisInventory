@echo off
title Norvexis Core - Local AI Gateway
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║   NORVEXIS CORE - LOCAL AI GATEWAY  v3.0                ║
echo  ║                                                          ║
echo  ║   1. Enables CORS on LM Studio (port 1234)             ║
echo  ║   2. Starts Whisper STT + LLM Proxy (port 8765)        ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: ─── Wait for system to be ready on boot ───────────────────────
echo  [*] Waiting for system to be ready...
timeout /t 8 /nobreak >nul

:: ─── Step 1: Enable CORS on LM Studio ─────────────────────────
echo  [*] Enabling CORS on LM Studio...
lms server stop >nul 2>&1
timeout /t 2 /nobreak >nul
lms server start --port 1234 --cors >nul 2>&1
if %errorlevel% equ 0 (
    echo  [32m[OK][0m LM Studio CORS enabled on port 1234
) else (
    echo  [33m[WARN][0m Could not configure LM Studio CORS
    echo         Open LM Studio manually and enable server
)

:: ─── Step 2: Check if gateway already running ──────────────────
curl -s --max-time 3 http://localhost:8765/health >nul 2>&1
if %errorlevel% equ 0 (
    echo  [32m[OK][0m AI Gateway already running on port 8765
    echo.
    echo  All services ready! This window will close in 5 seconds.
    timeout /t 5 /nobreak >nul
    exit /b
)

:: ─── Step 3: Check Python ──────────────────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [33m[WARN][0m Python not found. Gateway (Whisper STT) won't start.
    echo         LM Studio CORS is enabled, so vision/LLM will still work.
    echo.
    echo  Press any key to close...
    pause >nul
    exit /b
)

echo  [32m[OK][0m Python found

:: ─── Step 4: Start gateway with watchdog ───────────────────────
echo.
echo  ─────────────────────────────────────────────────────────────
echo  [*] Starting AI Gateway (Whisper STT + LLM Proxy)...
echo  [*] This window must stay open for Whisper STT.
echo  [*] Vision/LLM now connects directly to LM Studio (CORS).
echo  ─────────────────────────────────────────────────────────────
echo.

cd /d "R:\APPS\healthaxis-inventory-pwa"

:loop
echo [%date% %time%] Starting whisper_server.py...
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" whisper_server.py
) else (
    python whisper_server.py
)
set EXIT_CODE=%errorlevel%
echo.
echo [%date% %time%] Gateway stopped (exit code: %EXIT_CODE%)

if %EXIT_CODE% equ 0 (
    echo [%date% %time%] Clean shutdown. Not restarting.
    goto end
)

echo [%date% %time%] Crash detected! Restarting in 10 seconds...
timeout /t 10 /nobreak >nul
goto loop

:end
echo.
echo  Press any key to close.
pause >nul

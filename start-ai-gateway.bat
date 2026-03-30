@echo off
title Norvexis Core - Local AI Gateway
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║   NORVEXIS CORE - LOCAL AI GATEWAY  v2.1                ║
echo  ║                                                          ║
echo  ║   Whisper (Speech-to-Text) + LM Studio Proxy            ║
echo  ║   Port: 8765  (CORS enabled for norvexiscore.com)       ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: ─── Check if already running ──────────────────────────────────
curl -s --max-time 3 http://localhost:8765/health >nul 2>&1
if %errorlevel% equ 0 (
    echo  [32m[!] AI Gateway is ALREADY running on port 8765[0m
    echo      No need to start again.
    echo.
    echo  Press any key to exit...
    pause >nul
    exit /b
)

:: ─── Wait for system to be ready (on boot, Python may not be in PATH yet)
echo  [*] Waiting for system to be ready...
timeout /t 5 /nobreak >nul

:: ─── Check if Python is available ──────────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [31m[ERROR] Python not found in PATH![0m
    echo          Waiting 15 seconds and retrying...
    timeout /t 15 /nobreak >nul
    python --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo  [31m[ERROR] Python still not found. Cannot start gateway.[0m
        echo          Install Python from https://python.org
        echo.
        echo  Press any key to exit...
        pause >nul
        exit /b 1
    )
)

echo  [32m[OK][0m Python found
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo       %%v

:: ─── Check if LM Studio is running ─────────────────────────────
echo.
echo  [*] Checking LM Studio...
curl -s --max-time 3 http://127.0.0.1:1234/v1/models >nul 2>&1
if %errorlevel% equ 0 (
    echo  [32m[OK][0m LM Studio is running at 127.0.0.1:1234
) else (
    echo  [33m[WARN][0m LM Studio not detected yet (it may start later)
    echo         Whisper STT will work, but AI features need LM Studio.
)

:: ─── Start the gateway with auto-restart watchdog ───────────────
echo.
echo  ─────────────────────────────────────────────────────────────
echo  [*] Starting AI Gateway with auto-restart watchdog...
echo  [*] This window must stay open for AI features to work.
echo  [*] Press Ctrl+C to stop the server.
echo  ─────────────────────────────────────────────────────────────
echo.

cd /d "R:\APPS\healthaxis-inventory-pwa"

:: ─── Watchdog loop: auto-restart on crash ───────────────────────
:loop
echo [%date% %time%] Starting whisper_server.py...
python whisper_server.py
set EXIT_CODE=%errorlevel%
echo.
echo [%date% %time%] Gateway stopped (exit code: %EXIT_CODE%)

:: If exit code is 0, user pressed Ctrl+C intentionally
if %EXIT_CODE% equ 0 (
    echo [%date% %time%] Clean shutdown detected. Not restarting.
    goto end
)

echo [%date% %time%] Crash detected! Restarting in 10 seconds...
echo [%date% %time%] Press Ctrl+C now if you want to stop.
timeout /t 10 /nobreak >nul
goto loop

:end
echo.
echo  Gateway stopped. Press any key to close.
pause >nul

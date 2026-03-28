@echo off
title Norvexis Core - Local AI Gateway
color 0A

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   🧠  NORVEXIS CORE - LOCAL AI GATEWAY      ║
echo  ║                                              ║
echo  ║   Whisper (Speech-to-Text) + LM Studio Proxy ║
echo  ║   Port: 8765                                 ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: Check if already running
curl -s http://localhost:8765/health >nul 2>&1
if %errorlevel% equ 0 (
    echo  [!] AI Gateway is ALREADY running on port 8765
    echo      No need to start again.
    echo.
    pause
    exit /b
)

:: Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Python not found in PATH!
    echo          Install Python from https://python.org
    pause
    exit /b 1
)

echo  [*] Starting AI Gateway...
echo  [*] This window must stay open for AI features to work.
echo  [*] Press Ctrl+C to stop the server.
echo.
echo  ─────────────────────────────────────────────────
echo.

cd /d "R:\APPS\healthaxis-inventory-pwa"
python whisper_server.py

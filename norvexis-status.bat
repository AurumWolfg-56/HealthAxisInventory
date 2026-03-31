@echo off
title Norvexis Core - System Status
color 0B
mode con: cols=70 lines=45

echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║         NORVEXIS CORE - LOCAL AI STATUS CHECK             ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  Checking services...
echo  ────────────────────────────────────────────────────────────
echo.

:: ─── 1. LM Studio (port 1234) ─────────────────────────────────
set LM_STATUS=OFFLINE
set LM_CORS=NO
curl -s --max-time 3 http://127.0.0.1:1234/v1/models >nul 2>&1
if %errorlevel% equ 0 set LM_STATUS=ONLINE

:: Check CORS
for /f "tokens=*" %%a in ('curl -s --max-time 3 -I -H "Origin: https://norvexiscore.com" http://127.0.0.1:1234/v1/models 2^>nul ^| findstr /i "access-control"') do set LM_CORS=YES

if "%LM_STATUS%"=="ONLINE" (
    echo   [32m■[0m LM Studio              [32mONLINE[0m  (127.0.0.1:1234)
    if "%LM_CORS%"=="YES" (
        echo     CORS: [32mENABLED[0m (web app can connect directly)
    ) else (
        echo     CORS: [31mDISABLED[0m (run: lms server stop ^&^& lms server start --cors)
    )
) else (
    echo   [31m■[0m LM Studio              [31mOFFLINE[0m (127.0.0.1:1234)
    echo     ^> Open LM Studio and load your models
)

:: ─── 2. AI Gateway (port 8765) ────────────────────────────────
set GW_STATUS=OFFLINE
curl -s --max-time 3 http://localhost:8765/health >nul 2>&1
if %errorlevel% equ 0 set GW_STATUS=ONLINE

if "%GW_STATUS%"=="ONLINE" (
    echo   [32m■[0m AI Gateway (Whisper)    [32mONLINE[0m  (localhost:8765)
) else (
    echo   [33m■[0m AI Gateway (Whisper)    [33mOFFLINE[0m (localhost:8765)
    echo     Whisper STT won't work, but vision/LLM still works via LM Studio
)

:: ─── 3. Overall readiness ─────────────────────────────────────
echo.
echo  ────────────────────────────────────────────────────────────
echo   Web App Status (norvexiscore.com):
echo.

if "%LM_STATUS%"=="ONLINE" (
    if "%LM_CORS%"=="YES" (
        echo   [32m■ VISION/LLM:  READY[0m (direct to LM Studio with CORS)
    ) else if "%GW_STATUS%"=="ONLINE" (
        echo   [32m■ VISION/LLM:  READY[0m (via gateway proxy)
    ) else (
        echo   [31m■ VISION/LLM:  NOT READY[0m
        echo     Enable CORS: lms server stop ^&^& lms server start --port 1234 --cors
    )
) else (
    echo   [31m■ VISION/LLM:  NOT READY[0m (LM Studio offline)
)

if "%GW_STATUS%"=="ONLINE" (
    echo   [32m■ WHISPER STT: READY[0m
) else (
    echo   [33m■ WHISPER STT: OFFLINE[0m (run start-ai-gateway.bat)
)

:: ─── Actions ──────────────────────────────────────────────────
echo.
echo  ════════════════════════════════════════════════════════════
echo.
echo   Quick Actions:
echo     [1] Enable CORS on LM Studio (fix vision)
echo     [2] Start AI Gateway (fix Whisper STT)
echo     [3] Full restart (CORS + Gateway)
echo     [4] Test LLM (Smart Model)
echo     [Q] Quit
echo.
set /p CHOICE="  Select: "

if /i "%CHOICE%"=="1" goto ENABLE_CORS
if /i "%CHOICE%"=="2" goto START_GW
if /i "%CHOICE%"=="3" goto FULL_RESTART
if /i "%CHOICE%"=="4" goto TEST_VISION
goto END

:ENABLE_CORS
echo.
echo  Enabling CORS on LM Studio...
lms server stop >nul 2>&1
timeout /t 2 /nobreak >nul
lms server start --port 1234 --cors
echo.
echo  [32mDone! Refresh norvexiscore.com (Ctrl+Shift+R)[0m
goto END

:START_GW
echo.
start /min "" "R:\APPS\healthaxis-inventory-pwa\start-ai-gateway.bat"
echo  [32mGateway starting in background (wait ~30s for Whisper)[0m
goto END

:FULL_RESTART
echo.
echo  Step 1: Enabling CORS on LM Studio...
lms server stop >nul 2>&1
timeout /t 2 /nobreak >nul
lms server start --port 1234 --cors
echo.
echo  Step 2: Starting AI Gateway...
taskkill /f /im python.exe >nul 2>&1
timeout /t 3 /nobreak >nul
start /min "" "R:\APPS\healthaxis-inventory-pwa\start-ai-gateway.bat"
echo.
echo  [32mAll services restarting! Wait ~30s then refresh the web app.[0m
goto END

:TEST_VISION
echo.
echo  Testing Smart Model (Qwen2.5 14B)...
curl -s --max-time 30 -X POST http://127.0.0.1:1234/v1/chat/completions -H "Content-Type: application/json" -d "{\"model\":\"qwen2.5-14b-instruct\",\"messages\":[{\"role\":\"user\",\"content\":\"Say OK\"}],\"max_tokens\":5}"
echo.
if %errorlevel% equ 0 (
    echo  [32mSmart model responded![0m
) else (
    echo  [31mSmart model not responding[0m
)
goto END

:END
echo.
pause

@echo off
title Norvexis Core - System Status
color 0B
mode con: cols=70 lines=40

echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║         NORVEXIS CORE - LOCAL AI STATUS CHECK             ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  Checking services... Please wait.
echo  ────────────────────────────────────────────────────────────
echo.

:: ─── 1. LM Studio (port 1234) ─────────────────────────────────
set LM_STATUS=OFFLINE
set LM_MODELS=none
curl -s --max-time 3 http://127.0.0.1:1234/v1/models >"%TEMP%\nv_lm.json" 2>nul
if %errorlevel% equ 0 (
    set LM_STATUS=ONLINE
    for /f "delims=" %%a in ('type "%TEMP%\nv_lm.json" ^| findstr /c:"qwen" /c:"llava" /c:"llama" /c:"mistral" /c:"nomic" /c:"embed" /i') do set LM_MODELS=%%a
)

if "%LM_STATUS%"=="ONLINE" (
    echo   [32m■[0m LM Studio              [32mONLINE[0m  (127.0.0.1:1234)
) else (
    echo   [31m■[0m LM Studio              [31mOFFLINE[0m (127.0.0.1:1234)
    echo     ^> Open LM Studio and load your models
)

:: ─── 2. AI Gateway / Whisper Server (port 8765) ───────────────
set GW_STATUS=OFFLINE
set WHISPER_MODEL=unknown
set WHISPER_DEVICE=unknown
curl -s --max-time 5 http://localhost:8765/health >"%TEMP%\nv_gw.json" 2>nul
if %errorlevel% equ 0 (
    set GW_STATUS=ONLINE
    for /f "tokens=*" %%a in ('type "%TEMP%\nv_gw.json"') do set GW_RAW=%%a
)

if "%GW_STATUS%"=="ONLINE" (
    echo   [32m■[0m AI Gateway (Whisper)    [32mONLINE[0m  (localhost:8765)
) else (
    echo   [31m■[0m AI Gateway (Whisper)    [31mOFFLINE[0m (localhost:8765)
    echo     ^> Run: start-ai-gateway.bat
)

:: ─── 3. Check python processes ────────────────────────────────
set PY_RUNNING=NO
for /f %%a in ('tasklist /fi "imagename eq python.exe" /nh 2^>nul ^| findstr /i "python"') do set PY_RUNNING=YES

echo.
echo  ────────────────────────────────────────────────────────────
echo   Process Status:
if "%PY_RUNNING%"=="YES" (
    echo   [32m■[0m Python processes:       [32mRUNNING[0m
) else (
    echo   [31m■[0m Python processes:       [33mNONE FOUND[0m
)

:: ─── 4. Check if auto-start is configured ─────────────────────
set AUTOSTART=NO
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Norvexis AI Gateway.lnk" set AUTOSTART=YES

echo.
echo  ────────────────────────────────────────────────────────────
echo   Boot Configuration:
if "%AUTOSTART%"=="YES" (
    echo   [32m■[0m Auto-start on boot:    [32mENABLED[0m
) else (
    echo   [31m■[0m Auto-start on boot:    [31mDISABLED[0m
    echo     ^> Run: norvexis-setup-autostart.bat
)

:: ─── 5. Quick connectivity test to web app ────────────────────
echo.
echo  ────────────────────────────────────────────────────────────
echo   Web App Connectivity (Hostinger):
echo   The web app at norvexiscore.com connects to this PC's
echo   AI Gateway. For this to work:
echo.
if "%GW_STATUS%"=="ONLINE" (
    if "%LM_STATUS%"=="ONLINE" (
        echo   [32m■[0m READY - All services running[0m
        echo     Vision OCR:  qwen2.5-vl-7b-instruct
        echo     Gateway:     localhost:8765 ^(CORS enabled^)
        echo     Whisper STT: large-v3-turbo ^(GPU^)
    ) else (
        echo   [33m■[0m PARTIAL - Gateway OK but LM Studio offline[0m
        echo     Whisper STT will work, but AI features won't.
        echo     ^> Open LM Studio and load models.
    )
) else (
    echo   [31m■[0m NOT READY - AI Gateway is offline[0m
    echo     Web app AI features will not work.
    echo     ^> Run: start-ai-gateway.bat
)

:: ─── Summary ──────────────────────────────────────────────────
echo.
echo  ════════════════════════════════════════════════════════════
echo.

:: ─── Actions Menu ─────────────────────────────────────────────
echo   Actions:
echo     [1] Start AI Gateway now
echo     [2] Restart AI Gateway
echo     [3] Open LM Studio
echo     [4] Test Vision OCR (ping)
echo     [Q] Quit
echo.
set /p CHOICE="  Select action: "

if /i "%CHOICE%"=="1" goto START_GW
if /i "%CHOICE%"=="2" goto RESTART_GW
if /i "%CHOICE%"=="3" goto OPEN_LM
if /i "%CHOICE%"=="4" goto TEST_VISION
if /i "%CHOICE%"=="q" goto END

:START_GW
echo.
echo  Starting AI Gateway...
start /min "" "R:\APPS\healthaxis-inventory-pwa\start-ai-gateway.bat"
echo  [32m Gateway starting in background (minimized window)[0m
echo  Wait ~30 seconds for Whisper model to load.
timeout /t 5 /nobreak >nul
goto END

:RESTART_GW
echo.
echo  Stopping existing gateway...
taskkill /f /fi "windowtitle eq Norvexis Core - Local AI Gateway" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
timeout /t 3 /nobreak >nul
echo  Starting fresh...
start /min "" "R:\APPS\healthaxis-inventory-pwa\start-ai-gateway.bat"
echo  [32m Gateway restarting (wait ~30s for Whisper model)[0m
timeout /t 5 /nobreak >nul
goto END

:OPEN_LM
echo.
echo  Opening LM Studio...
start "" "C:\Users\rejye\AppData\Local\Programs\lm-studio\LM Studio.exe" 2>nul
if %errorlevel% neq 0 (
    echo  [33m Could not find LM Studio. Open it manually.[0m
)
goto END

:TEST_VISION
echo.
echo  Testing LM Studio vision model...
curl -s --max-time 5 -X POST http://127.0.0.1:1234/v1/chat/completions -H "Content-Type: application/json" -d "{\"model\":\"qwen2.5-vl-7b-instruct\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with only: OK\"}],\"max_tokens\":5}" 2>nul
echo.
if %errorlevel% equ 0 (
    echo  [32m Vision model responded![0m
) else (
    echo  [31m Vision model not responding. Check LM Studio.[0m
)
goto END

:END
echo.
echo  Press any key to exit...
pause >nul

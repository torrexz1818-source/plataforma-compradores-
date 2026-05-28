@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "FRONTEND_DIR=%ROOT_DIR%"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "AI_ENGINE_DIR=%ROOT_DIR%ai-engine"

echo Abriendo frontend, backend y AI Engine de BUYER NODUS...

start "BUYER NODUS Backend" cmd /k "cd /d "%BACKEND_DIR%" && npm.cmd run build && npm.cmd run start:prod"
start "BUYER NODUS AI Engine" cmd /k "cd /d "%AI_ENGINE_DIR%" && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "BUYER NODUS Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm.cmd run dev -- --host 127.0.0.1"

echo.
echo Frontend, backend y AI Engine iniciados en ventanas separadas.
echo Frontend: http://127.0.0.1:5173
echo Backend:  http://127.0.0.1:10000
echo AI Engine: http://127.0.0.1:8000
echo Si alguna ventana muestra "EADDRINUSE", cierra la instancia vieja que ya estaba abierta.
echo.
pause

@echo off
REM ============================================
REM DarkPDF Local Development Script
REM ============================================
REM Runs both API and web server for local development

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   DarkPDF Local Development
echo ========================================
echo.

set "PROJECT_ROOT=%~dp0.."
set "API_DIR=%PROJECT_ROOT%\api"
set "WEB_DIR=%PROJECT_ROOT%\web"

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.10+
    exit /b 1
)

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js 18+
    exit /b 1
)

echo Starting API server on http://localhost:8000 ...
echo Starting Web server on http://localhost:3000 ...
echo.
echo Press Ctrl+C to stop both servers.
echo.

REM Start API in background
start "DarkPDF API" /d "%API_DIR%" cmd /c "python -m pip install -r requirements.txt -q && python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload"

REM Wait a moment for API to start
timeout /t 3 /nobreak >nul

REM Start Web in foreground
cd /d "%WEB_DIR%"
set "NEXT_PUBLIC_API_URL=http://localhost:8000"
call npm install --silent
call npm run dev

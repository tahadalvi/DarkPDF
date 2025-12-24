@echo off
REM ============================================
REM DarkPDF Windows Build Script
REM ============================================
REM This script builds the complete DarkPDF desktop application for Windows

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   DarkPDF Windows Build Script
echo ========================================
echo.

set "PROJECT_ROOT=%~dp0.."
set "BUILD_DIR=%PROJECT_ROOT%\build"
set "API_DIR=%PROJECT_ROOT%\api"
set "WEB_DIR=%PROJECT_ROOT%\web"
set "DESKTOP_DIR=%PROJECT_ROOT%\desktop"

REM Create build directory
if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"

REM Step 1: Build Python API
echo [1/3] Building Python API...
cd /d "%API_DIR%"

echo   - Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.10+ and add it to PATH.
    exit /b 1
)

echo   - Installing dependencies...
python -m pip install -r requirements.txt -q
python -m pip install pyinstaller -q

echo   - Running PyInstaller...
python -m PyInstaller api.spec --noconfirm --clean
if errorlevel 1 (
    echo ERROR: PyInstaller build failed.
    exit /b 1
)

REM Copy API executable
if exist "%BUILD_DIR%\api" rmdir /s /q "%BUILD_DIR%\api"
mkdir "%BUILD_DIR%\api"
copy /y "%API_DIR%\dist\api.exe" "%BUILD_DIR%\api\"

echo   - API built successfully!
echo.

REM Step 2: Build Next.js Frontend
echo [2/3] Building Next.js frontend...
cd /d "%WEB_DIR%"

echo   - Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js 18+ and add it to PATH.
    exit /b 1
)

echo   - Installing dependencies...
call npm install --silent

echo   - Building static export...
set "BUILD_STANDALONE=true"
set "NEXT_PUBLIC_API_URL=http://localhost:8000"
call npm run build
if errorlevel 1 (
    echo ERROR: Next.js build failed.
    exit /b 1
)

REM Copy web files
if exist "%BUILD_DIR%\web" rmdir /s /q "%BUILD_DIR%\web"
xcopy /s /e /i /q "%WEB_DIR%\out" "%BUILD_DIR%\web"

REM Copy pdf worker
if exist "%WEB_DIR%\public\pdf.worker.min.js" (
    copy /y "%WEB_DIR%\public\pdf.worker.min.js" "%BUILD_DIR%\web\"
)

echo   - Frontend built successfully!
echo.

REM Step 3: Build Electron App
echo [3/3] Building Electron installer...
cd /d "%DESKTOP_DIR%"

echo   - Installing Electron dependencies...
call npm install --silent

echo   - Building installer...
call npm run build
if errorlevel 1 (
    echo ERROR: Electron build failed.
    exit /b 1
)

echo   - Electron installer built successfully!
echo.

echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Installer location:
echo   %DESKTOP_DIR%\dist\
echo.

pause

<#
.SYNOPSIS
    Build script for DarkPDF Windows Desktop Application

.DESCRIPTION
    This script builds the complete DarkPDF desktop application for Windows:
    1. Builds the Python API as a standalone executable using PyInstaller
    2. Builds the Next.js frontend as a static export
    3. Packages everything with Electron Builder

.PARAMETER SkipApi
    Skip building the Python API (useful if API hasn't changed)

.PARAMETER SkipWeb
    Skip building the web frontend (useful if frontend hasn't changed)

.PARAMETER SkipElectron
    Skip building the Electron app (just build API and web)

.EXAMPLE
    .\build-windows.ps1
    .\build-windows.ps1 -SkipApi
#>

param(
    [switch]$SkipApi,
    [switch]$SkipWeb,
    [switch]$SkipElectron
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BuildDir = Join-Path $ProjectRoot "build"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DarkPDF Windows Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create build directory
if (-not (Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Path $BuildDir | Out-Null
}

# Step 1: Build Python API
if (-not $SkipApi) {
    Write-Host "[1/3] Building Python API..." -ForegroundColor Yellow

    $ApiDir = Join-Path $ProjectRoot "api"
    $ApiBuildDir = Join-Path $BuildDir "api"

    Push-Location $ApiDir
    try {
        # Check Python is available
        $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
        if (-not $pythonCmd) {
            $pythonCmd = Get-Command python3 -ErrorAction SilentlyContinue
        }
        if (-not $pythonCmd) {
            throw "Python not found. Please install Python 3.10+ and add it to PATH."
        }

        Write-Host "  - Installing dependencies..." -ForegroundColor Gray
        & python -m pip install -r requirements.txt --quiet
        & python -m pip install pyinstaller --quiet

        Write-Host "  - Running PyInstaller..." -ForegroundColor Gray
        & python -m PyInstaller api.spec --noconfirm --clean

        # Copy the built executable to build directory
        if (Test-Path $ApiBuildDir) {
            Remove-Item -Recurse -Force $ApiBuildDir
        }
        New-Item -ItemType Directory -Path $ApiBuildDir | Out-Null

        $DistDir = Join-Path $ApiDir "dist"
        Copy-Item -Path (Join-Path $DistDir "api.exe") -Destination $ApiBuildDir

        Write-Host "  - API built successfully!" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "[1/3] Skipping Python API build..." -ForegroundColor Gray
}

# Step 2: Build Next.js Frontend
if (-not $SkipWeb) {
    Write-Host "[2/3] Building Next.js frontend..." -ForegroundColor Yellow

    $WebDir = Join-Path $ProjectRoot "web"
    $WebBuildDir = Join-Path $BuildDir "web"

    Push-Location $WebDir
    try {
        # Check Node.js is available
        $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
        if (-not $nodeCmd) {
            throw "Node.js not found. Please install Node.js 18+ and add it to PATH."
        }

        Write-Host "  - Installing dependencies..." -ForegroundColor Gray
        & npm install --silent

        Write-Host "  - Building static export..." -ForegroundColor Gray
        $env:BUILD_STANDALONE = "true"
        $env:NEXT_PUBLIC_API_URL = "http://localhost:8000"
        & npm run build

        # Copy the built files to build directory
        if (Test-Path $WebBuildDir) {
            Remove-Item -Recurse -Force $WebBuildDir
        }

        $OutDir = Join-Path $WebDir "out"
        Copy-Item -Recurse -Path $OutDir -Destination $WebBuildDir

        # Copy pdf.worker.min.js to the output
        $WorkerSrc = Join-Path $WebDir "public" "pdf.worker.min.js"
        if (Test-Path $WorkerSrc) {
            Copy-Item -Path $WorkerSrc -Destination $WebBuildDir
        }

        Write-Host "  - Frontend built successfully!" -ForegroundColor Green
    }
    finally {
        Pop-Location
        Remove-Item Env:\BUILD_STANDALONE -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "[2/3] Skipping Next.js frontend build..." -ForegroundColor Gray
}

# Step 3: Build Electron App
if (-not $SkipElectron) {
    Write-Host "[3/3] Building Electron installer..." -ForegroundColor Yellow

    $DesktopDir = Join-Path $ProjectRoot "desktop"

    Push-Location $DesktopDir
    try {
        Write-Host "  - Installing Electron dependencies..." -ForegroundColor Gray
        & npm install --silent

        Write-Host "  - Building installer..." -ForegroundColor Gray
        & npm run build

        Write-Host "  - Electron installer built successfully!" -ForegroundColor Green

        $InstallerPath = Join-Path $DesktopDir "dist" "DarkPDF Setup*.exe"
        $Installer = Get-ChildItem -Path $InstallerPath | Select-Object -First 1
        if ($Installer) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "  Build Complete!" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Installer location:" -ForegroundColor White
            Write-Host "  $($Installer.FullName)" -ForegroundColor Cyan
        }
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "[3/3] Skipping Electron build..." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green

<#
.SYNOPSIS
    Development script for running DarkPDF locally

.DESCRIPTION
    This script starts both the Python API and Next.js frontend for local development.

.EXAMPLE
    .\dev-local.ps1
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DarkPDF Local Development" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    throw "Python not found. Please install Python 3.10+"
}

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    throw "Node.js not found. Please install Node.js 18+"
}

$ApiDir = Join-Path $ProjectRoot "api"
$WebDir = Join-Path $ProjectRoot "web"

Write-Host "Starting API server on http://localhost:8000 ..." -ForegroundColor Yellow
Write-Host "Starting Web server on http://localhost:3000 ..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

# Start API server in background
$apiJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    & python -m pip install -r requirements.txt -q
    & python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
} -ArgumentList $ApiDir

# Wait for API to start
Start-Sleep -Seconds 3

# Install web dependencies
Push-Location $WebDir
try {
    & npm install --silent

    # Set environment and start dev server
    $env:NEXT_PUBLIC_API_URL = "http://localhost:8000"
    & npm run dev
}
finally {
    Pop-Location

    # Cleanup: stop API job
    if ($apiJob) {
        Stop-Job -Job $apiJob -ErrorAction SilentlyContinue
        Remove-Job -Job $apiJob -ErrorAction SilentlyContinue
    }
}

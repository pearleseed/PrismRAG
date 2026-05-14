# PrismRAG Backend Startup Script for Windows (PowerShell)
$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Port = if ($env:PRISMRAG_BACKEND_PORT) { $env:PRISMRAG_BACKEND_PORT } else { "8080" }
$HostAddr = if ($env:PRISMRAG_BACKEND_HOST) { $env:PRISMRAG_BACKEND_HOST } else { "0.0.0.0" }
$VenvPath = Join-Path $RepoRoot "venv"

# Cleanup: kill processes on port
$ExistingProcess = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($ExistingProcess) {
    Write-Host "Terminating process(es) on port $Port : $ExistingProcess" -ForegroundColor Yellow
    Stop-Process -Id $ExistingProcess -Force -ErrorAction SilentlyContinue
}

# Environment
if (!(Test-Path "$VenvPath\Scripts\python.exe")) {
    Write-Error "Python venv not found. Run ./scripts/setup.sh (via Git Bash) or create venv manually."
    exit 1
}

# Activate venv and run
& "$VenvPath\Scripts\Activate.ps1"

Write-Host "🚀 Starting PrismRAG backend on http://$($HostAddr):$Port" -ForegroundColor Green

Set-Location (Join-Path $RepoRoot "backend")
python -m uvicorn app.main:app --reload --host $HostAddr --port $Port --loop asyncio --http httptools

# PrismRAG ChromaDB Startup Script for Windows (PowerShell)
$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Port = if ($env:CHROMA_PORT) { $env:CHROMA_PORT } else { "8002" }
$DbPath = Join-Path $RepoRoot "chroma_db"

# Cleanup port 8002
$ExistingProcess = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($ExistingProcess) {
    Write-Host "Terminating process(es) on port $Port : $ExistingProcess" -ForegroundColor Yellow
    Stop-Process -Id $ExistingProcess -Force -ErrorAction SilentlyContinue
}

if (!(Test-Path $DbPath)) {
    New-Item -ItemType Directory -Path $DbPath | Out-Null
}

Write-Host "🚀 Starting ChromaDB on port $Port (path: $DbPath)" -ForegroundColor Green

# Use chroma CLI
chroma run --host localhost --port $Port --path $DbPath

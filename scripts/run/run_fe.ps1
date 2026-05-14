# PrismRAG Frontend Startup Script for Windows (PowerShell)
$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $RepoRoot

# Signal handling (PowerShell doesn't have trap the same way as bash for CTRL+C, 
# but it handles child processes reasonably well in many cases)

# Prerequisites
if (!(Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Error "Bun is required. Install from https://bun.sh"
    exit 1
}

if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    bun install
}

Write-Host "🚀 Starting PrismRAG frontend on http://localhost:5174" -ForegroundColor Green
bun run --filter prismrag-frontend dev

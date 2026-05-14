# PrismRAG Open WebUI Startup Script for Windows (PowerShell)
$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$OwDir = Join-Path $RepoRoot "apps\open-webui"
$OwVenv = Join-Path $OwDir ".venv"
$Port = if ($env:OPEN_WEBUI_PORT) { $env:OPEN_WEBUI_PORT } else { "3000" }

# Cleanup: kill processes on port
$ExistingProcess = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($ExistingProcess) {
    Write-Host "Terminating process(es) on port $Port : $ExistingProcess" -ForegroundColor Yellow
    Stop-Process -Id $ExistingProcess -Force -ErrorAction SilentlyContinue
}

# Check venv
if (!(Test-Path "$OwVenv\Scripts\python.exe")) {
    Write-Error "Open WebUI venv not found at $OwVenv. Run ./scripts/setup.sh (via Git Bash) first."
    exit 1
}

# Sync dependencies
if (Get-Command uv -ErrorAction SilentlyContinue) {
    Write-Host "Syncing Open WebUI dependencies with uv..."
    & uv pip install --python "$OwVenv\Scripts\python.exe" -q -r "$OwDir\requirements.txt"
}

# Environment
& "$OwVenv\Scripts\Activate.ps1"

if (!(Test-Path "$OwDir\data")) { New-Item -ItemType Directory -Force -Path "$OwDir\data" }
$AbsDb = Join-Path $OwDir "data\webui.db"
$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "sqlite:///$AbsDb" }
$env:WEBUI_SECRET_KEY = if ($env:WEBUI_SECRET_KEY) { $env:WEBUI_SECRET_KEY } else { & python -c "import secrets; print(secrets.token_hex(24))" }

# Detect IP
$PrimaryIp = & python -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(0.5); s.connect(('8.8.8.8', 80)); print(s.getsockname()[0]); s.close()"
if (!$PrimaryIp) { $PrimaryIp = "127.0.0.1" }

$env:OPENAI_API_BASE_URL = if ($env:OPENAI_API_BASE_URL) { $env:OPENAI_API_BASE_URL } else { "http://127.0.0.1:8080/v1" }
$env:OPENAI_API_KEY = if ($env:OPENAI_API_KEY) { $env:OPENAI_API_KEY } else { "sk-local-prismrag" }
$env:ENABLE_OLLAMA_API = if ($env:ENABLE_OLLAMA_API) { $env:ENABLE_OLLAMA_API } else { "false" }
$env:WEBUI_AUTH = if ($env:WEBUI_AUTH) { $env:WEBUI_AUTH } else { "false" }

# Host selection
$BindHost = if ($env:OPEN_WEBUI_HOST) { $env:OPEN_WEBUI_HOST } else { $PrimaryIp }

Write-Host "🚀 Starting Open WebUI on http://$($BindHost):$Port" -ForegroundColor Green
Write-Host "   Bridge: $($env:OPENAI_API_BASE_URL)"

Set-Location $OwDir
open-webui serve --host $BindHost --port $Port

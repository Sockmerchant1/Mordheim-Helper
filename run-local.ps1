$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) {
  $bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if (Test-Path $bundledNode) {
    $nodeExe = $bundledNode
  }
}

if (-not $nodeExe) {
  Write-Host "Could not find Node.js on this computer."
  Write-Host "Please install Node.js from https://nodejs.org, then run this file again."
  Read-Host "Press Enter to close"
  exit 1
}

if (-not (Test-Path "node_modules")) {
  if (Test-Path ".tools\package\bin\npm-cli.js") {
    & $nodeExe ".tools\package\bin\npm-cli.js" install --cache ".npm-cache" --ignore-scripts
  } else {
    npm install
  }
}

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$root'; & '$nodeExe' --experimental-sqlite server/index.ts"
)

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$root'; & '$nodeExe' node_modules\vite\bin\vite.js --host 127.0.0.1"
)

Write-Host "Mordheim Warband Manager is starting."
Write-Host "Open http://127.0.0.1:5173 once the Vite window says it is ready."

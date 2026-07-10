# =========================================================
# Nombre completo: diagnostico-bloqueo.ps1
# Ruta o ubicación: /scripts/diagnostico-bloqueo.ps1
# Función o funciones:
# - Abrir la aplicación real con DevTools remoto.
# - Saltar la certificación y el smoke test para llegar rápido al bloqueo.
# - Registrar los últimos scripts analizados antes de congelarse el renderer.
# - No ejecutar sincronizaciones externas.
# =========================================================
[CmdletBinding()]
param(
  [int]$Port = 9323,
  [int]$ObservationSeconds = 20
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  & chcp.com 65001 | Out-Null
} catch {}

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Electron = Join-Path $Root "node_modules\.bin\electron.cmd"
$Probe = Join-Path $PSScriptRoot "diagnostico-runtime.js"
$OutputDir = Join-Path $Root ("artifacts\bloqueo-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$RuntimeReport = Join-Path $OutputDir "runtime-bloqueo.json"
$StdOut = Join-Path $OutputDir "electron.stdout.log"
$StdErr = Join-Path $OutputDir "electron.stderr.log"
$AppProcess = $null

function Stop-ProcessTree {
  param([int]$ProcessId)

  if ($ProcessId -le 0) {
    return
  }

  try {
    & taskkill.exe /PID $ProcessId /T /F 2>$null | Out-Null
  } catch {}
}

if (-not (Test-Path $Electron)) {
  throw "Falta Electron local. Ejecute npm install."
}

if (-not (Test-Path $Probe)) {
  throw "Falta scripts/diagnostico-runtime.js"
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

Write-Host ""
Write-Host "=== Diagnóstico directo del bloqueo BDLocal ===" -ForegroundColor Cyan
Write-Host "Proyecto: $Root"
Write-Host "Reporte: $RuntimeReport"

try {
  Get-CimInstance Win32_Process -Filter "Name='electron.exe'" |
    Where-Object {
      $_.CommandLine -and
      $_.CommandLine.IndexOf(
        $Root,
        [System.StringComparison]::OrdinalIgnoreCase
      ) -ge 0
    } |
    ForEach-Object {
      Stop-ProcessTree -ProcessId ([int]$_.ProcessId)
    }
} catch {
  Write-Warning ("No se pudieron cerrar instancias anteriores: " + $_.Exception.Message)
}

try {
  $AppProcess = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList @(
      "/d",
      "/s",
      "/c",
      "`"$Electron`" --remote-debugging-port=$Port ."
    ) `
    -WorkingDirectory $Root `
    -RedirectStandardOutput $StdOut `
    -RedirectStandardError $StdErr `
    -PassThru

  $Ready = $false

  for ($Attempt = 1; $Attempt -le 50; $Attempt += 1) {
    Start-Sleep -Milliseconds 400

    try {
      $Targets = Invoke-RestMethod `
        -Uri "http://127.0.0.1:$Port/json/list" `
        -TimeoutSec 2

      if ($Targets) {
        $Ready = $true
        break
      }
    } catch {}
  }

  if (-not $Ready) {
    throw "DevTools no respondió en el puerto $Port."
  }

  & node `
    $Probe `
    "--port=$Port" `
    "--seconds=$ObservationSeconds" `
    "--output=$RuntimeReport"

  $ProbeCode = [int]$LASTEXITCODE
  Write-Host "Código del inspector: $ProbeCode"
} finally {
  if ($AppProcess) {
    Stop-ProcessTree -ProcessId $AppProcess.Id
  }
}

Write-Host ""
Write-Host "=== Resultado ===" -ForegroundColor Cyan

if (-not (Test-Path $RuntimeReport)) {
  throw "No se generó el reporte de bloqueo."
}

$Report = Get-Content -Path $RuntimeReport -Raw | ConvertFrom-Json

Write-Host ("Fallo de evaluación: " + [string]$Report.evaluationFailure)
Write-Host ""
Write-Host "Últimos scripts analizados antes del bloqueo:" -ForegroundColor Yellow

$Scripts = @($Report.lastParsedScripts)

if (-not $Scripts.Count) {
  Write-Host "No se registraron scripts."
} else {
  $Scripts | Select-Object -Last 25 | ForEach-Object {
    Write-Host ("- " + $_)
  }
}

Write-Host ""
Write-Host "Diagnóstico terminado." -ForegroundColor Green
Write-Host "Comparta este archivo:"
Write-Host $RuntimeReport

exit 0

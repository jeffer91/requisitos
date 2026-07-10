# =========================================================
# Nombre completo: diagnostico-bdlocal.ps1
# Ruta o ubicación: /scripts/diagnostico-bdlocal.ps1
# Función o funciones:
# - Ejecutar npm test y el smoke test de Electron sin detenerse ante timeout.
# - Abrir la aplicación real con DevTools remoto.
# - Guardar el estado de BL2App, IndexedDB, conectores y consola.
# - Crear siempre un resumen, incluso si una etapa falla.
# - No ejecutar sincronizaciones externas.
# =========================================================
[CmdletBinding()]
param(
  [int]$Port = 9322,
  [int]$ObservationSeconds = 35
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {}

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Electron = Join-Path $Root "node_modules\.bin\electron.cmd"
$Probe = Join-Path $PSScriptRoot "diagnostico-runtime.js"
$Output = Join-Path $Root ("artifacts\diagnostico-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$Runtime = Join-Path $Output "05-runtime-report.json"
$Summary = Join-Path $Output "RESUMEN.txt"

function Write-Step {
  param([string]$Message)

  Write-Host ""
  Write-Host ("=== " + $Message + " ===") -ForegroundColor Cyan
}

function Stop-ProcessTree {
  param([int]$ProcessId)

  if ($ProcessId -le 0) {
    return
  }

  try {
    & taskkill.exe /PID $ProcessId /T /F 2>$null | Out-Null
  } catch {}
}

function Invoke-CapturedProcess {
  param(
    [Parameter(Mandatory = $true)][string]$CommandLine,
    [Parameter(Mandatory = $true)][string]$StdOutPath,
    [Parameter(Mandatory = $true)][string]$StdErrPath,
    [Parameter(Mandatory = $true)][int]$TimeoutSeconds
  )

  $result = [ordered]@{
    ExitCode = -1
    TimedOut = $false
    Started = $false
    Error = ""
  }

  try {
    $process = Start-Process `
      -FilePath "cmd.exe" `
      -ArgumentList @("/d", "/s", "/c", $CommandLine) `
      -WorkingDirectory $Root `
      -RedirectStandardOutput $StdOutPath `
      -RedirectStandardError $StdErrPath `
      -WindowStyle Hidden `
      -PassThru

    $result.Started = $true

    $completed = $process.WaitForExit($TimeoutSeconds * 1000)

    if (-not $completed) {
      $result.TimedOut = $true
      $result.ExitCode = 124
      Stop-ProcessTree -ProcessId $process.Id

      try {
        $process.WaitForExit(5000) | Out-Null
      } catch {}

      return [pscustomobject]$result
    }

    try {
      $process.WaitForExit()
      $process.Refresh()
      $result.ExitCode = [int]$process.ExitCode
    } catch {
      $result.ExitCode = -1
      $result.Error = $_.Exception.Message
    }
  } catch {
    $result.ExitCode = -1
    $result.Error = $_.Exception.Message

    try {
      $_ | Out-String | Set-Content -Path $StdErrPath -Encoding UTF8
    } catch {}
  }

  return [pscustomobject]$result
}

function Show-LogTail {
  param(
    [string]$Path,
    [int]$Lines = 20
  )

  if (Test-Path $Path) {
    Get-Content -Path $Path -Tail $Lines -ErrorAction SilentlyContinue
  }
}

function Safe-Text {
  param([scriptblock]$Action)

  try {
    return ((& $Action 2>&1 | Out-String).Trim())
  } catch {
    return "ERROR: " + $_.Exception.Message
  }
}

if (-not (Test-Path (Join-Path $Root "package.json"))) {
  throw "No se encontró package.json en $Root"
}

if (-not (Test-Path $Electron)) {
  throw "Falta Electron local. Ejecute npm install."
}

if (-not (Test-Path $Probe)) {
  throw "Falta scripts/diagnostico-runtime.js"
}

New-Item -ItemType Directory -Path $Output -Force | Out-Null

$Static = [pscustomobject]@{
  ExitCode = -1
  TimedOut = $false
  Started = $false
  Error = "No ejecutado"
}

$Smoke = [pscustomobject]@{
  ExitCode = -1
  TimedOut = $false
  Started = $false
  Error = "No ejecutado"
}

$ProbeExit = -1
$AppError = ""
$AppProcess = $null

Write-Step "Entorno"

$EnvironmentLines = @(
  "Fecha: $(Get-Date -Format o)",
  "Proyecto: $Root",
  "Node: $(Safe-Text { node --version })",
  "npm: $(Safe-Text { npm.cmd --version })",
  "Electron: $(Safe-Text { & $Electron --version })",
  "Rama: $(Safe-Text { git branch --show-current })",
  "Commit: $(Safe-Text { git rev-parse HEAD })",
  "Estado Git:",
  "$(Safe-Text { git status --short })",
  "SheetJS: $(Safe-Text { node -e "const x=require('xlsx');console.log(x.version+' | '+require.resolve('xlsx'))" })"
)

$EnvironmentLines |
  Set-Content -Path (Join-Path $Output "01-entorno.txt") -Encoding UTF8

$EnvironmentLines | ForEach-Object { Write-Host $_ }

Write-Step "npm test"

$StaticOut = Join-Path $Output "02-npm-test.stdout.log"
$StaticErr = Join-Path $Output "02-npm-test.stderr.log"

$Static = Invoke-CapturedProcess `
  -CommandLine "npm.cmd test" `
  -StdOutPath $StaticOut `
  -StdErrPath $StaticErr `
  -TimeoutSeconds 180

Write-Host ("Código: " + $Static.ExitCode)

if ($Static.TimedOut) {
  Write-Warning "npm test excedió 180 segundos, pero el diagnóstico continuará."
}

if ($Static.Error) {
  Write-Warning ("npm test: " + $Static.Error)
}

Show-LogTail -Path $StaticOut -Lines 15
Show-LogTail -Path $StaticErr -Lines 15

Write-Step "Smoke Electron"

$SmokeOut = Join-Path $Output "03-smoke.stdout.log"
$SmokeErr = Join-Path $Output "03-smoke.stderr.log"

$Smoke = Invoke-CapturedProcess `
  -CommandLine "npm.cmd run test:electron" `
  -StdOutPath $SmokeOut `
  -StdErrPath $SmokeErr `
  -TimeoutSeconds 90

Write-Host ("Código: " + $Smoke.ExitCode)

if ($Smoke.TimedOut) {
  Write-Warning "El smoke test excedió 90 segundos. Se cerró su proceso y el diagnóstico continuará."
}

if ($Smoke.Error) {
  Write-Warning ("Smoke Electron: " + $Smoke.Error)
}

Show-LogTail -Path $SmokeOut -Lines 25
Show-LogTail -Path $SmokeErr -Lines 25

$SmokeReport = Join-Path $Root "artifacts\bdlocal-electron-smoke.json"

if (Test-Path $SmokeReport) {
  Copy-Item `
    -Path $SmokeReport `
    -Destination (Join-Path $Output "03-bdlocal-electron-smoke.json") `
    -Force
} else {
  Write-Warning "El smoke test no generó bdlocal-electron-smoke.json."
}

Write-Step "Aplicación real"

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
    -RedirectStandardOutput (Join-Path $Output "04-app.stdout.log") `
    -RedirectStandardError (Join-Path $Output "04-app.stderr.log") `
    -PassThru

  $DevToolsReady = $false

  for ($Attempt = 1; $Attempt -le 50; $Attempt += 1) {
    if ($DevToolsReady) {
      break
    }

    Start-Sleep -Milliseconds 500

    try {
      $Targets = Invoke-RestMethod `
        -Uri "http://127.0.0.1:$Port/json/list" `
        -TimeoutSec 2

      if ($Targets) {
        $DevToolsReady = $true
      }
    } catch {}
  }

  if (-not $DevToolsReady) {
    throw "DevTools no respondió en el puerto $Port."
  }

  & node `
    $Probe `
    "--port=$Port" `
    "--seconds=$ObservationSeconds" `
    "--output=$Runtime"

  $ProbeExit = [int]$LASTEXITCODE
} catch {
  $AppError = $_.Exception.Message
  Write-Warning ("Diagnóstico de la aplicación real: " + $AppError)
} finally {
  if ($AppProcess) {
    Stop-ProcessTree -ProcessId $AppProcess.Id
  }
}

Write-Step "Resumen"

$Lines = [System.Collections.Generic.List[string]]::new()
$Lines.Add("Diagnóstico BDLocal")
$Lines.Add("Fecha: $(Get-Date -Format o)")
$Lines.Add("Carpeta: $Output")
$Lines.Add("")
$Lines.Add("npm test:")
$Lines.Add("  código: $($Static.ExitCode)")
$Lines.Add("  timeout: $($Static.TimedOut)")
$Lines.Add("  error: $($Static.Error)")
$Lines.Add("smoke:")
$Lines.Add("  código: $($Smoke.ExitCode)")
$Lines.Add("  timeout: $($Smoke.TimedOut)")
$Lines.Add("  error: $($Smoke.Error)")
$Lines.Add("runtime:")
$Lines.Add("  código: $ProbeExit")
$Lines.Add("  error: $AppError")

if (Test-Path $Runtime) {
  try {
    $RuntimeObject = Get-Content -Path $Runtime -Raw | ConvertFrom-Json
    $Last = $RuntimeObject.snapshots | Select-Object -Last 1

    if ($Last -and $Last.bl) {
      $State = $Last.bl.state
      $Meta = $Last.bl.dbMeta
      $Connectors = $Last.bl.connectors

      $Lines.Add("")
      $Lines.Add("Estado final observado:")
      $Lines.Add("  Indicador: $($Last.bl.dbPill)")
      $Lines.Add("  Vista: $($Last.bl.viewStatus)")
      $Lines.Add("  ready: $($State.ready)")
      $Lines.Add("  booting: $($State.booting)")
      $Lines.Add("  scriptsReady: $($State.scriptsReady)")
      $Lines.Add("  lastError: $($State.lastError)")
      $Lines.Add("  IndexedDB abierta: $($Meta.open)")
      $Lines.Add("  Versión: $($Meta.version)")
      $Lines.Add(
        "  Tablas faltantes: " +
        [string]::Join(", ", @($Meta.missingStores))
      )
      $Lines.Add("  Conectores ready: $($Connectors.ready)")
      $Lines.Add(
        "  Errores conectores: " +
        [string]::Join(" | ", @($Connectors.errors))
      )
      $Lines.Add("")
      $Lines.Add("Últimos registros:")

      @($Last.bl.logs) | ForEach-Object {
        $Lines.Add("- $_")
      }
    } elseif ($Last) {
      $Lines.Add("")
      $Lines.Add(
        "No se obtuvo el estado interno de BL: " +
        "$($Last.error) $($Last.action)"
      )
    }
  } catch {
    $Lines.Add("")
    $Lines.Add(
      "No se pudo interpretar runtime: " +
      $_.Exception.Message
    )
  }
} else {
  $Lines.Add("")
  $Lines.Add("No se generó 05-runtime-report.json")
}

$Lines | Set-Content -Path $Summary -Encoding UTF8
Get-Content -Path $Summary

Write-Host ""
Write-Host "Diagnóstico terminado." -ForegroundColor Green
Write-Host "Comparta estos archivos:"
Write-Host $Summary
Write-Host $Runtime

exit 0

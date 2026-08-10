# =========================================================
# Nombre completo: diagnostico-firebase.ps1
# Ruta: /scripts/diagnostico-firebase.ps1
# Función:
# - Abrir la aplicación Electron real con DevTools remoto.
# - Leer BDLocal/IndexedDB sin modificar datos ni sincronizar.
# - Ejecutar el diagnóstico dirigido de contactos y cola Firebase.
# - Mostrar un resumen corto directamente en PowerShell.
# =========================================================
[CmdletBinding()]
param(
  [string]$Cedula = "0102596566",
  [int]$Port = 9333
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {}

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Electron = Join-Path $Root "node_modules\.bin\electron.cmd"
$Probe = Join-Path $PSScriptRoot "diagnostico-firebase-runtime.js"
$Artifacts = Join-Path $Root "artifacts"
$Output = Join-Path $Artifacts "diagnostico-firebase.json"
$AppStdout = Join-Path $Artifacts "diagnostico-firebase-app.stdout.log"
$AppStderr = Join-Path $Artifacts "diagnostico-firebase-app.stderr.log"
$AppProcess = $null

function Stop-ProcessTree {
  param([int]$ProcessId)
  if ($ProcessId -le 0) { return }
  try { & taskkill.exe /PID $ProcessId /T /F 2>$null | Out-Null } catch {}
}

function Value-OrEmpty {
  param($Value)
  if ($null -eq $Value) { return "" }
  return [string]$Value
}

if (-not (Test-Path $Electron)) {
  throw "Falta Electron local. Ejecute npm install."
}

if (-not (Test-Path $Probe)) {
  throw "Falta scripts/diagnostico-firebase-runtime.js"
}

New-Item -ItemType Directory -Path $Artifacts -Force | Out-Null

Write-Host ""
Write-Host "=== DIAGNÓSTICO FIREBASE / BDLOCAL ===" -ForegroundColor Cyan
Write-Host ("Cédula: " + $Cedula)
Write-Host "Solo lectura: no se enviarán cambios a Firebase." -ForegroundColor DarkGray
Write-Host ""

try {
  # Evitar dos instancias del mismo proyecto usando el mismo perfil de IndexedDB.
  try {
    Get-CimInstance Win32_Process -Filter "Name='electron.exe'" |
      Where-Object {
        $_.CommandLine -and
        $_.CommandLine.IndexOf($Root,[System.StringComparison]::OrdinalIgnoreCase) -ge 0
      } |
      ForEach-Object { Stop-ProcessTree -ProcessId ([int]$_.ProcessId) }
  } catch {}

  $AppProcess = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList @(
      "/d",
      "/s",
      "/c",
      "`"$Electron`" --remote-debugging-port=$Port ."
    ) `
    -WorkingDirectory $Root `
    -RedirectStandardOutput $AppStdout `
    -RedirectStandardError $AppStderr `
    -PassThru

  $Ready = $false
  for ($Attempt = 1; $Attempt -le 60; $Attempt += 1) {
    Start-Sleep -Milliseconds 400
    try {
      $Targets = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/list" -TimeoutSec 2
      if ($Targets) { $Ready = $true; break }
    } catch {}
  }

  if (-not $Ready) {
    throw "DevTools no respondió en el puerto $Port."
  }

  & node $Probe "--port=$Port" "--cedula=$Cedula" "--output=$Output"
  $ProbeExit = [int]$LASTEXITCODE

  if ($ProbeExit -ne 0 -or -not (Test-Path $Output)) {
    throw "El diagnóstico runtime no pudo completarse. Revise $AppStderr"
  }

  $Report = Get-Content -Path $Output -Raw | ConvertFrom-Json
  $R = $Report.result

  if (-not $R -or -not $R.ok) {
    throw ("Diagnóstico incompleto: " + (Value-OrEmpty $R.message))
  }

  Write-Host ("Período detectado: " + (Value-OrEmpty $R.periodoId)) -ForegroundColor White
  Write-Host ""

  Write-Host "PERSONA" -ForegroundColor Yellow
  Write-Host ("  correoPersonal:      " + (Value-OrEmpty $R.personaContact.correoPersonal))
  Write-Host ("  correoInstitucional: " + (Value-OrEmpty $R.personaContact.correoInstitucional))
  Write-Host ("  celular:             " + (Value-OrEmpty $R.personaContact.celular))

  Write-Host ""
  Write-Host "CONTACTOS (repositorio oficial)" -ForegroundColor Yellow
  Write-Host ("  registros:           " + @($R.contactos).Count)
  Write-Host ("  correoPersonal:      " + (Value-OrEmpty $R.contactoNormalizado.correoPersonal))
  Write-Host ("  correoInstitucional: " + (Value-OrEmpty $R.contactoNormalizado.correoInstitucional))
  Write-Host ("  celular:             " + (Value-OrEmpty $R.contactoNormalizado.celular))

  Write-Host ""
  Write-Host "TABLAS CRUDAS" -ForegroundColor Yellow
  Write-Host ("  contactos legacy:    " + @($R.raw.contactos).Count)
  Write-Host ("  contactos V2:        " + @($R.raw.contactosEstudiante).Count)
  Write-Host ("  persona encontrada:  " + [bool]($null -ne $R.persona))
  Write-Host ("  matrícula encontrada:" + [bool]($null -ne $R.matricula))
  Write-Host ("  requisitos:          " + $R.requisitosEncontrados)

  Write-Host ""
  Write-Host "COLA FIREBASE" -ForegroundColor Yellow
  Write-Host ("  total:               " + $R.cola.total)
  if ($R.cola.tipos) {
    $R.cola.tipos.PSObject.Properties | Sort-Object Name | ForEach-Object {
      Write-Host ("  " + $_.Name + ": " + $_.Value)
    }
  }

  Write-Host ""
  Write-Host "DIAGNÓSTICO" -ForegroundColor Cyan
  switch ([string]$R.diagnostico) {
    "CONTACTO_OK_EN_REPOSITORIO" {
      Write-Host "  Los contactos sí existen en BDLocal. El fallo está después del repositorio, durante reconstrucción/mapeo de Firebase." -ForegroundColor Green
    }
    "CONTACTO_EN_LEGACY_PERO_NO_EN_REPOSITORIO" {
      Write-Host "  Los contactos existen en la tabla legacy, pero el repositorio oficial no los está recuperando." -ForegroundColor Red
    }
    "CONTACTO_EN_V2_PERO_NO_EN_REPOSITORIO" {
      Write-Host "  Los contactos existen en contactos_estudiante, pero el repositorio oficial no los está recuperando." -ForegroundColor Red
    }
    "CONTACTO_SOLO_EN_PERSONA" {
      Write-Host "  Los contactos existen solo en persona; la consolidación con contactos_estudiante está incompleta." -ForegroundColor Red
    }
    "CONTACTO_NO_EXISTE_EN_BDLOCAL" {
      Write-Host "  Los correos y celular ya están vacíos dentro de BDLocal. El fallo ocurre durante la carga/guardado local, antes de Firebase." -ForegroundColor Red
    }
    default {
      Write-Host ("  " + $R.diagnostico) -ForegroundColor Yellow
    }
  }

  Write-Host ""
  Write-Host ("Reporte completo: " + $Output) -ForegroundColor DarkGray
} finally {
  if ($AppProcess) {
    Stop-ProcessTree -ProcessId $AppProcess.Id
  }
}

exit 0

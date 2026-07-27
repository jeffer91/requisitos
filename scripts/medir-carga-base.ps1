# =========================================================
# Nombre completo: medir-carga-base.ps1
# Ruta: /scripts/medir-carga-base.ps1
# Función:
# - Abrir Requisitos desde una consola PowerShell independiente.
# - Medir desde el inicio del proceso hasta que Base Local y ConCarga estén listos.
# - Repetir la prueba y calcular mínimo, promedio y máximo.
# - Guardar reportes JSON, logs y un resumen CSV.
# - No ejecutar sincronizaciones externas ni cerrar sesiones ajenas sin aviso.
# =========================================================
[CmdletBinding()]
param(
  [ValidateRange(1, 20)][int]$Repeticiones = 1,
  [ValidateRange(5, 120)][int]$TimeoutSeconds = 30,
  [ValidateRange(1025, 65500)][int]$Port = 9331,
  [switch]$MantenerAbierta
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {}

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Electron = Join-Path $Root "node_modules\.bin\electron.cmd"
$Probe = Join-Path $PSScriptRoot "medir-carga-base-runtime.js"
$Output = Join-Path $Root ("artifacts\tiempo-carga-base-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$SummaryCsv = Join-Path $Output "resumen.csv"
$SummaryTxt = Join-Path $Output "RESUMEN.txt"
$NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue

function Get-RequisitosElectron {
  try {
    return @(
      Get-CimInstance Win32_Process -Filter "Name='electron.exe'" |
        Where-Object {
          $_.CommandLine -and
          $_.CommandLine.IndexOf($Root, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
        }
    )
  } catch {
    return @()
  }
}

function Stop-ProcessTree {
  param([int]$ProcessId)
  if ($ProcessId -le 0) { return }
  try { & taskkill.exe /PID $ProcessId /T /F 2>$null | Out-Null } catch {}
}

function Format-Milliseconds {
  param($Value)
  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return "—" }
  return ("{0:N0} ms" -f [double]$Value)
}

function Write-Milestone {
  param(
    [string]$Label,
    $Value
  )
  $formatted = Format-Milliseconds $Value
  Write-Host ("  {0,-28} {1,12}" -f $Label, $formatted)
}

if (-not (Test-Path $Electron)) {
  throw "No se encontró Electron local. Ejecute npm install en $Root"
}
if (-not (Test-Path $Probe)) {
  throw "No se encontró scripts/medir-carga-base-runtime.js"
}
if (-not $NodeCommand) {
  throw "No se encontró node.exe en el PATH."
}

$Existing = Get-RequisitosElectron
if ($Existing.Count -gt 0) {
  throw "Requisitos ya está abierto. Ciérrelo completamente antes de iniciar la medición para obtener un arranque limpio."
}

New-Item -ItemType Directory -Path $Output -Force | Out-Null
$Rows = [System.Collections.Generic.List[object]]::new()
$OpenProcess = $null

Write-Host ""
Write-Host "PRUEBA DE TIEMPO: REQUISITOS → CARGA → BASE LOCAL" -ForegroundColor Cyan
Write-Host "Proyecto: $Root"
Write-Host "Repeticiones: $Repeticiones"
Write-Host "Límite por prueba: $TimeoutSeconds segundos"
Write-Host "No se ejecutarán sincronizaciones externas." -ForegroundColor DarkGray

for ($Run = 1; $Run -le $Repeticiones; $Run += 1) {
  Write-Host ""
  Write-Host ("=== PRUEBA {0} DE {1} ===" -f $Run, $Repeticiones) -ForegroundColor Cyan

  if ((Get-RequisitosElectron).Count -gt 0) {
    throw "Existe una instancia anterior de Requisitos. Cierre la aplicación y vuelva a ejecutar la prueba."
  }

  Start-Sleep -Milliseconds 350

  $CurrentPort = $Port + $Run - 1
  $StartedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $JsonPath = Join-Path $Output ("prueba-{0:00}.json" -f $Run)
  $AppOut = Join-Path $Output ("prueba-{0:00}-app.stdout.log" -f $Run)
  $AppErr = Join-Path $Output ("prueba-{0:00}-app.stderr.log" -f $Run)
  $ProbeOut = Join-Path $Output ("prueba-{0:00}-sonda.stdout.log" -f $Run)
  $ProbeErr = Join-Path $Output ("prueba-{0:00}-sonda.stderr.log" -f $Run)
  $AppProcess = $null
  $ProbeExit = -1

  try {
    $AppProcess = Start-Process `
      -FilePath "cmd.exe" `
      -ArgumentList @(
        "/d",
        "/s",
        "/c",
        "`"$Electron`" --remote-debugging-port=$CurrentPort ."
      ) `
      -WorkingDirectory $Root `
      -RedirectStandardOutput $AppOut `
      -RedirectStandardError $AppErr `
      -PassThru

    $ProbeProcess = Start-Process `
      -FilePath $NodeCommand.Source `
      -ArgumentList @(
        "`"$Probe`"",
        "--port=$CurrentPort",
        "--timeoutMs=$($TimeoutSeconds * 1000)",
        "--pollMs=40",
        "--startedAt=$StartedAt",
        "--output=`"$JsonPath`""
      ) `
      -WorkingDirectory $Root `
      -RedirectStandardOutput $ProbeOut `
      -RedirectStandardError $ProbeErr `
      -NoNewWindow `
      -Wait `
      -PassThru

    $ProbeExit = [int]$ProbeProcess.ExitCode
  } catch {
    Write-Host ("No se pudo ejecutar la sonda: " + $_.Exception.Message) -ForegroundColor Red
  }

  $Report = $null
  if (Test-Path $JsonPath) {
    try { $Report = Get-Content -Path $JsonPath -Raw | ConvertFrom-Json } catch {}
  }

  if ($Report) {
    $M = $Report.milestones
    Write-Milestone "Renderer disponible" $M.rendererAvailable
    Write-Milestone "Pantalla Carga creada" $M.cargaFrameCreated
    Write-Milestone "DOM de Carga listo" $M.cargaDomReady
    Write-Milestone "Scripts de Base Local" $M.baseScriptsReady
    Write-Milestone "IndexedDB abierta" $M.indexedDBOpen
    Write-Milestone "Base Local confirmada" $M.baseLocalReady
    Write-Milestone "ConCarga listo" $M.conCargaReady
    Write-Milestone "Períodos leídos" $M.periodsReady
    Write-Milestone "TOTAL" $M.complete

    $Counts = $null
    try { $Counts = $Report.final.carga.counts } catch {}
    if ($Counts) {
      Write-Host ("  Datos observados: {0} períodos · {1} estudiantes · {2} requisitos" -f $Counts.periods, $Counts.students, $Counts.requirements) -ForegroundColor DarkGray
    }

    $ResultLabel = if ($Report.ok) { "OK" } else { "ERROR" }
    $Rows.Add([pscustomobject]@{
      Prueba = $Run
      Resultado = $ResultLabel
      RendererMs = $M.rendererAvailable
      CargaFrameMs = $M.cargaFrameCreated
      DomMs = $M.cargaDomReady
      ScriptsBaseMs = $M.baseScriptsReady
      IndexedDBMs = $M.indexedDBOpen
      BaseLocalMs = $M.baseLocalReady
      ConCargaMs = $M.conCargaReady
      PeriodosMs = $M.periodsReady
      TotalMs = $M.complete
      Error = [string]$Report.error
    })

    if ($Report.ok) {
      $total = [double]$M.complete
      if ($total -lt 1000) { Write-Host "Resultado: MUY RÁPIDO" -ForegroundColor Green }
      elseif ($total -lt 2000) { Write-Host "Resultado: RÁPIDO" -ForegroundColor Green }
      elseif ($total -lt 4000) { Write-Host "Resultado: ACEPTABLE" -ForegroundColor Yellow }
      else { Write-Host "Resultado: LENTO; conviene revisar el siguiente cuello de botella." -ForegroundColor Red }
    } else {
      Write-Host ("Resultado: ERROR — " + [string]$Report.error) -ForegroundColor Red
    }
  } else {
    $Rows.Add([pscustomobject]@{
      Prueba = $Run
      Resultado = "ERROR"
      RendererMs = $null
      CargaFrameMs = $null
      DomMs = $null
      ScriptsBaseMs = $null
      IndexedDBMs = $null
      BaseLocalMs = $null
      ConCargaMs = $null
      PeriodosMs = $null
      TotalMs = $null
      Error = "La sonda no generó el reporte JSON. Código: $ProbeExit"
    })
    Write-Host ("La sonda no generó el reporte JSON. Código: " + $ProbeExit) -ForegroundColor Red
  }

  $KeepThisRun = $MantenerAbierta -and ($Run -eq $Repeticiones)
  if ($KeepThisRun -and $AppProcess) {
    $OpenProcess = $AppProcess
    Write-Host "La aplicación permanecerá abierta para revisión." -ForegroundColor DarkGray
  } elseif ($AppProcess) {
    Stop-ProcessTree -ProcessId $AppProcess.Id
  }

  if ($Run -lt $Repeticiones) { Start-Sleep -Seconds 1 }
}

$Rows | Export-Csv -Path $SummaryCsv -NoTypeInformation -Encoding UTF8
$Successful = @($Rows | Where-Object { $_.Resultado -eq "OK" -and $null -ne $_.TotalMs })
$Lines = [System.Collections.Generic.List[string]]::new()
$Lines.Add("Prueba de tiempo: Requisitos → Carga → Base Local")
$Lines.Add("Fecha: $(Get-Date -Format o)")
$Lines.Add("Carpeta: $Output")
$Lines.Add("Repeticiones: $Repeticiones")
$Lines.Add("")

if ($Successful.Count -gt 0) {
  $Totals = @($Successful | ForEach-Object { [double]$_.TotalMs })
  $Minimum = ($Totals | Measure-Object -Minimum).Minimum
  $Maximum = ($Totals | Measure-Object -Maximum).Maximum
  $Average = ($Totals | Measure-Object -Average).Average

  Write-Host ""
  Write-Host "=== RESUMEN ===" -ForegroundColor Cyan
  Write-Host ("  Mínimo:   {0:N0} ms" -f $Minimum)
  Write-Host ("  Promedio: {0:N0} ms" -f $Average)
  Write-Host ("  Máximo:   {0:N0} ms" -f $Maximum)

  $Lines.Add(("Mínimo: {0:N0} ms" -f $Minimum))
  $Lines.Add(("Promedio: {0:N0} ms" -f $Average))
  $Lines.Add(("Máximo: {0:N0} ms" -f $Maximum))
} else {
  Write-Host ""
  Write-Host "Ninguna ejecución terminó correctamente." -ForegroundColor Red
  $Lines.Add("Ninguna ejecución terminó correctamente.")
}

$Lines.Add("")
$Lines.Add("Detalle: $SummaryCsv")
$Lines | Set-Content -Path $SummaryTxt -Encoding UTF8

Write-Host ""
Write-Host ("Reportes guardados en: " + $Output) -ForegroundColor Cyan
if ($OpenProcess) {
  Write-Host ("Proceso abierto: " + $OpenProcess.Id) -ForegroundColor DarkGray
}

<# =========================================================
Archivo: bdl-smoke-test.ps1
Ruta: /tools/bdl-smoke-test.ps1
Función:
- Prueba local rápida después de git pull.
- Verifica archivos críticos de BDLocal, DefArt, migración y sincronización.
- Revisa conexiones básicas por texto sin modificar datos.
Uso:
  powershell -ExecutionPolicy Bypass -File .\tools\bdl-smoke-test.ps1
========================================================= #>

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$checks = New-Object System.Collections.Generic.List[object]

function Add-Check($Name, $Ok, $Detail){
  $checks.Add([pscustomobject]@{ Name=$Name; Ok=[bool]$Ok; Detail=$Detail }) | Out-Null
}

function Test-FileExists($Path){
  $ok = Test-Path $Path
  Add-Check "Existe: $Path" $ok ($(if($ok){"OK"}else{"No encontrado"}))
}

function Test-Contains($Path, $Pattern, $Label){
  if(!(Test-Path $Path)){
    Add-Check $Label $false "Archivo no encontrado: $Path"
    return
  }
  $content = Get-Content $Path -Raw -Encoding UTF8
  $ok = $content -match [regex]::Escape($Pattern)
  Add-Check $Label $ok ($(if($ok){"Encontrado"}else{"No aparece: $Pattern"}))
}

Write-Host "`n=== BDLocal Smoke Test ===" -ForegroundColor Cyan
Write-Host "Ruta: $root`n"

$criticalFiles = @(
  "BDLocal/bl2.config.v2.js",
  "BDLocal/bl2.db.js",
  "BDLocal/diagnostics/bdl.diagnostics.general.js",
  "BDLocal/diagnostics/bdl.diagnostics.ui-bridge.js",
  "BDLocal/repositories/bdl.repo.personas.js",
  "BDLocal/repositories/bdl.repo.matriculas.js",
  "BDLocal/repositories/bdl.repo.requisitos.js",
  "BDLocal/repositories/bdl.repo.notas.js",
  "BDLocal/repositories/bdl.repo.cambios.js",
  "BDLocal/services/bdl.service.estudiantes.js",
  "BDLocal/services/bdl.service.defensas.js",
  "BDLocal/sync/bdl.sync.outbox.js",
  "BDLocal/sync/bdl.sync.orchestrator.js",
  "BDLocal/sync/bdl.sync.index.js",
  "BDLocal/sync/targets/bdl.sync.targets.index.js",
  "BDLocal/sync/targets/bdl.sync.target.firebase.js",
  "defart/defart.service-bridge.js",
  "defart/defart.save-service-bridge.js",
  "defart/defart.performance.js",
  "defart/defart.html"
)

foreach($file in $criticalFiles){ Test-FileExists $file }

Test-Contains "BDLocal/bl2.config.v2.js" "matriculas_periodo" "DB_VERSION 2 incluye matriculas_periodo"
Test-Contains "BDLocal/bl2.config.v2.js" "notas_titulacion" "DB_VERSION 2 incluye notas_titulacion"
Test-Contains "BDLocal/bl2.config.v2.js" "cambios_pendientes" "DB_VERSION 2 incluye cambios_pendientes"

Test-Contains "BDLocal/services/bdl.service.estudiantes.js" "safeQueryByIndex" "Estudiantes consulta por índice cuando existe"
Test-Contains "BDLocal/services/bdl.service.defensas.js" "getPage" "Defensas expone getPage"
Test-Contains "defart/defart.service-bridge.js" "BDLServiceDefensas.getPage" "DefArt conectado a servicio de páginas"
Test-Contains "defart/defart.save-service-bridge.js" "notas_titulacion" "DefArt guarda en notas_titulacion"
Test-Contains "defart/defart.save-service-bridge.js" "cambios_pendientes" "DefArt crea cambios_pendientes"

Test-Contains "BDLocal/sync/targets/bdl.sync.targets.index.js" "register(`"google`"" "Target Google registrado"
Test-Contains "BDLocal/sync/targets/bdl.sync.targets.index.js" "register(`"supabase`"" "Target Supabase registrado"
Test-Contains "BDLocal/sync/targets/bdl.sync.target.firebase.js" "register(`"firebase`"" "Target Firebase registrado"
Test-Contains "BDLocal/sync/bdl.sync.index.js" "bdl.sync.target.firebase.js" "Sync index autocarga Firebase target"
Test-Contains "BDLocal/diagnostics/bdl.diagnostics.general.js" "queueSummary" "Diagnóstico incluye queueSummary"

Test-Contains "defart/defart.html" "defart.service-bridge.js" "DefArt carga service bridge"
Test-Contains "defart/defart.html" "defart.save-service-bridge.js" "DefArt carga save bridge"
Test-Contains "defart/defart.html" "bdl.service.defensas.js" "DefArt carga servicio defensas"

$okCount = ($checks | Where-Object { $_.Ok }).Count
$failCount = ($checks | Where-Object { -not $_.Ok }).Count
$total = $checks.Count

Write-Host "`nResultado:" -ForegroundColor Cyan
foreach($c in $checks){
  if($c.Ok){ Write-Host "[OK]   $($c.Name) - $($c.Detail)" -ForegroundColor Green }
  else { Write-Host "[FALTA] $($c.Name) - $($c.Detail)" -ForegroundColor Red }
}

Write-Host "`nResumen: $okCount / $total OK" -ForegroundColor Cyan

if($failCount -gt 0){
  Write-Host "Hay $failCount problema(s). Copia esta salida y envíala en el chat." -ForegroundColor Yellow
  exit 1
}

Write-Host "Smoke test aprobado. Ahora abre BL2 y ejecuta Diagnóstico general BDLocal." -ForegroundColor Green
exit 0

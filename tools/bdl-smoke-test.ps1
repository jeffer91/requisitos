<# =========================================================
Nombre completo: bdl-smoke-test.ps1
Ruta o ubicación: /tools/bdl-smoke-test.ps1
Función o funciones:
- Ejecutar una revisión local final después de git pull.
- Verificar archivos críticos, archivos vacíos y referencias esenciales.
- Revisar política manual, puerta única, lotes y IDs estables.
- Ejecutar node --check sobre los JavaScript de BDLocal y configuración.
- No abrir la base, no modificar IndexedDB y no conectarse a internet.
Uso:
  powershell -ExecutionPolicy Bypass -File .\tools\bdl-smoke-test.ps1
========================================================= #>

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$checks = New-Object System.Collections.Generic.List[object]

function Add-Check($Name, $Ok, $Detail){
  $checks.Add([pscustomobject]@{
    Name = $Name
    Ok = [bool]$Ok
    Detail = [string]$Detail
  }) | Out-Null
}

function Test-FileExists($Path){
  $ok = Test-Path -LiteralPath $Path -PathType Leaf
  Add-Check "Existe: $Path" $ok ($(if($ok){"OK"}else{"No encontrado"}))
}

function Test-FileNotEmpty($Path){
  if(!(Test-Path -LiteralPath $Path -PathType Leaf)){
    Add-Check "No vacío: $Path" $false "Archivo no encontrado"
    return
  }
  $item = Get-Item -LiteralPath $Path
  Add-Check "No vacío: $Path" ($item.Length -gt 0) "Tamaño: $($item.Length) bytes"
}

function Test-Contains($Path, $Pattern, $Label){
  if(!(Test-Path -LiteralPath $Path -PathType Leaf)){
    Add-Check $Label $false "Archivo no encontrado: $Path"
    return
  }
  $content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  $ok = $content -match [regex]::Escape($Pattern)
  Add-Check $Label $ok ($(if($ok){"Encontrado"}else{"No aparece: $Pattern"}))
}

function Test-NotContains($Path, $Pattern, $Label){
  if(!(Test-Path -LiteralPath $Path -PathType Leaf)){
    Add-Check $Label $false "Archivo no encontrado: $Path"
    return
  }
  $content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  $ok = $content -notmatch [regex]::Escape($Pattern)
  Add-Check $Label $ok ($(if($ok){"No encontrado, correcto"}else{"Aparece una referencia no permitida: $Pattern"}))
}

function Test-NodeSyntax($Path, $NodeCommand){
  $output = & $NodeCommand --check $Path 2>&1
  $ok = $LASTEXITCODE -eq 0
  Add-Check "Sintaxis JS: $Path" $ok ($(if($ok){"OK"}else{($output | Out-String).Trim()}))
}

Write-Host "`n=== Revisión final BDLocal ===" -ForegroundColor Cyan
Write-Host "Ruta: $root" -ForegroundColor DarkGray
Write-Host "La prueba no modifica IndexedDB ni usa conexiones externas.`n" -ForegroundColor DarkGray

$criticalFiles = @(
  "BDLocal/bl2.html",
  "BDLocal/bl2.config.js",
  "BDLocal/bl2.config.v2.js",
  "BDLocal/bl2.db.js",
  "BDLocal/bl2.core.js",
  "BDLocal/bl2.app.js",
  "BDLocal/bl2.test.js",
  "BDLocal/bl2.backup.v2.js",
  "BDLocal/bl2.cloud-pull.js",
  "BDLocal/bl2.cloud-pull.safe.js",
  "BDLocal/bl2.google-push.guard.js",
  "BDLocal/repositories/bdl.repo.index.js",
  "BDLocal/repositories/bdl.repo.cambios.js",
  "BDLocal/services/bdl.service.index.js",
  "BDLocal/sync/bdl.sync.outbox.js",
  "BDLocal/sync/bdl.sync.orchestrator.js",
  "BDLocal/sync/bdl.sync.index.js",
  "BDLocal/sync/bdl.sync.ui-bridge.js",
  "BDLocal/sync/targets/bdl.sync.targets.index.js",
  "BDLocal/sync/targets/bdl.sync.target.firebase.js",
  "BDLocal/diagnostics/bdl.diagnostics.index.js",
  "BDLocal/diagnostics/bdl.diagnostics.general.js",
  "BDLocal/diagnostics/bdl.diagnostics.ui-bridge.js",
  "js/bdlocal-config/bdlocal-config.store.js",
  "js/bdlocal-config/bdlocal-config.ui.js",
  "js/bdlocal-config/bdlocal-sync.manager.js",
  "js/bdlocal-config/bdlocal-sync-fixups.js"
)

foreach($file in $criticalFiles){
  Test-FileExists $file
  Test-FileNotEmpty $file
}

Test-Contains "BDLocal/bl2.config.js" 'manualOnly:true' "Política general exclusivamente manual"
Test-Contains "BDLocal/bl2.config.js" 'syncOnIdle:false' "Sin sincronización por inactividad"
Test-Contains "BDLocal/bl2.config.js" 'syncOnClose:false' "Sin sincronización al cerrar"
Test-Contains "BDLocal/bl2.config.js" 'maxBatchSize:25' "Lote general máximo 25"
Test-Contains "BDLocal/bl2.config.js" 'documentIdStrategy:"periodoId__cedula"' "Firebase usa período y cédula"
Test-Contains "BDLocal/bl2.config.v2.js" 'requiredStores().length === 22' "Configuración exige 22 tablas físicas"

Test-Contains "BDLocal/sync/bdl.sync.index.js" 'manualOnly:true' "BDLSyncV2 declara modo manual"
Test-Contains "BDLocal/sync/bdl.sync.index.js" 'loadExtraTargets' "BDLSyncV2 prepara destino Firebase"
Test-Contains "BDLocal/sync/bdl.sync.outbox.js" 'MAX_BATCH_LIMIT = 25' "Outbox limita a 25"
Test-Contains "BDLocal/sync/bdl.sync.outbox.js" 'DEFAULT_MAX_ATTEMPTS = 3' "Outbox bloquea después de intentos"
Test-Contains "BDLocal/sync/targets/bdl.sync.target.firebase.js" 'documentId(periodoId,cedula)' "Target Firebase usa ID estable"
Test-Contains "BDLocal/sync/targets/bdl.sync.target.firebase.js" 'batch.set(collection.doc(item.documentId),item.document,{ merge:true })' "Firebase actualiza sin insertar duplicados"

Test-Contains "js/bdlocal-config/bdlocal-sync-fixups.js" 'BDLSyncV2.request' "Rutas legacy delegan a BDLSyncV2"
Test-Contains "BDLocal/bl2.google-push.guard.js" 'singleGate:true' "Guardia externa conserva una sola puerta"
Test-Contains "BDLocal/bl2.google-push.guard.js" 'No se reemplazan pushLocalToSheets' "Guardia no reemplaza la salida oficial"
Test-NotContains "BDLocal/bl2.google-push.guard.js" 'setInterval(' "Guardia externa sin intervalos"
Test-NotContains "BDLocal/bl2.google-push.guard.js" 'BDLSyncOrchestrator.syncTarget' "Guardia no salta BDLSyncV2"

Test-Contains "BDLocal/bl2.cloud-pull.safe.js" 'TECHNICAL_TABLES' "Sheets filtra tablas técnicas"
Test-Contains "BDLocal/bl2.cloud-pull.safe.js" 'markRetired:false' "Sheets no marca retirados"
Test-Contains "BDLocal/bl2.cloud-pull.safe.js" 'return (cedula || "sin_cedula") + "__" + periodoId + "__" + kind;' "Contacto cambia valor sin crear nuevo ID"
Test-Contains "BDLocal/bl2.cloud-pull.safe.js" 'createSafetyBackup' "Sheets crea respaldo antes de aplicar"
Test-Contains "BDLocal/bl2.test.js" 'network:false' "Certificación interna no usa internet"
Test-Contains "BDLocal/bl2.test.js" 'Cambiar el valor de un contacto crea una identidad nueva.' "Certificación revisa duplicados de contactos"

Test-NotContains "BDLocal/bl2.html" 'bdlocal-modal.js' "BL2 no carga modal antiguo"
Test-NotContains "BDLocal/bl2.html" 'bdl.migration.legacy-v2.ui.js' "BL2 no carga migración visual duplicada"
Test-Contains "BDLocal/bl2.html" 'bdlocal:bl2-html-scripts-loaded' "BL2 declara fin de carga ordenada"

$node = Get-Command node -ErrorAction SilentlyContinue
if($node){
  $javascriptFiles = @()
  $javascriptFiles += Get-ChildItem -LiteralPath "BDLocal" -Recurse -File -Filter "*.js"
  if(Test-Path -LiteralPath "js/bdlocal-config"){
    $javascriptFiles += Get-ChildItem -LiteralPath "js/bdlocal-config" -Recurse -File -Filter "*.js"
  }

  foreach($file in ($javascriptFiles | Sort-Object FullName -Unique)){
    Test-NodeSyntax $file.FullName $node.Source
  }
}else{
  Add-Check "Sintaxis JavaScript con Node" $false "Node.js no está instalado o no está en PATH. Instálelo para ejecutar node --check."
}

$emptyFiles = Get-ChildItem -LiteralPath "BDLocal" -Recurse -File | Where-Object { $_.Length -eq 0 }
Add-Check "Sin archivos vacíos en BDLocal" ($emptyFiles.Count -eq 0) ($(if($emptyFiles.Count -eq 0){"OK"}else{($emptyFiles.FullName -join "; ")}))

$okCount = ($checks | Where-Object { $_.Ok }).Count
$failures = @($checks | Where-Object { -not $_.Ok })
$total = $checks.Count

Write-Host "`nResultado:" -ForegroundColor Cyan
foreach($check in $checks){
  if($check.Ok){
    Write-Host "[OK]    $($check.Name) - $($check.Detail)" -ForegroundColor Green
  }else{
    Write-Host "[FALTA] $($check.Name) - $($check.Detail)" -ForegroundColor Red
  }
}

Write-Host "`nResumen: $okCount / $total controles correctos" -ForegroundColor Cyan

if($failures.Count -gt 0){
  Write-Host "Hay $($failures.Count) problema(s). No pruebes una subida real hasta corregirlos." -ForegroundColor Yellow
  exit 1
}

Write-Host "Revisión estática aprobada. Abre Base Local y ejecuta Diagnóstico y salud antes de la prueba controlada." -ForegroundColor Green
exit 0

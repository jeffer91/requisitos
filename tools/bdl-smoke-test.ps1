<# =========================================================
Nombre completo: bdl-smoke-test.ps1
Ruta o ubicación: /tools/bdl-smoke-test.ps1
Función o funciones:
- Ejecutar la certificación estática final desde PowerShell.
- Verificar que Node.js y el script multiplataforma estén disponibles.
- Ejecutar exactamente los mismos controles usados por GitHub Actions.
- No abrir Electron, IndexedDB ni conexiones externas.
Uso:
  powershell -ExecutionPolicy Bypass -File .\tools\bdl-smoke-test.ps1
========================================================= #>

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Write-Host "`n=== Certificación final BDLocal ===" -ForegroundColor Cyan
Write-Host "Ruta: $root" -ForegroundColor DarkGray
Write-Host "No abre Electron, IndexedDB, Firebase ni Google Sheets.`n" -ForegroundColor DarkGray

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "[FALLO] Node.js no está instalado o no está disponible en PATH." -ForegroundColor Red
  Write-Host "Instale Node.js y vuelva a ejecutar esta prueba." -ForegroundColor Yellow
  exit 1
}

$script = Join-Path $root "scripts\verify-bdlocal.js"
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
  Write-Host "[FALLO] No existe scripts\verify-bdlocal.js." -ForegroundColor Red
  exit 1
}

Write-Host "Node: $($node.Source)" -ForegroundColor DarkGray
Write-Host "Ejecutando controles de archivos, sintaxis, identidad, Telegram y Firebase...`n" -ForegroundColor Cyan

& $node.Source $script
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
  Write-Host "`nLa certificación encontró problemas. No realice una sincronización real todavía." -ForegroundColor Yellow
  exit $exitCode
}

Write-Host "`nCertificación estática aprobada." -ForegroundColor Green
Write-Host "Paso final en Electron:" -ForegroundColor Cyan
Write-Host "1. Ejecute npm start." -ForegroundColor White
Write-Host "2. Abra Base Local > Diagnóstico y salud." -ForegroundColor White
Write-Host "3. Ejecute el diagnóstico integral de solo lectura." -ForegroundColor White
Write-Host "4. Revise Mantenimiento seguro antes de aplicar cualquier corrección." -ForegroundColor White
exit 0

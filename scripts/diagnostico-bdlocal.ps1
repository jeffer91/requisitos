# =========================================================
# Nombre completo: diagnostico-bdlocal.ps1
# Ruta o ubicación: /scripts/diagnostico-bdlocal.ps1
# Función o funciones:
# - Ejecutar npm test y el smoke test de Electron.
# - Abrir la aplicación real con DevTools remoto.
# - Guardar el estado de BL2App, IndexedDB, conectores y consola.
# - No ejecutar sincronizaciones externas.
# =========================================================
[CmdletBinding()]
param([int]$Port=9322,[int]$ObservationSeconds=35)
$ErrorActionPreference="Stop"; Set-StrictMode -Version Latest
$Root=(Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Electron=Join-Path $Root "node_modules\.bin\electron.cmd"
$Probe=Join-Path $PSScriptRoot "diagnostico-runtime.js"
$Output=Join-Path $Root ("artifacts\diagnostico-"+(Get-Date -Format "yyyyMMdd-HHmmss"))
$Runtime=Join-Path $Output "05-runtime-report.json"; $Summary=Join-Path $Output "RESUMEN.txt"
function Step([string]$m){Write-Host "";Write-Host "=== $m ===" -ForegroundColor Cyan}
function Stop-Tree([int]$pid){if($pid -gt 0){try{& taskkill.exe /PID $pid /T /F 2>$null|Out-Null}catch{}}}
function Run-Captured([string]$cmd,[string]$out,[string]$err,[int]$timeout){$p=Start-Process "cmd.exe" -ArgumentList @("/d","/s","/c",$cmd) -WorkingDirectory $Root -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden -PassThru;if(-not $p.WaitForExit($timeout*1000)){Stop-Tree $p.Id;return [pscustomobject]@{ExitCode=124;TimedOut=$true}};[pscustomobject]@{ExitCode=$p.ExitCode;TimedOut=$false}}
if(!(Test-Path (Join-Path $Root "package.json"))){throw "No se encontró package.json en $Root"}
if(!(Test-Path $Electron)){throw "Falta Electron local. Ejecute npm install."}
if(!(Test-Path $Probe)){throw "Falta scripts/diagnostico-runtime.js"}
New-Item -ItemType Directory -Path $Output -Force|Out-Null
Step "Entorno"
$EnvInfo=@("Fecha: $(Get-Date -Format o)","Proyecto: $Root","Node: $((& node --version 2>&1|Out-String).Trim())","npm: $((& npm.cmd --version 2>&1|Out-String).Trim())","Electron: $((& $Electron --version 2>&1|Out-String).Trim())","Rama: $((& git branch --show-current 2>&1|Out-String).Trim())","Commit: $((& git rev-parse HEAD 2>&1|Out-String).Trim())","SheetJS: $((& node -e "const x=require('xlsx');console.log(x.version+' | '+require.resolve('xlsx'))" 2>&1|Out-String).Trim())");$EnvInfo|Set-Content (Join-Path $Output "01-entorno.txt") -Encoding UTF8;$EnvInfo|%{Write-Host $_}
Step "npm test";$Static=Run-Captured "npm.cmd test" (Join-Path $Output "02-npm-test.stdout.log") (Join-Path $Output "02-npm-test.stderr.log") 180;Write-Host "Código: $($Static.ExitCode)"
Step "Smoke Electron";$Smoke=Run-Captured "npm.cmd run test:electron" (Join-Path $Output "03-smoke.stdout.log") (Join-Path $Output "03-smoke.stderr.log") 80;Write-Host "Código: $($Smoke.ExitCode)"
$SmokeReport=Join-Path $Root "artifacts\bdlocal-electron-smoke.json";if(Test-Path $SmokeReport){Copy-Item $SmokeReport (Join-Path $Output "03-bdlocal-electron-smoke.json") -Force}
Step "Aplicación real"
try{Get-CimInstance Win32_Process -Filter "Name='electron.exe'"|?{$_.CommandLine -and $_.CommandLine.IndexOf($Root,[System.StringComparison]::OrdinalIgnoreCase)-ge 0}|%{Stop-Tree ([int]$_.ProcessId)}}catch{Write-Warning $_.Exception.Message}
$App=Start-Process "cmd.exe" -ArgumentList @("/d","/s","/c","`"$Electron`" --remote-debugging-port=$Port .") -WorkingDirectory $Root -RedirectStandardOutput (Join-Path $Output "04-app.stdout.log") -RedirectStandardError (Join-Path $Output "04-app.stderr.log") -PassThru
$ProbeExit=1
try{$Ready=$false;1..40|%{if(!$Ready){Start-Sleep -Milliseconds 500;try{$t=Invoke-RestMethod "http://127.0.0.1:$Port/json/list" -TimeoutSec 2;if($t){$Ready=$true}}catch{}}};if(!$Ready){throw "DevTools no respondió en el puerto $Port."};& node $Probe "--port=$Port" "--seconds=$ObservationSeconds" "--output=$Runtime";$ProbeExit=$LASTEXITCODE}finally{Stop-Tree $App.Id}
Step "Resumen"
$Lines=[System.Collections.Generic.List[string]]::new();$Lines.Add("Diagnóstico BDLocal");$Lines.Add("Carpeta: $Output");$Lines.Add("npm test: $($Static.ExitCode)");$Lines.Add("smoke: $($Smoke.ExitCode)");$Lines.Add("runtime: $ProbeExit")
if(Test-Path $Runtime){try{$r=Get-Content $Runtime -Raw|ConvertFrom-Json;$last=$r.snapshots|Select-Object -Last 1;if($last.bl){$s=$last.bl.state;$m=$last.bl.dbMeta;$c=$last.bl.connectors;$Lines.Add("");$Lines.Add("Indicador: $($last.bl.dbPill)");$Lines.Add("Vista: $($last.bl.viewStatus)");$Lines.Add("ready: $($s.ready)");$Lines.Add("booting: $($s.booting)");$Lines.Add("scriptsReady: $($s.scriptsReady)");$Lines.Add("lastError: $($s.lastError)");$Lines.Add("IndexedDB abierta: $($m.open)");$Lines.Add("Versión: $($m.version)");$Lines.Add("Tablas faltantes: $([string]::Join(', ',@($m.missingStores)))");$Lines.Add("Conectores ready: $($c.ready)");$Lines.Add("Errores conectores: $([string]::Join(' | ',@($c.errors)))");$Lines.Add("");$Lines.Add("Últimos registros:");@($last.bl.logs)|%{$Lines.Add("- $_")}}else{$Lines.Add("No se obtuvo el estado interno de BL: $($last.error) $($last.action)")}}catch{$Lines.Add("No se pudo interpretar runtime: $($_.Exception.Message)")}}else{$Lines.Add("No se generó 05-runtime-report.json")}
$Lines|Set-Content $Summary -Encoding UTF8;Get-Content $Summary
Write-Host "";Write-Host "Diagnóstico terminado." -ForegroundColor Green;Write-Host $Summary;Write-Host $Runtime

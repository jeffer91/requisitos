@echo off
title Actualizar y subir proyecto a GitHub - main
color 0A

echo ==========================================
echo   ACTUALIZAR Y SUBIR PROYECTO A GITHUB
echo ==========================================
echo.

echo [1/6] Verificando carpeta Git...
git status >nul 2>&1
if errorlevel 1 (
    echo ERROR: Esta carpeta no parece ser un repositorio Git.
    echo Abre este BAT dentro de la carpeta principal del proyecto.
    pause
    exit /b
)

echo.
echo [2/6] Mostrando estado actual...
git status

echo.
echo [3/6] Actualizando informacion de GitHub...
git fetch origin

echo.
echo [4/6] Bajando cambios recientes de main...
git pull origin main --rebase --autostash
if errorlevel 1 (
    echo.
    echo ERROR: No se pudo actualizar automaticamente.
    echo Probablemente hay un conflicto entre tus archivos locales y GitHub.
    echo No se subio nada. Revisa en Visual Studio Code.
    pause
    exit /b
)

echo.
echo [5/6] Agregando todos los cambios locales...
git add -A

echo.
echo [6/6] Guardando y subiendo cambios...
set fecha=%date% %time%
git commit -m "Actualizacion local %fecha%"
if errorlevel 1 (
    echo.
    echo No hay cambios nuevos para guardar.
) else (
    git push origin main
    if errorlevel 1 (
        echo.
        echo ERROR: No se pudo subir a GitHub.
        pause
        exit /b
    )
)

echo.
echo ==========================================
echo   LISTO: PROYECTO ACTUALIZADO Y SUBIDO
echo ==========================================
echo.
git status
pause

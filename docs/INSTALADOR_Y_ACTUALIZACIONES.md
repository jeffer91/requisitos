# Instalador y actualizaciones — Requisitos

## Objetivo

La aplicación está preparada para generar un instalador de Windows x64 mediante Electron Builder + NSIS y para recibir actualizaciones desde GitHub Releases con electron-updater.

La aplicación instalada conserva la ruta histórica de datos locales `requisitos-desktop` para no crear una Base Local nueva únicamente por cambiar de versión.

## Primera preparación en Visual Studio Code

Desde la terminal, dentro de la carpeta del repositorio:

```powershell
git pull
npm install
npm run test:installer
```

`npm install` instalará las dependencias ya declaradas en `package.json`, incluidas:

- electron-builder
- electron-updater

También actualizará `package-lock.json`.

## Crear el instalador local

```powershell
npm run dist:win
```

El resultado se genera en:

```text
dist/Requisitos-Setup-1.2.0.exe
```

La versión utilizada sale de `package.json`.

Para comprobar el empaquetado sin crear el instalador NSIS completo:

```powershell
npm run pack:win
```

## Primera versión publicada

La versión actual del proyecto es `1.2.0`.

Cuando el instalador local ya haya sido probado, la primera publicación puede realizarse con:

```powershell
git add package.json package-lock.json
git commit -m "build: fijar dependencias del instalador"
git push origin main

git tag v1.2.0
git push origin v1.2.0
```

El tag activa `.github/workflows/release-windows.yml`, que genera el instalador y publica los archivos necesarios para la actualización automática en GitHub Releases.

## Publicar una corrección posterior

Para pasar, por ejemplo, de 1.2.0 a 1.2.1:

```powershell
npm version patch
git push origin main
git push origin --tags
```

Para una versión con nuevas funciones:

```powershell
npm version minor
git push origin main
git push origin --tags
```

`npm version` actualiza `package.json`, actualiza `package-lock.json`, crea el commit de versión y crea el tag correspondiente.

## Cómo se actualiza la aplicación instalada

1. Requisitos comprueba GitHub Releases después de iniciar.
2. Si existe una versión superior, la descarga en segundo plano.
3. Cuando termina, muestra **Actualizar y reiniciar**.
4. Antes de cerrar, `main-safe.js` ejecuta la misma protección de sincronización utilizada para un cierre normal.
5. Si existen cambios pendientes o la sincronización no se confirma, la actualización queda pospuesta.
6. Si el cierre es seguro, Electron instala la nueva versión y vuelve a abrir la aplicación.

El menú nativo también incluye:

```text
Ayuda → Buscar actualizaciones
```

## Reglas que no deben cambiarse

- Mantener estable `build.appId = ec.itsqmet.requisitos`.
- Mantener `productName = Requisitos`.
- No cambiar la ruta histórica `requisitos-desktop` de `userData` sin una migración explícita.
- No activar `autoInstallOnAppQuit`; el cierre debe pasar por la protección de sincronización.
- Cada GitHub Release debe tener una versión superior a la instalada.
- El tag debe coincidir con la versión de `package.json`: por ejemplo, versión `1.2.1` → tag `v1.2.1`.

## Archivos principales

- `package.json`: configuración del instalador y publicación.
- `electron/updater.js`: descarga e instalación de actualizaciones.
- `electron/main-safe.js`: protección de datos antes de instalar.
- `electron/preload.js`: puente seguro de actualizaciones.
- `electron/assets/icon.svg`: icono del instalador.
- `.github/workflows/release-windows.yml`: construcción y publicación automática.
- `scripts/verify-installer-config.js`: comprobación rápida antes de empaquetar.

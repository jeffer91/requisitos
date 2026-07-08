# Google Apps Script - BL2 Sync V2

## Objetivo

Recibir desde BDLocal la cola nueva `cambios_pendientes` y guardar `notas_titulacion` en Google Sheets.

## Archivo principal

Copiar completo este archivo en Google Apps Script:

```text
integraciones/google-apps-script/apps-script-sync-bl2-v2.gs
```

## Configuración del token

En Google Apps Script:

1. Ir a **Configuración del proyecto**.
2. Buscar **Propiedades del script**.
3. Agregar esta propiedad:

```text
BL2_SYNC_TOKEN = TU_TOKEN_SECRETO
```

El mismo token debe estar configurado en la app, en la conexión de Google Sheets.

## Publicar como Web App

1. Clic en **Implementar**.
2. Elegir **Nueva implementación**.
3. Tipo: **Aplicación web**.
4. Ejecutar como: **Yo**.
5. Quién tiene acceso: **Cualquiera con el enlace**.
6. Copiar la URL generada.
7. Pegar esa URL en la configuración de Google Sheets de la app.

## Hoja creada

El script crea o actualiza la hoja:

```text
notas_titulacion
```

Columnas:

```text
idEstudiantePeriodo
periodoId
cedula
Notart
Notdef
Notafinal
estadoNota
origen
updatedAt
syncSource
syncTarget
lastGoogleSyncAt
```

## Respuesta esperada

Cuando BDLocal envía notas, Apps Script responde con:

```json
{
  "ok": true,
  "table": "notas_titulacion",
  "processedIds": [],
  "skippedIds": [],
  "outboxProcessed": false,
  "partial": true
}
```

`processedIds` permite que la app marque como sincronizados solo los cambios realmente escritos.

## Prueba rápida

Abrir la URL del Web App en navegador. Debe responder algo parecido a:

```json
{
  "ok": true,
  "service": "BL2 Sync V2"
}
```

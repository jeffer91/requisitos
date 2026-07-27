# Checklist manual de conexiones

Ejecutar en el equipo con la aplicación instalada después de aprobar las pruebas automáticas.

## Base Local

- Abrir **Centro de datos**.
- Confirmar que Base Local aparece operativa.
- Abrir **Pantallas** y ejecutar el diagnóstico interno.
- Confirmar que las pantallas activas aparecen conectadas.
- Abrir **Tablas** y verificar que IndexedDB responde.
- Confirmar que la aplicación sigue permitiendo consultas sin internet.

## Firebase

- Abrir **Conexiones Externas → Firebase**.
- Pulsar **Probar**.
- Confirmar que se realiza únicamente una lectura mínima.
- Verificar que el estado cambia a conexión verificada.
- Revisar reglas y permisos si aparece un error.

## Google Sheets

- Abrir **Conexiones Externas → Google Sheets**.
- Confirmar URL de Apps Script, token e ID del archivo.
- Pulsar **Probar**.
- Confirmar respuesta correcta del `ping`.
- Verificar que no existe sincronización automática después de esperar más de cinco minutos.

## Supabase

- Abrir **Conexiones Externas → Supabase**.
- Confirmar URL, anon key y tabla.
- Pulsar **Probar**.
- Confirmar que la consulta REST de solo lectura responde correctamente.

## Cierre

- Pulsar **Probar conexiones** y confirmar los tres resultados.
- Cerrar y volver a abrir la aplicación.
- Confirmar que no se ejecutan subidas ni descargas automáticamente.
- Revisar **Cola y reintentos** para confirmar que ningún pendiente cambió sin acción manual.

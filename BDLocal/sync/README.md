# BDLocal/sync

Capa general de cola y registro de sincronización.

Esta carpeta debe encargarse de:

- guardar cambios pendientes
- registrar intentos de sincronización
- manejar reintentos
- registrar errores
- entregar cambios al motor de continuidad

Regla: sync no debe decidir si se usa Firebase, Supabase, Excel o Google Sheets. Esa decisión corresponde al motor de continuidad.

Estado actual: existen archivos antiguos orientados a Firebase. Se mantendrán como compatibilidad hasta desacoplarlos por bloques.

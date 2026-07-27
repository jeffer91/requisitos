# Conexiones Externas

Esta carpeta queda reservada para el módulo que administrará Firebase, Supabase y Google Sheets dentro del Centro de datos.

## Estado actual

Bloque 1: diseño y clasificación.

Todavía no contiene archivos ejecutables y no reemplaza ninguna ruta de `BDLocal`. La aplicación continúa funcionando con la estructura actual.

## Responsabilidades futuras

- adaptadores por proveedor;
- sincronización manual y controlada;
- subida y descarga;
- lotes y reintentos;
- conflictos;
- configuración y credenciales;
- cuotas, consumo y presupuestos;
- diagnóstico de conexiones remotas;
- interfaz de Conexiones Externas.

## Restricciones

- no acceder directamente a IndexedDB;
- no permitir conexiones directas desde las pantallas académicas;
- consumir cambios mediante la API de Base Local;
- devolver resultados confirmados a Base Local;
- mantener estados independientes para Firebase, Supabase y Google Sheets;
- funcionar sin bloquear la aplicación cuando no exista internet.

La arquitectura completa está documentada en `docs/CENTRO_DATOS_BLOQUE_1_ARQUITECTURA.md`.

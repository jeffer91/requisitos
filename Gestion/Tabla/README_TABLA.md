# Tabla

Pantalla de consulta y comunicación de estudiantes almacenados en Base Local.

## Objetivo

La pantalla Tabla permite:

- Consultar estudiantes por período.
- Filtrar por división y carrera.
- Buscar por cédula, nombre, correo o Telegram.
- Filtrar estudiantes por requisitos faltantes.
- Preparar mensajes individuales.
- Abrir WhatsApp y correo.
- Enviar Telegram individual mediante bot.
- Preparar y ejecutar envíos masivos por Telegram.
- Consultar el historial de contactos por estudiante y período.

Tabla consume la información entregada por BDLocal, pero no modifica la arquitectura interna de BDLocal.

---

## Regla de arquitectura

Cada archivo tiene una responsabilidad principal.

```text
BDLocal
   │
   ▼
data/tabla.data-source.js
   │
   ▼
data/tabla.data-normalizer.js
   │
   ▼
core/tabla.state.js
   │
   ▼
ui/tabla.filters.js
   │
   ▼
ui/tabla.pagination.js
   │
   ▼
ui/tabla.render-*.js
   │
   ▼
communication / mass / history
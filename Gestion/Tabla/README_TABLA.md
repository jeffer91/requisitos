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

## Flujo simple de trabajo

La pantalla incorpora una capa operativa pensada para uso diario:

- **Etapa actual:** permite ver Todos, Fuera de etapa o Cumplen etapa.
- **Regla de etapa vigente:** deben estar completos Documentación, Prácticas, Vinculación, Inglés, Seguimiento a graduados y Actualización de datos. Académico, Financiero y Titulación se consideran posteriores.
- **Comunicación global:** un selector maestro aplica el tipo de mensaje a los estudiantes filtrados; incluye un mensaje específico de **Etapa actual**.
- **WhatsApp masivo:** intenta abrir una pestaña por estudiante con teléfono válido y registra cada apertura preparada.
- **Outlook masivo:** abre una pestaña de Outlook Web por estudiante filtrado con correo válido, priorizando el correo institucional y usando el personal como respaldo.
- **Telegram:** conserva el envío masivo existente y agrega un popup de grupos por carrera.
- **Contador:** muestra contactos válidos por WhatsApp, Telegram y correo, además de estudiantes contactados.

Todas estas acciones consumen `filteredRows` de Tabla para que filtros, comunicación e historial trabajen sobre el mismo conjunto de estudiantes.


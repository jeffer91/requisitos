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
- **Núcleos:** tipo de mensaje disponible en **Comunicar**. Informa si el estudiante está habilitado para ingresar a Núcleos y, cuando no lo está, detalla cuáles de los ocho requisitos están pendientes. Exige Académico, Documentación, Prácticas preprofesionales, Vinculación, Seguimiento a graduados, Inglés, Actualización de datos y Financiero. Titulación no forma parte de esta validación.
- **Faltantes > Núcleos:** muestra únicamente estudiantes que todavía no cumplen esos ocho requisitos. Al seleccionar **Núcleos** en **Comunicar**, este filtro se activa automáticamente y los envíos masivos vuelven a validar la aptitud antes de preparar destinatarios.
- **Comunicación global:** un selector maestro aplica el tipo de mensaje a los estudiantes filtrados; incluye mensajes específicos de **Etapa actual** y **Núcleos**.
- **WhatsApp masivo:** intenta abrir una pestaña por estudiante con teléfono válido y registra cada apertura preparada.
- **Outlook masivo:** abre una pestaña de Outlook Web por estudiante filtrado con correo válido. Si existen correo personal e institucional, incluye ambos como destinatarios; si solo existe uno, utiliza el disponible.
- **Telegram:** conserva el envío masivo existente y agrega un popup de grupos por carrera.
- **Contador:** muestra contactos válidos por WhatsApp, Telegram y correo, además de estudiantes contactados.

Todas estas acciones consumen `filteredRows` de Tabla para que filtros, comunicación e historial trabajen sobre el mismo conjunto de estudiantes.

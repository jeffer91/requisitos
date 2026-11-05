# Inf — Informe Final del Proceso de Titulación

Módulo independiente en la rama **main** de `jeffer91/requisitos`, accesible desde el menú superior de la aplicación como **Inf**.

## Estado de desarrollo

- **Capítulo 1. Introducción:** texto fijo entregado por el usuario.
- **Capítulo 2. Base Legal:** texto fijo entregado por el usuario, incluidos 2.5–2.9. Debe verificarse jurídicamente antes de emitir un documento oficial.
- **Capítulo 3. Metodología:** texto fijo completo entregado por el usuario, incluidos 3.7 (cronogramas) y 16 carreras (3.4.4.1–3.4.4.16).
- **Capítulos 4–8:** estructura creada, pero todavía sin resultados reales ni textos genéricos de estas secciones.
- **Gráficos:** 16 esquemas visuales de cuatro núcleos por carrera, generados desde el texto de 3.4.4; diagramas Gantt editables de las dos modalidades.
- **PDF:** botón «Descargar PDF de avance», que genera un documento A4 local mediante jsPDF, con portada INF en condición de borrador, capítulos disponibles, gráficos y cronogramas. No es una emisión institucional legalizada.
- **Cronogramas:** período seleccionado, dos tablas editables y guardado local independiente por período.
- **BDLocal:** `ConInf` es un conector de reserva que declara `dataConnected:false`. Inf aún no lee notas ni requisitos; los análisis estadísticos del capítulo 4 se habilitarán cuando sus fuentes estén disponibles y verificadas.

## Arquitectura

```text
Inf/
├── inf.html, inf.css, inf.app.js
├── core/
│   ├── inf.catalog.js       Índice numerado
│   ├── inf.registry.js      Textos fijos por capítulo
│   ├── inf.report.js        Modelo del informe
│   ├── inf.markdown.js      Vista segura de los textos
│   ├── inf.nuclei.js        Nombres de núcleos desde 3.4.4.x
│   ├── inf.schedules.js     Cronogramas por período
│   └── inf.visuals.js       Diagramas SVG de núcleos y Gantt
├── sections/
│   ├── 01-introduccion/section.js
│   ├── 02-base-legal/section.js
│   ├── 03-metodologia/section.js
│   ├── 04-resultados/section.js
│   ├── 05-resumen-ejecutivo/section.js
│   ├── 06-conclusiones/section.js
│   ├── 07-recomendaciones/section.js
│   └── 08-referencias/section.js
├── export/inf.pdf.js
└── tests/verify-inf.js
```

El menú registra `inf` en `Maqueta` y el conector de reserva `BDLocal/conexiones/cone.inf.js` sin permisos de lectura/escritura de datos académicos.

## Cronogramas

La primera vez que se selecciona **Octubre 2025 a Marzo 2026** se muestran los cronogramas entregados por el usuario: 6 actividades para Examen Complexivo y 20 para Trabajo de Titulación, dividido en tres fases. Las fechas se preservan literalmente, aunque la ejecución del proceso se extienda más allá de marzo de 2026.

Los demás períodos comienzan con sus dos cronogramas vacíos. Cada actividad puede modificarse o eliminarse; se pueden agregar nuevas actividades. El usuario debe pulsar **Guardar cronogramas**. El guardado usa solamente `localStorage`, en la clave `ITSQMET_INF_CRONOGRAMAS_V1`, y no altera BDLocal, Firebase ni actas.

Los estados se registran como **NO_VERIFICADO** salvo indicación fundamentada del usuario. Una fecha pasada no constituye evidencia de cumplimiento. No se calculan tasas de ejecución sin comprobación.

## PDF y gráficos

El PDF se produce a partir de jsPDF ya utilizado en otros módulos de la aplicación (`node_modules/html2pdf.js/node_modules/jspdf` o instalación directa). Incluye esquemas estructurales reales (4 núcleos por cada una de las 16 carreras) y cronogramas editados con barras Gantt. Las fechas se validan antes de exportar.

El documento presenta **BORRADOR DE AVANCE - NO LEGALIZADO** y no se puede confundir con un informe oficial final. Los capítulos 4 a 8 no se rellenan con números inventados. Los gráficos estadísticos de estudiantes, aprobados, supletorios, medias y comparaciones por carrera se incorporarán al conectar datos verificados.

La maquetación se orienta a la guía ITSQMET INF v1.1 (portada A4 y bloque de firmas) y el estilo de texto académico APA 7. El código documental debe aprobarse externamente: no generar códigos o firmas falsas.

## Verificación

Desde la raíz del repositorio:

```bash
node Inf/tests/verify-inf.js
```

Las comprobaciones validan el índice completo, los textos incorporados, los 16 diagramas/64 nombres de núcleos, los 2 cronogramas y el aislamiento por período. La ejecución gráfica y de PDF debe verificarse también en Electron antes de emitir un informe institucional.

## Actualizaciones futuras

Cada texto genérico nuevo se incorpora exclusivamente a `Inf/sections` y su clave numerada. Los títulos no se reescriben sin instrucción explícita. No se debe mezclar un texto fijo con registros cambiantes por período.

## Exportación progresiva — capítulos disponibles

El botón **Descargar PDF con lo avanzado** utiliza `InfReport.buildAvailable()`. El reporte completo (`build()`) conserva el índice de ocho capítulos en pantalla; la exportación toma solamente capítulos o subapartados que ya tengan texto incorporado, preservando sus encabezados antecesores. Por ahora genera capítulos 1, 2 y 3, los diagramas y cronogramas disponibles. Los capítulos 4–8 no se incluyen ni bloquean la exportación. `canExport` sigue siendo `false` para la emisión oficial y `canExportDraft` permanece `true` mientras exista texto. Un problema de presentación de diagramas no bloquea los controles del módulo. El PDF conserva la identificación BORRADOR PARCIAL NO LEGALIZADO; no contiene cifras académicas inventadas.

## Revisión editorial del PDF (5 noviembre 2026)

El PDF tiene un encabezado institucional completo y repetido en todas las páginas, título central de 23 pt en negrita con período académico, bloque de firmas con celdas y renglones independientes, sangría de primera línea de 1,27 cm para párrafos ordinarios, sin columna de estado en cronogramas ni textos de borrador en la portada. Los 16 diagramas de núcleos incluyen el nombre dentro de cada círculo, y la metodología suma siete figuras de flujo adicionales. El archivo continúa siendo una exportación progresiva sin certificación ni firma institucional efectiva; su estado interno se mantiene como no oficial.

## Resultados 4.2 y lectura BDLocal

El conector `ConInf` abre exclusivamente una **BDLocal existente**, sin indicar versión (sin migración), con transacciones IndexedDB `readonly`. Si el entorno no permite comprobar la existencia previa de la base, no intenta crearla: utiliza únicamente una caché central preexistente, si la hay, y señaliza que los resultados son parciales. No invoca ninguna función de escritura o sincronización.

Las notas de núcleos se reconocen solo por registros explícitos de núcleos. La aplicación **no toma los resultados teórico/práctico de Ncomplex como notas de preparación**. La sección 4.2 contiene el texto general y generará tablas de estudiantes, cuatro controles, caso y final, promedios por núcleo y gráficos comparativos cuando se encuentren datos verificables. Si faltan, lo indica, sin inventarlos. Los capítulos 1–3 permanecen iguales.

Comprobación rápida: `node Inf/tests/verify-inf.js`.

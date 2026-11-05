# Inf — Informes de Titulación

Módulo de la aplicación Requisitos, desarrollado directamente en la rama `main`. El menú principal abre `Inf/inf.html`.

## Secciones incorporadas

- **1. Introducción**: texto institucional suministrado por el usuario.
- **2. Base Legal**: texto institucional suministrado por el usuario (apartados 2.1 a 2.9); sus artículos y vigencia deberán contrastarse antes de emisión oficial.
- **3. Metodología**: texto completo con 16 carreras y 64 núcleos estructurantes (3.4.4.1 a 3.4.4.16), más cronogramas por período (3.7).
- **4.2. Resultados de Núcleos Estructurantes**: texto genérico de 4.2.1–4.2.3 y motor dinámico. Cuando BDLocal contenga notas finales explícitamente asociadas a núcleos, se generan listados individuales, cuatro evaluaciones, caso de estudio, notas finales, promedios por núcleo y gráficos comparativos.
- **4.1 y 4.3, capítulos 5 a 8**: permanecen pendientes de incorporación completa de sus textos y/o fuentes de resultados. No se generan datos ficticios.

## PDF

`Inf/export/inf.pdf.js` crea un PDF A4 progresivo mediante jsPDF, reutilizando dependencias instaladas del proyecto.

- Portada con título completo y período en **23 pt y negrita**, sin letreros de borrador.
- Encabezado institucional completo, logo, código pendiente, versión pendiente, fecha y paginación **en todas las páginas**.
- Firmas distribuidas en tres columnas con celdas independientes y cargos ajustados a varias líneas.
- Texto académico con márgenes de 2,54 cm, sangría inicial de 1,27 cm e interlineado aproximado doble; las normas de portada institucional se respetan separadamente.
- Metodología ilustrada con **16 diagramas de cuatro núcleos**, con sus nombres dentro de los círculos, y **7 diagramas de procedimientos** adicionales.
- Cronogramas de Complexivo y Trabajo de Titulación por período: tablas sin columna Estado, y figuras Gantt.
- Sección 4.2 con tablas y gráficos únicamente cuando existan calificaciones explícitas y verificables; si no están, el PDF informa la carencia sin inventar resultados.

La posibilidad de descargar el PDF **no requiere completar los ocho capítulos**. El registro interno conserva `canExport:false` para una emisión oficialmente legalizada; quitar los letreros de la portada no autoriza asumir firmas o números de acta aprobados. No se genera un código documental ficticio.

## Conexión BDLocal exclusivamente de lectura

El conector `BDLocal/conexiones/cone.inf.js` expone `canRead:true` y `canWrite:false`. Su lectura utiliza la base local `REQUISITOS_BL2` **solo si ya existe** y mediante transacciones IndexedDB `readonly`. No ejecuta migraciones, actualización de esquema, sincronizaciones o escrituras. Si el entorno no permite abrir la base existente, puede utilizar una caché central preexistente únicamente para consultas; esa fuente limitada no aporta notas de núcleos.

La pantalla obtiene los períodos institucionales desde BDLocal y exige la coincidencia del identificador real de período para analizar estudiantes. Los cronogramas se guardan independientemente en `localStorage` por período y no alteran los registros de la base académica.

`Inf/core/inf.results.js` conserva el cero como calificación válida, distingue las cuatro evaluaciones y el caso de estudio, y **no calcula notas definitivas con ponderaciones no definidas**. También evita convertir notas teóricas/prácticas del examen complexivo en notas de núcleos.

## Estructura principal

- `Inf/inf.html`, `Inf/inf.css`, `Inf/inf.app.js`: interfaz y controles
- `Inf/core/inf.catalog.js`, `Inf/core/inf.registry.js`: índice y textos fijos
- `Inf/core/inf.nuclei.js`, `Inf/core/inf.visuals.js`: diagramas
- `Inf/core/inf.schedules.js`: cronogramas editables
- `Inf/core/inf.results.js`: consolidado académico de núcleos
- `Inf/export/inf.pdf.js`: exportación A4
- `Inf/sections/*/section.js`: capítulos y apartados del informe
- `BDLocal/conexiones/cone.inf.js`: consulta académica exclusiva
- `Inf/tests/verify-inf.js`: pruebas de índice, cronogramas, separación de notas y representación PDF

## Verificación

Desde la raíz del repositorio:

```bash
node Inf/tests/verify-inf.js
```

El test simula la composición del PDF y valida cabeceras repetidas, paginación, texto disponible y coordenadas. No reemplaza la revisión visual final dentro de Electron, especialmente de tablas grandes o carreras cuyos nombres de núcleos sean extensos.

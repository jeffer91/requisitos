# Complexivo · Plani

Carpeta específica para la plantilla de **Planificación de Examen Complexivo**.

## Archivos principales

```text
sections/complexivo/
├── complexivo.sections.js
├── complexivo.content.js
├── complexivo.rules.js
├── complexivo.tables.js
├── complexivo.charts.js
├── complexivo.assets.config.js
└── README.md
```

## Función

Esta carpeta controla solamente la lógica del documento Complexivo:

- estructura de secciones;
- contenido base;
- reglas de coherencia;
- tablas propias;
- gráficos lógicos;
- carpetas lógicas para recursos por sección.

## Regla de mantenimiento

Si cambia una sección del documento Complexivo, se debe tocar primero esta carpeta, no el motor general de Plani.

El motor general solo arma documentos. Esta carpeta define qué debe tener el documento de Examen Complexivo.

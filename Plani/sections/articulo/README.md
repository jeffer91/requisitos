# Articulo Academico · Plani

Carpeta especifica para la plantilla de **Planificacion de Articulo Academico**.

## Archivos principales

```text
sections/articulo/
├── articulo.sections.js
├── articulo.content.js
├── articulo.rules.js
├── articulo.tables.js
├── articulo.charts.js
├── articulo.assets.config.js
└── README.md
```

## Funcion

Esta carpeta controla solamente la logica del documento Articulo Academico:

- estructura de secciones;
- contenido base;
- reglas de coherencia;
- tablas propias;
- graficos logicos;
- carpetas logicas para recursos por seccion.

## Regla de mantenimiento

Si cambia una seccion del documento Articulo Academico, se debe tocar primero esta carpeta, no el motor general de Plani.

El motor general solo arma documentos. Esta carpeta define que debe tener el documento de Articulo Academico.

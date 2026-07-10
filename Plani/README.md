# Plani

Módulo interno para generar documentos de planificación de titulación.

## Objetivo

Plani permitirá seleccionar un período, escoger el tipo de planificación, cargar o pegar un cronograma y construir un documento institucional único con portada, encabezado, índice, secciones, recursos por sección, firmas y exportación.

## Alcance del bloque 1

Este primer bloque crea solamente la base del módulo:

```text
Requisitos/Plani/
├── README.md
├── frontend/plani.html
├── frontend/plani.css
├── frontend/plani.app.js
├── frontend/plani.ui.js
├── frontend/plani.events.js
└── core/plani.constants.js
```

En este bloque no se conecta todavía al menú principal de Requisitos y no se modifica Infor.

## Relación con Infor

Infor genera informes de titulación.

Plani generará planificaciones institucionales de titulación.

Ambos módulos deben mantenerse separados para evitar dependencias cruzadas y facilitar mantenimiento.

## Tipos de planificación previstos

```text
COMPLEXIVO = Planificación de Examen Complexivo
ARTICULO   = Planificación de Artículo Académico
TRABAJO    = Planificación de Trabajo de Titulación
```

## Principio de arquitectura

El documento final será un solo archivo exportable, pero internamente cada parte estará separada por responsabilidad:

- pantalla y eventos en `frontend/`
- reglas y estado en `core/`
- plantillas institucionales en `templates/`
- secciones por tipo de documento en `sections/`
- imágenes y gráficos por sección
- exportación en `export/`

## Siguientes bloques

Los siguientes bloques agregarán estado persistente, período, plantillas, cronogramas, recursos por sección, motor documental, exportación e integración final al menú.

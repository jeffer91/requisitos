# Bloque 4 — Interfaz final del Centro de datos

## Resultado

La aplicación mantiene una sola entrada en el menú principal:

```text
Centro de datos
```

La ruta compatible continúa siendo `BDLocal/bl2.html`; no se crea una aplicación externa ni una ventana independiente.

## Menú lateral

```text
Resumen

Base Local
├── Estado y rendimiento
├── Pantallas
├── Tablas
├── Consulta de estudiante
├── Respaldos
├── Mantenimiento
└── Diagnóstico

Conexiones Externas
├── Resumen de sincronización
├── Firebase
├── Supabase
├── Google Sheets
├── Cola y reintentos
├── Conflictos
└── Cuotas y consumo
```

## Cabecera

La cabecera muestra:

- período activo;
- estado de Base Local;
- estado general de Conexiones Externas;
- actualización manual;
- progreso de operaciones controladas.

## Base Local

La interfaz consulta `BDLocalPantallas` y los servicios locales existentes para mostrar:

- estado operativo;
- número de pantallas registradas;
- tablas disponibles;
- estudiantes del período activo;
- respaldos registrados;
- capacidad de trabajo sin internet.

## Conexiones Externas

La interfaz consulta exclusivamente `ConexionesExternas` y mantiene separados:

- estado por proveedor;
- pendientes locales;
- errores y bloqueos;
- pausa y reanudación manual;
- configuración de Firebase, Supabase y Google Sheets;
- cola y reintentos;
- conflictos;
- mediciones locales de consumo.

## Seguridad y compatibilidad

- No se abre IndexedDB directamente desde la nueva interfaz.
- No se realizan llamadas de red desde la capa visual.
- No se habilitan sincronizaciones automáticas.
- Los lotes continúan limitados a 25 cambios.
- Los identificadores y botones existentes se conservan.
- Las rutas antiguas siguen funcionando durante la transición.
- Las cuotas locales no se presentan como datos oficiales del proveedor.

## Carga

`BDLocal/diagnostics/bdl.diagnostics.index.js` carga la interfaz únicamente cuando existe el contenedor del Centro de datos. Las demás pantallas no reciben este código visual.

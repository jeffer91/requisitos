# Alcance de Base Local

Base Local es el núcleo de datos de la aplicación y continuará siendo la fuente de trabajo principal.

## Pertenece a Base Local

- IndexedDB, stores e índices;
- reglas y validaciones;
- repositorios y servicios;
- lectura y guardado de las pantallas;
- caché y revisiones compartidas;
- integridad y relaciones entre tablas;
- rendimiento local;
- respaldos, restauración y migraciones;
- mantenimiento seguro;
- registro de `cambios_pendientes`;
- persistencia de `sync_estado` y conflictos.

## No pertenece a Base Local

- credenciales de proveedores remotos;
- llamadas directas a Firebase, Supabase o Google Sheets;
- presupuestos y cuotas de servicios externos;
- adaptadores de red;
- ejecución de sincronización contra internet;
- interfaz específica de cada proveedor.

## Conexiones con pantallas

La carpeta actual `BDLocal/conexiones/` conecta las pantallas con Base Local. No representa las conexiones con internet. Durante el bloque 2 se organizará con un nombre funcional más claro, conservando compatibilidad con las rutas existentes.

## Regla de operación

```text
Pantalla → Base Local → cambios_pendientes → Conexiones Externas
```

Ninguna reorganización debe impedir que la aplicación trabaje sin conexión a internet.

La definición completa está en `docs/CENTRO_DATOS_BLOQUE_1_ARQUITECTURA.md`.

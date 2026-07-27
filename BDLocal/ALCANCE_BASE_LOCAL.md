# Alcance de Base Local

Base Local es el núcleo operativo de las pantallas y la fuente de trabajo rápida y sin conexión. Firebase conserva el rol de fuente oficial remota cuando está configurado; las pantallas nunca deben conectarse directamente con él.

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

La carpeta histórica `BDLocal/conexiones/` continúa activa únicamente como compatibilidad. La puerta oficial para las pantallas es `BDLocalPantallas`, ubicada en `BDLocal/pantallas/`.

Estas conexiones son internas y no representan conexiones con internet.

## Regla de operación

```text
Pantalla → Base Local → cambios_pendientes → Conexiones Externas
```

Ninguna reorganización debe impedir que la aplicación trabaje sin conexión a internet. Las operaciones hacia Firebase, Supabase y Google Sheets requieren una acción manual y pasan por `ConexionesExternas`.

La definición completa está en `docs/CENTRO_DATOS_BLOQUE_1_ARQUITECTURA.md`.

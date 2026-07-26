# Centro de datos — Bloque 1: arquitectura e inventario

## Estado

Documento de diseño. Este bloque no mueve archivos ejecutables, no cambia rutas y no modifica IndexedDB ni la sincronización.

## Decisión de producto

El Centro de datos permanecerá dentro de la aplicación principal.

En el menú principal existirá una sola entrada:

```text
Centro de datos
```

Dentro se utilizará un menú lateral con dos grupos funcionales:

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

La barra superior conservará únicamente información global: período activo, salud general y actualización del estado.

## Límite entre módulos

### Base Local

Base Local será propietaria de:

- IndexedDB, tablas e índices;
- reglas, normalización y validación;
- repositorios y servicios;
- comunicación con las pantallas de la aplicación;
- rendimiento local e integridad;
- respaldos, restauración y migraciones;
- mantenimiento seguro;
- registro de cambios pendientes;
- persistencia de estados de sincronización y conflictos.

### Conexiones Externas

Conexiones Externas será responsable de:

- Firebase;
- Supabase;
- Google Sheets y Apps Script;
- subida y descarga remota;
- adaptadores por proveedor;
- procesamiento de lotes;
- reintentos y pausas;
- resolución y presentación de conflictos;
- configuración y credenciales;
- consumo, cuotas y presupuestos de operación;
- diagnóstico de servicios remotos.

## Flujo obligatorio

```text
Pantalla
  → Servicio Base Local
    → Reglas
      → Repositorio
        → IndexedDB
          → cambios_pendientes
            → Conexiones Externas
              → Firebase / Supabase / Google Sheets
                → resultado
                  → Base Local
```

## Reglas no negociables

1. Ninguna pantalla se conecta directamente con Firebase, Supabase o Google Sheets.
2. Base Local es la única propietaria de IndexedDB.
3. Conexiones Externas no modifica tablas locales directamente; utiliza una API o servicio de Base Local.
4. `cambios_pendientes`, `sync_estado` y los conflictos permanecen almacenados en Base Local.
5. Cada proveedor externo conserva estado, error, intento y reintento independientes.
6. Una falla de internet no debe impedir el uso local de la aplicación.
7. Una respuesta externa no se marca como sincronizada sin confirmación real del proveedor.
8. Las cuotas mostradas deben distinguir entre consumo medido localmente y cuota oficial del proveedor.
9. Durante la migración se conservarán puentes de compatibilidad hasta que pasen las pruebas.
10. No se eliminará ningún archivo antiguo únicamente por su nombre; primero se comprobarán referencias y ejecución.

## Clasificación inicial de archivos

### Permanecen en Base Local

```text
BDLocal/bl2.config.js
BDLocal/bl2.config.v2.js
BDLocal/bl2.db.js
BDLocal/rules/
BDLocal/repositories/
BDLocal/services/
BDLocal/views/
BDLocal/migrations/
BDLocal/diagnostics/
BDLocal/maintenance/
BDLocal/adapters/bdl.divisiones.*
BDLocal/bl2.backup.js
BDLocal/bl2.backup.v2.js
BDLocal/bl2.import.js
BDLocal/bl2.core.js
BDLocal/bl2.compat.js
BDLocal/bl2.raw-view.js
BDLocal/patches/bdl.v2.mirror.js
BDLocal/patches/bdl.changes.outbox-bridge.js
BDLocal/sync/bdl.sync.outbox.js
```

La actual carpeta `BDLocal/conexiones/` corresponde principalmente a conexiones internas entre pantallas y Base Local. En el bloque 2 se reorganizará conceptualmente como `BDLocal/pantallas/` o `BDLocal/puentes/`, conservando compatibilidad temporal con las rutas actuales.

### Pasan conceptualmente a Conexiones Externas

```text
BDLocal/firebase/
BDLocal/sync/targets/
BDLocal/sync/bdl.sync.orchestrator.js
BDLocal/sync/bdl.sync.index.js
BDLocal/sync/bdl.sync.ui-bridge.js
BDLocal/bl2.cloud-pull.js
BDLocal/bl2.cloud-pull.safe.js
BDLocal/bl2.google-push.guard.js
js/bdlocal-config/bdlocal-config.store.js
js/bdlocal-config/bdlocal-config.ui.js
js/bdlocal-config/bdlocal-sync.manager.js
js/bdlocal-config/bdlocal-google-bridge.js
js/bdlocal-config/bdlocal-sync-fixups.js
integraciones/google-apps-script/
supabase/
```

No se moverán todavía. La clasificación indica su destino final.

### Requieren división

| Archivo o módulo | Parte local | Parte externa |
|---|---|---|
| `BDLocal/bl2.html` | tablas, pantallas, respaldos, mantenimiento y diagnóstico | Firebase, Supabase, Google Sheets, cuotas y sincronización |
| `BDLocal/bl2.app.js` | estado y acciones de Base Local | acciones remotas y estado de proveedores |
| `BDLocal/bl2.sync.js` | compatibilidad y creación de cambios pendientes | ejecución contra servicios remotos |
| `BDLocal/diagnostics/bdl.diagnostics.general.js` | salud, tablas, servicios e integridad | resumen de cola y proveedores |
| manuales técnicos | arquitectura de IndexedDB | operación de proveedores externos |

## Estructura objetivo

```text
BDLocal/
├── db/
├── rules/
├── repositories/
├── services/
├── views/
├── pantallas/
├── outbox/
├── diagnostics/
├── backups/
├── migrations/
├── maintenance/
└── ui/

ConexionesExternas/
├── core/
├── providers/
│   ├── firebase/
│   ├── supabase/
│   └── google-sheets/
├── queue/
├── conflicts/
├── usage/
├── diagnostics/
└── ui/
```

## Contrato mínimo entre módulos

Base Local deberá exponer, como mínimo, operaciones equivalentes a:

```text
ready()
health()
getActivePeriod()
listPendingChanges(filters)
markChangesSynced(target, ids, result)
markChangesError(target, ids, error)
registerExternalUsage(target, usage)
saveExternalRecords(target, records, options)
saveConflict(conflict)
```

Conexiones Externas deberá exponer:

```text
status()
test(target)
pull(target, options)
push(target, options)
syncQueue(options)
retry(target, options)
pause(reason)
resume()
usage(target)
```

Los nombres definitivos se establecerán al revisar los contratos existentes en el bloque 2 y el bloque 3. No se duplicarán funciones que ya sean correctas.

## Interfaz aprobada

```text
Menú principal
└── Centro de datos
    ├── Barra superior
    │   ├── período activo
    │   ├── estado general
    │   └── actualizar
    └── Menú lateral
        ├── Resumen
        ├── Base Local
        └── Conexiones Externas
```

No se creará una segunda aplicación ni una ventana independiente. En pantallas pequeñas, el menú lateral funcionará como panel plegable.

## Orden de migración

1. Bloque 2: organizar Base Local y conexiones internas con pantallas.
2. Bloque 3: extraer proveedores y motor de sincronización externa.
3. Bloque 4: integrar la interfaz final, conservar compatibilidad y ejecutar pruebas completas.

## Criterios de finalización del bloque 1

- arquitectura aprobada y documentada;
- límites de responsabilidad definidos;
- inventario inicial clasificado;
- estructura destino documentada;
- contrato preliminar definido;
- ninguna modificación funcional realizada;
- rama independiente preparada para continuar el refactor.

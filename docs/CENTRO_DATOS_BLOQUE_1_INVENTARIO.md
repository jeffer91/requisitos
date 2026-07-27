# Centro de datos — Inventario técnico definitivo del bloque 1

## Estado

Este documento completa el inventario previo a la reorganización. No mueve archivos, no cambia rutas y no modifica el comportamiento de la aplicación.

## Fuentes revisadas

El inventario se construyó a partir de:

- el orden real de carga de `BDLocal/bl2.html`;
- el registro oficial de pantallas `BDLocal/conexiones/cone.registry.js` y `cone.screen-map.js`;
- las verificaciones obligatorias de `scripts/verify-bdlocal.js`;
- los comandos de prueba de `package.json`;
- el registro del menú `Maqueta/maq-modulos-registry.js`.

## 1. Núcleo que permanece en Base Local

### Base de datos y configuración local

```text
BDLocal/bl2.config.js
BDLocal/bl2.config.v2.js
BDLocal/bl2.config.v3.js
BDLocal/bl2.db.js
```

Responsabilidad: IndexedDB, stores, índices, versiones y configuración del modelo local.

### Reglas

```text
BDLocal/rules/bdl.rules.index.js
BDLocal/rules/bdl.rules.persona.js
BDLocal/rules/bdl.rules.periodo.js
BDLocal/rules/bdl.rules.requisitos.js
BDLocal/rules/bdl.rules.notas.js
BDLocal/rules/bdl.rules.matricula.js
BDLocal/rules/bdl.rules.duplicados.js
BDLocal/rules/bdl.rules.errors.js
BDLocal/rules/bdl.rules.retirados.js
BDLocal/rules/bdl.rules.sync.js
BDLocal/rules/bdl.rules.pipeline.js
BDLocal/rules/bdl.rules.evaluaciones-titulacion.js
```

### Repositorios

```text
BDLocal/repositories/bdl.repo.index.js
BDLocal/repositories/bdl.repo.logs.js
BDLocal/repositories/bdl.repo.periodos.js
BDLocal/repositories/bdl.repo.personas.js
BDLocal/repositories/bdl.repo.matriculas.js
BDLocal/repositories/bdl.repo.requisitos.js
BDLocal/repositories/bdl.repo.notas.js
BDLocal/repositories/bdl.repo.contactos.js
BDLocal/repositories/bdl.repo.cambios.js
BDLocal/repositories/bdl.repo.backups.js
BDLocal/repositories/bdl.repo.estudiantes.js
BDLocal/repositories/bdl.repo.importaciones.js
BDLocal/repositories/bdl.repo.evaluaciones-titulacion.js
BDLocal/repositories/bdl.repo.sync-estado.js
BDLocal/repositories/bdl.repo.conflictos.js
```

`cambios_pendientes`, `sync_estado` y conflictos continúan almacenados y administrados por Base Local.

### Servicios y vistas

```text
BDLocal/services/bdl.service.index.js
BDLocal/services/bdl.service.periodos.js
BDLocal/services/bdl.service.estudiantes.js
BDLocal/services/bdl.service.ficha.js
BDLocal/services/bdl.service.tabla.js
BDLocal/services/bdl.service.stats.js
BDLocal/services/bdl.service.reportes.js
BDLocal/services/bdl.service.coordi.js
BDLocal/services/bdl.service.defensas.js
BDLocal/services/bdl.service.ncomplex.js
BDLocal/views/bdl.view.index.js
```

### Migraciones, mantenimiento y respaldo local

```text
BDLocal/migrations/bdl.migration.index.js
BDLocal/migrations/bdl.migration.v2.schema.js
BDLocal/migrations/bdl.migration.legacy-v2.js
BDLocal/migrations/bdl.migration.v3.ncomplex.js
BDLocal/maintenance/bdl.legacy.cleanup.js
BDLocal/maintenance/bdl.local.identity-repair.js
BDLocal/bl2.backup.js
BDLocal/bl2.backup.v2.js
BDLocal/bl2.import.js
BDLocal/bl2.raw-view.js
```

Los módulos de mantenimiento que nombren Firebase deberán dividirse: la reparación de identidad local queda en Base Local y la operación remota pasa a Conexiones Externas.

### Núcleo, compatibilidad y puentes locales

```text
BDLocal/bl2.core.js
BDLocal/bl2.compat.js
BDLocal/patches/bdl.v2.mirror.js
BDLocal/patches/bdl.changes.outbox-bridge.js
BDLocal/sync/bdl.sync.outbox.js
BDLocal/adapters/bdl.divisiones.service.js
BDLocal/adapters/bdl.divisiones.fast-cache.js
BDLocal/adapters/bdl.screen-deps.js
```

`bdl.sync.outbox.js` permanece local: consulta y actualiza la cola, pero no debe realizar llamadas de red.

## 2. Conexiones internas con pantallas

La carpeta actual `BDLocal/conexiones/` no representa internet. Representa la comunicación entre cada pantalla y Base Local.

### Infraestructura común

```text
BDLocal/conexiones/cone.contract.js
BDLocal/conexiones/cone.registry.js
BDLocal/conexiones/cone.screen-map.js
BDLocal/conexiones/cone.utils.js
BDLocal/conexiones/cone.index.js
BDLocal/conexiones/cone.client.js
BDLocal/conexiones/cone.monitor.js
```

### Pantallas activas y conector exclusivo

```text
Carga          → cone.carga.js
Base Local     → cone.baselocal.js
Tabla          → cone.tabla.js
Ficha          → cone.ficha.js
Estadísticas   → cone.stats.js
Coordinación   → cone.coordi.js
Global         → cone.global.js
Reportes       → cone.reportes.js
Defensas       → cone.defart.js
Ncomplex       → cone.ncomplex.js + cone.ncomplex.api.js
Cr-def         → cone.crdef.js
InPVC          → cone.inpvc.js
```

`cone.defensas.js` permanece únicamente como compatibilidad legacy deshabilitada.

### Destino previsto

En el bloque 2 estos archivos se organizarán conceptualmente bajo:

```text
BDLocal/pantallas/
```

Las rutas antiguas se mantendrán temporalmente como fachadas o cargadores de compatibilidad. No se cambiarán simultáneamente todas las pantallas.

## 3. Componentes que pasan a Conexiones Externas

### Motor remoto

```text
BDLocal/sync/bdl.sync.orchestrator.js
BDLocal/sync/bdl.sync.index.js
BDLocal/sync/bdl.sync.ui-bridge.js
BDLocal/sync/targets/bdl.sync.targets.index.js
BDLocal/sync/targets/bdl.sync.target.firebase.js
BDLocal/sync/bdl.firebase.telegram-pull.js
```

### Firebase

```text
BDLocal/firebase/
BDLocal/maintenance/bdl.firebase.identity-repair.js
firebase-config.js
firestore.indexes.json
```

La carpeta `BDLocal/firebase/` se trasladará por etapas a:

```text
ConexionesExternas/providers/firebase/
```

### Google Sheets

```text
BDLocal/bl2.google-push.guard.js
js/bdlocal-config/bdlocal-google-bridge.js
integraciones/google-apps-script/
AppsScript/REQUISITOS_BDLOCAL_SYNC_PULL_READY.js
```

Destino previsto:

```text
ConexionesExternas/providers/google-sheets/
```

### Supabase

```text
supabase/
```

Destino lógico:

```text
ConexionesExternas/providers/supabase/
```

Los archivos de infraestructura de Supabase pueden conservar su ubicación física si la herramienta de despliegue lo exige; la lógica de la aplicación sí quedará encapsulada por el proveedor.

### Configuración, cuotas y estado remoto

```text
js/bdlocal-config/bdlocal-config.store.js
js/bdlocal-config/bdlocal-config.ui.js
js/bdlocal-config/bdlocal-sync.manager.js
js/bdlocal-config/bdlocal-sync-fixups.js
```

Estos módulos mezclan configuración local y remota. Se dividirán en:

```text
BDLocal/config/
ConexionesExternas/config/
ConexionesExternas/usage/
```

## 4. Archivos que obligatoriamente deben dividirse

| Archivo | Parte que queda local | Parte que pasa a conexiones externas |
|---|---|---|
| `BDLocal/bl2.html` | tablas, pantallas, consulta, respaldos, mantenimiento y diagnóstico local | Firebase, Supabase, Google Sheets, cola operativa, conflictos y cuotas |
| `BDLocal/bl2.css` | estilos generales y Base Local | estilos de proveedores y sincronización |
| `BDLocal/bl2.app.js` | estado, período y acciones locales | acciones y estados remotos |
| `BDLocal/bl2.sync.js` | fachada de compatibilidad y entrega a la cola | delegación al motor externo |
| `BDLocal/diagnostics/bdl.diagnostics.general.js` | módulos, tablas, índices, repositorios, servicios y pantallas | proveedores, reintentos, cuota y estado remoto |
| `js/bdlocal-config/bdlocal-config.store.js` | preferencias locales | credenciales, cuota y consumo por proveedor |
| `docs/MANUAL_TECNICO_BDLOCAL_SYNC.md` | manual de IndexedDB y operación local | manual de sincronización externa |

## 5. Referencias que deben conservar compatibilidad

### Arranque del Centro de datos

`BDLocal/bl2.html` carga mediante rutas directas reglas, repositorios, servicios, conectores internos, sincronización y diagnósticos. El traslado deberá usar fachadas temporales o actualizar el cargador por fases.

### Menú principal

`Maqueta/maq-modulos-registry.js` abre actualmente:

```text
../BDLocal/bl2.html
```

La ruta se conservará durante los bloques 2 y 3. En el bloque 4 podrá cambiar el nombre visible de `BL` a `Centro de datos` sin romper enlaces internos.

### Pruebas

Los siguientes grupos contienen rutas exactas que deberán actualizarse junto con cada movimiento:

```text
scripts/verify-bdlocal.js
scripts/verify-screen-connections.js
scripts/verify-firebase-*.js
scripts/verify-outbox-target-policy.js
scripts/verify-external-operation-guard.js
scripts/audit-repository.js
package.json
.github/workflows/bdlocal-integrity.yml
```

No se aceptará un traslado si las verificaciones dejan de encontrar los contratos anteriores sin existir una nueva comprobación equivalente.

## 6. Orden definitivo de traslado

### Bloque 2 — Base Local

1. Crear la organización interna nueva.
2. Separar los conectores de pantallas del concepto de conexiones remotas.
3. Mantener fachadas en `BDLocal/conexiones/`.
4. Verificar todas las pantallas y el funcionamiento sin internet.

### Bloque 3 — Conexiones Externas

1. Crear contratos de acceso a la cola y persistencia de resultados.
2. Extraer Google Sheets, Supabase y Firebase por proveedor.
3. Extraer orquestador, reintentos, conflictos y cuota.
4. Mantener fachadas en las rutas antiguas mientras continúen referenciadas.

### Bloque 4 — Interfaz y cierre

1. Convertir `BL` en `Centro de datos` en el menú.
2. Construir el menú lateral definitivo.
3. Separar visualmente Base Local y Conexiones Externas.
4. Actualizar pruebas y documentación.
5. Eliminar fachadas únicamente después de comprobar cero referencias activas.

## 7. Riesgos controlados

- rutas directas cargadas desde HTML;
- conectores cargados también desde pantallas e iframes;
- pruebas que certifican nombres y ubicaciones exactas;
- configuración local que contiene credenciales remotas;
- diagnósticos que mezclan salud local con estado externo;
- módulos legacy todavía utilizados como fallback;
- archivos de infraestructura que no deben trasladarse físicamente aunque cambie su propiedad lógica.

## 8. Criterio de cierre del bloque 1

El bloque 1 queda completo porque existen:

- arquitectura aprobada;
- límites entre módulos;
- inventario por responsabilidad;
- mapa de pantallas y conectores;
- lista de archivos que permanecen, pasan o se dividen;
- dependencias de menú, arranque y pruebas;
- orden de traslado y estrategia de compatibilidad;
- cero cambios funcionales.

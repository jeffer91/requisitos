# Revisión técnica Firebase V2 — 23 de julio de 2026

## Alcance

Esta revisión corrige los riesgos críticos detectados antes de conectar la nueva arquitectura a datos reales. No realiza migraciones, no elimina colecciones antiguas y no inicia sincronizaciones automáticamente.

## Correcciones aplicadas

### 1. Paginación segura

Las consultas utilizan un cursor compuesto formado por:

- `updatedAt`
- `documentId`

Esto evita perder documentos cuando varios registros comparten la misma fecha de actualización.

### 2. Filtro por período

Las colecciones académicas se consultan por `periodoId`:

- `matriculas`
- `requisitos`
- `notas`

Los catálogos y estudiantes se descargan globalmente.

### 3. Hash funcional estable

`dataHash` ya no incorpora:

- `createdAt`
- `updatedAt`
- `version`
- metadatos internos de Firebase o sincronización

Solo cambia cuando cambia información funcional.

### 4. Protección de cambios pendientes

Antes de aplicar un documento descargado, el motor consulta `cambios_pendientes`.

- Si Firebase conserva la versión base, se protege la edición local.
- Si Firebase cambió desde la última descarga, se registra un conflicto.
- Si no se puede leer la cola, la descarga se detiene.

### 5. Conflictos persistentes

Los conflictos se registran mediante `BDLRepoConflictos`, con:

- entidad y documento;
- datos locales;
- datos remotos;
- versión esperada;
- cambios pendientes relacionados;
- estado abierto o resuelto.

### 6. Escritura atómica

Las subidas utilizan comprobación de versión, hash y fecha base antes de reemplazar un documento remoto.

Un documento remoto modificado por otro equipo no se sobrescribe silenciosamente.

### 7. Resultados parciales

Cuando un lote contiene éxitos y conflictos:

- se confirman únicamente los `processedIds` exitosos;
- los conflictos permanecen pendientes.

Cuando todo el lote está conflictuado:

- el resultado no se declara exitoso;
- no se confirma ningún cambio;
- no se incrementan intentos por error técnico.

### 8. Borrados y reconciliación

La descarga ahora:

- retira del caché los documentos con `eliminado: true`;
- elimina requisitos locales que ya no aparecen en el mapa remoto;
- acepta un mapa `valores: {}` como eliminación de todos los requisitos del estudiante en ese período.

### 9. Catálogos

`periodos` y `carreras` se validan con su propia identidad. Ya no requieren cédula.

`historial` e `importaciones` utilizan identificadores deterministas para evitar duplicados por reintentos.

### 10. Estado y cuota

`sync_estado` guarda de forma estricta:

- fecha del cursor;
- ID del último documento;
- consultas;
- documentos leídos;
- documentos escritos;
- conflictos.

Los errores de persistencia del cursor ya no se ocultan.

### 11. Índices Firestore

Se añadió `firestore.indexes.json` para las consultas de:

- `matriculas`
- `requisitos`
- `notas`

Cada índice utiliza `periodoId`, `updatedAt` y `__name__` en orden ascendente.

## Pruebas añadidas

- hash funcional estable;
- cursor compuesto y empate de fechas;
- filtro por período;
- conflicto de versión remota;
- lote parcialmente conflictuado;
- lote totalmente conflictuado;
- reconciliación y borrado;
- presencia de índices Firestore.

## Prueba ejecutada durante la revisión

La simulación del destino Firebase confirmó:

1. Un lote con un éxito y un conflicto retorna solo el ID exitoso.
2. Un lote con todos los documentos en conflicto retorna cero IDs procesados.
3. Los conflictos quedan registrados.
4. El lote totalmente conflictuado queda diferido sin sumar intentos.

## Estado actual

La base técnica de sincronización diferencial está corregida, pero aún no debe considerarse aprobada para migración real hasta completar:

1. ejecución de la suite completa en GitHub Actions;
2. prueba dentro de Electron con IndexedDB real;
3. despliegue de índices Firestore;
4. prueba controlada contra colecciones V2 vacías;
5. prueba con dos equipos y pérdida de conexión;
6. respaldo de las colecciones antiguas.

## Restricciones vigentes

- sincronización solo manual;
- máximo 25 cambios locales por lote;
- no se borran colecciones antiguas;
- no se migran datos reales;
- las pantallas todavía no se conectan directamente a Firebase V2.

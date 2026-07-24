# Arquitectura Firebase principal — App Requisitos

## Estado general

La migración se realizará directamente en `main`, por bloques pequeños y verificables. Ninguna colección antigua se eliminará hasta completar la migración, comparar cantidades y validar las pantallas.

Estado actual: **Bloque 1 en proceso / Bloque 2 técnico completo / Bloque 4 avanzado / Bloque 5 iniciado**.

## Modelo oficial

| Colección Firebase | ID del documento | Responsabilidad |
|---|---|---|
| `estudiantes` | `cedula` | Datos personales, contacto, Telegram, sede y carrera actual. |
| `matriculas` | `periodoId__cedula` | Carrera, división, sede, modalidad y estado del estudiante en un período. |
| `requisitos` | `periodoId__cedula` | Todos los requisitos del estudiante en un período. |
| `notas` | `periodoId__cedula` | Notas y resultados de titulación en un período. |
| `periodos` | `periodoId` | Catálogo oficial de períodos. |
| `carreras` | `codigoCarrera` | Catálogo oficial de carreras. |
| `historial` | Automático | Auditoría de cambios importantes. |
| `importaciones` | Automático | Registro y resultado de cada archivo cargado. |

## Identidades

La app utiliza dos representaciones intencionales:

- IndexedDB: `cedula__periodoId`.
- Firebase: `periodoId__cedula`.

El adaptador de sincronización transforma una en otra. Las pantallas no deben formar IDs remotos por su cuenta.

## Conversión entre Firebase e IndexedDB

| Firebase | IndexedDB |
|---|---|
| `estudiantes` | `personas` |
| `matriculas` | `matriculas_periodo` |
| `requisitos` | `requisitos_estudiante`, una fila por requisito |
| `notas` | `notas_titulacion` |
| `periodos` | `periodos` |
| `carreras` | `cache_views`, como catálogo local |
| `historial` | `logs` |
| `importaciones` | `importaciones` |

Las filas provenientes de Firebase incluyen `_skipOutbox: true`, para que una descarga no vuelva a crear un cambio pendiente y no produzca ciclos de sincronización.

## Repositorio y sincronización central

La app dispone ahora de una única puerta técnica para Firebase V2. Esta capa:

- resuelve los nombres de las ocho colecciones;
- valida antes de escribir;
- admite lectura completa e incremental por `updatedAt`;
- reconstruye documentos completos desde IndexedDB;
- separa un cambio general en `estudiantes`, `matriculas`, `requisitos` y `notas`;
- compara `dataHash` antes de escribir;
- procesa únicamente `cambios_pendientes` confirmados;
- guarda el cursor de cada colección en `sync_estado`;
- prepara borrado lógico;
- no realiza operaciones automáticamente al cargarse.

La subida sigue pasando por `BDLSyncV2` y su orquestador manual. No se creó una segunda cola ni un sincronizador paralelo.

## Flujo final

```text
Firebase
  fuente oficial
      ↓ documentos con updatedAt posterior al cursor
IndexedDB
  caché y trabajo rápido
      ↓ modificaciones locales
cambios_pendientes
      ↓ reconstrucción + comparación dataHash
Firebase
```

Google Sheets queda únicamente para exportaciones y reportes externos.

## Período general

Las pantallas operativas compartirán el mismo período activo:

- Carga
- Base Local
- Tabla
- Ficha
- Estadísticas
- Coordinación
- Reportes
- Defensas
- Ncomplex
- Cr-def
- InPVC

`Global` queda fuera de este control porque compara varios períodos mediante filtros Desde/Hasta.

## Bloques de implementación

### Bloque 1. Línea base y protección

Estado: **EN PROCESO**.

- [x] Identificar las 12 pantallas activas.
- [x] Confirmar que las pantallas trabajan mediante conectores.
- [x] Mantener la migración como no destructiva.
- [x] Agregar pruebas del contrato, identidades, validación, mapeo, repositorio y motor diferencial.
- [ ] Confirmar la suite completa en GitHub Actions y en el equipo con la aplicación instalada.
- [ ] Exportar respaldo local antes de mover datos.
- [ ] Exportar o respaldar las colecciones Firebase actuales.

### Bloque 2. Modelo e identificadores

Estado: **TÉCNICAMENTE COMPLETO; PENDIENTE VALIDACIÓN CON DATOS REALES**.

- [x] Definir las ocho colecciones oficiales.
- [x] Definir IDs locales y remotos.
- [x] Definir qué campos pertenecen a cada colección.
- [x] Crear el adaptador de identidad local ↔ Firebase.
- [x] Crear el mapeador local → Firebase.
- [x] Crear el adaptador Firebase → tablas locales.
- [x] Validar documentos incompletos, IDs incorrectos, tipos y campos desconocidos.
- [x] Integrar los mapeadores con el repositorio central.
- [x] Integrar `cambios_pendientes` y `sync_estado`.

### Bloque 3. Período general

Estado: **BASE PARCIAL EXISTENTE; VALIDACIÓN PANTALLA POR PANTALLA PENDIENTE**.

- [x] Servicio compartido de período.
- [x] Persistencia y comunicación entre ventanas.
- [x] Exclusión de Global.
- [ ] Conectar explícitamente cada selector operativo.
- [ ] Probar cambio desde cada pantalla.
- [ ] Evitar cambios dobles y ciclos de eventos.

### Bloque 4. Repositorios Firebase

Estado: **AVANZADO**.

- [x] Crear un repositorio central para las ocho colecciones.
- [x] Validar escrituras individuales y por lotes.
- [x] Preparar lecturas completas e incrementales por `updatedAt`.
- [x] Preparar conversión Firebase → IndexedDB.
- [x] Preparar borrado lógico.
- [x] Conectar el repositorio con la cola local.
- [x] Guardar el estado de la última descarga por colección.
- [ ] Bloquear y retirar accesos directos desde pantallas.
- [ ] Probar repositorios contra un entorno Firebase de prueba.

### Bloque 5. Sincronización por diferencias

Estado: **INICIADO; MOTOR MANUAL IMPLEMENTADO, PRUEBAS REALES PENDIENTES**.

- [x] Preparar primera descarga global manual.
- [x] Preparar descargas posteriores por `updatedAt`.
- [x] Preparar subida exclusiva de `cambios_pendientes`.
- [x] Comparar mediante `dataHash`.
- [x] Mantener límite de 25 cambios locales por subida.
- [x] Evitar ciclos con `_skipOutbox`.
- [x] Registrar cursores, éxitos y errores en `sync_estado`.
- [ ] Probar descarga inicial con las nuevas colecciones reales.
- [ ] Probar más de 1000 documentos y paginación.
- [ ] Probar pérdida y recuperación de internet.
- [ ] Implementar y probar resolución de conflictos entre dos equipos.

### Bloque 6. Carga y Centro BL

Estado: **PENDIENTE**.

- [ ] Separar Excel en estudiante, matrícula, requisitos y notas.
- [ ] Detectar nuevos, modificados, iguales y retirados.
- [ ] Registrar importaciones.
- [ ] Mostrar sincronización, cuota, conflictos y errores en BL.

### Bloque 7. Tabla, Ficha y Coordinación

Estado: **PENDIENTE**.

- [ ] Adaptar Tabla al paquete nuevo.
- [ ] Separar las escrituras de Ficha por entidad.
- [ ] Crear historial y outbox por cada cambio.
- [ ] Validar filtros y comunicaciones de Coordinación.

### Bloque 8. Estadísticas, Global y Reportes

Estado: **PENDIENTE**.

- [ ] Stats con período general y sin Firebase directo.
- [ ] Global independiente.
- [ ] Reportes con matrículas, requisitos y notas.
- [ ] Cálculos desde caché local.

### Bloque 9. Defart, Ncomplex, Cr-def e InPVC

Estado: **PENDIENTE**.

- [ ] Unificar escritura Firebase en `notas`.
- [ ] Mantener adaptadores especializados locales.
- [ ] Validar notas ordinarias, supletorias, artículo y defensa.
- [ ] Mantener Cr-def e InPVC como solo lectura.

### Bloque 10. Migración y cierre

Estado: **PENDIENTE**.

- [ ] Migrar documentos antiguos.
- [ ] Comparar totales y muestras.
- [ ] Probar las 12 pantallas.
- [ ] Probar dos equipos y modo sin internet.
- [ ] Activar nuevas colecciones como destino oficial.
- [ ] Eliminar colecciones antiguas únicamente después de aprobación.

## Regla de avance

Un bloque se considera terminado cuando:

1. El código está integrado.
2. Sus pruebas automáticas pasan.
3. Las pantallas relacionadas se probaron manualmente.
4. No existe pérdida de datos ni duplicación.
5. El estado se actualiza en este documento.

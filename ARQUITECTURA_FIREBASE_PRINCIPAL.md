# Arquitectura Firebase principal — App Requisitos

## Estado general

La migración se realizará directamente en `main`, por bloques pequeños y verificables. Ninguna colección antigua se eliminará hasta completar la migración, comparar cantidades y validar las pantallas.

Estado actual: **Bloque 1 en proceso / Bloque 2 casi completo**.

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

## Flujo final

```text
Firebase
  fuente oficial
      ↓ cambios nuevos
IndexedDB
  caché y trabajo rápido
      ↓ modificaciones locales
cambios_pendientes
      ↓ documentos diferentes
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
- [x] Agregar pruebas ejecutables del contrato, identidades, validación y mapeo Firebase.
- [ ] Confirmar el resultado de la suite completa en GitHub Actions y en el equipo con la aplicación instalada.
- [ ] Exportar respaldo local antes de mover datos.
- [ ] Exportar o respaldar las colecciones Firebase actuales.

### Bloque 2. Modelo e identificadores

Estado: **CASI COMPLETO; FALTA INTEGRACIÓN CON REPOSITORIOS**.

- [x] Definir las ocho colecciones oficiales.
- [x] Definir IDs locales y remotos.
- [x] Definir qué campos pertenecen a cada colección.
- [x] Crear el adaptador de identidad local ↔ Firebase.
- [x] Crear el mapeador local → estudiante, matrícula, requisitos y notas.
- [x] Crear el adaptador Firebase → tablas locales.
- [x] Validar documentos incompletos, IDs incorrectos, tipos y campos desconocidos.
- [ ] Integrar los mapeadores con la cola y los repositorios Firebase.

### Bloque 3. Período general

Estado: **BASE PARCIAL EXISTENTE; VALIDACIÓN PANTALLA POR PANTALLA PENDIENTE**.

- [x] Servicio compartido de período.
- [x] Persistencia y comunicación entre ventanas.
- [x] Exclusión de Global.
- [ ] Conectar explícitamente cada selector operativo.
- [ ] Probar cambio desde cada pantalla.
- [ ] Evitar cambios dobles y ciclos de eventos.

### Bloque 4. Repositorios Firebase

Estado: **PENDIENTE**.

- [ ] Repositorio `estudiantes`.
- [ ] Repositorio `matriculas`.
- [ ] Repositorio `requisitos`.
- [ ] Repositorio `notas`.
- [ ] Repositorios de catálogos, historial e importaciones.
- [ ] Bloquear el acceso directo desde pantallas.

### Bloque 5. Sincronización por diferencias

Estado: **PENDIENTE**.

- [ ] Primera descarga global.
- [ ] Descargas posteriores por `updatedAt`.
- [ ] Subida exclusiva de `cambios_pendientes`.
- [ ] Comparación mediante `dataHash`.
- [ ] Borrado lógico.
- [ ] Reintentos y recuperación sin internet.
- [ ] Resolución de conflictos.
- [ ] Protección contra ciclos.

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

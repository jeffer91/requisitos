# Manual técnico final - BDLocal, Defensas y sincronización

## 1. Objetivo

Este manual documenta la arquitectura final de la base local de la app **Requisitos**, especialmente la transición hacia **DB_VERSION 2**, el flujo de Defensas, la cola de sincronización y las herramientas de diagnóstico.

La regla principal es:

```text
Entrada -> Reglas -> Repositorios -> IndexedDB -> Cola -> Sync externa
```

Ninguna pantalla debe conectarse directamente a Firebase, Supabase o Google Sheets. Las pantallas leen y guardan primero en BDLocal.

## 2. Principios de arquitectura

### 2.1 BDLocal es la fuente principal

La base local IndexedDB es la fuente de trabajo principal. Google Sheets, Firebase y Supabase funcionan como destinos externos de sincronización.

### 2.2 Reglas primero, conexión después

Antes de guardar o sincronizar, los datos deben pasar por reglas de normalización, validación o transformación.

Capas esperadas:

```text
Pantalla
  -> Servicio
    -> Reglas
      -> Repositorio
        -> IndexedDB
          -> cambios_pendientes
            -> SyncManager / BDLSyncV2
```

### 2.3 No crear tablas por pantalla

No se deben crear tablas por cada pantalla. Las tablas deben representar entidades reales de negocio.

Ejemplo correcto:

```text
personas
matriculas_periodo
requisitos_estudiante
notas_titulacion
cambios_pendientes
```

Ejemplo incorrecto:

```text
tabla_defensas
tabla_stats
tabla_ficha
```

Las pantallas consultan vistas o servicios, pero no son dueñas de la estructura de datos.

## 3. Identificador oficial

El identificador principal para estudiante en período es:

```text
idEstudiantePeriodo = periodoId + "__" + cedula
```

Este identificador conecta:

```text
matriculas_periodo
requisitos_estudiante
notas_titulacion
contactos_estudiante
divisiones_estudiante
cambios_pendientes
```

## 4. Tablas principales DB_VERSION 2

### 4.1 personas

Representa a la persona única por cédula.

Clave esperada:

```text
cedula
```

Uso:

```text
nombres
apellidos
nombreCompleto
correoPersonal
telefono
updatedAt
```

### 4.2 matriculas_periodo

Representa la matrícula de una persona dentro de un período.

Clave esperada:

```text
idEstudiantePeriodo
```

Índices importantes:

```text
periodoId
cedula
periodo_cedula
periodo_carrera
periodo_division
estadoMatricula
updatedAt
```

### 4.3 requisitos_estudiante

Guarda requisitos normalizados por estudiante y período.

Campos esperados:

```text
id
idEstudiantePeriodo
periodoId
cedula
requisitoKey
estado
valor
updatedAt
```

### 4.4 notas_titulacion

Guarda notas del proceso de titulación/Defensas.

Clave esperada:

```text
idEstudiantePeriodo
```

Campos esperados:

```text
idEstudiantePeriodo
periodoId
cedula
Notart
Notdef
Notafinal
Nart
Ndef
Nfinal
estadoNota
origen
updatedAt
```

### 4.5 cambios_pendientes

Es la cola nueva de sincronización.

Campos esperados:

```text
id
tabla
tipo
registroId
accion
payload
periodoId
cedula
createdAt
updatedAt
estadoSheets
estadoFirebase
estadoSupabase
intentosSheets
intentosFirebase
intentosSupabase
nextRetryAtSheets
nextRetryAtFirebase
nextRetryAtSupabase
ultimoErrorSheets
ultimoErrorFirebase
ultimoErrorSupabase
```

Cada destino tiene su propio estado. Un error en Supabase no debe bloquear Google o Firebase.

## 5. Tablas legacy

Las tablas legacy todavía pueden existir:

```text
estudiantes
requisitos
notas
cambios
contactos
```

No deben borrarse sin auditoría. La limpieza debe hacerse solo cuando el auditor indique que DB_VERSION 2 cubre los datos legacy.

## 6. Migración legacy -> DB_VERSION 2

La migración convierte:

```text
estudiantes -> personas
estudiantes -> matriculas_periodo
estudiantes -> contactos_estudiante
estudiantes -> divisiones_estudiante
requisitos -> requisitos_estudiante
notas -> notas_titulacion
cambios -> cambios_pendientes
```

La migración no debe borrar legacy. Primero debe ejecutarse vista previa, luego migración, luego diagnóstico.

## 7. Flujo de Defensas

### 7.1 Lectura

Defensas debe leer mediante:

```text
BDLServiceDefensas.getPage({ periodoId, page, limit:25, filtros })
```

El servicio usa paginación real. La pantalla no debe cargar toda la base para luego filtrar.

Flujo correcto:

```text
Defensas
  -> DefartServiceBridge
    -> BDLServiceDefensas.getPage()
      -> BDLServiceEstudiantes.page()
        -> matriculas_periodo por índice periodoId
```

### 7.2 Guardado de notas

El guardado moderno usa:

```text
notas_titulacion
cambios_pendientes
```

Flujo correcto:

```text
Defensas guarda nota
  -> defart.save-service-bridge.js
    -> BDLServiceDefensas.saveNota()
      -> BDLRepoNotas
        -> notas_titulacion
      -> BDLRepoCambios
        -> cambios_pendientes
```

El guardado legacy queda solo como fallback.

### 7.3 Paginación

La paginación visual usa:

```text
DefartPerformance.goPage()
DefartServiceBridge.nextPage()
DefartServiceBridge.prevPage()
```

El límite aprobado es:

```text
25 registros por página
```

## 8. Sincronización V2

### 8.1 Fuente de sincronización

La sincronización V2 toma los cambios desde:

```text
cambios_pendientes
```

No debe marcar un cambio como sincronizado si el destino no confirma que lo procesó.

### 8.2 Modo seguro

Si un destino no tiene adaptador real, la cola no debe marcarse como sincronizada para ese destino.

La regla es:

```text
Sin processedIds o confirmación real -> no marcar como SINCRONIZADO
```

### 8.3 Destinos activos

Destinos implementados para `notas_titulacion`:

```text
Google Sheets
Supabase
Firebase
```

Los tres procesan solo `notas_titulacion` en esta fase. Otros tipos de cambios deben quedar pendientes hasta que exista adaptador específico.

### 8.4 Google Sheets

Adaptador:

```text
BDLocal/sync/targets/bdl.sync.targets.index.js
```

Apps Script compatible:

```text
integraciones/google-apps-script/apps-script-sync-bl2-v2.gs
```

Hoja principal:

```text
notas_titulacion
```

### 8.5 Supabase

El adaptador convierte cada nota en un registro tipo `app_records`:

```text
module_key: requisitos
table_key: notas_titulacion
record_key: idEstudiantePeriodo
payload: nota
schema_version: 2
```

### 8.6 Firebase

Adaptador separado:

```text
BDLocal/sync/targets/bdl.sync.target.firebase.js
```

Colección por defecto:

```text
NotasTitulacion
```

## 9. Reintentos y errores

La cola maneja reintentos por destino.

Tiempos progresivos:

```text
2 min
5 min
15 min
30 min
60 min
```

Si un destino falla demasiadas veces, ese destino queda bloqueado para ese cambio. Los otros destinos pueden seguir trabajando.

Estados esperados:

```text
PENDIENTE
SINCRONIZADO
ERROR
BLOQUEADO
```

## 10. Diagnósticos y herramientas visuales

### 10.1 Diagnóstico general

Archivo:

```text
BDLocal/diagnostics/bdl.diagnostics.general.js
```

Muestra:

```text
módulos cargados
repositorios
servicios
conteos
cola por destino
recomendaciones
```

### 10.2 Visualizador bruto

Archivo:

```text
BDLocal/bl2.raw-view.js
```

Permite revisar tablas de IndexedDB sin modificar datos.

Incluye:

```text
selector de tabla
límite 25/50/100/250
búsqueda dentro del JSON
copiar JSON visible
descargar JSON visible
```

### 10.3 Backup V2

Archivo:

```text
BDLocal/bl2.backup.v2.js
```

Permite:

```text
exportar V2 completo
exportar V2 por período activo
restaurar JSON V2 por merge
restaurar limpiando tablas con confirmación
```

### 10.4 Auditor legacy

Archivo:

```text
BDLocal/maintenance/bdl.legacy.cleanup.js
```

Compara legacy contra V2 y calcula:

```text
safeToClean
missingInV2
```

No borra datos automáticamente.

### 10.5 Auditor de rendimiento

Archivo:

```text
BDLocal/diagnostics/bdl.performance.audit.js
```

Mide:

```text
conteos con BL2DB.count()
índices con BL2DB.queryByIndex()
BDLServiceEstudiantes.page()
BDLServiceDefensas.getPage()
```

## 11. Smoke test local

Archivo:

```text
tools/bdl-smoke-test.ps1
```

Comando:

```powershell
cd "C:\Users\ITSQMET Desktop\requisitos"
git pull
powershell -ExecutionPolicy Bypass -File .\tools\bdl-smoke-test.ps1
```

Debe terminar con:

```text
Smoke test aprobado. Ahora abre BL2 y ejecuta Diagnóstico general BDLocal.
```

Si falla, copiar toda la salida de PowerShell y revisarla antes de seguir.

## 12. Orden recomendado de prueba

Después de `git pull`:

```text
1. Ejecutar smoke test.
2. Abrir BL2.
3. Revisar Diagnóstico general.
4. Revisar Backup V2.
5. Revisar Visualizador bruto.
6. Revisar Limpieza legacy segura.
7. Revisar Rendimiento e índices.
8. Abrir Defensas.
9. Guardar una nota de prueba.
10. Volver a BL2 y revisar cambios_pendientes.
11. Ejecutar Sincronizar cola.
12. Confirmar Google, Supabase y Firebase.
```

## 13. Reglas de mantenimiento

### 13.1 Antes de tocar tablas

Siempre crear:

```text
Backup V2 completo
```

### 13.2 Antes de limpiar legacy

Ejecutar:

```text
Limpieza legacy segura
```

Solo continuar si:

```text
safeToClean = true
missingInV2 = 0
```

### 13.3 Antes de optimizar consultas

Ejecutar:

```text
Rendimiento e índices
```

Si un índice falla, corregir primero `bl2.db.js` y subir versión de IndexedDB si hace falta.

## 14. Estado final de los bloques

```text
Bloque 11 -> DB_VERSION 2 seguro
Bloque 12 -> migrador legacy a V2
Bloque 13 -> repositorios leen V2 primero
Bloque 14 -> servicios consultan por período
Bloque 15 -> DefArt conectado a servicio
Bloque 16 -> paginación real DefArt
Bloque 17 -> notas guardan en notas_titulacion y cambios_pendientes
Bloque 18 -> sincronización segura sin falsos sincronizados
Bloque 19 -> Google Sheets para notas_titulacion
Bloque 20 -> Supabase para notas_titulacion
Bloque 21 -> diagnóstico de cola por destino
Bloque 22 -> Firebase para notas_titulacion
Bloque 23 -> smoke test local
Bloque 24 -> Apps Script Google V2
Bloque 25 -> reintentos y errores
Bloque 26 -> visualizador bruto
Bloque 27 -> backup/restauración V2
Bloque 28 -> auditor legacy seguro
Bloque 29 -> auditor rendimiento e índices
Bloque 30 -> manual técnico final
```

## 15. Próximo ciclo recomendado

Después de probar esta fase en la app real, el siguiente ciclo no debe agregar estructura nueva. Debe enfocarse en corrección puntual según resultados:

```text
errores del smoke test
errores del diagnóstico general
errores del auditor de rendimiento
errores de guardado de Defensas
errores de sincronización externa
```

El criterio es: primero probar, luego corregir solo lo que falle.

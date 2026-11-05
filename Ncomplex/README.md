# Ncomplex — Centro de calificaciones

## Funcionamiento

El módulo ahora presenta una interfaz mínima con dos pestañas:

- **Núcleos**: carga de cuatro evaluaciones parciales, taller práctico, prueba y Total del curso de Moodle. Cada núcleo queda asociado a un período, carrera y estudiante real. La ponderación del total de Moodle **no se supone**: si difiere de la media simple se solicita revisión, y la nota no se presenta como resultado académico consolidado.
- **Examen complexivo**: conserva el motor existente de componentes teórico (40 %) y práctico (60 %), resultados ordinarios, supletorios y nota oficial. Cuando Moodle promedia las dos oportunidades, la aplicación conserva la nota oficial calculada y registra una advertencia.

La pantalla obtiene los períodos, estudiantes, carreras y requisitos del conector `ConNcomplex`. Las identidades se concilian usando correo y nombre verificados; las coincidencias ambiguas o duplicadas no se aplican automáticamente.

El panel **Ver pendientes** muestra notas por completar, requisitos no cumplidos y errores de sincronización. La antigua tabla avanzada, informe PDF y herramientas de conciliación se conservan dentro del apartado plegable **Edición avanzada, reportes y conciliación clásica**.

## Guardado y Firebase

Los registros de núcleos se guardan en una tabla IndexedDB independiente, `evaluaciones_nucleos`; una migración no destructiva crea la tabla cuando no existe. No modifica `evaluaciones_titulacion` ni `notas_titulacion`.

El archivo `Ncomplex/ncomplex.nucleos.firebase.js` prepara documentos individuales para la **nueva colección `evaluaciones_nucleos`**. No sobrescribe la colección `nucleos`, utilizada previamente por informes consolidados.

Identidad remota: `periodoId__cedula__Nnucleo`.
Identidad local: `cedula__periodoId__Nnucleo`.

Una pulsación de **Sincronizar Firebase** inicia, con confirmación, las siguientes operaciones:

1. Núcleos: publicación mediante el repositorio central Firestore con control de versiones, `dataHash` y verificación de lectura posterior.
2. Complexivo: publicación de nuevos documentos en `complexivo` únicamente si las nueve verificaciones institucionales están aprobadas; los conflictos nunca se sobrescriben automáticamente.
3. `notas`, `historial` e `importaciones`: análisis y subida mediante el Centro de Operaciones Firebase existente.

Se procesan lotes limitados a 25 registros. Cada registro de núcleo conserva el estado local: pendiente, sincronizado, error o conflicto. Una nota importada de un estudiante no habilitado se conserva como `INHABILITADO`; **no se considera oficialmente aprobada**, pero su registro provisional puede sincronizarse para auditoría.

**Importante:** el botón no garantiza que Firebase acepte los cambios. Antes de utilizar la nueva colección en producción, se deben desplegar las reglas actualizadas de `firestore.rules` y disponer de un usuario autenticado autorizado para `evaluaciones_nucleos`. El código no habilita permisos públicos para esa colección. No se ha ejecutado un despliegue de reglas ni publicado notas reales desde esta revisión.

## Inf

El conector `ConInf` permite consultar `evaluaciones_nucleos` mediante transacciones `readonly`. La sección 4.2 puede identificar las cuatro evaluaciones y utilizar el total Moodle como nota final solamente cuando el registro está conciliado y habilitado.

## Pruebas

```bash
node scripts/verify-ncomplex-center.js
node scripts/verify-ncomplex-requirements-firebase.js
```

Las pruebas utilizan identidades y calificaciones **sintéticas**. No escriben en Firebase real. También se incorporó la prueba del centro al comando `npm run test:core`.

## Archivos principales

- `ncomplex.html`, `ncomplex.center.css`, `ncomplex.center.js`: pantalla mínima.
- `ncomplex.nucleos.parser.js`: lector Moodle de núcleos.
- `ncomplex.nucleos.store.js`: tabla local separada.
- `ncomplex.nucleos.firebase.js`: subida segura de evaluaciones individuales.
- `ncomplex.parser.js`: lector tradicional del examen complexivo.
- `BDLocal/firebase/bdl.firebase.schema.v2.js`, `bdl.firebase.validator.v2.js`, `bdl.firebase.identity.js`: contrato de la nueva entidad.
- `firestore.rules`: acceso autenticado para la nueva colección.

## Control de acceso, revisión y despliegue

El centro ofrece **Conectar Firebase** con Firebase Authentication Email/Password. Es necesario que el proyecto `utet-4387a` tenga habilitado ese proveedor, que la cuenta institucional exista y que un administrador asigne mediante Firebase Admin SDK el custom claim **`ncomplex_write: true`** (o `titulacion_admin: true`). No se otorgan permisos de escritura solo por conocer una contraseña o tener una dirección institucional; el backend verifica el rol. El código del navegador no puede asignar claims.

La nueva regla de `evaluaciones_nucleos` debe desplegarse en el proyecto antes de que Firebase acepte las notas. No se despliegan reglas ni se crean usuarios automáticamente desde el repositorio. Las reglas de `complexivo` y `notas` existentes tienen otra política de acceso y requieren una revisión institucional conjunta antes de endurecerlas sin interrumpir otros módulos.

Las importaciones validan el período anunciado en Moodle cuando está escrito como OCT-MAR26 o ABR-SEP26. Si difiere del período de la ficha, se bloquea el guardado. Los registros ambiguos muestran una selección explícita de matrícula con cédula, sin asociación automática a personas equivocadas. Las correcciones conservan `historialCambios` con notas anteriores y los conflictos pueden conciliarse conservando la versión local (CAS en Firestore) o restaurando la versión remota verificada.

### Comprobaciones sin usar notas reales

```bash
node scripts/verify-ncomplex-center.js
node scripts/verify-ncomplex-center-hardening.js
node scripts/verify-ncomplex-moodle-import.js
npm run test:core
```

Las pruebas de código y sincronización usan dobles simulados de BDLocal y Firestore; **no equivalen a una prueba en producción dentro de Electron**, ni comprueban que las reglas y cuentas estén ya configuradas en Firebase.

## Solución al bloqueo del selector de períodos (noviembre 2026)

El Centro Ncomplex **consulta los períodos directamente desde `ConNcomplex.listPeriods()`**, con respaldo de lectura en la tabla `periodos`. La operación ya no depende de crear `evaluaciones_nucleos`. Al seleccionar un período, las matrículas y evaluaciones se cargan aunque la lectura de notas de núcleos produzca una advertencia.

`NcomplexNucleosStore` ya **no llama a `indexedDB.open` con una versión nueva ni ejecuta migraciones**. Para preservar la estructura y los registros académicos de instalaciones existentes:
- Si `evaluaciones_nucleos` ya existe, sigue pudiendo leerse.
- Las cargas nuevas se guardan en `settings`, con claves exclusivas `ncomplex:nucleo:<cedula>__<periodoId>__N<núcleo>` (salvo que solo exista la tabla especializada), sin sobrescribir otras configuraciones.
- `list()` combina ambos orígenes y toma la versión local más reciente de cada registro.
- `Inf/ConInf` puede leer las notas con transacciones `readonly`, incluyendo las guardadas en `settings`.
- Las notas siguen sincronizándose con la entidad remota `evaluaciones_nucleos` de Firestore. Este cambio **no altera los documentos de Firebase ni ejecuta ninguna publicación**.

Se agregaron pruebas sin datos reales:
```bash
node scripts/verify-ncomplex-bdlocal-nonblocking.js
node scripts/verify-ncomplex-period-selector.js
```

Estas pruebas simulan IndexedDB, el conector académico y la interfaz; demuestran que la creación de la tabla de núcleos no bloquea el selector. Aún se requiere probar la aplicación instalada en Electron con su base específica para confirmar el funcionamiento visual.

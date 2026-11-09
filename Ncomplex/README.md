# Ncomplex — Centro de calificaciones

## Menú Notas y colecciones de Firebase (noviembre 2026)

En el menú, **Notas** agrupa las cuatro pantallas de calificaciones. Todas suben **directo a Firebase, igual que Carga**: sin iniciar sesión y sin cola.

| Menú Notas → | Pantalla | Colección | ID del documento |
|---|---|---|---|
| Núcleos | `Ncomplex/ncomplex.html` (solo núcleos) | `notas_nucleos` | `periodoId__cedula__N1…N4` |
| Complexivo | `Complexivo/complexivo.html` (carpeta y motores propios) | `notas_complexivo` | `periodoId__cedula` |
| Artículo (antes Defensas) | `defart/defart.html` | `notas_articulo` | `periodoId__cedula` |
| Trabajo | `Trabajo/trabajo.html` | `notas_trabajo` | `periodoId__cedula` |

- **BDLocal es la autoridad.** Lo que ya está igual en Firebase (`dataHash`) no se escribe; lo nuevo o distinto se escribe usando como base de versión el remoto recién leído, y se verifica con una lectura posterior. Si otro equipo lo cambia justo en medio, queda como conflicto y se reintenta.
- **Complexivo y Trabajo trabajan solo con estudiantes habilitados.** Al elegir el período (o con el período global de la app) se lee BDLocal **una sola vez** y se arma la lista: matrícula ACTIVA con **Aprobación final**, es decir, Aprobación titulación + Aprobación complexivo/proyecto en CUMPLE. Esta regla reemplaza a la de los 9 requisitos en estas dos pantallas. `bdl.service.ncomplex.js` adjunta `_aprobacionFinal` en la misma lectura.
- **Exclusión cruzada:** quien tiene trabajo de titulación no puede tener complexivo, y al revés.
- Las dos pantallas avisan al reloj «BDLocal → pantalla lista» (`maqueta:screen-render-complete`). Notas → Núcleos usa la detección de Ncomplex.
- **Complexivo** lee uno o varios libros de Moodle pegados juntos. Las columnas se reconocen por su encabezado; «Versión 2» y «Supletorio» cuentan como supletorio. Toma el período y la carrera del título y cruza cada fila por nombre (el correo no se usa ni se guarda).
  - **La app calcula la nota y no usa los totales de Moodle**: ordinario = 40 % teórico + 60 % práctico, y supletorio igual.
  - Ordinario y supletorio **no se mezclan**: quien pierde el ordinario debe rendir los dos componentes del supletorio. Si falta uno, la nota queda incompleta y no se guarda.
  - «-» significa que no rindió; «0,00» es una nota real. Se aprueba con 7.
- **Artículo** guarda solo `notaArticulo`, `notaDefensa`, `notaFinal` y `estadoEvaluacion`, sin campos duplicados.
- **Trabajo** guarda el acta SENESCYT completa: tutor, lector, 3 vocales, 8 criterios y los 5 promedios. Fórmula: final = 60 % escrito + 40 % defensa oral. Un acta se **bloquea** si:
  - el texto copiado no cuadra con sus propios cálculos;
  - el estudiante no tiene matrícula ACTIVA en el período;
  - el código de carrera no coincide con el de la matrícula;
  - no cumple los 9 requisitos;
  - ya tiene notas de complexivo.
- El período de una nota de trabajo es el de la **matrícula**, no la fecha del acta.
- **Modalidad (`grupoInforme`)**: se toma del código de carrera (`-P-` = PRESENCIAL, `-L-` = ONLINE).
- **Requisitos**: Núcleos exige 8 (Titulación no aplica todavía); Complexivo y Trabajo exigen Aprobación final.
- Ncomplex ya no carga el examen complexivo. Si se le pega un libro de complexivo, avisa que se use Notas → Complexivo. El código anterior (`ncomplex.firebase-complexivo.js` y el modo interno) queda sin acceso desde el menú.
- Las colecciones antiguas `nucleos`, `complexivo`, `evaluaciones_nucleos` y `complexivos` quedan en solo lectura. `notas` sigue abierta para la cola general de BDLocal.
- `NcomplexFirebaseAuth` funciona en modo directo por defecto. Para volver a exigir sesión, define `window.NCOMPLEX_FIREBASE_OPEN_WRITE=false`.
- **Reglas**: se despliegan con `firebase deploy --only firestore:rules`. **Ese comando reemplaza todas las reglas activas**, así que primero hay que compararlas con las de la consola.

```bash
node scripts/verify-complexivo-moodle.js
node scripts/verify-trabajo-actas.js
node scripts/verify-defart-firebase-direct.js
node scripts/verify-ncomplex-center.js
node scripts/verify-complexivo-publish.js
```

> Las secciones siguientes describen el diseño anterior, que exigía login. Se conservan como historial.


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

## Flujo guiado inteligente (actualización)

- **Encabezado único:** Ncomplex muestra el contexto académico, las matrículas y el estado local/Firebase en una vista compacta.
- **Período y carrera:** se leen de BDLocal. Al seleccionar un período, propone la primera carrera con matrículas y el Núcleo 1. Cada núcleo conserva acceso directo para cargar fuera de orden.
- **Reconocimiento automático:** al pegar Moodle antes de escoger grupo, se reconoce primero la modalidad de carga (núcleo o complexivo), el período indicado, el nombre del núcleo, la carrera y las columnas de calificaciones. Si el curso pertenece al Núcleo 4, cambia a ese núcleo sin atribuir `Mod 13` a un número de núcleo.
- **Contexto ambiguo:** si Administración tiene más de una modalidad en el período, mantiene la carrera seleccionada cuando corresponda; de lo contrario ofrece las variantes en BDLocal para confirmación. No deduce presencialidad exclusivamente de la palabra `Matriz`.
- **Conciliación:** las filas de Moodle que no aparecen en la matrícula se muestran como pendientes. Si una misma cédula tiene dos filas, ambas quedan fuera del guardado hasta que el usuario elija explícitamente cuál corresponde. No se fusionan notas incompatibles.
- **Estados separados:** «Sin notas» describe las calificaciones; «Por verificar» indica ausencia de evidencia de requisitos; «Pendiente» señala requisitos registrados que no satisfacen la política. No se interpreta «sin registro» como «incumplimiento» confirmado.
- **Columnas flexibles:** conserva las cuatro evaluaciones, Taller, Prueba, Caso de estudio, Total Moodle y otras actividades identificadas. Las evaluaciones romanas I–IV también se reconocen. Las actividades extras no reciben pesos inventados y los resultados de Moodle se verifican.
- **Secuencia:** el panel indica el siguiente núcleo incompleto por carrera; solo se solicita grupo al guardar notas, no antes de interpretar el libro.

### Pruebas del flujo
```bash
node scripts/verify-ncomplex-smart-guided.js
node scripts/verify-ncomplex-guided-ui.js
```

Estas verificaciones emplean matrículas y notas sintéticas; la ejecución con una instalación real de Electron y la publicación de Firebase siguen siendo comprobaciones separadas.

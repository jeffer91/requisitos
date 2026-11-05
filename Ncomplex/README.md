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

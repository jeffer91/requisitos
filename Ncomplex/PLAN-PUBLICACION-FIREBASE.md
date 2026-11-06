# Plan de recuperación y garantía verificable de publicación Firebase — Ncomplex

**Estado:** diagnóstico de código completo; autorización de producción y pruebas contra `utet-4387a` pendientes.  
**Alcance:** Núcleos 1–4 y Examen Complexivo. Preservar BDLocal, no cambiar calificaciones ni sobrescribir documentos remotos.  
**Responsable técnico:** módulo Ncomplex y configuración institucional de Firebase.

## 1. Diagnóstico sustentado en el código

1. **Carga** (`Carga/carga.firebase-smart.js`) abre el SDK Firebase compatible, lee `firebase-config.js`, usa `RequisitosFirebaseRepository` y publica `Estudiante`, `matriculas`, `requisitos`, `periodos`, `carreras`, `importaciones` e `historial` mediante `writeManyChecked`. No llama a Firebase Authentication; las reglas del repositorio permiten escrituras de esas rutas sin `request.auth`.
2. **Ncomplex antiguo** (`Ncomplex/ncomplex.firebase-sync.js` y `BDLocal/firebase/bdl.firebase.operation-center.js`) usaba la ruta general `notas`, `importaciones`, `historial`; las reglas del repositorio también admiten escrituras sin Auth en `notas`. Esta es una explicación técnicamente plausible de que anteriormente «sí subía», pero debe cotejarse con los documentos históricos reales.
3. **Ncomplex actual** (`Ncomplex/ncomplex.nucleos.firebase.js`) escribe en `evaluaciones_nucleos`. Las reglas registradas exigen `request.auth != null` y el claim `ncomplex_write` o `titulacion_admin` tanto para crear/actualizar como para leer autenticado. `Ncomplex/ncomplex.center.js` bloquea antes de enviar si no hay sesión; `publishSavedRecords` y el publicador vuelven a verificar el rol. Cambiar solamente el SDK o copiar `firebaseConfig` no concede ese rol.
4. **Examen Complexivo:** la colección `complexivo` aparece abierta en las reglas del repositorio, pero su publicador (`ncomplex.firebase-complexivo.js`) también exige `requireWriter()`. Hay una inconsistencia entre autenticación del cliente y reglas.
5. **Reglas desplegadas desconocidas:** `firebase.json` referencia `firestore.rules`; no se halló un pipeline que despliegue reglas o Functions a Firebase en los workflows examinados. GitHub no prueba cuáles son las reglas activas de `utet-4387a`.
6. **Dos rutas de sincronización:** conviven el sincronizador legado por cola y el publicador de evaluaciones individuales. Requieren consolidación; no deben presentar sus recuentos como si fueran la misma colección.
7. **Elegibilidad y completitud:** el publicador de núcleos filtra estadoSync, período, ID y grupo, pero NO exige de nuevo `habilitado===true` ni `estadoCarga==='CONCILIADO'`. Podría intentar publicar filas incompletas. Definir y verificar la política académica antes del envío.
8. **Modalidad:** Firestore obliga `grupoInforme` válido (`PRESENCIAL`, `ONLINE`, `PVC`). La unificación de carrera es solo de importación: cada documento mantiene carrera y grupo reales de BDLocal.
9. **Inmutabilidad parcial:** `writeChecked` usa transacción `expected:{exists:false}` y reconoce documentos idénticos por `dataHash`; ante versión distinta evita sobrescritura desde este flujo. Pero `firestore.rules` todavía declara `allow update` para `evaluaciones_nucleos`, de modo que otros clientes autorizados podrían actualizar.
10. **Conteo UI:** `Pendientes Firebase` anteriormente acumulaba núcleos; ya se corrigió para el núcleo activo. Aun así, «pendiente local» NO equivale a «no existe en Firebase» hasta consultar la colección remota.

## 2. Objetivo técnico y académicamente seguro

Para cada matrícula ACTIVA habilitada y cada **(período, cédula, número de núcleo)**, completar el ciclo:
**Validado → Pendiente local → Enviando → Confirmado en Firebase → Verificado por lectura**.
Si el documento remoto ya existe con las mismas notas, marcar **Ya existente / idéntico** sin reescribir.
Si difiere, marcar **Conflicto: sin sobrescritura** y exigir conciliación autorizada.
No marcar 100 % completado sin comprobación remota.

## 3. Decisión de autorización: condición imprescindible

**Opción A — reparación inmediata, sin infraestructura nueva:** activar/proveer una identidad Firebase Auth institucional con claim `ncomplex_write` o `titulacion_admin` para operadores autorizados. Autenticación una sola vez (SSO institucional, cuando esté configurado, o email/contraseña existente); Firebase conserva sesión `LOCAL`. Comprobar tanto el token del usuario como la regla desplegada. **No se puede automatizar el primer acceso sin una identidad previa.**

**Opción B — experiencia sin formulario en Ncomplex, institucional y segura:** desplegar un servicio backend administrado (por ejemplo Cloud Functions 2nd gen) que reciba solo solicitudes de publicación de notas; registrar de forma controlada cada instalación/usuario autorizado; emitir y verificar credenciales de corta duración/ligadas a ese registro, con revocación y auditoría. El backend usa Firebase Admin SDK/IAM y hace cumplir él mismo TODAS las validaciones. Firebase App Check puede complementar la protección, **no sustituye la identidad/autorización**. No incluir claves de cuenta de servicio ni tokens permanentes en Electron, GitHub o archivos públicos. Requiere despliegue y provisión institucional.

**Elección para puesta en marcha:** validar A primero como diagnóstico y desbloqueo controlado; ejecutar B únicamente si se exige cero pasos de acceso en la interfaz. No trasladar las notas de alumnos a una colección con escritura pública para imitar a Carga.

## 4. Flujo único Ncomplex propuesto

1. **Preflight**: comprobar `projectId=utet-4387a`, SDK, modo conexión, identidad/rol autorizado, reglas activas, disponibilidad de lectura de la colección objetivo, período y catálogo.
2. **Construcción del lote**: tomar BDLocal solo del período, carrera base y núcleo activos; identificar por cédula + período + núcleo; deduplicar por matrícula real. Excluir retirados, sin habilitación documentada, sin modalidad verificable, filas duplicadas no conciliadas y notas no publicables.
3. **Regla de elegibilidad única**: documentar explícitamente el estándar académico de núcleos frente a examen (la política `ncomplex.nucleos.policy.js` menciona ocho requisitos para núcleos y nueve para complexivo, pero la pantalla actual exige nueve para ambos). No cambiarlo silenciosamente: el criterio aprobado debe ser el mismo en listado, guardado y publicación.
4. **Validación de payload**: cuatro evaluaciones, actividad/taller, prueba, total Moodle, `estadoCarga`, modalidad, cédula normalizada, `periodoId`, `dataHash` estable; controlar la ponderación Moodle sin recalcular arbitrariamente. Separar huella de notas de metadatos de auditoría para evitar falsos conflictos.
5. **Consulta previa y protección**: generar ID remoto `periodoId__cedula__Nnucleo`; obtener documento y clasificar `nuevo`, `idéntico`, `diferente`, `no verificable`. No escribir si no se puede comprobar autorización/condiciones.
6. **Escritura idempotente**: transacción por documento nuevo con precondición de inexistencia. Nunca sobrescribir una nota distinta; crear un expediente formal de corrección, con responsable, motivo y versión, cuando se requiera.
7. **Rendimiento**: concurrencia acotada, por ejemplo cuatro operaciones paralelas; reintentos solo para fallas transitorias con espera incremental; nunca reintentar sobre un conflicto documental como si fuera error de red.
8. **Confirmación**: leer de Firebase lo enviado y comparar ID y huella de calificaciones. Marcar `SINCRONIZADO` en BDLocal solo después de confirmación remota; persistir fecha, identidad de publicación y estado de cada fila.
9. **Reanudación segura**: ante cierre de aplicación o red inestable conservar cola local; reintentar solo pendientes, idempotentemente, sin necesitar recargar Moodle.
10. **Panel de resultados**: `Listas para subir`, `Subidas y verificadas`, `Ya existían idénticas`, `Conflictos`, `Rechazadas por requisitos/modalidad`, `Errores de permisos/red` y `No verificadas`, cada una por período/carrera/núcleo; descarga de bitácora sin exponer más datos personales de los necesarios.

## 5. Pruebas de aceptación obligatorias

- [ ] Contrastar reglas **desplegadas en Firebase Console** con `firestore.rules`; identificar colección y permisos efectivos.
- [ ] Confirmar que el operador autorizado puede leer la colección de destino y crear un documento de prueba en un **entorno de pruebas**. La configuración pública SDK no sustituye esta prueba.
- [ ] Ejecutar pruebas de reglas/emulador: sin autenticación, usuario con y sin claim, notas válidas/inválidas; preservar privacidad.
- [ ] Primera publicación de una nota de prueba: crear exactamente un documento, comprobar contenido completo y lectura posterior.
- [ ] Repetir publicación idéntica: 0 sobrescrituras, estado `idéntica`.
- [ ] Repetir con nota diferente: 0 sobrescrituras, conflicto registrado.
- [ ] Interrumpir conectividad en mitad de lote y reanudar sin duplicados.
- [ ] Validar mezcla Presencial/Online/PVC, nombres duplicados, matrícula retirada y documento sin modalidad.
- [ ] Validar notas incompletas: no publicarlas como definitivas.
- [ ] Probar núcleo 1 y núcleo 2 de la misma cédula: documentos distintos y recuentos independientes.
- [ ] Probar Examen Complexivo ordinario/supletorio por separado, según su regla académica vigente.
- [ ] Verificar el inventario remoto después de publicar y su bitácora por cédula; las pruebas simuladas no sustituyen esto.
- [ ] Respaldar las calificaciones locales y confirmar un primer lote real reducido autorizado, antes del lote completo.

## 6. Política de despliegue

**No desplegar `firestore.rules` de GitHub sin comparar primero con las reglas productivas:** la operación reemplaza el conjunto de reglas del proyecto. No relajar `evaluaciones_nucleos` ni abrir sus lecturas públicamente. Preparar entorno de pruebas, migración de permisos y mecanismo de correcciones académicas por separado. En producción, registrar quién envió, cuándo, qué hash se verificó y la ruta de cada documento.

## 7. Qué no está demostrado aún

- Las reglas efectivamente desplegadas en `utet-4387a`.
- La existencia de una cuenta Firebase Auth institucional con los claims necesarios.
- La disponibilidad de un backend institucional de publicación y credenciales de dispositivo.
- El número exacto de documentos ya publicados y su coincidencia con las notas de BDLocal.
- El resultado de publicar un lote de notas reales en ese proyecto.

**Criterio para declarar «resuelto»:** cada nota académicamente publicable tiene un documento remoto leído y verificado; las restantes aparecen con causa inequívoca, sin pérdidas ni sobrescrituras.

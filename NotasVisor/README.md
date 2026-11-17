# Notas → Núcleos · Complexivo · Trabajo · Artículo

Las cuatro pantallas comparten `visor.html?tipo=nucleos|complexivo|trabajo|articulo`, el período global, filtros por carrera y estado, búsqueda, agrupación por carrera, detalle por estudiante y exportación CSV.

## Consulta

- Núcleos, Complexivo y Trabajo de titulación **siguen siendo de solo lectura**.
- Artículo académico consulta `notas_articulo` en Firebase, con una sola consulta por período; los nombres y estudiantes matriculados proceden de la base local.
- Las calificaciones calculadas se muestran en cursiva morada; el detalle incluye tribunal y acta, si existen.
- `Notas → Cargado de notas` continúa siendo el módulo para importar las notas oficiales.

## Corrección y registro manual de Artículo académico

1. Selecciona el período. Si hay estudiantes con notas o componentes vacíos, se abre automáticamente un **popup de pendientes** una vez por período. Puedes reabrirlo con el botón **Sin nota: N**.
2. El popup muestra alumnos de Artículo con calificaciones incompletas y alumnos matriculados que tienen la modalidad de Artículo declarada pero aún no tienen un documento en `notas_articulo`. Selecciona **Completar notas** o **Agregar notas**. Si la modalidad del alumno no está identificada, activa la búsqueda ampliada, busca por nombre/cédula y confirma expresamente que corresponde a Artículo.
3. Para corregir estudiantes con notas, pulsa **Editar** o **Completar** en su fila.
4. Ingresa o corrige Tutor, Lector, Escrito, Práctica, Defensa, Oral o Final (0–10, máximo 2 decimales). Puedes guardar solo una nota y completar las demás posteriormente; **0,00 es una nota válida y no se considera ausente**.
5. Al modificar Tutor o Lector se actualiza Escrito; al modificar Práctica o Defensa se actualiza Oral; al modificar componentes se recalcula Final según la fórmula **70/30** o **50/50** del registro. Es posible modificar un agregado o la nota final directamente: si no coincide con la fórmula aparece una advertencia.
6. Revisa antes/después y escribe un motivo obligatorio. Confirma y guarda.
7. Una transacción Firebase actualiza **ambos documentos** (`notas_articulo` y `notas`) o ninguno; el sistema verifica el resultado antes de actualizar la tabla.

Cada corrección se añade a `historialCorrecciones` con fecha, motivo y valores anteriores/nuevos. Se preservan los demás campos y las notas individuales de los vocales (no se modifican automáticamente). Si otro dispositivo cambia el registro mientras el usuario edita, se bloquea el guardado para evitar sobrescrituras.

**Importante:** la importación de un nuevo Excel oficial puede volver a sobrescribir estas correcciones, tras presentar su previsualización de cambios. Las reglas Firestore actuales permiten escritura sin autenticación: antes de delegar correcciones a otros usuarios, incorporar Firebase Auth y autorización por roles en las reglas del servidor; no basta con ocultar el botón.

Pruebas de cálculo y estructura: `node scripts/verify-notas-visor.js`.

**Seguridad de registros:** si el estudiante no tiene documento en `notas_articulo`, la transacción permite crearlo, pero rechaza la creación si otro equipo ya lo hizo. Si el estudiante tiene un resumen asociado a una modalidad diferente, no se permite sobrescribirlo. La edición de una nota existente exige que la versión que abrió el usuario no haya cambiado. Las calificaciones pendientes se almacenan como `null`; nunca se convierten automáticamente en cero.

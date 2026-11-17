# Notas → Núcleos · Complexivo · Trabajo · Artículo

Las cuatro pantallas comparten `visor.html?tipo=nucleos|complexivo|trabajo|articulo`, el período global, filtros por carrera y estado, búsqueda, agrupación por carrera, detalle por estudiante y exportación CSV.

## Consulta

- Núcleos, Complexivo y Trabajo de titulación **siguen siendo de solo lectura**.
- Artículo académico consulta `notas_articulo` en Firebase, con una sola consulta por período; los nombres proceden de la base local.
- Las calificaciones calculadas se muestran en cursiva morada; el detalle incluye tribunal y acta, si existen.
- `Notas → Cargado de notas` continúa siendo el módulo para importar las notas oficiales.

## Corrección manual de Artículo académico

1. Selecciona el período y localiza al estudiante. Pulsa **Editar** en su fila.
2. Corrige Tutor, Lector, Escrito, Práctica, Defensa, Oral o Final (0–10, máximo 2 decimales). Los campos se pueden dejar vacíos.
3. Al modificar Tutor o Lector se actualiza Escrito; al modificar Práctica o Defensa se actualiza Oral; al modificar componentes se recalcula Final según la fórmula **70/30** o **50/50** del registro. Es posible modificar un agregado o la nota final directamente: si no coincide con la fórmula aparece una advertencia.
4. Revisa antes/después y escribe un motivo obligatorio. Confirma y guarda.
5. Una transacción Firebase actualiza **ambos documentos** (`notas_articulo` y `notas`) o ninguno; el sistema verifica el resultado antes de actualizar la tabla.

Cada corrección se añade a `historialCorrecciones` con fecha, motivo y valores anteriores/nuevos. Se preservan los demás campos y las notas individuales de los vocales (no se modifican automáticamente). Si otro dispositivo cambia el registro mientras el usuario edita, se bloquea el guardado para evitar sobrescrituras.

**Importante:** la importación de un nuevo Excel oficial puede volver a sobrescribir estas correcciones, tras presentar su previsualización de cambios. Las reglas Firestore actuales permiten escritura sin autenticación: antes de delegar correcciones a otros usuarios, incorporar Firebase Auth y autorización por roles en las reglas del servidor; no basta con ocultar el botón.

Pruebas de cálculo y estructura: `node scripts/verify-notas-visor.js`.

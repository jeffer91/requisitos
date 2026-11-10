# Notas → Cargado de notas

Carga el reporte oficial del sistema académico (`NotasTitulacion_<PERIODO>_<fecha>.xls`) y lo publica en Firebase.

## Flujo
1. **Subir el archivo**. Se analiza solo: cada cédula se busca en la base local en todos los períodos
   y se ubica en el de su matrícula ACTIVA (primero el que dice el sistema, luego el que tiene
   Aprobación final, luego el más reciente). Opcionalmente se puede limitar a un período.
2. La modalidad (complexivo / trabajo / artículo) sale del archivo.
3. **Guardar notas**: escribe en BDLocal y en Firebase (4 estudiantes en paralelo) y verifica cada documento.
   Volver a guardar es seguro: lo que ya está igual no se reescribe.

## Reglas
- **El sistema gana**: si la app o Firebase tienen otra nota, se reemplaza y se avisa antes de guardar.
- Modalidad: se toma de `trabajoTitulacion`; `tipo_titulacion` trae errores y solo genera aviso.
- Complexivo y Trabajo exigen **Aprobación final** (AprobacionTitulacion + AprobacionComplexivoProyecto en CUMPLE).
- Complexivo sin examen pero con núcleos: se cargan solo los núcleos.
- Código de carrera sin -P-/-L- (p. ej. «550613A01»): Presencial si el nombre no dice ONLINE, con aviso.
- Fórmulas: examen = 40 % teórico + 60 % práctico (ordinario o supletorio, nunca mezclados); titulación = (promedio de núcleos + examen) / 2; trabajo = 60 % escrito + 40 % defensa; artículo = 70 % escrito + 30 % defensa.
- Lo que no cuadra con la fórmula se conserva tal como viene del sistema y se marca «No cuadra».

## Desglose calculado (marcado)
- Núcleos: evaluaciones 1–4 y caso de estudio = nota final del núcleo (`desgloseCalculado: true`). Si ya hay evaluaciones reales de Moodle, se respetan.
- Supletorio: el teórico/práctico del ordinario se calcula desde la nota del ordinario.
- Si falta un solo dato de una fórmula, se despeja; si faltan varios, se reparte la nota superior.
- Los campos calculados quedan en `camposCalculados`.

## Colecciones
`notas_nucleos`, `notas_complexivo`, `notas_trabajo` (tipoRegistro `CONSOLIDADO_INSTITUCIONAL`), `notas_articulo` y el resumen en `notas`. No se guarda el correo.

Pruebas: `node scripts/verify-carga-notas.js`.

Prueba completa (10/11/2026) con la exportación real de Firebase sembrada en BDLocal y un Firestore
simulado que aplica las mismas reglas de `firestore.rules`:
- Octubre 2025 – Marzo 2026: 813 en la base local, 504 cargados (344 complexivo, 6 trabajo, 154 artículo),
  309 sin Aprobación final (matriculados en Abril–Septiembre 2026), 192 cédulas no están en la base local.
- Febrero – Agosto 2026: 79/79 artículos cargados.

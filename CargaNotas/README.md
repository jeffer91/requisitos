# Notas → Cargado de notas

Carga el reporte oficial del sistema académico (`NotasTitulacion_<PERIODO>_<fecha>.xls`) y lo publica en Firebase.

## Flujo
1. Elegir el **período** (el de la app/BDLocal) y el archivo.
2. **Analizar**: se cotejan las **cédulas** con la matrícula activa de ese período. El período que trae el sistema solo se muestra como aviso (el sistema etiqueta a online y febrero–agosto con otros períodos).
3. **Guardar**: se escribe en BDLocal y en Firebase, con verificación de cada documento.

## Reglas
- **El sistema gana**: si la app o Firebase tienen otra nota, se reemplaza y se avisa antes de guardar.
- Modalidad: se toma de `trabajoTitulacion`; `tipo_titulacion` trae errores y solo genera aviso.
- Complexivo y Trabajo exigen **Aprobación final**.
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

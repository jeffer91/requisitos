# Notas → Modalidad y Descargas

## Modalidad (`modalidad.html`)
Períodos regulares: marca a cada estudiante como **Examen complexivo** (por defecto) o **Trabajo de titulación**.
Se guarda al instante en Firebase, colección `modalidad_titulacion` (id `periodoId__cedula`).
Quien ya tiene notas de trabajo subidas aparece como Trabajo mientras no se marque otra cosa.
En PVC no hay nada que marcar (todos son Artículo).

## Descargas (`descargas.html`)
Excels (.xlsx) del período de la barra superior.

| Período | Excels |
|---|---|
| Regular (Abr–Sep, Oct–Mar) | Presencial: Requisitos · Núcleos · Complexivo — Online: los mismos — Trabajo de titulación |
| PVC (cualquier otro) | Requisitos · Artículo académico |

- **Requisitos**: todos los estudiantes activos; Resumen + una hoja por área (11), CUMPLE / NO CUMPLE.
- **Núcleos**: complexivo con los 8 requisitos (Académico, Documentación, Financiero, Prácticas, Vinculación,
  Seguimiento a graduados, Inglés, Actualización de datos) en CUMPLE. Una hoja por carrera con Ev. 1–4,
  caso de estudio y nota de cada núcleo.
- **Complexivo**: además Titulación en CUMPLE (aprobó núcleos). Una hoja por carrera.
- **Trabajo / Artículo**: con los 8 requisitos en CUMPLE. Una hoja por carrera; columna Titulación (título subido).
- Presencial / Online por el código de carrera (-P- / -L-).

Reglas en `reportes.rules.js` (puras). Pruebas: `node scripts/verify-notas-reportes.js`.

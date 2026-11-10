# Notas → Núcleos · Complexivo · Trabajo · Artículo (visualizadores)

Pantallas **solo de lectura**. Las notas se suben únicamente en **Notas → Cargado de notas**.

- Un mismo diseño para las cuatro: `visor.html?tipo=nucleos|complexivo|trabajo|articulo`.
- Siguen el **período global** (barra superior); filtro por carrera, estado y búsqueda por cédula o nombre.
- Agrupadas por carrera con resumen (estudiantes, aprobados, no aprobados, promedio).
- Clic en un estudiante: detalle (evaluaciones de núcleo, supletorio, tribunal, acta…).
- Las notas calculadas por la app se muestran en *cursiva morada*.
- Leen Firebase directo (`notas_nucleos`, `notas_complexivo`, `notas_trabajo`, `notas_articulo`) con una consulta por período;
  los nombres salen de la base local. «Descargar» genera un CSV que abre Excel.

Las pantallas anteriores (`Ncomplex/`, `Complexivo/`, `Trabajo/`, `defart/`) siguen en el repositorio pero ya no están en el menú.

Pruebas: `node scripts/verify-notas-visor.js`.

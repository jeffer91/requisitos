# BDLocal

Nueva base local única de Requisitos.

Estado actual:
- IndexedDB como motor local.
- Estructura separada por tablas.
- Normalizadores para período, estudiante, requisitos, notas, divisiones y errores.
- Repositorios para guardar y consultar datos preparados.
- Firebase queda para sincronización, no para consulta directa de pantallas.
- Las pantallas deberán leer datos preparados desde `BDLocal`.

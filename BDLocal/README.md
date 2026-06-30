# BDLocal

Nueva base local única de Requisitos.

Estado actual:
- IndexedDB como motor local.
- Estructura separada por tablas.
- Normalizadores para período, estudiante, requisitos, notas, divisiones y errores.
- Repositorios para guardar y consultar datos preparados.
- Carga inteligente desde archivos, datos pegados y estructuras externas.
- Sincronización Firebase mediante cola local, log y motor no bloqueante.
- Pantalla `BDLocal/bdlocal.html` para dashboard, estudiantes, detalle, carga y sincronización.
- Firebase queda para sincronización, no para consulta directa de pantallas.
- Las pantallas leen datos preparados desde `BDLocal`.

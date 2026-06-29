# BaseLocal / BL

Este bloque activa una base local rápida para Requisitos.

Flujo:
1. Requisito / Excel analiza el archivo.
2. `excel-ui.cargar.js` guarda el resultado en `ExcelLocalRepo`.
3. `ExcelLocalRepo` persiste el snapshot en localStorage.
4. BL lee la misma base mediante `BaseLocalAPI`.

Firebase y sincronización remota quedan para el siguiente bloque.
No se toca Títulos.

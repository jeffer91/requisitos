# InPVC

Pantalla exclusiva para generar informes institucionales de períodos PVC.

## Arquitectura

- `cone.inpvc.js` es la única conexión con Base Local y funciona en modo lectura.
- Cada carpeta dentro de `sections/` construye su contenido Word y sus hojas Excel.
- `inpvc.model.js` centraliza la fórmula 70 % trabajo escrito + 30 % defensa oral.
- Los exportadores producen Word y Excel por sección, archivos globales y un ZIP con subcarpetas.
- El diagrama de Ishikawa describe factores potenciales y no atribuye causas individuales sin evidencia.

No se crea ninguna tabla nueva en IndexedDB.

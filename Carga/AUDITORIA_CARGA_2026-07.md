# Auditoría de Carga — julio de 2026

Cambios aplicados según las reglas operativas confirmadas:

- Se conserva la comparación entre archivo completo y período.
- Se muestran por separado estudiantes nuevos y ausentes.
- Los lectores aceptan archivos grandes sin recortar filas o columnas.
- La lectura de Excel evita decodificar el binario completo antes de reconocerlo.
- CSV y TXT se procesan por bloques para mantener activa la interfaz.
- Se añadió progreso de lectura, análisis y guardado.
- Las identificaciones numéricas de nueve dígitos continúan recibiendo cero inicial.
- CorreoPersonal vacío conserva el valor previo cuando existe.
- Un fallo de auditoría posterior no se presenta como fallo del guardado local.
- Las carreras de Divisiones se identifican por código o nombre, no por el ID del estudiante.
- BDLocal reemplaza la lista local de períodos como fuente oficial.
- Los mensajes y selectores dinámicos se renderizan como texto seguro.
- Se eliminaron controladores y módulos antiguos sin uso.

La rama incluye una verificación temporal de sintaxis que debe eliminarse después de obtener resultado correcto en GitHub Actions.

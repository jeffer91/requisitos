# Bloque 7 - Stats

Pantalla de estadísticas conectada a BaseLocal.

## Objetivo principal

Stats está orientado al **cierre de un período de titulación**. Debe permitir responder de forma clara:

1. ¿Cuántos estudiantes estuvieron registrados en el período?
2. ¿Cuántos llegaron a la fase final con todos los requisitos previos completos?
3. ¿Cuántos no llegaron a la fase final?
4. ¿Por qué no llegaron? — retiro o requisitos previos pendientes.
5. ¿Cuántos llegaron a la fase final pero no aprobaron el artículo o la defensa?
6. ¿Cómo quedaron Titulación, Aprobación de titulación y Aprobación complexivo/proyecto entre quienes sí llegaron?

## Flujo recomendado

1. Entrar a Requisito.
2. Crear o seleccionar período.
3. Cargar y analizar Excel.
4. Entrar a Stats.
5. Seleccionar el período terminado.
6. Revisar primero **Cierre** y luego Requisitos, Carreras, Aprobación final, Notas y Estudiantes.
7. Generar el PDF institucional desde el botón **PDF**.

## Secciones

- **Cierre:** cohorte completa, activos, retirados, llegada a fase final, no llegada, no aprobación de artículo/defensa, causas y detalle operativo.
- **Resumen:** KPIs generales según los filtros operativos.
- **Notas:** cobertura, promedios y pendientes.
- **Requisitos:** cumplimiento requisito por requisito.
- **Carreras:** comparación de resultados por carrera.
- **Aprobación final:** Titulación, Aprobación de titulación y Aprobación complexivo/proyecto.
- **Telegram:** herramienta operativa complementaria.
- **Estudiantes:** detalle individual.

## Reglas del reporte de cierre

El reporte **Cierre** usa la cohorte completa del período, es decir, activos + retirados. Los filtros de Matrícula, Estado y Requisito no cambian el cierre; División y Carrera sí pueden segmentarlo.

- **Requisitos previos:** se consideran los requisitos BASE: Académico, Documentación, Financiero, Prácticas, Vinculación, Seguimiento de graduados, Inglés y Actualización de datos.
- **Llegaron a fase final:** estudiantes activos que completaron todos los requisitos previos BASE. Titulación y las aprobaciones finales no se usan para decidir si el estudiante llegó a la fase final.
- **No llegaron a fase final:** retirados + estudiantes activos con uno o más requisitos previos BASE pendientes.
- **No aprobaron artículo o defensa:** estudiantes que completaron todos los requisitos previos BASE, pero no tienen Titulación, no tienen Aprobación de titulación y tampoco Aprobación complexivo/proyecto.
- **Incidencias:** suma de causas detectadas entre quienes no llegaron. Un estudiante puede tener varias causas, por lo que los porcentajes de causas pueden sumar más de 100 %.
- **Resultados finales:** Titulación, Aprobación de titulación y Aprobación complexivo/proyecto se presentan por separado entre quienes llegaron a fase final.

## PDF institucional

El PDF de Cierre es un informe formal independiente de la interfaz. Incluye:

- portada con el logo institucional ubicado en `Global/assets/branding/logo-instituto.png`;
- resumen ejecutivo;
- causas de no llegada a fase final;
- cumplimiento de requisitos;
- resultados por carrera;
- aprobación final;
- análisis automático después de cada bloque;
- conclusiones del período.

El PDF **no incluye el detalle nominal de quienes no llegaron**. Ese detalle permanece únicamente como herramienta operativa en la pantalla Stats.

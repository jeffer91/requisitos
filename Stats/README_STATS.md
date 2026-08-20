# Bloque 7 - Stats

Pantalla de estadísticas conectada a BaseLocal.

## Objetivo principal

Stats está orientado al **cierre de un período de titulación**. Debe permitir responder de forma clara:

1. ¿Cuántos estudiantes estuvieron registrados en el período?
2. ¿Cuántos llegaron al cierre con todos sus requisitos completos?
3. ¿Cuántos no llegaron?
4. ¿Por qué no llegaron? — retiro o requisitos pendientes.
5. ¿Cómo quedaron las aprobaciones finales de quienes sí llegaron?

## Flujo recomendado

1. Entrar a Requisito.
2. Crear o seleccionar período.
3. Cargar y analizar Excel.
4. Entrar a Stats.
5. Seleccionar el período terminado.
6. Revisar primero **Cierre** y luego Requisitos, Carreras, Aprobación final, Notas y Estudiantes.

## Secciones

- **Cierre:** cohorte completa, activos, retirados, llegaron, no llegaron, tasa de llegada, causas y detalle individual.
- **Resumen:** KPIs generales según los filtros operativos.
- **Notas:** cobertura, promedios y pendientes.
- **Requisitos:** cumplimiento requisito por requisito.
- **Carreras:** comparación de resultados por carrera.
- **Aprobación final:** titulación y complexivo/proyecto.
- **Telegram:** herramienta operativa complementaria.
- **Estudiantes:** detalle individual.

## Reglas del reporte de cierre

El reporte **Cierre** usa la cohorte completa del período, es decir, activos + retirados. Los filtros de Matrícula, Estado y Requisito no cambian el cierre; División y Carrera sí pueden segmentarlo.

- **Llegaron:** estudiantes activos que tienen completos todos los requisitos aplicables al período.
- **No llegaron:** retirados + estudiantes activos con uno o más requisitos pendientes.
- **Incidencias:** suma de causas detectadas. Un estudiante puede tener varias causas, por lo que los porcentajes de causas pueden sumar más de 100 %.
- **Aprobación final:** se informa por separado para Titulación y Complexivo/Proyecto entre quienes llegaron con requisitos completos.

# Inf — Informe Final del Proceso de Titulación

## Alcance

Módulo independiente y progresivo para los informes institucionales UTET. Se crea en la rama main sin tocar los módulos existentes, sus bases de datos ni sus conectores.

El índice es el aprobado por el usuario: ocho capítulos, con sus títulos, subapartados y numeración intactos. Las plantillas genéricas se incorporarán por entregas; los textos vacíos **significan contenido pendiente**. No se deben generar datos, normas, referencias o resultados de ejemplo.

## Organización

- inf.html / inf.css / inf.app.js: pantalla de lectura y seguimiento de carga de secciones.
- core/inf.catalog.js: índice único, inmutable, con los títulos y números exactos.
- core/inf.registry.js: registro validado de plantillas, con un archivo independiente por capítulo.
- core/inf.report.js: modelo de borrador y conteo de secciones pendientes.
- sections/01-... a 08-...: textos genéricos a incorporar posteriormente, siempre en su capítulo.
- export/README.md: contratos futuros para exportación.
- tests/verify-inf.js: comprobaciones de integridad de catálogo, plantillas y borrador.

## Cómo incorporar cada entrega

Cuando se apruebe el texto de una sección, modificar exclusivamente el campo correspondiente en su archivo sections/NN-.../section.js. Conservar exactamente las claves numéricas (por ejemplo, 3.4 y 4.3.2). Los textos de capítulos y subcapítulos se registran como contenido literal; los resultados dinámicos se conectarán más adelante a las fuentes verificadas.

## Normas y fuentes

- Formato institucional INF: guía de estandarización de portadas RGI/INF/ACT ITSQMET v1.1, no crear un código documental inventado.
- Redacción, referencias, citas, tablas y figuras: APA 7, respetando excepciones institucionales de portada y numeración.
- Manual de Procesos de Titulación y Eficiencia Terminal v2: proceso UTET-PRO-95 y procesos conexos.
- BDLocal: fuente oficial de estudiantes y requisitos; Ficha: modalidad; Ncomplex: evaluaciones; Stats: indicadores; Actas: cierre documental. Su integración se hará mediante conectores oficiales, sin accesos directos a los datos ni escrituras académicas desde Inf.
- Las notas de núcleos estructurantes requieren una fuente verificable independiente; no se deducen de Ncomplex.
- No equiparar aprobación académica y cierre de titulación oficialmente certificado.

## Estado actual

Este bloque solo establece la carpeta, el índice y la infraestructura para recibir los textos. Aún **no** consulta datos reales, genera un informe final, exporta Word/PDF ni está registrado en el menú principal; esas integraciones vendrán cuando se desarrollen las secciones y el motor. No modificar componentes ajenos a Inf antes de esa etapa.

## Comprobación

Desde la raíz del repositorio: node Inf/tests/verify-inf.js

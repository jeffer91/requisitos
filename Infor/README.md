# Infor

Módulo interno para generar informes de titulación.

## Bloque 0 - Renombre seguro

La entrada del módulo se movió operativamente a:

```text
Requisitos/Infor/frontend/titulacion.html
```

Durante este bloque se mantiene compatibilidad temporal con la implementación anterior:

```text
Requisitos/Titulacion/frontend/titulacion.html
```

Esto evita romper el menú principal mientras se migran los archivos internos al nombre definitivo `Infor`.

## Módulos relacionados

```text
Requisitos/Titulos = módulo de títulos / artículos académicos
Requisitos/Infor   = módulo de informes de titulación
```

## Siguiente bloque

Migrar archivos internos desde `Requisitos/Titulacion` hacia `Requisitos/Infor` y actualizar referencias internas sin romper la carga de scripts, estilos, Word, PDF, Gemini, BaseLocal ni cronogramas.

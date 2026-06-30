# Depuración BDLocal

Rama: `refactor/bdlocal-carga`.

## Qué se corrigió en este bloque

1. Se corrigió la paginación real de estudiantes en `BDLocal/repositories/bdl.repo.estudiantes.js`.
2. Se agregó diagnóstico de módulos en `BDLocal/bdl.diagnostics.js`.
3. Se agregó página de diagnóstico en `BDLocal/bdlocal.diagnostico.html`.
4. Se agregaron datos de prueba en `BDLocal/tests/bdl.test-data.js`.
5. Se agregó prueba rápida en `BDLocal/tests/bdl.smoke-test.js`.

## Cómo probar

Abrir en el navegador:

```text
BDLocal/bdlocal.diagnostico.html
```

La prueba revisa:

- Carga de módulos principales.
- Apertura de IndexedDB.
- Repositorio de estudiantes.
- Inserción de datos de prueba.
- Disponibilidad de Carga.
- Disponibilidad de Sync.

## Resultado esperado

El diagnóstico debe mostrar:

```text
Diagnóstico correcto
```

Si aparece error, revisar la lista `missing` o la tabla de `checks` en consola.

## Pendiente antes de fusionar a main

- Abrir `BDLocal/bdlocal.html`.
- Abrir `BDLocal/bdlocal.diagnostico.html`.
- Probar carga con un archivo pequeño.
- Probar sincronización Firebase con conexión activa.
- Revisar que ninguna pantalla vieja apunte a `BaseLocal`, `BaseLocal2` o `Gestion/Excel`.

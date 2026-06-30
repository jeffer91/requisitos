# Migración BDLocal y Carga

Rama de trabajo: `refactor/bdlocal-carga`.

## Cambios principales

- Se elimina la arquitectura anterior basada en `BaseLocal`, `BaseLocal2` y `Gestion/Excel`.
- Se crea `BDLocal` como base local única basada en IndexedDB.
- Se crea `Carga` como módulo único para importar datos desde archivos, texto pegado y estructuras externas.
- Firebase queda como respaldo y sincronización, no como fuente directa de las pantallas.
- Las pantallas leen datos preparados desde repositorios locales.

## Nueva ruta principal

Abrir:

```text
BDLocal/bdlocal.html
```

En Netlify también quedan rutas limpias:

```text
/bdlocal
/carga
```

## Rutas antiguas redirigidas

```text
/BaseLocal/*      -> /BDLocal/bdlocal.html
/BaseLocal2/*     -> /BDLocal/bdlocal.html
/Gestion/Excel/*  -> /BDLocal/bdlocal.html
```

## Orden funcional

```text
Carga -> Normalización -> Repositorios -> BDLocal -> Pantallas -> Sync Firebase
```

## Estado

Esta rama todavía debe probarse antes de fusionarse a `main`.

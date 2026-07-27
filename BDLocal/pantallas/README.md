# Pantallas de Base Local

Esta carpeta contiene la API interna que comunica las pantallas de la aplicación con Base Local.

## Propósito

- separar la comunicación interna del concepto de conexiones externas;
- mantener una puerta única para lectura, escritura, refresco y diagnóstico;
- conservar compatibilidad temporal con `BDLocal/conexiones/`;
- impedir que las pantallas accedan directamente a IndexedDB;
- funcionar sin conexión a internet.

## API oficial

```text
BDLocalPantallas
BDLocalPantallasContract
BDLocalPantallasRegistry
BDLocalPantallasClient
BDLocalPantallasMonitor
```

## Compatibilidad

Durante el bloque 2, los archivos de `BDLocal/conexiones/` continúan siendo la implementación activa. Los archivos de esta carpeta exponen la nueva nomenclatura y delegan en los contratos existentes.

Las rutas antiguas no se eliminarán hasta que todas las pantallas y pruebas utilicen la nueva API y no existan referencias activas.

## Límite funcional

Este módulo no administra Firebase, Supabase, Google Sheets, credenciales, cuotas ni llamadas de red. Esas responsabilidades pertenecen a `ConexionesExternas/`.

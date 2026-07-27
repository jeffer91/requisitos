# Conexiones Externas

Esta carpeta contiene la API oficial que administra Firebase, Supabase y Google Sheets dentro del Centro de datos.

## Estado actual

Bloque 3: módulo funcional con compatibilidad temporal.

La nueva puerta principal es:

```text
ConexionesExternas
```

Los motores antiguos continúan en sus rutas actuales para no romper la aplicación, pero la interfaz final deberá consumir esta API.

## Estructura

```text
ConexionesExternas/
├── core/
│   ├── conexiones.externas.contract.js
│   ├── conexiones.externas.providers.js
│   └── conexiones.externas.index.js
├── providers/
│   ├── firebase/
│   ├── supabase/
│   └── google-sheets/
└── usage/
    └── conexiones.externas.usage.js
```

## Operaciones oficiales

```text
status()
test(target)
pull(target, options)
push(target, options)
syncQueue(options)
retry(target, options)
pause(reason)
resume()
usage(target)
```

## Reglas

- todas las operaciones externas son manuales;
- cada lote tiene un máximo de 25 cambios;
- cada proveedor mantiene estado y error independientes;
- una falla remota no bloquea el uso de Base Local;
- la cola y los conflictos continúan almacenados en Base Local;
- ninguna pantalla académica debe conectarse directamente con un proveedor;
- las métricas de cuota deben indicar si son locales o confirmadas oficialmente.

## Cuotas y consumo

Firebase muestra actualmente una **medición local estimada** y contadores del tiempo de ejecución. Google Sheets y Supabase muestran su estado local. Ninguno de estos valores debe presentarse como cuota oficial del proveedor mientras no exista una consulta confirmada a su API administrativa.

La arquitectura completa está documentada en `docs/CENTRO_DATOS_BLOQUE_1_ARQUITECTURA.md`.

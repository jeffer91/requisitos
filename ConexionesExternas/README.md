# Conexiones Externas

Esta carpeta contiene la API oficial que administra Firebase, Supabase y Google Sheets dentro del Centro de datos.

## Estado actual

Módulo funcional integrado con compatibilidad temporal y pruebas manuales reales de conexión.

La puerta principal es:

```text
ConexionesExternas
```

Los motores anteriores continúan en sus rutas actuales para no romper la aplicación, pero la interfaz del Centro de datos consume esta API como fachada oficial.

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
testAll()
pull(target, options)
push(target, options)
syncQueue(options)
retry(target, options)
pause(reason)
resume()
usage(target)
```

## Estados diferenciados

Cada proveedor informa por separado:

- `available`: los módulos técnicos están cargados;
- `configured`: existen los datos locales mínimos de configuración;
- `connected`: una prueba manual remota terminó correctamente;
- `verified`: la conexión fue verificada y puede mostrarse como correcta.

La aplicación no presenta un proveedor como conectado únicamente porque su adaptador esté cargado.

## Pruebas manuales

- Firebase realiza una lectura mínima de solo lectura en la colección oficial `periodos`.
- Google Sheets envía un `ping` manual al Apps Script configurado.
- Supabase consulta manualmente un registro mediante su API REST.

Estas pruebas solo se ejecutan al usar **Probar** o **Probar conexiones**. Abrir la aplicación, esperar o cerrarla no genera lecturas ni escrituras externas.

## Reglas

- todas las operaciones externas son manuales;
- no existe sincronización periódica oculta;
- cada lote tiene un máximo de 25 cambios;
- cada proveedor mantiene estado y error independientes;
- una falla remota no bloquea el uso de Base Local;
- la cola y los conflictos continúan almacenados en Base Local;
- ninguna pantalla académica debe conectarse directamente con un proveedor;
- las métricas de cuota deben indicar si son locales o confirmadas oficialmente.

## Cuotas y consumo

Firebase muestra actualmente una **medición local estimada** y contadores del tiempo de ejecución. Google Sheets y Supabase muestran su estado local. Ninguno de estos valores se presenta como cuota oficial del proveedor mientras no exista una consulta confirmada a su API administrativa.

La arquitectura completa está documentada en `docs/CENTRO_DATOS_BLOQUE_1_ARQUITECTURA.md`.

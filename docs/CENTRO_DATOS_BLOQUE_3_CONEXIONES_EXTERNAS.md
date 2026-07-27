# Centro de datos — Bloque 3: Conexiones Externas

## Resultado

Se creó la API oficial `ConexionesExternas` para separar Firebase, Supabase y Google Sheets de la comunicación interna de Base Local.

## Estructura funcional

```text
ConexionesExternas
├── Contrato común
├── Registro de proveedores
├── Firebase
├── Supabase
├── Google Sheets
├── Cuotas y consumo
└── Puerta principal
```

## API pública

```text
status()
listProviders()
provider(target)
test(target, options)
pull(target, options)
push(target, options)
syncQueue(options)
retry(target, options)
pause(reason)
resume()
isPaused()
isRunning()
usage(target)
```

## Compatibilidad

La lógica probada existente continúa temporalmente en:

```text
BDLocal/sync/
BDLocal/firebase/
BDLocal/bl2.cloud-pull.safe.js
js/bdlocal-config/
```

Los nuevos proveedores delegan en esos motores. Esto permite cambiar la interfaz hacia `ConexionesExternas` sin mover simultáneamente archivos críticos ni romper rutas antiguas.

## Proveedores

### Firebase

- subida manual mediante la cola;
- descarga manual del período seleccionado;
- descarga global limitada;
- estado del motor V2;
- conflictos y presupuestos de lectura existentes;
- medición local de operaciones.

### Google Sheets

- subida manual mediante Apps Script;
- descarga segura de un período;
- descarga de todos los períodos;
- protección de cambios locales;
- estado de configuración y pendientes.

### Supabase

- subida manual mediante el adaptador existente;
- estado y configuración;
- descarga declarada como no disponible hasta disponer de un contrato seguro.

## Cuotas

La API distingue expresamente:

```text
Cuota oficial confirmada
Consumo medido localmente
Estado local sin cuota disponible
```

Actualmente Firebase utiliza una estimación local; Google Sheets y Supabase muestran estado local. La interfaz no debe presentarlos como facturación o cuota oficial.

## Reglas conservadas

- ninguna sincronización se inicia automáticamente;
- máximo 25 cambios por lote;
- cada proveedor falla de forma independiente;
- Base Local continúa operando sin internet;
- la cola, los estados y los conflictos permanecen en Base Local;
- ninguna pantalla académica accede directamente a los proveedores.

## Próximo bloque

El bloque 4 conectará esta API con el menú lateral definitivo del Centro de datos y separará visualmente Base Local de Conexiones Externas.

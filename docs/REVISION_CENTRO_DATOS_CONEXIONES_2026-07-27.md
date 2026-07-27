# Revisión integral del Centro de datos y conexiones

Fecha: 27 de julio de 2026.

## Alcance

Se revisaron la interfaz final del Centro de datos, las conexiones internas de pantallas, la API `ConexionesExternas`, los tres proveedores remotos y las protecciones contra sincronización automática.

## Hallazgos corregidos

1. Existía una fachada heredada capaz de programar Google Sheets cada cinco minutos. Fue convertida en una fachada de compatibilidad estrictamente manual, sin temporizadores ni E/S externa.
2. El diagnóstico cargaba esa fachada automática durante el arranque. Esa carga fue eliminada y ahora se desactiva cualquier instancia antigua previamente cargada.
3. Los proveedores externos podían aparecer disponibles por tener sus módulos cargados, aunque no se hubiese confirmado la conexión remota. Ahora se distinguen `available`, `configured`, `connected` y `verified`.
4. Las pruebas de Google Sheets y Supabase fueron conectadas con sus verificaciones remotas reales. Firebase incorpora una lectura manual mínima y de solo lectura.
5. La documentación aclaró que Base Local es el núcleo operativo de las pantallas y Firebase conserva el rol de fuente oficial remota cuando está configurado.

## Pruebas de conexión

- Firebase: lectura manual `limit(1)` de la colección `periodos`.
- Google Sheets: `ping` manual al Apps Script configurado.
- Supabase: consulta manual REST a la tabla configurada.

Ninguna prueba se ejecuta al abrir, esperar o cerrar la aplicación.

## Reglas preservadas

- operaciones externas manuales;
- máximo 25 cambios por lote;
- pantallas conectadas únicamente a Base Local;
- cola, estado y conflictos persistidos localmente;
- una falla externa no bloquea el trabajo sin internet;
- consumo mostrado como local o estimado cuando no proviene de una API oficial.

## Validación pendiente en el equipo

Las pruebas automáticas certifican estructura, sintaxis, delegación, IndexedDB y Electron. La confirmación de credenciales, permisos, reglas y disponibilidad reales debe realizarse desde **Centro de datos → Conexiones Externas → Probar conexiones** en el equipo donde está instalada la aplicación.

# Comunicación de Base Local

## Objetivo

`BDLocal/conexiones` es la única puerta entre la Base Local y las pantallas.

La Base Local continúa dividida en tablas relacionadas. Las pantallas no consultan IndexedDB, no unen tablas y no crean una segunda caché.

```text
IndexedDB dividido en tablas
        ↓
Repositorios y servicios
        ↓
BDLocalConexiones
        ↓
Conector de pantalla
        ↓
BDLocalConnectionClient
        ↓
Pantalla
```

## Tablas principales

* `periodos`
* `personas`
* `matriculas_periodo`
* `requisitos_estudiante`
* `contactos_estudiante`
* `notas_titulacion`
* `divisiones_estudiante`
* `cambios_pendientes`
* `sync_estado`
* `cache_views`

Las relaciones principales usan:

* `cedula`
* `periodoId`
* `idEstudiantePeriodo`

Una lista plana puede entregarse a una pantalla como vista temporal, pero no reemplaza las tablas de Base Local.

## Archivos nuevos

### `cone.contract.js`

Define un formato único para respuestas, errores, eventos, revisiones y conteos.

### `cone.registry.js`

Registra las pantallas oficiales:

* Carga → `ConCarga`
* Tabla → `ConTabla`
* Ficha → `ConFicha`
* Estadísticas → `ConStats`
* Coordinación → `ConCoordi`
* Reportes → `ConReportes`
* Defensas → `ConDefensas`
* Global → `ConGlobal`

### `cone.client.js`

Es la única entrada que deben usar las pantallas. Espera al orquestador, resuelve el conector y devuelve una respuesta normalizada.

Ejemplo:

```javascript
BDLocalConnectionClient.read("tabla", {
  periodoId: "periodo_2026",
  matricula: "ACTIVO"
}).then(function(response){
  if(!response.ok){
    console.error(response.error);
    return;
  }

  console.log(
    response.data.students ||
    response.data.rows ||
    []
  );

  console.log(
    response.data.requirements ||
    []
  );
});
```

### `cone.monitor.js`

Prueba cada conector y muestra:

* conector cargado;
* revisión de la pantalla y revisión central;
* estudiantes recibidos;
* requisitos recibidos;
* requisitos sin estudiante relacionado;
* tiempo de respuesta;
* mensaje del error.

## Archivos existentes que continúan siendo oficiales

No se reemplazan:

* `cone.utils.js`
* `cone.index.js`
* `cone.carga.js`
* `cone.tabla.js`
* `cone.ficha.js`
* `cone.stats.js`
* `cone.coordi.js`
* `cone.reportes.js`
* `cone.defensas.js`
* `cone.global.js`

`cone.index.js` continúa siendo el único orquestador de la caché compartida.

## Orden de carga en BDLocal

```html
<script src="conexiones/cone.contract.js"></script>
<script src="conexiones/cone.registry.js"></script>
<script src="conexiones/cone.utils.js"></script>
<script src="conexiones/cone.index.js"></script>
<script src="conexiones/cone.client.js"></script>
<script src="conexiones/cone.monitor.js"></script>
```

En una pantalla se puede cargar el cliente así:

```html
<script
  src="./BDLocal/conexiones/cone.client.js"
  data-bdl-screen="ficha">
</script>
```

La ruta debe ajustarse a la ubicación del HTML.

## Contenedor del monitor

Agregar en el Centro de Control:

```html
<section id="bdlocal-connections-monitor"></section>
```

El monitor se monta automáticamente cuando encuentra ese contenedor.

## Evento oficial

```text
bdlocal:connections:updated
```

Estructura recomendada:

```javascript
{
  revision: 26,
  periodoId: "periodo_2026",

  tablesChanged: [
    "matriculas_periodo",
    "requisitos_estudiante"
  ],

  sourceScreen: "carga",
  operation: "save",
  updatedAt: "2026-07-12T18:00:00.000Z"
}
```

Durante la migración, `cone.client.js` traduce los eventos antiguos al evento oficial.

## Reglas obligatorias

1. Ninguna pantalla consulta IndexedDB directamente.
2. Ninguna pantalla une las tablas de Base Local.
3. Ninguna pantalla crea una caché independiente.
4. Cada pantalla usa su conector oficial.
5. `cone.index.js` es el único orquestador.
6. `cone.client.js` es la entrada oficial de las pantallas.
7. Un error no puede ocultarse usando datos antiguos.
8. Si se usa compatibilidad antigua, debe indicarse `fallbackUsed: true`.
9. Las escrituras se confirman antes de publicar una revisión.
10. La estructura tabular no se reemplaza por una lista plana.

## Migración única de las pantallas

Estos cinco archivos no reemplazan automáticamente las fuentes antiguas.

Por cada pantalla se debe hacer una sola adaptación:

1. Cargar `cone.client.js`.
2. Esperar `BDLConnectionClientReady`.
3. Reemplazar la selección de varias fuentes por `BDLocalConnectionClient.read()`.
4. Mantener filtros, diseño y renderizado sin cambios.
5. Verificar la pantalla en el monitor.
6. Retirar el fallback antiguo cuando funcione correctamente.

Ejemplo:

```javascript
window.BDLConnectionClientReady
  .then(function(){
    return window.BDLocalConnectionClient.read(
      "tabla",
      {
        periodoId: "periodo_2026",
        matricula: "ACTIVO"
      }
    );
  })
  .then(function(response){
    if(!response.ok){
      throw new Error(
        response.error.message
      );
    }

    var students =
      response.data.students ||
      response.data.rows ||
      [];

    var requirements =
      response.data.requirements ||
      [];

    console.log(
      students,
      requirements
    );
  });
```

## Resultado esperado

```text
Pantalla: Tabla
Conector: ConTabla
Estado: conectado
Revisión de pantalla: 26
Revisión central: 26
Estudiantes recibidos: 1250
Requisitos recibidos: 8750
Requisitos huérfanos: 0
Último error: ninguno
```

## Prohibiciones

No crear:

* otra carpeta de comunicación;
* otra base local;
* otra caché principal;
* una tabla única que reemplace las tablas relacionadas;
* accesos directos de las pantallas a IndexedDB;
* eventos distintos para cada pantalla;
* fallbacks silenciosos hacia datos antiguos.

Toda corrección futura de comunicación debe revisarse primero dentro de `BDLocal/conexiones`.

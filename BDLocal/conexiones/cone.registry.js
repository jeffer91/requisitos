/* =========================================================
Nombre completo: cone.registry.js
Ruta: /BDLocal/conexiones/cone.registry.js
Función:
- Mantener el inventario oficial de pantallas y conectores.
- Resolver el conector correcto y detectar la pantalla actual.
- Permitir registrar pantallas sin modificar el núcleo.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0";

  var C=
    window.BDLocalConeContract||
    null;

  var definitions=
    Object.create(null);

  var aliases=
    Object.create(null);

  function text(value){
    return (
      C &&
      C.text
    )
      ? C.text(value)
      : String(
          value==null
            ? ""
            : value
        ).trim();
  }

  function clone(value){
    try{
      return (
        C &&
        C.clone
      )
        ? C.clone(value)
        : JSON.parse(
            JSON.stringify(value)
          );
    }catch(error){
      return value;
    }
  }

  function normalize(value){
    return (
      C &&
      C.normalizeScreen
    )
      ? C.normalizeScreen(value)
      : text(value)
          .toLowerCase()
          .replace(
            /[^a-z0-9_-]+/g,
            ""
          );
  }

  function unique(values){
    var map=
      Object.create(null);

    var out=[];

    (
      Array.isArray(values)
        ? values
        : []
    ).forEach(function(value){
      value=text(value);

      if(
        value &&
        !map[value]
      ){
        map[value]=true;
        out.push(value);
      }
    });

    return out;
  }

  function dispatch(
    name,
    detail
  ){
    if(
      C &&
      C.dispatch
    ){
      return C.dispatch(
        name,
        detail
      );
    }

    try{
      window.dispatchEvent(
        new CustomEvent(
          name,
          {
            detail:
              detail||{}
          }
        )
      );

      return true;
    }catch(error){
      return false;
    }
  }

  function normalizeDefinition(
    name,
    definition
  ){
    definition=
      definition &&
      typeof definition==="object"
        ? definition
        : {};

    var id=
      normalize(
        definition.id||
        name
      );

    if(!id){
      throw new Error(
        "El registro requiere un identificador de pantalla."
      );
    }

    return {
      id:id,

      label:
        text(definition.label)||
        id,

      global:
        text(definition.global)||
        (
          "Con"+
          id.charAt(0)
            .toUpperCase()+
          id.slice(1)
        ),

      file:
        text(definition.file)||
        (
          "cone."+
          id+
          ".js"
        ),

      pathHints:
        unique(
          definition.pathHints||
          [id]
        ),

      aliases:
        unique(
          definition.aliases||
          []
        ),

      canRead:
        definition.canRead!==
        false,

      canWrite:
        definition.canWrite===
        true,

      operations:
        unique(
          definition.operations||
          [
            "ready",
            "read",
            "refresh",
            "status",
            "diagnose"
          ]
        ),

      tables:
        unique(
          definition.tables||
          []
        ),

      description:
        text(
          definition.description
        ),

      enabled:
        definition.enabled!==
        false
    };
  }

  function register(
    name,
    definition
  ){
    var item=
      normalizeDefinition(
        name,
        definition
      );

    definitions[item.id]=
      item;

    aliases[item.id]=
      item.id;

    aliases[
      normalize(item.global)
    ]=item.id;

    item.aliases
      .concat(item.pathHints)
      .forEach(function(alias){
        aliases[
          normalize(alias)
        ]=item.id;
      });

    dispatch(
      "bdlocal:connections:registry-updated",
      {
        action:"register",
        screen:item.id,
        at:new Date()
          .toISOString()
      }
    );

    return clone(item);
  }

  function get(name){
    var key=
      normalize(name);

    var id=
      definitions[key]
        ? key
        : aliases[key];

    return (
      id &&
      definitions[id]
    )
      ? clone(
          definitions[id]
        )
      : null;
  }

  function list(options){
    options=options||{};

    return Object.keys(
      definitions
    )
      .map(function(key){
        return clone(
          definitions[key]
        );
      })
      .filter(function(item){
        return (
          options.includeDisabled===
          true
        )||item.enabled;
      });
  }

  function resolve(name){
    var item=get(name);

    var hub=
      window.BDLocalConexiones||
      null;

    var found=null;

    if(
      !item ||
      !item.enabled
    ){
      return null;
    }

    if(
      window[item.global]
    ){
      return window[item.global];
    }

    [
      "getConnector",
      "connector",
      "get"
    ].some(function(method){
      if(
        !hub ||
        typeof hub[method]!==
        "function"
      ){
        return false;
      }

      try{
        found=
          hub[method](
            item.id
          )||
          null;
      }catch(error){
        found=null;
      }

      return !!found;
    });

    return found;
  }

  function detect(fallback){
    var candidates=[];

    var script=
      document.currentScript;

    var source=
      text(
        window.location &&
        window.location.pathname
      ).toLowerCase();

    if(script){
      candidates.push(
        script.getAttribute(
          "data-bdl-screen"
        ),

        script.getAttribute(
          "data-screen"
        )
      );
    }

    if(document.body){
      candidates.push(
        document.body
          .getAttribute(
            "data-bdl-screen"
          ),

        document.body
          .getAttribute(
            "data-screen"
          )
      );
    }

    list().some(function(item){
      var match=
        item.pathHints.some(
          function(hint){
            return (
              source.indexOf(
                text(hint)
                  .toLowerCase()
              )>=0
            );
          }
        );

      if(match){
        candidates.push(
          item.id
        );
      }

      return match;
    });

    candidates.push(
      fallback
    );

    for(
      var i=0;
      i<candidates.length;
      i+=1
    ){
      var item=
        get(candidates[i]);

      if(item){
        return item.id;
      }
    }

    return "";
  }

  function status(){
    var screens=
      list({
        includeDisabled:true
      })
        .map(function(item){
          return {
            id:item.id,
            label:item.label,
            global:item.global,
            file:item.file,
            enabled:item.enabled,

            loaded:
              !!resolve(item.id),

            canRead:
              item.canRead,

            canWrite:
              item.canWrite,

            tables:
              item.tables.slice(),

            operations:
              item.operations.slice()
          };
        });

    return {
      ok:true,
      version:VERSION,
      total:screens.length,

      loaded:
        screens.filter(
          function(item){
            return item.loaded;
          }
        ).length,

      missing:
        screens
          .filter(function(item){
            return (
              item.enabled &&
              !item.loaded
            );
          })
          .map(function(item){
            return item.id;
          }),

      detectedScreen:
        detect(""),

      screens:screens
    };
  }

  var common=[
    "periodos",
    "personas",
    "matriculas_periodo",
    "requisitos_estudiante"
  ];

  register(
    "carga",
    {
      label:"Carga",
      global:"ConCarga",
      file:"cone.carga.js",

      pathHints:[
        "/carga/",
        "carga.html"
      ],

      aliases:[
        "importacion"
      ],

      canWrite:true,

      operations:[
        "ready",
        "read",
        "save",
        "refresh",
        "status",
        "diagnose"
      ],

      tables:
        common.concat([
          "contactos_estudiante",
          "notas_titulacion",
          "divisiones_estudiante",
          "importaciones"
        ]),

      description:
        "Guarda archivos validados en las tablas de Base Local."
    }
  );

  register(
    "tabla",
    {
      label:"Tabla",
      global:"ConTabla",
      file:"cone.tabla.js",

      pathHints:[
        "/gestion/tabla/",
        "tabla.html"
      ],

      aliases:[
        "gestiontabla"
      ],

      tables:
        common.concat([
          "contactos_estudiante"
        ]),

      description:
        "Entrega estudiantes y requisitos para la tabla principal."
    }
  );

  register(
    "ficha",
    {
      label:"Ficha",
      global:"ConFicha",
      file:"cone.ficha.js",

      pathHints:[
        "/ficha/",
        "ficha.html"
      ],

      canWrite:true,

      operations:[
        "ready",
        "read",
        "save",
        "update",
        "refresh",
        "status",
        "diagnose"
      ],

      tables:
        common.concat([
          "contactos_estudiante",
          "notas_titulacion",
          "divisiones_estudiante"
        ]),

      description:
        "Entrega y actualiza la ficha completa de un estudiante."
    }
  );

  register(
    "stats",
    {
      label:"Estadísticas",
      global:"ConStats",
      file:"cone.stats.js",

      pathHints:[
        "/stats/",
        "stats.html",
        "/infor/",
        "/titulacion/"
      ],

      aliases:[
        "estadisticas",
        "infor",
        "titulacion"
      ],

      tables:
        common.concat([
          "notas_titulacion",
          "divisiones_estudiante"
        ]),

      description:
        "Entrega resúmenes y datos estadísticos."
    }
  );

  register(
    "coordi",
    {
      label:"Coordinación",
      global:"ConCoordi",
      file:"cone.coordi.js",

      pathHints:[
        "/coordi/",
        "coordi.html"
      ],

      aliases:[
        "coordinacion"
      ],

      tables:
        common.concat([
          "contactos_estudiante",
          "divisiones_estudiante"
        ]),

      description:
        "Entrega información para coordinación."
    }
  );

  register(
    "reportes",
    {
      label:"Reportes",
      global:"ConReportes",
      file:"cone.reportes.js",

      pathHints:[
        "/reportes/",
        "repo.html"
      ],

      aliases:[
        "reporte",
        "repo"
      ],

      tables:
        common.concat([
          "contactos_estudiante",
          "notas_titulacion",
          "divisiones_estudiante"
        ]),

      description:
        "Entrega conjuntos completos para reportes."
    }
  );

  register(
    "defensas",
    {
      label:"Defensas",
      global:"ConDefensas",
      file:"cone.defensas.js",

      pathHints:[
        "/defart/",
        "defart.html",
        "/cr-def/",
        "cr-def.html"
      ],

      aliases:[
        "defart",
        "crdef"
      ],

      canWrite:true,

      operations:[
        "ready",
        "read",
        "save",
        "update",
        "refresh",
        "status",
        "diagnose"
      ],

      tables:
        common.concat([
          "notas_titulacion",
          "divisiones_estudiante"
        ]),

      description:
        "Entrega y actualiza notas y estados de defensa."
    }
  );

  register(
    "global",
    {
      label:"Global",
      global:"ConGlobal",
      file:"cone.global.js",

      pathHints:[
        "/global/",
        "global.html"
      ],

      tables:
        common.concat([
          "contactos_estudiante",
          "notas_titulacion",
          "divisiones_estudiante"
        ]),

      description:
        "Entrega la vista institucional consolidada."
    }
  );

  window.BDLocalConeRegistry={
    version:VERSION,

    register:register,
    get:get,
    list:list,
    resolve:resolve,
    detect:detect,
    status:status
  };

  dispatch(
    "bdlocal:connections:registry-ready",
    {
      ok:true,
      version:VERSION,
      total:list().length,
      detectedScreen:
        detect(""),

      at:new Date()
        .toISOString()
    }
  );
})(window,document);
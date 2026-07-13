/* =========================================================
Nombre completo: cone.contract.js
Ruta: /BDLocal/conexiones/cone.contract.js
Función:
- Definir el contrato único de comunicación entre BDLocal y pantallas.
- Normalizar respuestas, errores, eventos, estados y conteos.
- No leer ni modificar directamente IndexedDB.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0";
  var sequence=0;

  var EVENTS=Object.freeze({
    READY:"bdlocal:connections:ready",
    UPDATED:"bdlocal:connections:updated",
    ERROR:"bdlocal:connections:error",
    SCREEN_READY:"bdlocal:connections:screen-ready",
    MONITOR_UPDATED:"bdlocal:connections:monitor-updated",
    LEGACY_CACHE_UPDATED:"bdlocal:conexiones-cache-updated",
    LEGACY_SCREEN_UPDATED:"bdlocal:screen-data-updated",
    LEGACY_SNAPSHOT:"bdlocal:legacy-snapshot",
    LEGACY_BL_SNAPSHOT:"requisitos:bl:snapshot-changed"
  });

  var OPERATIONS=Object.freeze({
    READY:"ready",
    READ:"read",
    REFRESH:"refresh",
    SAVE:"save",
    UPDATE:"update",
    REMOVE:"remove",
    STATUS:"status",
    DIAGNOSE:"diagnose"
  });

  var STATES=Object.freeze({
    OK:"ok",
    WARNING:"warning",
    ERROR:"error",
    LOADING:"loading",
    DISCONNECTED:"disconnected",
    NOT_OPENED:"not_opened"
  });

  var TABLES=Object.freeze({
    PERIODS:"periodos",
    PEOPLE:"personas",
    ENROLLMENTS:"matriculas_periodo",
    REQUIREMENTS:"requisitos_estudiante",
    CONTACTS:"contactos_estudiante",
    GRADES:"notas_titulacion",
    DIVISIONS:"divisiones_estudiante",
    PENDING_CHANGES:"cambios_pendientes",
    SYNC_STATE:"sync_estado",
    CACHE_VIEWS:"cache_views"
  });

  function text(value){
    return String(value==null?"":value).trim();
  }

  function nowISO(){
    return new Date().toISOString();
  }

  function array(value){
    return Array.isArray(value)?value:[];
  }

  function object(value){
    return (
      value &&
      typeof value==="object" &&
      !Array.isArray(value)
    )
      ? value
      : {};
  }

  function clone(value){
    if(
      value==null ||
      typeof value!=="object"
    ){
      return value;
    }

    try{
      if(
        typeof window.structuredClone===
        "function"
      ){
        return window.structuredClone(value);
      }
    }catch(error){}

    try{
      return JSON.parse(
        JSON.stringify(value)
      );
    }catch(innerError){
      return value;
    }
  }

  function makeId(prefix){
    sequence+=1;

    return (
      text(prefix||"bdlc")+
      "_"+
      Date.now().toString(36)+
      "_"+
      sequence.toString(36)
    );
  }

  function normalizeScreen(value){
    return text(value)
      .toLowerCase()
      .replace(
        /[^a-z0-9_-]+/g,
        ""
      )
      .replace(
        /^bdlocal[-_]?/,
        ""
      )
      .replace(
        /^con/,
        ""
      );
  }

  function normalizeError(
    error,
    fallbackCode
  ){
    var source=error||{};

    var message=
      typeof source==="string"
        ? source
        : text(
            source.message||
            source.error||
            source.detail
          );

    return {
      code:text(
        source.code||
        fallbackCode||
        "BDLOCAL_CONNECTION_ERROR"
      ),

      message:
        message||
        "Ocurrió un error en la comunicación con Base Local.",

      name:text(
        source.name||
        "Error"
      ),

      stage:text(
        source.stage||
        "communication"
      ),

      table:text(source.table),
      file:text(source.file),
      stack:text(source.stack)
    };
  }

  function countData(data){
    data=object(data);

    return {
      periods:array(
        data.periods||
        data.periodos
      ).length,

      students:array(
        data.students||
        data.estudiantes||
        data.rows||
        data.filas
      ).length,

      requirements:array(
        data.requirements||
        data.requisitos
      ).length,

      contacts:array(
        data.contacts||
        data.contactos
      ).length,

      grades:array(
        data.grades||
        data.notes||
        data.notas
      ).length
    };
  }

  function mark(response){
    try{
      Object.defineProperty(
        response,
        "__bdlocalConnectionContract",
        {
          value:true,
          enumerable:false
        }
      );
    }catch(error){
      response.__bdlocalConnectionContract=
        true;
    }

    return response;
  }

  function build(options){
    options=object(options);

    var data=
      object(options.data);

    var declared=
      object(
        options.meta &&
        options.meta.counts
      );

    var calculated=
      countData(data);

    Object.keys(
      calculated
    ).forEach(function(key){
      if(
        calculated[key]===0 &&
        Number(
          declared[key]||0
        )>0
      ){
        calculated[key]=
          Number(declared[key]);
      }
    });

    return mark({
      id:
        text(options.id)||
        makeId("message"),

      ok:
        options.ok!==false,

      state:
        text(options.state)||
        (
          options.ok===false
            ? STATES.ERROR
            : STATES.OK
        ),

      screen:
        normalizeScreen(
          options.screen
        ),

      operation:
        text(
          options.operation
        ).toLowerCase()||
        OPERATIONS.READ,

      revision:
        Number(
          options.revision||0
        ),

      periodoId:
        text(
          options.periodoId||
          options.periodId
        ),

      data:data,

      meta:Object.assign(
        {
          source:text(
            options.source||
            "BDLocalConexiones"
          ),

          generatedAt:
            nowISO(),

          tablesRead:[],
          fallbackUsed:false,
          durationMs:0,
          counts:calculated
        },

        object(options.meta),

        {
          counts:calculated
        }
      ),

      error:
        options.error
          ? normalizeError(
              options.error,
              options.code
            )
          : null
    });
  }

  function success(options){
    return build(
      Object.assign(
        {},
        object(options),
        {
          ok:true,
          error:null
        }
      )
    );
  }

  function failure(options){
    options=object(options);

    return build(
      Object.assign(
        {},
        options,
        {
          ok:false,
          state:STATES.ERROR,
          data:object(options.data),

          error:normalizeError(
            options.error||
            options.message,
            options.code
          )
        }
      )
    );
  }

  function normalize(
    value,
    defaults
  ){
    defaults=object(defaults);

    if(
      value &&
      value.__bdlocalConnectionContract===
      true
    ){
      return value;
    }

    if(
      value &&
      value.ok===false
    ){
      return failure(
        Object.assign(
          {},
          defaults,
          value,
          {
            error:
              value.error||
              value.message
          }
        )
      );
    }

    var data={};

    if(Array.isArray(value)){
      data.rows=value;
    }else if(
      value &&
      typeof value==="object"
    ){
      data=
        value.data &&
        typeof value.data==="object"
          ? value.data
          : value;
    }

    return success(
      Object.assign(
        {},
        defaults,
        value||{},
        {
          data:data,

          revision:Number(
            value &&
            (
              value.revision||
              value.cacheRevision||
              value.meta &&
              value.meta.revision
            )||
            defaults.revision||
            0
          ),

          source:text(
            value &&
            (
              value.source||
              value.meta &&
              value.meta.source
            )||
            defaults.source
          )
        }
      )
    );
  }

  function dispatch(
    name,
    detail
  ){
    var eventObject;

    try{
      eventObject=
        new CustomEvent(
          name,
          {
            detail:clone(
              detail||{}
            )
          }
        );
    }catch(error){
      try{
        eventObject=
          window.document
            .createEvent(
              "CustomEvent"
            );

        eventObject
          .initCustomEvent(
            name,
            false,
            false,
            clone(detail||{})
          );
      }catch(innerError){
        return false;
      }
    }

    window.dispatchEvent(
      eventObject
    );

    return true;
  }

  window.BDLocalConeContract={
    version:VERSION,

    EVENTS:EVENTS,
    OPERATIONS:OPERATIONS,
    STATES:STATES,
    TABLES:TABLES,

    text:text,
    nowISO:nowISO,
    array:array,
    object:object,
    clone:clone,
    makeId:makeId,

    normalizeScreen:
      normalizeScreen,

    normalizeError:
      normalizeError,

    countData:
      countData,

    success:
      success,

    failure:
      failure,

    normalize:
      normalize,

    dispatch:
      dispatch
  };

  dispatch(
    EVENTS.READY,
    {
      module:"contract",
      ok:true,
      version:VERSION,
      at:nowISO()
    }
  );
})(window);
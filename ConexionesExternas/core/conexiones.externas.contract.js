/* =========================================================
Nombre completo: conexiones.externas.contract.js
Ruta: /ConexionesExternas/core/conexiones.externas.contract.js
Función:
- Definir el contrato oficial de Firebase, Supabase y Google Sheets.
- Exigir operaciones manuales y lotes de máximo 25 cambios.
- Normalizar resultados, errores, eventos y nombres de proveedor.
- No leer ni escribir directamente en la base local.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-conexiones-externas";
  var MAX_BATCH_SIZE=25;

  var TARGETS=Object.freeze({
    FIREBASE:"firebase",
    SUPABASE:"supabase",
    GOOGLE:"google"
  });

  var EVENTS=Object.freeze({
    READY:"conexiones-externas:ready",
    STARTED:"conexiones-externas:started",
    FINISHED:"conexiones-externas:finished",
    ERROR:"conexiones-externas:error",
    STATUS_UPDATED:"conexiones-externas:status-updated",
    PAUSE_CHANGED:"conexiones-externas:pause-changed"
  });

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function object(value){return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}

  function normalizeTarget(value){
    value=text(value).toLowerCase().replace(/\s+/g,"_");
    if(value==="sheets"||value==="sheet"||value==="google_sheets"||value==="googlesheets"){return TARGETS.GOOGLE;}
    if(value==="firestore"){return TARGETS.FIREBASE;}
    return value;
  }

  function supported(value){
    value=normalizeTarget(value);
    return [TARGETS.FIREBASE,TARGETS.SUPABASE,TARGETS.GOOGLE].indexOf(value)>=0;
  }

  function safeBatch(value){
    value=Number(value||MAX_BATCH_SIZE);
    if(!Number.isFinite(value)||value<=0){value=MAX_BATCH_SIZE;}
    return Math.min(MAX_BATCH_SIZE,Math.max(1,Math.floor(value)));
  }

  function manualOptions(options){
    options=Object.assign({},object(options));
    options.manual=true;
    options.automatic=false;
    options.idleOnly=false;
    options.limit=safeBatch(options.limit||options.batchSize);
    options.batchSize=options.limit;
    options.source=text(options.source||"ConexionesExternas");
    if(options.target){options.target=normalizeTarget(options.target);}
    if(Array.isArray(options.targets)){
      options.targets=options.targets.map(normalizeTarget).filter(supported);
    }
    return options;
  }

  function normalizeError(error,code){
    error=error||{};
    return {
      code:text(error.code||code||"CONEXION_EXTERNA_ERROR"),
      message:text(typeof error==="string"?error:error.message||error.error||error.detail)||"Ocurrió un error en la conexión externa.",
      name:text(error.name||"Error"),
      target:normalizeTarget(error.target),
      stage:text(error.stage||"external-operation")
    };
  }

  function result(options){
    options=object(options);
    var target=normalizeTarget(options.target);
    return {
      ok:options.ok!==false,
      target:target,
      operation:text(options.operation||"status"),
      manualOnly:true,
      automatic:false,
      maxBatchSize:MAX_BATCH_SIZE,
      blocked:options.blocked===true,
      unsupported:options.unsupported===true,
      data:options.data===undefined?null:clone(options.data),
      message:text(options.message),
      error:options.error?normalizeError(options.error,options.code):null,
      at:text(options.at||now())
    };
  }

  function success(options){return result(Object.assign({},object(options),{ok:true,error:null}));}
  function failure(options){return result(Object.assign({},object(options),{ok:false,error:options&&options.error||options&&options.message}));}
  function unsupported(target,operation){
    target=normalizeTarget(target);
    return failure({
      target:target,
      operation:operation||"operation",
      blocked:true,
      unsupported:true,
      code:"EXTERNAL_OPERATION_UNSUPPORTED",
      message:"La operación no está disponible para "+target+"."
    });
  }

  function dispatch(name,detail){
    try{
      window.dispatchEvent(new CustomEvent(name,{detail:clone(detail||{})}));
      return true;
    }catch(error){return false;}
  }

  window.ConexionesExternasContract={
    version:VERSION,
    MAX_BATCH_SIZE:MAX_BATCH_SIZE,
    TARGETS:TARGETS,
    EVENTS:EVENTS,
    text:text,
    now:now,
    object:object,
    clone:clone,
    normalizeTarget:normalizeTarget,
    supported:supported,
    safeBatch:safeBatch,
    manualOptions:manualOptions,
    normalizeError:normalizeError,
    result:result,
    success:success,
    failure:failure,
    unsupported:unsupported,
    dispatch:dispatch
  };
})(window);

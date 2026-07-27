/* =========================================================
Nombre completo: carga.startup-metrics.js
Ruta: /Carga/carga.startup-metrics.js
Función:
- Registrar marcas de tiempo del arranque de la pantalla Carga.
- Medir cuándo Base Local, ConCarga y los períodos quedan disponibles.
- Exponer solo métricas locales de diagnóstico.
- No leer ni escribir servicios externos.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-startup-metrics";
  var state={
    version:VERSION,
    frameStartedAt:Date.now(),
    frameTimeOrigin:window.performance&&Number(window.performance.timeOrigin)||0,
    domReadyAt:0,
    bdlocalReadyAt:0,
    connectionReadyAt:0,
    periodsReadyAt:0,
    periodCount:null,
    lastError:"",
    details:{},
    updatedAt:""
  };

  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function mark(name,detail){
    if(!Object.prototype.hasOwnProperty.call(state,name)){return false;}
    if(!state[name]){state[name]=Date.now();}
    if(detail!==undefined){state.details[name]=clone(detail);}
    state.updatedAt=new Date().toISOString();
    return true;
  }
  function safe(fn,fallback){try{return fn();}catch(error){return fallback;}}
  function cacheStatus(){
    var U=window.BDLocalConUtils;
    var cache=U&&typeof U.readCache==="function"?safe(function(){return U.readCache();},{}):{};
    cache=cache&&typeof cache==="object"?cache:{};
    return {
      periods:Array.isArray(cache.periods)?cache.periods.length:0,
      students:Array.isArray(cache.students)?cache.students.length:0,
      requirements:Array.isArray(cache.requirements)?cache.requirements.length:0,
      revision:String(cache.meta&&(
        cache.meta.revision||cache.meta.cacheRevision||cache.meta.updatedAt
      )||"")
    };
  }
  function status(){
    var con=window.ConCarga||window.BDLocalCarga||null;
    var hub=window.BDLocalConexiones||null;
    var db=window.BL2DB||null;
    var screenDeps=window.BDLocalScreenDeps||null;
    return Object.assign({},clone(state),{
      now:Date.now(),
      documentReadyState:document.readyState,
      conCarga:con&&typeof con.status==="function"?safe(function(){return con.status();},null):null,
      connections:hub&&typeof hub.status==="function"?safe(function(){return hub.status();},null):null,
      database:db&&typeof db.meta==="function"?safe(function(){return db.meta();},null):null,
      screenDeps:screenDeps&&typeof screenDeps.status==="function"?safe(function(){return screenDeps.status();},null):null,
      cache:cacheStatus(),
      globals:{
        ConCarga:!!con,
        BDLocalConexiones:!!hub,
        BL2DB:!!db,
        BL2Core:!!window.BL2Core,
        BDLocalScreenDeps:!!screenDeps
      }
    });
  }

  window.addEventListener("carga:bdlocal-ready",function(event){
    mark("bdlocalReadyAt",event&&event.detail||{});
  });
  window.addEventListener("carga:connection-ready",function(event){
    mark("connectionReadyAt",event&&event.detail||{});
  });
  window.addEventListener("carga:periods-refreshed",function(event){
    var detail=event&&event.detail||{};
    state.periodCount=Number(detail.total||(
      Array.isArray(detail.periods)?detail.periods.length:0
    ));
    mark("periodsReadyAt",detail);
  });
  window.addEventListener("carga:bdlocal-error",function(event){
    var detail=event&&event.detail||{};
    state.lastError=String(detail.error||"Error de Base Local");
    state.updatedAt=new Date().toISOString();
  });

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",function(){mark("domReadyAt",{readyState:document.readyState});},{once:true});
  }else{
    mark("domReadyAt",{readyState:document.readyState});
  }

  window.CargaStartupMetrics={version:VERSION,mark:mark,status:status};
})(window,document);

/* =========================================================
Nombre completo: global.baselocal-fast.js
Ruta: /Global/global.baselocal-fast.js
Función:
- Permitir que Global use inmediatamente la caché compartida ya disponible.
- Preparar BDLocalConexiones en segundo plano sin bloquear la interfaz.
- Actualizar Global en el siguiente cuadro visual cuando cambia Base Local.
- Evitar el segundo render heredado de la misma revisión.
- No consultar IndexedDB ni servicios externos directamente.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-global-instant-cache";
  var eventsBound=false;
  var runtimeInstalled=false;
  var framePending=false;
  var pendingDetail=null;
  var warmup=null;
  var originalReady=null;
  var state={
    installed:false,
    connectorPrepared:false,
    runtimeInstalled:false,
    warmups:0,
    warmupErrors:0,
    events:0,
    renders:0,
    coalesced:0,
    duplicatesSkipped:0,
    lastRevision:"",
    lastRenderedRevision:"",
    lastRenderAt:0,
    lastDurationMs:0,
    lastError:"",
    updatedAt:""
  };

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function connector(){return window.ConGlobal||window.BDLocalGlobal||null;}
  function hub(){return window.BDLocalConexiones||null;}
  function utils(){return window.BDLocalConUtils||null;}

  function cache(){
    var current=utils();
    if(!current||typeof current.readCache!=="function"){
      return {meta:{},periods:[],students:[],requirements:[]};
    }
    try{return current.readCache()||{meta:{},periods:[],students:[],requirements:[]};}
    catch(error){return {meta:{},periods:[],students:[],requirements:[]};}
  }

  function revisionOf(value){
    value=value||cache();
    var meta=value.meta||{};
    return text(
      meta.revision||
      meta.cacheRevision||
      meta.updatedAt||
      value.generatedAt||
      ""
    );
  }

  function hasData(value){
    value=value||cache();
    var current=utils();
    if(current&&typeof current.hasData==="function"){
      try{return current.hasData(value);}
      catch(error){}
    }
    return [value.periods,value.students,value.requirements].some(function(rows){return Array.isArray(rows)&&rows.length>0;});
  }

  function connectorStatus(){
    var api=connector();
    var report={};
    try{report=api&&typeof api.status==="function"?api.status()||{}:{};}
    catch(error){report={ok:false,error:error.message||String(error)};}
    var current=cache();
    return Object.assign({},report,{
      ok:!!api,
      ready:!!api,
      instant:true,
      cacheAvailable:hasData(current),
      revision:revisionOf(current),
      backgroundWarmup:!!warmup,
      source:"ConGlobal",
      version:VERSION
    });
  }

  function warm(options){
    if(warmup){return warmup;}
    var api=connector();
    var currentHub=hub();
    var operation=null;

    if(originalReady){
      operation=function(){return originalReady.call(api,options||{});};
    }else if(currentHub&&typeof currentHub.ready==="function"){
      operation=function(){return currentHub.ready(options||{});};
    }

    if(!operation){return Promise.resolve(connectorStatus());}

    state.warmups+=1;
    warmup=Promise.resolve().then(operation).then(function(result){
      state.lastError="";
      return result||connectorStatus();
    }).catch(function(error){
      state.warmupErrors+=1;
      state.lastError=error&&error.message?error.message:String(error);
      return connectorStatus();
    }).finally(function(){
      warmup=null;
      state.updatedAt=now();
    });
    return warmup;
  }

  function prepareConnector(){
    var api=connector();
    if(!api){return false;}
    if(api.__globalInstantReady){state.connectorPrepared=true;return true;}

    originalReady=typeof api.ready==="function"?api.ready:null;
    api.__globalInstantOriginalReady=originalReady;
    api.ready=function(options){
      warm(Object.assign({force:false,sharedTimeout:500},options||{}));
      return Promise.resolve(connectorStatus());
    };
    api.__globalInstantReady=true;
    state.connectorPrepared=true;
    state.installed=true;
    state.updatedAt=now();
    return true;
  }

  function currentRevision(){return revisionOf(cache());}

  function installRuntime(){
    var app=window.GlobalApp||null;
    if(!app||typeof app.render!=="function"){return false;}
    if(app.__globalInstantRender){runtimeInstalled=true;state.runtimeInstalled=true;return true;}

    var originalRender=app.render;
    app.render=function(){
      var revision=currentRevision();
      var systemDuplicate=
        state.lastRenderedRevision&&
        revision===state.lastRenderedRevision&&
        Date.now()-state.lastRenderAt<700&&
        app.__globalInstantSystemInvalidation===true;

      if(systemDuplicate){
        app.__globalInstantSystemInvalidation=false;
        state.duplicatesSkipped+=1;
        return Promise.resolve(null);
      }

      var started=Date.now();
      var result;
      try{result=originalRender.apply(app,arguments);}
      catch(error){result=Promise.reject(error);}

      return Promise.resolve(result).then(function(value){
        state.lastRenderedRevision=currentRevision();
        state.lastRenderAt=Date.now();
        state.lastDurationMs=Date.now()-started;
        state.renders+=1;
        state.lastError="";
        state.updatedAt=now();
        return value;
      }).catch(function(error){
        state.lastError=error&&error.message?error.message:String(error);
        state.updatedAt=now();
        throw error;
      });
    };
    app.render.__globalInstantOriginal=originalRender;
    app.__globalInstantRender=true;
    runtimeInstalled=true;
    state.runtimeInstalled=true;

    if(pendingDetail){
      var detail=pendingDetail;
      pendingDetail=null;
      schedule(detail);
    }
    return true;
  }

  function renderLatest(detail){
    var started=Date.now();
    var revision=currentRevision();
    state.lastRevision=revision;

    if(window.GlobalCore&&typeof window.GlobalCore.invalidate==="function"){
      try{window.GlobalCore.invalidate();}
      catch(error){}
    }

    if(!installRuntime()){
      pendingDetail=detail||{};
      return false;
    }

    window.GlobalApp.__globalInstantSystemInvalidation=false;
    return Promise.resolve(window.GlobalApp.render()).then(function(result){
      state.lastDurationMs=Date.now()-started;
      state.updatedAt=now();
      window.GlobalApp.__globalInstantSystemInvalidation=true;
      return result;
    }).catch(function(error){
      state.lastError=error&&error.message?error.message:String(error);
      state.updatedAt=now();
      return null;
    });
  }

  function schedule(detail){
    pendingDetail=detail||pendingDetail||{};
    state.events+=1;
    if(framePending){state.coalesced+=1;return false;}
    framePending=true;

    var run=function(){
      framePending=false;
      var current=pendingDetail||{};
      pendingDetail=null;
      renderLatest(current);
    };

    if(typeof window.requestAnimationFrame==="function"){
      window.requestAnimationFrame(run);
    }else{
      window.setTimeout(run,0);
    }
    return true;
  }

  function bindEvents(){
    if(eventsBound){return;}
    eventsBound=true;
    [
      "bdlocal:pantallas:updated",
      "bdlocal:conexiones-cache-updated",
      "requisitos:bl:snapshot-changed"
    ].forEach(function(name){
      window.addEventListener(name,function(event){schedule(event&&event.detail||{reason:name});});
    });
    window.addEventListener("global:bootstrap-ready",function(){installRuntime();});
  }

  function status(){
    return Object.assign({
      version:VERSION,
      cacheAvailable:hasData(cache()),
      revision:currentRevision(),
      warming:!!warmup,
      framePending:framePending
    },state);
  }

  window.GlobalBaseLocalFast={
    version:VERSION,
    prepareConnector:prepareConnector,
    installRuntime:installRuntime,
    schedule:schedule,
    warm:warm,
    status:status
  };

  bindEvents();
  prepareConnector();
})(window);
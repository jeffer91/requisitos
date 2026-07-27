/* =========================================================
Nombre completo: bdl.pantallas.index.js
Ruta: /BDLocal/pantallas/bdl.pantallas.index.js
Función:
- Exponer la puerta oficial de Base Local para todas las pantallas.
- Unificar registro, cliente, caché, métricas y diagnóstico interno.
- Mantener compatibilidad temporal con BDLocal/conexiones.
- No ejecutar sincronización contra internet.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-base-local-pantallas";
  var bound=false;

  function contract(){return window.BDLocalPantallasContract||null;}
  function registry(){return window.BDLocalPantallasRegistry||null;}
  function client(){return window.BDLocalPantallasClient||null;}
  function monitor(){return window.BDLocalPantallasMonitor||null;}
  function hub(){return window.BDLocalConexiones||null;}

  function dispatch(name,detail){
    var current=contract();
    if(current&&typeof current.dispatch==="function"){
      return current.dispatch(name,detail||{});
    }
    try{
      window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));
      return true;
    }catch(error){return false;}
  }

  function requireClient(){
    var value=client();
    if(!value){throw new Error("BDLocalPantallasClient no está disponible.");}
    return value;
  }

  function safeStatus(target,arg){
    try{return target&&typeof target.status==="function"?target.status(arg)||{}:{};}
    catch(error){return {ok:false,error:error&&error.message?error.message:String(error)};}
  }

  function list(){
    var current=registry();
    return current&&typeof current.list==="function"?current.list():[];
  }

  function status(screen){
    var registered=list();
    var hubStatus=safeStatus(hub());
    var clientStatus=safeStatus(client(),screen);
    var monitorStatus=safeStatus(monitor());
    var registryStatus=safeStatus(registry());

    return {
      ok:!!hub()&&!!client()&&!!registry(),
      version:VERSION,
      namespace:"BaseLocal.Pantallas",
      source:"BDLocal/pantallas/bdl.pantallas.index.js",
      offlineCapable:true,
      externalConnections:false,
      legacyPathActive:true,
      compatibilityGlobals:[
        "BDLocalConexiones",
        "BDLocalConeRegistry",
        "BDLocalConnectionClient",
        "BDLocalConnectionMonitor"
      ],
      screen:screen||"",
      screens:registered,
      totalScreens:registered.length,
      hub:hubStatus,
      registry:registryStatus,
      client:clientStatus,
      monitor:monitorStatus,
      updatedAt:new Date().toISOString()
    };
  }

  function ready(screen){
    var operation;
    if(screen){
      operation=requireClient().ready(screen);
    }else if(hub()&&typeof hub().ready==="function"){
      operation=hub().ready();
    }else{
      operation=Promise.resolve(null);
    }

    return Promise.resolve(operation).then(function(){
      var report=status(screen);
      dispatch(contract()&&contract().EVENTS?contract().EVENTS.READY:"bdlocal:pantallas:ready",report);
      return report;
    });
  }

  function bindLegacyEvents(){
    if(bound){return;}
    bound=true;

    window.addEventListener("bdlocal:connections:updated",function(event){
      dispatch(
        contract()&&contract().EVENTS?contract().EVENTS.UPDATED:"bdlocal:pantallas:updated",
        Object.assign({},event&&event.detail||{},
          {namespace:"BaseLocal.Pantallas",compatibility:true})
      );
    });

    window.addEventListener("bdlocal:connections:monitor-updated",function(event){
      dispatch(
        contract()&&contract().EVENTS?contract().EVENTS.MONITOR_UPDATED:"bdlocal:pantallas:monitor-updated",
        Object.assign({},event&&event.detail||{},
          {namespace:"BaseLocal.Pantallas",compatibility:true})
      );
    });
  }

  var api={
    version:VERSION,
    source:"BDLocal/pantallas/bdl.pantallas.index.js",
    namespace:"BaseLocal.Pantallas",
    ready:ready,
    status:status,
    listScreens:list,
    getScreen:function(name){return registry()&&registry().get?registry().get(name):null;},
    resolveScreen:function(name){return registry()&&registry().resolve?registry().resolve(name):null;},
    read:function(screen,filters){return requireClient().read(screen,filters||{});},
    refresh:function(screen,options){return requireClient().refresh(screen,options||{});},
    invoke:function(screen,operation,payload){return requireClient().invoke(screen,operation,payload);},
    save:function(screen,payload){return requireClient().save(screen,payload);},
    update:function(screen,payload){return requireClient().update(screen,payload);},
    remove:function(screen,payload){return requireClient().remove(screen,payload);},
    diagnose:function(screen,options){return requireClient().diagnose(screen,options||{});},
    runDiagnostics:function(options){
      var current=monitor();
      return current&&typeof current.run==="function"
        ?current.run(options||{})
        :Promise.reject(new Error("BDLocalPantallasMonitor no está disponible."));
    },
    metrics:function(){
      var current=hub();
      return current&&typeof current.metrics==="function"?current.metrics():{};
    },
    onUpdated:function(callback){return requireClient().onUpdated(callback);}
  };

  window.BDLocalPantallas=api;
  bindLegacyEvents();
})(window);

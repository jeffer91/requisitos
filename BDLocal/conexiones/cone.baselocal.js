/* =========================================================
Nombre completo: cone.baselocal.js
Ruta o ubicación: /BDLocal/conexiones/cone.baselocal.js
Función o funciones:
- Ser el conector oficial de la pantalla Centro de Control BDLocal.
- Exponer arranque, lectura, actualización, período activo y diagnóstico.
- Evitar que la pantalla tenga que coordinar directamente BL2DB, BL2Core y servicios.
Con qué se conecta:
- BDLocal/bl2.app.js
- BDLocal/bl2.core.js
- BDLocal/diagnostics/bdl.diagnostics.general.js
- BDLocal/conexiones/cone.index.js
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-screen-connector";
  var SCREEN="baselocal";
  var SOURCE="ConBaseLocal";
  var HUB=window.BDLocalConexiones||null;
  var state={ready:false,loading:false,promise:null,error:"",loadedAt:"",reads:0,refreshes:0};

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function app(){return window.BL2App||null;}
  function core(){return window.BL2Core||null;}

  function registerDefinition(){
    var registry=window.BDLocalConeRegistry;
    if(!registry||typeof registry.register!=="function"){return null;}
    return registry.register(SCREEN,{
      label:"Base Local",
      global:"ConBaseLocal",
      file:"cone.baselocal.js",
      pathHints:["/bdlocal/bl2.html","/bdlocal/"],
      aliases:["bl","bl2","base_local","bdlocal"],
      canRead:true,
      canWrite:true,
      operations:["ready","read","refresh","update","status","diagnose"],
      tables:[
        "periodos","personas","matriculas_periodo","requisitos_estudiante",
        "contactos_estudiante","notas_titulacion","divisiones_estudiante",
        "importaciones","cambios_pendientes","evaluaciones_titulacion"
      ],
      description:"Administra el Centro de Control BDLocal mediante BL2App y BL2Core."
    });
  }

  function status(){
    var appState={};
    try{appState=app()&&typeof app().getState==="function"?app().getState()||{}:{};}catch(error){}
    return {
      ok:state.ready&&!state.error,
      ready:state.ready,
      loading:state.loading,
      version:VERSION,
      screen:SCREEN,
      source:SOURCE,
      loadedAt:state.loadedAt,
      error:state.error,
      reads:state.reads,
      refreshes:state.refreshes,
      app:!!app(),
      core:!!core(),
      appState:appState
    };
  }

  function ready(options){
    options=options||{};
    if(state.ready&&!options.force){return Promise.resolve(status());}
    if(state.promise&&!options.force){return state.promise;}
    state.loading=true;
    state.error="";

    state.promise=Promise.resolve()
      .then(function(){
        if(app()&&typeof app().boot==="function"){return app().boot();}
        if(core()&&typeof core().init==="function"){return core().init();}
        throw new Error("BL2App y BL2Core no están disponibles.");
      })
      .then(function(){
        state.ready=true;
        state.loadedAt=now();
        return status();
      })
      .catch(function(error){
        state.ready=false;
        state.error=error&&error.message?error.message:String(error);
        return status();
      })
      .finally(function(){state.loading=false;state.promise=null;});

    return state.promise;
  }

  function read(options){
    options=options||{};
    state.reads+=1;
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Base Local no está lista.");}
      var currentCore=core();
      var currentApp=app();
      return Promise.all([
        currentCore&&typeof currentCore.getPeriods==="function"?currentCore.getPeriods():[],
        currentCore&&typeof currentCore.getActivePeriod==="function"?currentCore.getActivePeriod():null,
        options.periodoId&&currentCore&&typeof currentCore.getSummary==="function"
          ?currentCore.getSummary(options.periodoId)
          :Promise.resolve({})
      ]).then(function(values){
        return {
          ok:true,
          source:SOURCE,
          screen:SCREEN,
          data:{
            periods:Array.isArray(values[0])?values[0]:[],
            activePeriod:values[1]||null,
            summary:values[2]||{},
            appState:currentApp&&typeof currentApp.getState==="function"?currentApp.getState():{}
          },
          meta:{generatedAt:now(),version:VERSION}
        };
      });
    });
  }

  function refresh(options){
    options=options||{};
    state.refreshes+=1;
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Base Local no está lista.");}
      if(app()&&typeof app().refresh==="function"){
        return app().refresh({force:options.force===true,reason:options.reason||"cone.baselocal"});
      }
      if(HUB&&typeof HUB.refreshCache==="function"){
        return HUB.refreshCache(Object.assign({source:"cone.baselocal",immediate:true},options));
      }
      return null;
    }).then(function(){return status();});
  }

  function setPeriod(periodoId,label){
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Base Local no está lista.");}
      if(!app()||typeof app().setPeriod!=="function"){
        throw new Error("BL2App.setPeriod no está disponible.");
      }
      return app().setPeriod(text(periodoId),text(label||periodoId));
    });
  }

  function diagnose(options){
    return ready().then(function(){
      var diagnostic=window.BDLDiagnosticsGeneral;
      return diagnostic&&typeof diagnostic.run==="function"
        ?diagnostic.run(Object.assign({scope:"baselocal"},options||{}))
        :{ok:false,error:"BDLDiagnosticsGeneral no está disponible."};
    });
  }

  var api={
    version:VERSION,screen:SCREEN,source:SOURCE,
    ready:ready,read:read,refresh:refresh,reload:refresh,status:status,
    setPeriod:setPeriod,update:setPeriod,diagnose:diagnose
  };

  window.ConBaseLocal=api;
  window.BDLocalConeBaseLocal=api;
  registerDefinition();
  if(HUB&&typeof HUB.register==="function"){HUB.register(SCREEN,api);}
})(window);
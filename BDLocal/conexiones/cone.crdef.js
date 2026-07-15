/* =========================================================
Nombre completo: cone.crdef.js
Ruta: /BDLocal/conexiones/cone.crdef.js
Función:
- Ser la única conexión de Cr-def con BDLocal.
- Leer períodos, estudiantes, requisitos y notas mediante servicios.
- Evitar que Cr-def abra directamente la base local.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.1.0-service-only";
  var SCREEN="cr_def";
  var SOURCE="ConCrDef";
  var state={ready:false,promise:null,error:"",reads:0,refreshes:0,loadedAt:""};

  function now(){return new Date().toISOString();}
  function hub(){return window.BDLocalConexiones||null;}
  function legacy(){return window.ConDefensas||window.BDLocalConeDefensas||null;}
  function service(){
    return window.BDLServiceDefensas||(
      window.BDLServices&&typeof window.BDLServices.get==="function"
        ?window.BDLServices.get("defensas")
        :null
    );
  }

  function register(){
    var registry=window.BDLocalConeRegistry;
    if(registry&&typeof registry.register==="function"){
      registry.register(SCREEN,{
        label:"Cr-def",global:"ConCrDef",file:"cone.crdef.js",
        pathHints:["/cr-def/","cr-def.html"],aliases:["crdef","cr-def","sacar_n"],
        canRead:true,canWrite:false,
        operations:["ready","read","refresh","status","diagnose"],
        tables:["periodos","personas","matriculas_periodo","requisitos_estudiante","notas_titulacion","divisiones_estudiante"],
        description:"Conector exclusivo de Cr-def."
      });
    }
  }

  function screenReady(){
    if(window.BDLScreenDepsReady){return Promise.resolve(window.BDLScreenDepsReady);}
    if(window.BDLocalScreenDeps&&typeof window.BDLocalScreenDeps.ready==="function"){
      return window.BDLocalScreenDeps.ready();
    }
    return Promise.resolve(null);
  }

  function loadLegacy(){
    if(legacy()){return Promise.resolve(legacy());}
    var base=document.currentScript&&document.currentScript.src||document.baseURI;
    var url=new URL("cone.defensas.js",base).href;
    return new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=url;
      script.async=false;
      script.onload=function(){legacy()?resolve(legacy()):reject(new Error("ConDefensas no quedó disponible."));};
      script.onerror=function(){reject(new Error("No se pudo cargar cone.defensas.js."));};
      document.head.appendChild(script);
    });
  }

  function status(){
    return {
      ok:state.ready&&!state.error,ready:state.ready,version:VERSION,
      screen:SCREEN,source:SOURCE,error:state.error,reads:state.reads,
      refreshes:state.refreshes,loadedAt:state.loadedAt,
      dependency:!!legacy(),service:!!service()
    };
  }

  function ready(options){
    options=options||{};
    if(state.ready&&!options.force){return Promise.resolve(status());}
    if(state.promise&&!options.force){return state.promise;}
    state.error="";
    state.promise=screenReady()
      .then(loadLegacy)
      .then(function(api){return api&&typeof api.ready==="function"?api.ready(options):api;})
      .then(function(){
        if(!service()){throw new Error("BDLServiceDefensas no está disponible para Cr-def.");}
        state.ready=true;
        state.loadedAt=now();
        register();
        var currentHub=hub();
        if(currentHub&&typeof currentHub.register==="function"){currentHub.register(SCREEN,api);}
        return status();
      })
      .catch(function(error){
        state.ready=false;
        state.error=error&&error.message?error.message:String(error);
        return status();
      })
      .finally(function(){state.promise=null;});
    return state.promise;
  }

  function listPeriods(){
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Cr-def no está listo.");}
      var current=legacy();
      if(current&&typeof current.listPeriods==="function"){return current.listPeriods()||[];}
      if(current&&typeof current.getPeriods==="function"){return current.getPeriods()||[];}
      return [];
    });
  }

  function listStudents(options){
    options=Object.assign({matricula:""},options||{});
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Cr-def no está listo.");}
      var current=service();
      if(current&&typeof current.getFiltered==="function"){return current.getFiltered(options);}
      if(current&&typeof current.list==="function"){return current.list(options);}
      return [];
    });
  }

  function listRequirements(options){
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Cr-def no está listo.");}
      var current=legacy();
      if(current&&typeof current.listRequirements==="function"){return current.listRequirements(options||{})||[];}
      if(current&&typeof current.getRequirements==="function"){return current.getRequirements(options||{})||[];}
      return [];
    });
  }

  function read(options){
    state.reads+=1;
    options=options||{};
    return Promise.all([listPeriods(),listStudents(options),listRequirements(options)]).then(function(values){
      return {
        ok:true,source:SOURCE,screen:SCREEN,
        data:{periods:values[0]||[],students:values[1]||[],requirements:values[2]||[]},
        meta:{generatedAt:now(),version:VERSION,readOnly:true}
      };
    });
  }

  function refresh(options){
    state.refreshes+=1;
    return ready().then(function(){
      var current=legacy();
      return current&&typeof current.refresh==="function"?current.refresh(options||{}):null;
    }).then(function(){return ready({force:true});});
  }

  var api={
    version:VERSION,screen:SCREEN,source:SOURCE,
    ready:ready,read:read,refresh:refresh,reload:refresh,status:status,
    listPeriods:listPeriods,getPeriods:listPeriods,
    listStudents:listStudents,getStudents:listStudents,
    listRequirements:listRequirements,getRequirements:listRequirements
  };

  window.ConCrDef=api;
  window.BDLocalConeCrDef=api;
  register();
  var currentHub=hub();
  if(currentHub&&typeof currentHub.register==="function"){currentHub.register(SCREEN,api);}
})(window,document);
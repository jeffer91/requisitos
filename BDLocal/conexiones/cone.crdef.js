/* =========================================================
Nombre completo: cone.crdef.js
Ruta: /BDLocal/conexiones/cone.crdef.js
Función:
- Ser el conector oficial de Cr-def.
- Leer períodos, estudiantes y requisitos mediante ConDefensas.
- Impedir que Cr-def consulte IndexedDB directamente.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-screen-connector";
  var SCREEN="cr_def";
  var SOURCE="ConCrDef";
  var HUB=window.BDLocalConexiones||null;
  var state={ready:false,promise:null,error:"",reads:0,refreshes:0};

  function target(){return window.ConDefensas||window.BDLocalConeDefensas||null;}
  function now(){return new Date().toISOString();}

  function registerDefinition(){
    var registry=window.BDLocalConeRegistry;
    if(!registry||typeof registry.register!=="function"){return;}
    registry.register(SCREEN,{
      label:"Cr-def",
      global:"ConCrDef",
      file:"cone.crdef.js",
      pathHints:["/cr-def/","cr-def.html"],
      aliases:["crdef","cr-def","sacar_n"],
      canRead:true,
      canWrite:false,
      operations:["ready","read","refresh","status"],
      tables:["periodos","personas","matriculas_periodo","requisitos_estudiante","notas_titulacion","divisiones_estudiante"],
      description:"Conector exclusivo de Cr-def."
    });
  }

  function loadDependency(){
    if(target()){return Promise.resolve(target());}
    var base=document.currentScript&&document.currentScript.src||document.baseURI;
    var url=new URL("cone.defensas.js",base).href;
    return new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=url;
      script.async=false;
      script.onload=function(){target()?resolve(target()):reject(new Error("ConDefensas no quedó disponible."));};
      script.onerror=function(){reject(new Error("No se pudo cargar cone.defensas.js."));};
      (document.head||document.documentElement).appendChild(script);
    });
  }

  function status(){
    return {
      ok:state.ready&&!state.error,
      ready:state.ready,
      version:VERSION,
      screen:SCREEN,
      source:SOURCE,
      error:state.error,
      reads:state.reads,
      refreshes:state.refreshes,
      dependency:!!target()
    };
  }

  function ready(options){
    options=options||{};
    if(state.ready&&!options.force){return Promise.resolve(status());}
    if(state.promise&&!options.force){return state.promise;}
    state.error="";
    state.promise=loadDependency()
      .then(function(api){return api&&typeof api.ready==="function"?api.ready(options):api;})
      .then(function(){state.ready=true;return status();})
      .catch(function(error){state.ready=false;state.error=error&&error.message?error.message:String(error);return status();})
      .finally(function(){state.promise=null;});
    return state.promise;
  }

  function method(names){
    var api=target();
    for(var i=0;i<names.length;i+=1){if(api&&typeof api[names[i]]==="function"){return api[names[i]];}}
    return null;
  }

  function call(names,args,fallback){
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Cr-def no está listo.");}
      var fn=method(names);
      return fn?fn.apply(target(),args||[]):fallback;
    });
  }

  function listPeriods(){return call(["listPeriodsSync","listPeriods","getPeriods"],[],[]);}
  function listStudents(options){return call(["getStudentsSync","listStudents","getStudents","list"],[options||{}],[]);}
  function listRequirements(options){return call(["listRequirementsSync","listRequirements","getRequirements"],[options||{}],[]);}

  function read(options){
    state.reads+=1;
    options=options||{};
    return Promise.all([listPeriods(),listStudents(options),listRequirements(options)]).then(function(values){
      var students=Array.isArray(values[1])?values[1]:(values[1]&&Array.isArray(values[1].rows)?values[1].rows:[]);
      return {
        ok:true,source:SOURCE,screen:SCREEN,
        data:{periods:Array.isArray(values[0])?values[0]:[],students:students,requirements:Array.isArray(values[2])?values[2]:[]},
        meta:{generatedAt:now(),version:VERSION,readOnly:true}
      };
    });
  }

  function refresh(options){
    state.refreshes+=1;
    return call(["refresh","reload"],[options||{}],null).then(function(){return status();});
  }

  var api={version:VERSION,screen:SCREEN,source:SOURCE,ready:ready,read:read,refresh:refresh,reload:refresh,status:status,listPeriods:listPeriods,getPeriods:listPeriods,listStudents:listStudents,getStudents:listStudents,listRequirements:listRequirements,getRequirements:listRequirements};
  window.ConCrDef=api;
  window.BDLocalConeCrDef=api;
  registerDefinition();
  if(HUB&&typeof HUB.register==="function"){HUB.register(SCREEN,api);}
})(window,document);
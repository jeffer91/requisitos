/* =========================================================
Nombre completo: cone.defart.js
Ruta o ubicación: /BDLocal/conexiones/cone.defart.js
Función o funciones:
- Ser el conector oficial de la pantalla Defart.
- Separar la identidad de la pantalla del conector legacy cone.defensas.js.
- Delegar lecturas y escrituras al servicio de Defensas sin acceso directo a IndexedDB.
Con qué se conecta:
- BDLocal/conexiones/cone.defensas.js
- BDLocal/services/bdl.service.defensas.js
- defart/defart.html
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-screen-connector";
  var SCREEN="defart";
  var SOURCE="ConDefart";
  var HUB=window.BDLocalConexiones||null;
  var state={ready:false,loading:false,promise:null,error:"",loadedAt:"",reads:0,writes:0};

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function target(){return window.ConDefensas||window.BDLocalConeDefensas||null;}
  function service(){
    return window.BDLServiceDefensas||(
      window.BDLServices&&typeof window.BDLServices.get==="function"
        ?window.BDLServices.get("defensas")
        :null
    );
  }

  function registerDefinition(){
    var registry=window.BDLocalConeRegistry;
    if(!registry||typeof registry.register!=="function"){return null;}
    return registry.register(SCREEN,{
      label:"Defensas",
      global:"ConDefart",
      file:"cone.defart.js",
      pathHints:["/defart/","defart.html"],
      aliases:["defart","pantalla_defensas"],
      canRead:true,
      canWrite:true,
      operations:["ready","read","save","update","refresh","status","diagnose"],
      tables:[
        "periodos","personas","matriculas_periodo","requisitos_estudiante",
        "notas_titulacion","divisiones_estudiante","cambios_pendientes"
      ],
      description:"Conector exclusivo de la pantalla Defart."
    });
  }

  function scriptUrl(){
    try{return new URL("cone.defensas.js",document.currentScript&&document.currentScript.src||document.baseURI).href;}
    catch(error){return "cone.defensas.js";}
  }

  function loadLegacy(){
    if(target()){return Promise.resolve(target());}
    var url=scriptUrl();
    var existing=Array.prototype.slice.call(document.scripts||[]).some(function(item){return item.src===url;});
    if(existing){
      return new Promise(function(resolve,reject){
        var started=Date.now();
        (function wait(){
          if(target()){resolve(target());return;}
          if(Date.now()-started>15000){reject(new Error("cone.defensas.js no terminó de cargar."));return;}
          window.setTimeout(wait,40);
        })();
      });
    }
    return new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=url;
      script.async=false;
      script.onload=function(){target()?resolve(target()):reject(new Error("cone.defensas.js no expuso ConDefensas."));};
      script.onerror=function(){reject(new Error("No se pudo cargar cone.defensas.js."));};
      (document.head||document.documentElement).appendChild(script);
    });
  }

  function status(){
    var inherited={};
    try{inherited=target()&&typeof target().status==="function"?target().status()||{}:{};}catch(error){}
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
      writes:state.writes,
      service:!!service(),
      dependency:!!target(),
      dependencyStatus:inherited
    };
  }

  function ready(options){
    options=options||{};
    if(state.ready&&!options.force){return Promise.resolve(status());}
    if(state.promise&&!options.force){return state.promise;}
    state.loading=true;
    state.error="";
    state.promise=loadLegacy()
      .then(function(current){
        return current&&typeof current.ready==="function"?current.ready(options):current;
      })
      .then(function(){
        if(!target()&&!service()){throw new Error("Defensas no dispone de conector ni servicio.");}
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

  function firstMethod(object,names){
    names=Array.isArray(names)?names:[];
    for(var i=0;i<names.length;i+=1){
      if(object&&typeof object[names[i]]==="function"){return object[names[i]];}
    }
    return null;
  }

  function call(names,args,fallback){
    args=Array.isArray(args)?args:[];
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Defart no está listo.");}
      var current=target()||service();
      var method=firstMethod(current,names);
      if(!method){
        if(fallback!==undefined){return fallback;}
        throw new Error("Defart no dispone de la operación "+names.join("/")+".");
      }
      return method.apply(current,args);
    });
  }

  function listPeriods(){return call(["listPeriodsSync","listPeriods","getPeriods","periods"],[],[]);}
  function listStudents(options){return call(["getStudentsSync","listStudents","getStudents","list"],[options||{}],[]);}
  function getPage(options){return call(["getPage","page","getFiltered","list"],[options||{}],{rows:[],total:0});}
  function getSummary(options){return call(["getSummary","summary"],[options||{}],{});}

  function read(options){
    options=options||{};
    state.reads+=1;
    return Promise.all([listPeriods(),listStudents(options),getSummary(options)]).then(function(values){
      var students=Array.isArray(values[1])?values[1]:(values[1]&&Array.isArray(values[1].rows)?values[1].rows:[]);
      return {
        ok:true,source:SOURCE,screen:SCREEN,
        data:{periods:Array.isArray(values[0])?values[0]:[],students:students,summary:values[2]||{}},
        meta:{generatedAt:now(),version:VERSION}
      };
    });
  }

  function save(payload,context){
    state.writes+=1;
    return call(["save","saveNote","saveNota","update"],[payload||{},context||{}]);
  }

  function update(payload,context){return save(payload,context);}

  function refresh(options){
    options=options||{};
    return call(["refresh","reload"],[options],null).then(function(){return status();});
  }

  var api={
    version:VERSION,screen:SCREEN,source:SOURCE,
    ready:ready,read:read,refresh:refresh,reload:refresh,status:status,
    listPeriods:listPeriods,getPeriods:listPeriods,
    listStudents:listStudents,getStudents:listStudents,
    getPage:getPage,getSummary:getSummary,
    save:save,update:update
  };

  window.ConDefart=api;
  window.BDLocalConeDefart=api;
  registerDefinition();
  if(HUB&&typeof HUB.register==="function"){HUB.register(SCREEN,api);}
})(window,document);
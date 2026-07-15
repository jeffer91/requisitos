/* =========================================================
Nombre completo: cone.defart.js
Ruta o ubicación: /BDLocal/conexiones/cone.defart.js
Función o funciones:
- Ser la única conexión de Defart con BDLocal.
- Leer páginas y notas mediante BDLServiceDefensas.
- Guardar notas y registrar cambios pendientes desde el conector.
- Mantener cone.defensas.js solo como dependencia interna de compatibilidad.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.1.0-service-write";
  var SCREEN="defart";
  var SOURCE="ConDefart";
  var state={ready:false,loading:false,promise:null,error:"",loadedAt:"",reads:0,writes:0};

  function text(value){return String(value==null?"":value).trim();}
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
  function changesRepo(){
    return window.BDLRepoCambios||(
      window.BDLRepositories&&typeof window.BDLRepositories.get==="function"
        ?window.BDLRepositories.get("cambios")
        :null
    );
  }

  function register(){
    var registry=window.BDLocalConeRegistry;
    if(registry&&typeof registry.register==="function"){
      registry.register(SCREEN,{
        label:"Defensas",global:"ConDefart",file:"cone.defart.js",
        pathHints:["/defart/","defart.html"],aliases:["defart","pantalla_defensas"],
        canRead:true,canWrite:true,
        operations:["ready","read","save","update","refresh","status","diagnose"],
        tables:["periodos","personas","matriculas_periodo","requisitos_estudiante","notas_titulacion","divisiones_estudiante","cambios_pendientes"],
        description:"Conector exclusivo de la pantalla Defart."
      });
    }
  }

  function screenReady(){
    if(window.BDLScreenDepsReady){return Promise.resolve(window.BDLScreenDepsReady);}
    if(window.BDLocalScreenDeps&&typeof window.BDLocalScreenDeps.ready==="function"){return window.BDLocalScreenDeps.ready();}
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
    var inherited={};
    try{inherited=legacy()&&typeof legacy().status==="function"?legacy().status()||{}:{};}catch(error){}
    return {
      ok:state.ready&&!state.error,ready:state.ready,loading:state.loading,
      version:VERSION,screen:SCREEN,source:SOURCE,loadedAt:state.loadedAt,
      error:state.error,reads:state.reads,writes:state.writes,
      service:!!service(),dependency:!!legacy(),dependencyStatus:inherited
    };
  }

  function ready(options){
    options=options||{};
    if(state.ready&&!options.force){return Promise.resolve(status());}
    if(state.promise&&!options.force){return state.promise;}
    state.loading=true;
    state.error="";
    state.promise=screenReady()
      .then(loadLegacy)
      .then(function(api){return api&&typeof api.ready==="function"?api.ready(options):api;})
      .then(function(){
        if(!service()){throw new Error("BDLServiceDefensas no está disponible para Defart.");}
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
      .finally(function(){state.loading=false;state.promise=null;});
    return state.promise;
  }

  function requireReady(){
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Defart no está listo.");}
      return result;
    });
  }

  function listPeriods(){
    return requireReady().then(function(){
      var current=legacy();
      if(current&&typeof current.listPeriods==="function"){return current.listPeriods()||[];}
      if(current&&typeof current.getPeriods==="function"){return current.getPeriods()||[];}
      return [];
    });
  }

  function listStudents(options){
    return requireReady().then(function(){
      var current=service();
      if(current&&typeof current.getFiltered==="function"){return current.getFiltered(options||{});}
      if(current&&typeof current.list==="function"){return current.list(options||{});}
      return [];
    });
  }

  function getPage(options){
    return requireReady().then(function(){
      var current=service();
      if(current&&typeof current.getPage==="function"){return current.getPage(options||{});}
      if(current&&typeof current.page==="function"){return current.page(options||{});}
      return {rows:[],page:1,limit:25,total:0,totalPages:1,hasPrev:false,hasNext:false};
    });
  }

  function getSummary(options){
    return requireReady().then(function(){
      var current=service();
      if(current&&typeof current.getStats==="function"){return current.getStats(options||{});}
      if(current&&typeof current.stats==="function"){return current.stats(options||{});}
      return {};
    });
  }

  function read(options){
    state.reads+=1;
    options=options||{};
    return Promise.all([listPeriods(),listStudents(options),getSummary(options)]).then(function(values){
      return {
        ok:true,source:SOURCE,screen:SCREEN,
        data:{periods:values[0]||[],students:values[1]||[],summary:values[2]||{}},
        meta:{generatedAt:now(),version:VERSION}
      };
    });
  }

  function changeFromNote(note,context){
    context=context||{};
    return {
      periodoId:text(note.periodoId||note.periodId),
      cedula:text(note.cedula||note.numeroIdentificacion),
      tabla:"notas_titulacion",tipo:"notas_titulacion",
      registroId:text(note.idEstudiantePeriodo||note.studentId||note.id),
      accion:"UPSERT",payload:note,prioridad:1,
      estadoSheets:"PENDIENTE",estadoFirebase:"PENDIENTE",estadoSupabase:"PENDIENTE",
      source:text(context.source||"defart"),origen:text(context.origen||"defart")
    };
  }

  function refreshCache(periodoId){
    var currentHub=hub();
    if(!currentHub||typeof currentHub.refreshCache!=="function"){return Promise.resolve(null);}
    return currentHub.refreshCache({
      source:"cone.defart.save",sourceScreen:SCREEN,periodoId:periodoId||"",
      full:true,immediate:true,force:true,changed:true
    }).catch(function(){return null;});
  }

  function save(payload,context){
    payload=payload||{};
    context=context||{};
    state.writes+=1;
    return requireReady().then(function(){
      var current=service();
      if(!current||typeof current.saveNota!=="function"){throw new Error("BDLServiceDefensas.saveNota no está disponible.");}
      return current.saveNota(payload);
    }).then(function(saved){
      if(context.enqueue===false){return saved;}
      var repo=changesRepo();
      if(!repo||typeof repo.save!=="function"){throw new Error("BDLRepoCambios no está disponible.");}
      return repo.save(changeFromNote(saved||payload,context)).then(function(){return saved||payload;});
    }).then(function(saved){
      return refreshCache(text(saved&& (saved.periodoId||saved.periodId)||payload.periodoId)).then(function(){
        try{window.dispatchEvent(new CustomEvent("bdlocal:defart-saved",{detail:{ok:true,source:SOURCE,row:saved}}));}catch(error){}
        return saved;
      });
    });
  }

  function update(payload,context){return save(payload,context);}
  function refresh(options){
    options=options||{};
    return requireReady().then(function(){
      var current=legacy();
      return current&&typeof current.refresh==="function"?current.refresh(options):null;
    }).then(function(){return ready({force:true});});
  }

  var api={
    version:VERSION,screen:SCREEN,source:SOURCE,
    ready:ready,read:read,refresh:refresh,reload:refresh,status:status,
    listPeriods:listPeriods,getPeriods:listPeriods,
    listStudents:listStudents,getStudents:listStudents,getFiltered:listStudents,
    getPage:getPage,page:getPage,getSummary:getSummary,summary:getSummary,
    save:save,saveNota:save,update:update
  };

  window.ConDefart=api;
  window.BDLocalConeDefart=api;
  register();
  var currentHub=hub();
  if(currentHub&&typeof currentHub.register==="function"){currentHub.register(SCREEN,api);}
})(window,document);
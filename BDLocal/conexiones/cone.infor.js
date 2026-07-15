/* =========================================================
Nombre completo: cone.infor.js
Ruta o ubicación: /BDLocal/conexiones/cone.infor.js
Función o funciones:
- Ser el conector oficial de la pantalla Infor.
- Entregar períodos, estudiantes y resúmenes desde servicios de BDLocal.
- Separar Infor de cone.stats.js y evitar accesos directos a la base.
Con qué se conecta:
- BDLocal/services/bdl.service.estudiantes.js
- BDLocal/services/bdl.service.stats.js
- BDLocal/conexiones/cone.index.js
- Infor/frontend/titulacion.html
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-screen-connector";
  var SCREEN="infor";
  var SOURCE="ConInfor";
  var HUB=window.BDLocalConexiones||null;
  var U=window.BDLocalConUtils||null;
  var state={ready:false,promise:null,error:"",reads:0,refreshes:0,loadedAt:""};

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function studentService(){
    return window.BDLServiceEstudiantes||(
      window.BDLServices&&typeof window.BDLServices.get==="function"
        ?window.BDLServices.get("estudiantes")
        :null
    );
  }
  function statsService(){
    return window.BDLServiceStats||(
      window.BDLServices&&typeof window.BDLServices.get==="function"
        ?window.BDLServices.get("stats")
        :null
    );
  }

  function registerDefinition(){
    var registry=window.BDLocalConeRegistry;
    if(!registry||typeof registry.register!=="function"){return;}
    registry.register(SCREEN,{
      label:"Infor",
      global:"ConInfor",
      file:"cone.infor.js",
      pathHints:["/infor/","infor/frontend/titulacion.html"],
      aliases:["infor","informe_titulacion","titulacion_informe"],
      canRead:true,
      canWrite:false,
      operations:["ready","read","refresh","status","diagnose"],
      tables:["periodos","personas","matriculas_periodo","requisitos_estudiante","notas_titulacion","evaluaciones_titulacion"],
      description:"Conector exclusivo para la pantalla de informes de titulación."
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
      loadedAt:state.loadedAt,
      studentService:!!studentService(),
      statsService:!!statsService()
    };
  }

  function ready(options){
    options=options||{};
    if(state.ready&&!options.force){return Promise.resolve(status());}
    if(state.promise&&!options.force){return state.promise;}
    state.error="";
    state.promise=Promise.resolve()
      .then(function(){
        return HUB&&typeof HUB.ensureCoreReady==="function"
          ?HUB.ensureCoreReady()
          :null;
      })
      .then(function(){
        if(!studentService()){throw new Error("BDLServiceEstudiantes no está disponible para Infor.");}
        state.ready=true;
        state.loadedAt=now();
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

  function cache(){
    var value=U&&typeof U.readCache==="function"?U.readCache():{};
    return value&&typeof value==="object"?value:{};
  }

  function listPeriods(){
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Infor no está listo.");}
      var current=cache();
      if(Array.isArray(current.periods)&&current.periods.length){return current.periods.slice();}
      var core=window.BL2Core;
      return core&&typeof core.getPeriods==="function"?core.getPeriods():[];
    });
  }

  function listStudents(options){
    options=options||{};
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Infor no está listo.");}
      var service=studentService();
      return service&&typeof service.list==="function"?service.list(options):[];
    });
  }

  function getSummary(options){
    options=options||{};
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Infor no está listo.");}
      var service=statsService();
      if(service){
        if(typeof service.getSummary==="function"){return service.getSummary(options);}
        if(typeof service.summary==="function"){return service.summary(options);}
      }
      var rows=Array.isArray(options.students)?options.students:[];
      return {totalEstudiantes:rows.length};
    });
  }

  function read(options){
    options=options||{};
    state.reads+=1;
    return Promise.all([listPeriods(),listStudents(options),getSummary(options)]).then(function(values){
      return {
        ok:true,
        source:SOURCE,
        screen:SCREEN,
        data:{
          periods:Array.isArray(values[0])?values[0]:[],
          students:Array.isArray(values[1])?values[1]:[],
          summary:values[2]||{}
        },
        meta:{generatedAt:now(),version:VERSION,readOnly:true}
      };
    });
  }

  function refresh(options){
    options=options||{};
    state.refreshes+=1;
    if(HUB&&typeof HUB.refreshCache==="function"){
      return HUB.refreshCache({
        source:"cone.infor",
        sourceScreen:SCREEN,
        periodoId:text(options.periodoId||options.periodId),
        full:options.full===true,
        light:options.full!==true,
        immediate:true,
        force:options.force===true
      }).then(function(){return ready({force:true});});
    }
    return ready({force:true});
  }

  var api={
    version:VERSION,screen:SCREEN,source:SOURCE,
    ready:ready,read:read,refresh:refresh,reload:refresh,status:status,
    listPeriods:listPeriods,getPeriods:listPeriods,
    listStudents:listStudents,getStudents:listStudents,
    getSummary:getSummary,summary:getSummary
  };

  window.ConInfor=api;
  window.BDLocalConeInfor=api;
  registerDefinition();
  if(HUB&&typeof HUB.register==="function"){HUB.register(SCREEN,api);}
})(window);
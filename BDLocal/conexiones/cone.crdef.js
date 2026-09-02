/* =========================================================
Nombre completo: cone.crdef.js
Ruta: /BDLocal/conexiones/cone.crdef.js
Función:
- Ser la única conexión de Cr-def con BDLocal.
- Leer estudiantes activos, requisitos y notas.
- Leer y guardar borradores de cronograma en cronograma_defensas.
========================================================= */
(function(window,document){
  "use strict";
  var VERSION="2.0.0-active-persistent",SCREEN="cr_def",SOURCE="ConCrDef";
  var base=document.currentScript&&document.currentScript.src||document.baseURI;
  var loading=Object.create(null);
  var state={ready:false,promise:null,error:"",reads:0,writes:0,refreshes:0,loadedAt:"",dependenciesReady:false};
  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function hub(){return window.BDLocalConexiones||null;}
  function legacy(){return window.ConDefensas||window.BDLocalConeDefensas||null;}
  function service(){return window.BDLServiceDefensas||(window.BDLServices&&typeof window.BDLServices.get==="function"?window.BDLServices.get("defensas"):null);}
  function scheduleRepo(){return window.BDLRepoCronogramaDefensas||(window.BDLRepositories&&typeof window.BDLRepositories.get==="function"?(window.BDLRepositories.get("cronograma_defensas")||window.BDLRepositories.get("cronogramaDefensas")):null);}
  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(item){return item.src===src||item.getAttribute("data-concrdef-src")===src;});}
  function waitFor(test,label,timeout){timeout=Math.max(500,Number(timeout||15000));var started=Date.now();return new Promise(function(resolve,reject){(function check(){var value=null;try{value=test();}catch(error){}if(value){resolve(value);return;}if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}setTimeout(check,40);})();});}
  function load(relative,test){
    var src=url(relative),current=null;try{current=test&&test();}catch(error){}
    if(current)return Promise.resolve(current);if(loading[src])return loading[src];
    if(existing(src))return test?waitFor(test,relative,15000):Promise.resolve(src);
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-concrdef-src",src);
      script.onload=function(){var value=src;try{value=test?test():src;}catch(error){value=null;}value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));};
      script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};
      (document.head||document.documentElement).appendChild(script);
    }).finally(function(){delete loading[src];});
    return loading[src];
  }
  function register(){
    var registry=window.BDLocalConeRegistry;
    if(registry&&typeof registry.register==="function"){
      registry.register(SCREEN,{label:"Cronograma de defensas",global:"ConCrDef",file:"cone.crdef.js",pathHints:["/cr-def/","cr-def.html"],aliases:["crdef","cr-def","sacar_n"],canRead:true,canWrite:true,operations:["ready","read","refresh","status","diagnose","listSchedules","saveSchedules"],tables:["periodos","personas","matriculas_periodo","requisitos_estudiante","notas_titulacion","divisiones_estudiante","cronograma_defensas"],description:"Conector exclusivo de Cr-def con persistencia local."});
    }
  }
  function ensureDependencies(){
    if(state.dependenciesReady)return Promise.resolve(true);
    return load("../adapters/bdl.screen-deps.js",function(){return window.BDLocalScreenDeps;})
      .then(function(){return load("cone.runtime-deps.js",function(){return window.BDLocalRuntimeDeps;});})
      .then(function(runtime){return runtime.ensure("defensas");})
      .then(function(){return load("cone.defensas.js",legacy);})
      .then(function(api){return api&&typeof api.ready==="function"?api.ready():api;})
      .then(function(){
        if(!legacy())throw new Error("ConDefensas no quedó disponible para Cr-def.");
        if(!service())throw new Error("BDLServiceDefensas no está disponible para Cr-def.");
        if(!scheduleRepo())throw new Error("BDLRepoCronogramaDefensas no está disponible para Cr-def.");
        state.dependenciesReady=true;return true;
      });
  }
  function status(){return {ok:state.ready&&!state.error,ready:state.ready,version:VERSION,screen:SCREEN,source:SOURCE,error:state.error,reads:state.reads,writes:state.writes,refreshes:state.refreshes,loadedAt:state.loadedAt,dependency:!!legacy(),service:!!service(),scheduleRepo:!!scheduleRepo(),dependenciesReady:state.dependenciesReady};}
  function ready(options){options=options||{};if(state.ready&&!options.force)return Promise.resolve(status());if(state.promise&&!options.force)return state.promise;state.error="";state.promise=ensureDependencies().then(function(){state.ready=true;state.loadedAt=now();register();var h=hub();if(h&&typeof h.register==="function")h.register(SCREEN,api);return status();}).catch(function(error){state.ready=false;state.error=error&&error.message?error.message:String(error);return status();}).finally(function(){state.promise=null;});return state.promise;}
  function requireReady(){return ready().then(function(result){if(!result.ok)throw new Error(result.error||"Cr-def no está listo.");return result;});}
  function listPeriods(){return requireReady().then(function(){var current=legacy();if(current&&typeof current.listPeriods==="function")return current.listPeriods()||[];if(current&&typeof current.getPeriods==="function")return current.getPeriods()||[];return [];});}
  function listStudents(options){options=Object.assign({matricula:"ACTIVO"},options||{});if(!text(options.matricula))options.matricula="ACTIVO";return requireReady().then(function(){var current=service();if(current&&typeof current.getFiltered==="function")return current.getFiltered(options);if(current&&typeof current.list==="function")return current.list(options);return [];});}
  function listRequirements(options){return requireReady().then(function(){var current=legacy();if(current&&typeof current.listRequirements==="function")return current.listRequirements(options||{})||[];if(current&&typeof current.getRequirements==="function")return current.getRequirements(options||{})||[];return [];});}
  function listSchedules(options){return requireReady().then(function(){var current=scheduleRepo();return current&&typeof current.list==="function"?current.list(options||{}):[];});}
  function saveSchedules(rows,context){
    rows=Array.isArray(rows)?rows.filter(Boolean):[];context=context||{};if(!rows.length)return Promise.resolve([]);
    state.writes+=rows.length;
    return requireReady().then(function(){var current=scheduleRepo();if(!current||typeof current.saveMany!=="function")throw new Error("Repositorio de cronogramas no disponible.");return current.saveMany(rows);}).then(function(saved){try{window.dispatchEvent(new CustomEvent("bdlocal:crdef-saved",{detail:{ok:true,source:SOURCE,rows:saved,context:context}}));}catch(error){}return saved;});
  }
  function read(options){
    state.reads+=1;options=Object.assign({matricula:"ACTIVO"},options||{});
    return Promise.all([listPeriods(),listStudents(options),listRequirements(options),listSchedules(options)]).then(function(values){
      return {ok:true,source:SOURCE,screen:SCREEN,data:{periods:values[0]||[],students:values[1]||[],requirements:values[2]||[],schedules:values[3]||[]},meta:{generatedAt:now(),version:VERSION,readOnly:false,persistentSchedule:true}};
    });
  }
  function refresh(options){state.refreshes+=1;return requireReady().then(function(){var current=legacy();return current&&typeof current.refresh==="function"?current.refresh(options||{}):null;}).then(function(){return ready({force:true});});}
  var api={version:VERSION,screen:SCREEN,source:SOURCE,ready:ready,read:read,refresh:refresh,reload:refresh,status:status,listPeriods:listPeriods,getPeriods:listPeriods,listStudents:listStudents,getStudents:listStudents,listRequirements:listRequirements,getRequirements:listRequirements,listSchedules:listSchedules,getSchedules:listSchedules,saveSchedules:saveSchedules};
  window.ConCrDef=api;window.BDLocalConeCrDef=api;register();var h=hub();if(h&&typeof h.register==="function")h.register(SCREEN,api);
})(window,document);

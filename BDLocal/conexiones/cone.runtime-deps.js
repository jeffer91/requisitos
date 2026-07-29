/* =========================================================
Nombre completo: cone.runtime-deps.js
Ruta: /BDLocal/conexiones/cone.runtime-deps.js
Función:
- Preparar en orden seguro las dependencias reales de las pantallas especializadas.
- Crear primero configuración, IndexedDB, registro de repositorios y registro de servicios.
- Evitar ciclos entre BDLocalConexiones.ready y los conectores que el propio orquestador prepara.
- Reutilizar promesas y scripts ya cargados para Defensas, Ncomplex, Cr-def e InPVC.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.1.0-no-ready-cycle";
  var base=document.currentScript&&document.currentScript.src||document.baseURI;
  var loading=Object.create(null);
  var profiles=Object.create(null);
  var basePromise=null;
  var profilePromises=Object.create(null);
  var state={baseReady:false,profileReady:Object.create(null),lastError:"",loads:0,reuses:0};

  function text(value){return String(value==null?"":value).trim();}
  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function scripts(){return Array.prototype.slice.call(document.scripts||[]);}
  function existing(src){return scripts().find(function(item){return item.src===src||item.getAttribute("data-bdl-runtime-src")===src;})||null;}
  function waitFor(test,label,timeout){
    timeout=Math.max(500,Number(timeout||12000));var started=Date.now();
    return new Promise(function(resolve,reject){(function check(){
      var value=null;try{value=test&&test();}catch(error){}
      if(value){resolve(value);return;}
      if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}
      window.setTimeout(check,40);
    })();});
  }
  function load(relative,test){
    var src=url(relative),current=null;try{current=test&&test();}catch(error){}
    if(current){state.reuses+=1;return Promise.resolve(current);}
    if(loading[src]){state.reuses+=1;return loading[src];}
    if(existing(src)){state.reuses+=1;return test?waitFor(test,relative,12000):Promise.resolve(src);}
    state.loads+=1;
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-bdl-runtime-src",src);
      script.onload=function(){var value=src;try{value=test?test():src;}catch(error){value=null;}value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));};
      script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};
      (document.head||document.documentElement).appendChild(script);
    }).finally(function(){delete loading[src];});
    return loading[src];
  }
  function sequence(files){return (files||[]).reduce(function(chain,item){return chain.then(function(){return load(item.path,item.test);});},Promise.resolve());}

  function baseFiles(){return [
    {path:"../adapters/bdl.screen-deps.js",test:function(){return window.BDLocalScreenDeps;}},
    {path:"../shared/bdl.periodo-global.js",test:function(){return window.BDLPeriodoGlobal;}},
    {path:"../bl2.config.js",test:function(){return window.BL2Config;}},
    {path:"../bl2.config.v2.js"},
    {path:"../bl2.config.v3.js"},
    {path:"../bl2.db.js",test:function(){return window.BL2DB;}},
    {path:"../repositories/bdl.repo.index.js",test:function(){return window.BDLRepositories;}},
    {path:"../services/bdl.service.index.js",test:function(){return window.BDLServices;}}
  ];}

  profiles.defensas=[
    {path:"../rules/bdl.rules.index.js",test:function(){return window.BDLRules;}},
    {path:"../rules/bdl.rules.persona.js",test:function(){return window.BDLRulesPersona;}},
    {path:"../rules/bdl.rules.matricula.js"},
    {path:"../rules/bdl.rules.notas.js",test:function(){return window.BDLRulesNotas;}},
    {path:"../rules/bdl.rules.sync.js"},
    {path:"../repositories/bdl.repo.periodos.js",test:function(){return window.BDLRepoPeriodos||(window.BDLRepositories&&window.BDLRepositories.get("periodos"));}},
    {path:"../repositories/bdl.repo.estudiantes.js",test:function(){return window.BDLRepoEstudiantes||(window.BDLRepositories&&window.BDLRepositories.get("estudiantes"));}},
    {path:"../repositories/bdl.repo.personas.js",test:function(){return window.BDLRepoPersonas||(window.BDLRepositories&&window.BDLRepositories.get("personas"));}},
    {path:"../repositories/bdl.repo.matriculas.js",test:function(){return window.BDLRepoMatriculas||(window.BDLRepositories&&window.BDLRepositories.get("matriculas"));}},
    {path:"../repositories/bdl.repo.requisitos.js",test:function(){return window.BDLRepoRequisitos||(window.BDLRepositories&&window.BDLRepositories.get("requisitos"));}},
    {path:"../repositories/bdl.repo.notas.js",test:function(){return window.BDLRepoNotas;}},
    {path:"../repositories/bdl.repo.logs.js",test:function(){return window.BDLRepoLogs||(window.BDLRepositories&&window.BDLRepositories.get("logs"));}},
    {path:"../repositories/bdl.repo.cambios.js",test:function(){return window.BDLRepoCambios||(window.BDLRepositories&&window.BDLRepositories.get("cambios"));}},
    {path:"../services/bdl.service.periodos.js",test:function(){return window.BDLServicePeriodos;}},
    {path:"../services/bdl.service.estudiantes.js",test:function(){return window.BDLServiceEstudiantes;}},
    {path:"../services/bdl.service.defensas.js",test:function(){return window.BDLServiceDefensas;}}
  ];

  profiles.inpvc=[
    {path:"../rules/bdl.rules.index.js",test:function(){return window.BDLRules;}},
    {path:"../rules/bdl.rules.persona.js",test:function(){return window.BDLRulesPersona;}},
    {path:"../rules/bdl.rules.matricula.js"},
    {path:"../rules/bdl.rules.notas.js",test:function(){return window.BDLRulesNotas;}},
    {path:"../repositories/bdl.repo.periodos.js",test:function(){return window.BDLRepoPeriodos||(window.BDLRepositories&&window.BDLRepositories.get("periodos"));}},
    {path:"../repositories/bdl.repo.estudiantes.js",test:function(){return window.BDLRepoEstudiantes||(window.BDLRepositories&&window.BDLRepositories.get("estudiantes"));}},
    {path:"../repositories/bdl.repo.personas.js",test:function(){return window.BDLRepoPersonas||(window.BDLRepositories&&window.BDLRepositories.get("personas"));}},
    {path:"../repositories/bdl.repo.matriculas.js",test:function(){return window.BDLRepoMatriculas||(window.BDLRepositories&&window.BDLRepositories.get("matriculas"));}},
    {path:"../repositories/bdl.repo.requisitos.js",test:function(){return window.BDLRepoRequisitos||(window.BDLRepositories&&window.BDLRepositories.get("requisitos"));}},
    {path:"../repositories/bdl.repo.notas.js",test:function(){return window.BDLRepoNotas;}},
    {path:"../services/bdl.service.periodos.js",test:function(){return window.BDLServicePeriodos;}},
    {path:"../services/bdl.service.estudiantes.js",test:function(){return window.BDLServiceEstudiantes;}}
  ];

  profiles.ncomplex=[
    {path:"../rules/bdl.rules.index.js",test:function(){return window.BDLRules;}},
    {path:"../rules/bdl.rules.persona.js",test:function(){return window.BDLRulesPersona;}},
    {path:"../rules/bdl.rules.matricula.js"},
    {path:"../rules/bdl.rules.notas.js",test:function(){return window.BDLRulesNotas;}},
    {path:"../rules/bdl.rules.sync.js"},
    {path:"../rules/bdl.rules.evaluaciones-titulacion.js",test:function(){return window.BDLRulesEvaluacionesTitulacion;}},
    {path:"../repositories/bdl.repo.periodos.js",test:function(){return window.BDLRepoPeriodos||(window.BDLRepositories&&window.BDLRepositories.get("periodos"));}},
    {path:"../repositories/bdl.repo.estudiantes.js",test:function(){return window.BDLRepoEstudiantes||(window.BDLRepositories&&window.BDLRepositories.get("estudiantes"));}},
    {path:"../repositories/bdl.repo.personas.js",test:function(){return window.BDLRepoPersonas||(window.BDLRepositories&&window.BDLRepositories.get("personas"));}},
    {path:"../repositories/bdl.repo.matriculas.js",test:function(){return window.BDLRepoMatriculas||(window.BDLRepositories&&window.BDLRepositories.get("matriculas"));}},
    {path:"../repositories/bdl.repo.notas.js",test:function(){return window.BDLRepoNotas;}},
    {path:"../repositories/bdl.repo.logs.js",test:function(){return window.BDLRepoLogs||(window.BDLRepositories&&window.BDLRepositories.get("logs"));}},
    {path:"../repositories/bdl.repo.cambios.js",test:function(){return window.BDLRepoCambios||(window.BDLRepositories&&window.BDLRepositories.get("cambios"));}},
    {path:"../repositories/bdl.repo.evaluaciones-titulacion.js",test:function(){return window.BDLRepoEvaluacionesTitulacion;}},
    {path:"../repositories/bdl.repo.importaciones.js",test:function(){return window.BDLRepoImportaciones||(window.BDLRepositories&&window.BDLRepositories.get("importaciones"));}},
    {path:"../services/bdl.service.periodos.js",test:function(){return window.BDLServicePeriodos;}},
    {path:"../services/bdl.service.estudiantes.js",test:function(){return window.BDLServiceEstudiantes;}},
    {path:"../services/bdl.service.ncomplex.js",test:function(){return window.BDLServiceNcomplex;}},
    {path:"../migrations/bdl.migration.index.js",test:function(){return window.BDLMigrations||window.BDLMigrationRegistry;}},
    {path:"../migrations/bdl.migration.v3.ncomplex.js",test:function(){return window.BDLMigrationV3Ncomplex;}}
  ];

  function ensureBase(){
    if(state.baseReady){return Promise.resolve(status());}
    if(basePromise){return basePromise;}
    basePromise=sequence(baseFiles()).then(function(){
      if(!window.BL2DB||!window.BDLRepositories||!window.BDLServices){throw new Error("La base de repositorios y servicios no quedó disponible.");}
      state.baseReady=true;
      if(window.BDLPeriodoGlobal&&typeof window.BDLPeriodoGlobal.init==="function"){window.BDLPeriodoGlobal.init();}
      state.lastError="";
      return status();
    }).catch(function(error){state.lastError=error&&error.message?error.message:String(error);throw error;}).finally(function(){basePromise=null;});
    return basePromise;
  }

  function ensure(profile){
    profile=text(profile||"").toLowerCase();
    if(!profiles[profile]){return Promise.reject(new Error("Perfil de dependencias desconocido: "+profile));}
    if(state.profileReady[profile]){return Promise.resolve(status());}
    if(profilePromises[profile]){return profilePromises[profile];}
    profilePromises[profile]=ensureBase().then(function(){return sequence(profiles[profile]);}).then(function(){state.profileReady[profile]=true;state.lastError="";return status();}).catch(function(error){state.lastError=error&&error.message?error.message:String(error);throw error;}).finally(function(){delete profilePromises[profile];});
    return profilePromises[profile];
  }

  function status(){return {ok:!state.lastError,version:VERSION,baseReady:state.baseReady,profiles:Object.assign({},state.profileReady),lastError:state.lastError,loads:state.loads,reuses:state.reuses};}

  window.BDLocalRuntimeDeps={version:VERSION,load:load,sequence:sequence,ensureBase:ensureBase,ensure:ensure,status:status};
})(window,document);

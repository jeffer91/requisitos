/* =========================================================
Nombre completo: cone.stats.notes.js
Ruta: /BDLocal/conexiones/cone.stats.notes.js
Función:
- Extender ConStats con lectura de notas_titulacion.
- Mantener repositorios internos fuera de la pantalla Stats.
- Resolver la ruta del repositorio desde la ubicación real del conector.
- Activar la arquitectura pesada solo cuando Stats solicita notas.
- Evitar esperas fijas de 15 segundos durante el arranque de Stats.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.2.0-deferred-heavy-notes";
  var scriptBase=document.currentScript&&document.currentScript.src
    ?document.currentScript.src
    :document.baseURI;
  var state={loading:null,reads:0,error:"",loadedAt:"",heavyActivations:0};

  function text(value){return String(value==null?"":value).trim();}
  function connector(){return window.ConStats||window.BDLocalStats||null;}
  function repo(){
    return window.BDLRepoNotas||(
      window.BDLRepositories&&typeof window.BDLRepositories.get==="function"
        ?window.BDLRepositories.get("notas")||window.BDLRepositories.get("notas_titulacion")
        :null
    );
  }
  function repoUrl(){try{return new URL("../repositories/bdl.repo.notas.js",scriptBase).href;}catch(error){return "../repositories/bdl.repo.notas.js";}}
  function existing(url){return Array.prototype.slice.call(document.scripts||[]).some(function(item){return item.src===url||item.getAttribute("data-stats-notes-src")===url;});}

  function ensureHeavy(){
    if(window.BDLRepositories){return Promise.resolve(true);}
    var deps=window.BDLocalScreenDeps||null;
    if(deps&&typeof deps.activateHeavy==="function"){
      state.heavyActivations+=1;
      return Promise.resolve(deps.activateHeavy()).then(function(){
        if(!window.BDLRepositories){throw new Error("La arquitectura de repositorios de BDLocal no quedó disponible.");}
        return true;
      });
    }
    if(window.BDLocalConexiones&&typeof window.BDLocalConexiones.activateHeavy==="function"){
      state.heavyActivations+=1;
      return Promise.resolve(window.BDLocalConexiones.activateHeavy()).then(function(){
        if(!window.BDLRepositories){throw new Error("La arquitectura de repositorios de BDLocal no quedó disponible.");}
        return true;
      });
    }
    return Promise.reject(new Error("No se puede activar BDLocal para consultar notas."));
  }

  function loadRepoScript(forceRetry){
    if(repo()){return Promise.resolve(repo());}
    var url=repoUrl();
    if(existing(url)&&!forceRetry){return loadRepoScript(true);}
    var src=forceRetry?url+(url.indexOf("?")>=0?"&":"?")+"stats_notes_retry="+Date.now():url;
    return new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=src;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-stats-notes-src",url);
      script.onload=function(){
        var current=repo();
        current?resolve(current):reject(new Error("bdl.repo.notas.js no expuso BDLRepoNotas."));
      };
      script.onerror=function(){reject(new Error("No se pudo preparar el repositorio interno de notas."));};
      (document.head||document.documentElement).appendChild(script);
    });
  }

  function ensureRepo(){
    if(repo()){return Promise.resolve(repo());}
    if(state.loading){return state.loading;}
    state.loading=ensureHeavy()
      .then(function(){return repo()||loadRepoScript(false);})
      .then(function(current){
        if(!current){throw new Error("BDLRepoNotas no quedó disponible dentro de ConStats.");}
        state.error="";
        return current;
      })
      .catch(function(error){
        state.error=error&&error.message?error.message:String(error);
        throw error;
      })
      .finally(function(){state.loading=null;});
    return state.loading;
  }

  function listNotes(options){
    options=options||{};
    state.reads+=1;
    return ensureRepo().then(function(current){
      if(typeof current.list!=="function"){throw new Error("El repositorio interno de notas no admite list().");}
      return current.list(options);
    }).then(function(rows){
      state.error="";
      state.loadedAt=new Date().toISOString();
      return Array.isArray(rows)?rows:[];
    }).catch(function(error){
      state.error=error&&error.message?error.message:String(error);
      throw error;
    });
  }

  function install(){
    var api=connector();
    if(!api){return false;}
    api.listNotes=listNotes;
    api.getNotes=listNotes;
    api.reloadNotes=listNotes;
    api.notesStatus=function(){return {
      ok:!state.error,
      version:VERSION,
      reads:state.reads,
      error:state.error,
      loadedAt:state.loadedAt,
      heavyActivations:state.heavyActivations,
      deferred:true
    };};
    api.__statsNotesConnector=true;
    return true;
  }

  window.ConStatsNotes={
    version:VERSION,
    install:install,
    listNotes:listNotes,
    status:function(){return {
      ok:!state.error,
      reads:state.reads,
      error:state.error,
      loadedAt:state.loadedAt,
      heavyActivations:state.heavyActivations,
      deferred:true
    };}
  };
  install();
})(window,document);

/* =========================================================
Nombre completo: cone.stats.notes.js
Ruta: /BDLocal/conexiones/cone.stats.notes.js
Función:
- Extender ConStats con lectura de notas_titulacion.
- Mantener repositorios internos fuera de la pantalla Stats.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-connector-notes";
  var state={loading:null,reads:0,error:"",loadedAt:""};

  function connector(){return window.ConStats||window.BDLocalStats||null;}
  function repo(){
    return window.BDLRepoNotas||(
      window.BDLRepositories&&typeof window.BDLRepositories.get==="function"
        ?window.BDLRepositories.get("notas")||window.BDLRepositories.get("notas_titulacion")
        :null
    );
  }
  function base(){return document.currentScript&&document.currentScript.src||document.baseURI;}
  function repoUrl(){try{return new URL("../repositories/bdl.repo.notas.js",base()).href;}catch(error){return "../repositories/bdl.repo.notas.js";}}
  function existing(url){return Array.prototype.slice.call(document.scripts||[]).some(function(item){return item.src===url||item.getAttribute("data-stats-notes-src")===url;});}
  function waitRepo(){
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        if(repo()){resolve(repo());return;}
        if(Date.now()-started>15000){reject(new Error("BDLRepoNotas no quedó disponible dentro de ConStats."));return;}
        setTimeout(check,40);
      })();
    });
  }
  function ensureRepo(){
    if(repo()){return Promise.resolve(repo());}
    if(state.loading){return state.loading;}
    var url=repoUrl();
    if(existing(url)){state.loading=waitRepo().finally(function(){state.loading=null;});return state.loading;}
    state.loading=new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=url;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-stats-notes-src",url);
      script.onload=function(){repo()?resolve(repo()):reject(new Error("bdl.repo.notas.js no expuso BDLRepoNotas."));};
      script.onerror=function(){reject(new Error("No se pudo preparar el repositorio interno de notas."));};
      (document.head||document.documentElement).appendChild(script);
    }).finally(function(){state.loading=null;});
    return state.loading;
  }
  function listNotes(options){
    state.reads+=1;
    return ensureRepo().then(function(current){
      if(typeof current.list!=="function"){throw new Error("El repositorio interno de notas no admite list().");}
      return current.list(options||{});
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
    api.notesStatus=function(){return {ok:!state.error,version:VERSION,reads:state.reads,error:state.error,loadedAt:state.loadedAt};};
    api.__statsNotesConnector=true;
    return true;
  }

  window.ConStatsNotes={version:VERSION,install:install,listNotes:listNotes,status:function(){return {ok:!state.error,reads:state.reads,error:state.error,loadedAt:state.loadedAt};}};
  install();
})(window,document);

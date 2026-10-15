/* Tabla - consulta de notas de Defensas, solo lectura.
   Las notas se identifican por cedula y periodo canonico. */
(function(window, document){
  "use strict";
  var VERSION = "1.0.0";
  var SIGNAL_KEY = "REQ_BDLOCAL_NOTES_SIGNAL_V1";
  var maps = Object.create(null);
  var tasks = Object.create(null);
  var loadingScript = null;
  var revision = 0;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function period(value){
    var raw = text(value);
    var match = raw.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4] : raw.replace(/_+/g,"__");
  }
  function cedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return /^\d{9}$/.test(raw) ? "0"+raw : raw;
  }
  function identity(row){
    row=row||{};
    var id=cedula(row._cedula||row.cedula||row.numeroIdentificacion||row.Cedula);
    var p=period(row._periodoId||row.periodoId||row.periodId||row._bl2PeriodoId);
    return id&&p ? id+"__"+p : "";
  }
  function numeric(value){
    if(value===null||value===undefined||text(value)===""){return null;}
    var n=Number(text(value).replace(",","."));
    return Number.isFinite(n)&&n>=0&&n<=10 ? n : null;
  }
  function first(row,names){
    for(var i=0;i<names.length;i++){
      var value=row[names[i]];
      if(value!==null&&value!==undefined&&text(value)!==""){return value;}
    }
    return null;
  }
  function noteValues(note){
    var repo=window.BDLRepoNotas;
    if(repo&&typeof repo.noteValues==="function"){
      var result=repo.noteValues(note);
      return {nart:result.article,ndef:result.defense};
    }
    return {
      nart:numeric(first(note,["Notart","Nart","nart","notart","notaArticulo"])),
      ndef:numeric(first(note,["Notdef","Ndef","ndef","notdef","notaDefensa"]))
    };
  }
  function loadRepository(){
    if(window.BDLRepoNotas && typeof window.BDLRepoNotas.list==="function"){
      return Promise.resolve(window.BDLRepoNotas);
    }
    if(loadingScript){return loadingScript;}
    var hub=window.BDLocalConexiones;
    if(!hub||typeof hub.ensureCoreReady!=="function"){
      return Promise.reject(new Error("BDLocal no está disponible para consultar las notas."));
    }
    loadingScript=Promise.resolve(hub.ensureCoreReady()).then(function(){
      if(window.BDLRepoNotas&&typeof window.BDLRepoNotas.list==="function"){
        return window.BDLRepoNotas;
      }
      return new Promise(function(resolve,reject){
        var script=document.createElement("script");
        script.src="../../BDLocal/repositories/bdl.repo.notas.js";
        script.onload=function(){
          var repo=window.BDLRepoNotas;
          if(repo&&typeof repo.list==="function"){resolve(repo);}
          else{reject(new Error("No se inicializó el repositorio de notas."));}
        };
        script.onerror=function(){reject(new Error("No se pudo cargar el repositorio de notas."));};
        (document.head||document.documentElement).appendChild(script);
      });
    }).catch(function(error){
      loadingScript=null;
      throw error;
    });
    return loadingScript;
  }
  function load(periodId){
    var p=period(periodId);
    if(!p){return Promise.reject(new Error("Seleccione un período para consultar notas."));}
    if(maps[p]){return Promise.resolve(maps[p]);}
    if(tasks[p]){return tasks[p];}
    var started=revision;
    tasks[p]=loadRepository().then(function(repo){
      return repo.list({periodoId:p,strict:true}).then(function(rows){
        if(started!==revision){throw new Error("Las notas se actualizaron durante la consulta; vuelva a filtrar.");}
        var map=Object.create(null);
        (Array.isArray(rows)?rows:[]).forEach(function(row){
          var id=identity(row);
          if(!id||period(row.periodoId||row.periodId)!==p){return;}
          var values=noteValues(row);
          map[id]={nart:values.nart,ndef:values.ndef};
        });
        maps[p]=map;
        return map;
      });
    }).finally(function(){delete tasks[p];});
    return tasks[p];
  }
  function get(row){
    var id=identity(row);
    var p=period(row&&(
      row._periodoId||row.periodoId||row.periodId||row._bl2PeriodoId
    ));
    return id&&maps[p] ? maps[p][id]||null : null;
  }
  function detail(row){
    var grades=get(row);
    if(!grades){return null;}
    var art=numeric(grades.nart);
    var def=numeric(grades.ndef);
    return {
      nart:art,
      ndef:def,
      articleFailed:art!==null&&art<7,
      defenseFailed:def!==null&&def<7,
      failed:(art!==null&&art<7)||(def!==null&&def<7)
    };
  }
  function hasFailure(row){var result=detail(row);return !!(result&&result.failed);}
  function isLoaded(periodId){return !!maps[period(periodId)];}
  function invalidate(){
    revision+=1;
    maps=Object.create(null);
    tasks=Object.create(null);
  }
  function refreshIfActive(){
    var app=window.TablaApp;
    if(!app||typeof app.getState!=="function"){return;}
    var state=app.getState();
    if(Array.isArray(state.requirements)&&state.requirements.indexOf("art")>=0&&
       typeof app.request==="function"){
      app.request(true,20);
    }
  }
  function onNotesUpdated(){invalidate();refreshIfActive();}
  window.addEventListener("storage",function(event){
    if(event&&event.key===SIGNAL_KEY){onNotesUpdated();}
  });
  try{
    if(window.top&&window.top!==window){
      window.top.addEventListener("bdlocal:notas-updated",onNotesUpdated);
    }
  }catch(error){}
  document.addEventListener("change",function(event){
    var node=event&&event.target;
    if(!node||node.value!=="art"){return;}
    var id=node.id||"";
    var isRow=node.classList&&node.classList.contains("tabla-message-select");
    if(!isRow&&id!=="tabla-tg-tipo"&&id!=="tabla-mass-tipo"){return;}
    var app=window.TablaApp;
    var s=app&&typeof app.getState==="function"?app.getState():{};
    if(!s.periodId || isLoaded(s.periodId)){return;}
    load(s.periodId).then(function(){
      if((id==="tabla-tg-tipo"||id==="tabla-mass-tipo")&&
         node.value==="art"){
        node.dispatchEvent(new Event("change",{bubbles:false}));
      }
    }).catch(function(error){
      var box=document.getElementById("tabla-status");
      if(box){box.textContent=text(error&&error.message||error);box.className="tabla-status warn";}
    });
  });
  window.TablaArtNotes={
    version:VERSION,load:load,get:get,detail:detail,
    hasFailure:hasFailure,isLoaded:isLoaded,invalidate:invalidate,
    canonicalPeriod:period,canonicalCedula:cedula
  };
})(window,document);

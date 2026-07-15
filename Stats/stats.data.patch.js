/* =========================================================
Nombre completo: stats.data.patch.js
Ruta: /Stats/stats.data.patch.js
Función:
- Integrar notas_titulacion en los estudiantes entregados por ConStats.
- Relacionar notas por cédula normalizada y período canónico.
- Aceptar notas directas y notas anidadas de formatos anteriores.
- Mantener Telegram y contactos ya hidratados por Base Local.
- No escribir ni modificar información persistente.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.1-notes-hydration";
  var state={
    installed:false,
    readyPromise:null,
    loadingScript:null,
    loadingNotes:null,
    notes:[],
    byStudent:Object.create(null),
    byCedula:Object.create(null),
    loadedAt:"",
    error:""
  };

  function text(value){return String(value==null?"":value).trim();}
  function normalizeCedula(value){
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }
  function canonicalPeriodId(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function cedulaOf(row){
    row=row||{};
    return normalizeCedula(row.cedula||row._cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.Cedula||row["Cédula"]||"");
  }
  function periodOf(row){
    row=row||{};
    return canonicalPeriodId(row.periodoId||row.periodId||row.periodoCanonicoId||row.ultimoPeriodoId||row.idPeriodo||row._periodoId||row._bl2PeriodoId||"");
  }
  function studentKey(row){
    var cedula=cedulaOf(row);
    var periodoId=periodOf(row);
    return cedula&&periodoId?cedula+"__"+periodoId:"";
  }
  function num(value){
    if(value===null||value===undefined||text(value)===""){return null;}
    var result=Number(text(value).replace(",","."));
    return Number.isFinite(result)?result:null;
  }
  function first(row,names){
    row=row||{};
    for(var i=0;i<names.length;i+=1){
      if(Object.prototype.hasOwnProperty.call(row,names[i])&&text(row[names[i]])!==""){
        return row[names[i]];
      }
    }
    return "";
  }
  function normalizeNote(row){
    row=Object.assign({},row||{});
    var nested=row._bdlNotas&&typeof row._bdlNotas==="object"?row._bdlNotas:(row.notas&&typeof row.notas==="object"?row.notas:{});
    var source=Object.assign({},nested,row);
    var nart=num(first(source,["Notart","Nart","nart","notart","notaArticulo","nota_articulo","_nart"]));
    var ndef=num(first(source,["Notdef","Ndef","ndef","notdef","notaDefensa","nota_defensa","_ndef"]));
    var rawFinal=first(source,["Notafinal","NotaFinal","Nfinal","Nfin","nfin","notafinal","notaFinal","nota_final","_nfin"]);
    var nfin=num(rawFinal);
    if(nfin===null&&nart!==null&&ndef!==null&&nart>=7){
      nfin=Math.round(((nart*0.70)+(ndef*0.30))*100)/100;
    }
    return Object.assign({},row,{
      cedula:cedulaOf(row),
      periodoId:periodOf(row),
      Notart:nart,
      Nart:nart,
      nart:nart,
      notaArticulo:nart,
      Notdef:ndef,
      Ndef:ndef,
      ndef:ndef,
      notaDefensa:ndef,
      Notafinal:nfin,
      NotaFinal:nfin,
      Nfin:nfin,
      nfin:nfin,
      notaFinal:nfin,
      _bdlNotas:{
        nart:nart,
        ndef:ndef,
        nfin:nfin,
        nfinCalculado:nfin,
        nfinGuardado:num(rawFinal),
        completo:nfin!==null
      }
    });
  }
  function resolve(relative){
    try{return new URL(relative,(document.currentScript&&document.currentScript.src)||document.baseURI).href;}
    catch(error){return relative;}
  }
  function ensureNotesRepo(){
    if(window.BDLRepoNotas&&typeof window.BDLRepoNotas.list==="function"){
      return Promise.resolve(window.BDLRepoNotas);
    }
    if(state.loadingScript){return state.loadingScript;}
    var src=resolve("../BDLocal/repositories/bdl.repo.notas.js");
    var existing=Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src;});
    if(existing){
      state.loadingScript=new Promise(function(resolvePromise,rejectPromise){
        var started=Date.now();
        (function check(){
          if(window.BDLRepoNotas&&typeof window.BDLRepoNotas.list==="function"){resolvePromise(window.BDLRepoNotas);return;}
          if(Date.now()-started>12000){rejectPromise(new Error("No se pudo preparar BDLRepoNotas."));return;}
          setTimeout(check,50);
        })();
      });
      return state.loadingScript;
    }
    state.loadingScript=new Promise(function(resolvePromise,rejectPromise){
      var script=document.createElement("script");
      script.src=src;
      script.async=false;
      script.defer=false;
      script.onload=function(){
        if(window.BDLRepoNotas&&typeof window.BDLRepoNotas.list==="function"){resolvePromise(window.BDLRepoNotas);}
        else{rejectPromise(new Error("bdl.repo.notas.js no expuso BDLRepoNotas."));}
      };
      script.onerror=function(){rejectPromise(new Error("No se pudo cargar bdl.repo.notas.js."));};
      (document.head||document.documentElement).appendChild(script);
    });
    return state.loadingScript;
  }
  function buildIndexes(rows){
    state.notes=(Array.isArray(rows)?rows:[]).map(normalizeNote);
    state.byStudent=Object.create(null);
    state.byCedula=Object.create(null);
    state.notes.forEach(function(note){
      var key=studentKey(note);
      var cedula=cedulaOf(note);
      if(key){state.byStudent[key]=note;}
      if(cedula){
        if(!state.byCedula[cedula]){state.byCedula[cedula]=[];}
        state.byCedula[cedula].push(note);
      }
    });
    state.loadedAt=new Date().toISOString();
    state.error="";
    return state.notes;
  }
  function loadNotes(force){
    if(state.loadingNotes&&!force){return state.loadingNotes;}
    state.loadingNotes=ensureNotesRepo().then(function(repo){
      return repo.list({});
    }).then(buildIndexes).catch(function(error){
      var message=error&&error.message?error.message:String(error);
      buildIndexes([]);
      state.error=message;
      return [];
    }).finally(function(){state.loadingNotes=null;});
    return state.loadingNotes;
  }
  function noteFor(row){
    var key=studentKey(row);
    if(key&&state.byStudent[key]){return state.byStudent[key];}
    var cedula=cedulaOf(row);
    var matches=cedula&&state.byCedula[cedula]?state.byCedula[cedula]:[];
    if(matches.length===1){return matches[0];}
    var periodoId=periodOf(row);
    return matches.filter(function(note){return !periodoId||periodOf(note)===periodoId;})[0]||null;
  }
  function hydrateStudent(row){
    var copy=Object.assign({},row||{});
    var note=noteFor(copy);
    copy._telegramUser=text(copy._telegramUser||copy.telegramUser||copy.usuarioTelegram||copy.telegram||"");
    copy._telegramChatId=text(copy._telegramChatId||copy.telegramChatId||copy.chatIdTelegram||copy.chatId||"");
    copy._hasTelegram=!!(copy._telegramUser||copy._telegramChatId);
    if(!note&&copy._bdlNotas&&typeof copy._bdlNotas==="object"){
      note=normalizeNote(Object.assign({cedula:cedulaOf(copy),periodoId:periodOf(copy)},copy._bdlNotas));
    }
    if(!note){return copy;}
    ["Notart","Nart","nart","notaArticulo","Notdef","Ndef","ndef","notaDefensa","Notafinal","NotaFinal","Nfin","nfin","notaFinal"].forEach(function(key){
      if(note[key]!==undefined){copy[key]=note[key];}
    });
    copy._bdlNotas=Object.assign({},note._bdlNotas||{});
    copy._bdlNotaRegistro=Object.assign({},note);
    return copy;
  }
  function hydrateRows(rows){return (Array.isArray(rows)?rows:[]).map(hydrateStudent);}
  function wrapArrayMethod(api,name){
    var original=api&&api[name];
    if(typeof original!=="function"||original.__statsDataWrapped){return;}
    var wrapped=function(){return hydrateRows(original.apply(api,arguments));};
    wrapped.__statsDataWrapped=true;
    wrapped.__original=original;
    api[name]=wrapped;
  }
  function wrapListStudents(api){
    var original=api&&api.listStudents;
    if(typeof original!=="function"||original.__statsDataWrapped){return;}
    var wrapped=function(){
      var result=original.apply(api,arguments)||{};
      var rows=hydrateRows(result.rows||result.estudiantes||result.students||[]);
      return Object.assign({},result,{rows:rows,estudiantes:rows,students:rows,total:rows.length});
    };
    wrapped.__statsDataWrapped=true;
    wrapped.__original=original;
    api.listStudents=wrapped;
  }
  function install(){
    var api=window.ConStats||window.BDLocalStats;
    if(!api){return false;}
    if(api.__statsDataPatchInstalled){state.installed=true;return true;}
    ["students","getStudents","rows","getRows"].forEach(function(name){wrapArrayMethod(api,name);});
    wrapListStudents(api);
    var originalReady=typeof api.ready==="function"?api.ready:null;
    api.ready=function(){
      return Promise.resolve(originalReady?originalReady.apply(api,arguments):true).then(function(result){
        return loadNotes(false).then(function(){return result;});
      });
    };
    ["refresh","refreshFull"].forEach(function(name){
      var original=api[name];
      if(typeof original!=="function"){return;}
      api[name]=function(){
        return Promise.resolve(original.apply(api,arguments)).then(function(result){
          return loadNotes(true).then(function(){return result;});
        });
      };
    });
    api.reloadNotes=function(){return loadNotes(true);};
    api.__statsDataPatchInstalled=true;
    state.installed=true;
    return true;
  }
  function ready(){
    if(state.readyPromise){return state.readyPromise;}
    state.readyPromise=Promise.resolve().then(function(){
      if(!install()){throw new Error("ConStats no está disponible para integrar notas.");}
      return loadNotes(false);
    }).then(function(){
      try{window.dispatchEvent(new CustomEvent("stats:data-ready",{detail:status()}));}catch(error){}
      return status();
    });
    return state.readyPromise;
  }
  function status(){
    return {ok:!state.error,version:VERSION,installed:state.installed,notes:state.notes.length,loadedAt:state.loadedAt,error:state.error};
  }

  window.StatsDataPatch={version:VERSION,install:install,ready:ready,reload:loadNotes,hydrateStudent:hydrateStudent,status:status};
  window.addEventListener("bdlocal:conexiones-cache-updated",function(){
    if(!state.installed){return;}
    loadNotes(true).then(function(){
      try{window.dispatchEvent(new CustomEvent("stats:data-updated",{detail:status()}));}catch(error){}
    });
  });
})(window,document);

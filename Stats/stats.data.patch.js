/* =========================================================
Nombre completo: stats.data.patch.js
Ruta: /Stats/stats.data.patch.js
Función:
- Normalizar las notas ya entregadas por ConStats.
- Aceptar notas directas y anidadas de formatos anteriores.
- Mantener Telegram y contactos hidratados por la conexión oficial.
- No cargar repositorios ni consultar IndexedDB desde Stats.
========================================================= */
(function(window){
  "use strict";

  var VERSION="2.0.0-constats-only";
  var state={installed:false,readyPromise:null,hydrated:0,loadedAt:"",error:""};

  function text(value){return String(value==null?"":value).trim();}
  function num(value){
    if(value===null||value===undefined||text(value)===""){return null;}
    var result=Number(text(value).replace(",","."));
    return Number.isFinite(result)?result:null;
  }
  function first(row,names){
    row=row||{};
    for(var i=0;i<names.length;i+=1){
      if(Object.prototype.hasOwnProperty.call(row,names[i])&&text(row[names[i]])!==""){return row[names[i]];}
    }
    return "";
  }
  function noteData(row){
    row=row||{};
    var nested=row._bdlNotas&&typeof row._bdlNotas==="object"
      ?row._bdlNotas
      :(row.notas&&typeof row.notas==="object"?row.notas:{});
    var source=Object.assign({},nested,row);
    var nart=num(first(source,["Notart","Nart","nart","notart","notaArticulo","nota_articulo","_nart"]));
    var ndef=num(first(source,["Notdef","Ndef","ndef","notdef","notaDefensa","nota_defensa","_ndef"]));
    var rawFinal=first(source,["Notafinal","NotaFinal","Nfinal","Nfin","nfin","notafinal","notaFinal","nota_final","_nfin"]);
    var nfin=num(rawFinal);
    if(nfin===null&&nart!==null&&ndef!==null&&nart>=7){
      nfin=Math.round(((nart*0.70)+(ndef*0.30))*100)/100;
    }
    return {nart:nart,ndef:ndef,nfin:nfin,nfinGuardado:num(rawFinal)};
  }
  function hydrateStudent(row){
    var copy=Object.assign({},row||{});
    var note=noteData(copy);
    copy._telegramUser=text(copy._telegramUser||copy.telegramUser||copy.usuarioTelegram||copy.telegram||"");
    copy._telegramChatId=text(copy._telegramChatId||copy.telegramChatId||copy.chatIdTelegram||copy.chatId||"");
    copy._hasTelegram=!!(copy._telegramUser||copy._telegramChatId);
    copy.Notart=copy.Nart=copy.nart=copy.notaArticulo=note.nart;
    copy.Notdef=copy.Ndef=copy.ndef=copy.notaDefensa=note.ndef;
    copy.Notafinal=copy.NotaFinal=copy.Nfin=copy.nfin=copy.notaFinal=note.nfin;
    copy._bdlNotas={
      nart:note.nart,ndef:note.ndef,nfin:note.nfin,nfinCalculado:note.nfin,
      nfinGuardado:note.nfinGuardado,completo:note.nfin!==null
    };
    state.hydrated+=1;
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
      if(Array.isArray(result)){return hydrateRows(result);}
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
    api.__statsDataPatchInstalled=true;
    state.installed=true;
    state.loadedAt=new Date().toISOString();
    state.error="";
    return true;
  }
  function ready(){
    if(state.readyPromise){return state.readyPromise;}
    state.readyPromise=Promise.resolve().then(function(){
      if(!install()){throw new Error("ConStats no está disponible para normalizar notas.");}
      try{window.dispatchEvent(new CustomEvent("stats:data-ready",{detail:status()}));}catch(error){}
      return status();
    }).catch(function(error){
      state.error=error&&error.message?error.message:String(error);
      return status();
    });
    return state.readyPromise;
  }
  function status(){
    return {ok:!state.error,version:VERSION,source:"ConStats",installed:state.installed,hydrated:state.hydrated,loadedAt:state.loadedAt,error:state.error};
  }

  window.StatsDataPatch={version:VERSION,install:install,ready:ready,hydrateStudent:hydrateStudent,status:status};
})(window);

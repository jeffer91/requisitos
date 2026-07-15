/* =========================================================
Nombre completo: stats.data.connector-patch.js
Ruta: /Stats/stats.data.connector-patch.js
Función:
- Hidratar estudiantes con notas entregadas por ConStats.
- No cargar repositorios ni abrir BDLocal desde Stats.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-constats-only";
  var state={installed:false,loading:null,notes:[],byKey:Object.create(null),byCedula:Object.create(null),error:"",loadedAt:""};

  function text(value){return String(value==null?"":value).trim();}
  function cedula(value){var raw=text(value).replace(/[^0-9A-Za-z]/g,"");return /^\d{9}$/.test(raw)?"0"+raw:raw;}
  function period(value){value=text(value);var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");}
  function api(){return window.ConStats||window.BDLocalStats||null;}
  function cedulaOf(row){row=row||{};return cedula(row.cedula||row._cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.Cedula||row["Cédula"]);}
  function periodOf(row){row=row||{};return period(row.periodoId||row.periodId||row.periodoCanonicoId||row.ultimoPeriodoId||row._periodoId||row._bl2PeriodoId);}
  function keyOf(row){var c=cedulaOf(row),p=periodOf(row);return c&&p?c+"__"+p:"";}
  function number(value){if(value===null||value===undefined||text(value)===""){return null;}var result=Number(text(value).replace(",","."));return Number.isFinite(result)?result:null;}
  function first(row,names){row=row||{};for(var i=0;i<names.length;i+=1){if(Object.prototype.hasOwnProperty.call(row,names[i])&&text(row[names[i]])!==""){return row[names[i]];}}return "";}

  function normalizeNote(input){
    var row=Object.assign({},input||{});
    var nested=row._bdlNotas&&typeof row._bdlNotas==="object"?row._bdlNotas:(row.notas&&typeof row.notas==="object"?row.notas:{});
    var source=Object.assign({},nested,row);
    var nart=number(first(source,["Notart","Nart","nart","notart","notaArticulo","nota_articulo","_nart"]));
    var ndef=number(first(source,["Notdef","Ndef","ndef","notdef","notaDefensa","nota_defensa","_ndef"]));
    var storedFinal=number(first(source,["Notafinal","NotaFinal","Nfinal","Nfin","nfin","notafinal","notaFinal","nota_final","_nfin"]));
    var nfin=storedFinal;
    if(nfin===null&&nart!==null&&ndef!==null&&nart>=7){nfin=Math.round(((nart*0.70)+(ndef*0.30))*100)/100;}
    return Object.assign({},row,{
      cedula:cedulaOf(row),periodoId:periodOf(row),
      Notart:nart,Nart:nart,nart:nart,notaArticulo:nart,
      Notdef:ndef,Ndef:ndef,ndef:ndef,notaDefensa:ndef,
      Notafinal:nfin,NotaFinal:nfin,Nfin:nfin,nfin:nfin,notaFinal:nfin,
      _bdlNotas:{nart:nart,ndef:ndef,nfin:nfin,nfinCalculado:nfin,nfinGuardado:storedFinal,completo:nfin!==null}
    });
  }

  function index(rows){
    state.notes=(Array.isArray(rows)?rows:[]).map(normalizeNote);
    state.byKey=Object.create(null);
    state.byCedula=Object.create(null);
    state.notes.forEach(function(note){
      var key=keyOf(note),id=cedulaOf(note);
      if(key){state.byKey[key]=note;}
      if(id){if(!state.byCedula[id]){state.byCedula[id]=[];}state.byCedula[id].push(note);}
    });
    state.loadedAt=new Date().toISOString();
    state.error="";
    return state.notes;
  }

  function load(force){
    if(state.loading&&!force){return state.loading;}
    var current=api();
    if(!current||typeof current.listNotes!=="function"){return Promise.reject(new Error("ConStats.listNotes no está disponible."));}
    state.loading=Promise.resolve(current.listNotes({})).then(index).catch(function(error){
      index([]);
      state.error=error&&error.message?error.message:String(error);
      return [];
    }).finally(function(){state.loading=null;});
    return state.loading;
  }

  function noteFor(row){
    var key=keyOf(row);
    if(key&&state.byKey[key]){return state.byKey[key];}
    var id=cedulaOf(row),list=id&&state.byCedula[id]?state.byCedula[id]:[];
    if(list.length===1){return list[0];}
    var p=periodOf(row);
    return list.filter(function(note){return !p||periodOf(note)===p;})[0]||null;
  }

  function hydrate(row){
    var copy=Object.assign({},row||{}),note=noteFor(row);
    copy._telegramUser=text(copy._telegramUser||copy.telegramUser||copy.usuarioTelegram||copy.telegram);
    copy._telegramChatId=text(copy._telegramChatId||copy.telegramChatId||copy.chatIdTelegram||copy.chatId);
    copy._hasTelegram=!!(copy._telegramUser||copy._telegramChatId);
    if(!note){return copy;}
    ["Notart","Nart","nart","notaArticulo","Notdef","Ndef","ndef","notaDefensa","Notafinal","NotaFinal","Nfin","nfin","notaFinal"].forEach(function(name){copy[name]=note[name];});
    copy._bdlNotas=Object.assign({},note._bdlNotas||{});
    copy._bdlNotaRegistro=Object.assign({},note);
    return copy;
  }
  function hydrateRows(rows){return (Array.isArray(rows)?rows:[]).map(hydrate);}
  function mapResult(result){
    if(Array.isArray(result)){return hydrateRows(result);}
    result=result&&typeof result==="object"?result:{};
    var rows=hydrateRows(result.rows||result.estudiantes||result.students||[]);
    return Object.assign({},result,{rows:rows,estudiantes:rows,students:rows,total:rows.length});
  }
  function maybe(value,mapper){return value&&typeof value.then==="function"?value.then(mapper):mapper(value);}
  function wrap(apiObject,name,mapper){
    var original=apiObject&&apiObject[name];
    if(typeof original!=="function"||original.__statsConnectorPatch){return;}
    var wrapped=function(){return maybe(original.apply(apiObject,arguments),mapper);};
    wrapped.__statsConnectorPatch=true;
    wrapped.__original=original;
    apiObject[name]=wrapped;
  }

  function install(){
    var current=api();
    if(!current){return false;}
    if(current.__statsConnectorDataPatch){state.installed=true;return true;}
    ["students","getStudents","rows","getRows"].forEach(function(name){wrap(current,name,hydrateRows);});
    wrap(current,"listStudents",mapResult);
    var originalReady=typeof current.ready==="function"?current.ready:null;
    current.ready=function(){var args=arguments;return Promise.resolve(originalReady?originalReady.apply(current,args):true).then(function(result){return load(false).then(function(){return result;});});};
    ["refresh","refreshFull"].forEach(function(name){
      var original=current[name];
      if(typeof original!=="function"){return;}
      current[name]=function(){var args=arguments;return Promise.resolve(original.apply(current,args)).then(function(result){return load(true).then(function(){return result;});});};
    });
    current.__statsConnectorDataPatch=true;
    state.installed=true;
    return true;
  }

  function ready(){
    if(!install()){return Promise.reject(new Error("ConStats no está disponible."));}
    return load(false).then(function(){return status();});
  }
  function status(){return {ok:!state.error,version:VERSION,source:"ConStats",installed:state.installed,notes:state.notes.length,loadedAt:state.loadedAt,error:state.error};}

  window.StatsDataPatch={version:VERSION,install:install,ready:ready,reload:load,hydrateStudent:hydrate,status:status};
  window.addEventListener("bdlocal:conexiones-cache-updated",function(){if(state.installed){load(true);}});
})(window);

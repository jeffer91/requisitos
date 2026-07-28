/* =========================================================
Nombre completo: ncomplex.render-ready.js
Ruta: /Ncomplex/ncomplex.render-ready.js
Función:
- Confirmar cuándo Ncomplex terminó de cargar períodos o estudiantes y pintar la pantalla.
- Esperar estado, resumen, tabla, paginación y conteo visible.
- Publicar el evento estándar de pantalla lista sin consultar bases.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-visible-ready";
  var READY_EVENT="maqueta:screen-render-complete";
  var state={installed:false,tracking:false,sequence:0,reason:"",startedAt:0,lastReadyAt:0,lastDurationMs:0,lastSignature:"",emissions:0};
  var observer=null;
  var pollTimer=null;
  var timeoutTimer=null;
  var wrapTimer=null;
  var unsubscribe=null;

  function text(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function el(id){return document.getElementById(id);}
  function app(){return window.NcomplexApp||null;}
  function model(){try{return window.NcomplexState&&typeof window.NcomplexState.get==="function"?window.NcomplexState.get()||{}:{};}catch(error){return {};}}
  function pending(value){return /cargando|conectando|preparando|guardando|analizando|procesando/i.test(text(value));}

  function readiness(){
    var current=model();
    var status=el("ncomplex-status");
    var period=el("ncomplex-filter-periodo");
    var visible=el("ncomplex-visible-count");
    var summary=el("ncomplex-summary");
    var careers=el("ncomplex-career-summary");
    var table=el("ncomplex-table-wrap");
    var pagination=el("ncomplex-pagination");
    var statusText=text(status&&status.textContent);
    var records=Array.isArray(current.records)?current.records:[];
    var filtered=Array.isArray(current.filteredRecords)?current.filteredRecords:records;

    if(!app()||!window.NcomplexState||current.ready!==true||current.loading===true||current.saving===true){return {ready:false,stage:"app"};}
    if(!statusText||pending(statusText)){return {ready:false,stage:"status"};}
    if(!period||!period.options||period.options.length<1||/Cargando períodos/i.test(text(period.options[0]&&period.options[0].textContent))){return {ready:false,stage:"periods"};}
    if(!visible||pending(visible.textContent)||text(visible.textContent)!==filtered.length+" visible(s)"){return {ready:false,stage:"count"};}
    if(!summary||!careers||!table||!pagination){return {ready:false,stage:"layout"};}
    if(pending(summary.textContent)||pending(careers.textContent)||pending(table.textContent)){return {ready:false,stage:"content"};}
    if(current.selectedPeriodId&&text(period.value)!==text(current.selectedPeriodId)){return {ready:false,stage:"selected-period"};}

    return {
      ready:true,
      stage:"complete",
      periodId:text(current.selectedPeriodId),
      total:records.length,
      visible:filtered.length,
      status:statusText
    };
  }

  function signature(info){return [info.stage,info.periodId||"",info.total||0,info.visible||0,info.status||""].join("|");}
  function stop(){
    if(observer){observer.disconnect();observer=null;}
    if(pollTimer){window.clearInterval(pollTimer);pollTimer=null;}
    if(timeoutTimer){window.clearTimeout(timeoutTimer);timeoutTimer=null;}
  }

  function emitReady(info,seq){
    if(!state.tracking||seq!==state.sequence){return false;}
    state.tracking=false;
    state.lastReadyAt=Date.now();
    state.lastDurationMs=Math.max(0,state.lastReadyAt-state.startedAt);
    state.lastSignature=signature(info);
    state.emissions+=1;
    stop();
    try{
      window.dispatchEvent(new CustomEvent(READY_EVENT,{detail:{
        moduleId:"ncomplex",
        screen:"ncomplex",
        reason:state.reason||"render",
        stage:info.stage||"complete",
        periodId:info.periodId||"",
        total:Number(info.total||0),
        visible:Number(info.visible||0),
        durationMs:state.lastDurationMs,
        at:new Date(state.lastReadyAt).toISOString(),
        source:"NcomplexRenderReady"
      }}));
    }catch(error){}
    return true;
  }

  function check(seq){
    if(!state.tracking||seq!==state.sequence){return false;}
    var info=readiness();
    if(!info.ready){return false;}
    var raf=window.requestAnimationFrame||function(fn){return window.setTimeout(fn,16);};
    raf(function(){raf(function(){
      if(!state.tracking||seq!==state.sequence){return;}
      var confirmed=readiness();
      if(confirmed.ready){window.setTimeout(function(){emitReady(confirmed,seq);},25);}
    });});
    return true;
  }

  function track(reason){
    stop();
    state.sequence+=1;
    var seq=state.sequence;
    state.tracking=true;
    state.reason=text(reason||"render");
    state.startedAt=Date.now();
    if(window.MutationObserver&&document.body){
      observer=new MutationObserver(function(){check(seq);});
      observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
    }
    pollTimer=window.setInterval(function(){ensureHooks();check(seq);},80);
    timeoutTimer=window.setTimeout(function(){if(state.tracking&&seq===state.sequence){state.tracking=false;stop();}},30000);
    check(seq);
    return seq;
  }

  function wrap(target,name){
    if(!target||typeof target[name]!=="function"||target[name].__ncomplexReadyWrapped){return false;}
    var original=target[name];
    var wrapped=function(){
      track(name+":"+text(arguments[0]&&arguments[0].reason||arguments[0]||""));
      var result=original.apply(this,arguments);
      if(result&&typeof result.then==="function"){result.then(function(){check(state.sequence);},function(){check(state.sequence);});}
      else{check(state.sequence);}
      return result;
    };
    wrapped.__ncomplexReadyWrapped=true;
    wrapped.__original=original;
    target[name]=wrapped;
    return true;
  }

  function ensureHooks(){
    var current=app();
    if(current){
      wrap(current,"init");
      wrap(current,"render");
      wrap(current,"loadPeriods");
      wrap(current,"loadPeriod");
    }
    if(!unsubscribe&&window.NcomplexState&&typeof window.NcomplexState.subscribe==="function"){
      unsubscribe=window.NcomplexState.subscribe(function(modelState,reason){track("state:"+text(reason));});
    }
    return !!current;
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    ensureHooks();
    [
      "ncomplex:bootstrap-ready",
      "bdlocal:screen-data-updated",
      "bdlocal:pantallas:updated",
      "bdlocal:connections:updated"
    ].forEach(function(name){window.addEventListener(name,function(){track(name);});});
    wrapTimer=window.setInterval(function(){if(ensureHooks()&&unsubscribe){window.clearInterval(wrapTimer);wrapTimer=null;}},80);
    track("initial-bootstrap");
    return status();
  }

  function status(){
    var info=readiness();
    return {version:VERSION,installed:state.installed,tracking:state.tracking,sequence:state.sequence,reason:state.reason,ready:info.ready,stage:info.stage,lastReadyAt:state.lastReadyAt,lastDurationMs:state.lastDurationMs,lastSignature:state.lastSignature,emissions:state.emissions};
  }

  window.NcomplexRenderReady={version:VERSION,install:install,track:track,status:status};
  install();
})(window,document);

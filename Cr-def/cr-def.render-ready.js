/* =========================================================
Nombre completo: cr-def.render-ready.js
Ruta: /Cr-def/cr-def.render-ready.js
Función:
- Confirmar cuándo Cr-def terminó de preparar períodos, estado, cache y tabla visible.
- Esperar el resultado de una actualización de estudiantes aptos antes de finalizar.
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

  function text(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function query(selector){return document.querySelector(selector);}
  function app(){return window.CR_DEF_APP||null;}
  function appState(){try{return app()&&app().state?app().state:{};}catch(error){return {};}}
  function pending(value){return /cargando|conectando|esperando|leyendo|procesando|actualizando/i.test(text(value));}

  function readiness(){
    var current=appState();
    var period=query("[data-cr-periodo]");
    var periodHelp=query("[data-cr-periodo-help]");
    var alert=query("[data-cr-alerta-principal]");
    var hint=query("[data-cr-actions-hint]");
    var tableBody=query("[data-cr-tabla-body]");
    var cache=query("[data-cr-cache-status]");
    var periodHelpText=text(periodHelp&&periodHelp.textContent);
    var alertText=text(alert&&alert.textContent);
    var hintText=text(hint&&hint.textContent);
    var cacheText=text(cache&&cache.textContent);

    if(!app()||current.loading===true){return {ready:false,stage:"app"};}
    if(!period||!period.options||period.options.length<1){return {ready:false,stage:"periods"};}
    if(!periodHelpText||pending(periodHelpText)||/El período se carga desde BDLocal/i.test(periodHelpText)){return {ready:false,stage:"period-help"};}
    if(!alertText||pending(alertText)){return {ready:false,stage:"alert"};}
    if(!hintText||pending(hintText)){return {ready:false,stage:"actions"};}
    if(!tableBody||!tableBody.children.length){return {ready:false,stage:"table"};}
    if(!cacheText||/Cache pendiente/i.test(cacheText)||pending(cacheText)){return {ready:false,stage:"cache"};}
    if(current.periodo&&text(period.value)!==text(current.periodo)){return {ready:false,stage:"selected-period"};}

    return {
      ready:true,
      stage:"complete",
      periodId:text(current.periodo),
      total:Array.isArray(current.rows)?current.rows.length:0,
      rows:tableBody.querySelectorAll("tr").length,
      cache:cacheText,
      alert:alertText
    };
  }

  function signature(info){return [info.stage,info.periodId||"",info.total||0,info.rows||0,info.cache||"",info.alert||""].join("|");}
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
        moduleId:"cr_def",
        screen:"cr-def",
        reason:state.reason||"render",
        stage:info.stage||"complete",
        periodId:info.periodId||"",
        total:Number(info.total||0),
        durationMs:state.lastDurationMs,
        at:new Date(state.lastReadyAt).toISOString(),
        source:"CrDefRenderReady"
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
    pollTimer=window.setInterval(function(){ensureWrapped();check(seq);},80);
    timeoutTimer=window.setTimeout(function(){if(state.tracking&&seq===state.sequence){state.tracking=false;stop();}},30000);
    check(seq);
    return seq;
  }

  function wrap(target,name){
    if(!target||typeof target[name]!=="function"||target[name].__crDefReadyWrapped){return false;}
    var original=target[name];
    var wrapped=function(){
      track(name+":"+text(arguments[0]&&arguments[0].reason||arguments[0]||""));
      var result=original.apply(this,arguments);
      if(result&&typeof result.then==="function"){result.then(function(){check(state.sequence);},function(){check(state.sequence);});}
      else{check(state.sequence);}
      return result;
    };
    wrapped.__crDefReadyWrapped=true;
    wrapped.__original=original;
    target[name]=wrapped;
    return true;
  }

  function ensureWrapped(){
    var current=app();
    if(!current){return false;}
    wrap(current,"render");
    wrap(current,"actualizarAptos");
    return true;
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    ensureWrapped();
    [
      "cr-def:bootstrap-ready",
      "bdlocal:screen-data-updated",
      "bdlocal:pantallas:updated",
      "bdlocal:connections:updated"
    ].forEach(function(name){window.addEventListener(name,function(){track(name);});});
    wrapTimer=window.setInterval(function(){if(ensureWrapped()){window.clearInterval(wrapTimer);wrapTimer=null;}},80);
    track("initial-bootstrap");
    return status();
  }

  function status(){
    var info=readiness();
    return {version:VERSION,installed:state.installed,tracking:state.tracking,sequence:state.sequence,reason:state.reason,ready:info.ready,stage:info.stage,lastReadyAt:state.lastReadyAt,lastDurationMs:state.lastDurationMs,lastSignature:state.lastSignature,emissions:state.emissions};
  }

  window.CrDefRenderReady={version:VERSION,install:install,track:track,status:status};
  install();
})(window,document);

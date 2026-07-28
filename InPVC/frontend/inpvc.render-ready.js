/* =========================================================
Nombre completo: inpvc.render-ready.js
Ruta: /InPVC/frontend/inpvc.render-ready.js
Función:
- Confirmar cuándo InPVC terminó de cargar los períodos y pintar su estado inicial.
- Si existe un informe generado, esperar KPIs y todas las secciones visibles.
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
  function el(id){return document.getElementById(id);}
  function app(){return window.InPVCApp||null;}
  function model(){try{return app()&&app().state?app().state:{};}catch(error){return {};}}
  function pending(value){return /cargando|conectando|leyendo|actualizando|generando|preparando/i.test(text(value));}

  function readiness(){
    var current=model();
    var status=el("inpvc-status");
    var period=el("inpvc-period");
    var date=el("inpvc-date");
    var code=el("inpvc-code");
    var sections=el("inpvc-sections");
    var total=el("inpvc-total");
    var approved=el("inpvc-approved");
    var failed=el("inpvc-failed");
    var rate=el("inpvc-rate");
    var statusText=text(status&&status.textContent);
    var periods=Array.isArray(current.periods)?current.periods:[];

    if(!app()){return {ready:false,stage:"app"};}
    if(!statusText||pending(statusText)){return {ready:false,stage:"status"};}
    if(!period||!period.options||period.options.length!==periods.length+1){return {ready:false,stage:"periods"};}
    if(/Cargando períodos/i.test(text(period.options[0]&&period.options[0].textContent))){return {ready:false,stage:"period-options"};}
    if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(text(date.value))||!code||!text(code.value)){return {ready:false,stage:"metadata"};}
    if(!sections){return {ready:false,stage:"sections"};}

    if(current.context){
      var ctx=current.context;
      var expected=Array.isArray(ctx.sections)?ctx.sections.length:0;
      var cards=sections.querySelectorAll(".inpvc-section-card").length;
      var summary=ctx.summary||{};
      if(cards!==expected){return {ready:false,stage:"section-cards"};}
      if(text(total&&total.textContent)!==String(Number(summary.total||0))){return {ready:false,stage:"total"};}
      if(text(approved&&approved.textContent)!==String(Number(summary.aprobados||0))){return {ready:false,stage:"approved"};}
      if(text(failed&&failed.textContent)!==String(Number(summary.reprobados||0))){return {ready:false,stage:"failed"};}
      if(text(rate&&rate.textContent)!==text((summary.porcentajeAprobacion||0)+" %")){return {ready:false,stage:"rate"};}
    }else if(!text(sections.textContent)){
      return {ready:false,stage:"empty-state"};
    }

    return {
      ready:true,
      stage:current.context?"report-complete":"periods-complete",
      periods:periods.length,
      total:Number(current.context&&current.context.summary&&current.context.summary.total||0),
      sections:Number(current.context&&current.context.sections&&current.context.sections.length||0),
      status:statusText
    };
  }

  function signature(info){return [info.stage,info.periods||0,info.total||0,info.sections||0,info.status||""].join("|");}
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
        moduleId:"titulacion",
        screen:"inpvc",
        reason:state.reason||"render",
        stage:info.stage||"complete",
        periods:Number(info.periods||0),
        total:Number(info.total||0),
        sections:Number(info.sections||0),
        durationMs:state.lastDurationMs,
        at:new Date(state.lastReadyAt).toISOString(),
        source:"InPVCRenderReady"
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
    if(!target||typeof target[name]!=="function"||target[name].__inpvcReadyWrapped){return false;}
    var original=target[name];
    var wrapped=function(){
      track(name+":"+text(arguments[0]&&arguments[0].reason||arguments[0]||""));
      var result=original.apply(this,arguments);
      if(result&&typeof result.then==="function"){result.then(function(){check(state.sequence);},function(){check(state.sequence);});}
      else{check(state.sequence);}
      return result;
    };
    wrapped.__inpvcReadyWrapped=true;
    wrapped.__original=original;
    target[name]=wrapped;
    return true;
  }

  function ensureWrapped(){
    var current=app();
    if(!current){return false;}
    wrap(current,"init");
    wrap(current,"generate");
    return true;
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    ensureWrapped();
    [
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

  window.InPVCRenderReady={version:VERSION,install:install,track:track,status:status};
  install();
})(window,document);

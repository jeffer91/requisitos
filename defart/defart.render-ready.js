/* =========================================================
Nombre completo: defart.render-ready.js
Ruta: /defart/defart.render-ready.js
Función:
- Confirmar cuándo Defensas terminó de calcular y pintar filtros, KPIs y tabla.
- Evitar terminar mientras exista un render pendiente o datos en carga.
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
  function app(){return window.DefartApp||null;}
  function appState(){try{return app()&&typeof app().getState==="function"?app().getState()||{}:{};}catch(error){return {};}}
  function pending(value){return /cargando|preparando|actualizando|conectando|procesando/i.test(text(value));}

  function readiness(){
    var current=appState();
    var data=current.data&&typeof current.data==="object"?current.data:null;
    var visible=el("def-visible-count");
    var save=el("def-save-state");
    var table=el("def-table-wrap");
    var status=el("def-status");
    var diagnostics=el("def-diagnostics");
    var tableText=text(table&&table.textContent);
    var statusText=text(status&&status.textContent);

    if(!app()||current.booted!==true||current.rendering===true||current.renderQueued===true||!data){return {ready:false,stage:"app"};}
    if(data.diagnostics&&data.diagnostics.loading===true){return {ready:false,stage:"data"};}
    if(!visible||pending(visible.textContent)){return {ready:false,stage:"count"};}
    if(!save||pending(save.textContent)){return {ready:false,stage:"save"};}
    if(!table||!table.children.length||pending(tableText)){return {ready:false,stage:"table"};}
    if(statusText&&pending(statusText)){return {ready:false,stage:"status"};}
    if(!diagnostics||!text(diagnostics.textContent)){return {ready:false,stage:"diagnostics"};}

    var rows=Array.isArray(data.rows)?data.rows:[];
    return {
      ready:true,
      stage:"complete",
      periodId:text(current.periodId),
      total:rows.length,
      visible:text(visible.textContent),
      status:statusText
    };
  }

  function signature(info){return [info.stage,info.periodId||"",info.total||0,info.visible||"",info.status||""].join("|");}
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
        moduleId:"defart",
        screen:"defensas",
        reason:state.reason||"render",
        stage:info.stage||"complete",
        periodId:info.periodId||"",
        total:Number(info.total||0),
        durationMs:state.lastDurationMs,
        at:new Date(state.lastReadyAt).toISOString(),
        source:"DefartRenderReady"
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
    if(!target||typeof target[name]!=="function"||target[name].__defartReadyWrapped){return false;}
    var original=target[name];
    var wrapped=function(){
      track(name+":"+text(arguments[0]&&arguments[0].reason||arguments[0]||""));
      var result=original.apply(this,arguments);
      if(result&&typeof result.then==="function"){result.then(function(){check(state.sequence);},function(){check(state.sequence);});}
      else{check(state.sequence);}
      return result;
    };
    wrapped.__defartReadyWrapped=true;
    wrapped.__original=original;
    target[name]=wrapped;
    return true;
  }

  function ensureWrapped(){
    var current=app();
    if(!current){return false;}
    wrap(current,"render");
    wrap(current,"boot");
    return true;
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    ensureWrapped();
    [
      "defart:bootstrap-ready",
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

  window.DefartRenderReady={version:VERSION,install:install,track:track,status:status};
  install();
})(window,document);

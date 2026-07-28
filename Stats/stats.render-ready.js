/* =========================================================
Nombre completo: stats.render-ready.js
Ruta: /Stats/stats.render-ready.js
Función:
- Confirmar cuándo Stats terminó de calcular y pintar sus filtros, indicadores, notas, tablas y estudiantes.
- Publicar el evento estándar de pantalla lista después de dos ciclos de pintado.
- Evitar que el contador principal termine solo con la señal técnica de BDLocal.
- No consultar IndexedDB ni servicios externos.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-visible-ready";
  var READY_EVENT="maqueta:screen-render-complete";
  var state={
    installed:false,
    tracking:false,
    sequence:0,
    reason:"",
    startedAt:0,
    lastReadyAt:0,
    lastDurationMs:0,
    lastSignature:"",
    emissions:0
  };
  var observer=null;
  var pollTimer=null;
  var timeoutTimer=null;

  function text(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function el(id){return document.getElementById(id);}
  function app(){return window.StatsApp||null;}
  function appState(){try{return app()&&typeof app().getState==="function"?app().getState()||{}:{};}catch(error){return {};}}
  function pending(value){return /cargando|calculando|actualizando|conectando|preparando/i.test(text(value));}

  function readiness(){
    var current=appState();
    var status=el("stats-status");
    var statusText=text(status&&status.textContent);
    var data=current.data&&typeof current.data==="object"?current.data:{};
    var period=el("stats-periodo");
    var notes=el("stats-notes");
    var students=el("stats-estudiantes");
    var total=el("stats-total");

    if(!app()||current.ready!==true||current.rendering===true||current.pendingRender){
      return {ready:false,stage:"app"};
    }
    if(!statusText||pending(statusText)||!/Stats (?:cargado|listo)/i.test(statusText)){
      return {ready:false,stage:"status"};
    }
    if(period&&text(period.value)!==text(current.periodId)){
      return {ready:false,stage:"period"};
    }
    if(text(total&&total.textContent)!==String(Number(data.total||0))){
      return {ready:false,stage:"kpis"};
    }
    if(current.periodId){
      if(pending(notes&&notes.textContent)){
        return {ready:false,stage:"notes"};
      }
      if(pending(students&&students.textContent)){
        return {ready:false,stage:"students"};
      }
    }

    return {
      ready:true,
      stage:"complete",
      periodId:text(current.periodId),
      total:Number(data.total||0),
      status:statusText
    };
  }

  function signature(info){return [info.stage,info.periodId||"",info.total||0,info.status||""].join("|");}
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
        moduleId:"stat_main",
        screen:"stats",
        reason:state.reason||"render",
        periodId:info.periodId||"",
        total:Number(info.total||0),
        stage:info.stage||"complete",
        durationMs:state.lastDurationMs,
        at:new Date(state.lastReadyAt).toISOString(),
        source:"StatsRenderReady"
      }}));
    }catch(error){}
    return true;
  }

  function check(seq){
    if(!state.tracking||seq!==state.sequence){return false;}
    var info=readiness();
    if(!info.ready){return false;}
    var raf=window.requestAnimationFrame||function(fn){return window.setTimeout(fn,16);};
    raf(function(){
      raf(function(){
        if(!state.tracking||seq!==state.sequence){return;}
        var confirmed=readiness();
        if(confirmed.ready){window.setTimeout(function(){emitReady(confirmed,seq);},25);}
      });
    });
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
    pollTimer=window.setInterval(function(){check(seq);},80);
    timeoutTimer=window.setTimeout(function(){if(state.tracking&&seq===state.sequence){state.tracking=false;stop();}},30000);
    check(seq);
    return seq;
  }

  function wrap(target,name){
    if(!target||typeof target[name]!=="function"||target[name].__statsReadyWrapped){return;}
    var original=target[name];
    var wrapped=function(){
      track(name+":"+text(arguments[0]&&arguments[0].reason||arguments[0]||""));
      return original.apply(this,arguments);
    };
    wrapped.__statsReadyWrapped=true;
    wrapped.__original=original;
    target[name]=wrapped;
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    wrap(app(),"render");
    wrap(app(),"refreshFromBDLocal");
    wrap(app(),"manualRefresh");
    [
      "bdlocal:screen-data-updated",
      "bdlocal:pantallas:updated",
      "bdlocal:connections:updated",
      "stats:bootstrap-ready"
    ].forEach(function(name){window.addEventListener(name,function(){track(name);});});
    track("initial-bootstrap");
    return status();
  }

  function status(){
    var info=readiness();
    return {
      version:VERSION,
      installed:state.installed,
      tracking:state.tracking,
      sequence:state.sequence,
      reason:state.reason,
      ready:info.ready,
      stage:info.stage,
      lastReadyAt:state.lastReadyAt,
      lastDurationMs:state.lastDurationMs,
      lastSignature:state.lastSignature,
      emissions:state.emissions
    };
  }

  window.StatsRenderReady={version:VERSION,install:install,track:track,status:status};
  install();
})(window,document);

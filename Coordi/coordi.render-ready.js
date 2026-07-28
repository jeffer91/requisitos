/* =========================================================
Nombre completo: coordi.render-ready.js
Ruta: /Coordi/coordi.render-ready.js
Función:
- Confirmar cuándo Coordi terminó de construir y pintar el reporte y la comunicación.
- Publicar el evento estándar de pantalla lista después de dos ciclos de pintado.
- Evitar que el contador principal termine al recibir únicamente la señal de BDLocal.
- No consultar IndexedDB ni servicios externos.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-visible-ready";
  var READY_EVENT="maqueta:screen-render-complete";
  var state={installed:false,tracking:false,sequence:0,reason:"",startedAt:0,lastReadyAt:0,lastDurationMs:0,lastSignature:"",emissions:0};
  var observer=null;
  var pollTimer=null;
  var timeoutTimer=null;

  function text(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function el(id){return document.getElementById(id);}
  function app(){return window.CoordiApp||null;}
  function appState(){try{return app()&&typeof app().getState==="function"?app().getState()||{}:{};}catch(error){return {};}}
  function visible(node){
    if(!node||node.hidden===true){return false;}
    try{var style=window.getComputedStyle?window.getComputedStyle(node):null;return !style||style.display!=="none"&&style.visibility!=="hidden";}
    catch(error){return true;}
  }
  function pending(value){return /cargando|actualizando|conectando|preparando/i.test(text(value));}

  function readiness(){
    var current=appState();
    var report=current.report&&typeof current.report==="object"?current.report:null;
    var status=el("coordi-status");
    var statusText=text(status&&status.textContent);
    var period=el("coordi-periodo");
    var summary=el("coordi-summary");
    var communication=el("coordi-communication");
    var subject=el("coordi-mail-subject");
    var preview=el("coordi-email-preview");
    var total=el("coordi-total");

    if(!app()||current.loading===true||current.pendingRender){return {ready:false,stage:"app"};}
    if(statusText&&pending(statusText)){return {ready:false,stage:"status"};}
    if(period&&text(period.value)!==text(current.periodId)){return {ready:false,stage:"period"};}
    if(!current.periodId){
      return report?{ready:true,stage:"empty",periodId:"",total:0}:{ready:false,stage:"report"};
    }
    if(!report){return {ready:false,stage:"report"};}
    if(!visible(summary)||!visible(communication)){return {ready:false,stage:"layout"};}
    if(!text(subject&&subject.textContent)||!text(preview&&preview.textContent)){return {ready:false,stage:"mail"};}
    if(!text(total&&total.textContent)){return {ready:false,stage:"kpis"};}

    return {
      ready:true,
      stage:"complete",
      periodId:text(current.periodId),
      total:Number(text(total&&total.textContent)||0),
      subject:text(subject&&subject.textContent)
    };
  }

  function signature(info){return [info.stage,info.periodId||"",info.total||0,info.subject||""].join("|");}
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
        moduleId:"coordi",
        screen:"coordi",
        reason:state.reason||"render",
        periodId:info.periodId||"",
        total:Number(info.total||0),
        stage:info.stage||"complete",
        durationMs:state.lastDurationMs,
        at:new Date(state.lastReadyAt).toISOString(),
        source:"CoordiRenderReady"
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
    if(!target||typeof target[name]!=="function"||target[name].__coordiReadyWrapped){return;}
    var original=target[name];
    var wrapped=function(){
      track(name+":"+text(arguments[0]&&arguments[0].reason||arguments[0]||""));
      var result=original.apply(this,arguments);
      if(result&&typeof result.then==="function"){
        result.then(function(){check(state.sequence);},function(){check(state.sequence);});
      }
      return result;
    };
    wrapped.__coordiReadyWrapped=true;
    wrapped.__original=original;
    target[name]=wrapped;
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    wrap(app(),"render");
    wrap(app(),"refresh");
    [
      "bdlocal:screen-data-updated",
      "bdlocal:pantallas:updated",
      "bdlocal:connections:updated",
      "coordi:bootstrap-ready"
    ].forEach(function(name){window.addEventListener(name,function(){track(name);});});
    track("initial-bootstrap");
    return status();
  }

  function status(){
    var info=readiness();
    return {version:VERSION,installed:state.installed,tracking:state.tracking,sequence:state.sequence,reason:state.reason,ready:info.ready,stage:info.stage,lastReadyAt:state.lastReadyAt,lastDurationMs:state.lastDurationMs,lastSignature:state.lastSignature,emissions:state.emissions};
  }

  window.CoordiRenderReady={version:VERSION,install:install,track:track,status:status};
  install();
})(window,document);

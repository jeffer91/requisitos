/* =========================================================
Nombre completo: global.render-ready.js
Ruta: /Global/global.render-ready.js
Función:
- Confirmar cuándo Global terminó de leer, calcular y pintar la sección activa.
- Esperar filtros, menú, estado final y contenido visible.
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
  function app(){return window.GlobalApp||null;}
  function pending(value){return /cargando|leyendo|actualizando|conectando|preparando/i.test(text(value));}
  function lastData(){try{return app()&&typeof app().getLastData==="function"?app().getLastData():null;}catch(error){return null;}}

  function readiness(){
    var currentApp=app();
    var data=lastData();
    var status=el("globalSectionState");
    var body=el("globalSectionBody");
    var title=el("globalSectionTitle");
    var menu=el("globalMenu");
    var statusText=text(status&&status.textContent);
    var statusState=text(status&&status.getAttribute("data-state"));
    var bodyText=text(body&&body.textContent);

    if(!currentApp||!data){return {ready:false,stage:"app"};}
    if(!statusText||pending(statusText)||["success","ready"].indexOf(statusState)<0){return {ready:false,stage:"status"};}
    if(!/Datos listos/i.test(statusText)){return {ready:false,stage:"data"};}
    if(!menu||!menu.querySelector("button[data-global-section]")){return {ready:false,stage:"menu"};}
    if(!body||!body.children.length||pending(bodyText)){return {ready:false,stage:"body"};}
    if(!text(title&&title.textContent)){return {ready:false,stage:"title"};}

    return {
      ready:true,
      stage:"complete",
      section:currentApp.getActiveSection?text(currentApp.getActiveSection()):"",
      title:text(title.textContent),
      total:Number(data&&data.resumen&&data.resumen.totalEstudiantes||data&&data.students&&data.students.length||0),
      status:statusText
    };
  }

  function signature(info){return [info.stage,info.section||"",info.title||"",info.total||0,info.status||""].join("|");}
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
        moduleId:"global",
        screen:"global",
        reason:state.reason||"render",
        stage:info.stage||"complete",
        section:info.section||"",
        total:Number(info.total||0),
        durationMs:state.lastDurationMs,
        at:new Date(state.lastReadyAt).toISOString(),
        source:"GlobalRenderReady"
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
    if(!target||typeof target[name]!=="function"||target[name].__globalReadyWrapped){return false;}
    var original=target[name];
    var wrapped=function(){
      track(name+":"+text(arguments[0]&&arguments[0].reason||arguments[0]||""));
      var result=original.apply(this,arguments);
      if(result&&typeof result.then==="function"){result.then(function(){check(state.sequence);},function(){check(state.sequence);});}
      else{check(state.sequence);}
      return result;
    };
    wrapped.__globalReadyWrapped=true;
    wrapped.__original=original;
    target[name]=wrapped;
    return true;
  }

  function ensureWrapped(){
    var current=app();
    if(!current){return false;}
    wrap(current,"render");
    wrap(current,"setActiveSection");
    return true;
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    ensureWrapped();
    [
      "global:rendered",
      "global:bootstrap-ready",
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

  window.GlobalRenderReady={version:VERSION,install:install,track:track,status:status};
  install();
})(window,document);

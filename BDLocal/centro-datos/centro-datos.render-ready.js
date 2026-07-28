/* =========================================================
Nombre completo: centro-datos.render-ready.js
Ruta: /BDLocal/centro-datos/centro-datos.render-ready.js
Función:
- Confirmar cuándo Centro de datos terminó el arranque de BDLocal y pintó su resumen.
- Esperar la actualización local y externa de la interfaz, no solo la carga de scripts.
- Publicar el evento estándar de pantalla lista sin consultar ni modificar bases.
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
  function pending(value){return /cargando|detectando|registrando|comprobando|preparando|procesando|actualizando/i.test(text(value));}
  function uiState(){
    try{return window.CentroDatosUI&&typeof window.CentroDatosUI.getState==="function"?window.CentroDatosUI.getState()||{}:{};}
    catch(error){return {};}
  }

  function readiness(){
    var current=uiState();
    var root=el("bdlocal-control-center-root");
    var db=el("bl2-db-pill");
    var view=el("bl2-view-status");
    var students=el("bl2-kpi-students");
    var period=el("bl2-period-select");
    var active=root&&root.querySelector?root.querySelector(".bdlc-section.is-active"):null;
    var dbText=text(db&&db.textContent);
    var viewText=text(view&&view.textContent);

    if(!window.CentroDatosUI||current.mounted!==true){return {ready:false,stage:"mount"};}
    if(!/BDLocal lista/i.test(dbText)){return {ready:false,stage:"database"};}
    if(!viewText||pending(viewText)){return {ready:false,stage:"refresh"};}
    if(!/Centro de datos (?:actualizado|con información parcial)/i.test(viewText)){return {ready:false,stage:"summary"};}
    if(!root||!active||!students||!period){return {ready:false,stage:"layout"};}

    return {
      ready:true,
      stage:"complete",
      section:text(current.section||active.getAttribute("data-bl2-section")),
      students:text(students.textContent),
      periods:period.options?period.options.length:0,
      view:viewText
    };
  }

  function signature(info){return [info.stage,info.section||"",info.students||"",info.periods||0,info.view||""].join("|");}
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
        moduleId:"baselocal",
        screen:"centro-datos",
        reason:state.reason||"render",
        stage:info.stage||"complete",
        section:info.section||"",
        students:info.students||"0",
        durationMs:state.lastDurationMs,
        at:new Date(state.lastReadyAt).toISOString(),
        source:"CentroDatosRenderReady"
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
      if(confirmed.ready){window.setTimeout(function(){emitReady(confirmed,seq);},30);}
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
    pollTimer=window.setInterval(function(){check(seq);},80);
    timeoutTimer=window.setTimeout(function(){if(state.tracking&&seq===state.sequence){state.tracking=false;stop();}},30000);
    check(seq);
    return seq;
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    [
      "centro-datos:ready",
      "centro-datos:updated",
      "bdlocal:bl2-html-scripts-loaded",
      "bdlocal:screen-data-updated",
      "bdlocal:pantallas:updated",
      "bdlocal:connections:updated"
    ].forEach(function(name){window.addEventListener(name,function(){track(name);});});
    track("initial-bootstrap");
    return status();
  }

  function status(){
    var info=readiness();
    return {version:VERSION,installed:state.installed,tracking:state.tracking,sequence:state.sequence,reason:state.reason,ready:info.ready,stage:info.stage,lastReadyAt:state.lastReadyAt,lastDurationMs:state.lastDurationMs,lastSignature:state.lastSignature,emissions:state.emissions};
  }

  window.CentroDatosRenderReady={version:VERSION,install:install,track:track,status:status};
  install();
})(window,document);

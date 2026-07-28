/* =========================================================
Nombre completo: maq-bdlocal-delivery-timer.js
Ruta o ubicación: /Maqueta/maq-bdlocal-delivery-timer.js
Función o funciones:
- Medir cuánto tarda la entrega de datos desde BDLocal hasta la pantalla activa.
- Iniciar el contador al abrir o refrescar una pantalla.
- Detenerlo cuando la pantalla recibe el evento de actualización de BDLocal.
- Confirmar también la llegada inicial de períodos en la pantalla Carga.
- Mostrar la medición en la barra inferior de la aplicación.
- No leer IndexedDB ni ejecutar sincronizaciones externas.
Con qué se conecta:
- maq-core.js.
- maq-screen-fast-sync.js.
- Carga/carga.startup-metrics.js.
- maq-index.html.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.1.0-bdlocal-delivery";
  var MAX_WAIT_MS=30000;
  var EVENT_NAMES=[
    "bdlocal:screen-data-updated",
    "bdlocal:pantallas:updated",
    "bdlocal:connections:updated",
    "carga:periods-refreshed"
  ];

  var state={
    installed:false,
    running:false,
    moduloId:"",
    moduloNombre:"",
    startedAt:0,
    startedEpochAt:0,
    elapsedMs:0,
    lastDurationMs:0,
    lastModuleId:"",
    lastModuleName:"",
    lastReason:"",
    lastCompletedAt:"",
    completions:0,
    timeouts:0,
    baselineActiveUpdates:0
  };

  var tickTimer=null;
  var timeoutTimer=null;
  var boundFrame=null;
  var boundChild=null;
  var frameLoadHandler=null;
  var childHandler=null;

  function text(value){return String(value==null?"":value).trim();}
  function nowISO(){return new Date().toISOString();}
  function clock(){return window.performance&&typeof window.performance.now==="function"?window.performance.now():Date.now();}
  function core(){return window.MAQ_CORE||null;}
  function fastSync(){return window.MAQ_SCREEN_FAST_SYNC||null;}
  function output(){return document.getElementById("maq-bdlocal-delivery-time");}

  function formatDuration(ms){
    ms=Math.max(0,Number(ms||0));
    if(ms<1000){return Math.round(ms)+" ms";}
    try{
      return new Intl.NumberFormat("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2}).format(ms/1000)+" s";
    }catch(error){
      return (ms/1000).toFixed(2).replace(".",",")+" s";
    }
  }

  function render(value,status,message){
    var el=output();
    if(!el){return;}
    el.textContent=value;
    el.dataset.state=status||"idle";
    el.title=message||"Tiempo desde que se abre la pantalla hasta que recibe los datos de BDLocal.";
  }

  function frameForModule(moduloId){
    var frames=Array.prototype.slice.call(document.querySelectorAll("iframe")||[]);
    return frames.filter(function(frame){
      return text(frame&&frame.dataset&&frame.dataset.moduleId)===text(moduloId);
    })[0]||null;
  }

  function clearTimers(){
    if(tickTimer){window.clearInterval(tickTimer);tickTimer=null;}
    if(timeoutTimer){window.clearTimeout(timeoutTimer);timeoutTimer=null;}
  }

  function detach(){
    if(boundFrame&&frameLoadHandler){
      try{boundFrame.removeEventListener("load",frameLoadHandler);}catch(error){}
    }
    if(boundChild&&childHandler){
      EVENT_NAMES.forEach(function(name){
        try{boundChild.removeEventListener(name,childHandler);}catch(error){}
      });
    }
    boundFrame=null;
    boundChild=null;
    frameLoadHandler=null;
    childHandler=null;
  }

  function finish(reason,durationOverrideMs){
    if(!state.running){return false;}
    var override=Number(durationOverrideMs);
    state.elapsedMs=Number.isFinite(override)
      ? Math.max(0,override)
      : Math.max(0,clock()-state.startedAt);
    state.lastDurationMs=Math.round(state.elapsedMs);
    state.lastModuleId=state.moduloId;
    state.lastModuleName=state.moduloNombre;
    state.lastReason=text(reason||"data-arrived");
    state.lastCompletedAt=nowISO();
    state.completions+=1;
    state.running=false;
    clearTimers();
    detach();
    render(
      formatDuration(state.lastDurationMs),
      "ok",
      "Los datos de BDLocal llegaron a "+(state.lastModuleName||state.lastModuleId||"la pantalla")+" en "+formatDuration(state.lastDurationMs)+"."
    );
    try{
      window.dispatchEvent(new CustomEvent("maqueta:bdlocal-delivery-measured",{detail:status()}));
    }catch(error){}
    return true;
  }

  function timeout(){
    if(!state.running){return;}
    state.elapsedMs=Math.max(0,clock()-state.startedAt);
    state.lastDurationMs=Math.round(state.elapsedMs);
    state.lastModuleId=state.moduloId;
    state.lastModuleName=state.moduloNombre;
    state.lastReason="timeout";
    state.lastCompletedAt=nowISO();
    state.timeouts+=1;
    state.running=false;
    clearTimers();
    detach();
    render(
      "> "+formatDuration(MAX_WAIT_MS),
      "timeout",
      "No se confirmó la llegada de datos de BDLocal a "+(state.lastModuleName||state.lastModuleId||"la pantalla")+" dentro del tiempo máximo."
    );
  }

  function checkFastSync(){
    var api=fastSync();
    if(!state.running||!api||typeof api.status!=="function"){return false;}
    var current={};
    try{current=api.status()||{};}catch(error){current={};}
    if(
      Number(current.activeUpdates||0)>Number(state.baselineActiveUpdates||0)&&
      text(current.lastModuleId)===state.moduloId
    ){
      return finish("fast-sync-confirmed");
    }
    return false;
  }

  function checkCargaMetrics(){
    if(!state.running||state.moduloId!=="carga_excel"||!boundChild){return false;}
    var metrics=null;
    try{
      metrics=boundChild.CargaStartupMetrics&&typeof boundChild.CargaStartupMetrics.status==="function"
        ? boundChild.CargaStartupMetrics.status()
        : null;
    }catch(error){metrics=null;}
    if(!metrics||!Number(metrics.periodsReadyAt||0)){return false;}
    var duration=Math.max(0,Number(metrics.periodsReadyAt)-Number(state.startedEpochAt||0));
    return finish("carga-periods-ready",duration);
  }

  function tick(){
    if(!state.running){return;}
    state.elapsedMs=Math.max(0,clock()-state.startedAt);
    render(
      formatDuration(state.elapsedMs),
      "running",
      "Midiendo la entrega de datos de BDLocal a "+(state.moduloNombre||state.moduloId||"la pantalla")+"."
    );
    if(checkCargaMetrics()){return;}
    checkFastSync();
  }

  function attachChild(frame){
    if(!frame||!state.running){return false;}
    var child=null;
    try{child=frame.contentWindow||null;}catch(error){child=null;}
    if(!child||typeof child.addEventListener!=="function"){return false;}

    if(boundChild&&boundChild!==child&&childHandler){
      EVENT_NAMES.forEach(function(name){
        try{boundChild.removeEventListener(name,childHandler);}catch(error){}
      });
    }

    boundChild=child;
    childHandler=childHandler||function(event){
      if(!state.running){return;}
      var detail=event&&event.detail&&typeof event.detail==="object"?event.detail:{};
      var target=text(detail.targetModuleId||detail.moduloId||"");
      if(target&&target!==state.moduloId){return;}
      if(event&&event.type==="carga:periods-refreshed"&&state.moduloId!=="carga_excel"){return;}
      finish(event&&event.type||"screen-event");
    };

    EVENT_NAMES.forEach(function(name){
      try{
        child.removeEventListener(name,childHandler);
        child.addEventListener(name,childHandler);
      }catch(error){}
    });
    window.setTimeout(checkCargaMetrics,0);
    return true;
  }

  function attachFrame(frame){
    detach();
    if(!frame){return false;}
    boundFrame=frame;
    frameLoadHandler=function(){
      if(!state.running||text(frame.dataset&&frame.dataset.moduleId)!==state.moduloId){return;}
      attachChild(frame);
    };
    try{frame.addEventListener("load",frameLoadHandler);}catch(error){}
    attachChild(frame);
    return true;
  }

  function start(payload,reason){
    payload=payload||{};
    var currentCore=core();
    var moduloId=text(
      payload.moduloId||
      payload.id||
      currentCore&&currentCore.state&&currentCore.state.moduloActivoId||
      ""
    );
    if(!moduloId){return false;}

    clearTimers();
    detach();

    var syncState={};
    var api=fastSync();
    try{syncState=api&&typeof api.status==="function"?api.status()||{}:{};}catch(error){syncState={};}

    state.running=true;
    state.moduloId=moduloId;
    state.moduloNombre=text(payload.modulo&&payload.modulo.nombre||payload.moduloNombre||moduloId);
    state.startedAt=clock();
    state.startedEpochAt=Date.now();
    state.elapsedMs=0;
    state.lastReason=text(reason||"module-activated");
    state.baselineActiveUpdates=Number(syncState.activeUpdates||0);

    render("0 ms","running","Midiendo la entrega de datos de BDLocal a "+state.moduloNombre+".");
    attachFrame(frameForModule(moduloId));
    tickTimer=window.setInterval(tick,40);
    timeoutTimer=window.setTimeout(timeout,MAX_WAIT_MS);
    return true;
  }

  function onModuleChanged(payload){
    start(payload||{},"module-activated");
  }

  function onRefresh(){
    var current=core();
    var id=text(current&&current.state&&current.state.moduloActivoId||"");
    if(!id){return;}
    var modulo=current&&current.router&&typeof current.router.buscarModulo==="function"
      ? current.router.buscarModulo(id)
      : null;
    window.setTimeout(function(){
      start({moduloId:id,modulo:modulo},"manual-refresh");
    },0);
  }

  function status(){
    return {
      version:VERSION,
      installed:state.installed,
      running:state.running,
      moduloId:state.moduloId,
      moduloNombre:state.moduloNombre,
      elapsedMs:Math.round(state.running?Math.max(0,clock()-state.startedAt):state.elapsedMs),
      lastDurationMs:state.lastDurationMs,
      lastModuleId:state.lastModuleId,
      lastModuleName:state.lastModuleName,
      lastReason:state.lastReason,
      lastCompletedAt:state.lastCompletedAt,
      completions:state.completions,
      timeouts:state.timeouts
    };
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    var current=core();
    if(current&&current.bus&&typeof current.bus.on==="function"){
      current.bus.on("modulo:cambiado",onModuleChanged);
    }
    var refresh=document.getElementById("maq-btn-refresh");
    if(refresh){refresh.addEventListener("click",onRefresh);}
    render("—","idle","Tiempo desde que se abre la pantalla hasta que recibe los datos de BDLocal.");
    return status();
  }

  window.MAQ_BDLOCAL_DELIVERY_TIMER={
    version:VERSION,
    install:install,
    start:start,
    finish:finish,
    status:status
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",install,{once:true});
  }else{
    install();
  }
})(window,document);

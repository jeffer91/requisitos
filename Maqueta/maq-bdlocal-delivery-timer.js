/* =========================================================
Nombre completo: maq-bdlocal-delivery-timer.js
Ruta o ubicación: /Maqueta/maq-bdlocal-delivery-timer.js
Función o funciones:
- Medir desde la apertura de una pantalla hasta que sus datos quedan visibles y utilizables.
- Diferenciar la llegada técnica de datos del renderizado final de la interfaz.
- Exigir confirmación visual propia en Carga, Tabla, Ficha, Stats y Coordi.
- Usar estabilidad real del DOM como respaldo para las demás pantallas.
- Mostrar la medición en la barra inferior sin consultar fuentes externas.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.2.0-explicit-screen-ready";
  var MAX_WAIT_MS=30000;
  var READY_EVENT="maqueta:screen-render-complete";
  var DATA_EVENTS=[
    "bdlocal:screen-data-updated",
    "bdlocal:pantallas:updated",
    "bdlocal:connections:updated",
    "carga:periods-refreshed"
  ];
  var ALL_EVENTS=DATA_EVENTS.concat([READY_EVENT]);
  var EXPLICIT_READY_MODULES={
    carga_excel:true,
    tabla_principal:true,
    ficha_estudiante:true,
    stat_main:true,
    coordi:true
  };
  var READY_PROBES={
    tabla_principal:{path:"core/tabla.render-ready.js",global:"TablaRenderReady"},
    stat_main:{path:"stats.render-ready.js",global:"StatsRenderReady"},
    coordi:{path:"coordi.render-ready.js",global:"CoordiRenderReady"}
  };

  var state={
    installed:false,
    running:false,
    moduloId:"",
    moduloNombre:"",
    startedAt:0,
    startedEpochAt:0,
    elapsedMs:0,
    dataArrivedAt:0,
    dataDurationMs:0,
    domMutations:0,
    lastMutationAt:0,
    lastDurationMs:0,
    lastModuleId:"",
    lastModuleName:"",
    lastReason:"",
    lastCompletedAt:"",
    completions:0,
    timeouts:0,
    baselineActiveUpdates:0,
    baselineReadyEmissions:0
  };

  var tickTimer=null;
  var timeoutTimer=null;
  var settleTimer=null;
  var boundFrame=null;
  var boundChild=null;
  var frameLoadHandler=null;
  var childHandler=null;
  var domObserver=null;

  function text(value){return String(value==null?"":value).trim();}
  function nowISO(){return new Date().toISOString();}
  function clock(){return window.performance&&typeof window.performance.now==="function"?window.performance.now():Date.now();}
  function core(){return window.MAQ_CORE||null;}
  function fastSync(){return window.MAQ_SCREEN_FAST_SYNC||null;}
  function output(){return document.getElementById("maq-bdlocal-delivery-time");}

  function formatDuration(ms){
    ms=Math.max(0,Number(ms||0));
    if(ms<1000){return Math.round(ms)+" ms";}
    try{return new Intl.NumberFormat("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2}).format(ms/1000)+" s";}
    catch(error){return (ms/1000).toFixed(2).replace(".",",")+" s";}
  }

  function render(value,status,message){
    var el=output();
    if(!el){return;}
    el.textContent=value;
    el.dataset.state=status||"idle";
    el.title=message||"Tiempo hasta que la pantalla queda visible con los datos de BDLocal.";
  }

  function frameForModule(moduloId){
    return Array.prototype.slice.call(document.querySelectorAll("iframe")||[]).filter(function(frame){
      return text(frame&&frame.dataset&&frame.dataset.moduleId)===text(moduloId);
    })[0]||null;
  }

  function clearTimers(){
    if(tickTimer){window.clearInterval(tickTimer);tickTimer=null;}
    if(timeoutTimer){window.clearTimeout(timeoutTimer);timeoutTimer=null;}
    if(settleTimer){window.clearTimeout(settleTimer);settleTimer=null;}
  }

  function disconnectDomObserver(){
    if(domObserver){try{domObserver.disconnect();}catch(error){}domObserver=null;}
  }

  function detach(){
    if(boundFrame&&frameLoadHandler){try{boundFrame.removeEventListener("load",frameLoadHandler);}catch(error){}}
    if(boundChild&&childHandler){
      ALL_EVENTS.forEach(function(name){try{boundChild.removeEventListener(name,childHandler);}catch(error){}});
    }
    disconnectDomObserver();
    boundFrame=null;
    boundChild=null;
    frameLoadHandler=null;
    childHandler=null;
  }

  function markData(reason){
    if(!state.running){return false;}
    if(!state.dataArrivedAt){
      state.dataArrivedAt=clock();
      state.dataDurationMs=Math.max(0,state.dataArrivedAt-state.startedAt);
    }
    state.lastReason=text(reason||"data-arrived");
    return true;
  }

  function finish(reason){
    if(!state.running){return false;}
    state.elapsedMs=Math.max(0,clock()-state.startedAt);
    state.lastDurationMs=Math.round(state.elapsedMs);
    state.lastModuleId=state.moduloId;
    state.lastModuleName=state.moduloNombre;
    state.lastReason=text(reason||"screen-visible");
    state.lastCompletedAt=nowISO();
    state.completions+=1;
    state.running=false;
    clearTimers();
    detach();
    render(
      formatDuration(state.lastDurationMs),
      "ok",
      (state.lastModuleName||state.lastModuleId||"La pantalla")+" quedó visible con datos en "+formatDuration(state.lastDurationMs)+
      (state.dataDurationMs?". La señal de datos llegó en "+formatDuration(state.dataDurationMs)+".":".")
    );
    try{window.dispatchEvent(new CustomEvent("maqueta:bdlocal-delivery-measured",{detail:status()}));}catch(error){}
    return true;
  }

  function finishAfterPaint(reason){
    if(!state.running){return false;}
    var child=boundChild||window;
    var raf=child&&typeof child.requestAnimationFrame==="function"
      ? child.requestAnimationFrame.bind(child)
      : function(fn){return window.setTimeout(fn,16);};
    raf(function(){
      raf(function(){
        if(!state.running){return;}
        settleTimer=window.setTimeout(function(){finish(reason||"paint-confirmed");},20);
      });
    });
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
    render("> "+formatDuration(MAX_WAIT_MS),"timeout","No se confirmó que "+(state.lastModuleName||state.lastModuleId||"la pantalla")+" quedara lista dentro del tiempo máximo.");
  }

  function checkFastSync(){
    var api=fastSync();
    if(!state.running||!api||typeof api.status!=="function"){return false;}
    var current={};
    try{current=api.status()||{};}catch(error){current={};}
    if(Number(current.activeUpdates||0)>Number(state.baselineActiveUpdates||0)&&text(current.lastModuleId)===state.moduloId){
      return markData("fast-sync-data-arrived");
    }
    return false;
  }

  function fichaReadyStatus(){
    if(!boundChild){return null;}
    try{return boundChild.FichaRenderReady&&typeof boundChild.FichaRenderReady.status==="function"?boundChild.FichaRenderReady.status()||null:null;}
    catch(error){return null;}
  }

  function checkFichaReady(){
    if(!state.running||state.moduloId!=="ficha_estudiante"){return false;}
    var current=fichaReadyStatus();
    if(!current||current.ready!==true){return false;}
    if(Number(current.emissions||0)>Number(state.baselineReadyEmissions||0)){
      return finishAfterPaint("ficha-visible-ready");
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
    if(!metrics||!Number(metrics.periodsReadyAt||0)||Number(metrics.periodsReadyAt)<Number(state.startedEpochAt||0)){return false;}
    markData("carga-periods-arrived");
    return finishAfterPaint("carga-periods-visible");
  }

  function installDomObserver(child){
    disconnectDomObserver();
    if(!child||!child.MutationObserver||!child.document||!child.document.body){return false;}
    try{
      domObserver=new child.MutationObserver(function(records){
        if(!state.running||!state.dataArrivedAt){return;}
        state.domMutations+=Array.isArray(records)?records.length:1;
        state.lastMutationAt=clock();
      });
      domObserver.observe(child.document.body,{subtree:true,childList:true,characterData:true,attributes:true});
      return true;
    }catch(error){domObserver=null;return false;}
  }

  function genericPaintFallback(){
    if(!state.running||!state.dataArrivedAt||EXPLICIT_READY_MODULES[state.moduloId]){return false;}
    var elapsedAfterData=clock()-state.dataArrivedAt;
    if(state.domMutations>0&&state.lastMutationAt&&clock()-state.lastMutationAt>=220){
      return finishAfterPaint("generic-dom-stable");
    }
    if(state.domMutations===0&&elapsedAfterData>=1800){
      var ready=false;
      try{ready=!!boundChild&&!!boundChild.document&&boundChild.document.readyState==="complete";}catch(error){ready=false;}
      return ready?finishAfterPaint("generic-no-visual-change"):false;
    }
    return false;
  }

  function tick(){
    if(!state.running){return;}
    state.elapsedMs=Math.max(0,clock()-state.startedAt);
    render(
      formatDuration(state.elapsedMs),
      "running",
      state.dataArrivedAt
        ? "Los datos ya llegaron; esperando que "+(state.moduloNombre||state.moduloId||"la pantalla")+" termine de mostrarlos."
        : "Esperando datos de BDLocal para "+(state.moduloNombre||state.moduloId||"la pantalla")+"."
    );
    checkFastSync();
    if(checkFichaReady()){return;}
    if(checkCargaMetrics()){return;}
    genericPaintFallback();
  }

  function eventMatches(detail){
    detail=detail&&typeof detail==="object"?detail:{};
    var target=text(detail.targetModuleId||detail.moduleId||detail.moduloId||"");
    return !target||target===state.moduloId;
  }

  function ensureReadyProbe(child,moduleId){
    var config=READY_PROBES[moduleId];
    if(!config||!child||!child.document){return false;}
    try{
      if(child[config.global]){return true;}
      var doc=child.document;
      var locationHref=text(child.location&&child.location.href||"");
      if(!locationHref||locationHref==="about:blank"){return false;}
      var existing=doc.querySelector('script[data-maq-ready-probe="'+moduleId+'"]');
      if(existing){return true;}
      var script=doc.createElement("script");
      script.src=new URL(config.path,locationHref).href;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-maq-ready-probe",moduleId);
      (doc.head||doc.documentElement).appendChild(script);
      return true;
    }catch(error){return false;}
  }

  function attachChild(frame){
    if(!frame||!state.running){return false;}
    var child=null;
    try{child=frame.contentWindow||null;}catch(error){child=null;}
    if(!child||typeof child.addEventListener!=="function"){return false;}

    if(boundChild&&boundChild!==child&&childHandler){
      ALL_EVENTS.forEach(function(name){try{boundChild.removeEventListener(name,childHandler);}catch(error){}});
    }

    boundChild=child;
    ensureReadyProbe(child,state.moduloId);
    installDomObserver(child);
    if(state.moduloId==="ficha_estudiante"){
      var ready=fichaReadyStatus();
      state.baselineReadyEmissions=Number(ready&&ready.emissions||0);
    }

    childHandler=childHandler||function(event){
      if(!state.running){return;}
      var detail=event&&event.detail&&typeof event.detail==="object"?event.detail:{};
      if(!eventMatches(detail)){return;}
      if(event&&event.type===READY_EVENT){
        markData(detail.source||READY_EVENT);
        finishAfterPaint(detail.source||"screen-render-complete");
        return;
      }
      if(event&&event.type==="carga:periods-refreshed"){
        if(state.moduloId!=="carga_excel"){return;}
        markData(event.type);
        finishAfterPaint("carga-periods-visible");
        return;
      }
      markData(event&&event.type||"data-event");
    };

    ALL_EVENTS.forEach(function(name){
      try{child.removeEventListener(name,childHandler);child.addEventListener(name,childHandler);}catch(error){}
    });
    window.setTimeout(function(){ensureReadyProbe(child,state.moduloId);checkCargaMetrics();checkFichaReady();},0);
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
    var moduloId=text(payload.moduloId||payload.id||currentCore&&currentCore.state&&currentCore.state.moduloActivoId||"");
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
    state.dataArrivedAt=0;
    state.dataDurationMs=0;
    state.domMutations=0;
    state.lastMutationAt=0;
    state.lastReason=text(reason||"module-activated");
    state.baselineActiveUpdates=Number(syncState.activeUpdates||0);
    state.baselineReadyEmissions=0;

    render("0 ms","running","Esperando datos y renderizado de "+state.moduloNombre+".");
    attachFrame(frameForModule(moduloId));
    tickTimer=window.setInterval(tick,40);
    timeoutTimer=window.setTimeout(timeout,MAX_WAIT_MS);
    return true;
  }

  function onModuleChanged(payload){start(payload||{},"module-activated");}

  function onRefresh(){
    var current=core();
    var id=text(current&&current.state&&current.state.moduloActivoId||"");
    if(!id){return;}
    var modulo=current&&current.router&&typeof current.router.buscarModulo==="function"?current.router.buscarModulo(id):null;
    window.setTimeout(function(){start({moduloId:id,modulo:modulo},"manual-refresh");},0);
  }

  function status(){
    return {
      version:VERSION,
      installed:state.installed,
      running:state.running,
      moduloId:state.moduloId,
      moduloNombre:state.moduloNombre,
      elapsedMs:Math.round(state.running?Math.max(0,clock()-state.startedAt):state.elapsedMs),
      dataDurationMs:Math.round(state.dataDurationMs||0),
      domMutations:state.domMutations,
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
    if(current&&current.bus&&typeof current.bus.on==="function"){current.bus.on("modulo:cambiado",onModuleChanged);}
    var refresh=document.getElementById("maq-btn-refresh");
    if(refresh){refresh.addEventListener("click",onRefresh);}
    render("—","idle","Tiempo hasta que la pantalla queda visible con los datos de BDLocal.");
    return status();
  }

  window.MAQ_BDLOCAL_DELIVERY_TIMER={version:VERSION,install:install,start:start,finish:finish,status:status};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",install,{once:true});}else{install();}
})(window,document);

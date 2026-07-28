/* =========================================================
Nombre completo: maq-bdlocal-delivery-timer.js
Ruta: /Maqueta/maq-bdlocal-delivery-timer.js
Función:
- Medir el tiempo hasta que la pantalla activa queda visible.
- Escuchar eventos reales y estados de la pantalla sin observar todo el DOM.
- Evitar falsos tiempos de 30 segundos al volver a un iframe ya cargado.
- Mantener el diagnóstico con un consumo mínimo.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="3.0.0-all-active-screens-ready";
  var MAX_WAIT_MS=30000;
  var READY_EVENT="maqueta:screen-render-complete";
  var DATA_EVENTS=["bdlocal:screen-data-updated","bdlocal:pantallas:updated","bdlocal:connections:updated","carga:periods-refreshed"];
  var ALL_EVENTS=DATA_EVENTS.concat([READY_EVENT]);
  var EXPLICIT_READY_MODULES={carga_excel:true,baselocal:true,tabla_principal:true,ficha_estudiante:true,stat_main:true,coordi:true,global:true,modulo_reporte:true,defart:true,ncomplex:true,cr_def:true,titulacion:true};
  var READY_PROBES={
    baselocal:{path:"centro-datos/centro-datos.render-ready.js",global:"CentroDatosRenderReady"},
    tabla_principal:{path:"core/tabla.render-ready.js",global:"TablaRenderReady"},
    stat_main:{path:"stats.render-ready.js",global:"StatsRenderReady"},
    coordi:{path:"coordi.render-ready.js",global:"CoordiRenderReady"},
    global:{path:"global.render-ready.js",global:"GlobalRenderReady"},
    modulo_reporte:{path:"repo.render-ready.js",global:"ReportesRenderReady"},
    defart:{path:"defart.render-ready.js",global:"DefartRenderReady"},
    ncomplex:{path:"ncomplex.render-ready.js",global:"NcomplexRenderReady"},
    cr_def:{path:"cr-def.render-ready.js",global:"CrDefRenderReady"},
    titulacion:{path:"frontend/inpvc.render-ready.js",global:"InPVCRenderReady"}
  };

  var state={installed:false,running:false,moduloId:"",moduloNombre:"",startedAt:0,startedEpochAt:0,elapsedMs:0,dataArrivedAt:0,dataDurationMs:0,lastDurationMs:0,lastModuleId:"",lastModuleName:"",lastReason:"",lastCompletedAt:"",completions:0,timeouts:0};
  var tickTimer=null,timeoutTimer=null,boundFrame=null,boundChild=null,frameLoadHandler=null,childHandler=null,verifyTimers=[];

  function text(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function clock(){return window.performance&&typeof window.performance.now==="function"?window.performance.now():Date.now();}
  function core(){return window.MAQ_CORE||null;}
  function output(){return document.getElementById("maq-bdlocal-delivery-time");}
  function format(ms){ms=Math.max(0,Number(ms||0));if(ms<1000){return Math.round(ms)+" ms";}try{return new Intl.NumberFormat("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2}).format(ms/1000)+" s";}catch(error){return (ms/1000).toFixed(2).replace(".",",")+" s";}}
  function render(value,status,title){var node=output();if(!node){return;}node.textContent=value;node.dataset.state=status||"idle";node.title=title||"Tiempo hasta que la pantalla queda visible.";}
  function frameFor(moduleId){return Array.prototype.slice.call(document.querySelectorAll("iframe")||[]).filter(function(frame){return text(frame.dataset&&frame.dataset.moduleId)===text(moduleId);})[0]||null;}
  function clearTimers(){if(tickTimer){window.clearInterval(tickTimer);tickTimer=null;}if(timeoutTimer){window.clearTimeout(timeoutTimer);timeoutTimer=null;}verifyTimers.forEach(function(id){window.clearTimeout(id);});verifyTimers=[];}
  function detach(){if(boundFrame&&frameLoadHandler){try{boundFrame.removeEventListener("load",frameLoadHandler);}catch(error){}}if(boundChild&&childHandler){ALL_EVENTS.forEach(function(name){try{boundChild.removeEventListener(name,childHandler);}catch(error){}});}boundFrame=null;boundChild=null;frameLoadHandler=null;childHandler=null;}
  function schedule(fn,delay){var id=window.setTimeout(fn,delay);verifyTimers.push(id);return id;}
  function markData(reason){if(!state.running){return;}if(!state.dataArrivedAt){state.dataArrivedAt=clock();state.dataDurationMs=Math.max(0,state.dataArrivedAt-state.startedAt);}state.lastReason=text(reason||"data-arrived");}

  function finish(reason){
    if(!state.running){return false;}
    state.elapsedMs=Math.max(0,clock()-state.startedAt);state.lastDurationMs=Math.round(state.elapsedMs);state.lastModuleId=state.moduloId;state.lastModuleName=state.moduloNombre;state.lastReason=text(reason||"screen-ready");state.lastCompletedAt=new Date().toISOString();state.completions+=1;state.running=false;
    clearTimers();detach();
    render(format(state.lastDurationMs),"ok",(state.lastModuleName||state.lastModuleId||"La pantalla")+" quedó visible en "+format(state.lastDurationMs)+(state.dataDurationMs?"; los datos llegaron en "+format(state.dataDurationMs):""));
    try{window.dispatchEvent(new CustomEvent("maqueta:bdlocal-delivery-measured",{detail:status()}));}catch(error){}
    return true;
  }
  function finishAfterPaint(reason){
    if(!state.running){return false;}
    var target=boundChild||window;var raf=target&&typeof target.requestAnimationFrame==="function"?target.requestAnimationFrame.bind(target):function(fn){return window.setTimeout(fn,16);};
    raf(function(){raf(function(){schedule(function(){finish(reason||"paint-ready");},20);});});return true;
  }
  function timeout(){
    if(!state.running){return;}
    state.elapsedMs=Math.max(0,clock()-state.startedAt);state.lastDurationMs=Math.round(state.elapsedMs);state.lastModuleId=state.moduloId;state.lastModuleName=state.moduloNombre;state.lastReason="timeout";state.lastCompletedAt=new Date().toISOString();state.timeouts+=1;state.running=false;
    clearTimers();detach();render("No lista","timeout","La pantalla no confirmó que terminó de cargar dentro de 30 segundos.");
  }

  function childDocument(){try{return boundChild&&boundChild.document||null;}catch(error){return null;}}
  function byId(id){var doc=childDocument();return doc&&doc.getElementById?doc.getElementById(id):null;}
  function nodeText(id){var node=byId(id);return text(node&&node.textContent);}
  function notLoading(value){return !/cargando|conectando|preparando|procesando|actualizando|recuperando|leyendo/i.test(text(value));}
  function probeApi(){var cfg=READY_PROBES[state.moduloId];if(!cfg||!boundChild){return null;}try{return boundChild[cfg.global]||null;}catch(error){return null;}}
  function probeReady(){
    var api=probeApi();if(!api||typeof api.status!=="function"){return false;}
    try{var current=api.status()||{};return current.ready===true||Number(current.emissions||0)>0||Number(current.lastReadyAt||0)>0;}catch(error){return false;}
  }

  function moduleReady(){
    if(!state.running||!boundChild){return false;}
    var doc=childDocument();if(!doc||doc.readyState!=="complete"){return false;}
    if(probeReady()){return true;}
    try{
      if(state.moduloId==="carga_excel"){
        var metrics=boundChild.CargaStartupMetrics&&boundChild.CargaStartupMetrics.status&&boundChild.CargaStartupMetrics.status();
        return !!(metrics&&Number(metrics.periodsReadyAt||0)>=state.startedEpochAt);
      }
      if(state.moduloId==="tabla_principal"){
        var tableState=boundChild.TablaApp&&boundChild.TablaApp.getState?boundChild.TablaApp.getState():{};
        var wrap=byId("tabla-table-wrap");var statusText=nodeText("tabla-status");
        return !!boundChild.TablaApp&&tableState.rendering!==true&&notLoading(statusText)&&!!wrap&&(wrap.querySelectorAll("tbody tr").length>0||/sin datos/i.test(text(wrap.textContent)));
      }
      if(state.moduloId==="ficha_estudiante"){
        var fichaState=boundChild.FichaApp&&boundChild.FichaApp.getState?boundChild.FichaApp.getState():{};
        return !!boundChild.FichaApp&&fichaState.rendering!==true&&notLoading(nodeText("ficha-status"))&&!!byId("ficha-periodo")&&byId("ficha-periodo").options.length>1&&notLoading(nodeText("ficha-list"));
      }
      if(state.moduloId==="stat_main"){
        var statsState=boundChild.StatsApp&&boundChild.StatsApp.getState?boundChild.StatsApp.getState():{};
        return !!boundChild.StatsApp&&statsState.rendering!==true&&!statsState.pendingRender&&notLoading(nodeText("stats-status"))&&byId("stats-periodo").options.length>1&&notLoading(nodeText("stats-notes"));
      }
      if(state.moduloId==="coordi"){
        var coordiState=boundChild.CoordiApp&&boundChild.CoordiApp.getState?boundChild.CoordiApp.getState():{};
        return !!boundChild.CoordiApp&&coordiState.loading!==true&&!coordiState.pendingRender&&notLoading(nodeText("coordi-status"))&&byId("coordi-periodo").options.length>1;
      }
      if(state.moduloId==="baselocal"){return /BDLocal lista/i.test(nodeText("bl2-db-pill"))&&notLoading(nodeText("bl2-view-status"));}
      if(state.moduloId==="global"){var globalState=byId("globalSectionState");return !!boundChild.GlobalApp&&globalState&&/success|ready/.test(text(globalState.getAttribute("data-state")))&&notLoading(globalState.textContent)&&!!byId("globalSectionBody").children.length;}
      if(state.moduloId==="modulo_reporte"){return !!boundChild.RepoApp&&notLoading(nodeText("repo-status"))&&!!text(byId("repo-preview")&&byId("repo-preview").value);}
      if(state.moduloId==="defart"){var defState=boundChild.DefartApp&&boundChild.DefartApp.getState?boundChild.DefartApp.getState():{};return defState.booted===true&&defState.rendering!==true&&defState.renderQueued!==true&&notLoading(nodeText("def-visible-count"));}
      if(state.moduloId==="ncomplex"){var nc=boundChild.NcomplexState&&boundChild.NcomplexState.get?boundChild.NcomplexState.get():{};return nc.ready===true&&nc.loading!==true&&nc.saving!==true&&notLoading(nodeText("ncomplex-status"));}
      if(state.moduloId==="cr_def"){var cr=boundChild.CR_DEF_APP&&boundChild.CR_DEF_APP.state||{};return !!boundChild.CR_DEF_APP&&cr.loading!==true&&notLoading(text(doc.querySelector("[data-cr-periodo-help]")&&doc.querySelector("[data-cr-periodo-help]").textContent));}
      if(state.moduloId==="titulacion"){var ip=boundChild.InPVCApp&&boundChild.InPVCApp.state||{};return !!boundChild.InPVCApp&&Array.isArray(ip.periods)&&notLoading(nodeText("inpvc-status"));}
    }catch(error){return false;}
    /* Respaldo para futuras pantallas: generic-dom-stable. */
    return false;
  }

  function verify(reason){if(!state.running){return false;}if(moduleReady()){markData(reason||"visible-state");return finishAfterPaint(reason||"visible-state");}return false;}
  function ensureProbe(){
    var cfg=READY_PROBES[state.moduloId];if(!cfg||!boundChild){return false;}
    try{
      if(boundChild[cfg.global]){return true;}
      var doc=boundChild.document;var href=text(boundChild.location&&boundChild.location.href||"");if(!doc||!href||href==="about:blank"){return false;}
      if(doc.querySelector('script[data-maq-ready-probe="'+state.moduloId+'"]')){return true;}
      var script=doc.createElement("script");script.src=new URL(cfg.path,href).href;script.async=false;script.defer=false;script.setAttribute("data-maq-ready-probe",state.moduloId);script.onload=function(){triggerReadyProbe();verify("probe-loaded");};
      (doc.head||doc.documentElement).appendChild(script);return true;
    }catch(error){return false;}
  }
  function triggerReadyProbe(){
    var api=probeApi();
    if(api&&typeof api.track==="function"){try{api.track("main-module-activated");}catch(error){}}
    return verify("probe-status");
  }

  function eventMatches(detail){detail=detail&&typeof detail==="object"?detail:{};var target=text(detail.targetModuleId||detail.moduleId||detail.moduloId||"");return !target||target===state.moduloId;}
  function attachChild(frame){
    if(!frame||!state.running){return false;}var child=null;try{child=frame.contentWindow||null;}catch(error){child=null;}if(!child){return false;}
    boundChild=child;
    childHandler=function(event){if(!state.running){return;}var detail=event&&event.detail&&typeof event.detail==="object"?event.detail:{};if(!eventMatches(detail)){return;}markData(event.type);if(event.type===READY_EVENT){finishAfterPaint(detail.source||READY_EVENT);return;}schedule(function(){verify(event.type);},40);schedule(function(){verify(event.type+"-settled");},280);};
    ALL_EVENTS.forEach(function(name){try{child.addEventListener(name,childHandler);}catch(error){}});
    ensureProbe();schedule(function(){triggerReadyProbe();},0);schedule(function(){verify("initial-check");},120);schedule(function(){verify("settled-check");},650);return true;
  }
  function attachFrame(frame){detach();if(!frame){return false;}boundFrame=frame;frameLoadHandler=function(){if(state.running&&text(frame.dataset&&frame.dataset.moduleId)===state.moduloId){attachChild(frame);}};frame.addEventListener("load",frameLoadHandler);attachChild(frame);return true;}

  function tick(){if(!state.running){return;}state.elapsedMs=Math.max(0,clock()-state.startedAt);render(format(state.elapsedMs),"running",state.dataArrivedAt?"Datos recibidos; esperando el pintado final.":"Esperando que la pantalla termine de cargar.");verify("periodic-check");}
  function start(payload,reason){
    payload=payload||{};var current=core();var moduleId=text(payload.moduloId||payload.id||current&&current.state&&current.state.moduloActivoId||"");if(!moduleId){return false;}
    clearTimers();detach();state.running=true;state.moduloId=moduleId;state.moduloNombre=text(payload.modulo&&payload.modulo.nombre||payload.moduloNombre||moduleId);state.startedAt=clock();state.startedEpochAt=Date.now();state.elapsedMs=0;state.dataArrivedAt=0;state.dataDurationMs=0;state.lastReason=text(reason||"module-activated");
    render("0 ms","running","Esperando "+state.moduloNombre+".");attachFrame(frameFor(moduleId));tickTimer=window.setInterval(tick,200);timeoutTimer=window.setTimeout(timeout,MAX_WAIT_MS);return true;
  }
  function onModuleChanged(payload){start(payload||{},"module-activated");}
  function onRefresh(){var current=core();var id=text(current&&current.state&&current.state.moduloActivoId||"");if(!id){return;}var module=current&&current.router&&current.router.buscarModulo?current.router.buscarModulo(id):null;schedule(function(){start({moduloId:id,modulo:module},"manual-refresh");},0);}
  function status(){return {version:VERSION,installed:state.installed,running:state.running,moduloId:state.moduloId,moduloNombre:state.moduloNombre,elapsedMs:Math.round(state.running?Math.max(0,clock()-state.startedAt):state.elapsedMs),dataDurationMs:Math.round(state.dataDurationMs||0),lastDurationMs:state.lastDurationMs,lastModuleId:state.lastModuleId,lastModuleName:state.lastModuleName,lastReason:state.lastReason,lastCompletedAt:state.lastCompletedAt,completions:state.completions,timeouts:state.timeouts};}
  function install(){if(state.installed){return status();}state.installed=true;var current=core();if(current&&current.bus&&current.bus.on){current.bus.on("modulo:cambiado",onModuleChanged);}var refresh=document.getElementById("maq-btn-refresh");if(refresh){refresh.addEventListener("click",onRefresh);}render("—","idle","Tiempo hasta que la pantalla queda visible.");return status();}

  window.MAQ_BDLOCAL_DELIVERY_TIMER={version:VERSION,install:install,start:start,finish:finish,status:status,triggerReadyProbe:triggerReadyProbe,explicitModules:EXPLICIT_READY_MODULES};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",install,{once:true});}else{install();}
})(window,document);

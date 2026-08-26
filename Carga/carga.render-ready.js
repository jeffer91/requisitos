/* =========================================================
Nombre completo: carga.render-ready.js
Ruta: /Carga/carga.render-ready.js
Función:
- Confirmar cuándo Carga ya está visible y utilizable por el usuario.
- Considerar lista la pantalla con sus controles básicos y períodos locales pintados, incluso si no existen períodos.
- No esperar Firebase, auditorías, sincronización ni la inicialización completa de BDLocal.
- Publicar el evento estándar de pantalla lista después de dos ciclos de pintado.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-visible-usable";
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
  function ui(){return window.CargaUI||null;}
  function uiStatus(){
    try{return ui()&&typeof ui().status==="function"?ui().status()||{}:{};}
    catch(error){return {};}
  }
  function visible(node){
    if(!node||node.hidden===true){return false;}
    try{
      var style=window.getComputedStyle?window.getComputedStyle(node):null;
      return !style||style.display!=="none"&&style.visibility!=="hidden";
    }catch(error){return true;}
  }

  function readiness(){
    var current=uiStatus();
    var shell=document.querySelector?document.querySelector(".carga-shell"):null;
    var period=el("cargaPeriodoSelect");
    var file=el("cargaArchivoInput");
    var create=el("cargaBtnPeriodoCrear");
    var clear=el("cargaBtnLimpiar");
    var fromMonth=el("cargaPeriodoDesdeMes");
    var toMonth=el("cargaPeriodoHastaMes");
    var fromYear=el("cargaPeriodoDesdeAnio");
    var toYear=el("cargaPeriodoHastaAnio");
    var periodCount=el("cargaPeriodosCount");
    var expectedPeriods=Number(current.periodCount||0);
    var renderedPeriods=period&&period.options?Math.max(0,period.options.length-1):-1;

    if(!ui()||current.booted!==true){
      return {ready:false,stage:"ui"};
    }
    if(!visible(shell)||!period||!file||!create||!clear){
      return {ready:false,stage:"controls"};
    }
    if(create.disabled||file.disabled||clear.disabled||period.disabled){
      return {ready:false,stage:"usable"};
    }
    if(
      !fromMonth||!toMonth||
      !fromMonth.options||fromMonth.options.length!==12||
      !toMonth.options||toMonth.options.length!==12||
      !/^\d{4}$/.test(text(fromYear&&fromYear.value))||
      !/^\d{4}$/.test(text(toYear&&toYear.value))
    ){
      return {ready:false,stage:"period-form"};
    }
    if(renderedPeriods!==expectedPeriods){
      return {ready:false,stage:"periods"};
    }
    if(!periodCount||text(periodCount.textContent).indexOf(String(expectedPeriods))<0){
      return {ready:false,stage:"period-count"};
    }

    return {
      ready:true,
      stage:"complete",
      periodCount:expectedPeriods,
      selectedPeriodId:text(current.selectedPeriodId||period.value||""),
      busy:current.busy===true
    };
  }

  function signature(info){
    return [
      info.stage||"",
      Number(info.periodCount||0),
      info.selectedPeriodId||"",
      info.busy===true?"busy":"idle"
    ].join("|");
  }

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
        moduleId:"carga_excel",
        screen:"carga",
        reason:state.reason||"ui-rendered",
        periodCount:Number(info.periodCount||0),
        selectedPeriodId:text(info.selectedPeriodId),
        stage:info.stage||"complete",
        durationMs:state.lastDurationMs,
        at:new Date(state.lastReadyAt).toISOString(),
        source:"CargaRenderReady"
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
        if(confirmed.ready){
          window.setTimeout(function(){emitReady(confirmed,seq);},20);
        }
      });
    });
    return true;
  }

  function track(reason){
    stop();
    state.sequence+=1;
    var seq=state.sequence;
    state.tracking=true;
    state.reason=text(reason||"ui-rendered");
    state.startedAt=Date.now();

    if(window.MutationObserver&&document.body){
      observer=new MutationObserver(function(){check(seq);});
      observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
    }
    pollTimer=window.setInterval(function(){check(seq);},80);
    timeoutTimer=window.setTimeout(function(){
      if(state.tracking&&seq===state.sequence){
        state.tracking=false;
        stop();
      }
    },30000);
    check(seq);
    return seq;
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    [
      "carga:ui-rendered",
      "carga:periods-refreshed",
      "carga:periods-local-updated"
    ].forEach(function(name){
      window.addEventListener(name,function(){track(name);});
    });
    track("initial-ui");
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
      periodCount:Number(info.periodCount||0),
      selectedPeriodId:text(info.selectedPeriodId),
      lastReadyAt:state.lastReadyAt,
      lastDurationMs:state.lastDurationMs,
      lastSignature:state.lastSignature,
      emissions:state.emissions
    };
  }

  window.CargaRenderReady={
    version:VERSION,
    install:install,
    track:track,
    status:status
  };
  install();
})(window,document);

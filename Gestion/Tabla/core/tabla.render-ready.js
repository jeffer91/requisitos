/* =========================================================
Nombre completo: tabla.render-ready.js
Ruta: /Gestion/Tabla/core/tabla.render-ready.js
Función:
- Convertir el evento interno tabla:rendered en la confirmación estándar de pantalla lista.
- Esperar dos ciclos de pintado antes de confirmar el resultado visible.
- Verificar que la tabla y el resumen ya estén visibles.
- No consultar IndexedDB ni servicios externos.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.1-visible-ready";
  var READY_EVENT="maqueta:screen-render-complete";
  var state={installed:false,sequence:0,lastReadyAt:0,lastDurationMs:0,lastDetail:null,emissions:0};

  function text(value){return String(value==null?"":value).trim();}
  function statusText(){var node=document.getElementById("tabla-status");return text(node&&node.textContent);}
  function ready(detail){
    var current=window.TablaApp&&typeof window.TablaApp.getState==="function"?window.TablaApp.getState()||{}:{};
    var wrap=document.getElementById("tabla-table-wrap");
    var status=statusText();
    var visible=Number(detail&&detail.visible||0);
    var rows=wrap?wrap.querySelectorAll("tbody tr").length:0;
    var empty=wrap&&/sin datos/i.test(text(wrap.textContent));
    return !!window.TablaApp&&current.rendering!==true&&!/cargando|actualizando/i.test(status)&&!!wrap&&(empty||rows===visible);
  }

  function emit(detail,seq,started){
    if(seq!==state.sequence||!ready(detail)){return false;}
    state.lastReadyAt=Date.now();
    state.lastDurationMs=Math.max(0,state.lastReadyAt-started);
    state.lastDetail=detail||{};
    state.emissions+=1;
    try{
      window.dispatchEvent(new CustomEvent(READY_EVENT,{detail:{
        moduleId:"tabla_principal",
        screen:"tabla",
        reason:"tabla:rendered",
        total:Number(detail&&detail.total||0),
        visible:Number(detail&&detail.visible||0),
        durationMs:state.lastDurationMs,
        sourceDurationMs:Number(detail&&detail.duration||0),
        at:new Date(state.lastReadyAt).toISOString(),
        source:"TablaRenderReady"
      }}));
    }catch(error){}
    return true;
  }

  function onRendered(event){
    state.sequence+=1;
    var seq=state.sequence;
    var started=Date.now();
    var detail=event&&event.detail&&typeof event.detail==="object"?event.detail:{};
    var raf=window.requestAnimationFrame||function(fn){return window.setTimeout(fn,16);};
    raf(function(){raf(function(){window.setTimeout(function(){emit(detail,seq,started);},25);});});
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    window.addEventListener("tabla:rendered",onRendered);
    return status();
  }

  function status(){return {version:VERSION,installed:state.installed,sequence:state.sequence,lastReadyAt:state.lastReadyAt,lastDurationMs:state.lastDurationMs,lastDetail:state.lastDetail,emissions:state.emissions};}

  window.TablaRenderReady={version:VERSION,install:install,status:status};
  install();
})(window,document);

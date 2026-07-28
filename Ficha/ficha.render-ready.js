/* =========================================================
Nombre completo: ficha.render-ready.js
Ruta: /Ficha/ficha.render-ready.js
Función:
- Confirmar cuándo Ficha terminó de mostrar lista, detalle, requisitos, notas y modalidad.
- Publicar un evento solo después de que la interfaz quede pintada y utilizable.
- Evitar que el contador principal se detenga al recibir únicamente la señal de datos.
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
  function app(){return window.FichaApp||null;}
  function appState(){
    try{return app()&&typeof app().getState==="function"?app().getState()||{}:{};}
    catch(error){return {};}
  }
  function visible(node){
    if(!node){return false;}
    if(node.hidden===true||node.classList&&node.classList.contains("is-hidden")){return false;}
    try{
      var style=window.getComputedStyle?window.getComputedStyle(node):null;
      return !style||style.display!=="none"&&style.visibility!=="hidden";
    }catch(error){return true;}
  }
  function pendingText(value){return /cargando|esperando|preparando|conectando/i.test(text(value));}

  function readiness(){
    var current=appState();
    var rows=Array.isArray(current.rows)?current.rows:[];
    var status=el("ficha-status");
    var statusText=text(status&&status.textContent);
    var list=el("ficha-list");
    var count=el("ficha-count");
    var selectedId=text(current.selectedId);

    if(!app()||!statusText||statusText.indexOf("Ficha cargada por")<0){
      return {ready:false,stage:"app"};
    }
    if(!list||!count||Number(text(count.textContent)||0)!==rows.length){
      return {ready:false,stage:"list"};
    }
    if(!rows.length){
      return {ready:true,stage:"empty",rows:0,selectedId:""};
    }
    if(!selectedId){
      return {ready:true,stage:"list",rows:rows.length,selectedId:""};
    }

    var detail=el("ficha-detail");
    var name=el("ficha-nombre");
    var estado=el("ficha-estado");
    var req=el("ficha-requisitos");
    var notes=el("ficha-notas");
    var modalidad=el("ficha-modalidad-select");
    var modalidadInfo=el("ficha-modalidad-info");
    var reqStudent=text(req&&req.getAttribute&&req.getAttribute("data-ficha-student-id"));

    if(!visible(detail)||!text(name&&name.textContent)||pendingText(estado&&estado.textContent)){
      return {ready:false,stage:"detail"};
    }
    if(reqStudent&&reqStudent!==selectedId){
      return {ready:false,stage:"requirements-student"};
    }
    if(pendingText(req&&req.textContent)||pendingText(notes&&notes.textContent)){
      return {ready:false,stage:"requirements"};
    }
    if(modalidad&&(!modalidad.options||!modalidad.options.length||pendingText(modalidadInfo&&modalidadInfo.textContent))){
      return {ready:false,stage:"modality"};
    }

    return {
      ready:true,
      stage:"complete",
      rows:rows.length,
      selectedId:selectedId,
      name:text(name&&name.textContent),
      status:statusText
    };
  }

  function signature(info){
    return [info.stage,info.rows||0,info.selectedId||"",info.name||"",info.status||""].join("|");
  }

  function stopWatch(){
    if(observer){observer.disconnect();observer=null;}
    if(pollTimer){window.clearInterval(pollTimer);pollTimer=null;}
    if(timeoutTimer){window.clearTimeout(timeoutTimer);timeoutTimer=null;}
  }

  function emitReady(info,seq){
    if(!state.tracking||seq!==state.sequence){return false;}
    var sig=signature(info);
    state.tracking=false;
    state.lastReadyAt=Date.now();
    state.lastDurationMs=Math.max(0,state.lastReadyAt-state.startedAt);
    state.lastSignature=sig;
    state.emissions+=1;
    stopWatch();

    try{
      window.dispatchEvent(new CustomEvent(READY_EVENT,{detail:{
        moduleId:"ficha_estudiante",
        screen:"ficha",
        reason:state.reason||"render",
        rows:Number(info.rows||0),
        selectedId:text(info.selectedId),
        stage:info.stage||"complete",
        durationMs:state.lastDurationMs,
        at:new Date(state.lastReadyAt).toISOString(),
        source:"FichaRenderReady"
      }}));
    }catch(error){}
    return true;
  }

  function check(seq){
    if(!state.tracking||seq!==state.sequence){return false;}
    var info=readiness();
    if(!info.ready){return false;}
    var first=window.requestAnimationFrame||function(fn){return window.setTimeout(fn,16);};
    first(function(){
      first(function(){
        if(!state.tracking||seq!==state.sequence){return;}
        var confirmed=readiness();
        if(confirmed.ready){emitReady(confirmed,seq);}
      });
    });
    return true;
  }

  function track(reason){
    stopWatch();
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
    timeoutTimer=window.setTimeout(function(){
      if(state.tracking&&seq===state.sequence){
        state.tracking=false;
        stopWatch();
      }
    },30000);
    check(seq);
    return seq;
  }

  function wrapMethod(target,name){
    if(!target||typeof target[name]!=="function"||target[name].__fichaReadyWrapped){return;}
    var original=target[name];
    var wrapped=function(){
      var result=original.apply(this,arguments);
      track(name+":"+text(arguments[0]&&arguments[0].reason||arguments[0]||""));
      return result;
    };
    wrapped.__fichaReadyWrapped=true;
    wrapped.__original=original;
    target[name]=wrapped;
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    wrapMethod(app(),"render");
    wrapMethod(app(),"select");
    wrapMethod(app(),"refreshFromBDLocal");
    [
      "bdlocal:screen-data-updated",
      "bdlocal:pantallas:updated",
      "bdlocal:connections:updated",
      "ficha:bootstrap-ready"
    ].forEach(function(name){
      window.addEventListener(name,function(){track(name);});
    });
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

  window.FichaRenderReady={version:VERSION,install:install,track:track,status:status};
  install();
})(window,document);

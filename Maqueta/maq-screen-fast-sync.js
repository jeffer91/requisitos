/* =========================================================
Nombre completo: maq-screen-fast-sync.js
Ruta o ubicación: /Maqueta/maq-screen-fast-sync.js
Función o funciones:
- Mantener una sola copia compartida de Base Local en la ventana principal.
- Interceptar únicamente los mensajes internos de caché entre iframes conocidos.
- Evitar enviar y clonar la caché completa hacia pantallas ocultas.
- Invalidar y actualizar de inmediato solamente la pantalla visible.
- Entregar la última revisión al abrir una pantalla ya cargada o recién creada.
- No consultar IndexedDB, Firebase, Supabase ni Google Sheets.
Con qué se conecta:
- maq-baselocal-session.js.
- maq-core.js.
- BDLocalConUtils y las API públicas de cada pantalla dentro de su iframe.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-active-frame-only";
  var MESSAGE={
    publish:"requisitos:bdlocal-cache:publish",
    request:"requisitos:bdlocal-cache:request",
    response:"requisitos:bdlocal-cache:response"
  };
  var state={
    installed:false,
    messages:0,
    publishes:0,
    requests:0,
    activeUpdates:0,
    hiddenSkipped:0,
    fallbacks:0,
    failures:0,
    lastModuleId:"",
    lastRevision:0,
    lastDurationMs:0,
    lastError:"",
    updatedAt:""
  };
  var observedFrames=[];

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function session(){return window.MAQ_BASELOCAL_SESSION||null;}
  function core(){return window.MAQ_CORE||null;}
  function frames(){return Array.prototype.slice.call(document.querySelectorAll("iframe")||[]);}
  function moduleId(frame){return text(frame&&frame.dataset&&frame.dataset.moduleId||frame&&frame.getAttribute&&frame.getAttribute("data-module-id")||"");}
  function revisionOf(snapshot){return Number(snapshot&&snapshot.meta&&(snapshot.meta.revision||snapshot.meta.cacheRevision)||0);}

  function isKnownSource(source){
    if(!source){return false;}
    return frames().some(function(frame){return frame&&frame.contentWindow===source;});
  }

  function isVisible(frame){
    if(!frame||frame.hidden===true){return false;}
    if(frame.getAttribute&&frame.getAttribute("aria-hidden")==="true"){return false;}
    if(frame.classList&&frame.classList.contains("maq-frame-hidden")){return false;}
    var style=frame.style||{};
    return style.display!=="none"&&style.visibility!=="hidden";
  }

  function activeFrames(){return frames().filter(isVisible);}

  function sharedSnapshot(){
    var current=session();
    if(!current||typeof current.getSnapshot!=="function"){return null;}
    try{return current.getSnapshot({clone:false});}
    catch(error){return current.getSnapshot();}
  }

  function detail(snapshot,reason,frame){
    snapshot=snapshot||{};
    var meta=snapshot.meta||{};
    return {
      source:"maq-screen-fast-sync",
      sourceScreen:"maqueta",
      targetModuleId:moduleId(frame),
      reason:text(reason||"shared-cache-updated"),
      revision:revisionOf(snapshot),
      periodoId:text(meta.periodoId||meta.periodId||""),
      tablesRead:Array.isArray(meta.tablesRead)?meta.tablesRead.slice():[],
      tablesChanged:Array.isArray(meta.tablesChanged)?meta.tablesChanged.slice():[],
      operation:text(meta.operation||"refresh"),
      updatedAt:text(meta.updatedAt||now()),
      fastPath:true
    };
  }

  function dispatchChild(child,name,payload){
    try{
      var EventCtor=child.CustomEvent||window.CustomEvent;
      child.dispatchEvent(new EventCtor(name,{detail:payload||{}}));
      return true;
    }catch(error){return false;}
  }

  function invalidateChild(child){
    try{
      if(child.BDLocalConUtils&&typeof child.BDLocalConUtils.invalidateCache==="function"){
        child.BDLocalConUtils.invalidateCache({dropData:false});
      }
      if(child.BDLocalScreenDeps&&typeof child.BDLocalScreenDeps.invalidate==="function"){
        child.BDLocalScreenDeps.invalidate({reason:"instant-screen-sync"});
      }
      if(child.TablaDataSource&&typeof child.TablaDataSource.invalidate==="function"){
        child.TablaDataSource.invalidate({hard:true,force:true});
      }
      if(child.FichaCore&&typeof child.FichaCore.invalidate==="function"){
        child.FichaCore.invalidate();
      }
      if(child.StatsCore&&typeof child.StatsCore.invalidate==="function"){
        child.StatsCore.invalidate({reason:"instant-screen-sync"});
      }
      if(child.DefartServiceBridge&&typeof child.DefartServiceBridge.clear==="function"){
        child.DefartServiceBridge.clear({resetPage:false});
      }
    }catch(error){}
  }

  function refreshKnownScreen(child,payload){
    var handled=false;
    try{
      if(child.TablaEvents&&typeof child.TablaEvents.dataUpdated==="function"){
        child.TablaEvents.dataUpdated(payload);
        handled=true;
      }else if(child.TablaApp&&typeof child.TablaApp.request==="function"){
        child.TablaApp.request(false,0);
        handled=true;
      }

      if(child.FichaApp&&typeof child.FichaApp.render==="function"){
        child.FichaApp.render("bdlocal-refresh");
        handled=true;
      }
      if(child.StatsApp&&typeof child.StatsApp.render==="function"){
        child.StatsApp.render({force:false,reason:"instant-screen-sync"});
        handled=true;
      }
      if(child.CoordiApp&&typeof child.CoordiApp.render==="function"){
        child.CoordiApp.render({refresh:false,reason:"instant-screen-sync"});
        handled=true;
      }
      if(child.RepoApp&&typeof child.RepoApp.render==="function"){
        child.RepoApp.render();
        handled=true;
      }
      if(child.DefartApp&&typeof child.DefartApp.render==="function"){
        child.DefartApp.render();
        handled=true;
      }
      if(child.GlobalApp&&typeof child.GlobalApp.render==="function"){
        child.GlobalApp.render({reason:"instant-screen-sync"});
        handled=true;
      }
      if(child.NcomplexApp&&typeof child.NcomplexApp.render==="function"){
        child.NcomplexApp.render({reason:"instant-screen-sync"});
        handled=true;
      }
      if(child.InPVCApp&&typeof child.InPVCApp.render==="function"){
        child.InPVCApp.render({reason:"instant-screen-sync"});
        handled=true;
      }
    }catch(error){
      state.failures+=1;
      state.lastError=error&&error.message?error.message:String(error);
    }
    return handled;
  }

  function postFallback(frame,snapshot,reason){
    try{
      if(frame&&frame.contentWindow&&typeof frame.contentWindow.postMessage==="function"){
        frame.contentWindow.postMessage({
          type:"requisitos:bdlocal-cache:updated",
          reason:text(reason||"active-frame-fallback"),
          cache:snapshot,
          allowEmpty:false,
          revision:revisionOf(snapshot),
          at:now()
        },"*");
        state.fallbacks+=1;
        return true;
      }
    }catch(error){
      state.failures+=1;
      state.lastError=error&&error.message?error.message:String(error);
    }
    return false;
  }

  function syncFrame(frame,reason){
    var started=Date.now();
    if(!frame||!isVisible(frame)){state.hiddenSkipped+=1;return false;}
    var snapshot=sharedSnapshot();
    if(!snapshot){return false;}
    var child=null;
    try{child=frame.contentWindow||null;}catch(error){child=null;}
    if(!child){return false;}
    var payload=detail(snapshot,reason,frame);

    try{
      if(child.BDLocalConUtils||child.TablaApp||child.FichaApp||child.StatsApp||child.CoordiApp||child.RepoApp||child.DefartApp){
        invalidateChild(child);
        dispatchChild(child,"bdlocal:screen-data-updated",payload);
        dispatchChild(child,"bdlocal:pantallas:updated",payload);
        var run=function(){refreshKnownScreen(child,payload);};
        if(typeof child.requestAnimationFrame==="function"){child.requestAnimationFrame(run);}else{child.setTimeout(run,0);}
      }else{
        postFallback(frame,snapshot,reason);
      }
      state.activeUpdates+=1;
      state.lastModuleId=moduleId(frame);
      state.lastRevision=payload.revision;
      state.lastDurationMs=Date.now()-started;
      state.lastError="";
      state.updatedAt=now();
      return true;
    }catch(error2){
      state.failures+=1;
      state.lastError=error2&&error2.message?error2.message:String(error2);
      return postFallback(frame,snapshot,reason);
    }
  }

  function syncVisible(reason,exceptSource){
    var visible=activeFrames();
    frames().forEach(function(frame){if(!isVisible(frame)){state.hiddenSkipped+=1;}});
    visible.forEach(function(frame){
      if(!exceptSource||frame.contentWindow!==exceptSource){syncFrame(frame,reason);}
    });
  }

  function setSharedSnapshot(data){
    var current=session();
    if(!current||typeof current.setSnapshot!=="function"){return null;}
    return current.setSnapshot(data.cache||data.snapshot||{}, {
      source:text(data.source||"iframe-fast-publish"),
      allowEmpty:data.allowEmpty===true,
      alreadyStored:true,
      clone:false
    });
  }

  function sendResponse(source,data){
    var current=session();
    if(!current||typeof current.ensureReady!=="function"||typeof current.getSnapshot!=="function"){return false;}
    current.ensureReady();
    try{
      source.postMessage({
        type:MESSAGE.response,
        requestId:text(data.requestId),
        cache:current.getSnapshot(),
        status:typeof current.getStatus==="function"?current.getStatus():{},
        allowEmpty:false,
        at:now()
      },"*");
      return true;
    }catch(error){
      state.failures+=1;
      state.lastError=error&&error.message?error.message:String(error);
      return false;
    }
  }

  function intercept(event){
    var data=event&&event.data;
    if(!data||typeof data!=="object"||!isKnownSource(event.source)){return;}
    if(data.type!==MESSAGE.publish&&data.type!==MESSAGE.request){return;}

    state.messages+=1;
    if(event.stopImmediatePropagation){event.stopImmediatePropagation();}
    if(event.preventDefault){event.preventDefault();}

    if(data.type===MESSAGE.publish){
      state.publishes+=1;
      setSharedSnapshot(data);
      syncVisible(data.source||"iframe-fast-publish",event.source);
      return;
    }

    state.requests+=1;
    sendResponse(event.source,data);
  }

  function frameForModule(id){
    id=text(id);
    return frames().filter(function(frame){return moduleId(frame)===id;})[0]||null;
  }

  function onModuleChanged(payload){
    payload=payload||{};
    var id=text(payload.moduloId||payload.id||"");
    var frame=frameForModule(id);
    if(frame){
      window.setTimeout(function(){syncFrame(frame,"module-activated");},0);
    }
  }

  function observeFrame(frame){
    if(!frame||observedFrames.indexOf(frame)>=0){return;}
    observedFrames.push(frame);
    frame.addEventListener("load",function(){
      if(isVisible(frame)){window.setTimeout(function(){syncFrame(frame,"frame-loaded");},0);}
    });
  }

  function observeFrames(){
    frames().forEach(observeFrame);
    var host=document.getElementById("maq-main-frame-host")||document.body;
    if(window.MutationObserver&&host){
      var observer=new MutationObserver(function(){frames().forEach(observeFrame);});
      observer.observe(host,{childList:true,subtree:true});
    }
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    window.addEventListener("message",intercept,true);
    observeFrames();
    var current=core();
    if(current&&current.bus&&typeof current.bus.on==="function"){
      current.bus.on("modulo:cambiado",onModuleChanged);
    }
    state.updatedAt=now();
    return status();
  }

  function status(){
    return Object.assign({version:VERSION,activeFrames:activeFrames().length,totalFrames:frames().length},state);
  }

  window.MAQ_SCREEN_FAST_SYNC={
    version:VERSION,
    install:install,
    syncFrame:syncFrame,
    syncVisible:syncVisible,
    status:status
  };

  install();
})(window,document);

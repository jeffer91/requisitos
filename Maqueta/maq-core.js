/* =========================================================
Nombre completo: maq-core.js
Ruta: /Maqueta/maq-core.js
Función:
- Cargar las pantallas internas por iframe.
- Conservar únicamente la pantalla activa y las dos más recientes.
- Evitar que doce aplicaciones completas permanezcan ejecutándose al mismo tiempo.
- Inyectar y reaplicar el período global en todas las pantallas operativas.
- Adoptar el período almacenado aunque una pantalla se haya iniciado antes de seleccionarlo.
- Mantener navegación, refresco, eventos y compatibilidad con el menú principal.
========================================================= */
(function(window,document){
  "use strict";

  var U=window.MAQ_UTILS||{};
  var MAX_FRAMES=3;
  var PRELOAD_FLAG_KEY="REQ_MAQ_PRELOAD_ENABLED_V1";
  var PERIOD_GLOBAL_STORAGE_KEY="REQ_PERIODO_GLOBAL_V1";
  var PERIOD_GLOBAL_SCRIPT_URL=(function(){try{return new URL("../BDLocal/shared/bdl.periodo-global.js",window.location.href).href;}catch(error){return "../BDLocal/shared/bdl.periodo-global.js";}})();
  var PRELOAD_ORDER=["baselocal","tabla_principal","ficha_estudiante"];
  var state={moduloActivoId:null,moduloAnteriorId:null,moduloInicialId:"carga_excel",baseLocalReady:false,preloadStarted:false,preloadFinished:false,preloadEnabled:false,maxFrames:MAX_FRAMES};
  var pool=Object.create(null);
  var listeners=Object.create(null);
  var usageSerial=0;

  var BL_MODULES={baselocal:true,tabla_principal:true,ficha_estudiante:true,stat_main:true,coordi:true,global:true,modulo_reporte:true,defart:true,ncomplex:true,cr_def:true,titulacion:true};
  var FALLBACK_MODULES={
    carga_excel:{id:"carga_excel",nombre:"Carga",ruta:"../Carga/carga.html",estado:"activo"},
    baselocal:{id:"baselocal",nombre:"Centro de datos",ruta:"../BDLocal/bl2.html",estado:"activo"},
    tabla_principal:{id:"tabla_principal",nombre:"Tabla",ruta:"../Gestion/Tabla/tabla.html",estado:"activo"},
    ficha_estudiante:{id:"ficha_estudiante",nombre:"Ficha",ruta:"../Ficha/ficha.html",estado:"activo"},
    stat_main:{id:"stat_main",nombre:"Estadísticas",ruta:"../Stats/stats.html",estado:"activo"},
    coordi:{id:"coordi",nombre:"Coordi",ruta:"../Coordi/coordi.html",estado:"activo"},
    global:{id:"global",nombre:"Global",ruta:"../Global/global.html",estado:"activo"},
    modulo_reporte:{id:"modulo_reporte",nombre:"Reportes",ruta:"../Reportes/repo.html",estado:"activo"},
    defart:{id:"defart",nombre:"Defensas",ruta:"../defart/defart.html",estado:"activo"},
    ncomplex:{id:"ncomplex",nombre:"Ncomplex",ruta:"../Ncomplex/ncomplex.html",estado:"activo"},
    cr_def:{id:"cr_def",nombre:"Cr-def",ruta:"../Cr-def/cr-def.html",estado:"activo"},
    titulacion:{id:"titulacion",nombre:"InPVC",ruta:"../InPVC/inpvc.html",estado:"activo"}
  };
  var MODULE_ALIASES={
    requisito:"carga_excel",requisitos:"carga_excel",carga:"carga_excel","carga excel":"carga_excel",excel:"carga_excel",
    "base local":"baselocal","base-local":"baselocal",bl:"baselocal",bdlocal:"baselocal","centro de datos":"baselocal",
    tabla:"tabla_principal","tabla principal":"tabla_principal",ficha:"ficha_estudiante","ficha estudiante":"ficha_estudiante",
    stats:"stat_main",estadisticas:"stat_main",estadísticas:"stat_main","stat main":"stat_main",coordinador:"coordi",coordi:"coordi",
    global:"global",globals:"global",reporte:"modulo_reporte",reportes:"modulo_reporte",repor:"modulo_reporte",
    defensas:"defart",defensa:"defart",defart:"defart",ncomplex:"ncomplex",complexivo:"ncomplex",
    "cr-def":"cr_def","cr def":"cr_def",crdef:"cr_def",infor:"titulacion",inpvc:"titulacion",titulacion:"titulacion",titulación:"titulacion"
  };

  function clean(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function norm(value){return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
  function cloneModule(module){return module?{id:module.id,nombre:module.nombre,ruta:module.ruta,estado:module.estado}:null;}
  function canonicalPeriodId(value){value=clean(value);var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");}
  function canonicalModuleId(moduleId){var raw=clean(moduleId);if(!raw){return "";}if(FALLBACK_MODULES[raw]){return raw;}return MODULE_ALIASES[norm(raw).replace(/[_-]+/g," ")]||raw;}
  function registry(){return window.MAQ_MODULOS_REGISTRY||{};}
  function findModule(moduleId){
    var canonical=canonicalModuleId(moduleId);var found=null;var current=registry();
    try{if(current&&typeof current.buscarPorId==="function"){found=current.buscarPorId(canonical);}}catch(error){console.warn("[MAQ_CORE] Registro principal no disponible",error);}
    return found||cloneModule(FALLBACK_MODULES[canonical]);
  }
  function on(event,handler){if(!listeners[event]){listeners[event]=[];}listeners[event].push(handler);return function(){listeners[event]=(listeners[event]||[]).filter(function(item){return item!==handler;});};}
  function emit(event,payload){(listeners[event]||[]).slice().forEach(function(handler){try{handler(payload);}catch(error){console.error("[MAQ_CORE] Error",event,error);}});}
  function host(){return document.getElementById("maq-main-frame-host");}
  function label(value){var node=document.getElementById("maq-current-module-label");if(node){node.textContent=value||"Sin módulo";}}
  function status(value){if(U.status){U.status(value);}}
  function memory(value){if(U.memory){U.memory(value);}}
  function touch(item){if(item){item.lastUsed=++usageSerial;}}

  function sharedSnapshot(){
    var session=window.MAQ_BASELOCAL_SESSION;
    if(!session||typeof session.getSnapshot!=="function"){return null;}
    try{return session.getSnapshot({clone:false});}catch(error){try{return session.getSnapshot();}catch(inner){return null;}}
  }
  function seedGlobalPeriod(){
    try{
      if(window.localStorage.getItem(PERIOD_GLOBAL_STORAGE_KEY)){return null;}
      var snapshot=sharedSnapshot();var meta=snapshot&&snapshot.meta||{};
      var id=canonicalPeriodId(meta.periodoId||meta.periodId||meta.activePeriodId||"");
      if(!id){return null;}
      var label=clean(meta.periodoLabel||meta.periodLabel||meta.activePeriodLabel||id);
      var period={id:id,periodoId:id,value:id,label:label,periodoLabel:label,source:"maq-baselocal-session",updatedAt:new Date().toISOString(),version:"main-seed"};
      window.localStorage.setItem(PERIOD_GLOBAL_STORAGE_KEY,JSON.stringify(period));
      return period;
    }catch(error){return null;}
  }
  function readGlobalPeriod(){
    try{
      var raw=window.localStorage.getItem(PERIOD_GLOBAL_STORAGE_KEY);
      if(!raw){return seedGlobalPeriod();}
      var parsed=JSON.parse(raw)||{};
      var id=canonicalPeriodId(parsed.id||parsed.periodoId||parsed.periodId||parsed.value||"");
      if(!id){return null;}
      var label=clean(parsed.label||parsed.periodoLabel||parsed.nombre||id);
      return Object.assign({},parsed,{id:id,periodoId:id,value:id,label:label,periodoLabel:label});
    }catch(error){return null;}
  }
  function activatePeriodRuntime(child){
    try{
      var api=child&&(child.BDLPeriodoGlobal||child.RequisitosPeriodoGlobal);
      if(!api){return false;}
      if(typeof api.init==="function"){api.init();}
      var globalScreen=typeof api.isGlobalScreen==="function"&&api.isGlobalScreen();
      var stored=readGlobalPeriod();
      if(stored&&!globalScreen&&typeof api.set==="function"){
        api.set(stored,stored.label,{source:"maq-core",persist:false,broadcast:false,emit:false,core:true,apply:true,dispatch:true,force:true});
      }
      if(typeof api.scan==="function"){api.scan();}
      if(typeof api.apply==="function"){api.apply({dispatch:true});}
      return true;
    }catch(error){return false;}
  }
  function injectPeriodGlobal(frame){
    if(!frame){return false;}
    seedGlobalPeriod();
    var child=null,doc=null;
    try{child=frame.contentWindow||null;doc=child&&child.document||null;}catch(error){return false;}
    if(!child||!doc){return false;}
    if(activatePeriodRuntime(child)){return true;}
    try{
      var existing=doc.querySelector('script[data-maq-periodo-global="true"]')||Array.prototype.slice.call(doc.scripts||[]).find(function(script){return script.src===PERIOD_GLOBAL_SCRIPT_URL;});
      if(existing){return true;}
      var script=doc.createElement("script");script.src=PERIOD_GLOBAL_SCRIPT_URL;script.async=false;script.defer=false;script.setAttribute("data-maq-periodo-global","true");
      script.onload=function(){activatePeriodRuntime(child);};
      (doc.head||doc.documentElement).appendChild(script);
      return true;
    }catch(error2){return false;}
  }
  function syncPeriodGlobal(frame){
    if(!frame){return false;}
    if(injectPeriodGlobal(frame)){window.setTimeout(function(){try{activatePeriodRuntime(frame.contentWindow);}catch(error){}},40);return true;}
    return false;
  }

  function setFrameVisible(item,visible){
    if(!item||!item.iframe){return;}var frame=item.iframe;
    if(visible){frame.hidden=false;frame.classList.remove("maq-frame-hidden");frame.style.display="block";frame.style.visibility="visible";frame.style.pointerEvents="auto";frame.setAttribute("aria-hidden","false");touch(item);window.setTimeout(function(){syncPeriodGlobal(frame);},0);}
    else{frame.classList.add("maq-frame-hidden");frame.hidden=true;frame.style.display="none";frame.style.visibility="hidden";frame.style.pointerEvents="none";frame.setAttribute("aria-hidden","true");}
  }
  function hideAll(){Object.keys(pool).forEach(function(id){setFrameVisible(pool[id],false);});}
  function routeFor(module){if(!module){return "maq-pendiente.html";}if(module.estado&&module.estado!=="activo"){return U.buildPendingUrl?U.buildPendingUrl(module):"maq-pendiente.html";}return module.ruta;}
  function shouldPrepareBaseLocal(moduleId){return !!BL_MODULES[canonicalModuleId(moduleId)];}
  function ensureBaseLocalReady(){state.baseLocalReady=true;return true;}

  function removeFrame(id,reason){
    var item=pool[id];if(!item){return false;}
    try{if(item.iframe&&item.iframe.parentNode){item.iframe.src="about:blank";item.iframe.parentNode.removeChild(item.iframe);}}catch(error){}
    delete pool[id];emit("frame:evicted",{moduloId:id,reason:reason||"memory-limit",remaining:Object.keys(pool).length});return true;
  }
  function enforceFrameLimit(){
    var ids=Object.keys(pool);while(ids.length>MAX_FRAMES){
      var candidates=ids.filter(function(id){return id!==state.moduloActivoId&&id!==state.moduloAnteriorId;}).map(function(id){return {id:id,lastUsed:Number(pool[id]&&pool[id].lastUsed||0)};}).sort(function(a,b){return a.lastUsed-b.lastUsed;});
      if(!candidates.length){candidates=ids.filter(function(id){return id!==state.moduloActivoId;}).map(function(id){return {id:id,lastUsed:Number(pool[id]&&pool[id].lastUsed||0)};}).sort(function(a,b){return a.lastUsed-b.lastUsed;});}
      if(!candidates.length){break;}removeFrame(candidates[0].id,"memory-limit");ids=Object.keys(pool);
    }
    memory("En memoria: "+Object.keys(pool).length+" de "+MAX_FRAMES+" pantallas");
  }

  function makeFrame(module,options){
    options=options||{};if(shouldPrepareBaseLocal(module&&module.id)){ensureBaseLocalReady();}
    var container=host();if(!container){return null;}
    var frame=document.createElement("iframe");frame.className="maq-frame";frame.title="Módulo: "+(module.nombre||module.id||"Requisitos");frame.src=routeFor(module);frame.dataset.moduleId=module.id;
    if(options.preload===true){frame.dataset.preloaded="true";}
    frame.addEventListener("load",function(){
      var item=pool[module.id];if(item){item.loadedAt=Date.now();touch(item);}syncPeriodGlobal(frame);
      if(state.moduloActivoId===module.id){status("Pantalla activa: "+module.nombre);}emit("frame:loaded",{moduloId:module.id,modulo:module,preloaded:options.preload===true});
    });
    frame.addEventListener("error",function(){status("No se pudo cargar: "+(module.nombre||module.id));emit("frame:error",{moduloId:module.id,modulo:module});});
    container.appendChild(frame);return frame;
  }
  function ensureFrame(moduleId,options){
    var canonical=canonicalModuleId(moduleId);var module=findModule(canonical);if(!module){return null;}
    var item=pool[canonical];
    if(item&&(!item.iframe||!item.iframe.isConnected)){delete pool[canonical];item=null;}
    if(!item){item=pool[canonical]={iframe:makeFrame(module,options||{}),rutaBase:routeFor(module),nombre:module.nombre,estado:module.estado,preloaded:!!(options&&options.preload),lastUsed:++usageSerial,loadedAt:0};}
    touch(item);return item;
  }

  function preloadAllowed(){try{return window.localStorage.getItem(PRELOAD_FLAG_KEY)==="true";}catch(error){return false;}}
  function schedulePreload(){
    if(state.preloadStarted||state.preloadFinished){return;}state.preloadEnabled=preloadAllowed();
    if(!state.preloadEnabled){state.preloadFinished=true;memory("Caché de pantallas limitada · modo rápido activo");return;}
    state.preloadStarted=true;window.setTimeout(function(){
      for(var i=0;i<PRELOAD_ORDER.length&&Object.keys(pool).length<MAX_FRAMES;i+=1){var id=canonicalModuleId(PRELOAD_ORDER[i]);if(id&&id!==state.moduloActivoId&&!pool[id]&&findModule(id)){var item=ensureFrame(id,{preload:true});setFrameVisible(item,false);}}
      state.preloadFinished=true;enforceFrameLimit();emit("preload:finished",{total:Object.keys(pool).length});
    },1200);
  }

  function saveNav(current,previous){
    if(!U.save||!U.NAV_KEYS){return;}U.save(U.NAV_KEYS.ultimoModuloId,current||null);U.save(U.NAV_KEYS.anteriorModuloId,previous||null);
    if(U.saveNavState){U.saveNavState({ultimoModuloId:current||null,anteriorModuloId:previous||null});}
  }
  function navigate(moduleId){
    var canonical=canonicalModuleId(moduleId);var module=findModule(canonical);
    if(!module){console.error("[MAQ_CORE] Módulo no registrado:",moduleId);status("Módulo no registrado: "+moduleId);return false;}
    if(shouldPrepareBaseLocal(canonical)){ensureBaseLocalReady();}
    var item=ensureFrame(canonical,{preload:false});if(!item||!item.iframe){status("No se pudo abrir: "+(module.nombre||canonical));return false;}
    if(state.moduloActivoId===canonical){hideAll();setFrameVisible(item,true);label(module.nombre);syncPeriodGlobal(item.iframe);emit("modulo:reabierto",{moduloId:canonical,modulo:module});enforceFrameLimit();return true;}
    state.moduloAnteriorId=state.moduloActivoId;state.moduloActivoId=canonical;saveNav(state.moduloActivoId,state.moduloAnteriorId);
    hideAll();setFrameVisible(item,true);label(module.nombre);syncPeriodGlobal(item.iframe);enforceFrameLimit();
    emit("modulo:cambiado",{moduloId:canonical,modulo:module,anteriorModuloId:state.moduloAnteriorId});schedulePreload();return true;
  }
  function previous(){if(state.moduloAnteriorId){var previousId=state.moduloAnteriorId;state.moduloAnteriorId=state.moduloActivoId;return navigate(previousId);}return navigate(state.moduloInicialId);}
  function refresh(){var id=state.moduloActivoId;var item=id?pool[id]:null;if(!item||!item.iframe){return false;}var separator=item.rutaBase.indexOf("?")>=0?"&":"?";item.iframe.src=item.rutaBase+separator+"_refresh="+Date.now();touch(item);emit("modulo:refrescado",{moduloId:id});return true;}
  function poolStatus(){return Object.keys(pool).map(function(id){var item=pool[id];return {id:id,nombre:item.nombre,active:id===state.moduloActivoId,previous:id===state.moduloAnteriorId,lastUsed:item.lastUsed,loadedAt:item.loadedAt,connected:!!(item.iframe&&item.iframe.isConnected)};});}
  function boot(){seedGlobalPeriod();var refreshButton=document.getElementById("maq-btn-refresh");if(refreshButton){refreshButton.addEventListener("click",refresh);}var previousButton=document.getElementById("maq-btn-prev");if(previousButton){previousButton.addEventListener("click",previous);}status("Modo rápido activo.");}

  window.MAQ_CORE={
    state:state,
    bus:{on:on,emit:emit},
    router:{navegarPorModuloId:navigate,pantallaAnterior:previous,canonicalModuleId:canonicalModuleId,buscarModulo:findModule},
    actions:{refrescarModuloActivo:refresh,ensureBaseLocalReady:ensureBaseLocalReady,schedulePreload:schedulePreload,evictFrame:removeFrame,enforceFrameLimit:enforceFrameLimit,syncPeriodGlobal:syncPeriodGlobal},
    performance:{preloadFlagKey:PRELOAD_FLAG_KEY,preloadAllowed:preloadAllowed,shouldPrepareBaseLocal:shouldPrepareBaseLocal,maxFrames:MAX_FRAMES,poolStatus:poolStatus},
    period:{storageKey:PERIOD_GLOBAL_STORAGE_KEY,scriptUrl:PERIOD_GLOBAL_SCRIPT_URL,seed:seedGlobalPeriod,read:readGlobalPeriod,syncFrame:syncPeriodGlobal}
  };
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
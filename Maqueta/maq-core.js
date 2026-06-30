/* =========================================================
Nombre completo: maq-core.js
Ruta o ubicación: /Requisitos/Maqueta/maq-core.js
Función o funciones:
- Cargar pantallas internas por iframe.
- Abrir Carga por defecto.
- Mantener caché de iframes.
- Mantener BL como pantalla activa independiente para control de BDLocal y Firebase.
Con qué se conecta:
- maq-modulos-registry.js
- maq-utils.js
- maq-menu.js
========================================================= */
(function(window,document){
  "use strict";
  var U=window.MAQ_UTILS||{};
  var state={moduloActivoId:null,moduloAnteriorId:null,moduloInicialId:"carga_excel",baseLocalReady:false,preloadStarted:false,preloadFinished:false,preloadEnabled:false};
  var pool=Object.create(null);var listeners=Object.create(null);
  var PRELOAD_ORDER=["baselocal","tabla_principal","ficha_estudiante","stat_main","coordi","modulo_reporte","defart","titulacion"];
  var PRELOAD_DELAY_MS=2500;
  var PRELOAD_STEP_MS=1200;
  var PRELOAD_FLAG_KEY="REQ_MAQ_PRELOAD_ENABLED_V1";
  var BL_MODULES={baselocal:true,tabla_principal:true,ficha_estudiante:true,stat_main:true,coordi:true,modulo_reporte:true,defart:true};
  var FALLBACK_MODULES={
    carga_excel:{id:"carga_excel",nombre:"Carga",ruta:"../BDLocal/bdlocal.html",estado:"activo"},
    baselocal:{id:"baselocal",nombre:"BL",ruta:"../BDLocal/bl.html",estado:"activo"},
    tabla_principal:{id:"tabla_principal",nombre:"Tabla",ruta:"../Gestion/Tabla/tabla.html",estado:"activo"},
    ficha_estudiante:{id:"ficha_estudiante",nombre:"Ficha",ruta:"../Ficha/ficha.html",estado:"activo"},
    stat_main:{id:"stat_main",nombre:"Estadísticas",ruta:"../Stats/stats.html",estado:"activo"},
    coordi:{id:"coordi",nombre:"Coordi",ruta:"../Coordi/coordi.html",estado:"activo"},
    modulo_reporte:{id:"modulo_reporte",nombre:"Reportes",ruta:"../Reportes/repo.html",estado:"activo"},
    defart:{id:"defart",nombre:"Defensas",ruta:"../defart/defart.html",estado:"activo"},
    titulos_estudiante:{id:"titulos_estudiante",nombre:"Títulos - Estudiante",ruta:"../Titulos/public/ta-titulo-articulo-estudiante.html",estado:"activo"},
    titulos_admin:{id:"titulos_admin",nombre:"Títulos - Administrador",ruta:"../Titulos/electron/admin/ta-titulo-articulo-administrador.html",estado:"activo"},
    titulos_coordinador:{id:"titulos_coordinador",nombre:"Títulos - Coordinador",ruta:"../Titulos/public/ta-titulo-articulo-coordinador.html",estado:"activo"},
    titulacion:{id:"titulacion",nombre:"Infor",ruta:"../Infor/frontend/titulacion.html",estado:"activo"}
  };
  var MODULE_ALIASES={"requisito":"carga_excel","requisitos":"carga_excel","carga":"carga_excel","carga excel":"carga_excel","excel":"carga_excel","base local":"baselocal","base-local":"baselocal","bl":"baselocal","tabla":"tabla_principal","tabla principal":"tabla_principal","ficha":"ficha_estudiante","ficha estudiante":"ficha_estudiante","stats":"stat_main","estadisticas":"stat_main","estadísticas":"stat_main","stat main":"stat_main","coordinador":"coordi","coordi":"coordi","reporte":"modulo_reporte","reportes":"modulo_reporte","repor":"modulo_reporte","defensas":"defart","defensa":"defart","defart":"defart","titulos estudiante":"titulos_estudiante","títulos estudiante":"titulos_estudiante","titulos administrador":"titulos_admin","títulos administrador":"titulos_admin","titulos admin":"titulos_admin","títulos admin":"titulos_admin","titulos coordinador":"titulos_coordinador","títulos coordinador":"titulos_coordinador","infor":"titulacion","titulacion":"titulacion","titulación":"titulacion"};
  function clean(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function norm(value){return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
  function cloneModule(modulo){return modulo?{id:modulo.id,nombre:modulo.nombre,ruta:modulo.ruta,estado:modulo.estado}:null;}
  function canonicalModuleId(moduloId){var raw=clean(moduloId);if(!raw)return "";if(FALLBACK_MODULES[raw])return raw;var key=norm(raw).replace(/[_-]+/g," ");return MODULE_ALIASES[key]||raw;}
  function getRegistry(){return window.MAQ_MODULOS_REGISTRY||{};}
  function buscarModulo(moduloId){var canonical=canonicalModuleId(moduloId);var registry=getRegistry();var encontrado=null;try{if(registry&&typeof registry.buscarPorId==="function"){encontrado=registry.buscarPorId(canonical);}}catch(error){console.warn("[MAQ_CORE] Registro principal no disponible",error);}return encontrado||cloneModule(FALLBACK_MODULES[canonical]);}
  function on(evt,fn){if(!listeners[evt])listeners[evt]=[];listeners[evt].push(fn);}function emit(evt,payload){(listeners[evt]||[]).forEach(function(fn){try{fn(payload);}catch(e){console.error("[MAQ_CORE] Error",evt,e);}});}function host(){return document.getElementById("maq-main-frame-host");}function label(text){var el=document.getElementById("maq-current-module-label");if(el)el.textContent=text||"Sin módulo";}function hideAll(){Object.keys(pool).forEach(function(id){if(pool[id]&&pool[id].iframe)pool[id].iframe.classList.add("maq-frame-hidden");});}function routeFor(modulo){if(!modulo)return "maq-pendiente.html";if(modulo.estado&&modulo.estado!=="activo")return U.buildPendingUrl?U.buildPendingUrl(modulo):"maq-pendiente.html";return modulo.ruta;}function shouldPrepareBaseLocal(moduloId){return !!BL_MODULES[canonicalModuleId(moduloId)];}function preloadAllowed(){try{return window.localStorage.getItem(PRELOAD_FLAG_KEY)==="true";}catch(error){return false;}}function ensureBaseLocalReady(options){options=options||{};state.baseLocalReady=true;return true;}
  function makeFrame(modulo, options){options=options||{};if(shouldPrepareBaseLocal(modulo&&modulo.id)){ensureBaseLocalReady();}var h=host();if(!h)return null;var iframe=document.createElement("iframe");iframe.className="maq-frame maq-frame-hidden";iframe.title="Módulo: "+(modulo.nombre||modulo.id||"Requisitos");iframe.src=routeFor(modulo);iframe.dataset.moduleId=modulo.id;if(options.preload===true){iframe.dataset.preloaded="true";}iframe.addEventListener("load",function(){if(state.moduloActivoId===modulo.id){if(U.status)U.status("Pantalla activa: "+modulo.nombre);}else if(options.preload===true){if(U.memory)U.memory("Precargada: "+modulo.nombre+" · "+Object.keys(pool).length+" pantalla(s)");}});iframe.addEventListener("error",function(){if(U.status)U.status("No se pudo cargar: "+(modulo.nombre||modulo.id));});h.appendChild(iframe);return iframe;}
  function ensureFrame(moduloId, options){var canonical=canonicalModuleId(moduloId);var modulo=buscarModulo(canonical);if(!modulo){return null;}if(!pool[canonical]){pool[canonical]={iframe:makeFrame(modulo,options||{}),rutaBase:routeFor(modulo),nombre:modulo.nombre,estado:modulo.estado,preloaded:!!(options&&options.preload)};}return pool[canonical];}
  function preloadNext(queue,index){if(index>=queue.length){state.preloadFinished=true;if(U.memory)U.memory("Pantallas listas en memoria: "+Object.keys(pool).length);emit("preload:finished",{total:Object.keys(pool).length});return;}var id=canonicalModuleId(queue[index]);if(id&&id!==state.moduloActivoId&&!pool[id]){var item=ensureFrame(id,{preload:true});if(item&&item.iframe){item.iframe.classList.add("maq-frame-hidden");}}setTimeout(function(){preloadNext(queue,index+1);},PRELOAD_STEP_MS);}function schedulePreload(){if(state.preloadStarted){return;}state.preloadEnabled=preloadAllowed();if(!state.preloadEnabled){state.preloadFinished=true;if(U.memory)U.memory("Precarga automática pausada · modo rápido activo");return;}state.preloadStarted=true;setTimeout(function(){try{var available=PRELOAD_ORDER.filter(function(id){return !!buscarModulo(id);});preloadNext(available,0);}catch(error){console.warn("[MAQ_CORE] Precarga detenida",error);}},PRELOAD_DELAY_MS);}function saveNav(current,previous){if(!U.save||!U.NAV_KEYS)return;U.save(U.NAV_KEYS.ultimoModuloId,current||null);U.save(U.NAV_KEYS.anteriorModuloId,previous||null);if(U.saveNavState)U.saveNavState({ultimoModuloId:current||null,anteriorModuloId:previous||null});}
  function navegarPorModuloId(moduloId){var canonical=canonicalModuleId(moduloId);var modulo=buscarModulo(canonical);if(!modulo){console.error("[MAQ_CORE] Módulo no registrado:",moduloId);if(U.status)U.status("Módulo no registrado: "+moduloId);return;}if(shouldPrepareBaseLocal(canonical)){ensureBaseLocalReady();}if(state.moduloActivoId===canonical){label(modulo.nombre);schedulePreload();return;}state.moduloAnteriorId=state.moduloActivoId;state.moduloActivoId=canonical;saveNav(state.moduloActivoId,state.moduloAnteriorId);ensureFrame(canonical,{preload:false});hideAll();if(pool[canonical]&&pool[canonical].iframe)pool[canonical].iframe.classList.remove("maq-frame-hidden");label(modulo.nombre);if(U.memory)U.memory("En memoria: "+Object.keys(pool).length+" pantalla(s)");emit("modulo:cambiado",{moduloId:canonical,modulo:modulo,anteriorModuloId:state.moduloAnteriorId});schedulePreload();}
  function pantallaAnterior(){if(state.moduloAnteriorId){var prev=state.moduloAnteriorId;state.moduloAnteriorId=state.moduloActivoId;navegarPorModuloId(prev);return;}navegarPorModuloId(state.moduloInicialId);}function refrescarModuloActivo(){var id=state.moduloActivoId;var item=id?pool[id]:null;if(!item||!item.iframe)return;var sep=item.rutaBase.indexOf("?")>=0?"&":"?";item.iframe.src=item.rutaBase+sep+"_refresh="+Date.now();}function boot(){var btn=document.getElementById("maq-btn-refresh");if(btn)btn.addEventListener("click",refrescarModuloActivo);var prev=document.getElementById("maq-btn-prev");if(prev)prev.addEventListener("click",pantallaAnterior);if(U.status)U.status("Modo rápido activo.");}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();window.MAQ_CORE={state:state,bus:{on:on,emit:emit},router:{navegarPorModuloId:navegarPorModuloId,pantallaAnterior:pantallaAnterior,canonicalModuleId:canonicalModuleId,buscarModulo:buscarModulo},actions:{refrescarModuloActivo:refrescarModuloActivo,ensureBaseLocalReady:ensureBaseLocalReady,schedulePreload:schedulePreload},performance:{preloadFlagKey:PRELOAD_FLAG_KEY,preloadAllowed:preloadAllowed,shouldPrepareBaseLocal:shouldPrepareBaseLocal}};
})(window,document);
/* =========================================================
Nombre completo: carga.index.js
Ruta o ubicación: /Carga/carga.index.js
Función:
- Preparar BDLocal y cargar el conector exclusivo ConCarga.
- Extender su API, instalar el puente de pantalla y consultar períodos.
- Cargar el popup de divisiones conectado sin consultar BL2Core desde /Carga/.
========================================================= */
(function(window,document){
  "use strict";

  var ADAPTER_PATH="../BDLocal/adapters/bdl.screen-deps.js";
  var CONNECTOR_PATH="../BDLocal/conexiones/cone.carga.js";
  var OPS_PATH="../BDLocal/conexiones/cone.carga.ops.js";
  var BRIDGE_PATH="./carga.connection-bridge.js";
  var POPUP_PATH="./carga.divisiones.popup.js";
  var LS_PERIODOS="carga.periodos.local";
  var LS_PERIODO="carga.periodoSeleccionado";

  function text(value){return String(value==null?"":value).trim();}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function resolve(relative){try{return new URL(relative,window.location.href).href;}catch(error){return relative;}}
  function loaded(src){return Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src||script.getAttribute("data-carga-index-src")===src;});}
  function loadScript(relative,test){
    var src=resolve(relative);
    if(typeof test==="function"&&test()){return Promise.resolve(test());}
    if(loaded(src)){
      return new Promise(function(resolvePromise,reject){
        var started=Date.now();
        (function wait(){
          var value=typeof test==="function"?test():true;
          if(value){resolvePromise(value);return;}
          if(Date.now()-started>15000){reject(new Error("No se preparó "+relative));return;}
          setTimeout(wait,40);
        })();
      });
    }
    return new Promise(function(resolvePromise,reject){
      var script=document.createElement("script");
      script.src=src;script.async=false;script.defer=false;script.setAttribute("data-carga-index-src",src);
      script.onload=function(){var value=typeof test==="function"?test():true;value?resolvePromise(value):reject(new Error(relative+" no expuso la API esperada."));};
      script.onerror=function(){reject(new Error("No se pudo cargar "+src));};
      document.head.appendChild(script);
    });
  }
  function connector(){return window.ConCarga||window.BDLocalCarga||null;}
  function ensureBDLocal(){
    if(window.BDLocalScreenDeps&&typeof window.BDLocalScreenDeps.ready==="function"){return window.BDLocalScreenDeps.ready();}
    if(window.BDLScreenDepsReady&&typeof window.BDLScreenDepsReady.then==="function"){return window.BDLScreenDepsReady;}
    return loadScript(ADAPTER_PATH,function(){return window.BDLocalScreenDeps;}).then(function(adapter){return adapter&&typeof adapter.ready==="function"?adapter.ready():adapter;});
  }
  function ensureConnector(){
    return ensureBDLocal()
      .then(function(){return connector()||loadScript(CONNECTOR_PATH,connector);})
      .then(function(){return loadScript(OPS_PATH,function(){var con=connector();return con&&typeof con.listStudents==="function"?con:null;});})
      .then(function(con){return Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(status){if(status&&status.ok===false){throw new Error(status.error||"ConCarga no está listo.");}return con;});});
  }
  function ensureBridge(){
    return loadScript(BRIDGE_PATH,function(){return window.CargaConnectionBridge;}).then(function(bridge){if(bridge&&typeof bridge.install==="function"){bridge.install();}return bridge;});
  }
  function ensurePopup(){return loadScript(POPUP_PATH,function(){return window.CargaDivisionesPopup;});}
  function normalizePeriod(period){
    period=period||{};
    var id=text(period.periodoCanonicoId||period.periodoId||period.id||period.value||"").replace(/_+/g,"__");
    if(!id){return null;}
    var label=text(period.periodoCanonicoLabel||period.periodoLabel||period.label||period.nombre||id);
    return Object.assign({},period,{id:id,periodoId:id,periodoCanonicoId:id,label:label,periodoLabel:label,periodoCanonicoLabel:label,carrerasDetectadas:Array.isArray(period.carrerasDetectadas)?period.carrerasDetectadas:[],divisiones:Array.isArray(period.divisiones)?period.divisiones:[]});
  }
  function mergePeriods(periods){
    var map={};
    (Array.isArray(periods)?periods:[]).forEach(function(period){period=normalizePeriod(period);if(period){map[period.id]=Object.assign({},map[period.id]||{},period);}});
    return Object.keys(map).map(function(id){return map[id];}).sort(function(a,b){return text(b.id).localeCompare(text(a.id));});
  }
  function readPeriods(){
    return ensureConnector().then(function(con){
      if(typeof con.getPeriods==="function"){return con.getPeriods();}
      if(typeof con.listPeriods==="function"){return con.listPeriods();}
      throw new Error("ConCarga no permite consultar períodos.");
    }).then(mergePeriods);
  }
  function renderPeriods(periods){
    periods=mergePeriods(periods);
    try{localStorage.setItem(LS_PERIODOS,JSON.stringify(periods));}catch(error){}
    var selected="";try{selected=text(localStorage.getItem(LS_PERIODO));}catch(error2){}
    var select=document.getElementById("cargaPeriodoSelect");
    if(select){
      var current=text(select.value||selected);
      select.innerHTML='<option value="">Selecciona un período</option>'+periods.map(function(period){return '<option value="'+esc(period.id)+'">'+esc(period.periodoCanonicoLabel)+'</option>';}).join("");
      if(current&&periods.some(function(period){return period.id===current;})){select.value=current;}
    }
    var count=document.getElementById("cargaPeriodosCount");if(count){count.textContent=periods.length+" período"+(periods.length===1?"":"s");}
    var cards=document.getElementById("cargaPeriodosCards");
    if(cards){
      cards.innerHTML=periods.map(function(period){
        var active=period.id===selected;var careers=(period.carrerasDetectadas||[]).length;var divisions=(period.divisiones||[]).length;var students=Number(period.estudiantes||period.totalEstudiantes||0)||0;
        return '<article class="carga-period-card '+(active?'is-active ':'')+'" data-period-id="'+esc(period.id)+'"><div><h3>'+esc(period.periodoCanonicoLabel)+'</h3><small>'+esc(period.id)+'</small></div><div class="carga-period-meta"><span class="carga-mini-pill">OK</span><span class="carga-mini-pill">'+students+' est.</span><span class="carga-mini-pill">'+careers+' carreras</span><span class="carga-mini-pill">'+divisions+' divisiones</span></div><div class="carga-period-actions"><button type="button" class="carga-btn carga-btn-secondary" data-action="use">Usar</button><button type="button" class="carga-btn carga-btn-light" data-action="edit">Editar</button><button type="button" class="carga-btn carga-btn-light" data-action="delete">Borrar</button><button type="button" class="carga-btn carga-btn-light" data-action="divisions">Divisiones</button></div></article>';
      }).join("");
    }
    return periods;
  }
  function refreshPeriods(){
    return readPeriods().then(function(periods){renderPeriods(periods);emit("carga:periods-refreshed",{ok:true,total:periods.length,source:"ConCarga",at:new Date().toISOString()});return periods;}).catch(function(error){emit("carga:periods-refresh-error",{ok:false,source:"ConCarga",error:error.message||String(error),at:new Date().toISOString()});return [];});
  }
  function boot(){
    emit("carga:ready",{ready:!!window.CargaApp,source:"ConCarga",at:new Date().toISOString()});
    ensureConnector().then(function(con){emit("carga:bdlocal-ready",{ok:true,source:"ConCarga",status:typeof con.status==="function"?con.status():{},at:new Date().toISOString()});return ensureBridge();})
      .then(refreshPeriods).then(ensurePopup)
      .then(function(){emit("carga:connection-ready",{ok:true,source:"ConCarga",at:new Date().toISOString()});})
      .catch(function(error){emit("carga:bdlocal-error",{ok:false,source:"ConCarga",error:error.message||String(error),at:new Date().toISOString()});});
  }
  window.CargaConnectionIndex={version:"2.0.0-concarga-only",ensureConnector:ensureConnector,refreshPeriods:refreshPeriods};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
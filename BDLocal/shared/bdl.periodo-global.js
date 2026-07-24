/* =========================================================
Nombre completo: bdl.periodo-global.js
Ruta o ubicación: /BDLocal/shared/bdl.periodo-global.js
Función o funciones:
- Mantener un único período activo para las pantallas operativas.
- Compartir el cambio entre ventanas, pestañas e iframes del mismo origen.
- Aplicar el período guardado cuando cada pantalla llena su selector.
- Mantener Global independiente para que compare varios períodos.
- Sincronizar el período general con BL2Core cuando esté disponible.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "1.0.0-global-period";
  var STORAGE_KEY = "REQ_PERIODO_GLOBAL_V1";
  var SIGNAL_KEY = "REQ_PERIODO_GLOBAL_SIGNAL_V1";
  var CHANNEL_NAME = "requisitos-periodo-global";
  var EVENT_CHANGED = "requisitos:periodo-global-cambiado";
  var EVENT_READY = "requisitos:periodo-global-listo";
  var SELECT_MARK = "__reqPeriodoGlobalBound";
  var APPLY_MARK = "__reqPeriodoGlobalApplying";

  var state = {
    enabled:true,
    period:null,
    channel:null,
    observer:null,
    scanTimer:null,
    syncingCore:false,
    lastCoreSignature:"",
    initialized:false
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function nowISO(){
    return new Date().toISOString();
  }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match
      ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]
      : value.replace(/_+/g,"__");
  }

  function clone(value){
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function screenName(){
    var body = document.body;
    var value = text(
      body && (
        body.getAttribute("data-bdl-screen") ||
        body.getAttribute("data-screen")
      )
    ).toLowerCase();

    if(value){ return value; }

    try{
      if(
        window.BDLocalConeRegistry &&
        typeof window.BDLocalConeRegistry.detect === "function"
      ){
        value = text(window.BDLocalConeRegistry.detect("")).toLowerCase();
      }
    }catch(error){}

    if(value){ return value; }

    return text(window.location && window.location.pathname)
      .toLowerCase()
      .replace(/\\/g,"/");
  }

  function isGlobalScreen(){
    var current = screenName();
    return (
      current === "global" ||
      current.indexOf("/global/") >= 0 ||
      current.indexOf("global.html") >= 0
    );
  }

  function normalizePeriod(value,label,source){
    if(value && typeof value === "object"){
      source = source || value.source;
      label = label || value.label || value.periodoLabel || value.nombre;
      value = value.id || value.periodoId || value.periodId || value.value;
    }

    var id = canonicalPeriodId(value);
    if(!id){ return null; }

    return {
      id:id,
      periodoId:id,
      value:id,
      label:text(label || id),
      periodoLabel:text(label || id),
      source:text(source || "periodo_global"),
      updatedAt:nowISO(),
      version:VERSION
    };
  }

  function readStored(){
    try{
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if(!raw){ return null; }
      var parsed = JSON.parse(raw);
      return normalizePeriod(parsed,parsed && parsed.label,parsed && parsed.source);
    }catch(error){
      return null;
    }
  }

  function writeStored(period){
    try{
      window.localStorage.setItem(STORAGE_KEY,JSON.stringify(period));
      window.localStorage.setItem(SIGNAL_KEY,JSON.stringify({
        id:period.id,
        updatedAt:period.updatedAt,
        nonce:Math.random().toString(16).slice(2)
      }));
      return true;
    }catch(error){
      return false;
    }
  }

  function optionFor(select,id){
    id = canonicalPeriodId(id);
    if(!select || !id){ return null; }

    var options = Array.prototype.slice.call(select.options || []);
    var found = null;

    options.some(function(option){
      if(canonicalPeriodId(option.value) === id){
        found = option;
        return true;
      }
      return false;
    });

    return found;
  }

  function optionLabel(select,id){
    var option = optionFor(select,id);
    return text(option && (option.textContent || option.label) || id);
  }

  function selectorIdentity(select){
    return text(
      select && (
        select.id ||
        select.name ||
        select.getAttribute("data-periodo-global") ||
        select.getAttribute("aria-label")
      )
    );
  }

  function isEligibleSelect(select){
    if(!state.enabled || !select || text(select.tagName).toUpperCase() !== "SELECT"){
      return false;
    }

    if(select.getAttribute("data-periodo-global") === "false"){
      return false;
    }

    if(select.getAttribute("data-periodo-global") === "true"){
      return true;
    }

    var identity = [
      select.id,
      select.name,
      select.getAttribute("data-filter"),
      select.getAttribute("data-global-filter"),
      select.getAttribute("aria-label")
    ].map(text).join(" ").toLowerCase();

    if(!/(periodo|período|period)/.test(identity)){
      return false;
    }

    if(/(desde|hasta|inicio|fin|rango|range|global)/.test(identity)){
      return false;
    }

    return true;
  }

  function emit(period,source,external){
    var detail = {
      period:clone(period),
      periodo:clone(period),
      periodoId:period && period.id || "",
      periodoLabel:period && period.label || "",
      source:text(source || period && period.source || "periodo_global"),
      external:external === true,
      version:VERSION,
      at:nowISO()
    };

    try{
      window.dispatchEvent(new CustomEvent(EVENT_CHANGED,{ detail:detail }));
    }catch(error){}

    return detail;
  }

  function broadcast(period,source){
    if(!state.channel){ return; }
    try{
      state.channel.postMessage({
        type:"period-changed",
        period:clone(period),
        source:text(source || "periodo_global"),
        at:nowISO()
      });
    }catch(error){}
  }

  function dispatchChange(select,period){
    if(!select || select[APPLY_MARK]){ return; }

    select[APPLY_MARK] = true;

    try{
      select.dispatchEvent(new CustomEvent("change",{
        bubbles:true,
        detail:{
          periodoGlobal:true,
          periodoId:period.id,
          periodoLabel:period.label
        }
      }));
    }catch(error){
      try{
        var event = document.createEvent("Event");
        event.initEvent("change",true,false);
        select.dispatchEvent(event);
      }catch(innerError){}
    }

    window.setTimeout(function(){
      select[APPLY_MARK] = false;
    },0);
  }

  function applyToSelect(select,period,options){
    options = options || {};
    period = normalizePeriod(period);

    if(!isEligibleSelect(select) || !period){ return false; }

    var option = optionFor(select,period.id);
    if(!option){ return false; }

    var previous = canonicalPeriodId(select.value);
    select.value = option.value;
    select.setAttribute("data-periodo-global-activo",period.id);

    if(previous !== period.id && options.dispatch !== false){
      dispatchChange(select,period);
    }

    return true;
  }

  function applyToAll(period,options){
    if(!state.enabled || !period){ return 0; }

    var applied = 0;
    Array.prototype.slice.call(document.querySelectorAll("select")).forEach(function(select){
      if(applyToSelect(select,period,options)){ applied += 1; }
    });
    return applied;
  }

  function syncCore(period){
    period = normalizePeriod(period);
    var core = window.BL2Core || null;

    if(
      !state.enabled ||
      !period ||
      state.syncingCore ||
      !core ||
      typeof core.setActivePeriod !== "function"
    ){
      return Promise.resolve(null);
    }

    var signature = period.id + "|" + period.label;
    if(state.lastCoreSignature === signature){
      return Promise.resolve(period);
    }

    state.syncingCore = true;

    var current = typeof core.getActivePeriod === "function"
      ? Promise.resolve().then(function(){ return core.getActivePeriod(); }).catch(function(){ return null; })
      : Promise.resolve(null);

    return current.then(function(active){
      var activeId = canonicalPeriodId(active && (active.id || active.periodoId));
      if(activeId === period.id){
        state.lastCoreSignature = signature;
        return active;
      }
      return core.setActivePeriod(period.id,period.label).then(function(result){
        state.lastCoreSignature = signature;
        return result || period;
      });
    }).catch(function(){
      return null;
    }).finally(function(){
      state.syncingCore = false;
    });
  }

  function setPeriod(value,label,options){
    options = options || {};

    if(!state.enabled && options.force !== true){
      return clone(state.period);
    }

    var period = normalizePeriod(value,label,options.source);
    if(!period){ return clone(state.period); }

    var previous = state.period;
    var changed = !previous || previous.id !== period.id || previous.label !== period.label;

    if(!changed){
      applyToAll(previous,{ dispatch:options.dispatch !== false });
      return clone(previous);
    }

    state.period = period;

    if(options.persist !== false){ writeStored(period); }
    if(options.apply !== false){ applyToAll(period,{ dispatch:options.dispatch !== false }); }
    if(options.core !== false){ syncCore(period); }
    if(options.broadcast !== false){ broadcast(period,options.source); }
    if(options.emit !== false){ emit(period,options.source,options.external); }

    return clone(period);
  }

  function adoptExternal(value,source){
    var period = normalizePeriod(value,value && value.label,source || "external");
    if(!period){ return null; }

    return setPeriod(period,period.label,{
      source:source || "external",
      persist:true,
      broadcast:false,
      external:true
    });
  }

  function captureSelect(select){
    if(!isEligibleSelect(select)){ return; }

    var id = canonicalPeriodId(select.value);
    if(!id){ return; }

    setPeriod(id,optionLabel(select,id),{
      source:selectorIdentity(select) || "selector"
    });
  }

  function bindSelect(select){
    if(!isEligibleSelect(select) || select[SELECT_MARK]){ return false; }

    select[SELECT_MARK] = true;

    select.addEventListener("change",function(){
      if(select[APPLY_MARK]){ return; }
      captureSelect(select);
    });

    if(state.period){
      applyToSelect(select,state.period,{ dispatch:true });
    }else{
      captureSelect(select);
    }

    return true;
  }

  function scan(){
    if(!state.enabled){ return 0; }

    var bound = 0;
    Array.prototype.slice.call(document.querySelectorAll("select")).forEach(function(select){
      if(bindSelect(select)){ bound += 1; }
      if(state.period){ applyToSelect(select,state.period,{ dispatch:true }); }
    });
    return bound;
  }

  function scheduleScan(delay){
    window.clearTimeout(state.scanTimer);
    state.scanTimer = window.setTimeout(scan,Math.max(0,Number(delay || 20)));
  }

  function loadFromCore(){
    if(!state.enabled || state.period){ return Promise.resolve(state.period); }

    var core = window.BL2Core || null;
    if(!core || typeof core.getActivePeriod !== "function"){
      return Promise.resolve(null);
    }

    return Promise.resolve(core.getActivePeriod()).then(function(period){
      if(!period){ return null; }
      return setPeriod(period,period.label || period.periodoLabel,{
        source:"BL2Core",
        core:false
      });
    }).catch(function(){ return null; });
  }

  function bindCommunication(){
    window.addEventListener("storage",function(event){
      if(event.key !== STORAGE_KEY || !event.newValue){ return; }
      try{ adoptExternal(JSON.parse(event.newValue),"storage"); }
      catch(error){}
    });

    if(typeof window.BroadcastChannel === "function"){
      try{
        state.channel = new window.BroadcastChannel(CHANNEL_NAME);
        state.channel.onmessage = function(event){
          var message = event && event.data || {};
          if(message.type === "period-changed" && message.period){
            adoptExternal(message.period,"broadcast");
          }
        };
      }catch(error){
        state.channel = null;
      }
    }
  }

  function bindLifecycle(){
    [
      "DOMContentLoaded",
      "load",
      "bl2:core-ready",
      "bl2:ready",
      "bl2:app-refreshed",
      "bdlocal:connections-ready",
      "bdlocal:connections-cache-updated",
      "stats:cache-invalidated"
    ].forEach(function(name){
      window.addEventListener(name,function(){
        loadFromCore();
        scheduleScan(name === "DOMContentLoaded" ? 0 : 40);
      });
    });

    if(typeof window.MutationObserver === "function"){
      state.observer = new MutationObserver(function(){ scheduleScan(30); });
      var startObserver = function(){
        var target = document.documentElement || document.body;
        if(target){
          state.observer.observe(target,{ childList:true,subtree:true });
        }
      };

      if(document.documentElement){ startObserver(); }
      else{ document.addEventListener("DOMContentLoaded",startObserver,{ once:true }); }
    }
  }

  function init(){
    if(state.initialized){ return api; }
    state.initialized = true;
    state.enabled = !isGlobalScreen();
    state.period = readStored();

    if(state.enabled){
      bindCommunication();
      bindLifecycle();
      loadFromCore();
      scheduleScan(0);
      window.setTimeout(function(){ scheduleScan(0); },250);
      window.setTimeout(function(){ scheduleScan(0); },1000);
    }

    try{
      window.dispatchEvent(new CustomEvent(EVENT_READY,{
        detail:{
          enabled:state.enabled,
          period:clone(state.period),
          globalIndependent:!state.enabled,
          version:VERSION,
          at:nowISO()
        }
      }));
    }catch(error){}

    return api;
  }

  var api = {
    version:VERSION,
    storageKey:STORAGE_KEY,
    eventName:EVENT_CHANGED,
    init:init,
    enabled:function(){ return state.enabled; },
    isGlobalScreen:isGlobalScreen,
    get:function(){ return clone(state.period); },
    set:setPeriod,
    apply:function(options){ return applyToAll(state.period,options || {}); },
    scan:scan,
    bindSelect:bindSelect,
    canonicalPeriodId:canonicalPeriodId,
    status:function(){
      return {
        ok:true,
        version:VERSION,
        enabled:state.enabled,
        globalIndependent:!state.enabled,
        period:clone(state.period),
        bound:Array.prototype.slice.call(document.querySelectorAll("select")).filter(function(select){ return !!select[SELECT_MARK]; }).length
      };
    }
  };

  window.RequisitosPeriodoGlobal = api;
  init();
})(window,document);

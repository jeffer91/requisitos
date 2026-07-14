/* =========================================================
Nombre completo: coordi.app.js
Ruta o ubicación: /Requisitos/Coordi/coordi.app.js
Función o funciones:
- Actualizar Coordi automáticamente al cambiar los filtros.
- Mostrar únicamente el correo global o la comunicación por requisito.
- Abrir Outlook y WhatsApp con el contenido preparado.
========================================================= */
(function(window,document){
  "use strict";

  var state = {
    periodId:"",
    division:"",
    career:"",
    requirementKey:"",
    report:null,
    currentMail:null,
    currentWhatsApp:null,
    loading:false,
    pendingRender:null,
    refreshTimer:null,
    statusTimer:null,
    eventsBound:false,
    booted:false
  };

  function el(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }

  function clearStatusTimer(){
    if(state.statusTimer){
      clearTimeout(state.statusTimer);
      state.statusTimer = null;
    }
  }

  function status(message,cls){
    var node = el("coordi-status");
    if(!node){ return; }
    clearStatusTimer();
    message = text(message);
    if(!message){
      node.hidden = true;
      node.textContent = "";
      node.className = "coordi-status";
      return;
    }
    node.hidden = false;
    node.textContent = message;
    node.className = "coordi-status " + (cls || "");
  }

  function transient(message){
    status(message,"");
    state.statusTimer = setTimeout(function(){
      state.statusTimer = null;
      status("");
    },1800);
  }

  function ensureModules(){
    if(window.COOReport && window.COORender && window.COOMail && window.COOWhatsApp){ return true; }
    status("No se cargaron todos los módulos de Coordi.","warn");
    return false;
  }

  function mergeRenderOptions(current,next){
    current = Object.assign({},current || {});
    next = Object.assign({},next || {});
    return Object.assign({},current,next,{
      refresh:current.refresh === true || next.refresh === true
    });
  }

  function requestSnapshot(options){
    return {
      periodId:state.periodId,
      division:state.division,
      career:state.career,
      requirementKey:state.requirementKey,
      refresh:options && options.refresh === true
    };
  }

  function requestIsCurrent(request){
    return request.periodId === state.periodId &&
      request.division === state.division &&
      request.career === state.career &&
      request.requirementKey === state.requirementKey;
  }

  function schedulePendingRender(){
    if(!state.pendingRender){ return; }
    var next = state.pendingRender;
    state.pendingRender = null;
    setTimeout(function(){ render(next); },0);
  }

  function render(options){
    options = options || {};
    if(!ensureModules()){ return Promise.resolve(null); }

    if(state.loading){
      state.pendingRender = mergeRenderOptions(state.pendingRender,options);
      return Promise.resolve(null);
    }

    state.loading = true;
    var request = requestSnapshot(options);
    status(state.periodId ? "Actualizando comunicación..." : "Cargando períodos...","");

    return window.COOReport.build(request).then(function(report){
      if(!requestIsCurrent(request)){
        state.pendingRender = mergeRenderOptions(state.pendingRender,{refresh:false});
        return report;
      }
      state.report = report;
      window.COORender.renderAll(report,state);
      status("");
      return report;
    }).catch(function(error){
      console.error("[Coordi]",error);
      status(error && error.message ? error.message : String(error),"warn");
      return null;
    }).finally(function(){
      state.loading = false;
      schedulePendingRender();
    });
  }

  function scheduleDataRefresh(){
    if(state.refreshTimer){ clearTimeout(state.refreshTimer); }
    state.refreshTimer = setTimeout(function(){
      state.refreshTimer = null;
      render({refresh:false});
    },260);
  }

  function bindDataEvents(){
    if(state.eventsBound){ return; }
    state.eventsBound = true;
    [
      "bdlocal:screen-data-updated",
      "bdlocal:conexiones-cache-updated",
      "bdlocal:legacy-snapshot",
      "requisitos:bl:snapshot-changed"
    ].forEach(function(name){ window.addEventListener(name,scheduleDataRefresh); });

    window.addEventListener("storage",function(event){
      if(event && ["REQ_BDLOCAL_CONEXIONES_CACHE_V1","REQ_BDLOCAL_LEGACY_SNAPSHOT_V1","REQ_EXCEL_LOCAL_V1:snapshot"].indexOf(event.key) >= 0){
        scheduleDataRefresh();
      }
    });
  }

  function openMail(){
    if(!state.currentMail){ status("No existe un correo preparado para este filtro.","warn"); return; }
    status("Abriendo Outlook...","");
    window.COOMail.open(state.currentMail).then(function(){
      transient("Correo abierto para revisión.");
    }).catch(function(error){
      console.error("[Coordi Mail]",error);
      status(error && error.message ? error.message : String(error),"warn");
    });
  }

  function openWhatsApp(){
    if(!state.currentWhatsApp){ status("No existe un WhatsApp preparado para este filtro.","warn"); return; }
    status("Abriendo WhatsApp...","");
    window.COOWhatsApp.open(state.currentWhatsApp).then(function(){
      transient("WhatsApp abierto para revisión.");
    }).catch(function(error){
      console.error("[Coordi WhatsApp]",error);
      status(error && error.message ? error.message : String(error),"warn");
    });
  }

  function bindStatic(){
    var periodo = el("coordi-periodo");
    var division = el("coordi-division");
    var carrera = el("coordi-carrera");
    var requisito = el("coordi-requisito");
    var openMailButton = el("coordi-open-mail");
    var openWhatsAppButton = el("coordi-open-whatsapp");

    if(periodo){ periodo.addEventListener("change",function(event){
      state.periodId = event.target.value;
      state.division = "";
      state.career = "";
      state.requirementKey = "";
      render();
    }); }

    if(division){ division.addEventListener("change",function(event){
      state.division = event.target.value;
      state.career = "";
      state.requirementKey = "";
      render();
    }); }

    if(carrera){ carrera.addEventListener("change",function(event){
      state.career = event.target.value;
      state.requirementKey = "";
      render();
    }); }

    if(requisito){ requisito.addEventListener("change",function(event){
      state.requirementKey = event.target.value;
      render();
    }); }

    if(openMailButton){ openMailButton.addEventListener("click",openMail); }
    if(openWhatsAppButton){ openWhatsAppButton.addEventListener("click",openWhatsApp); }
  }

  function connectionReady(){
    if(window.BDLScreenDepsReady && typeof window.BDLScreenDepsReady.then === "function"){
      return window.BDLScreenDepsReady.catch(function(){ return null; });
    }
    if(window.BDLocalScreenDeps && typeof window.BDLocalScreenDeps.ready === "function"){
      return window.BDLocalScreenDeps.ready().catch(function(){ return null; });
    }
    return Promise.resolve(null);
  }

  function boot(){
    if(state.booted){ return; }
    state.booted = true;
    bindStatic();
    bindDataEvents();
    connectionReady().then(function(){ return render({refresh:false}); });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",boot);
  }else{
    boot();
  }

  window.CoordiApp = {
    render:render,
    refresh:scheduleDataRefresh,
    getState:function(){ return Object.assign({},state); }
  };
})(window,document);

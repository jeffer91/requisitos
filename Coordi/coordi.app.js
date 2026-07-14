/* =========================================================
Nombre completo: coordi.app.js
Ruta o ubicación: /Requisitos/Coordi/coordi.app.js
Función o funciones:
- Controlar Coordi con datos autoritativos de Base Local.
- Manejar filtros por período, división, carrera y requisito.
- Generar visión global y reportes por responsable.
- Ocultar mensajes de éxito y mostrar solo carga o errores.
- Mantener correo, WhatsApp, exportación y vista previa.
========================================================= */
(function(window,document){
  "use strict";

  var state = {
    periodId:"",
    division:"",
    career:"",
    requirementKey:"",
    selectedAreaId:"",
    messageType:"general",
    report:null,
    previewMail:null,
    loading:false,
    refreshTimer:null,
    eventsBound:false,
    booted:false
  };

  function el(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }

  function status(message,cls){
    var node = el("coordi-status");
    if(!node){ return; }
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
    setTimeout(function(){ status(""); },1800);
  }

  function copyText(value){
    value = text(value);
    if(window.CoordiExport && typeof window.CoordiExport.copyText === "function"){
      return window.CoordiExport.copyText(value);
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(value);
    }
    return Promise.reject(new Error("No se pudo copiar al portapapeles."));
  }

  function exportJson(data){
    if(window.CoordiExport && typeof window.CoordiExport.exportJson === "function"){
      window.CoordiExport.exportJson(data);
      return;
    }
    var blob = new Blob([JSON.stringify(data || {},null,2)],{type:"application/json"});
    var anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "coordi-reporte.json";
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(function(){ URL.revokeObjectURL(anchor.href); anchor.remove(); },500);
  }

  function ensureModern(){
    if(window.COOReport && window.COORender){ return true; }
    status("No se cargó el motor Coordi. Revisa coo.report.js y coo.render.js.","warn");
    return false;
  }

  function ensureMail(){
    if(window.COOMail){ return true; }
    status("No se cargó el módulo de correos.","warn");
    return false;
  }

  function ensureWhatsApp(){
    if(window.COOWhatsApp){ return true; }
    status("No se cargó el módulo de WhatsApp.","warn");
    return false;
  }

  function render(options){
    options = options || {};
    if(state.loading || !ensureModern()){ return Promise.resolve(null); }

    state.loading = true;
    status("Generando reportes por responsables...","");

    return window.COOReport.build({
      periodId:state.periodId,
      division:state.division,
      career:state.career,
      requirementKey:state.requirementKey,
      refresh:options.refresh === true
    }).then(function(report){
      state.report = report;
      if(!state.selectedAreaId || !window.COORender.areaById(report,state.selectedAreaId)){
        state.selectedAreaId = window.COORender.firstPendingArea(report) || "";
      }
      window.COORender.renderAll(report,state);
      status("");
      return report;
    }).catch(function(error){
      console.error("[Coordi]",error);
      status(error && error.message ? error.message : String(error),"warn");
      return null;
    }).finally(function(){ state.loading = false; });
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

  function buildMail(kind,areaId){
    if(!state.report){ throw new Error("Primero genera el reporte."); }
    if(!ensureMail()){ throw new Error("No se cargó el módulo de correos."); }
    return window.COOMail.build(state.report,{kind:kind,areaId:areaId || ""});
  }

  function openMail(mail){
    if(!mail){ status("No hay correo preparado.","warn"); return; }
    status("Copiando tabla HTML y abriendo Outlook...","");
    window.COOMail.open(mail).then(function(){
      transient("Outlook abierto. Si la tabla no aparece, pégala con Ctrl+V.");
    }).catch(function(error){
      console.error("[Coordi Mail]",error);
      status(error && error.message ? error.message : String(error),"warn");
    });
  }

  function buildWhatsApp(kind,areaId){
    if(!state.report){ throw new Error("Primero genera el reporte."); }
    if(!ensureWhatsApp()){ throw new Error("No se cargó el módulo de WhatsApp."); }
    return window.COOWhatsApp.build(state.report,{kind:kind,areaId:areaId || ""});
  }

  function openWhatsApp(message){
    if(!message){ status("No hay mensaje de WhatsApp preparado.","warn"); return; }
    status("Abriendo WhatsApp...","");
    window.COOWhatsApp.open(message).then(function(){
      transient("WhatsApp abierto con el mensaje listo para revisar.");
    }).catch(function(error){
      console.error("[Coordi WhatsApp]",error);
      status(error && error.message ? error.message : String(error),"warn");
    });
  }

  function previewMail(mail,title){
    state.previewMail = mail;
    window.COORender.openPreview(title || mail.subject || "Correo",mail.html || "");
  }

  function bindStatic(){
    var periodo = el("coordi-periodo");
    var division = el("coordi-division");
    var carrera = el("coordi-carrera");
    var requisito = el("coordi-requisito");
    var refresh = el("coordi-refresh");
    var copySummary = el("coordi-copy-summary");
    var exportBtn = el("coordi-export-json");
    var copyMessage = el("coordi-copy-message");
    var messageType = el("coordi-message-type");
    var closePreview = el("coordi-preview-close");
    var openPreviewMail = el("coordi-preview-open-mail");
    var copyPreviewHtml = el("coordi-preview-copy-html");

    if(periodo){ periodo.addEventListener("change",function(event){ state.periodId = event.target.value; state.division = ""; state.career = ""; state.requirementKey = ""; state.selectedAreaId = ""; render(); }); }
    if(division){ division.addEventListener("change",function(event){ state.division = event.target.value; state.career = ""; state.selectedAreaId = ""; render(); }); }
    if(carrera){ carrera.addEventListener("change",function(event){ state.career = event.target.value; state.selectedAreaId = ""; render(); }); }
    if(requisito){ requisito.addEventListener("change",function(event){ state.requirementKey = event.target.value; state.selectedAreaId = ""; render(); }); }
    if(refresh){ refresh.addEventListener("click",function(){ render({refresh:true}); }); }
    if(messageType){ messageType.addEventListener("change",function(event){ state.messageType = event.target.value; if(state.report){ window.COORender.renderMessage(state.report,state); } }); }

    if(copySummary){ copySummary.addEventListener("click",function(){
      if(!state.report){ status("Primero genera el reporte.","warn"); return; }
      copyText(window.COORender.summaryText(state.report)).then(function(){ transient("Resumen copiado."); }).catch(function(error){ status(error.message || String(error),"warn"); });
    }); }

    if(exportBtn){ exportBtn.addEventListener("click",function(){ exportJson(state.report || {}); }); }
    if(copyMessage){ copyMessage.addEventListener("click",function(){
      copyText(el("coordi-message") ? el("coordi-message").value : "").then(function(){ transient("Mensaje copiado."); }).catch(function(error){ status(error.message || String(error),"warn"); });
    }); }
    if(closePreview){ closePreview.addEventListener("click",function(){ window.COORender.closePreview(); }); }
    if(openPreviewMail){ openPreviewMail.addEventListener("click",function(){ openMail(state.previewMail); }); }
    if(copyPreviewHtml){ copyPreviewHtml.addEventListener("click",function(){
      if(!state.previewMail){ status("No hay correo en vista previa.","warn"); return; }
      window.COOMail.copyHtml(state.previewMail).then(function(){ transient("HTML copiado."); }).catch(function(error){ status(error.message || String(error),"warn"); });
    }); }
  }

  function bindDynamic(){
    document.addEventListener("click",function(event){
      var button = event.target && event.target.closest ? event.target.closest("[data-action]") : null;
      if(!button){ return; }
      var action = button.getAttribute("data-action");
      var areaId = button.getAttribute("data-area-id") || "";
      if(!state.report){ status("Primero genera el reporte.","warn"); return; }

      try{
        if(action === "show-detail"){
          state.selectedAreaId = areaId;
          window.COORender.renderAll(state.report,state);
        }else if(action === "preview-global"){
          previewMail(buildMail("global"),"Reporte global");
        }else if(action === "mail-global"){
          openMail(buildMail("global"));
        }else if(action === "whatsapp-global"){
          openWhatsApp(buildWhatsApp("global"));
        }else if(action === "preview-area-summary"){
          state.selectedAreaId = areaId;
          window.COORender.renderAll(state.report,state);
          previewMail(buildMail("area-summary",areaId),"Correo resumen");
        }else if(action === "preview-area-detail"){
          state.selectedAreaId = areaId;
          window.COORender.renderAll(state.report,state);
          previewMail(buildMail("area-detail",areaId),"Correo detallado");
        }else if(action === "mail-area-summary"){
          state.selectedAreaId = areaId;
          window.COORender.renderAll(state.report,state);
          openMail(buildMail("area-summary",areaId));
        }else if(action === "mail-area-detail"){
          state.selectedAreaId = areaId;
          window.COORender.renderAll(state.report,state);
          openMail(buildMail("area-detail",areaId));
        }else if(action === "whatsapp-area"){
          state.selectedAreaId = areaId;
          window.COORender.renderAll(state.report,state);
          openWhatsApp(buildWhatsApp("area",areaId));
        }
      }catch(error){
        console.error("[Coordi action]",error);
        status(error && error.message ? error.message : String(error),"warn");
      }
    });
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
    bindDynamic();
    bindDataEvents();
    status("Conectando Coordi con Base Local...","");
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

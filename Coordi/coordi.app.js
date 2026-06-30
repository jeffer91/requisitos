/* =========================================================
Nombre completo: coordi.app.js
Ruta o ubicación: /Requisitos/Coordi/coordi.app.js
Función o funciones:
- Controlar la pantalla Coordi con el nuevo motor de reportes.
- Manejar filtros por período y división.
- Renderizar reportes reales por responsable.
- Abrir Outlook/correo con respaldo HTML copiado al portapapeles.
- Abrir WhatsApp con mensaje corto por responsable.
Con qué se conecta:
- coo.config.js
- coo.data.js
- coo.report.js
- coo.render.js
- coo.mail.js
- coo.whatsapp.js
- coordi.export.js
========================================================= */
(function(window,document){
  "use strict";

  var state = {
    periodId:"",
    division:"",
    selectedAreaId:"",
    messageType:"general",
    report:null,
    previewMail:null,
    loading:false
  };

  function el(id){return document.getElementById(id);}
  function text(value){return String(value == null ? "" : value).trim();}

  function status(message, cls){
    var node = el("coordi-status");
    if(node){node.textContent = message;node.className = "coordi-status " + (cls || "");}
  }

  function copyText(value){
    value = text(value);
    if(window.CoordiExport && typeof window.CoordiExport.copyText === "function"){return window.CoordiExport.copyText(value);}
    if(navigator.clipboard && navigator.clipboard.writeText){return navigator.clipboard.writeText(value);}
    return Promise.reject(new Error("No se pudo copiar al portapapeles."));
  }

  function exportJson(data){
    if(window.CoordiExport && typeof window.CoordiExport.exportJson === "function"){window.CoordiExport.exportJson(data);return;}
    var blob = new Blob([JSON.stringify(data || {}, null, 2)], {type:"application/json"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "coordi-reporte.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();}, 500);
  }

  function ensureModern(){
    if(window.COOReport && window.COORender){return true;}
    status("No se cargó el nuevo motor Coordi. Revisa coo.report.js y coo.render.js.", "warn");
    return false;
  }

  function ensureMail(){
    if(window.COOMail){return true;}
    status("No se cargó el módulo de correos. Revisa coo.mail.js.", "warn");
    return false;
  }

  function ensureWhatsApp(){
    if(window.COOWhatsApp){return true;}
    status("No se cargó el módulo de WhatsApp. Revisa coo.whatsapp.js.", "warn");
    return false;
  }

  function render(options){
    options = options || {};
    if(state.loading){return;}
    if(!ensureModern()){return;}
    state.loading = true;
    status("Generando reportes por responsables...", "");
    window.COOReport.build({periodId:state.periodId, division:state.division, refresh:!!options.refresh}).then(function(report){
      state.report = report;
      if(!state.selectedAreaId || !window.COORender.areaById(report, state.selectedAreaId)){
        state.selectedAreaId = window.COORender.firstPendingArea(report) || "";
      }
      window.COORender.renderAll(report, state);
      status("Coordi listo. Fuente: " + (report.source || "Base local") + ". Estudiantes revisados: " + ((report.global && report.global.totalEstudiantesRevisados) || 0) + ".", "ok");
    }).catch(function(error){
      console.error("[Coordi]", error);
      status(error && error.message ? error.message : String(error), "warn");
    }).finally(function(){state.loading = false;});
  }

  function buildMail(kind, areaId){
    if(!state.report){throw new Error("Primero genera el reporte.");}
    if(!ensureMail()){throw new Error("No se cargó el módulo de correos.");}
    return window.COOMail.build(state.report, {kind:kind, areaId:areaId || ""});
  }

  function openMail(mail){
    if(!mail){status("No hay correo preparado.", "warn");return;}
    status("Copiando tabla HTML y abriendo Outlook...", "");
    window.COOMail.open(mail).then(function(){
      status("Outlook abierto. La tabla HTML fue copiada; si no aparece en el cuerpo, pega con Ctrl+V.", "ok");
    }).catch(function(error){
      console.error("[Coordi Mail]", error);
      status(error && error.message ? error.message : String(error), "warn");
    });
  }

  function buildWhatsApp(kind, areaId){
    if(!state.report){throw new Error("Primero genera el reporte.");}
    if(!ensureWhatsApp()){throw new Error("No se cargó el módulo de WhatsApp.");}
    return window.COOWhatsApp.build(state.report, {kind:kind, areaId:areaId || ""});
  }

  function openWhatsApp(message){
    if(!message){status("No hay mensaje de WhatsApp preparado.", "warn");return;}
    status("Abriendo WhatsApp...", "");
    window.COOWhatsApp.open(message).then(function(){
      status("WhatsApp abierto con el mensaje listo para revisar y enviar.", "ok");
    }).catch(function(error){
      console.error("[Coordi WhatsApp]", error);
      status(error && error.message ? error.message : String(error), "warn");
    });
  }

  function previewMail(mail, title){
    state.previewMail = mail;
    window.COORender.openPreview(title || mail.subject || "Correo", mail.html || "");
  }

  function bindStatic(){
    var periodo = el("coordi-periodo");
    var division = el("coordi-division");
    var refresh = el("coordi-refresh");
    var copySummary = el("coordi-copy-summary");
    var exportBtn = el("coordi-export-json");
    var copyMessage = el("coordi-copy-message");
    var closePreview = el("coordi-preview-close");
    var openPreviewMail = el("coordi-preview-open-mail");
    var copyPreviewHtml = el("coordi-preview-copy-html");

    if(periodo){periodo.addEventListener("change", function(e){state.periodId = e.target.value;state.division = "";state.selectedAreaId = "";render();});}
    if(division){division.addEventListener("change", function(e){state.division = e.target.value;state.selectedAreaId = "";render();});}
    if(refresh){refresh.addEventListener("click", function(){render({refresh:true});});}
    if(copySummary){copySummary.addEventListener("click", function(){
      if(!state.report){status("Primero genera el reporte.", "warn");return;}
      copyText(window.COORender.summaryText(state.report)).then(function(){status("Resumen copiado.", "ok");}).catch(function(error){status(error.message || String(error), "warn");});
    });}
    if(exportBtn){exportBtn.addEventListener("click", function(){exportJson(state.report || {});});}
    if(copyMessage){copyMessage.addEventListener("click", function(){
      copyText(el("coordi-message") ? el("coordi-message").value : "").then(function(){status("Mensaje copiado.", "ok");}).catch(function(error){status(error.message || String(error), "warn");});
    });}
    if(closePreview){closePreview.addEventListener("click", function(){window.COORender.closePreview();});}
    if(openPreviewMail){openPreviewMail.addEventListener("click", function(){openMail(state.previewMail);});}
    if(copyPreviewHtml){copyPreviewHtml.addEventListener("click", function(){
      if(!state.previewMail){status("No hay correo en vista previa.", "warn");return;}
      window.COOMail.copyHtml(state.previewMail).then(function(){status("HTML copiado. Pégalo en Outlook con Ctrl+V.", "ok");}).catch(function(error){status(error.message || String(error), "warn");});
    });}
  }

  function bindDynamic(){
    document.addEventListener("click", function(event){
      var btn = event.target && event.target.closest ? event.target.closest("[data-action]") : null;
      if(!btn){return;}
      var action = btn.getAttribute("data-action");
      var areaId = btn.getAttribute("data-area-id") || "";
      if(!state.report){status("Primero genera el reporte.", "warn");return;}
      try{
        if(action === "show-detail"){
          state.selectedAreaId = areaId;
          window.COORender.renderAll(state.report, state);
          status("Detalle cargado para el área seleccionada.", "ok");
        }
        if(action === "preview-global"){
          previewMail(buildMail("global"), "Reporte global");
        }
        if(action === "mail-global"){
          openMail(buildMail("global"));
        }
        if(action === "whatsapp-global"){
          openWhatsApp(buildWhatsApp("global"));
        }
        if(action === "preview-area-summary"){
          state.selectedAreaId = areaId;
          window.COORender.renderAll(state.report, state);
          previewMail(buildMail("area-summary", areaId), "Correo resumen");
        }
        if(action === "preview-area-detail"){
          state.selectedAreaId = areaId;
          window.COORender.renderAll(state.report, state);
          previewMail(buildMail("area-detail", areaId), "Correo detallado");
        }
        if(action === "mail-area-summary"){
          state.selectedAreaId = areaId;
          window.COORender.renderAll(state.report, state);
          openMail(buildMail("area-summary", areaId));
        }
        if(action === "mail-area-detail"){
          state.selectedAreaId = areaId;
          window.COORender.renderAll(state.report, state);
          openMail(buildMail("area-detail", areaId));
        }
        if(action === "whatsapp-area"){
          state.selectedAreaId = areaId;
          window.COORender.renderAll(state.report, state);
          openWhatsApp(buildWhatsApp("area", areaId));
        }
      }catch(error){
        console.error("[Coordi action]", error);
        status(error && error.message ? error.message : String(error), "warn");
      }
    });
  }

  function boot(){
    try{if(window.BL2 && typeof window.BL2.status === "function"){window.BL2.status({deep:false});}}catch(error){}
    bindStatic();
    bindDynamic();
    render();
  }

  if(document.readyState === "loading"){document.addEventListener("DOMContentLoaded", boot);}else{boot();}
})(window,document);

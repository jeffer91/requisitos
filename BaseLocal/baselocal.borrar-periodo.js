/* =========================================================
Nombre completo: baselocal.borrar-periodo.js
Ruta o ubicación: /Requisitos/BaseLocal/baselocal.borrar-periodo.js
Función o funciones:
- Controlar el modal visual para borrar períodos desde BL/Base Local.
- Mostrar período, cantidad de estudiantes, alerta por vigencia/recencia y doble confirmación.
- Ejecutar el respaldo Excel obligatorio y el archivado seguro del período.
Con qué se conecta:
- bl-borrar-periodo.service.js
- bl-respaldo-periodo-excel.service.js
- baselocal.app.js
========================================================= */
(function(window,document){
  "use strict";

  var currentPlan=null;

  function el(id){return document.getElementById(id);}
  function text(value){return String(value == null ? "" : value).trim();}
  function status(message, className){var box=el("bl-status");if(box){box.textContent=message;box.className="bl-status "+(className || "bl-status-info");}}
  function setText(id,value){var node=el(id);if(node){node.textContent=value;}}
  function setOpen(open){var modal=el("bl-delete-period-modal");if(modal){modal.classList.toggle("is-open", !!open);modal.setAttribute("aria-hidden", open ? "false" : "true");}}
  function selectedPeriod(){var selector=el("bl-filter-period");return selector ? text(selector.value) : "";}

  function setBusy(isBusy){
    ["bl-delete-period-confirm","bl-delete-period-cancel","bl-delete-period-close","bl-btn-delete-period"].forEach(function(id){var node=el(id);if(node){node.disabled=!!isBusy;}});
    var btn=el("bl-delete-period-confirm");
    if(btn){btn.textContent=isBusy ? "Respaldando y borrando..." : "Sí, borrar período";}
  }

  function riskClass(risk){
    if(risk === "vigente"){return "bl-delete-risk-danger";}
    if(risk === "reciente" || risk === "indeterminado"){return "bl-delete-risk-warn";}
    return "bl-delete-risk-ok";
  }

  function updateConfirmState(){
    var input=el("bl-delete-period-text");
    var confirm=el("bl-delete-period-confirm");
    var required=!!(currentPlan && currentPlan.requiresDoubleConfirm);
    if(!input || !confirm){return;}
    var ok=!required || text(input.value) === (window.BLBorrarPeriodoService && window.BLBorrarPeriodoService.confirmText || "BORRAR PERIODO");
    confirm.disabled=!ok;
  }

  function openModal(){
    try{
      if(!window.BLBorrarPeriodoService || typeof window.BLBorrarPeriodoService.preview !== "function"){throw new Error("No está cargado el servicio para borrar períodos.");}
      var periodId=selectedPeriod();
      if(!periodId){status("Selecciona un período específico antes de borrar. No se permite borrar 'Todos los períodos'.", "bl-status-warn");return;}
      currentPlan=window.BLBorrarPeriodoService.preview(periodId);
      setText("bl-delete-period-label", currentPlan.periodoLabel || currentPlan.periodoId);
      setText("bl-delete-period-id", currentPlan.periodoId);
      setText("bl-delete-period-count", String(currentPlan.totalStudents || 0));
      setText("bl-delete-period-history-count", String(currentPlan.totalHistory || 0));
      setText("bl-delete-period-risk", currentPlan.message || "Se hará respaldo Excel antes de borrar.");
      var risk=el("bl-delete-period-risk");
      if(risk){risk.className="bl-delete-alert "+riskClass(currentPlan.risk);}
      var confirmText=window.BLBorrarPeriodoService.confirmText || "BORRAR PERIODO";
      setText("bl-delete-period-confirm-word", confirmText);
      var input=el("bl-delete-period-text");
      if(input){input.value="";input.disabled=!currentPlan.requiresDoubleConfirm;input.placeholder=currentPlan.requiresDoubleConfirm ? confirmText : "No requerido para período antiguo";}
      var help=el("bl-delete-period-confirm-help");
      if(help){help.textContent=currentPlan.requiresDoubleConfirm ? "Para continuar escribe exactamente el texto solicitado." : "Este período parece antiguo. Solo confirma el borrado; igual se descargará el respaldo Excel.";}
      setOpen(true);
      updateConfirmState();
      if(input && currentPlan.requiresDoubleConfirm){setTimeout(function(){input.focus();}, 80);}
    }catch(error){console.error("[BaseLocal borrar período modal]", error);status("No se pudo preparar el borrado: "+(error.message || String(error)), "bl-status-warn");}
  }

  function closeModal(){currentPlan=null;setOpen(false);}

  async function confirmDelete(){
    if(!currentPlan){return;}
    try{
      if(!window.BLBorrarPeriodoService || typeof window.BLBorrarPeriodoService.borrar !== "function"){throw new Error("No está cargado el servicio para borrar períodos.");}
      setBusy(true);
      status("Generando respaldo Excel antes de borrar el período...", "bl-status-info");
      var input=el("bl-delete-period-text");
      var result=await window.BLBorrarPeriodoService.borrar({periodId:currentPlan.periodoId, confirmText:input ? input.value : ""});
      closeModal();
      var selector=el("bl-filter-period");
      if(selector){selector.value="";selector.dispatchEvent(new Event("change", {bubbles:true}));}
      var refresh=el("bl-btn-refresh");
      if(refresh){refresh.click();}
      status("Período borrado y respaldado. Excel: "+(result.backupFileName || "generado")+". Estudiantes archivados: "+(result.totalStudents || 0)+".", "bl-status-ok");
    }catch(error){console.error("[BaseLocal borrar período]", error);status("No se borró el período: "+(error.message || String(error)), "bl-status-warn");}
    finally{setBusy(false);updateConfirmState();}
  }

  function boot(){
    if(window.BLBorrarPeriodoService && typeof window.BLBorrarPeriodoService.purgarHistorialVencido === "function"){
      try{window.BLBorrarPeriodoService.purgarHistorialVencido({save:true});}catch(error){}
    }
    if(el("bl-btn-delete-period")){el("bl-btn-delete-period").addEventListener("click", openModal);}
    ["bl-delete-period-close","bl-delete-period-cancel"].forEach(function(id){if(el(id)){el(id).addEventListener("click", closeModal);}});
    if(el("bl-delete-period-confirm")){el("bl-delete-period-confirm").addEventListener("click", confirmDelete);}
    if(el("bl-delete-period-text")){el("bl-delete-period-text").addEventListener("input", updateConfirmState);}
    var modal=el("bl-delete-period-modal");
    if(modal){modal.addEventListener("click", function(event){if(event.target === modal){closeModal();}});}
    document.addEventListener("keydown", function(event){if(event.key === "Escape"){closeModal();}});
  }

  if(document.readyState === "loading"){document.addEventListener("DOMContentLoaded", boot);}else{boot();}
})(window,document);

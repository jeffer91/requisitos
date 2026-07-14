/* =========================================================
Nombre completo: coo.whatsapp.js
Ruta o ubicación: /Requisitos/Coordi/coo.whatsapp.js
Función o funciones:
- Generar el WhatsApp del responsable para un requisito específico.
- Incluir período, división, requisito y total de estudiantes pendientes.
- Abrir WhatsApp Web/App mediante enlace wa.me.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "3.0.0-requirement-message";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function arr(value){ return Array.isArray(value) ? value : []; }
  function fmt(value){ return Number(value || 0).toLocaleString("es-EC"); }
  function cleanPhone(value){ return text(value).replace(/[^0-9]/g,""); }

  function areaById(report,areaId){
    var found = null;
    arr(report && report.areas).some(function(area){ if(area.id === areaId){ found = area; return true; } return false; });
    return found;
  }
  function periodLabel(report){ return text(report && report.filters && (report.filters.periodLabel || report.filters.periodId)) || "Período no definido"; }
  function divisionLabel(report){ return text(report && report.filters && report.filters.division) || "Todas"; }
  function requirementLabel(report){ return text(report && report.filters && (report.filters.requirementLabel || report.filters.requirementKey)) || "Requisito"; }

  function buildArea(report,areaId){
    var area = areaById(report,areaId);
    if(!area){ throw new Error("No se encontró el área seleccionada."); }
    var lines = [
      "Buen día, " + (area.saludo || area.responsable) + ".","",
      "Se ha preparado el listado de estudiantes pendientes del requisito " + requirementLabel(report) + ".","",
      "Período: " + periodLabel(report),
      "División: " + divisionLabel(report)
    ];
    if(report && report.filters && report.filters.career){ lines.push("Carrera: " + report.filters.career); }
    lines = lines.concat([
      "Total de estudiantes pendientes: " + fmt(area.totalEstudiantes),"",
      "Por favor, revisar el correo con el detalle de estudiantes y realizar la gestión correspondiente."
    ]);
    return {kind:"area",areaId:areaId,to:cleanPhone(area.whatsapp || ""),text:lines.join("\n")};
  }

  function buildGlobal(report){
    return {kind:"global",to:"",text:"El reporte general está disponible por correo."};
  }
  function build(report,options){
    options = options || {};
    if(options.kind === "area"){ return buildArea(report,options.areaId); }
    if(options.kind === "global"){ return buildGlobal(report); }
    throw new Error("Tipo de WhatsApp no reconocido.");
  }
  function link(message){
    message = message || {};
    var phone = cleanPhone(message.to || "");
    if(!phone){ throw new Error("No hay número de WhatsApp configurado."); }
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message.text || "");
  }
  function openExternal(url){
    if(window.electronAPI && typeof window.electronAPI.openExternal === "function"){ return window.electronAPI.openExternal(url); }
    var opened = window.open(url,"_blank","noopener,noreferrer");
    if(!opened){ return Promise.reject(new Error("El navegador bloqueó la apertura de WhatsApp.")); }
    return Promise.resolve(true);
  }
  function open(message){ return openExternal(link(message)); }

  window.COOWhatsApp = {version:VERSION,build:build,buildGlobal:buildGlobal,buildArea:buildArea,link:link,open:open,helpers:{fmt:fmt,cleanPhone:cleanPhone}};
})(window);

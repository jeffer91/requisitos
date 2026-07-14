/* =========================================================
Nombre completo: coo.whatsapp.js
Ruta o ubicación: /Requisitos/Coordi/coo.whatsapp.js
Función o funciones:
- Generar mensajes globales y por área con los filtros aplicados.
- Abrir WhatsApp Web/App mediante enlace wa.me.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.1.0-coo-whatsapp-period-label";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function arr(value){ return Array.isArray(value) ? value : []; }
  function fmt(value){ value = Number(value || 0); return value.toLocaleString("es-EC"); }
  function cleanPhone(value){ return text(value).replace(/[^0-9]/g,""); }

  function areaById(report,areaId){
    var found = null;
    arr(report && report.areas).some(function(area){ if(area.id === areaId){ found = area; return true; } return false; });
    return found;
  }

  function filterText(report){
    report = report || {};
    var filters = report.filters || {};
    var parts = [];
    if(filters.periodLabel || filters.periodId){ parts.push("Período: " + (filters.periodLabel || filters.periodId)); }
    if(filters.division){ parts.push("División: " + filters.division); }
    if(filters.career){ parts.push("Carrera: " + filters.career); }
    if(filters.requirementLabel || filters.requirementKey){ parts.push("Requisito: " + (filters.requirementLabel || filters.requirementKey)); }
    return parts.length ? parts.join(" · ") : "corte actual";
  }

  function buildGlobal(report){
    report = report || {};
    var global = report.global || {};
    return {
      kind:"global",
      to:cleanPhone(global.whatsapp || ""),
      text:[
        "Buen día, " + (global.saludo || global.responsable || "Dr. Alex León") + ".",
        "",
        "Se generó la visión global del avance de los estudiantes.",
        filterText(report),
        "",
        "Estudiantes revisados: " + fmt(global.totalEstudiantesRevisados),
        "Estudiantes al día: " + fmt(global.totalEstudiantesAlDia),
        "Estudiantes con pendientes: " + fmt(global.totalEstudiantesPendientes),
        "Áreas con pendientes: " + fmt(global.totalAreasConPendientes),
        "Pendientes acumulados: " + fmt(global.totalPendientes),
        "",
        "El detalle fue preparado para envío por correo."
      ].join("\n")
    };
  }

  function buildArea(report,areaId){
    var area = areaById(report,areaId);
    if(!area){ throw new Error("No se encontró el área seleccionada."); }
    return {
      kind:"area",
      areaId:areaId,
      to:cleanPhone(area.whatsapp || ""),
      text:[
        "Buen día, " + (area.saludo || area.responsable) + ".",
        "",
        "Se generó el reporte de avance del área: " + area.area + ".",
        filterText(report),
        "",
        "Estudiantes pendientes: " + fmt(area.totalEstudiantes),
        "Requisitos pendientes acumulados: " + fmt(area.totalPendientes),
        "Carreras afectadas: " + fmt(arr(area.carreras).length),
        "",
        "Por favor revisar el correo con el detalle correspondiente."
      ].join("\n")
    };
  }

  function build(report,options){
    options = options || {};
    if(options.kind === "global"){ return buildGlobal(report); }
    if(options.kind === "area"){ return buildArea(report,options.areaId); }
    throw new Error("Tipo de WhatsApp no reconocido.");
  }

  function link(message){
    message = message || {};
    var phone = cleanPhone(message.to || "");
    if(!phone){ throw new Error("No hay número de WhatsApp configurado."); }
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message.text || "");
  }

  function openExternal(url){
    if(window.electronAPI && typeof window.electronAPI.openExternal === "function"){
      return window.electronAPI.openExternal(url);
    }
    window.open(url,"_blank","noopener,noreferrer");
    return Promise.resolve(true);
  }

  function open(message){ return openExternal(link(message)); }

  window.COOWhatsApp = {
    version:VERSION,
    build:build,
    buildGlobal:buildGlobal,
    buildArea:buildArea,
    link:link,
    open:open,
    helpers:{fmt:fmt,filterText:filterText,cleanPhone:cleanPhone}
  };
})(window);

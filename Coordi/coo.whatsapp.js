/* =========================================================
Nombre completo: coo.whatsapp.js
Ruta o ubicación: /Requisitos/Coordi/coo.whatsapp.js
Función o funciones:
- Generar mensajes cortos de WhatsApp para responsables de Coordi.
- Crear mensaje global y mensaje por área.
- Abrir WhatsApp Web/App mediante enlace wa.me.
Con qué se conecta:
- coo.report.js
- coo.config.js
- coordi.app.js
- electron/preload.js
- electron/main.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-coo-whatsapp.1";

  function text(value){return String(value == null ? "" : value).trim();}
  function arr(value){return Array.isArray(value) ? value : [];} 
  function fmt(value){value = Number(value || 0);return value.toLocaleString("es-EC");}
  function cleanPhone(value){return text(value).replace(/[^0-9]/g, "");}

  function areaById(report, areaId){
    var found = null;
    arr(report && report.areas).some(function(area){
      if(area.id === areaId){found = area;return true;}
      return false;
    });
    return found;
  }

  function filterText(report){
    report = report || {};
    var f = report.filters || {};
    var parts = [];
    if(f.periodId){parts.push("Período: " + f.periodId);}
    if(f.division){parts.push("División: " + f.division);}
    return parts.length ? parts.join(" · ") : "corte actual";
  }

  function buildGlobal(report){
    report = report || {};
    var global = report.global || {};
    var lines = [
      "Buen día, " + (global.saludo || global.responsable || "Dr. Alex León") + ".",
      "",
      "Se generó el reporte global de pendientes por área.",
      filterText(report),
      "",
      "Estudiantes revisados: " + fmt(global.totalEstudiantesRevisados),
      "Estudiantes con pendientes: " + fmt(global.totalEstudiantesPendientes),
      "Áreas con pendientes: " + fmt(global.totalAreasConPendientes),
      "Pendientes acumulados: " + fmt(global.totalPendientes),
      "",
      "El detalle fue preparado para envío por correo."
    ];
    return {
      kind:"global",
      to:cleanPhone(global.whatsapp || ""),
      text:lines.join("\n")
    };
  }

  function buildArea(report, areaId){
    var area = areaById(report, areaId);
    if(!area){throw new Error("No se encontró el área seleccionada.");}
    var lines = [
      "Buen día, " + (area.saludo || area.responsable) + ".",
      "",
      "Se generó el reporte de pendientes del área: " + area.area + ".",
      filterText(report),
      "",
      "Estudiantes pendientes: " + fmt(area.totalEstudiantes),
      "Requisitos pendientes acumulados: " + fmt(area.totalPendientes),
      "Carreras afectadas: " + fmt(arr(area.carreras).length),
      "",
      "Por favor revisar el correo con el detalle correspondiente."
    ];
    return {
      kind:"area",
      areaId:areaId,
      to:cleanPhone(area.whatsapp || ""),
      text:lines.join("\n")
    };
  }

  function build(report, options){
    options = options || {};
    if(options.kind === "global"){return buildGlobal(report);}
    if(options.kind === "area"){return buildArea(report, options.areaId);}
    throw new Error("Tipo de WhatsApp no reconocido.");
  }

  function link(message){
    message = message || {};
    var phone = cleanPhone(message.to || "");
    if(!phone){throw new Error("No hay número de WhatsApp configurado.");}
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message.text || "");
  }

  function openExternal(url){
    if(window.electronAPI && typeof window.electronAPI.openExternal === "function"){
      return window.electronAPI.openExternal(url);
    }
    window.open(url, "_blank", "noopener,noreferrer");
    return Promise.resolve(true);
  }

  function open(message){
    return openExternal(link(message));
  }

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

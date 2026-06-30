/* =========================================================
Nombre completo: coordi.export.js
Ruta o ubicación: /Requisitos/Coordi/coordi.export.js
Función o funciones:
- Exportar o copiar información de coordinación.
- Soportar el nuevo reporte Coordi por responsables.
- Mantener compatibilidad con la versión antigua de Coordi.
Con qué se conecta:
- coordi.app.js
- coo.report.js
- coo.render.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function arr(value){return Array.isArray(value) ? value : [];} 
  function fmt(value){value = Number(value || 0);return value.toLocaleString("es-EC");}
  function safeName(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").toLowerCase() || "reporte";}

  function download(name, content, type){
    var blob = new Blob([content], {type:type || "text/plain;charset=utf-8"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href);}, 1000);
  }

  function exportJson(data){
    var stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    download("coordi-reporte-" + stamp + ".json", JSON.stringify(data || {}, null, 2), "application/json;charset=utf-8");
  }

  function csvEscape(value){
    value = text(value);
    if(/[",\n\r;]/.test(value)){return '"' + value.replace(/"/g,'""') + '"';}
    return value;
  }

  function exportAreaCsv(report, areaId){
    report = report || {};
    var area = null;
    arr(report.areas).some(function(item){if(item.id === areaId){area = item;return true;}return false;});
    if(!area){throw new Error("No se encontró el área para exportar.");}
    var lines = [["cedula","nombre","carrera","periodo","division","requisito_pendiente"].map(csvEscape).join(";")];
    arr(area.estudiantes).forEach(function(row){
      lines.push([row.cedula,row.nombre,row.carrera,row.periodo,row.division,row.requisitosTexto].map(csvEscape).join(";"));
    });
    download("coordi-" + safeName(area.area) + ".csv", lines.join("\n"), "text/csv;charset=utf-8");
  }

  function summaryText(data){
    data = data || {};
    if(data.global){
      var g = data.global || {};
      var lines = [];
      lines.push("RESUMEN COORDI");
      lines.push("Estudiantes revisados: " + fmt(g.totalEstudiantesRevisados));
      lines.push("Estudiantes con pendientes: " + fmt(g.totalEstudiantesPendientes));
      lines.push("Áreas con pendientes: " + fmt(g.totalAreasConPendientes));
      lines.push("Pendientes acumulados: " + fmt(g.totalPendientes));
      lines.push("");
      arr(data.areasConPendientes).forEach(function(area){
        lines.push(area.area + " | " + area.responsable + " | estudiantes: " + fmt(area.totalEstudiantes) + " | pendientes: " + fmt(area.totalPendientes));
      });
      return lines.join("\n");
    }
    var k = data.kpis || {};
    return ["RESUMEN DE COORDINACIÓN","Total: "+(k.total||0),"Prioridad alta: "+(k.alta||0),"Prioridad media: "+(k.media||0),"Prioridad baja: "+(k.baja||0),"Carreras: "+(k.carreras||0)].join("\n");
  }

  async function copyText(content){
    content = text(content);
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(content);
      return true;
    }
    var ta = document.createElement("textarea");
    ta.value = content;
    ta.setAttribute("readonly", "readonly");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try{ok = document.execCommand("copy");}catch(error){ok = false;}
    ta.remove();
    if(!ok){throw new Error("No se pudo copiar al portapapeles.");}
    return true;
  }

  window.CoordiExport = {
    exportJson:exportJson,
    exportAreaCsv:exportAreaCsv,
    summaryText:summaryText,
    copyText:copyText,
    download:download
  };
})(window);

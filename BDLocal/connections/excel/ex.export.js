/* =========================================================
Nombre completo: ex.export.js
Ruta: /BDLocal/connections/excel/ex.export.js
Función:
- Exportar respaldos descargables desde el navegador/Electron.
- Genera JSON y CSV compatible con Excel.
========================================================= */
(function(window, document){
  "use strict";

  function downloadText(filename, content, mime){
    var blob = new Blob([content], { type:mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ try{ URL.revokeObjectURL(url); a.remove(); }catch(error){} }, 500);
    return { ok:true, filename:filename, bytes:content.length };
  }

  function json(filename, data){
    return downloadText(filename, JSON.stringify(data || {}, null, 2), "application/json;charset=utf-8");
  }

  function flatten(value){
    if(value === null || value === undefined){ return ""; }
    if(typeof value === "object"){
      try{ return JSON.stringify(value); }catch(error){ return String(value); }
    }
    return String(value);
  }

  function csvEscape(value){
    value = flatten(value).replace(/\r?\n/g," ");
    if(/[",;\n]/.test(value)){ return '"' + value.replace(/"/g,'""') + '"'; }
    return value;
  }

  function csvFromRows(rows){
    rows = Array.isArray(rows) ? rows : [];
    var keys = [];
    rows.forEach(function(row){ Object.keys(row || {}).forEach(function(k){ if(keys.indexOf(k) < 0){ keys.push(k); } }); });
    var out = [keys.map(csvEscape).join(";")];
    rows.forEach(function(row){ out.push(keys.map(function(k){ return csvEscape(row ? row[k] : ""); }).join(";")); });
    return out.join("\n");
  }

  function csv(filename, rows){
    return downloadText(filename, "\ufeff" + csvFromRows(rows || []), "text/csv;charset=utf-8");
  }

  window.BDLExcelExport = {
    downloadText: downloadText,
    json: json,
    csv: csv,
    csvFromRows: csvFromRows
  };
})(window, document);

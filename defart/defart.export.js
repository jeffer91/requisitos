/* =========================================================
Nombre completo: defart.export.js
Ruta o ubicación: /Requisitos/defart/defart.export.js
Función o funciones:
- Descargar Excel de la tabla visible de Defensas.
- Exportar solo columnas visibles: Cédula, Nombre, Carrera, N-ART, N-DEF, N-FIN.
- Nombrar el archivo con período, fecha y hora.
- Mantener exportación compatible aunque no cargue la librería XLSX.
Con qué se conecta:
- defart.app.js
========================================================= */
(function(window){
  "use strict";

  var HEADERS = ["Cédula", "Nombre", "Carrera", "N-ART", "N-DEF", "N-FIN"];

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function safeFile(value){
    return text(value || "TODOS")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_.-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function stamp(){
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    var h = String(d.getHours()).padStart(2, "0");
    var min = String(d.getMinutes()).padStart(2, "0");
    return y + "-" + m + "-" + day + "_" + h + "-" + min;
  }

  function formatNote(value){
    if(value === null || value === undefined || value === ""){
      return "";
    }
    var num = Number(String(value).replace(",", "."));
    if(!Number.isFinite(num)){
      return "";
    }
    return Math.round(num * 100) / 100;
  }

  function rowsToVisibleExport(rows){
    return (rows || []).map(function(row){
      return {
        "Cédula":text(row._cedula),
        "Nombre":text(row._nombre),
        "Carrera":text(row._carrera),
        "N-ART":formatNote(row._nart),
        "N-DEF":formatNote(row._ndef),
        "N-FIN":formatNote(row._nfin)
      };
    });
  }

  function downloadBlob(name, content, type){
    var blob = new Blob([content], {type:type || "application/octet-stream"});
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function(){URL.revokeObjectURL(link.href);}, 1000);
  }

  function escapeHtml(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function excelHtmlFallback(rows, fileName){
    var exported = rowsToVisibleExport(rows);
    var html = '<html><head><meta charset="UTF-8"><style>' +
      'table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:11pt}' +
      'th{background:#1d4ed8;color:#ffffff;font-weight:bold;border:1px solid #94a3b8;padding:6px;text-align:left}' +
      'td{border:1px solid #cbd5e1;padding:5px;vertical-align:top}' +
      'td.num{text-align:center;mso-number-format:"0.00"}' +
      '</style></head><body><table><thead><tr>' +
      HEADERS.map(function(header){return '<th>' + escapeHtml(header) + '</th>';}).join("") +
      '</tr></thead><tbody>' +
      exported.map(function(row){
        return '<tr>' + HEADERS.map(function(header){
          var cls = header.indexOf("N-") === 0 ? ' class="num"' : '';
          return '<td' + cls + '>' + escapeHtml(row[header]) + '</td>';
        }).join("") + '</tr>';
      }).join("") +
      '</tbody></table></body></html>';
    var xlsName = fileName.replace(/\.xlsx$/i, ".xls");
    downloadBlob(xlsName, html, "application/vnd.ms-excel;charset=utf-8");
    return {ok:true, fallback:"xls-html", fileName:xlsName, rows:exported.length};
  }

  function exportExcel(rows, context){
    context = context || {};
    var period = safeFile(context.periodId || context.periodLabel || "TODOS");
    var fileName = period + "_" + stamp() + ".xlsx";
    var data = rowsToVisibleExport(rows || []);

    if(!window.XLSX || !window.XLSX.utils){
      return excelHtmlFallback(rows || [], fileName);
    }

    var worksheet = window.XLSX.utils.json_to_sheet(data, {header:HEADERS});
    worksheet["!cols"] = [{wch:16}, {wch:38}, {wch:40}, {wch:10}, {wch:10}, {wch:10}];
    worksheet["!autofilter"] = {ref:"A1:F" + Math.max(1, data.length + 1)};

    var range = window.XLSX.utils.decode_range(worksheet["!ref"] || "A1:F1");
    for(var row = 1; row <= range.e.r; row += 1){
      [3,4,5].forEach(function(col){
        var address = window.XLSX.utils.encode_cell({r:row, c:col});
        if(worksheet[address] && worksheet[address].v !== ""){
          worksheet[address].t = "n";
          worksheet[address].z = "0.00";
        }
      });
    }

    var workbook = window.XLSX.utils.book_new();
    workbook.Props = {Title:"Defensas", Subject:"Notas de defensas", Author:"Requisitos", CreatedDate:new Date()};
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Defensas");
    window.XLSX.writeFile(workbook, fileName);
    return {ok:true, fileName:fileName, rows:data.length};
  }

  window.DefartExport = {exportExcel:exportExcel, rowsToVisibleExport:rowsToVisibleExport};
})(window);

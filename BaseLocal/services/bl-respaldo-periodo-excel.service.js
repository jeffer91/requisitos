/* =========================================================
Nombre completo: bl-respaldo-periodo-excel.service.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-respaldo-periodo-excel.service.js
Función o funciones:
- Generar un respaldo Excel completo antes de borrar un período de Base Local.
- Incluir todos los campos existentes, aunque sean nuevos o no estén normalizados.
- Crear hojas de resumen, período, estudiantes, historial, diagnóstico, estructura y restauración JSON.
- Mantener fallback .xls si SheetJS/XLSX no está disponible.
Con qué se conecta:
- excel-xlsx-loader.js
- baselocal.core.js
- bl-borrar-periodo.service.js
========================================================= */
(function(window,document){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}
  function normalize(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}
  function safeFile(value){return text(value || "periodo").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "") || "periodo";}
  function stamp(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")+"_"+String(d.getHours()).padStart(2,"0")+"-"+String(d.getMinutes()).padStart(2,"0");}

  function samePeriod(a,b){
    if(!text(b)){return false;}
    try{if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){return window.BLPeriodosCanon.samePeriod(a,b);}}catch(error){}
    return normalize(a) === normalize(b);
  }

  function periodIdOf(row){row=row||{};return text(row.id || row.periodoId || row.periodo || row.label || row.periodoLabel);}
  function periodLabelOf(row){row=row||{};return text(row.label || row.periodoLabel || row.periodo || row.id || row.periodoId);}
  function studentPeriodOf(row){row=row||{};return text(row.periodoId || row.periodo || row.Periodo || row.periodoLabel || row.ultimoPeriodoId);}

  function readSnapshot(){
    if(window.BaseLocalAPI && typeof window.BaseLocalAPI.getSnapshot === "function"){return clone(window.BaseLocalAPI.getSnapshot()) || {};}
    if(window.ExcelLocalStorage && typeof window.ExcelLocalStorage.readSnapshot === "function"){return clone(window.ExcelLocalStorage.readSnapshot()) || {};}
    throw new Error("No se pudo leer la Base Local para generar el respaldo.");
  }

  function jsonValue(value){
    if(value === undefined || value === null){return "";}
    if(typeof value === "object"){
      try{return JSON.stringify(value);}catch(error){return String(value);}
    }
    return value;
  }

  function flatten(row){
    var out={};
    Object.keys(row || {}).forEach(function(key){out[key]=jsonValue(row[key]);});
    return out;
  }

  function unionHeaders(rows, preferred){
    var seen={};var headers=[];
    (preferred || []).forEach(function(header){if(!seen[header]){seen[header]=true;headers.push(header);}});
    (rows || []).forEach(function(row){Object.keys(row || {}).forEach(function(key){if(!seen[key]){seen[key]=true;headers.push(key);}});});
    return headers;
  }

  function normalizeRows(rows, preferred){
    var flat=(rows || []).map(flatten);
    var headers=unionHeaders(flat, preferred || []);
    if(!flat.length){return {headers:headers.length ? headers : ["mensaje"], rows:[{mensaje:"Sin datos"}]};}
    return {headers:headers, rows:flat.map(function(row){var out={};headers.forEach(function(header){out[header]=row[header] == null ? "" : row[header];});return out;})};
  }

  function rowsFromObject(prefix, obj){
    var rows=[];
    Object.keys(obj || {}).forEach(function(key){rows.push({seccion:prefix || "dato", campo:key, valor:jsonValue(obj[key])});});
    return rows.length ? rows : [{seccion:prefix || "dato", campo:"mensaje", valor:"Sin datos"}];
  }

  function buildFieldStructure(data){
    var rows=[];
    [{name:"periods", rows:data.periods}, {name:"students", rows:data.students}, {name:"history", rows:data.history}, {name:"diagnostics", rows:data.diagnostics}].forEach(function(section){
      var counts={};
      (section.rows || []).forEach(function(row){Object.keys(row || {}).forEach(function(key){counts[key]=(counts[key] || 0) + 1;});});
      Object.keys(counts).sort().forEach(function(key){rows.push({seccion:section.name, campo:key, apariciones:counts[key]});});
    });
    return rows.length ? rows : [{seccion:"estructura", campo:"mensaje", apariciones:"Sin campos detectados"}];
  }

  function chunkString(value, size){
    var raw=text(value);var out=[];var n=size || 25000;
    for(var i=0;i<raw.length;i+=n){out.push(raw.slice(i,i+n));}
    return out.length ? out : [""];
  }

  function buildBackup(periodId, context){
    context=context || {};
    var snapshot=clone(context.snapshot || readSnapshot()) || {};
    var periods=Array.isArray(snapshot.periods) ? snapshot.periods.filter(function(period){return samePeriod(periodIdOf(period), periodId) || samePeriod(periodLabelOf(period), periodId);}) : [];
    var students=Array.isArray(snapshot.students) ? snapshot.students.filter(function(student){return samePeriod(studentPeriodOf(student), periodId) || samePeriod(student.periodoLabel, periodId);}) : [];
    var history=Array.isArray(snapshot.history) ? snapshot.history.filter(function(row){return samePeriod(row && (row.periodoId || row.periodoLabel), periodId) || text(row && row.action) === "borrarPeriodo";}) : [];
    var diagnostics=Array.isArray(snapshot.diagnostics) ? snapshot.diagnostics : [];
    var periodLabel=text(context.periodLabel) || periodLabelOf(periods[0]) || periodId;
    var backup={
      generatedAt:now(),
      periodoId:periodId,
      periodoLabel:periodLabel,
      meta:clone(snapshot.meta || {}),
      periods:clone(periods),
      students:clone(students),
      history:clone(history),
      diagnostics:clone(diagnostics)
    };
    backup.summary=[
      {campo:"Fecha de respaldo", valor:backup.generatedAt},
      {campo:"Período ID", valor:backup.periodoId},
      {campo:"Período", valor:backup.periodoLabel},
      {campo:"Total períodos respaldados", valor:backup.periods.length},
      {campo:"Total estudiantes respaldados", valor:backup.students.length},
      {campo:"Total historial relacionado", valor:backup.history.length},
      {campo:"Total diagnósticos", valor:backup.diagnostics.length},
      {campo:"Uso", valor:"Este archivo se descarga antes de borrar el período y conserva todos los campos para restauración."}
    ];
    backup.structure=buildFieldStructure(backup);
    var restoreJson=JSON.stringify({meta:backup.meta, periods:backup.periods, students:backup.students, history:backup.history, diagnostics:backup.diagnostics, periodoId:backup.periodoId, periodoLabel:backup.periodoLabel, generatedAt:backup.generatedAt});
    backup.restoreChunks=chunkString(restoreJson, 25000).map(function(chunk,index){return {orden:index+1, tipo:"RESTORE_JSON", contenido:chunk};});
    return backup;
  }

  function downloadBlob(name, content, type){
    var blob=new Blob([content], {type:type || "application/octet-stream"});
    var link=document.createElement("a");
    link.href=URL.createObjectURL(blob);
    link.download=name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function(){URL.revokeObjectURL(link.href);}, 1200);
  }

  function escapeHtml(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}

  function htmlTable(title, normalized){
    var headers=normalized.headers || [];
    var rows=normalized.rows || [];
    return '<h2>'+escapeHtml(title)+'</h2><table><thead><tr>'+headers.map(function(header){return '<th>'+escapeHtml(header)+'</th>';}).join("")+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+headers.map(function(header){return '<td>'+escapeHtml(row[header])+'</td>';}).join("")+'</tr>';}).join("")+'</tbody></table>';
  }

  function htmlFallback(sheets, fileName){
    var html='<html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif}h1{font-size:18pt}h2{font-size:14pt;margin-top:22px}table{border-collapse:collapse;font-size:10pt;margin-bottom:18px}th{background:#1d4ed8;color:#fff;border:1px solid #94a3b8;padding:6px;text-align:left}td{border:1px solid #cbd5e1;padding:5px;vertical-align:top;mso-number-format:"\\@"}</style></head><body><h1>Respaldo de período Base Local</h1>';
    sheets.forEach(function(sheet){html+=htmlTable(sheet.name, sheet.data);});
    html+='</body></html>';
    var xlsName=fileName.replace(/\.xlsx$/i,".xls");
    downloadBlob(xlsName, html, "application/vnd.ms-excel;charset=utf-8");
    return {ok:true, fallback:"xls-html", fileName:xlsName};
  }

  async function ensureXlsx(){
    if(window.XLSX && window.XLSX.utils){return true;}
    if(window.ExcelXlsxLoader && typeof window.ExcelXlsxLoader.ensureXLSX === "function"){
      await window.ExcelXlsxLoader.ensureXLSX();
      return !!(window.XLSX && window.XLSX.utils);
    }
    return false;
  }

  async function exportar(context){
    context=context || {};
    var periodId=text(context.periodId || context.id || "");
    if(!periodId){throw new Error("Selecciona un período para respaldar.");}
    var backup=buildBackup(periodId, context);
    var fileName="respaldo_BL_"+safeFile(backup.periodoLabel || backup.periodoId)+"_"+stamp()+".xlsx";
    var sheets=[
      {name:"Resumen", data:normalizeRows(backup.summary, ["campo","valor"])},
      {name:"Periodo", data:normalizeRows(backup.periods, ["id","periodoId","label","periodoLabel","inicioMes","inicioAnio","finMes","finAnio","updatedAt"])},
      {name:"Estudiantes", data:normalizeRows(backup.students, ["cedula","numeroIdentificacion","nombres","nombrecarrera","sede","estadoMatricula","periodoId","periodoLabel"])},
      {name:"Historial", data:normalizeRows(backup.history, ["id","action","periodoId","periodoLabel","fileName","totalRows","createdAt"])},
      {name:"Diagnostico", data:normalizeRows(backup.diagnostics, ["ok","source","updatedAt","totalStudents","totalPeriods"])},
      {name:"EstructuraCampos", data:normalizeRows(backup.structure, ["seccion","campo","apariciones"])},
      {name:"RestaurarJSON", data:normalizeRows(backup.restoreChunks, ["orden","tipo","contenido"])}
    ];

    try{
      var hasXlsx=await ensureXlsx();
      if(!hasXlsx){return Object.assign(htmlFallback(sheets, fileName), {backup:backup, rows:backup.students.length});}
      var workbook=window.XLSX.utils.book_new();
      workbook.Props={Title:"Respaldo Base Local", Subject:"Período "+backup.periodoLabel, Author:"Requisitos/BaseLocal", CreatedDate:new Date()};
      sheets.forEach(function(sheet){
        var ws=window.XLSX.utils.json_to_sheet(sheet.data.rows, {header:sheet.data.headers});
        ws["!cols"]=(sheet.data.headers || []).map(function(header){return {wch:Math.min(Math.max(text(header).length + 6, 14), 42)};});
        window.XLSX.utils.book_append_sheet(workbook, ws, sheet.name.slice(0,31));
      });
      window.XLSX.writeFile(workbook, fileName);
      return {ok:true, fileName:fileName, rows:backup.students.length, backup:backup};
    }catch(error){
      var fallback=htmlFallback(sheets, fileName);
      return Object.assign(fallback, {backup:backup, rows:backup.students.length, warning:error.message || String(error)});
    }
  }

  window.BLRespaldoPeriodoExcelService={exportar:exportar, buildBackup:buildBackup};
})(window,document);

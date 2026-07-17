/* Exportación XLSX por sección y global. */
(function(window){
  "use strict";var U=window.InPVCUtils;
  function requireXLSX(){if(!window.XLSX){throw new Error("La biblioteca XLSX no está disponible.");}return window.XLSX;}
  function safeName(value,used){var base=U.text(value).replace(/[\\/?*\[\]:]/g," ").replace(/\s+/g," ").trim().slice(0,31)||"Hoja";var name=base,index=2;while(used[name]){var suffix=" "+index++;name=base.slice(0,31-suffix.length)+suffix;}used[name]=true;return name;}
  function workbook(ctx,sections){var XLSX=requireXLSX(),wb=XLSX.utils.book_new(),used=Object.create(null);sections.forEach(function(section){(section.excel||[]).forEach(function(sheet){var rows=Array.isArray(sheet.rows)?sheet.rows:[];var ws=rows.length?XLSX.utils.json_to_sheet(rows):XLSX.utils.aoa_to_sheet([["Sin registros"]]);ws['!cols']=Object.keys(rows[0]||{Dato:""}).map(function(key){var max=Math.max(key.length,10);rows.slice(0,300).forEach(function(row){max=Math.max(max,U.text(row[key]).length);});return {wch:Math.min(45,max+2)};});XLSX.utils.book_append_sheet(wb,ws,safeName((sections.length>1?section.order+" ":"")+(sheet.name||section.title),used));});});var meta=XLSX.utils.json_to_sheet([{Campo:"Período",Valor:ctx.metadata.periodoLabel},{Campo:"Código del informe",Valor:ctx.metadata.codigoInforme},{Campo:"Fecha de elaboración",Valor:ctx.metadata.fechaElaboracion},{Campo:"Generado",Valor:ctx.generatedAt}]);XLSX.utils.book_append_sheet(wb,meta,safeName("Metadatos",used));return wb;}
  function array(ctx,sections){return requireXLSX().write(workbook(ctx,sections),{bookType:"xlsx",type:"array",compression:true});}
  function filename(ctx,suffix){return U.slug('Datos_PVC_'+(ctx.metadata.periodoLabel||ctx.metadata.periodoId)+'_'+suffix)+'.xlsx';}
  function blob(ctx,sections){return new Blob([array(ctx,sections)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
  function downloadSection(ctx,section){U.download(blob(ctx,[section]),filename(ctx,section.folder));}
  function downloadGlobal(ctx,sections){sections=sections&&sections.length?sections:ctx.sections;U.download(blob(ctx,sections),filename(ctx,"Completo"));}
  window.InPVCExcel={workbook:workbook,array:array,blob:blob,filename:filename,downloadSection:downloadSection,downloadGlobal:downloadGlobal};
})(window);

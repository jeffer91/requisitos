/* =========================================================
Nombre completo: stats.export.js
Ruta o ubicación: /Requisitos/Stats/stats.export.js
Función o funciones:
- Exportar estadísticas en JSON o CSV.
Con qué se conecta:
- stats.app.js
========================================================= */
(function(window){
  "use strict";
  function text(v){return String(v==null?"":v).trim();}
  function download(name,content,type){var blob=new Blob([content],{type:type||"text/plain;charset=utf-8"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}
  function exportJson(data){download("stats-requisitos.json",JSON.stringify(data||{},null,2),"application/json;charset=utf-8");}
  function csv(data){var lines=["tipo,nombre,total,cumple,pendiente,no_cumple,avance"];(data.requisitos||[]).forEach(function(r){lines.push(["requisito",r.label,r.total,r.cumple,r.pendiente,r.no_cumple,r.avance].map(wrap).join(","));});(data.carreras||[]).forEach(function(r){lines.push(["carrera",r.key,r.total,r.cumple,r.pendiente,r.no_cumple,r.avance].map(wrap).join(","));});(data.periodos||[]).forEach(function(r){lines.push(["periodo",r.key,r.total,r.cumple,r.pendiente,r.no_cumple,r.avance].map(wrap).join(","));});return lines.join("\n");}
  function wrap(v){return '"'+text(v).replace(/"/g,'""')+'"';}
  function exportCsv(data){download("stats-requisitos.csv",csv(data||{}),"text/csv;charset=utf-8");}
  window.StatsExport={exportJson:exportJson,exportCsv:exportCsv,csv:csv};
})(window);

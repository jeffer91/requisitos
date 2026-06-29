/* =========================================================
Nombre completo: coordi.export.js
Ruta o ubicación: /Requisitos/Coordi/coordi.export.js
Función o funciones:
- Exportar o copiar información de coordinación.
Con qué se conecta:
- coordi.app.js
========================================================= */
(function(window){
  "use strict";
  function text(v){return String(v==null?"":v).trim();}
  function download(name,content,type){var blob=new Blob([content],{type:type||"text/plain;charset=utf-8"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}
  function exportJson(data){download("coordi-requisitos.json",JSON.stringify(data||{},null,2),"application/json;charset=utf-8");}
  function summaryText(data){var k=(data&&data.kpis)||{};return ["RESUMEN DE COORDINACIÓN","Total: "+(k.total||0),"Prioridad alta: "+(k.alta||0),"Prioridad media: "+(k.media||0),"Prioridad baja: "+(k.baja||0),"Carreras: "+(k.carreras||0)].join("\n");}
  async function copyText(content){if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text(content));return true;}return false;}
  window.CoordiExport={exportJson:exportJson,summaryText:summaryText,copyText:copyText,download:download};
})(window);

/* =========================================================
Nombre completo: ficha.export.js
Ruta o ubicación: /Requisitos/Ficha/ficha.export.js
Función o funciones:
- Exportar o copiar la ficha individual.
Con qué se conecta:
- ficha.app.js
========================================================= */
(function(window){
  "use strict";
  function download(name,content,type){var blob=new Blob([content],{type:type||"text/plain;charset=utf-8"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}
  function exportJson(row){download("ficha-estudiante.json",JSON.stringify(row||{},null,2),"application/json;charset=utf-8");}
  async function copyText(text){if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text||"");return true;}return false;}
  window.FichaExport={download:download,exportJson:exportJson,copyText:copyText};
})(window);

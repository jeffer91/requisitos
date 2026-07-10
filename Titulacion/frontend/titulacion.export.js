/* =========================================================
Nombre completo: titulacion.export.js
Ruta o ubicación: /Requisitos/Titulacion/frontend/titulacion.export.js
Función o funciones:
- Exportar Infor en JSON o TXT.
- Copiar texto informativo al portapapeles.
Con qué se conecta:
- titulacion.app.js
========================================================= */
(function(window){
  "use strict";
  function text(v){return String(v==null?"":v).trim();}
  function download(name,content,type){var blob=new Blob([content],{type:type||"text/plain;charset=utf-8"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}
  function exportJson(data){download("infor-titulacion.json",JSON.stringify(data||{},null,2),"application/json;charset=utf-8");}
  function exportTxt(data){download("infor-titulacion.txt",text(data&&data.text),"text/plain;charset=utf-8");}
  async function copyText(content){if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text(content));return true;}return false;}
  window.TitulacionExport={exportJson:exportJson,exportTxt:exportTxt,copyText:copyText,download:download};
})(window);

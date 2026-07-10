/* =========================================================
Nombre completo: repo.export.js
Ruta o ubicación: /Requisitos/Reportes/repo.export.js
Función o funciones:
- Exportar reportes en TXT, HTML y JSON.
- Copiar texto del reporte al portapapeles.
Con qué se conecta:
- repo.app.js
========================================================= */
(function(window){
  "use strict";
  function text(v){return String(v==null?"":v).trim();}
  function download(name,content,type){var blob=new Blob([content],{type:type||"text/plain;charset=utf-8"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}
  function exportTxt(data){download("reporte-requisitos.txt",text(data&&data.text),"text/plain;charset=utf-8");}
  function exportHtml(data){var html='<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Reporte</title><style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.5}pre{white-space:pre-wrap;background:#f8fafc;border:1px solid #ddd;padding:16px;border-radius:12px}</style></head><body>'+(data&&data.html?data.html:"<p>Sin reporte.</p>")+'</body></html>';download("reporte-requisitos.html",html,"text/html;charset=utf-8");}
  function exportJson(data){download("reporte-requisitos.json",JSON.stringify(data||{},null,2),"application/json;charset=utf-8");}
  async function copyText(content){if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text(content));return true;}return false;}
  window.RepoExport={exportTxt:exportTxt,exportHtml:exportHtml,exportJson:exportJson,copyText:copyText,download:download};
})(window);

/* =========================================================
Nombre completo: plani.export.helpers.js
Ruta o ubicacion: /Requisitos/Plani/export/shared/plani.export.helpers.js
Funcion:
- Centralizar utilidades de descarga, apertura e impresion.
- Reutilizar helpers en HTML, Word y PDF.
========================================================= */
(function(window, document){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}

  function downloadText(filename, content, mime){
    var blob = new Blob([content || ""], {type:mime || "text/plain;charset=utf-8"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = text(filename) || "plani.html";
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){URL.revokeObjectURL(url); a.remove();}, 300);
    return true;
  }

  function openPrintable(html, title){
    var win = window.open("", "_blank");
    if(!win){throw new Error("El navegador bloqueo la ventana de impresion.");}
    win.document.open();
    win.document.write(html || "");
    win.document.close();
    if(title){win.document.title = title;}
    return win;
  }

  function printHtml(html, title){
    var win = openPrintable(html, title);
    setTimeout(function(){try{win.focus(); win.print();}catch(error){console.warn(error);}}, 350);
    return true;
  }

  window.PlaniExportHelpers = {downloadText:downloadText, openPrintable:openPrintable, printHtml:printHtml};
})(window, document);

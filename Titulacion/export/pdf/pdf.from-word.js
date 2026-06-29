/* =========================================================
Nombre completo: pdf.from-word.js
Ruta o ubicación: /Requisitos/Titulacion/export/pdf/pdf.from-word.js
Función o funciones:
- Generar una vista imprimible del informe usando el mismo HTML del Word.
- Abrir diálogo de impresión para guardar como PDF.
- Mantener una sola fuente de documento para Word/PDF.
Con qué se conecta:
- export/word/word.export.js
- frontend/titulacion.app.js
========================================================= */
(function(window){
  "use strict";

  function print(report, anexosList){
    if(!report || !report.ok){throw new Error("No hay informe listo para exportar a PDF.");}
    if(!(window.InforWordExport && typeof window.InforWordExport.buildHtml === "function")){
      throw new Error("InforWordExport no está disponible.");
    }
    var html = window.InforWordExport.buildHtml(report, anexosList);
    var win = window.open("", "_blank");
    if(!win){throw new Error("El navegador bloqueó la ventana de impresión PDF.");}
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = function(){
      try{win.focus();win.print();}catch(error){console.warn("[Infor PDF]", error);}
    };
    setTimeout(function(){try{win.focus();win.print();}catch(error){}}, 900);
    return {ok:true, message:"Vista PDF abierta. Usa Guardar como PDF."};
  }

  window.InforPdfExport = {print:print};
})(window);

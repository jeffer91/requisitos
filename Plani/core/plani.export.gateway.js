/* =========================================================
Nombre completo: plani.export.gateway.js
Ruta o ubicacion: /Requisitos/Plani/core/plani.export.gateway.js
Funcion:
- Centralizar la salida de exportacion del modulo Plani.
- Exponer acciones HTML, Word y PDF desde un solo punto.
========================================================= */
(function(window){
  "use strict";

  function modelFromApp(){
    if(window.PlaniApp && typeof window.PlaniApp.getCurrentModel === "function"){
      return window.PlaniApp.getCurrentModel();
    }
    if(window.PlaniApp && typeof window.PlaniApp.getModel === "function"){
      return window.PlaniApp.getModel();
    }
    if(window.PlaniBuilder && typeof window.PlaniBuilder.buildFromState === "function"){
      return window.PlaniBuilder.buildFromState();
    }
    return null;
  }

  function requireModel(model){
    model = model || modelFromApp();
    if(!model || !model.ok){throw new Error("Primero construye el documento Plani.");}
    return model;
  }

  function html(model){return window.PlaniHtmlExport.download(requireModel(model));}
  function word(model){return window.PlaniWordExport.download(requireModel(model));}
  function pdf(model){return window.PlaniPdfExport.print(requireModel(model));}

  window.PlaniExportGateway = {modelFromApp:modelFromApp, requireModel:requireModel, html:html, word:word, pdf:pdf};
})(window);

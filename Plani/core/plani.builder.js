/* =========================================================
Nombre completo: plani.builder.js
Ruta o ubicacion: /Requisitos/Plani/core/plani.builder.js
Funcion:
- Construir el documento interno de Plani desde el estado actual.
- Unir periodo, tipo de documento, cronograma, secciones, indice y recursos.
- Dejar listo el modelo para vista previa y exportacion futura.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}

  function enrichCronograma(snapshot){
    snapshot = snapshot || {};
    if(text(snapshot.cronogramaRaw) && window.PlaniCronogramaParser){
      snapshot.cronogramaParsed = window.PlaniCronogramaParser.parse(snapshot.cronogramaRaw);
      if(window.PlaniCronogramaMapper){
        snapshot.cronogramaMapped = window.PlaniCronogramaMapper.mapRows(snapshot.cronogramaParsed, snapshot.documentType);
      }
    }
    return snapshot;
  }

  function build(snapshot){
    snapshot = enrichCronograma(snapshot || {});
    var validation = window.PlaniValidator ? window.PlaniValidator.validate(snapshot) : {ok:true,errors:[],warnings:[]};
    var sections = window.PlaniSectionBuilder ? window.PlaniSectionBuilder.build(snapshot) : [];
    var model = window.PlaniDocumentModel && window.PlaniDocumentModel.create ? window.PlaniDocumentModel.create(snapshot, sections) : {ok:false,sections:[]};
    model.validation = validation;
    model.ready = !!(validation.ok && model.ok);
    model.generatedAt = new Date().toISOString();
    return model;
  }

  function buildFromState(){
    var snapshot = window.PlaniState && window.PlaniState.getState ? window.PlaniState.getState() : {};
    return build(snapshot);
  }

  window.PlaniBuilder = {build:build, buildFromState:buildFromState, enrichCronograma:enrichCronograma};
})(window);

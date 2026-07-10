/* =========================================================
Nombre completo: plani.document-model.js
Ruta o ubicacion: /Requisitos/Plani/core/plani.document-model.js
Funcion:
- Crear el modelo documental interno de Plani.
- Unificar metadatos, portada, secciones, cronograma, recursos y diagnostico.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function safeList(value){return Array.isArray(value) ? value : [];}
  function clone(value){return JSON.parse(JSON.stringify(value == null ? null : value));}

  function metaFromState(state){
    state = state || {};
    var meta = state.documentMeta || {};
    return {
      documentType:text(state.documentType),
      title:text(meta.title || meta.fullTitle || "Planificacion de Titulacion"),
      code:text(meta.codePrefix || "UTET-RGI-PLANI-PRO-56"),
      periodId:text(state.periodId),
      periodLabel:text(state.periodLabel),
      periodType:state.periodType || null,
      generatedAt:new Date().toISOString()
    };
  }

  function cover(meta){
    return {
      title:meta.title,
      periodLabel:meta.periodLabel,
      code:meta.code
    };
  }

  function create(state, sections){
    state = state || {};
    var meta = metaFromState(state);
    var numbered = window.PlaniNumbering && window.PlaniNumbering.numberSections ? window.PlaniNumbering.numberSections(sections || []) : safeList(sections);
    return {
      ok:true,
      kind:"PLANI_DOCUMENT_MODEL",
      meta:meta,
      title:meta.title,
      code:meta.code,
      periodLabel:meta.periodLabel,
      documentType:meta.documentType,
      cover:cover(meta),
      sections:numbered,
      index:window.PlaniIndexBuilder && window.PlaniIndexBuilder.build ? window.PlaniIndexBuilder.build(numbered) : [],
      cronogramaParsed:state.cronogramaParsed || null,
      cronogramaMapped:state.cronogramaMapped || null,
      sectionAssets:clone(state.sectionAssets || {}),
      totalPages:"Y",
      diagnostics:safeList(state.diagnostics)
    };
  }

  function isReady(model){
    return !!(model && model.ok && model.sections && model.sections.length);
  }

  window.PlaniDocumentModel = {create:create, metaFromState:metaFromState, isReady:isReady};
})(window);

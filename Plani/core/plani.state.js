/* =========================================================
Nombre completo: plani.state.js
Ruta o ubicación: /Requisitos/Plani/core/plani.state.js
Función o funciones:
- Mantener el estado interno de Plani.
- Guardar y recuperar borradores por período y tipo de documento.
- Exponer acciones limpias para período, documento y cronograma.
Con qué se conecta:
- plani.constants.js
- plani.storage.js
- plani.periodo.js
- plani.tipo-documento.js
- ../frontend/plani.app.js
========================================================= */
(function(window){
  "use strict";

  var state = null;

  function constants(){return window.PlaniConstants || {};}
  function storage(){return window.PlaniStorage || null;}
  function periodo(){return window.PlaniPeriodo || null;}
  function tipo(){return window.PlaniTipoDocumento || null;}
  function text(value){return String(value == null ? "" : value).trim();}
  function clone(value){return JSON.parse(JSON.stringify(value == null ? null : value));}
  function now(){return new Date().toISOString();}

  function empty(){
    return clone(constants().EMPTY_STATE || {
      periodId:"",
      periodLabel:"",
      periodType:null,
      documentType:"",
      cronogramaRaw:"",
      cronogramaFileName:"",
      sectionAssets:{},
      previewReady:false,
      exportReady:false,
      diagnostics:[]
    });
  }

  function ensure(){
    if(!state){state = empty();}
    return state;
  }

  function pushDiagnostic(kind, message){
    ensure();
    state.diagnostics = Array.isArray(state.diagnostics) ? state.diagnostics : [];
    state.diagnostics.unshift({kind:kind, message:text(message), at:now()});
    state.diagnostics = state.diagnostics.slice(0, 50);
  }

  function compute(){
    ensure();
    state.previewReady = !!(text(state.documentType) || text(state.cronogramaRaw));
    state.exportReady = false;
    if(tipo()){
      state.documentMeta = tipo().metadata(state.documentType, state.periodLabel || state.periodId);
      state.compatibility = tipo().compatible(state.documentType, state.periodType);
    }
    return state;
  }

  function save(){
    compute();
    if(storage()){
      storage().writeDraft(state.periodId || state.periodLabel, state.documentType || "SIN_DOCUMENTO", state);
    }
    return getState();
  }

  function init(){
    state = empty();
    pushDiagnostic("init", "Estado inicial de Plani cargado.");
    compute();
    return getState();
  }

  function loadDraft(periodId, documentType){
    var saved = storage() ? storage().readDraft(periodId, documentType) : null;
    if(saved){
      state = Object.assign(empty(), saved);
      pushDiagnostic("draft", "Borrador recuperado.");
    }else{
      state = Object.assign(empty(), {periodId:text(periodId), documentType:text(documentType)});
      pushDiagnostic("draft", "Sin borrador previo para esta combinación.");
    }
    compute();
    return getState();
  }

  function setPeriod(periodId, periodLabel){
    ensure();
    var item = periodo() ? periodo().normalizePeriod({id:periodId, label:periodLabel || periodId}) : {id:text(periodId), label:text(periodLabel || periodId), type:null};
    state.periodId = text(item.id);
    state.periodLabel = text(item.label);
    state.periodType = item.type || null;
    if(!state.documentType && tipo()){
      state.documentType = tipo().suggestedForPeriod(state.periodType) || "";
    }
    pushDiagnostic("periodo", "Período actualizado.");
    return save();
  }

  function setDocumentType(documentType){
    ensure();
    state.documentType = text(documentType).toUpperCase();
    pushDiagnostic("documento", "Tipo de documento actualizado.");
    return save();
  }

  function setCronograma(raw, fileName){
    ensure();
    state.cronogramaRaw = text(raw);
    if(fileName !== undefined){state.cronogramaFileName = text(fileName);}
    pushDiagnostic("cronograma", "Cronograma actualizado.");
    return save();
  }

  function setSectionAssets(sectionId, assets){
    ensure();
    state.sectionAssets = state.sectionAssets || {};
    state.sectionAssets[text(sectionId)] = Array.isArray(assets) ? assets.slice() : [];
    pushDiagnostic("assets", "Recursos actualizados para sección " + text(sectionId) + ".");
    return save();
  }

  function getState(){
    compute();
    return clone(state);
  }

  window.PlaniState = {
    init:init,
    loadDraft:loadDraft,
    save:save,
    getState:getState,
    setPeriod:setPeriod,
    setDocumentType:setDocumentType,
    setCronograma:setCronograma,
    setSectionAssets:setSectionAssets,
    pushDiagnostic:pushDiagnostic
  };
})(window);

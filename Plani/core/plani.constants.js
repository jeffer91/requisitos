/* =========================================================
Nombre completo: plani.constants.js
Ruta o ubicación: /Requisitos/Plani/core/plani.constants.js
Función o funciones:
- Definir constantes iniciales del módulo Plani.
- Centralizar tipos de documento, pasos visuales, claves locales y límites base.
- Evitar textos mágicos dispersos en la pantalla inicial.
Con qué se conecta:
- ../frontend/plani.html
- ../frontend/plani.app.js
- ../frontend/plani.ui.js
- ../frontend/plani.events.js
========================================================= */
(function(window){
  "use strict";

  var MODULE = {
    id: "plani",
    name: "Plani",
    title: "Plani · Planificación de Titulación",
    unit: "Unidad de Titulación y Eficiencia Terminal",
    version: "0.1.0",
    block: "Bloque 1 - Base del módulo y pantalla inicial"
  };

  var STORAGE_KEYS = {
    root: "requisitos.plani.v1",
    draft: "requisitos.plani.draft.v1"
  };

  var DOCUMENT_TYPES = [
    {
      id: "COMPLEXIVO",
      label: "Examen Complexivo",
      title: "Planificación de Examen Complexivo",
      codePrefix: "UTET-RGI1-01-PRO-56",
      description: "Documento institucional para planificar el proceso de Examen Complexivo.",
      expectedPeriodType: "REGULAR"
    },
    {
      id: "ARTICULO",
      label: "Artículo Académico",
      title: "Planificación de Artículo Académico",
      codePrefix: "UTET-RGI3-01-PRO-56",
      description: "Documento institucional para planificar el proceso de Artículo Académico.",
      expectedPeriodType: "PVC"
    },
    {
      id: "TRABAJO",
      label: "Trabajo de Titulación",
      title: "Planificación de Trabajo de Titulación",
      codePrefix: "UGPA-RGI2-01-PRO-56",
      description: "Documento institucional para planificar el proceso de Trabajo de Titulación.",
      expectedPeriodType: "REGULAR"
    }
  ];

  var FLOW_STEPS = [
    {id:"periodo", label:"Período", help:"Seleccionar período institucional"},
    {id:"insumos", label:"Insumos", help:"Cronograma y recursos"},
    {id:"documento", label:"Documento", help:"Vista previa y exportación"}
  ];

  var EMPTY_STATE = {
    periodId: "",
    periodLabel: "",
    periodType: null,
    documentType: "",
    cronogramaRaw: "",
    cronogramaFileName: "",
    sectionAssets: {},
    previewReady: false,
    exportReady: false,
    diagnostics: []
  };

  var LIMITS = {
    cronogramaPreviewRows: 12,
    maxAssetsPerSection: 12,
    maxAssetSizeMB: 8
  };

  function clone(value){
    return JSON.parse(JSON.stringify(value == null ? null : value));
  }

  function documentTypeById(id){
    id = String(id == null ? "" : id).trim().toUpperCase();
    return DOCUMENT_TYPES.find(function(item){return item.id === id;}) || null;
  }

  window.PlaniConstants = {
    MODULE: MODULE,
    STORAGE_KEYS: STORAGE_KEYS,
    DOCUMENT_TYPES: DOCUMENT_TYPES,
    FLOW_STEPS: FLOW_STEPS,
    EMPTY_STATE: EMPTY_STATE,
    LIMITS: LIMITS,
    clone: clone,
    documentTypeById: documentTypeById
  };
})(window);

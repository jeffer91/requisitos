/* =========================================================
Nombre completo: plani.validator.js
Ruta o ubicación: /Requisitos/Plani/core/plani.validator.js
Función o funciones:
- Validar estado mínimo de Plani antes de preparar documento.
- Separar advertencias de errores para diagnóstico claro.
- Preparar la base de validación para bloques de motor y exportación.
Con qué se conecta:
- plani.state.js
- plani.tipo-documento.js
- ../frontend/plani.app.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}

  function validate(state){
    state = state || {};
    var errors = [];
    var warnings = [];
    var info = [];

    if(!text(state.periodId || state.periodLabel)){
      warnings.push({field:"periodo", message:"Selecciona un período para que el documento salga con encabezado correcto."});
    }else{
      info.push({field:"periodo", message:"Período seleccionado."});
    }

    if(!text(state.documentType)){
      errors.push({field:"documentType", message:"Selecciona el tipo de planificación."});
    }else{
      info.push({field:"documentType", message:"Tipo de planificación seleccionado."});
    }

    if(!text(state.cronogramaRaw)){
      errors.push({field:"cronograma", message:"Carga o pega el cronograma."});
    }else{
      info.push({field:"cronograma", message:"Cronograma registrado."});
    }

    if(state.compatibility && state.compatibility.ok === false){
      warnings.push({field:"compatibility", message:state.compatibility.message || "Revisa compatibilidad entre período y documento."});
    }

    return {
      ok:errors.length === 0,
      errors:errors,
      warnings:warnings,
      info:info,
      message:errors.length ? errors.map(function(x){return x.message;}).join(" ") : "Validación base correcta."
    };
  }

  function canPrepare(state){
    return validate(state).ok;
  }

  window.PlaniValidator = {
    validate:validate,
    canPrepare:canPrepare
  };
})(window);

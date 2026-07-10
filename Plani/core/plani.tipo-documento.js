/* =========================================================
Nombre completo: plani.tipo-documento.js
Ruta o ubicación: /Requisitos/Plani/core/plani.tipo-documento.js
Función o funciones:
- Centralizar reglas de tipos de planificación.
- Determinar compatibilidad entre período y documento.
- Preparar metadatos institucionales base para encabezado y portada.
Con qué se conecta:
- plani.constants.js
- plani.periodo.js
- plani.state.js
- ../frontend/plani.app.js
========================================================= */
(function(window){
  "use strict";

  function constants(){return window.PlaniConstants || {};}
  function text(value){return String(value == null ? "" : value).trim();}

  function all(){
    return (constants().DOCUMENT_TYPES || []).slice();
  }

  function byId(id){
    id = text(id).toUpperCase();
    if(constants().documentTypeById){return constants().documentTypeById(id);}
    return all().find(function(item){return item.id === id;}) || null;
  }

  function compatible(documentType, periodType){
    var doc = byId(documentType);
    var typeId = text(periodType && periodType.id).toUpperCase();
    if(!doc){return {ok:false, level:"warn", message:"Selecciona un tipo de planificación."};}
    if(!typeId){return {ok:true, level:"warn", message:"Selecciona un período para validar compatibilidad."};}
    if(!doc.expectedPeriodType){return {ok:true, level:"ok", message:"Tipo compatible."};}
    if(doc.expectedPeriodType === typeId){return {ok:true, level:"ok", message:"Tipo compatible con el período."};}
    return {ok:false, level:"warn", message:"El tipo seleccionado no coincide con el período detectado."};
  }

  function suggestedForPeriod(periodType){
    var typeId = text(periodType && periodType.id).toUpperCase();
    if(typeId === "PVC"){return "ARTICULO";}
    if(typeId === "REGULAR"){return "COMPLEXIVO";}
    return "";
  }

  function metadata(documentType, periodLabel){
    var doc = byId(documentType) || {};
    var period = text(periodLabel);
    return {
      id:doc.id || "",
      label:doc.label || "",
      title:doc.title || "",
      codePrefix:doc.codePrefix || "",
      periodLabel:period,
      fullTitle:(doc.title || "Planificación de Titulación") + (period ? " " + period : ""),
      description:doc.description || ""
    };
  }

  window.PlaniTipoDocumento = {
    all:all,
    byId:byId,
    compatible:compatible,
    suggestedForPeriod:suggestedForPeriod,
    metadata:metadata
  };
})(window);

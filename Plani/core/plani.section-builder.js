/* =========================================================
Nombre completo: plani.section-builder.js
Ruta o ubicacion: /Requisitos/Plani/core/plani.section-builder.js
Funcion:
- Construir secciones base del documento Plani.
- Usar plantillas especificas cuando existan por tipo de documento.
- Insertar cronograma, resumen de actividades y recursos logicos.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function safeList(value){return Array.isArray(value) ? value : [];}

  function cronogramaTableBlock(mapped){
    var headers = window.PlaniCronogramaMapper && window.PlaniCronogramaMapper.tableHeaders ? window.PlaniCronogramaMapper.tableHeaders() : [
      {key:"fecha",label:"Fecha"},{key:"actividad",label:"Actividad"},{key:"responsable",label:"Responsable"},{key:"observacion",label:"Observacion"}
    ];
    return {type:"table", headers:headers, rows:safeList(mapped && mapped.rows), options:{caption:"Cronograma de actividades", source:"Cronograma cargado en Plani"}};
  }

  function summaryTableBlock(mapped){
    return {type:"table", headers:[{key:"tipo",label:"Tipo de actividad"},{key:"total",label:"Total"}], rows:safeList(mapped && mapped.summary), options:{caption:"Resumen de actividades detectadas", source:"Clasificacion automatica Plani"}};
  }

  function genericBuild(snapshot){
    snapshot = snapshot || {};
    var mapped = snapshot.cronogramaMapped || null;
    var title = snapshot.documentMeta && snapshot.documentMeta.title ? snapshot.documentMeta.title : "Planificacion de Titulacion";
    return [
      {id:"introduccion", title:"Introduccion", content:"El presente documento organiza la planificacion institucional del proceso de titulacion seleccionado. Su finalidad es establecer una ruta ordenada, verificable y coherente con el periodo academico definido."},
      {id:"metodologia-operativa", title:"Metodologia Operativa", content:"La planificacion se estructura a partir del periodo academico, el tipo de documento, el cronograma cargado y los recursos por seccion. Cada actividad se organiza para facilitar seguimiento, control y evidencia documental."},
      {id:"cronograma", title:"Cronograma de Actividades", content:"A continuacion se presenta el cronograma base interpretado por Plani para el documento " + title + ".", blocks:[cronogramaTableBlock(mapped), summaryTableBlock(mapped)]},
      {id:"recursos-por-seccion", title:"Recursos por Seccion", content:"Los recursos del documento se organizan por seccion para mantener imagenes, graficos, tablas y archivos asociados sin mezclar insumos de diferentes apartados."}
    ];
  }

  function build(snapshot){
    snapshot = snapshot || {};
    var type = text(snapshot.documentType).toUpperCase();
    if(type === "COMPLEXIVO" && window.PlaniComplexivoSections && typeof window.PlaniComplexivoSections.build === "function"){
      return window.PlaniComplexivoSections.build(snapshot);
    }
    if(type === "ARTICULO" && window.PlaniArticuloSections && typeof window.PlaniArticuloSections.build === "function"){
      return window.PlaniArticuloSections.build(snapshot);
    }
    return genericBuild(snapshot);
  }

  window.PlaniSectionBuilder = {build:build, genericBuild:genericBuild, cronogramaTableBlock:cronogramaTableBlock, summaryTableBlock:summaryTableBlock};
})(window);

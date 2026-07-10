/* =========================================================
Nombre completo: plani.diagnostics.js
Ruta o ubicación: /Requisitos/Plani/core/plani.diagnostics.js
Función o funciones:
- Construir un diagnóstico técnico legible del módulo Plani.
- Revisar módulos cargados, estado actual, validación base, cronograma, recursos, motor documental, exportación y plantillas específicas.
- Servir como apoyo para detectar errores en bloques posteriores.
========================================================= */
(function(window){
  "use strict";

  var MODULES = [
    {name:"PlaniConstants", value:"PlaniConstants", required:true},
    {name:"PlaniStorage", value:"PlaniStorage", required:true},
    {name:"PlaniPeriodo", value:"PlaniPeriodo", required:true},
    {name:"PlaniTipoDocumento", value:"PlaniTipoDocumento", required:true},
    {name:"PlaniState", value:"PlaniState", required:true},
    {name:"PlaniValidator", value:"PlaniValidator", required:true},
    {name:"PlaniCronogramaParser", value:"PlaniCronogramaParser", required:true},
    {name:"PlaniCronogramaMapper", value:"PlaniCronogramaMapper", required:true},
    {name:"PlaniAssets", value:"PlaniAssets", required:true},
    {name:"PlaniSectionAssets", value:"PlaniSectionAssets", required:true},
    {name:"PlaniImages", value:"PlaniImages", required:true},
    {name:"PlaniCharts", value:"PlaniCharts", required:true},
    {name:"PlaniNumbering", value:"PlaniNumbering", required:true},
    {name:"PlaniIndexBuilder", value:"PlaniIndexBuilder", required:true},
    {name:"PlaniComplexivoConfig", value:"PlaniComplexivoConfig", required:false},
    {name:"PlaniComplexivoContent", value:"PlaniComplexivoContent", required:false},
    {name:"PlaniComplexivoRules", value:"PlaniComplexivoRules", required:false},
    {name:"PlaniComplexivoTables", value:"PlaniComplexivoTables", required:false},
    {name:"PlaniComplexivoCharts", value:"PlaniComplexivoCharts", required:false},
    {name:"PlaniComplexivoAssetsConfig", value:"PlaniComplexivoAssetsConfig", required:false},
    {name:"PlaniComplexivoSections", value:"PlaniComplexivoSections", required:false},
    {name:"PlaniArticuloConfig", value:"PlaniArticuloConfig", required:false},
    {name:"PlaniArticuloContent", value:"PlaniArticuloContent", required:false},
    {name:"PlaniArticuloRules", value:"PlaniArticuloRules", required:false},
    {name:"PlaniArticuloTables", value:"PlaniArticuloTables", required:false},
    {name:"PlaniArticuloCharts", value:"PlaniArticuloCharts", required:false},
    {name:"PlaniArticuloAssetsConfig", value:"PlaniArticuloAssetsConfig", required:false},
    {name:"PlaniArticuloSections", value:"PlaniArticuloSections", required:false},
    {name:"PlaniSectionBuilder", value:"PlaniSectionBuilder", required:true},
    {name:"PlaniDocumentModel", value:"PlaniDocumentModel", required:true},
    {name:"PlaniBuilder", value:"PlaniBuilder", required:true},
    {name:"PlaniPreview", value:"PlaniPreview", required:true},
    {name:"PlaniExportFilename", value:"PlaniExportFilename", required:true},
    {name:"PlaniExportHelpers", value:"PlaniExportHelpers", required:true},
    {name:"PlaniExportStyles", value:"PlaniExportStyles", required:true},
    {name:"PlaniHtmlExport", value:"PlaniHtmlExport", required:true},
    {name:"PlaniWordExport", value:"PlaniWordExport", required:true},
    {name:"PlaniPdfExport", value:"PlaniPdfExport", required:true},
    {name:"PlaniExportGateway", value:"PlaniExportGateway", required:true},
    {name:"PlaniUI", value:"PlaniUI", required:true},
    {name:"PlaniEvents", value:"PlaniEvents", required:true},
    {name:"PlaniAssetsUI", value:"PlaniAssetsUI", required:true},
    {name:"PlaniPreviewUI", value:"PlaniPreviewUI", required:true}
  ];

  function moduleChecks(){
    return MODULES.map(function(item){
      var ok = !!window[item.value];
      return {type:ok ? "ok" : (item.required ? "error" : "warn"), label:item.name, message:ok ? "Disponible" : "No cargado"};
    });
  }

  function stateChecks(state){
    state = state || {};
    var validation = window.PlaniValidator && window.PlaniValidator.validate ? window.PlaniValidator.validate(state) : {errors:[],warnings:[],info:[]};
    var checks = [];
    (validation.info || []).forEach(function(item){checks.push({type:"ok", label:item.field, message:item.message});});
    (validation.warnings || []).forEach(function(item){checks.push({type:"warn", label:item.field, message:item.message});});
    (validation.errors || []).forEach(function(item){checks.push({type:"error", label:item.field, message:item.message});});
    if(state.cronogramaParsed){checks.push({type:state.cronogramaParsed.ok ? "ok" : "warn", label:"cronogramaParsed", message:"Filas detectadas: " + (state.cronogramaParsed.total || 0)});}
    if(state.sectionAssets && window.PlaniSectionAssets){checks.push({type:"ok", label:"sectionAssets", message:"Secciones con recursos: " + window.PlaniSectionAssets.summary(state.sectionAssets).length});}
    if(window.PlaniBuilder){checks.push({type:"ok", label:"builder", message:"Motor documental disponible."});}
    if(window.PlaniExportGateway){checks.push({type:"ok", label:"export", message:"Exportación HTML, Word y PDF disponible."});}
    if(state.documentType === "COMPLEXIVO" && window.PlaniComplexivoRules){
      var cx = window.PlaniComplexivoRules.validate(state);
      (cx.warnings || []).forEach(function(message){checks.push({type:"warn", label:"complexivo", message:message});});
      if(!cx.warnings || !cx.warnings.length){checks.push({type:"ok", label:"complexivo", message:"Plantilla Complexivo disponible."});}
    }
    if(state.documentType === "ARTICULO" && window.PlaniArticuloRules){
      var ar = window.PlaniArticuloRules.validate(state);
      (ar.warnings || []).forEach(function(message){checks.push({type:"warn", label:"articulo", message:message});});
      if(!ar.warnings || !ar.warnings.length){checks.push({type:"ok", label:"articulo", message:"Plantilla Articulo Academico disponible."});}
    }
    return checks;
  }

  function run(state){
    var checks = moduleChecks().concat(stateChecks(state));
    var errors = checks.filter(function(x){return x.type === "error";}).length;
    var warnings = checks.filter(function(x){return x.type === "warn";}).length;
    return {ok:errors === 0, errors:errors, warnings:warnings, checks:checks, generatedAt:new Date().toISOString()};
  }

  window.PlaniDiagnostics = {run:run, moduleChecks:moduleChecks, stateChecks:stateChecks};
})(window);

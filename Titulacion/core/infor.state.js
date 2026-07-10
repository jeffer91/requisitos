/* =========================================================
Nombre completo: infor.state.js
Ruta o ubicación: /Requisitos/Titulacion/core/infor.state.js
Función o funciones:
- Mantener el estado interno del nuevo módulo Infor.
- Guardar configuración mínima por período en almacenamiento local.
- Guardar análisis del Excel, unión Excel/BaseLocal y cronogramas.
- Guardar estructura del informe, análisis Gemini y estado del motor.
- Guardar la clave de Gemini en BaseLocal local de Infor.
Con qué se conecta:
- core/infor.periodo.js
- core/infor.excel.js
- core/infor.match.js
- core/infor.report.js
- core/infor.gemini.js
- sections/cronograma/cronograma.parser.js
- frontend/titulacion.app.js
========================================================= */
(function(window){
  "use strict";

  var STORAGE_KEY = "requisitos.infor.v1";
  var GEMINI_KEY = "requisitos.infor.gemini.key";
  var emptyParsed = {complexivo:null, trabajoTitulacion:null, pvc:null};

  var state = {
    periodId:"",
    periodLabel:"",
    periodType:null,
    excel:{fileName:"",sheetCount:0,ignoredSheets:0,usefulSheets:0,totalRows:0,loaded:false},
    excelData:{sheets:[],rows:[],generatedAt:null},
    matchResult:null,
    reportDraft:null,
    geminiAnalysis:null,
    reportStatus:{ready:false,message:""},
    cronogramas:{complexivo:"",trabajoTitulacion:"",pvc:""},
    cronogramasParsed:Object.assign({}, emptyParsed),
    anexos:[],
    gemini:{hasKey:false},
    lastProcess:null,
    diagnostics:[]
  };

  function text(value){return String(value == null ? "" : value).trim();}
  function clone(value){return JSON.parse(JSON.stringify(value == null ? null : value));}
  function now(){return new Date().toISOString();}
  function safeParse(raw, fallback){try{return raw ? JSON.parse(raw) : fallback;}catch(error){return fallback;}}
  function loadRoot(){return safeParse(localStorage.getItem(STORAGE_KEY), {periods:{}, updatedAt:null});}
  function saveRoot(root){root.updatedAt = now();localStorage.setItem(STORAGE_KEY, JSON.stringify(root));return root;}
  function emptyExcel(){return {fileName:"",sheetCount:0,ignoredSheets:0,usefulSheets:0,totalRows:0,loaded:false};}
  function emptyExcelData(){return {sheets:[],rows:[],generatedAt:null};}

  function defaultPeriodData(){return {excel:emptyExcel(),excelData:emptyExcelData(),matchResult:null,reportDraft:null,geminiAnalysis:null,reportStatus:{ready:false,message:""},cronogramas:{complexivo:"",trabajoTitulacion:"",pvc:""},cronogramasParsed:Object.assign({}, emptyParsed),anexos:[],lastProcess:null,updatedAt:null};}
  function periodKey(periodId, periodLabel){return text(periodId || periodLabel || "SIN_PERIODO");}
  function emptyPeriodType(){return {id:"", label:"Sin período", isRegular:false, isPVC:false, pattern:"SIN_PERIODO", raw:""};}

  function classifyPeriod(value){
    var raw = text(value);if(!raw){return emptyPeriodType();}
    if(window.InforPeriodo && typeof window.InforPeriodo.classify === "function"){return window.InforPeriodo.classify(raw);}
    if(window.StatsRules && typeof window.StatsRules.classifyPeriod === "function"){return window.StatsRules.classifyPeriod(raw);}
    var source = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    var regular = (source.indexOf("octubre") >= 0 && source.indexOf("marzo") >= 0) || (source.indexOf("abril") >= 0 && source.indexOf("septiembre") >= 0);
    return {id:regular ? "REGULAR" : "PVC", label:regular ? "Regular" : "PVC", isRegular:regular, isPVC:!regular, pattern:regular ? "REGULAR" : "PVC", raw:raw};
  }

  function refreshGeminiFlag(){state.gemini.hasKey = !!text(localStorage.getItem(GEMINI_KEY));return state.gemini.hasKey;}
  function setGeminiKey(key){key = text(key);if(!key){localStorage.removeItem(GEMINI_KEY);}else{localStorage.setItem(GEMINI_KEY, key);}refreshGeminiFlag();return state.gemini.hasKey;}
  function getGeminiKey(){return text(localStorage.getItem(GEMINI_KEY));}

  function loadPeriod(periodId, periodLabel){
    var key = periodKey(periodId, periodLabel);
    var root = loadRoot();
    var saved = Object.assign(defaultPeriodData(), root.periods[key] || {});
    state.periodId = text(periodId);
    state.periodLabel = text(periodLabel || periodId || "");
    state.periodType = classifyPeriod(state.periodLabel || state.periodId);
    state.excel = Object.assign(emptyExcel(), saved.excel || {});
    state.excelData = Object.assign(emptyExcelData(), saved.excelData || {});
    state.matchResult = saved.matchResult || null;
    state.reportDraft = saved.reportDraft || null;
    state.geminiAnalysis = saved.geminiAnalysis || null;
    state.reportStatus = Object.assign({ready:false,message:""}, saved.reportStatus || {});
    state.cronogramas = Object.assign({complexivo:"",trabajoTitulacion:"",pvc:""}, saved.cronogramas || {});
    state.cronogramasParsed = Object.assign({}, emptyParsed, saved.cronogramasParsed || {});
    state.anexos = Array.isArray(saved.anexos) ? saved.anexos.slice() : [];
    state.lastProcess = saved.lastProcess || null;
    refreshGeminiFlag();pushDiagnostic("periodo", "Período cargado en Infor.");return getState();
  }

  function savePeriod(){
    var key = periodKey(state.periodId, state.periodLabel);
    var root = loadRoot();root.periods = root.periods || {};
    root.periods[key] = {periodId:state.periodId,periodLabel:state.periodLabel,periodType:state.periodType,excel:clone(state.excel),excelData:clone(state.excelData),matchResult:clone(state.matchResult),reportDraft:clone(state.reportDraft),geminiAnalysis:clone(state.geminiAnalysis),reportStatus:clone(state.reportStatus),cronogramas:clone(state.cronogramas),cronogramasParsed:clone(state.cronogramasParsed),anexos:clone(state.anexos),lastProcess:clone(state.lastProcess),updatedAt:now()};
    saveRoot(root);return getState();
  }

  function setExcelInfo(info){state.excel = Object.assign(emptyExcel(), info || {});state.matchResult = null;state.reportDraft = null;state.geminiAnalysis = null;state.reportStatus = {ready:false,message:""};pushDiagnostic("excel", "Excel registrado en estado interno.");return savePeriod();}
  function setExcelAnalysis(analysis){analysis = analysis || {};state.excel = Object.assign(emptyExcel(), {fileName:analysis.fileName || "",size:analysis.size || 0,type:analysis.type || "",sheetCount:analysis.sheetCount || 0,usefulSheets:analysis.usefulSheets || 0,ignoredSheets:analysis.ignoredSheets || 0,totalRows:analysis.totalRows || 0,loaded:analysis.loaded !== false});state.excelData = {sheets:Array.isArray(analysis.sheets) ? analysis.sheets : [],rows:Array.isArray(analysis.rows) ? analysis.rows : [],generatedAt:analysis.generatedAt || now()};state.matchResult = null;state.reportDraft = null;state.geminiAnalysis = null;state.reportStatus = {ready:false,message:""};pushDiagnostic("excel", "Excel leído e interpretado desde Infor.");return savePeriod();}
  function setMatchResult(result){state.matchResult = result || null;state.reportDraft = null;state.geminiAnalysis = null;state.reportStatus = {ready:false,message:""};pushDiagnostic("match", "Unión Excel/BaseLocal actualizada.");return savePeriod();}
  function setReportDraft(report, analysis){state.reportDraft = report || null;state.geminiAnalysis = analysis || null;state.reportStatus = {ready:!!(report && report.ok),message:report && report.ok ? "Motor de informe listo." : "Motor de informe sin datos."};pushDiagnostic("report", state.reportStatus.message);return savePeriod();}
  function setReportError(message){state.reportStatus = {ready:false,message:text(message)};pushDiagnostic("report_error", text(message));return savePeriod();}
  function setCronograma(kind, value){if(!state.cronogramas){state.cronogramas = {complexivo:"",trabajoTitulacion:"",pvc:""};}state.cronogramas[kind] = text(value);pushDiagnostic("cronograma", "Cronograma actualizado: " + kind + ".");return savePeriod();}
  function setCronogramaParsed(kind, parsed){if(!state.cronogramasParsed){state.cronogramasParsed = Object.assign({}, emptyParsed);}state.cronogramasParsed[kind] = parsed || null;pushDiagnostic("cronograma_parser", "Cronograma interpretado: " + kind + ".");return savePeriod();}
  function setCronogramasParsed(parsed){state.cronogramasParsed = Object.assign({}, emptyParsed, parsed || {});pushDiagnostic("cronograma_parser", "Cronogramas interpretados y guardados.");return savePeriod();}
  function setAnexos(list){state.anexos = Array.isArray(list) ? list.slice() : [];return savePeriod();}

  function processDraft(){state.lastProcess = {at:now(),periodId:state.periodId,periodLabel:state.periodLabel,periodType:state.periodType,excel:clone(state.excel),excelData:{sheets:clone(state.excelData.sheets || []),totalRows:(state.excelData.rows || []).length},matchResult:clone(state.matchResult),reportDraft:clone(state.reportDraft),reportStatus:clone(state.reportStatus),cronogramas:clone(state.cronogramas),cronogramasParsed:clone(state.cronogramasParsed),anexosCount:state.anexos.length,readyForNextBlock:true};pushDiagnostic("procesar", "Bloque 5 guardó motor del informe y análisis Gemini.");return savePeriod();}
  function pushDiagnostic(kind, message){state.diagnostics.unshift({kind:kind, message:message, at:now()});state.diagnostics = state.diagnostics.slice(0, 30);}
  function getState(){return clone(state);}

  window.InforState = {loadPeriod:loadPeriod,savePeriod:savePeriod,getState:getState,setExcelInfo:setExcelInfo,setExcelAnalysis:setExcelAnalysis,setMatchResult:setMatchResult,setReportDraft:setReportDraft,setReportError:setReportError,setCronograma:setCronograma,setCronogramaParsed:setCronogramaParsed,setCronogramasParsed:setCronogramasParsed,setAnexos:setAnexos,processDraft:processDraft,classifyPeriod:classifyPeriod,getGeminiKey:getGeminiKey,setGeminiKey:setGeminiKey,refreshGeminiFlag:refreshGeminiFlag,pushDiagnostic:pushDiagnostic};
})(window);

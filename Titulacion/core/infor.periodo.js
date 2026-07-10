/* =========================================================
Nombre completo: infor.periodo.js
Ruta o ubicación: /Requisitos/Titulacion/core/infor.periodo.js
Función o funciones:
- Centralizar la lectura de períodos para Infor.
- Clasificar cada período como REGULAR o PVC usando StatsRules.
- Definir modalidad automática del informe según el tipo de período.
- Consultar conteo básico de estudiantes por período desde BL2 o ExcelLocalRepo.
Con qué se conecta:
- Stats/stats.rules.js
- BaseLocal2/repositories/bl2-estudiantes.repo.js
- Gestion/Excel/excel-local.repo.js
- core/infor.state.js
- frontend/titulacion.app.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g, "");}

  function periodIdOf(period){
    return text(period && (period.id || period.periodoId || period.value || period.key || period.codigo) || period);
  }

  function periodLabelOf(period){
    return text(period && (period.label || period.periodoLabel || period.nombre || period.name || period.descripcion || period.id || period.periodoId) || period);
  }

  function normalizePeriod(period){
    var id = periodIdOf(period);
    var label = periodLabelOf(period) || id;
    var type = classify(label || id);
    return {id:id,label:label,type:type,raw:period};
  }

  function uniquePeriods(list){
    var map = Object.create(null);
    (list || []).forEach(function(period){
      var item = normalizePeriod(period);
      var key = compact(item.id || item.label);
      if(!key){return;}
      if(!map[key]){map[key] = item;}
    });
    return Object.keys(map).map(function(key){return map[key];}).sort(function(a,b){return a.label.localeCompare(b.label,"es");});
  }

  function classify(value){
    var raw = text(value);
    if(!raw){return {id:"",label:"Sin período",isRegular:false,isPVC:false,pattern:"SIN_PERIODO",raw:""};}
    if(window.StatsRules && typeof window.StatsRules.classifyPeriod === "function"){
      return window.StatsRules.classifyPeriod(raw);
    }
    var source = norm(raw);
    var regular = (source.indexOf("octubre") >= 0 && source.indexOf("marzo") >= 0) || (source.indexOf("abril") >= 0 && source.indexOf("septiembre") >= 0);
    return {id:regular ? "REGULAR" : "PVC",label:regular ? "Regular" : "PVC",isRegular:regular,isPVC:!regular,pattern:regular ? "REGULAR" : "PVC",raw:raw};
  }

  function listFromBL2(){
    try{
      if(window.BL2EstudiantesRepo && typeof window.BL2EstudiantesRepo.listPeriods === "function"){
        return window.BL2EstudiantesRepo.listPeriods() || [];
      }
      if(window.BL2 && window.BL2.periodos && typeof window.BL2.periodos.listar === "function"){
        return window.BL2.periodos.listar() || [];
      }
    }catch(error){console.warn("[InforPeriodo BL2]", error);}
    return [];
  }

  function listFromExcelLocal(){
    try{
      if(window.ExcelLocalBridge && typeof window.ExcelLocalBridge.ensureReady === "function"){window.ExcelLocalBridge.ensureReady();}
      if(window.ExcelLocalRepo && typeof window.ExcelLocalRepo.listPeriods === "function"){
        return window.ExcelLocalRepo.listPeriods() || [];
      }
      if(window.ExcelLocalRepo && typeof window.ExcelLocalRepo.getSnapshot === "function"){
        return (window.ExcelLocalRepo.getSnapshot().periods || []);
      }
    }catch(error){console.warn("[InforPeriodo ExcelLocal]", error);}
    return [];
  }

  function list(){
    return uniquePeriods([].concat(listFromBL2()).concat(listFromExcelLocal()));
  }

  function samePeriod(a,b){
    if(!text(b)){return true;}
    try{
      if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){
        return window.BLPeriodosCanon.samePeriod(a,b);
      }
    }catch(error){}
    return text(a) === text(b) || compact(a) === compact(b);
  }

  function rowPeriod(row){
    row = row || {};
    return text(row._bl2Periodo || row.periodoId || row.ultimoPeriodoId || row.periodoLabel || row.periodo || row.Periodo || row.idPeriodo || row.periodId);
  }

  function countFromBL2(periodId){
    try{
      if(window.BL2EstudiantesRepo && typeof window.BL2EstudiantesRepo.buscar === "function"){
        var result = window.BL2EstudiantesRepo.buscar({periodId:periodId || "", matricula:"ACTIVO", search:"", limit:1});
        if(result && typeof result.total === "number"){
          return {source:"BL2", total:result.total, activos:result.total};
        }
      }
    }catch(error){console.warn("[InforPeriodo count BL2]", error);}
    return null;
  }

  function countFromExcelLocal(periodId){
    try{
      if(!(window.ExcelLocalRepo)){return null;}
      var rows = window.ExcelLocalRepo.listAllStudents ? window.ExcelLocalRepo.listAllStudents() : ((window.ExcelLocalRepo.getSnapshot && window.ExcelLocalRepo.getSnapshot().students) || []);
      var filtered = (rows || []).filter(function(row){return samePeriod(rowPeriod(row), periodId);});
      return {source:"ExcelLocalRepo", total:filtered.length, activos:filtered.length};
    }catch(error){console.warn("[InforPeriodo count ExcelLocal]", error);}
    return null;
  }

  function countStudents(periodId){
    return countFromBL2(periodId) || countFromExcelLocal(periodId) || {source:"Sin fuente", total:0, activos:0};
  }

  function modalitiesForType(type){
    type = type || {};
    if(type.id === "REGULAR"){
      return [
        {id:"EXAMEN_COMPLEXIVO", label:"Examen Complexivo", default:true},
        {id:"TRABAJO_TITULACION", label:"Trabajo de Titulación", default:false}
      ];
    }
    if(type.id === "PVC"){
      return [{id:"ARTICULO_ACADEMICO", label:"Artículo Académico", default:true, locked:true}];
    }
    return [];
  }

  function reportKind(type){
    type = type || {};
    if(type.id === "REGULAR"){
      return {id:"REGULAR", label:"Informe Regular", cronogramas:["complexivo","trabajoTitulacion"], secciones:["complexivo","trabajo_titulacion"]};
    }
    if(type.id === "PVC"){
      return {id:"PVC", label:"Informe PVC", cronogramas:["pvc"], secciones:["pvc"]};
    }
    return {id:"", label:"Sin período", cronogramas:[], secciones:[]};
  }

  function reportName(periodLabel){
    periodLabel = text(periodLabel);
    return periodLabel ? "Informe de Titulación " + periodLabel : "Informe de Titulación";
  }

  function summary(period){
    var item = normalizePeriod(period || {});
    var students = item.id ? countStudents(item.id) : {source:"Sin fuente", total:0, activos:0};
    return {
      id:item.id,
      label:item.label,
      type:item.type,
      students:students,
      modalities:modalitiesForType(item.type),
      reportKind:reportKind(item.type),
      reportName:reportName(item.label)
    };
  }

  window.InforPeriodo = {
    list:list,
    normalizePeriod:normalizePeriod,
    classify:classify,
    periodIdOf:periodIdOf,
    periodLabelOf:periodLabelOf,
    samePeriod:samePeriod,
    countStudents:countStudents,
    modalitiesForType:modalitiesForType,
    reportKind:reportKind,
    reportName:reportName,
    summary:summary
  };
})(window);

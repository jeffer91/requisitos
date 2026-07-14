/* =========================================================
Nombre completo: coo.report.js
Ruta o ubicación: /Requisitos/Coordi/coo.report.js
Función o funciones:
- Construir la visión global del período seleccionado.
- Detectar pendientes con las mismas reglas de estados usadas por Stats.
- Respetar requisitos aplicables para períodos PVC y Regulares.
- Filtrar por división, carrera y requisito individual.
- Agrupar estudiantes por área y preparar comunicaciones.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.2.0-stats-rules-and-applicability";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase(); }
  function compact(value){ return norm(value).replace(/[^a-z0-9]+/g,""); }
  function arr(value){ return Array.isArray(value) ? value : []; }
  function clone(value){ try{return JSON.parse(JSON.stringify(value));}catch(error){return value;} }

  function config(){ return window.COOConfig || {areas:[],global:null,helpers:{}}; }
  function data(){
    if(!window.COOData || typeof window.COOData.read !== "function"){
      throw new Error("COOData no disponible. Falta cargar coo.data.js.");
    }
    return window.COOData;
  }
  function reqEngine(){ return window.StatsRules || window.BL2RequirementsEngine || null; }
  function cfgHelper(name){ return config().helpers && config().helpers[name]; }

  function canonicalRequirementKey(value){
    try{
      if(window.COOData && window.COOData.helpers && typeof window.COOData.helpers.canonicalRequirementKey === "function"){
        return window.COOData.helpers.canonicalRequirementKey(value);
      }
    }catch(error){}
    return text(value);
  }

  function requirementLabel(key,fallback){
    key = canonicalRequirementKey(key);
    try{
      if(reqEngine() && typeof reqEngine().getRequirementByKey === "function"){
        var item = reqEngine().getRequirementByKey(key) || {};
        if(text(item.label)){ return text(item.label); }
      }
      if(window.BLCampos && typeof window.BLCampos.requirementLabel === "function"){
        return window.BLCampos.requirementLabel(key,fallback || key);
      }
    }catch(error){}
    return fallback || key;
  }

  function requirementKey(req){
    req = req || {};
    return canonicalRequirementKey(req.requisitoKey || req.requirementKey || req.key || req.campo || req.field || req.codigo || req.nombre || (typeof req.requisito === "string" ? req.requisito : ""));
  }

  function requirementValue(req){
    req = req || {};
    var keys = ["valor","value","estado","cumple","aprobado","resultado"];

    for(var i=0;i<keys.length;i+=1){
      var value = req[keys[i]];
      if(value === undefined || value === null){ continue; }
      if(value && typeof value === "object"){
        value = value.id || value.value || value.label || "";
      }
      if(typeof value === "boolean" || typeof value === "number" || text(value) !== ""){
        return value;
      }
    }

    return "";
  }

  function rawKeyInfo(row,key){
    row = row || {};
    if(!key){ return {exists:false,value:""}; }
    if(Object.prototype.hasOwnProperty.call(row,key)){
      return {exists:true,value:row[key]};
    }
    var target = compact(key);
    var keys = Object.keys(row);
    for(var i=0;i<keys.length;i+=1){
      if(compact(keys[i]) === target){ return {exists:true,value:row[keys[i]]}; }
    }
    return {exists:false,value:""};
  }

  function valueInfo(row,req){
    req = req || {};
    if(req.hasValue === true){ return {exists:true,value:req.value}; }

    var key = requirementKey(req);
    var raw = rawKeyInfo(row,key);
    try{
      if(reqEngine() && typeof reqEngine().valueOf === "function"){
        var value = reqEngine().valueOf(row || {},key);
        if(value !== undefined && value !== null && (typeof value === "boolean" || typeof value === "number" || text(value) !== "")){
          return {exists:true,value:value};
        }
      }
    }catch(error){}
    return raw;
  }

  function cellStatus(value){
    try{
      if(reqEngine() && typeof reqEngine().cellStatus === "function"){
        var engineStatus = reqEngine().cellStatus(value);
        if(text(engineStatus)){ return norm(engineStatus).replace(/\s+/g,"_"); }
      }
    }catch(error){}

    var valueNorm = norm(value);
    if(!valueNorm){ return "no_cumple"; }
    if(["cumple","si cumple","sí cumple","aprobado","aprobada","ok","completo","completa","completado","completada","si","sí","s","1","true","x","validado","validada"].indexOf(valueNorm) >= 0){
      return "cumple";
    }
    if(["no aplica","n/a","na","no corresponde"].indexOf(valueNorm) >= 0){
      return "no_aplica";
    }
    return "no_cumple";
  }

  function isPendingStatus(status){
    status = norm(status).replace(/\s+/g,"_");
    return !!status && status !== "cumple" && status !== "no_aplica";
  }

  function knownRuleKeys(){
    var map = Object.create(null);
    try{
      arr(reqEngine() && reqEngine().FILTER_REQUIREMENTS).forEach(function(item){
        var key = canonicalRequirementKey(item && (item.key || item.id || item.campo));
        if(key){ map[compact(key)] = true; }
      });
    }catch(error){}
    return map;
  }

  function requirementApplies(row,req){
    var key = requirementKey(req);
    if(!key){ return false; }

    var known = knownRuleKeys();
    if(!known[compact(key)]){
      return true;
    }

    var periodValue = text(row && (row._periodo || row.periodoLabel || row.Periodo || row.periodo || row._periodoId || row.periodoId || row.periodId));

    try{
      if(reqEngine() && typeof reqEngine().isFinalRequirement === "function" && reqEngine().isFinalRequirement(key)){
        return true;
      }
      if(reqEngine() && typeof reqEngine().appliesRequirement === "function"){
        return reqEngine().appliesRequirement(key,periodValue);
      }
      if(reqEngine() && typeof reqEngine().requirementsForStudent === "function"){
        return arr(reqEngine().requirementsForStudent(row || {})).some(function(item){
          return compact(canonicalRequirementKey(item && (item.key || item.id || item.campo))) === compact(key);
        });
      }
    }catch(error){}

    return true;
  }

  function requirementsFromRow(row){
    return arr(row && row.requisitos).map(function(req){
      var key = requirementKey(req);
      return {
        key:key,
        label:text(req.requisitoLabel || req.label || req.titulo || req.nombre || requirementLabel(key,key)),
        source:"row",
        value:requirementValue(req),
        hasValue:true
      };
    }).filter(function(req){ return !!req.key; });
  }

  function requirementsFromEngine(row){
    var list = [];
    try{
      if(reqEngine() && typeof reqEngine().requirementsForStudent === "function"){
        list = list.concat(arr(reqEngine().requirementsForStudent(row || {})));
      }
      if(reqEngine() && Array.isArray(reqEngine().FINAL_REQUIREMENTS)){
        list = list.concat(reqEngine().FINAL_REQUIREMENTS);
      }
    }catch(error){}

    return list.map(function(req){
      if(typeof req === "string"){
        return {key:canonicalRequirementKey(req),label:requirementLabel(req,req),source:"engine"};
      }
      req = req || {};
      var key = canonicalRequirementKey(req.key || req.id || req.campo || req.name);
      return {key:key,label:text(req.label || req.nombre || req.titulo || requirementLabel(key,key)),source:"engine"};
    }).filter(function(req){ return !!req.key; });
  }

  function requirementsFromConfig(){
    var list = [];
    arr(config().areas).forEach(function(area){
      var key = canonicalRequirementKey(arr(area.requisitoKeys)[0] || area.id);
      if(key){
        list.push({key:key,label:requirementLabel(key,area.area || key),areaId:area.id,source:"config"});
      }
    });
    return list;
  }

  function allKnownRequirements(row){
    var map = Object.create(null);
    var list = [];
    var engineItems = requirementsFromEngine(row);

    function add(req){
      req = req || {};
      var key = canonicalRequirementKey(req.key);
      if(!key){ return; }
      var id = compact(key);
      req.key = key;
      req.label = text(req.label || requirementLabel(key,key));

      if(map[id]){
        if(req.source === "row"){
          Object.assign(map[id],req);
        }
        return;
      }
      map[id] = Object.assign({},req);
      list.push(map[id]);
    }

    (engineItems.length ? engineItems : requirementsFromConfig()).forEach(add);
    requirementsFromRow(row).forEach(add);
    return list;
  }

  function inferAreaId(req){
    req = req || {};
    var helper = cfgHelper("areaIdForRequirement");
    var values = [requirementKey(req),req.label,requirementLabel(requirementKey(req),req.label || requirementKey(req))];
    for(var i=0;i<values.length;i+=1){
      if(typeof helper === "function"){
        var found = helper(values[i]);
        if(found){ return found; }
      }
    }
    var joined = compact(values.join(" "));
    if(joined.indexOf("academ") >= 0){ return "academico"; }
    if(joined.indexOf("document") >= 0){ return "documentacion"; }
    if(joined.indexOf("financ") >= 0 || joined.indexOf("pago") >= 0 || joined.indexOf("deuda") >= 0){ return "financiero"; }
    if(joined.indexOf("titul") >= 0 || joined.indexOf("complex") >= 0 || joined.indexOf("proyecto") >= 0){ return "titulacion"; }
    if(joined.indexOf("practic") >= 0){ return "practicas"; }
    if(joined.indexOf("vincul") >= 0){ return "vinculacion"; }
    if(joined.indexOf("graduad") >= 0){ return "seguimiento_graduados"; }
    if(joined.indexOf("ingles") >= 0 || joined.indexOf("segundalengua") >= 0 || joined.indexOf("idioma") >= 0){ return "ingles"; }
    if(joined.indexOf("actualizacion") >= 0 || joined.indexOf("datos") >= 0){ return "actualizacion_datos"; }
    return req.areaId || "";
  }

  function matchesSelectedRequirement(req,selected){
    selected = canonicalRequirementKey(selected);
    if(!selected){ return true; }
    return compact(requirementKey(req)) === compact(selected);
  }

  function mergePending(items){
    var map = Object.create(null);
    arr(items).forEach(function(item){
      var key = [item.areaId,compact(item.key || item.label)].join("|");
      if(!map[key]){ map[key] = item; }
    });
    return Object.keys(map).map(function(key){ return map[key]; });
  }

  function detectPendingForStudent(row,selectedRequirement){
    var out = [];
    allKnownRequirements(row).forEach(function(req){
      if(!matchesSelectedRequirement(req,selectedRequirement)){ return; }
      if(!requirementApplies(row,req)){ return; }
      var areaId = inferAreaId(req);
      if(!areaId){ return; }
      var info = valueInfo(row,req);
      if(req.source === "config" && !info.exists){ return; }
      var status = cellStatus(info.value);
      if(!isPendingStatus(status)){ return; }
      out.push({
        areaId:areaId,
        key:requirementKey(req),
        label:req.label || requirementLabel(requirementKey(req),requirementKey(req)),
        value:text(info.value),
        status:status
      });
    });
    return mergePending(out);
  }

  function selectedRequirementApplies(row,selectedRequirement){
    selectedRequirement = canonicalRequirementKey(selectedRequirement);
    if(!selectedRequirement){ return true; }
    return requirementApplies(row,{key:selectedRequirement,source:"filter"});
  }

  function studentKey(row){
    return compact([row && (row._periodoId || row._periodo),row && (row._cedula || row._nombres)].join("|"));
  }

  function baseAreaReport(area){
    return Object.assign({},clone(area),{
      totalEstudiantes:0,
      totalPendientes:0,
      carreras:[],
      estudiantes:[],
      requisitos:[],
      porCarrera:[],
      sinPendientes:true
    });
  }

  function addStudentToArea(report,row,pendingItems){
    var labels = arr(pendingItems).map(function(item){ return item.label; });
    report.estudiantes.push({
      cedula:row._cedula || "",
      nombre:row._nombres || "",
      carrera:row._carrera || "SIN CARRERA",
      periodo:row._periodo || row._periodoId || "",
      division:row._division || "",
      requisitos:labels,
      requisitosTexto:labels.join(", "),
      totalPendientes:pendingItems.length,
      estado:"Con pendientes",
      rawId:row._cooId || ""
    });
    report.totalEstudiantes = report.estudiantes.length;
    report.totalPendientes += pendingItems.length;
    report.sinPendientes = false;
    labels.forEach(function(label){ report.requisitos.push(label); });
  }

  function summarizeArea(report){
    var careers = Object.create(null);
    var requirements = Object.create(null);

    report.estudiantes.forEach(function(student){
      var career = student.carrera || "SIN CARRERA";
      if(!careers[career]){ careers[career] = {carrera:career,estudiantes:0,pendientes:0}; }
      careers[career].estudiantes += 1;
      careers[career].pendientes += student.totalPendientes || 0;
      arr(student.requisitos).forEach(function(label){
        if(!requirements[label]){ requirements[label] = {requisito:label,total:0}; }
        requirements[label].total += 1;
      });
    });

    report.carreras = Object.keys(careers).sort(function(a,b){ return a.localeCompare(b,"es"); });
    report.porCarrera = Object.keys(careers).map(function(key){ return careers[key]; }).sort(function(a,b){
      return b.estudiantes - a.estudiantes || a.carrera.localeCompare(b.carrera,"es");
    });
    report.requisitos = Object.keys(requirements).map(function(key){ return requirements[key]; }).sort(function(a,b){
      return b.total - a.total || a.requisito.localeCompare(b.requisito,"es");
    });
    report.estudiantes.sort(function(a,b){
      return a.nombre.localeCompare(b.nombre,"es") || a.cedula.localeCompare(b.cedula,"es");
    });
    return report;
  }

  function requirementLabelFromList(list,key){
    key = canonicalRequirementKey(key);
    var found = arr(list).filter(function(item){ return compact(canonicalRequirementKey(item.key)) === compact(key); })[0];
    return found ? found.label : requirementLabel(key,key);
  }

  function periodLabelFromList(list,periodId){
    var found = arr(list).filter(function(item){
      return text(item.id || item.value || item.periodoId || item.label) === text(periodId);
    })[0];
    return found ? text(found.label || found.periodoLabel || found.nombre || periodId) : text(periodId);
  }

  function buildReadyReports(global,areas,totalRows){
    var list = [];
    if(totalRows > 0){
      list.push({
        id:"global",
        destinatario:global.responsable,
        correo:global.correo,
        tipo:"Global",
        estado:"Listo",
        area:"Reporte global",
        totalEstudiantes:global.totalEstudiantesRevisados
      });
    }
    arr(areas).forEach(function(area){
      if(area.totalEstudiantes <= 0){ return; }
      list.push({id:area.id + "-resumen",area:area.area,destinatario:area.responsable,correo:area.correo,tipo:"Resumen",estado:"Listo",totalEstudiantes:area.totalEstudiantes});
      list.push({id:area.id + "-detalle",area:area.area,destinatario:area.responsable,correo:area.correo,tipo:"Detallado",estado:"Listo",totalEstudiantes:area.totalEstudiantes});
    });
    return list;
  }

  function buildFromRows(dataResult,options){
    options = options || {};
    dataResult = dataResult || {};
    var areas = arr(config().areas).map(baseAreaReport);
    var areaMap = Object.create(null);
    areas.forEach(function(area){ areaMap[area.id] = area; });

    var rows = arr(dataResult.rows);
    var selectedRequirement = canonicalRequirementKey(options.requirementKey || options.requisito || "");
    var uniquePendingStudents = Object.create(null);
    var totalPending = 0;
    var studentDetails = [];

    rows.forEach(function(row){
      var applies = selectedRequirementApplies(row,selectedRequirement);
      var pending = applies ? detectPendingForStudent(row,selectedRequirement) : [];
      var labels = pending.map(function(item){ return item.label; });
      var status = !applies ? "No aplica" : (pending.length ? "Con pendientes" : "Al día");

      studentDetails.push({
        cedula:row._cedula || "",
        nombre:row._nombres || "",
        carrera:row._carrera || "SIN CARRERA",
        periodo:row._periodo || row._periodoId || "",
        division:row._division || "",
        requisitos:labels,
        requisitosTexto:labels.join(", "),
        totalPendientes:pending.length,
        estado:status
      });

      if(!pending.length){ return; }
      uniquePendingStudents[studentKey(row)] = true;
      var byArea = Object.create(null);
      pending.forEach(function(item){
        if(!areaMap[item.areaId]){ return; }
        if(!byArea[item.areaId]){ byArea[item.areaId] = []; }
        byArea[item.areaId].push(item);
      });
      Object.keys(byArea).forEach(function(areaId){
        addStudentToArea(areaMap[areaId],row,byArea[areaId]);
        totalPending += byArea[areaId].length;
      });
    });

    areas = areas.map(summarizeArea);
    var areasWithPending = areas.filter(function(area){ return area.totalEstudiantes > 0; });
    var totalPendingStudents = Object.keys(uniquePendingStudents).filter(Boolean).length;
    var requirementList = arr(dataResult.requirementList);
    var periodList = arr(dataResult.periodList);
    var periodId = text(options.periodId || options.periodoId || options.periodo || "");
    var requirementLabelValue = selectedRequirement ? requirementLabelFromList(requirementList,selectedRequirement) : "";
    var periodLabelValue = periodId ? periodLabelFromList(periodList,periodId) : "";

    var global = Object.assign({},clone(config().global || {}),{
      totalEstudiantesRevisados:rows.length,
      totalEstudiantesPendientes:totalPendingStudents,
      totalEstudiantesAlDia:studentDetails.filter(function(item){ return item.estado === "Al día"; }).length,
      totalEstudiantesNoAplica:studentDetails.filter(function(item){ return item.estado === "No aplica"; }).length,
      totalAreasConPendientes:areasWithPending.length,
      totalPendientes:totalPending,
      areas:areas.map(function(area){
        return {
          id:area.id,
          area:area.area,
          responsable:area.responsable,
          correo:area.correo,
          whatsapp:area.whatsapp,
          totalEstudiantes:area.totalEstudiantes,
          totalPendientes:area.totalPendientes,
          carreras:area.carreras.length
        };
      })
    });

    studentDetails.sort(function(a,b){ return a.nombre.localeCompare(b.nombre,"es") || a.cedula.localeCompare(b.cedula,"es"); });

    return {
      version:VERSION,
      source:dataResult.source || "desconocido",
      filters:{
        periodId:periodId,
        periodLabel:periodLabelValue,
        division:text(options.division || ""),
        career:text(options.career || options.carrera || ""),
        requirementKey:selectedRequirement,
        requirementLabel:requirementLabelValue
      },
      generatedAt:new Date().toISOString(),
      periodList:periodList,
      divisionList:dataResult.divisionList || [],
      careerList:dataResult.careerList || [],
      requirementList:requirementList,
      rows:rows,
      students:studentDetails,
      global:global,
      areas:areas,
      areasConPendientes:areasWithPending,
      reportesListos:buildReadyReports(global,areasWithPending,rows.length),
      diagnostics:{
        source:dataResult.source || "desconocido",
        totalStudentsRead:rows.length,
        totalStudentsWithPending:totalPendingStudents,
        totalStudentsUpToDate:global.totalEstudiantesAlDia,
        totalStudentsNotApplicable:global.totalEstudiantesNoAplica,
        totalAreas:areas.length,
        totalAreasWithPending:areasWithPending.length,
        totalPendingItems:totalPending,
        filters:{periodId:periodId,periodLabel:periodLabelValue,division:text(options.division || ""),career:text(options.career || ""),requirementKey:selectedRequirement},
        dataDiagnostics:dataResult.diagnostics || {}
      }
    };
  }

  function build(options){
    options = options || {};
    return data().read(options).then(function(dataResult){ return buildFromRows(dataResult,options); });
  }

  function emptyReport(options){
    return buildFromRows({rows:[],periodList:[],divisionList:[],careerList:[],requirementList:[],source:"sin datos",diagnostics:{}},options || {});
  }

  window.COOReport = {
    version:VERSION,
    build:build,
    buildFromRows:buildFromRows,
    detectPendingForStudent:detectPendingForStudent,
    cellStatus:cellStatus,
    isPendingStatus:isPendingStatus,
    requirementApplies:requirementApplies,
    emptyReport:emptyReport,
    helpers:{text:text,norm:norm,compact:compact,requirementLabel:requirementLabel,inferAreaId:inferAreaId,valueInfo:valueInfo,canonicalRequirementKey:canonicalRequirementKey}
  };
})(window);

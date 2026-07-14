/* =========================================================
Nombre completo: coo.report.js
Ruta o ubicación: /Requisitos/Coordi/coo.report.js
Función o funciones:
- Construir los datos de los tres correos de Coordi.
- Calcular cumplimiento por requisito respetando aplicabilidad PVC/Regular.
- Preparar pendientes de un requisito específico por área responsable.
- Clasificar estudiantes pendientes para defensa o núcleos con la modalidad usada por Ficha.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "3.0.0-three-mail-reports";
  var FINAL_KEYS = ["aprobaciontitulacion","aprobacioncomplexivoproyecto"];

  function text(value){ return String(value == null ? "" : value).trim(); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase(); }
  function compact(value){ return norm(value).replace(/[^a-z0-9]+/g,""); }
  function arr(value){ return Array.isArray(value) ? value : []; }
  function clone(value){ try{return JSON.parse(JSON.stringify(value));}catch(error){return value;} }

  function config(){ return window.COOConfig || {areas:[],global:null,eligibility:null,specials:{},helpers:{}}; }
  function data(){
    if(!window.COOData || typeof window.COOData.read !== "function"){
      throw new Error("COOData no disponible. Falta cargar coo.data.js.");
    }
    return window.COOData;
  }
  function reqEngine(){ return window.StatsRules || window.BL2RequirementsEngine || null; }
  function cfgHelper(name){ return config().helpers && config().helpers[name]; }
  function eligibilityKey(){ return text(config().specials && config().specials.eligibilityKey) || "__pendientes_defensa_nucleos__"; }
  function eligibilityLabel(){ return text(config().specials && config().specials.eligibilityLabel) || "Pendientes para defensa o núcleos"; }
  function isEligibilityKey(value){ return text(value) === eligibilityKey(); }

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
      if(value && typeof value === "object"){ value = value.id || value.value || value.label || ""; }
      if(typeof value === "boolean" || typeof value === "number" || text(value) !== ""){ return value; }
    }
    return "";
  }

  function rawKeyInfo(row,key){
    row = row || {};
    if(!key){ return {exists:false,value:""}; }
    if(Object.prototype.hasOwnProperty.call(row,key)){ return {exists:true,value:row[key]}; }
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
    if(["cumple","si cumple","sí cumple","aprobado","aprobada","ok","completo","completa","completado","completada","si","sí","s","1","true","x","validado","validada"].indexOf(valueNorm) >= 0){ return "cumple"; }
    if(["no aplica","n/a","na","no corresponde"].indexOf(valueNorm) >= 0){ return "no_aplica"; }
    return "no_cumple";
  }

  function isPendingStatus(status){
    status = norm(status).replace(/\s+/g,"_");
    return !!status && status !== "cumple" && status !== "no_aplica";
  }

  function isFinalRequirement(key){
    key = canonicalRequirementKey(key);
    try{
      if(reqEngine() && typeof reqEngine().isFinalRequirement === "function"){
        return !!reqEngine().isFinalRequirement(key);
      }
    }catch(error){}
    return FINAL_KEYS.indexOf(compact(key)) >= 0;
  }

  function requirementApplies(row,req){
    var key = requirementKey(req);
    if(!key || isFinalRequirement(key)){ return false; }
    var periodValue = text(row && (row._periodo || row.periodoLabel || row.Periodo || row.periodo || row._periodoId || row.periodoId || row.periodId));
    try{
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

  function normalizeReq(req,source){
    if(typeof req === "string"){ return {key:canonicalRequirementKey(req),label:requirementLabel(req,req),source:source || "engine"}; }
    req = req || {};
    var key = canonicalRequirementKey(req.key || req.id || req.campo || req.name || req.requisitoKey || req.requirementKey);
    return {
      key:key,
      label:text(req.label || req.requisitoLabel || req.nombre || req.titulo || requirementLabel(key,key)),
      source:source || req.source || "engine",
      value:req.value,
      hasValue:req.hasValue === true,
      areaId:req.areaId || ""
    };
  }

  function requirementsFromRow(row){
    return arr(row && row.requisitos).map(function(req){
      var normalized = normalizeReq(req,"row");
      normalized.value = requirementValue(req);
      normalized.hasValue = true;
      return normalized;
    }).filter(function(req){ return !!req.key && !isFinalRequirement(req.key); });
  }

  function requirementsForStudent(row){
    var list = [];
    try{
      if(reqEngine() && typeof reqEngine().requirementsForStudent === "function"){
        list = arr(reqEngine().requirementsForStudent(row || {}));
      }
    }catch(error){}
    return list.map(function(req){ return normalizeReq(req,"engine"); }).filter(function(req){ return !!req.key && !isFinalRequirement(req.key); });
  }

  function requirementsFromConfig(){
    return arr(config().areas).map(function(area){
      var key = canonicalRequirementKey(arr(area.requisitoKeys)[0] || area.id);
      return {key:key,label:requirementLabel(key,area.area || key),areaId:area.id,source:"config"};
    }).filter(function(req){ return !!req.key && !isFinalRequirement(req.key); });
  }

  function mergeRequirements(lists){
    var map = Object.create(null);
    var out = [];
    arr(lists).forEach(function(list){
      arr(list).forEach(function(req){
        req = normalizeReq(req,req && req.source);
        if(!req.key || isFinalRequirement(req.key)){ return; }
        var id = compact(req.key);
        if(!map[id]){
          map[id] = req;
          out.push(map[id]);
        }else if(req.source === "row"){
          Object.assign(map[id],req);
        }
      });
    });
    return out;
  }

  function allKnownRequirements(row){
    var engine = requirementsForStudent(row);
    var rowItems = requirementsFromRow(row);
    return mergeRequirements([engine.length ? engine : requirementsFromConfig(),rowItems]);
  }

  function catalogForRows(rows){
    var base = [];
    try{
      base = arr(reqEngine() && reqEngine().BASE_REQUIREMENTS)
        .concat(arr(reqEngine() && reqEngine().REGULAR_EXTRA_REQUIREMENTS));
    }catch(error){}
    var lists = [base.map(function(req){ return normalizeReq(req,"engine"); })];
    arr(rows).forEach(function(row){ lists.push(requirementsForStudent(row)); lists.push(requirementsFromRow(row)); });
    lists.push(requirementsFromConfig());
    return mergeRequirements(lists);
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
    if(joined.indexOf("titul") >= 0){ return "titulacion"; }
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
    if(!selectedRequirement || isEligibilityKey(selectedRequirement)){ return true; }
    return requirementApplies(row,{key:selectedRequirement,source:"filter"});
  }

  function studentKey(row){
    return compact([row && (row._periodoId || row._periodo),row && (row._cedula || row._nombres)].join("|"));
  }

  function baseAreaReport(area){
    return Object.assign({},clone(area),{
      totalEstudiantes:0,totalPendientes:0,carreras:[],estudiantes:[],requisitos:[],porCarrera:[],sinPendientes:true
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
    report.estudiantes.sort(function(a,b){ return a.nombre.localeCompare(b.nombre,"es") || a.cedula.localeCompare(b.cedula,"es"); });
    return report;
  }

  function requirementLabelFromList(list,key){
    if(isEligibilityKey(key)){ return eligibilityLabel(); }
    key = canonicalRequirementKey(key);
    var found = arr(list).filter(function(item){ return compact(canonicalRequirementKey(item.key)) === compact(key); })[0];
    return found ? found.label : requirementLabel(key,key);
  }

  function periodLabelFromList(list,periodId){
    var found = arr(list).filter(function(item){ return text(item.id || item.value || item.periodoId || item.label) === text(periodId); })[0];
    return found ? text(found.label || found.periodoLabel || found.nombre || periodId) : text(periodId);
  }

  function buildCompliance(rows){
    return catalogForRows(rows).map(function(req){
      var result = {key:req.key,label:req.label,total:0,cumplen:0,noCumplen:0,porcentaje:0};
      arr(rows).forEach(function(row){
        if(!requirementApplies(row,req)){ return; }
        var status = cellStatus(valueInfo(row,req).value);
        if(status === "no_aplica"){ return; }
        result.total += 1;
        if(status === "cumple"){ result.cumplen += 1; }
        else{ result.noCumplen += 1; }
      });
      result.porcentaje = result.total ? Math.round((result.cumplen / result.total) * 1000) / 10 : 0;
      return result;
    }).filter(function(item){ return item.total > 0; });
  }

  function classifyPeriod(row){
    try{
      if(reqEngine() && typeof reqEngine().classifyStudent === "function"){
        return reqEngine().classifyStudent(row || {});
      }
    }catch(error){}
    var value = norm(row && (row._periodo || row._periodoId || row.periodoLabel || row.periodo));
    var regular = (value.indexOf("octubre") >= 0 && value.indexOf("marzo") >= 0) || (value.indexOf("abril") >= 0 && value.indexOf("septiembre") >= 0);
    return {id:regular ? "REGULAR" : "PVC",label:regular ? "Regular" : "PVC",isRegular:regular,isPVC:!regular};
  }

  function modalityInfo(row){
    row = row || {};
    var type = classifyPeriod(row);
    var raw = text(
      row._modalidadTitulacion || row.modalidadTitulacion || row.ModalidadTitulacion ||
      row.tipoTitulacion || row.TipoTitulacion || row.modalidad || row.Modalidad || ""
    );
    var normalized = norm(raw);
    var value = "";
    if(normalized.indexOf("complexivo") >= 0){ value = "EXAMEN_COMPLEXIVO"; }
    else if(normalized.indexOf("trabajo") >= 0 || normalized.indexOf("tesis") >= 0 || normalized.indexOf("titulacion") >= 0){ value = "TRABAJO_TITULACION"; }
    else if(normalized.indexOf("articulo") >= 0 || normalized.indexOf("academico") >= 0){ value = "ARTICULO_ACADEMICO"; }
    if(!value){ value = type && (type.id === "PVC" || type.isPVC) ? "ARTICULO_ACADEMICO" : "EXAMEN_COMPLEXIVO"; }
    var labels = {
      EXAMEN_COMPLEXIVO:"Examen Complexivo",
      TRABAJO_TITULACION:"Trabajo de Titulación",
      ARTICULO_ACADEMICO:"Artículo Académico"
    };
    return {
      value:value,
      label:labels[value] || value,
      destino:value === "EXAMEN_COMPLEXIVO" ? "nucleos" : "defensa",
      destinoLabel:value === "EXAMEN_COMPLEXIVO" ? "Núcleos" : "Defensa",
      periodType:type
    };
  }

  function studentApproval(row){
    try{
      if(reqEngine() && typeof reqEngine().studentApproval === "function"){
        return reqEngine().studentApproval(row || {});
      }
    }catch(error){}
    var applicable = allKnownRequirements(row).filter(function(req){ return requirementApplies(row,req); });
    var missing = applicable.filter(function(req){ return cellStatus(valueInfo(row,req).value) !== "cumple"; });
    return {approved:missing.length === 0,applicableRequirements:applicable,missingRequirements:missing,periodType:classifyPeriod(row)};
  }

  function buildEligibility(rows){
    var result = {defensa:[],nucleos:[],totalDefensa:0,totalNucleos:0,totalPendientes:0};
    arr(rows).forEach(function(row){
      var approval = studentApproval(row) || {};
      var missing = arr(approval.missingRequirements).map(function(req){
        var normalized = normalizeReq(req,"approval");
        return normalized.label || requirementLabel(normalized.key,normalized.key);
      }).filter(Boolean);
      if(!missing.length){ return; }
      var modality = modalityInfo(row);
      var item = {
        cedula:row._cedula || "",
        nombre:row._nombres || "",
        carrera:row._carrera || "SIN CARRERA",
        periodo:row._periodo || row._periodoId || "",
        division:row._division || "",
        modalidad:modality.label,
        destino:modality.destino,
        destinoLabel:modality.destinoLabel,
        requisitos:missing,
        requisitosTexto:missing.join(", "),
        totalPendientes:missing.length
      };
      result[modality.destino].push(item);
      result.totalPendientes += missing.length;
    });
    ["defensa","nucleos"].forEach(function(key){
      result[key].sort(function(a,b){ return a.nombre.localeCompare(b.nombre,"es") || a.cedula.localeCompare(b.cedula,"es"); });
    });
    result.totalDefensa = result.defensa.length;
    result.totalNucleos = result.nucleos.length;
    result.totalEstudiantes = result.totalDefensa + result.totalNucleos;
    return result;
  }

  function appendEligibilityOption(list){
    var out = arr(list).filter(function(item){ return !isFinalRequirement(item && item.key); }).map(clone);
    if(!out.some(function(item){ return isEligibilityKey(item && item.key); })){
      out.push({key:eligibilityKey(),label:eligibilityLabel(),special:true});
    }
    return out;
  }

  function buildReadyReports(global,areas,totalRows){
    var list = [];
    if(totalRows > 0){
      list.push({id:"global",destinatario:global.responsable,correo:global.correo,tipo:"General",estado:"Listo",area:"Reporte general",totalEstudiantes:global.totalEstudiantesRevisados});
    }
    arr(areas).forEach(function(area){
      if(area.totalEstudiantes <= 0){ return; }
      list.push({id:area.id + "-detalle",area:area.area,destinatario:area.responsable,correo:area.correo,tipo:"Requisito",estado:"Listo",totalEstudiantes:area.totalEstudiantes});
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
    var selectedRaw = text(options.requirementKey || options.requisito || "");
    var specialMode = isEligibilityKey(selectedRaw);
    var selectedRequirement = specialMode ? "" : canonicalRequirementKey(selectedRaw);
    var uniquePendingStudents = Object.create(null);
    var totalPending = 0;
    var studentDetails = [];

    rows.forEach(function(row){
      var applies = selectedRequirementApplies(row,selectedRequirement);
      var pending = applies ? detectPendingForStudent(row,selectedRequirement) : [];
      var labels = pending.map(function(item){ return item.label; });
      var status = !applies ? "No aplica" : (pending.length ? "Con pendientes" : "Al día");
      studentDetails.push({
        cedula:row._cedula || "",nombre:row._nombres || "",carrera:row._carrera || "SIN CARRERA",
        periodo:row._periodo || row._periodoId || "",division:row._division || "",
        requisitos:labels,requisitosTexto:labels.join(", "),totalPendientes:pending.length,estado:status
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
    var rawRequirementList = arr(dataResult.requirementList);
    var requirementList = appendEligibilityOption(rawRequirementList);
    var periodList = arr(dataResult.periodList);
    var periodId = text(options.periodId || options.periodoId || options.periodo || "");
    var requirementLabelValue = specialMode ? eligibilityLabel() : (selectedRequirement ? requirementLabelFromList(requirementList,selectedRequirement) : "");
    var periodLabelValue = periodId ? periodLabelFromList(periodList,periodId) : "";
    var compliance = buildCompliance(rows);
    var eligibility = buildEligibility(rows);
    var periodType = rows.length ? classifyPeriod(rows[0]) : (reqEngine() && typeof reqEngine().classifyPeriod === "function" ? reqEngine().classifyPeriod(periodLabelValue || periodId) : null);

    var global = Object.assign({},clone(config().global || {}),{
      totalEstudiantesRevisados:rows.length,
      totalEstudiantesPendientes:totalPendingStudents,
      totalEstudiantesAlDia:studentDetails.filter(function(item){ return item.estado === "Al día"; }).length,
      totalEstudiantesNoAplica:studentDetails.filter(function(item){ return item.estado === "No aplica"; }).length,
      totalAreasConPendientes:areasWithPending.length,
      totalPendientes:totalPending,
      cumplimiento:compliance,
      areas:areas.map(function(area){
        return {id:area.id,area:area.area,responsable:area.responsable,correo:area.correo,whatsapp:area.whatsapp,totalEstudiantes:area.totalEstudiantes,totalPendientes:area.totalPendientes,carreras:area.carreras.length};
      })
    });

    studentDetails.sort(function(a,b){ return a.nombre.localeCompare(b.nombre,"es") || a.cedula.localeCompare(b.cedula,"es"); });

    return {
      version:VERSION,
      source:dataResult.source || "desconocido",
      mode:specialMode ? "eligibility" : (selectedRequirement ? "requirement" : "general"),
      specialKeys:{eligibility:eligibilityKey()},
      filters:{
        periodId:periodId,periodLabel:periodLabelValue,division:text(options.division || ""),
        career:text(options.career || options.carrera || ""),requirementKey:specialMode ? eligibilityKey() : selectedRequirement,
        requirementLabel:requirementLabelValue
      },
      generatedAt:new Date().toISOString(),
      periodType:periodType,
      periodList:periodList,
      divisionList:dataResult.divisionList || [],
      careerList:dataResult.careerList || [],
      requirementList:requirementList,
      rows:rows,
      students:studentDetails,
      compliance:compliance,
      eligibility:eligibility,
      global:global,
      areas:areas,
      areasConPendientes:areasWithPending,
      reportesListos:buildReadyReports(global,areasWithPending,rows.length),
      diagnostics:{
        source:dataResult.source || "desconocido",totalStudentsRead:rows.length,totalStudentsWithPending:totalPendingStudents,
        totalStudentsUpToDate:global.totalEstudiantesAlDia,totalStudentsNotApplicable:global.totalEstudiantesNoAplica,
        totalAreas:areas.length,totalAreasWithPending:areasWithPending.length,totalPendingItems:totalPending,
        complianceRows:compliance.length,eligibilityStudents:eligibility.totalEstudiantes,
        filters:{periodId:periodId,periodLabel:periodLabelValue,division:text(options.division || ""),career:text(options.career || ""),requirementKey:specialMode ? eligibilityKey() : selectedRequirement},
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
    buildCompliance:buildCompliance,
    buildEligibility:buildEligibility,
    modalityInfo:modalityInfo,
    cellStatus:cellStatus,
    isPendingStatus:isPendingStatus,
    requirementApplies:requirementApplies,
    emptyReport:emptyReport,
    helpers:{text:text,norm:norm,compact:compact,requirementLabel:requirementLabel,inferAreaId:inferAreaId,valueInfo:valueInfo,canonicalRequirementKey:canonicalRequirementKey,isEligibilityKey:isEligibilityKey}
  };
})(window);

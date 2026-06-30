/* =========================================================
Nombre completo: coo.report.js
Ruta o ubicación: /Requisitos/Coordi/coo.report.js
Función o funciones:
- Construir reportes de Coordi por responsable de área.
- Detectar requisitos pendientes por estudiante.
- Agrupar pendientes por área y responsable.
- Crear resumen global para Dr. Alex León.
Con qué se conecta:
- coo.config.js
- coo.data.js
- BL2RequirementsEngine / StatsRules si están disponibles
- coo.render.js
- coo.mail.js
- coo.whatsapp.js
- coo.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-coo-report.2";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]+/g, "");}
  function arr(value){return Array.isArray(value) ? value : [];} 
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}

  function config(){return window.COOConfig || {areas:[], global:null, helpers:{}};}
  function data(){if(!window.COOData || typeof window.COOData.read !== "function"){throw new Error("COOData no disponible. Falta cargar coo.data.js.");}return window.COOData;}
  function reqEngine(){return window.BL2RequirementsEngine || window.StatsRules || null;}
  function cfgHelper(name){return config().helpers && config().helpers[name];}

  function requirementLabel(key, fallback){
    try{if(window.BLCampos && typeof window.BLCampos.requirementLabel === "function"){return window.BLCampos.requirementLabel(key, fallback || key);}}catch(error){}
    return fallback || key;
  }

  function rawKeyInfo(row, key){
    row = row || {};
    if(!key){return {exists:false, value:""};}
    if(Object.prototype.hasOwnProperty.call(row, key)){return {exists:true, value:row[key]};}
    var target = compact(key);
    var keys = Object.keys(row);
    for(var i=0;i<keys.length;i++){
      if(compact(keys[i]) === target){return {exists:true, value:row[keys[i]]};}
    }
    return {exists:false, value:""};
  }

  function valueInfo(row, key, source){
    var raw = rawKeyInfo(row, key);
    try{
      if(reqEngine() && typeof reqEngine().valueOf === "function"){
        var engineValue = reqEngine().valueOf(row || {}, key);
        if(text(engineValue) !== ""){return {exists:true, value:engineValue};}
      }
    }catch(error){}
    if(raw.exists){return raw;}
    if(source === "engine"){return {exists:true, value:""};}
    return raw;
  }

  function cellStatus(value){
    try{
      if(reqEngine() && typeof reqEngine().cellStatus === "function"){
        var status = reqEngine().cellStatus(value);
        if(text(status)){return norm(status).replace(/\s+/g,"_");}
      }
    }catch(error){}
    var v = norm(value);
    if(!v){return "sin_dato";}
    if(v === "cumple" || v === "si cumple" || v === "aprobado" || v === "aprobada" || v === "ok" || v === "completo" || v === "completado"){return "cumple";}
    if(v === "no aplica" || v === "n/a" || v === "na" || v === "no corresponde"){return "no_aplica";}
    if(v.indexOf("no cumple") >= 0 || v.indexOf("pendiente") >= 0 || v.indexOf("falta") >= 0 || v.indexOf("debe") >= 0 || v.indexOf("incompleto") >= 0){return "no_cumple";}
    return "no_cumple";
  }

  function isPendingStatus(status){
    status = norm(status).replace(/\s+/g,"_");
    return status && status !== "cumple" && status !== "no_aplica";
  }

  function requirementsFromEngine(row){
    try{
      if(reqEngine() && typeof reqEngine().requirementsForStudent === "function"){
        return arr(reqEngine().requirementsForStudent(row || {})).map(function(req){
          if(typeof req === "string"){return {key:req, label:requirementLabel(req, req), source:"engine"};}
          req = req || {};
          return {key:text(req.key || req.id || req.campo || req.name), label:text(req.label || req.nombre || req.titulo || req.key), source:"engine"};
        }).filter(function(req){return !!req.key;});
      }
    }catch(error){}
    return [];
  }

  function requirementsFromConfig(){
    var list = [];
    arr(config().areas).forEach(function(area){
      arr(area.requisitoKeys).forEach(function(key){list.push({key:key, label:requirementLabel(key, key), areaId:area.id, source:"config"});});
    });
    return list;
  }

  function allKnownRequirements(row){
    var map = Object.create(null);
    var list = [];
    function add(req){
      req = req || {};
      var key = text(req.key);
      if(!key){return;}
      var c = compact([req.source || "", key].join("|"));
      if(map[c]){return;}
      map[c] = true;
      list.push({key:key, label:text(req.label || requirementLabel(key, key)), areaId:req.areaId || "", source:req.source || "config"});
    }
    requirementsFromEngine(row).forEach(add);
    requirementsFromConfig().forEach(add);
    return list;
  }

  function inferAreaId(req){
    req = req || {};
    var helper = cfgHelper("areaIdForRequirement");
    var keys = [req.key, req.label, requirementLabel(req.key, req.label || req.key)];
    for(var i=0;i<keys.length;i++){
      if(typeof helper === "function"){
        var areaId = helper(keys[i]);
        if(areaId){return areaId;}
      }
    }
    var joined = compact(keys.join(" "));
    if(joined.indexOf("academ") >= 0){return "academico";}
    if(joined.indexOf("document") >= 0){return "documentacion";}
    if(joined.indexOf("financ") >= 0 || joined.indexOf("pago") >= 0 || joined.indexOf("deuda") >= 0){return "financiero";}
    if(joined.indexOf("titul") >= 0 || joined.indexOf("complex") >= 0 || joined.indexOf("proyecto") >= 0){return "titulacion";}
    if(joined.indexOf("practic") >= 0){return "practicas";}
    if(joined.indexOf("vincul") >= 0){return "vinculacion";}
    if(joined.indexOf("graduad") >= 0){return "seguimiento_graduados";}
    if(joined.indexOf("ingles") >= 0 || joined.indexOf("segundalengua") >= 0 || joined.indexOf("idioma") >= 0){return "ingles";}
    if(joined.indexOf("actualizacion") >= 0 || joined.indexOf("datos") >= 0){return "actualizacion_datos";}
    return req.areaId || "";
  }

  function detectPendingForStudent(row){
    var out = [];
    allKnownRequirements(row).forEach(function(req){
      var areaId = inferAreaId(req);
      if(!areaId){return;}
      var info = valueInfo(row, req.key, req.source);
      if(req.source === "config" && !info.exists){return;}
      var status = cellStatus(info.value);
      if(!isPendingStatus(status)){return;}
      out.push({areaId:areaId,key:req.key,label:req.label || requirementLabel(req.key, req.key),value:text(info.value),status:status});
    });
    return mergePending(out);
  }

  function mergePending(items){
    var map = Object.create(null);
    arr(items).forEach(function(item){
      var key = [item.areaId, compact(item.key || item.label)].join("|");
      if(!map[key]){map[key] = item;}
    });
    return Object.keys(map).map(function(key){return map[key];});
  }

  function studentKey(row){return compact([row && (row._periodoId || row._periodo), row && (row._cedula || row._nombres)].join("|"));}

  function baseAreaReport(area){
    return Object.assign({}, clone(area), {totalEstudiantes:0,totalPendientes:0,carreras:[],estudiantes:[],requisitos:[],porCarrera:[],sinPendientes:true});
  }

  function addStudentToArea(report, row, pendingItems){
    var requisitos = arr(pendingItems).map(function(item){return item.label;});
    var detalle = {cedula:row._cedula || "",nombre:row._nombres || "",carrera:row._carrera || "SIN CARRERA",periodo:row._periodo || row._periodoId || "",division:row._division || "",requisitos:requisitos,requisitosTexto:requisitos.join(", "),totalPendientes:pendingItems.length,rawId:row._cooId || ""};
    report.estudiantes.push(detalle);
    report.totalEstudiantes = report.estudiantes.length;
    report.totalPendientes += pendingItems.length;
    report.sinPendientes = false;
    pendingItems.forEach(function(item){report.requisitos.push(item.label);});
  }

  function summarizeArea(report){
    var carrerasMap = Object.create(null);
    var reqMap = Object.create(null);
    report.estudiantes.forEach(function(student){
      var carrera = student.carrera || "SIN CARRERA";
      if(!carrerasMap[carrera]){carrerasMap[carrera] = {carrera:carrera, estudiantes:0, pendientes:0};}
      carrerasMap[carrera].estudiantes += 1;
      carrerasMap[carrera].pendientes += student.totalPendientes || 0;
      arr(student.requisitos).forEach(function(label){if(!reqMap[label]){reqMap[label] = {requisito:label, total:0};}reqMap[label].total += 1;});
    });
    report.carreras = Object.keys(carrerasMap).sort(function(a,b){return a.localeCompare(b,"es");});
    report.porCarrera = Object.keys(carrerasMap).map(function(k){return carrerasMap[k];}).sort(function(a,b){return b.estudiantes-a.estudiantes || a.carrera.localeCompare(b.carrera,"es");});
    report.requisitos = Object.keys(reqMap).map(function(k){return reqMap[k];}).sort(function(a,b){return b.total-a.total || a.requisito.localeCompare(b.requisito,"es");});
    report.estudiantes.sort(function(a,b){return a.nombre.localeCompare(b.nombre,"es") || a.cedula.localeCompare(b.cedula,"es");});
    return report;
  }

  function buildFromRows(dataResult, options){
    options = options || {};
    dataResult = dataResult || {};
    var areas = arr(config().areas).map(baseAreaReport);
    var areaMap = Object.create(null);
    areas.forEach(function(area){areaMap[area.id] = area;});

    var uniquePendingStudents = Object.create(null);
    var totalPendientes = 0;
    var rows = arr(dataResult.rows);

    rows.forEach(function(row){
      var pending = detectPendingForStudent(row);
      if(!pending.length){return;}
      uniquePendingStudents[studentKey(row)] = true;
      var byArea = Object.create(null);
      pending.forEach(function(item){
        if(!areaMap[item.areaId]){return;}
        if(!byArea[item.areaId]){byArea[item.areaId] = [];}
        byArea[item.areaId].push(item);
      });
      Object.keys(byArea).forEach(function(areaId){addStudentToArea(areaMap[areaId], row, byArea[areaId]);totalPendientes += byArea[areaId].length;});
    });

    areas = areas.map(summarizeArea);
    var areasConPendientes = areas.filter(function(area){return area.totalEstudiantes > 0;});
    var global = Object.assign({}, clone(config().global || {}), {
      totalEstudiantesRevisados:rows.length,
      totalEstudiantesPendientes:Object.keys(uniquePendingStudents).filter(Boolean).length,
      totalAreasConPendientes:areasConPendientes.length,
      totalPendientes:totalPendientes,
      areas:areasConPendientes.map(function(area){return {id:area.id,area:area.area,responsable:area.responsable,correo:area.correo,whatsapp:area.whatsapp,totalEstudiantes:area.totalEstudiantes,totalPendientes:area.totalPendientes,carreras:area.carreras.length};})
    });

    return {
      version:VERSION,
      source:dataResult.source || "desconocido",
      filters:{periodId:options.periodId || options.periodoId || options.periodo || "",division:options.division || ""},
      generatedAt:new Date().toISOString(),
      periodList:dataResult.periodList || [],
      divisionList:dataResult.divisionList || [],
      rows:rows,
      global:global,
      areas:areas,
      areasConPendientes:areasConPendientes,
      reportesListos:buildReadyReports(global, areas),
      diagnostics:{source:dataResult.source || "desconocido",totalStudentsRead:rows.length,totalStudentsWithPending:global.totalEstudiantesPendientes,totalAreas:areas.length,totalAreasWithPending:areasConPendientes.length,totalPendingItems:totalPendientes,dataDiagnostics:dataResult.diagnostics || {}}
    };
  }

  function buildReadyReports(global, areas){
    var list = [];
    if(global && global.totalEstudiantesPendientes > 0){list.push({id:"global", destinatario:global.responsable, correo:global.correo, tipo:"Global", estado:"Listo", area:"Reporte global", totalEstudiantes:global.totalEstudiantesPendientes});}
    arr(areas).forEach(function(area){
      if(area.totalEstudiantes <= 0){return;}
      list.push({id:area.id + "-resumen", area:area.area, destinatario:area.responsable, correo:area.correo, tipo:"Resumen", estado:"Listo", totalEstudiantes:area.totalEstudiantes});
      list.push({id:area.id + "-detalle", area:area.area, destinatario:area.responsable, correo:area.correo, tipo:"Detallado", estado:"Listo", totalEstudiantes:area.totalEstudiantes});
    });
    return list;
  }

  function build(options){
    options = options || {};
    return data().read(options).then(function(dataResult){return buildFromRows(dataResult, options);});
  }

  function emptyReport(options){return buildFromRows({rows:[], periodList:[], divisionList:[], source:"sin datos", diagnostics:{}}, options || {});}

  window.COOReport = {
    version:VERSION,
    build:build,
    buildFromRows:buildFromRows,
    detectPendingForStudent:detectPendingForStudent,
    cellStatus:cellStatus,
    isPendingStatus:isPendingStatus,
    emptyReport:emptyReport,
    helpers:{text:text,norm:norm,compact:compact,requirementLabel:requirementLabel,inferAreaId:inferAreaId,valueInfo:valueInfo}
  };
})(window);

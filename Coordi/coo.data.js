/* =========================================================
Nombre completo: coo.data.js
Ruta o ubicación: /Requisitos/Coordi/coo.data.js
Función o funciones:
- Leer Coordi desde su conector autoritativo de Base Local.
- Relacionar estudiantes y requisitos por cédula y período en todas las rutas.
- Recuperar automáticamente períodos con requisitos ausentes o no vinculados.
- Normalizar claves y etiquetas con las mismas reglas utilizadas por Stats.
- Filtrar por período, división, carrera y búsqueda.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.2.0-authoritative-linked-requirements";
  var recoveryMemo = Object.create(null);
  var MAX_AUTO_RECOVERY_ATTEMPTS = 2;

  var REQUIREMENT_ALIASES = {
    academico:["academico","academica","academicoestado","estadoacademico"],
    documentacion:["documentacion","documentacionacademica","documentos","requisitosdocumentales"],
    financiero:["financiero","finanzas","estadopagos","pagos","deuda"],
    titulacion:["titulacion"],
    practicasvinculacion:["practicasvinculacion","practicas","practicaspreprofesionales","practicapreprofesional"],
    vinculacion:["vinculacion","vinculacionconlasociedad","vinculacionsociedad"],
    seguimientograduados:["seguimientograduados","seguimientoagraduados","graduados"],
    ingles:["ingles","segundalengua","idiomas","english"],
    actualizaciondatos:["actualizaciondatos","actualizaciondedatos","datosactualizados","actualizardatos"],
    aprobaciontitulacion:["aprobaciontitulacion"],
    aprobacioncomplexivoproyecto:["aprobacioncomplexivoproyecto","aprobacioncomplexivoproyecto"]
  };

  var aliasToCanonical = Object.create(null);

  function text(value){ return String(value == null ? "" : value).trim(); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase(); }
  function compact(value){ return norm(value).replace(/[^a-z0-9]+/g,""); }
  function arr(value){ return Array.isArray(value) ? value : []; }
  function delay(ms){ return new Promise(function(resolve){ setTimeout(resolve,ms); }); }

  Object.keys(REQUIREMENT_ALIASES).forEach(function(canonical){
    aliasToCanonical[compact(canonical)] = canonical;
    REQUIREMENT_ALIASES[canonical].forEach(function(alias){
      aliasToCanonical[compact(alias)] = canonical;
    });
  });

  function unique(values){
    var map = Object.create(null);
    arr(values).forEach(function(value){
      value = text(value);
      if(value){ map[norm(value)] = value; }
    });
    return Object.keys(map).map(function(key){ return map[key]; });
  }

  function connector(){
    if(window.BDLocalCoordi){ return window.BDLocalCoordi; }
    if(window.ConCoordi){ return window.ConCoordi; }
    if(window.BDLocalConexiones && typeof window.BDLocalConexiones.get === "function"){
      return window.BDLocalConexiones.get("coordi");
    }
    return null;
  }

  function statsConnector(){
    return window.BDLocalStats || window.ConStats || null;
  }

  function rules(){
    return window.StatsRules || window.BL2RequirementsEngine || null;
  }

  function waitConnector(attempt){
    attempt = Number(attempt || 0);
    var repo = connector();

    if(repo){
      if(typeof repo.ready === "function"){
        return Promise.resolve(repo.ready()).then(function(){ return repo; });
      }
      return Promise.resolve(repo);
    }

    if(attempt >= 40){ return Promise.resolve(null); }

    return delay(50).then(function(){ return waitConnector(attempt + 1); });
  }

  function first(row,keys){
    row = row || {};
    for(var i=0;i<keys.length;i+=1){
      if(row[keys[i]] !== undefined && row[keys[i]] !== null && text(row[keys[i]]) !== ""){
        return row[keys[i]];
      }
    }
    return "";
  }

  function normalizeCedula(value){
    try{
      if(window.BDLocalConUtils && typeof window.BDLocalConUtils.normalizeCedula === "function"){
        return window.BDLocalConUtils.normalizeCedula(value);
      }
    }catch(error){}
    var raw = text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function canonicalPeriodId(value){
    try{
      if(window.BDLocalConUtils && typeof window.BDLocalConUtils.canonicalPeriodId === "function"){
        return window.BDLocalConUtils.canonicalPeriodId(value);
      }
    }catch(error){}
    return text(value);
  }

  function canonicalRequirementKey(value){
    var original = text(value);
    var canonical = aliasToCanonical[compact(original)];
    if(canonical){ return canonical; }

    try{
      if(rules() && typeof rules().getRequirementByKey === "function"){
        var item = rules().getRequirementByKey(original) || {};
        if(text(item.key) && compact(item.key) !== compact(original)){
          return text(item.key);
        }
      }
    }catch(error){}

    return original;
  }

  function readableRequirementLabel(key,fallback){
    key = canonicalRequirementKey(key);
    try{
      if(rules() && typeof rules().getRequirementByKey === "function"){
        var item = rules().getRequirementByKey(key) || {};
        if(text(item.label)){ return text(item.label); }
      }
      if(window.BLCampos && typeof window.BLCampos.requirementLabel === "function"){
        return text(window.BLCampos.requirementLabel(key,fallback || key));
      }
    }catch(error){}
    return text(fallback || key);
  }

  function normalizePeriod(row){
    if(typeof row === "string"){
      return {id:canonicalPeriodId(row),value:canonicalPeriodId(row),label:text(row)};
    }
    row = row || {};
    var id = canonicalPeriodId(row.id || row.value || row.periodoId || row.periodId || row.codigo || row.label || row.periodoLabel);
    var label = text(row.label || row.periodoLabel || row.periodoCanonicoLabel || row.nombre || row.name || id);
    return id || label ? {id:id || label,value:id || label,label:label || id} : null;
  }

  function samePeriod(a,b){
    a = text(a);
    b = text(b);
    if(!b){ return true; }
    if(!a){ return false; }
    try{
      if(window.BDLocalConUtils && typeof window.BDLocalConUtils.samePeriod === "function"){
        return window.BDLocalConUtils.samePeriod(a,b);
      }
      if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){
        return window.BLPeriodosCanon.samePeriod(a,b);
      }
    }catch(error){}
    return canonicalPeriodId(a) === canonicalPeriodId(b) || compact(a) === compact(b);
  }

  function cedulaOf(row){
    row = row || {};
    return normalizeCedula(first(row,["_cedula","cedula","Cedula","cédula","numeroIdentificacion","NumeroIdentificacion","identificacion","Identificacion","_bl2Id"]));
  }

  function periodOf(row){
    row = row || {};
    return canonicalPeriodId(first(row,["_periodoId","periodoId","periodId","periodoCanonicoId","ultimoPeriodoId","idPeriodo","_bl2PeriodoId","periodo","Periodo"]));
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

  function normalizeRequirement(input){
    var req = Object.assign({},input || {});
    var rawKey = text(req.requisitoKey || req.requirementKey || req.key || req.campo || req.field || req.codigo || req.nombre || (typeof req.requisito === "string" ? req.requisito : ""));
    var key = canonicalRequirementKey(rawKey);
    var fallbackLabel = text(req.requisitoLabel || req.label || req.titulo || req.nombre || rawKey || key);
    var value = requirementValue(req);

    req.requisitoKeyOriginal = rawKey;
    req.requisitoKey = key;
    req.requirementKey = key;
    req.requisitoLabel = readableRequirementLabel(key,fallbackLabel);
    req.valor = value;
    req.estado = text(req.estado) || text(value);
    req.cedula = cedulaOf(req);
    req.numeroIdentificacion = req.numeroIdentificacion || req.cedula;
    req.periodoId = periodOf(req);
    req.periodId = req.periodoId;
    return req;
  }

  function divisionOf(row){
    row = row || {};
    try{
      if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function"){
        var value = window.BLDivisionesService.studentDivision(row);
        if(text(value)){ return text(value); }
      }
    }catch(error){}
    var list = arr(row.divisiones || row.Divisiones || row._divisiones);
    return text(row._division || row._bl2Division || row.divisionPrincipal || row.division || row.Division || row["División"] || list[0] || "Sin división");
  }

  function divisionsOf(row){
    var values = arr(row && (row.divisiones || row.Divisiones || row._divisiones)).map(text).filter(Boolean);
    var main = divisionOf(row);
    if(main){ values.unshift(main); }
    return unique(values);
  }

  function normalizeStudent(input){
    var row = Object.assign({},input || {});
    var cedula = cedulaOf(row);
    var nombres = text(first(row,["_nombres","_bl2Nombre","nombres","Nombres","nombreCompleto","nombre","Nombre","estudiante","Estudiante","alumno","Alumno"]));
    var carrera = text(first(row,["_carrera","_bl2Carrera","nombreCarrera","NombreCarrera","nombrecarrera","carrera","Carrera","programa","Programa"])) || "SIN CARRERA";
    var periodoId = periodOf(row);
    var periodo = text(first(row,["_periodo","_bl2Periodo","periodoLabel","periodoCanonicoLabel","Periodo","periodo","nombrePeriodo","NombrePeriodo","periodoId"])) || periodoId || "SIN PERÍODO";
    var division = divisionOf(row);
    var divisiones = divisionsOf(row);
    var correoPersonal = text(first(row,["correoPersonal","CorreoPersonal","correopersonal","correo","Correo","email","Email"]));
    var correoInstitucional = text(first(row,["correoInstitucional","CorreoInstitucional","correoinstitucional","correoInst","CorreoInst"]));
    var celular = text(first(row,["celular","Celular","telefono","Telefono","Teléfono","whatsapp","Whatsapp"]));
    var requisitos = arr(row.requisitos).map(normalizeRequirement).filter(function(req){ return !!req.requisitoKey; });

    requisitos.forEach(function(req){
      var key = req.requisitoKey;
      if(key && !Object.prototype.hasOwnProperty.call(row,key)){
        row[key] = req.valor;
      }
    });

    row._cooId = text(first(row,["idEstudiantePeriodo","studentId","detalleId","id","_id"])) || [periodoId || periodo,cedula,nombres].join("|");
    row._cedula = cedula;
    row._nombres = nombres;
    row._carrera = carrera;
    row._periodoId = periodoId || periodo;
    row._periodo = periodo;
    row._division = division;
    row._divisiones = divisiones;
    row._correoPersonal = correoPersonal;
    row._correoInstitucional = correoInstitucional;
    row._correo = correoPersonal || correoInstitucional;
    row._celular = celular;
    row.requisitos = requisitos;
    row._bdlRequirementsCount = requisitos.length;
    row._search = norm([cedula,nombres,carrera,periodoId,periodo,division,divisiones.join(" "),correoPersonal,correoInstitucional,celular].join(" "));
    return row;
  }

  function hydrateStudents(students,requirements,selectedPeriod){
    var index = Object.create(null);
    var normalizedRequirements = arr(requirements).map(normalizeRequirement).filter(function(req){
      if(!req.cedula || !req.requisitoKey){ return false; }
      return !selectedPeriod || !req.periodoId || samePeriod(req.periodoId,selectedPeriod);
    });

    normalizedRequirements.forEach(function(req){
      if(!index[req.cedula]){ index[req.cedula] = []; }
      index[req.cedula].push(req);
    });

    return arr(students).map(function(input){
      var student = normalizeStudent(input);
      var related = index[student._cedula] || [];
      var merged = Object.create(null);

      arr(student.requisitos).concat(related).forEach(function(req){
        req = normalizeRequirement(req);
        if(!req.requisitoKey){ return; }
        if(student._periodoId && req.periodoId && !samePeriod(student._periodoId,req.periodoId)){ return; }
        merged[compact(req.requisitoKey)] = req;
      });

      student.requisitos = Object.keys(merged).map(function(key){ return merged[key]; });
      student.requisitos.forEach(function(req){
        student[req.requisitoKey] = req.valor;
      });
      student._bdlRequirementsHydrated = true;
      student._bdlRequirementsCount = student.requisitos.length;
      return student;
    });
  }

  function hasDivision(row,selected){
    selected = text(selected);
    if(!selected){ return true; }
    try{
      if(window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function"){
        return window.BLDivisionesService.hasDivision(row,selected);
      }
    }catch(error){}
    return divisionsOf(row).some(function(value){ return norm(value) === norm(selected); });
  }

  function filterRows(students,options){
    options = options || {};
    var periodId = text(options.periodId || options.periodoId || options.periodo || "");
    var division = text(options.division || "");
    var career = text(options.career || options.carrera || "");
    var search = norm(options.search || "");
    var limit = options.limit == null ? 0 : Number(options.limit || 0);

    var rows = arr(students).filter(function(row){
      if(periodId && !samePeriod(row._periodoId || row._periodo,periodId)){ return false; }
      if(division && !hasDivision(row,division)){ return false; }
      if(career && norm(row._carrera) !== norm(career)){ return false; }
      if(search && row._search.indexOf(search) === -1){ return false; }
      return true;
    }).sort(function(a,b){
      return (a._nombres || "").localeCompare(b._nombres || "","es") || (a._cedula || "").localeCompare(b._cedula || "","es");
    });

    return limit > 0 ? rows.slice(0,limit) : rows;
  }

  function listDivisions(students){
    var values = [];
    arr(students).forEach(function(row){ values = values.concat(divisionsOf(row)); });
    return unique(values).sort(function(a,b){ return a.localeCompare(b,"es"); });
  }

  function listCareers(students){
    return unique(arr(students).map(function(row){ return row._carrera; })).sort(function(a,b){
      return a.localeCompare(b,"es");
    });
  }

  function addRequirementOption(map,key,label){
    key = canonicalRequirementKey(key);
    if(!key){ return; }
    map[compact(key)] = {
      key:key,
      label:readableRequirementLabel(key,label || key)
    };
  }

  function listRequirements(students){
    var map = Object.create(null);

    arr(students).forEach(function(row){
      try{
        if(rules() && typeof rules().requirementsForStudent === "function"){
          arr(rules().requirementsForStudent(row)).forEach(function(item){
            addRequirementOption(map,item.key || item.id || item.campo,item.label || item.nombre);
          });
        }
      }catch(error){}

      arr(row.requisitos).forEach(function(req){
        addRequirementOption(map,requirementKey(req),req.requisitoLabel || req.label || req.nombre);
      });
    });

    try{
      if(rules() && Array.isArray(rules().FINAL_REQUIREMENTS)){
        rules().FINAL_REQUIREMENTS.forEach(function(item){
          addRequirementOption(map,item.key,item.label);
        });
      }
    }catch(error2){}

    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a,b){
      return a.label.localeCompare(b.label,"es");
    });
  }

  function rowsFromResult(result){
    if(Array.isArray(result)){ return result; }
    result = result || {};
    return arr(result.rows || result.students || result.estudiantes);
  }

  function periodsFromRepo(repo){
    try{
      if(repo && typeof repo.listPeriods === "function"){ return repo.listPeriods() || []; }
      if(repo && typeof repo.periods === "function"){ return repo.periods() || []; }
      if(repo && typeof repo.getPeriods === "function"){ return repo.getPeriods() || []; }
    }catch(error){}
    return [];
  }

  function readRepository(repo,periodId,options){
    options = options || {};
    var periods = periodsFromRepo(repo);

    if(!periodId && options.allowGlobal !== true){
      return {
        source:text(repo && repo.source) || "BDLocalConCoordi",
        periods:arr(periods).map(normalizePeriod).filter(Boolean),
        students:[],
        totalRequirements:0,
        linkedRequirements:0
      };
    }

    var result = typeof repo.listStudents === "function"
      ? repo.listStudents({
          periodoId:periodId,
          periodId:periodId,
          matricula:options.matricula == null ? "ACTIVO" : options.matricula
        })
      : {rows:typeof repo.getStudents === "function" ? repo.getStudents({periodoId:periodId,matricula:"ACTIVO"}) : []};

    var rows = rowsFromResult(result);
    var requirements = arr(result && result.requirements);

    if(!requirements.length && repo && typeof repo.getRequirements === "function"){
      try{ requirements = arr(repo.getRequirements({periodoId:periodId,periodId:periodId})); }catch(error){}
    }

    var students = hydrateStudents(rows,requirements,periodId);
    var linked = students.reduce(function(total,row){ return total + arr(row.requisitos).length; },0);

    return {
      source:text(result && result.source) || text(repo && repo.source) || "BDLocalConCoordi",
      periods:arr(periods).map(normalizePeriod).filter(Boolean),
      students:students,
      totalRequirements:requirements.length,
      linkedRequirements:linked
    };
  }

  function fallbackSnapshot(options){
    options = options || {};
    var periodId = text(options.periodId || options.periodoId || options.periodo || "");
    var stats = statsConnector();

    if(stats){
      try{ return readRepository(stats,periodId,options); }catch(error){}
    }

    var cache = null;
    try{
      if(window.BDLocalScreenDeps && typeof window.BDLocalScreenDeps.readCache === "function"){
        cache = window.BDLocalScreenDeps.readCache();
      }else if(window.BDLocalConUtils && typeof window.BDLocalConUtils.readCache === "function"){
        cache = window.BDLocalConUtils.readCache();
      }
    }catch(error2){}

    cache = cache || {periods:[],students:[],requirements:[]};
    var requirements = arr(cache.requirements).filter(function(req){
      return !periodId || !periodOf(req) || samePeriod(periodOf(req),periodId);
    });
    var students = hydrateStudents(
      filterRows(arr(cache.students).map(normalizeStudent),{periodId:periodId}),
      requirements,
      periodId
    );

    return {
      source:"BDLocalScreenDeps-fallback",
      periods:arr(cache.periods).map(normalizePeriod).filter(Boolean),
      students:students,
      totalRequirements:requirements.length,
      linkedRequirements:students.reduce(function(total,row){ return total + arr(row.requisitos).length; },0)
    };
  }

  function refreshRepository(repo,periodId,source){
    if(!repo || typeof repo.refresh !== "function"){
      return Promise.resolve(null);
    }

    return Promise.resolve(repo.refresh({
      periodoId:periodId,
      periodId:periodId,
      source:source || "COOData.refresh",
      mode:"full",
      full:true,
      force:true,
      immediate:true
    })).catch(function(error){
      console.warn("[COOData] No se pudo refrescar Base Local",error);
      return null;
    });
  }

  function isIncomplete(snapshot,periodId){
    return !!(
      periodId &&
      snapshot &&
      snapshot.students &&
      snapshot.students.length > 0 &&
      Number(snapshot.linkedRequirements || 0) <= 0
    );
  }

  function recoverIfIncomplete(repo,snapshot,periodId,options){
    options = options || {};
    if(!isIncomplete(snapshot,periodId) || !repo || typeof repo.refresh !== "function"){
      if(!isIncomplete(snapshot,periodId)){ delete recoveryMemo[periodId]; }
      return Promise.resolve(snapshot);
    }

    var attempts = Number(recoveryMemo[periodId] || 0);
    if(attempts >= MAX_AUTO_RECOVERY_ATTEMPTS){
      return Promise.resolve(snapshot);
    }

    recoveryMemo[periodId] = attempts + 1;

    return refreshRepository(repo,periodId,"COOData.autoRecover." + (attempts + 1)).then(function(){
      var recovered = readRepository(repo,periodId,options);
      if(!isIncomplete(recovered,periodId)){
        delete recoveryMemo[periodId];
        return recovered;
      }
      if(Number(recoveryMemo[periodId] || 0) < MAX_AUTO_RECOVERY_ATTEMPTS){
        return delay(250).then(function(){
          return recoverIfIncomplete(repo,recovered,periodId,options);
        });
      }
      return recovered;
    });
  }

  function getSnapshot(options){
    options = options || {};
    var periodId = text(options.periodId || options.periodoId || options.periodo || "");

    return waitConnector(0).then(function(repo){
      if(!repo){ return fallbackSnapshot(options); }

      if(options.refresh === true){
        delete recoveryMemo[periodId];
        return refreshRepository(repo,periodId,"COOData.manualRefresh").then(function(){
          return recoverIfIncomplete(repo,readRepository(repo,periodId,options),periodId,options);
        });
      }

      return recoverIfIncomplete(repo,readRepository(repo,periodId,options),periodId,options);
    });
  }

  function read(options){
    options = options || {};
    return getSnapshot(options).then(function(snapshot){
      var periodId = options.periodId || options.periodoId || options.periodo || "";
      var baseByPeriod = filterRows(snapshot.students,{periodId:periodId,division:"",career:""});
      var baseByDivision = filterRows(snapshot.students,{periodId:periodId,division:options.division || "",career:""});
      var baseByCareer = filterRows(snapshot.students,{
        periodId:periodId,
        division:options.division || "",
        career:options.career || options.carrera || ""
      });
      var rows = filterRows(snapshot.students,options);

      return {
        source:snapshot.source || "desconocido",
        version:VERSION,
        periodList:snapshot.periods || [],
        divisionList:listDivisions(baseByPeriod),
        careerList:listCareers(baseByDivision),
        requirementList:listRequirements(baseByCareer),
        rows:rows,
        total:rows.length,
        diagnostics:{
          source:snapshot.source || "desconocido",
          generatedAt:new Date().toISOString(),
          filters:{
            periodId:text(periodId),
            division:text(options.division || ""),
            career:text(options.career || options.carrera || ""),
            requirementKey:text(options.requirementKey || options.requisito || "")
          },
          totalSnapshotStudents:arr(snapshot.students).length,
          totalFilteredStudents:rows.length,
          totalRequirementsRead:Number(snapshot.totalRequirements || 0),
          totalRequirementsLinked:Number(snapshot.linkedRequirements || 0),
          totalPeriods:arr(snapshot.periods).length,
          totalDivisions:listDivisions(baseByPeriod).length,
          totalCareers:listCareers(baseByDivision).length,
          totalRequirements:listRequirements(baseByCareer).length
        }
      };
    });
  }

  window.COOData = {
    version:VERSION,
    read:read,
    getSnapshot:getSnapshot,
    normalizeStudent:normalizeStudent,
    normalizeRequirement:normalizeRequirement,
    hydrateStudents:hydrateStudents,
    filterRows:filterRows,
    listDivisions:listDivisions,
    listCareers:listCareers,
    listRequirements:listRequirements,
    samePeriod:samePeriod,
    hasDivision:hasDivision,
    helpers:{
      text:text,
      norm:norm,
      compact:compact,
      divisionOf:divisionOf,
      divisionsOf:divisionsOf,
      canonicalRequirementKey:canonicalRequirementKey,
      readableRequirementLabel:readableRequirementLabel,
      requirementValue:requirementValue
    }
  };
})(window);

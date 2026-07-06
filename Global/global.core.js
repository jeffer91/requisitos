/* =========================================================
Nombre completo: global.core.js
Ruta o ubicación: /Requisitos/Global/global.core.js
Función:
- Leer datos desde ConGlobal/BDLocalGlobal/BDLocalConexiones.
- Aplicar filtros superiores del módulo Global.
- Detectar carreras, requisitos, períodos y tipo de carrera.
- Preparar estructuras base para secciones futuras con tablas inteligentes.
Con qué se conecta:
- BDLocal/conexiones/con.global.js
- BDLocal/adapters/bdl.screen-deps.js
- global.config.js
- global.app.js en el Bloque 3
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.0.0-bloque-2";
  var config = window.GlobalConfig || {};
  var state = {
    ready:false,
    loading:null,
    snapshot:null,
    lastFilters:null,
    lastData:null,
    errors:[]
  };

  function text(value){ return String(value == null ? "" : value).trim(); }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function key(value){ return norm(value).replace(/[^a-z0-9]+/g, ""); }

  function clone(value){
    if(value === undefined){ return undefined; }
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function emit(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail:detail || {} })); }catch(error){}
  }

  function addError(message, error){
    state.errors.push({ message:message, detail:error && error.message ? error.message : text(error), at:new Date().toISOString() });
    try{ console.warn("[GlobalCore] " + message, error || ""); }catch(e){}
  }

  function api(){
    return window.ConGlobal || window.BDLocalGlobal || (window.BDLocalConexiones && window.BDLocalConexiones.get && window.BDLocalConexiones.get("global")) || null;
  }

  function loadScript(relative){
    var src;
    try{ src = new URL(relative, window.location.href).href; }
    catch(error){ src = relative; }

    if(Array.prototype.slice.call(document.scripts || []).some(function(script){ return script.src === src || script.getAttribute("data-global-core-src") === src; })){
      return Promise.resolve(src);
    }

    return new Promise(function(resolve, reject){
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.defer = false;
      script.setAttribute("data-global-core-src", src);
      script.onload = function(){ resolve(src); };
      script.onerror = function(){ reject(new Error("No se pudo cargar " + src)); };
      document.head.appendChild(script);
    });
  }

  function ensureConnection(){
    if(api()){ return Promise.resolve(api()); }

    if(window.BDLocalScreenDeps && typeof window.BDLocalScreenDeps.ready === "function"){
      return window.BDLocalScreenDeps.ready().then(function(){ return api(); });
    }

    if(window.BDLScreenDepsReady && typeof window.BDLScreenDepsReady.then === "function"){
      return window.BDLScreenDepsReady.then(function(){ return api(); });
    }

    return loadScript("../BDLocal/adapters/bdl.screen-deps.js")
      .then(function(){
        if(window.BDLocalScreenDeps && typeof window.BDLocalScreenDeps.ready === "function"){
          return window.BDLocalScreenDeps.ready();
        }
        return true;
      })
      .then(function(){ return api(); })
      .catch(function(error){
        addError("No se pudo inicializar BDLocal para Global", error);
        return api();
      });
  }

  function ready(options){
    options = options || {};
    if(state.ready && !options.force){ return Promise.resolve(status()); }
    if(state.loading && !options.force){ return state.loading; }

    state.loading = ensureConnection()
      .then(function(con){
        if(con && typeof con.ready === "function"){
          return con.ready().then(function(){ return con; });
        }
        return con;
      })
      .then(function(){ return refresh({ force:true }); })
      .then(function(){
        state.ready = true;
        emit("global:core-ready", status());
        return status();
      })
      .catch(function(error){
        addError("Error inicializando GlobalCore", error);
        state.ready = true;
        return status();
      })
      .finally(function(){ state.loading = null; });

    return state.loading;
  }

  function refresh(options){
    options = options || {};
    return ensureConnection().then(function(con){
      if(con && typeof con.refresh === "function" && options.force){
        return con.refresh({ source:"GlobalCore.refresh" }).then(function(){ return con; }).catch(function(){ return con; });
      }
      return con;
    }).then(function(con){
      var snap;

      if(con && typeof con.snapshot === "function"){
        snap = con.snapshot({ filters:{ matricula:"" } });
      }else if(con && typeof con.getSnapshot === "function"){
        snap = con.getSnapshot({ filters:{ matricula:"" } });
      }else{
        snap = fallbackSnapshot();
      }

      state.snapshot = normalizeSnapshot(snap || fallbackSnapshot());
      emit("global:data-refreshed", { status:status(), at:new Date().toISOString() });
      return state.snapshot;
    });
  }

  function fallbackSnapshot(){
    var repo = window.ExcelLocalRepo || window.BL2DataEngine || null;
    var periods = [];
    var students = [];
    var requirements = [];

    try{
      if(repo && typeof repo.listPeriods === "function"){ periods = repo.listPeriods() || []; }
      else if(repo && typeof repo.getPeriods === "function"){ periods = repo.getPeriods() || []; }
    }catch(error){ addError("No se pudieron leer períodos en fallback", error); }

    try{
      if(repo && typeof repo.listStudents === "function"){
        var result = repo.listStudents({ matricula:"" });
        students = Array.isArray(result) ? result : (result && result.rows) || [];
      }else if(repo && typeof repo.getStudents === "function"){
        students = repo.getStudents({ matricula:"" }) || [];
      }
    }catch(error2){ addError("No se pudieron leer estudiantes en fallback", error2); }

    try{
      if(repo && typeof repo.getRequirements === "function"){ requirements = repo.getRequirements({}) || []; }
    }catch(error3){ addError("No se pudieron leer requisitos en fallback", error3); }

    return {
      ok:true,
      source:"GlobalCore.fallback",
      meta:{},
      periods:periods,
      students:students,
      requirements:requirements,
      careers:[],
      requirementCatalog:[],
      generatedAt:new Date().toISOString()
    };
  }

  function normalizePeriod(period){
    period = period || {};
    var id = text(period.periodoCanonicoId || period.periodoId || period.periodId || period.id || period.value || period.key || period.label || period.nombre);
    var label = text(period.periodoCanonicoLabel || period.periodoLabel || period.label || period.nombre || period.name || id);
    if(!id && !label){ return null; }
    return Object.assign({}, period, {
      id:id || label,
      value:id || label,
      key:id || label,
      label:label || id,
      periodoId:id || label,
      periodoLabel:label || id
    });
  }

  function rowPeriodId(row){
    row = row || {};
    return text(row.periodoCanonicoId || row.periodoId || row.periodId || row.ultimoPeriodoId || row.idPeriodo || row._periodoId || row._bl2PeriodoId || row.PeriodoId || row.Periodo);
  }

  function rowPeriodLabel(row){
    row = row || {};
    return text(row.periodoCanonicoLabel || row.periodoLabel || row.periodo || row.Periodo || row._periodo || row._bl2Periodo || rowPeriodId(row));
  }

  function cedula(row){
    row = row || {};
    return text(row.cedula || row.Cedula || row["Cédula"] || row.numeroIdentificacion || row.NumeroIdentificacion || row.identificacion || row.Identificacion || row._cedula);
  }

  function careerName(row){
    row = row || {};
    return text(row.NombreCarrera || row.nombreCarrera || row.carrera || row.Carrera || row._carrera) || "SIN CARRERA";
  }

  function careerCode(row){
    row = row || {};
    return text(row.CodigoCarrera || row.codigoCarrera || row.codigo || row._codigoCarrera || careerName(row));
  }

  function studentName(row){
    row = row || {};
    return text(row.Nombres || row.nombres || row.Nombre || row.nombre || row.Estudiante || row.estudiante || row._nombres);
  }

  function divisionName(row){
    row = row || {};
    return text(row.division || row.Division || row["División"] || row._division || row._bl2Division || "Sin división") || "Sin división";
  }

  function matriculaState(row){
    row = row || {};
    return text(row.estadoMatricula || row.EstadoMatricula || row._estadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO";
  }

  function typeCareer(nombreCarrera){
    if(config.reglas && typeof config.reglas.tipoCarrera === "function"){
      return config.reglas.tipoCarrera(nombreCarrera);
    }
    return text(nombreCarrera).toUpperCase().indexOf("UNIVERSITARIA") >= 0 ? "UNIVERSITARIA" : "SUPERIOR";
  }

  function normalizeStudent(row){
    row = Object.assign({}, row || {});
    var carrera = careerName(row);
    var periodoId = rowPeriodId(row);
    var periodoLabel = rowPeriodLabel(row) || periodoId || "SIN PERÍODO";
    var tipo = typeCareer(carrera);

    row._globalCedula = cedula(row);
    row._globalNombres = studentName(row);
    row._globalCarrera = carrera;
    row._globalCodigoCarrera = careerCode(row);
    row._globalTipoCarrera = tipo;
    row._globalPeriodoId = periodoId;
    row._globalPeriodoLabel = periodoLabel;
    row._globalDivision = divisionName(row);
    row._globalEstadoMatricula = matriculaState(row);
    return row;
  }

  function normalizeRequirement(req){
    req = Object.assign({}, req || {});
    var id = text(req.requisitoId || req.requisito || req.campo || req.key || req.id || req.nombre || req.label);
    if(!id){ return null; }
    req.id = id;
    req.key = req.key || id;
    req.label = text(req.label || req.nombre || id);
    return req;
  }

  function normalizeSnapshot(snap){
    snap = snap || {};
    var periods = Array.isArray(snap.periods) ? snap.periods.map(normalizePeriod).filter(Boolean) : [];
    var students = Array.isArray(snap.students) ? snap.students.map(normalizeStudent) : [];
    var requirements = Array.isArray(snap.requirements) ? snap.requirements.map(normalizeRequirement).filter(Boolean) : [];
    var careers = Array.isArray(snap.careers) && snap.careers.length ? snap.careers : buildCareerCatalog(students);
    var requirementCatalog = Array.isArray(snap.requirementCatalog) && snap.requirementCatalog.length ? snap.requirementCatalog : buildRequirementCatalog(students, requirements);

    return {
      ok:snap.ok !== false,
      source:snap.source || "GlobalCore",
      meta:snap.meta || {},
      periods:periods,
      students:students,
      requirements:requirements,
      careers:careers.map(normalizeCareer).filter(Boolean),
      requirementCatalog:requirementCatalog.map(normalizeRequirement).filter(Boolean),
      diagnostics:Array.isArray(snap.diagnostics) ? snap.diagnostics : [],
      generatedAt:snap.generatedAt || new Date().toISOString()
    };
  }

  function normalizeCareer(career){
    career = career || {};
    var nombre = text(career.nombre || career.name || career.label || career.carrera);
    var codigo = text(career.codigo || career.id || career.key || nombre);
    if(!nombre){ return null; }
    return {
      id:(codigo || nombre).toUpperCase(),
      codigo:codigo || nombre,
      nombre:nombre,
      tipo:text(career.tipo || typeCareer(nombre))
    };
  }

  function buildCareerCatalog(students){
    var map = Object.create(null);
    students.forEach(function(row){
      var nombre = row._globalCarrera || careerName(row);
      var codigo = row._globalCodigoCarrera || careerCode(row);
      var id = (codigo || nombre).toUpperCase();
      if(!nombre || map[id]){ return; }
      map[id] = { id:id, codigo:codigo, nombre:nombre, tipo:typeCareer(nombre) };
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){ return a.nombre.localeCompare(b.nombre, "es"); });
  }

  function buildRequirementCatalog(students, requirements){
    var map = Object.create(null);
    var reserved = {
      id:true,_id:true,cedula:true,Cedula:true,"Cédula":true,numeroIdentificacion:true,NumeroIdentificacion:true,
      nombres:true,Nombres:true,nombre:true,Nombre:true,estudiante:true,Estudiante:true,carrera:true,Carrera:true,
      nombreCarrera:true,NombreCarrera:true,codigoCarrera:true,CodigoCarrera:true,periodo:true,Periodo:true,
      periodoId:true,periodId:true,periodoLabel:true,division:true,Division:true,estadoMatricula:true,EstadoMatricula:true,
      createdAt:true,updatedAt:true
    };

    requirements.forEach(function(req){
      var r = normalizeRequirement(req);
      if(r){ map[r.id] = r; }
    });

    students.forEach(function(row){
      Object.keys(row || {}).forEach(function(k){
        if(reserved[k] || k.indexOf("_global") === 0){ return; }
        var value = text(row[k]).toUpperCase();
        if(["CUMPLE", "NO CUMPLE", "PENDIENTE"].indexOf(value) >= 0){
          map[k] = { id:k, key:k, label:k };
        }
      });
    });

    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){ return a.label.localeCompare(b.label, "es"); });
  }

  function comparePeriod(a, b){
    return text(a).localeCompare(text(b), "es");
  }

  function insidePeriodRange(row, filters){
    filters = filters || {};
    var period = text(row._globalPeriodoId || row._globalPeriodoLabel);
    var desde = text(filters.periodoDesde);
    var hasta = text(filters.periodoHasta);
    if(desde && comparePeriod(period, desde) < 0){ return false; }
    if(hasta && comparePeriod(period, hasta) > 0){ return false; }
    return true;
  }

  function cellStatus(value){
    var v = norm(value);
    if(["cumple", "si", "sí", "aprobado", "aprobada", "ok", "validado", "validada"].indexOf(v) >= 0){ return "CUMPLE"; }
    if(["pendiente", "por revisar", "revision", "revisión"].indexOf(v) >= 0){ return "PENDIENTE"; }
    if(!v){ return "PENDIENTE"; }
    return "NO CUMPLE";
  }

  function requirementValue(row, requirementId){
    if(!requirementId){ return ""; }
    if(Object.prototype.hasOwnProperty.call(row, requirementId)){ return row[requirementId]; }
    var wanted = key(requirementId);
    var found = "";
    Object.keys(row || {}).some(function(k){
      if(key(k) === wanted){ found = row[k]; return true; }
      return false;
    });
    return found;
  }

  function studentCompliance(row, catalog){
    catalog = Array.isArray(catalog) ? catalog : [];
    var ok = 0;
    var pendiente = 0;
    var no = 0;

    catalog.forEach(function(req){
      var status = cellStatus(requirementValue(row, req.id || req.key));
      if(status === "CUMPLE"){ ok += 1; }
      else if(status === "PENDIENTE"){ pendiente += 1; }
      else{ no += 1; }
    });

    return {
      cumple:ok,
      pendiente:pendiente,
      noCumple:no,
      total:catalog.length,
      aprobado:catalog.length ? (no === 0 && pendiente === 0) : false,
      porcentaje:catalog.length ? Math.round((ok / catalog.length) * 100) : 0
    };
  }

  function applyFilters(filters){
    filters = filters || {};
    var snap = state.snapshot || normalizeSnapshot(fallbackSnapshot());
    var carrera = text(filters.carrera);
    var requisito = text(filters.requisito);
    var tipo = text(filters.tipoCarrera).toUpperCase();
    var catalog = requisito ? snap.requirementCatalog.filter(function(req){ return req.id === requisito || req.key === requisito; }) : snap.requirementCatalog;

    var rows = snap.students.filter(function(row){
      if(!insidePeriodRange(row, filters)){ return false; }
      if(carrera && row._globalCodigoCarrera !== carrera && row._globalCarrera !== carrera){ return false; }
      if(tipo && row._globalTipoCarrera !== tipo){ return false; }
      if(requisito && !text(requirementValue(row, requisito))){ return false; }
      return true;
    });

    rows = rows.map(function(row){
      var r = Object.assign({}, row);
      r._globalCumplimiento = studentCompliance(r, catalog);
      return r;
    });

    state.lastFilters = clone(filters);
    state.lastData = buildData(rows, snap, filters, catalog);
    return state.lastData;
  }

  function uniqueCount(list, getter){
    var map = Object.create(null);
    list.forEach(function(item){
      var value = text(getter(item));
      if(value){ map[value] = true; }
    });
    return Object.keys(map).length;
  }

  function groupCount(list, getter){
    var map = Object.create(null);
    list.forEach(function(item){
      var keyValue = text(getter(item)) || "SIN DATO";
      if(!map[keyValue]){ map[keyValue] = { id:keyValue, label:keyValue, total:0 }; }
      map[keyValue].total += 1;
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){ return b.total - a.total || a.label.localeCompare(b.label, "es"); });
  }

  function buildData(rows, snap, filters, catalog){
    rows = Array.isArray(rows) ? rows : [];
    catalog = Array.isArray(catalog) ? catalog : [];

    var cumplimientoTotal = rows.reduce(function(acc, row){
      var c = row._globalCumplimiento || studentCompliance(row, catalog);
      acc.cumple += c.cumple;
      acc.pendiente += c.pendiente;
      acc.noCumple += c.noCumple;
      acc.total += c.total;
      if(c.aprobado){ acc.estudiantesCumplen += 1; }
      return acc;
    }, { cumple:0, pendiente:0, noCumple:0, total:0, estudiantesCumplen:0 });

    var resumen = {
      totalEstudiantes:rows.length,
      totalCarreras:uniqueCount(rows, function(row){ return row._globalCodigoCarrera || row._globalCarrera; }),
      totalPeriodos:uniqueCount(rows, function(row){ return row._globalPeriodoId || row._globalPeriodoLabel; }),
      totalRequisitos:catalog.length,
      porcentajeCumplimiento:cumplimientoTotal.total ? Math.round((cumplimientoTotal.cumple / cumplimientoTotal.total) * 100) : 0,
      estudiantesCumplen: cumplimientoTotal.estudiantesCumplen,
      activos:rows.filter(function(row){ return row._globalEstadoMatricula !== "RETIRADO"; }).length,
      retirados:rows.filter(function(row){ return row._globalEstadoMatricula === "RETIRADO"; }).length
    };

    return {
      ok:true,
      source:"GlobalCore",
      filters:clone(filters || {}),
      snapshotMeta:clone(snap.meta || {}),
      resumen:resumen,
      students:rows,
      periods:snap.periods,
      careers:snap.careers,
      requirements:catalog,
      catalogs:{
        periods:snap.periods,
        careers:snap.careers,
        requirements:snap.requirementCatalog
      },
      groups:{
        byPeriodo:groupCount(rows, function(row){ return row._globalPeriodoLabel || row._globalPeriodoId; }),
        byCarrera:groupCount(rows, function(row){ return row._globalCarrera; }),
        byTipoCarrera:groupCount(rows, function(row){ return row._globalTipoCarrera; }),
        byEstadoMatricula:groupCount(rows, function(row){ return row._globalEstadoMatricula; })
      },
      generatedAt:new Date().toISOString()
    };
  }

  function getFilterOptions(){
    var snap = state.snapshot || normalizeSnapshot(fallbackSnapshot());
    return {
      periods:snap.periods.slice(),
      careers:snap.careers.slice(),
      requirements:snap.requirementCatalog.slice(),
      tiposCarrera:(config.filtros && config.filtros.tiposCarrera) || []
    };
  }

  function status(){
    var snap = state.snapshot || { periods:[], students:[], requirementCatalog:[], careers:[] };
    return {
      ok:state.errors.length === 0,
      ready:state.ready,
      version:VERSION,
      periods:(snap.periods || []).length,
      students:(snap.students || []).length,
      careers:(snap.careers || []).length,
      requirements:(snap.requirementCatalog || []).length,
      errors:state.errors.slice(-10),
      updatedAt:new Date().toISOString()
    };
  }

  window.GlobalCore = {
    version:VERSION,
    ready:ready,
    refresh:refresh,
    status:status,
    getSnapshot:function(){ return clone(state.snapshot || normalizeSnapshot(fallbackSnapshot())); },
    getFilterOptions:getFilterOptions,
    applyFilters:applyFilters,
    buildData:applyFilters,
    helpers:{
      typeCareer:typeCareer,
      cellStatus:cellStatus,
      requirementValue:requirementValue,
      studentCompliance:studentCompliance,
      normalizeStudent:normalizeStudent
    }
  };

  ready({ force:false });
})(window, document);

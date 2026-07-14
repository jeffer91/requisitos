/* =========================================================
Nombre completo: coo.data.js
Ruta o ubicación: /Requisitos/Coordi/coo.data.js
Función o funciones:
- Leer Coordi desde su conector autoritativo de Base Local.
- Recibir estudiantes con requisitos hidratados por cédula y período.
- Filtrar por período, división, carrera y búsqueda.
- Entregar listas de períodos, divisiones, carreras y requisitos.
- Mantener un respaldo controlado sin priorizar snapshots antiguos.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-authoritative-coordi";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase(); }
  function compact(value){ return norm(value).replace(/[^a-z0-9]+/g,""); }
  function arr(value){ return Array.isArray(value) ? value : []; }
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
    return new Promise(function(resolve){ setTimeout(resolve,50); }).then(function(){
      return waitConnector(attempt + 1);
    });
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

  function normalizePeriod(row){
    if(typeof row === "string"){
      return {id:text(row),value:text(row),label:text(row)};
    }
    row = row || {};
    var id = text(row.id || row.value || row.periodoId || row.periodId || row.codigo || row.label || row.periodoLabel);
    var label = text(row.label || row.periodoLabel || row.periodoCanonicoLabel || row.nombre || row.name || id);
    return id || label ? {id:id || label,value:id || label,label:label || id} : null;
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
    var cedula = text(first(row,["_cedula","_bl2Id","cedula","Cedula","cédula","numeroIdentificacion","NumeroIdentificacion","identificacion","Identificacion"]));
    if(/^\d{9}$/.test(cedula)){ cedula = "0" + cedula; }
    var nombres = text(first(row,["_nombres","_bl2Nombre","nombres","Nombres","nombreCompleto","nombre","Nombre","estudiante","Estudiante","alumno","Alumno"]));
    var carrera = text(first(row,["_carrera","_bl2Carrera","nombreCarrera","NombreCarrera","nombrecarrera","carrera","Carrera","programa","Programa"])) || "SIN CARRERA";
    var periodoId = text(first(row,["_periodoId","_bl2PeriodoId","periodoId","ultimoPeriodoId","periodId","PeriodoId","periodoCanonicoId","periodo","Periodo"]));
    var periodo = text(first(row,["_periodo","_bl2Periodo","periodoLabel","periodoCanonicoLabel","Periodo","periodo","nombrePeriodo","NombrePeriodo","periodoId"])) || periodoId || "SIN PERÍODO";
    var division = divisionOf(row);
    var divisiones = divisionsOf(row);
    var correoPersonal = text(first(row,["correoPersonal","CorreoPersonal","correopersonal","correo","Correo","email","Email"]));
    var correoInstitucional = text(first(row,["correoInstitucional","CorreoInstitucional","correoinstitucional","correoInst","CorreoInst"]));
    var celular = text(first(row,["celular","Celular","telefono","Telefono","Teléfono","whatsapp","Whatsapp"]));
    var requisitos = arr(row.requisitos).map(function(req){ return Object.assign({},req || {}); });

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
    row._search = norm([cedula,nombres,carrera,periodoId,periodo,division,divisiones.join(" "),correoPersonal,correoInstitucional,celular].join(" "));
    return row;
  }

  function samePeriod(a,b){
    a = text(a); b = text(b);
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
    return a === b || norm(a) === norm(b) || compact(a) === compact(b);
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

  function requirementKey(req){
    req = req || {};
    return text(req.requisitoKey || req.requirementKey || req.key || req.campo || req.field || req.codigo || req.nombre || (typeof req.requisito === "string" ? req.requisito : ""));
  }

  function requirementLabel(req){
    req = req || {};
    return text(req.requisitoLabel || req.label || req.titulo || req.nombre || requirementKey(req));
  }

  function listRequirements(students){
    var map = Object.create(null);

    arr(students).forEach(function(row){
      arr(row.requisitos).forEach(function(req){
        var key = requirementKey(req);
        if(!key){ return; }
        map[compact(key)] = {key:key,label:requirementLabel(req) || key};
      });
    });

    if(window.COOConfig && Array.isArray(window.COOConfig.areas)){
      window.COOConfig.areas.forEach(function(area){
        var keys = arr(area.requisitoKeys);
        if(!keys.length){ return; }
        var key = keys[0];
        if(!map[compact(key)]){
          map[compact(key)] = {key:key,label:text(area.area || key),areaId:area.id || ""};
        }
      });
    }

    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a,b){
      return a.label.localeCompare(b.label,"es");
    });
  }

  function fallbackSnapshot(){
    var cache = null;
    try{
      if(window.BDLocalScreenDeps && typeof window.BDLocalScreenDeps.readCache === "function"){
        cache = window.BDLocalScreenDeps.readCache();
      }else if(window.BDLocalConUtils && typeof window.BDLocalConUtils.readCache === "function"){
        cache = window.BDLocalConUtils.readCache();
      }
    }catch(error){}
    cache = cache || {periods:[],students:[]};
    return {
      source:"BDLocalScreenDeps-fallback",
      periods:arr(cache.periods).map(normalizePeriod).filter(Boolean),
      students:arr(cache.students).map(normalizeStudent)
    };
  }

  function getSnapshot(options){
    options = options || {};
    var periodId = text(options.periodId || options.periodoId || options.periodo || "");

    return waitConnector(0).then(function(repo){
      if(!repo){ return fallbackSnapshot(); }

      var refresh = Promise.resolve();
      if(options.refresh === true && typeof repo.refresh === "function"){
        refresh = Promise.resolve(repo.refresh({
          periodoId:periodId,
          periodId:periodId,
          source:"COOData.getSnapshot",
          mode:"full",
          full:true,
          force:true,
          immediate:true
        })).catch(function(error){
          console.warn("[COOData] No se pudo refrescar Base Local",error);
          return null;
        });
      }

      return refresh.then(function(){
        var periods = typeof repo.listPeriods === "function" ? repo.listPeriods() : [];
        if(!periodId && options.allowGlobal !== true){
          return {
            source:text(repo.source) || "BDLocalConCoordi",
            periods:arr(periods).map(normalizePeriod).filter(Boolean),
            students:[]
          };
        }

        var result = typeof repo.listStudents === "function"
          ? repo.listStudents({periodoId:periodId,periodId:periodId,matricula:options.matricula == null ? "ACTIVO" : options.matricula})
          : {rows:typeof repo.getStudents === "function" ? repo.getStudents({periodoId:periodId,matricula:"ACTIVO"}) : []};

        var rows = Array.isArray(result) ? result : arr(result && (result.rows || result.students || result.estudiantes));
        return {
          source:text(result && result.source) || text(repo.source) || "BDLocalConCoordi",
          periods:arr(periods).map(normalizePeriod).filter(Boolean),
          students:rows.map(normalizeStudent)
        };
      });
    });
  }

  function read(options){
    options = options || {};
    return getSnapshot(options).then(function(snapshot){
      var periodId = options.periodId || options.periodoId || options.periodo || "";
      var baseByPeriod = filterRows(snapshot.students,{periodId:periodId,division:"",career:""});
      var baseByDivision = filterRows(snapshot.students,{periodId:periodId,division:options.division || "",career:""});
      var rows = filterRows(snapshot.students,options);
      return {
        source:snapshot.source || "desconocido",
        version:VERSION,
        periodList:snapshot.periods || [],
        divisionList:listDivisions(baseByPeriod),
        careerList:listCareers(baseByDivision),
        requirementList:listRequirements(baseByDivision),
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
          totalPeriods:arr(snapshot.periods).length,
          totalDivisions:listDivisions(baseByPeriod).length,
          totalCareers:listCareers(baseByDivision).length,
          totalRequirements:listRequirements(baseByDivision).length
        }
      };
    });
  }

  window.COOData = {
    version:VERSION,
    read:read,
    getSnapshot:getSnapshot,
    normalizeStudent:normalizeStudent,
    filterRows:filterRows,
    listDivisions:listDivisions,
    listCareers:listCareers,
    listRequirements:listRequirements,
    samePeriod:samePeriod,
    hasDivision:hasDivision,
    helpers:{text:text,norm:norm,compact:compact,divisionOf:divisionOf,divisionsOf:divisionsOf}
  };
})(window);

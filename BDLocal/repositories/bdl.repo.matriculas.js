/* =========================================================
Nombre completo: bdl.repo.matriculas.js
Ruta o ubicación: /BDLocal/repositories/bdl.repo.matriculas.js
Función o funciones:
- Administrar matriculas_periodo como fuente principal.
- Usar estudiantes legacy solo como fallback.
- Aplicar la regla central de identificación validada.
- Forzar idEstudiantePeriodo = cedula__periodoId.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.0-canonical-local-id";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function normalizeBasic(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim(); }
  function normalizeKey(value){ return normalizeBasic(value).toLowerCase().replace(/[^a-z0-9]+/g,""); }
  function normalizeCedula(value){
    var rules = window.BDLRulesPersona;
    if(rules && typeof rules.normalizeCedula === "function"){ return rules.normalizeCedula(value); }
    var utils = window.BL2Config && window.BL2Config.utils;
    return utils && typeof utils.normalizeCedula === "function" ? utils.normalizeCedula(value) : text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
  }
  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4] : value.replace(/_+/g,"__");
  }
  function store(){ return Repos.storeName("matriculasPeriodo","matriculas_periodo"); }
  function legacy(){ return Repos.get("estudiantes") || window.BDLRepoEstudiantesV2 || null; }
  function makeId(periodoId,cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);
    return periodoId && cedula ? cedula + "__" + periodoId : "";
  }

  function normalize(row,context){
    row = Object.assign({},row || {});
    context = Object.assign({},context || {});
    if(window.BDLRulesMatricula && typeof window.BDLRulesMatricula.buildMatricula === "function"){
      row = Object.assign({},row,window.BDLRulesMatricula.buildMatricula(row,context) || {});
    }

    var periodoId = canonicalPeriodId(row.periodoId || row.periodId || row.periodoCanonicoId || row._periodoId || row._bl2PeriodoId || context.periodoId || context.periodId || "");
    var cedula = normalizeCedula(row.cedula || row._cedula || row.numeroIdentificacion || row.NumeroIdentificacion || row.Cedula || row["Cédula"] || context.cedula || "");
    var id = makeId(periodoId,cedula) || text(row.idEstudiantePeriodo || row.studentId || row.id || "");
    var carrera = text(row.carrera || row.NombreCarrera || row.nombreCarrera || row.Carrera || row._carrera || "");
    var codigoCarrera = text(row.codigoCarrera || row.CodigoCarrera || row.codCarrera || "");
    var division = text(row.division || row.Division || row["División"] || row._division || "Sin división");
    var sede = text(row.sede || row.Sede || row.campus || row._sede || "");
    var estado = text(row.estadoMatricula || row.EstadoMatricula || row._estadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO";

    return Object.assign({},row,{
      id:id,
      idEstudiantePeriodo:id,
      studentId:id,
      periodoId:periodoId,
      periodId:periodoId,
      periodoCanonicoId:periodoId,
      cedula:cedula,
      _cedula:cedula,
      numeroIdentificacion:cedula,
      NumeroIdentificacion:cedula,
      carrera:carrera,
      nombreCarrera:text(row.nombreCarrera || row.NombreCarrera || carrera),
      NombreCarrera:text(row.NombreCarrera || row.nombreCarrera || carrera),
      Carrera:text(row.Carrera || carrera),
      codigoCarrera:codigoCarrera,
      CodigoCarrera:codigoCarrera,
      carreraKey:normalizeKey(carrera || codigoCarrera),
      division:division,
      Division:division,
      divisionKey:normalizeKey(division),
      sede:sede,
      Sede:sede,
      estadoMatricula:estado,
      _estadoMatricula:estado,
      paralelo:text(row.paralelo || row.Paralelo || ""),
      jornada:text(row.jornada || row.Jornada || ""),
      periodoLabel:text(row.periodoLabel || row.periodoCanonicoLabel || row.Periodo || row.periodo || ""),
      updatedAt:text(row.updatedAt) || new Date().toISOString(),
      createdAt:text(row.createdAt || row.importedAt) || new Date().toISOString(),
      origen:text(row.origen || row.source || "matriculas_periodo")
    });
  }

  function applyFilters(rows,options){
    options = options || {};
    rows = Array.isArray(rows) ? rows.map(function(row){ return normalize(row,options); }) : [];
    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var cedula = normalizeCedula(options.cedula || options.numeroIdentificacion || "");
    var studentId = text(options.idEstudiantePeriodo || options.studentId || options.id || "");
    var division = text(options.division || "");
    var carrera = text(options.carrera || options.NombreCarrera || options.career || "");
    var estado = text(options.estadoMatricula || options.matricula || "");
    if(periodoId){ rows = rows.filter(function(row){ return row.periodoId === periodoId; }); }
    if(cedula){ rows = rows.filter(function(row){ return row.cedula === cedula; }); }
    if(studentId){ rows = rows.filter(function(row){ return row.idEstudiantePeriodo === studentId; }); }
    if(division){ rows = rows.filter(function(row){ return normalizeKey(row.division) === normalizeKey(division); }); }
    if(carrera){ rows = rows.filter(function(row){ return normalizeBasic([row.carrera,row.nombreCarrera,row.NombreCarrera,row.Carrera,row.codigoCarrera].join(" ")).toLowerCase().indexOf(normalizeBasic(carrera).toLowerCase()) >= 0; }); }
    if(estado && estado.toUpperCase() !== "TODOS" && estado.toUpperCase() !== "TODO"){
      rows = rows.filter(function(row){ return estado.toUpperCase() === "ACTIVO" ? row.estadoMatricula !== "RETIRADO" : row.estadoMatricula === estado.toUpperCase(); });
    }
    return rows;
  }

  function legacyList(options){
    var repository = legacy();
    return repository && typeof repository.list === "function"
      ? repository.list(options || {}).then(function(rows){ return applyFilters(rows,options).filter(function(row){ return !!row.idEstudiantePeriodo; }); }).catch(function(){ return []; })
      : Promise.resolve([]);
  }

  function directGet(key){
    var current = Repos.db();
    return current && typeof current.get === "function" ? current.get(store(),key).catch(function(){ return null; }) : Promise.resolve(null);
  }

  function list(options){
    options = options || {};
    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var cedula = normalizeCedula(options.cedula || options.numeroIdentificacion || "");
    var studentId = text(options.idEstudiantePeriodo || options.studentId || options.id || "");
    var source;
    if(studentId){ source = directGet(studentId).then(function(row){ return row ? [row] : []; }); }
    else if(periodoId && cedula){ source = Repos.safeQueryByIndex(store(),"periodo_cedula",[periodoId,cedula]); }
    else if(periodoId){ source = Repos.safeQueryByIndex(store(),"periodoId",periodoId); }
    else if(cedula){ source = Repos.safeQueryByIndex(store(),"cedula",cedula); }
    else{ source = Repos.safeGetAll(store()); }

    return source.then(function(rows){
      rows = applyFilters(rows || [],options);
      if(rows.length){ return rows; }
      return Repos.safeGetAll(store()).then(function(all){
        var filtered = applyFilters(all || [],options);
        return filtered.length ? filtered : legacyList(options);
      });
    });
  }

  function page(options){
    options = Object.assign({page:1,limit:25},options || {});
    return list(options).then(function(rows){
      var result = Repos.paginate(rows,options);
      result.source = "matriculas_periodo";
      result.queryMode = "indexed_or_fallback";
      return result;
    });
  }
  function getById(value){ return list({idEstudiantePeriodo:text(value)}).then(function(rows){ return rows[0] || null; }); }
  function getByPeriodoCedula(periodoId,cedula){
    var id = makeId(periodoId,cedula);
    return id ? getById(id).then(function(found){ return found || list({periodoId:periodoId,cedula:cedula}).then(function(rows){ return rows[0] || null; }); }) : Promise.resolve(null);
  }
  function save(row){
    var item = normalize(row || {});
    if(!item.idEstudiantePeriodo){ return Promise.reject(new Error("Matrícula sin identificación y período.")); }
    return Repos.safePut(store(),item);
  }
  function saveMany(rows,context){
    var items = (Array.isArray(rows) ? rows : []).map(function(row){ return normalize(row,context || {}); }).filter(function(row){ return !!row.idEstudiantePeriodo; });
    return items.length ? Repos.bulkPut(store(),items) : Promise.resolve([]);
  }

  var api = {version:VERSION,list:list,page:page,getById:getById,getByPeriodoCedula:getByPeriodoCedula,save:save,saveMany:saveMany,normalize:normalize,makeId:makeId,legacyList:legacyList};
  Repos.register("matriculas",api);
  Repos.register("matriculas_periodo",api);
  window.BDLRepoMatriculas = api;
})(window);

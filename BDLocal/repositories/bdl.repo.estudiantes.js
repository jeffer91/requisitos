/* =========================================================
Nombre completo: bdl.repo.estudiantes.js
Ruta o ubicación: /BDLocal/repositories/bdl.repo.estudiantes.js
Función o funciones:
- Administrar estudiantes legacy por período.
- Usar índices de IndexedDB con fallback seguro.
- Aplicar la regla central de identificación validada.
- Forzar la clave local cedula__periodoId al guardar.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.0-canonical-local-id";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
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
  function makeId(cedula,periodoId){
    cedula = normalizeCedula(cedula);
    periodoId = canonicalPeriodId(periodoId);
    return cedula && periodoId ? cedula + "__" + periodoId : "";
  }
  function store(){ return Repos.storeName("estudiantes","estudiantes"); }

  function normalize(row){
    row = Object.assign({},row || {});
    var periodoId = canonicalPeriodId(row.periodoCanonicoId || row.periodoId || row.periodId || row.ultimoPeriodoId || row._periodoId || row._bl2PeriodoId || "");
    var cedula = normalizeCedula(row.cedula || row._cedula || row.numeroIdentificacion || row.NumeroIdentificacion || row.Cedula || row["Cédula"] || "");
    var nombres = text(row.Nombres || row.nombres || row.nombreCompleto || row.Nombre || row.nombre || row.Estudiante || row.estudiante || "");
    var carrera = text(row.NombreCarrera || row.nombreCarrera || row.Carrera || row.carrera || row._carrera || "");
    var division = text(row.division || row.Division || row["División"] || row._division || "Sin división");
    var estado = text(row.estadoMatricula || row.EstadoMatricula || row._estadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO";
    var id = makeId(cedula,periodoId) || text(row.id || row._id || row.studentId || "");

    return Object.assign({},row,{
      id:id,
      _id:id,
      studentId:id,
      idEstudiantePeriodo:id,
      periodoId:periodoId,
      periodId:periodoId,
      periodoCanonicoId:periodoId,
      ultimoPeriodoId:periodoId,
      _periodoId:periodoId,
      cedula:cedula,
      _cedula:cedula,
      numeroIdentificacion:cedula,
      NumeroIdentificacion:cedula,
      Nombres:nombres,
      nombres:nombres,
      nombreCompleto:nombres,
      NombreCarrera:carrera,
      nombreCarrera:carrera,
      Carrera:carrera,
      carrera:carrera,
      _carrera:carrera || "SIN CARRERA",
      division:division,
      Division:division,
      _division:division,
      estadoMatricula:estado,
      _estadoMatricula:estado,
      updatedAt:text(row.updatedAt) || new Date().toISOString()
    });
  }

  function applyFilters(rows,options){
    options = options || {};
    rows = Array.isArray(rows) ? rows.map(normalize) : [];
    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var cedula = normalizeCedula(options.cedula || options.numeroIdentificacion || "");
    var matricula = text(options.matricula || options.estadoMatricula || "");
    var division = text(options.division || "");
    var carrera = text(options.carrera || "");
    if(periodoId){ rows = rows.filter(function(row){ return row.periodoId === periodoId; }); }
    if(cedula){ rows = rows.filter(function(row){ return row.cedula === cedula; }); }
    if(matricula){ rows = rows.filter(function(row){ return text(row.estadoMatricula).toUpperCase() === matricula.toUpperCase(); }); }
    if(division){ rows = rows.filter(function(row){ return text(row.division) === division; }); }
    if(carrera){ rows = rows.filter(function(row){ return text(row.NombreCarrera) === carrera; }); }
    return rows;
  }

  function queryIndexed(options){
    options = options || {};
    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var cedula = normalizeCedula(options.cedula || options.numeroIdentificacion || "");
    if(periodoId && cedula){ return Repos.safeQueryByIndex(store(),"periodo_cedula",[periodoId,cedula]); }
    if(periodoId){ return Repos.safeQueryByIndex(store(),"periodoId",periodoId); }
    if(cedula){ return Repos.safeQueryByIndex(store(),"cedula",cedula); }
    return Promise.resolve(null);
  }

  function queryFallback(options){ return Repos.safeGetAll(store()).then(function(rows){ return applyFilters(rows,options); }); }

  function list(options){
    options = options || {};
    var indexed = !!text(options.periodoId || options.periodId || options.cedula || options.numeroIdentificacion);
    if(!indexed){ return queryFallback(options); }
    return queryIndexed(options).then(function(rows){
      rows = applyFilters(rows || [],options);
      return rows.length ? rows : queryFallback(options);
    });
  }

  function page(options){
    options = Object.assign({page:1,limit:25},options || {});
    return list(options).then(function(rows){
      var result = Repos.paginate(rows,options);
      result.source = "estudiantes";
      result.queryMode = text(options.periodoId || options.periodId || options.cedula) ? "indexed_or_fallback" : "full_fallback";
      return result;
    });
  }

  function getByPeriodoCedula(periodoId,cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);
    if(!periodoId || !cedula){ return Promise.resolve(null); }
    return list({periodoId:periodoId,cedula:cedula}).then(function(rows){ return rows[0] || null; });
  }
  function getByCedula(cedula,periodoId){ return list({cedula:cedula,periodoId:periodoId || ""}).then(function(rows){ return rows[0] || null; }); }
  function save(row){
    var item = normalize(row || {});
    if(!item.id){ return Promise.reject(new Error("Estudiante sin identificación y período.")); }
    return Repos.safePut(store(),item);
  }
  function saveMany(rows){
    var items = (Array.isArray(rows) ? rows : []).map(normalize).filter(function(row){ return !!row.id; });
    return items.length ? Repos.bulkPut(store(),items) : Promise.resolve([]);
  }

  var api = {version:VERSION,list:list,page:page,getByPeriodoCedula:getByPeriodoCedula,getByCedula:getByCedula,save:save,saveMany:saveMany,normalize:normalize,makeId:makeId};
  Repos.register("estudiantes",api);
  window.BDLRepoEstudiantesV2 = api;
})(window);

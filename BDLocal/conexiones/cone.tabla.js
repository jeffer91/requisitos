(function(window){
  "use strict";
  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;
  if(!HUB || !U){ return; }

  function cache(){ return U.readCache(); }
  function listPeriods(){ return cache().periods.map(U.normalizePeriod).filter(Boolean); }
  function listStudents(options){
    options = options || {};
    var rows = U.filterStudents(cache().students, options);
    var limit = Number(options.limit || 0);
    if(limit > 0){ rows = rows.slice(0, limit); }
    return { ok:true, rows:rows, total:rows.length, periodList:listPeriods(), source:"BDLocalConTabla" };
  }
  function getStudents(options){ return listStudents(options || {}).rows; }
  function listAllStudents(){ return getStudents({ matricula:"" }); }
  function listStudentsByStatus(status, periodoId){ return getStudents({ matricula:status || "", periodoId:periodoId || "" }); }
  function getStudentById(id, options){
    id = U.text(id);
    if(!id){ return null; }
    return getStudents(Object.assign({}, options || {}, { matricula:(options && options.matricula) == null ? "" : options.matricula })).filter(function(row){
      return U.text(row.id) === id || U.text(row._id) === id || U.text(row.cedula) === id || U.text(row.numeroIdentificacion) === id;
    })[0] || null;
  }
  function getStudentByCedula(cedula, periodoId){
    cedula = U.normalizeCedula(cedula);
    return getStudents({ periodoId:periodoId || "", matricula:"" }).filter(function(row){
      return U.normalizeCedula(row.cedula || row.numeroIdentificacion) === cedula;
    })[0] || null;
  }
  function refresh(){ return HUB.refreshCache({ source:"cone.tabla.refresh" }); }

  var api = {
    version:"1.0.0",
    source:"BDLocal/conexiones/cone.tabla.js",
    ready:HUB.ready,
    refresh:refresh,
    listPeriods:listPeriods,
    getPeriods:listPeriods,
    periods:listPeriods,
    periodos:listPeriods,
    listStudents:listStudents,
    getStudents:getStudents,
    rows:getStudents,
    getRows:getStudents,
    listarEstudiantes:getStudents,
    listAllStudents:listAllStudents,
    filterStudents:function(options){ return getStudents(options || {}); },
    listStudentsByStatus:listStudentsByStatus,
    getStudentById:getStudentById,
    getStudentByCedula:getStudentByCedula,
    buscarPorCedula:getStudentByCedula,
    search:function(query, options){ return listStudents(Object.assign({}, options || {}, { search:query || "" })); }
  };

  HUB.register("tabla", api);
  window.BDLocalTabla = api;
  window.ConTabla = api;

  window.ExcelLocalRepo = Object.assign({}, window.ExcelLocalRepo || {}, api, {
    getSnapshot:function(){
      var c = cache();
      return { meta:c.meta, periods:c.periods, students:c.students, history:[], diagnostics:c.diagnostics || [] };
    },
    all:getStudents,
    listar:getStudents,
    byCedula:getStudentByCedula
  });

  window.BL2DataEngine = Object.assign({}, window.BL2DataEngine || {}, {
    source:"BDLocalConTabla",
    listPeriods:listPeriods,
    getPeriods:listPeriods,
    periods:listPeriods,
    listStudents:listStudents,
    getStudents:getStudents,
    getStudentById:getStudentById,
    getStudentByCedula:getStudentByCedula,
    search:function(options){ return listStudents(options || {}); }
  });

  window.BL2EstudiantesRepo = Object.assign({}, window.BL2EstudiantesRepo || {}, {
    buscar:function(options){ return listStudents(options || {}); },
    listPeriods:listPeriods,
    obtenerPorCedula:getStudentByCedula,
    getStudentById:getStudentById
  });
})(window);

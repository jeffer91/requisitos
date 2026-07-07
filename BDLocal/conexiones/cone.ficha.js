(function(window){
  "use strict";
  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;
  if(!HUB || !U){ return; }

  function rows(options){
    options = options || {};
    var cache = U.readCache();
    var list = U.filterStudents(cache.students, options);
    var limit = Number(options.limit || 0);
    return limit > 0 ? list.slice(0, limit) : list;
  }
  function periods(){ return U.readCache().periods.map(U.normalizePeriod).filter(Boolean); }
  function divisions(options){
    var map = {};
    rows(Object.assign({}, options || {}, { limit:0 })).forEach(function(row){
      var div = U.text(row._division || row.division || "Sin división") || "Sin división";
      map[div] = true;
    });
    return Object.keys(map).sort(function(a, b){ return a.localeCompare(b, "es"); });
  }
  function getStudentById(id, options){
    id = U.text(id);
    if(!id){ return null; }
    return rows(Object.assign({}, options || {}, { matricula:(options && options.matricula) == null ? "" : options.matricula })).filter(function(row){
      return U.text(row.id) === id || U.text(row._id) === id || U.text(row.cedula) === id || U.text(row.numeroIdentificacion) === id;
    })[0] || null;
  }
  function getStudentByCedula(cedula, periodoId){
    cedula = U.normalizeCedula(cedula);
    return rows({ periodoId:periodoId || "", matricula:"" }).filter(function(row){
      return U.normalizeCedula(row.cedula || row.numeroIdentificacion) === cedula;
    })[0] || null;
  }
  function getRequirements(filter){
    filter = filter || {};
    var reqs = U.readCache().requirements || [];
    var periodoId = U.canonicalPeriodId(filter.periodoId || filter.periodId || "");
    var cedula = U.normalizeCedula(filter.cedula || filter.numeroIdentificacion || "");
    return reqs.filter(function(req){
      if(periodoId && !U.samePeriod(req.periodoId, periodoId)){ return false; }
      if(cedula && U.normalizeCedula(req.cedula) !== cedula){ return false; }
      return true;
    });
  }
  function updateStudent(id, changes, options){
    return HUB.ensureCoreReady().then(function(){
      if(window.BL2Core && typeof window.BL2Core.updateStudent === "function"){
        return window.BL2Core.updateStudent(id, changes || {}, options || {}).then(function(saved){
          return HUB.refreshCache({ source:"cone.ficha.updateStudent" }).then(function(){ return saved; });
        });
      }
      return Promise.reject(new Error("BL2Core.updateStudent no esta disponible."));
    });
  }
  function forFicha(id, options){
    var student = getStudentById(id, options || {});
    return { found:!!student, student:student, source:"BDLocalConFicha" };
  }

  var api = {
    version:"1.0.0",
    source:"BDLocal/conexiones/cone.ficha.js",
    ready:HUB.ready,
    refresh:function(){ return HUB.refreshCache({ source:"cone.ficha.refresh" }); },
    periods:periods,
    listPeriods:periods,
    getPeriods:periods,
    rows:rows,
    listStudents:function(options){ var r = rows(options || {}); return { ok:true, rows:r, total:r.length, source:"BDLocalConFicha" }; },
    getStudents:rows,
    filter:rows,
    divisions:divisions,
    getStudentById:getStudentById,
    getStudentByCedula:getStudentByCedula,
    buscarPorCedula:getStudentByCedula,
    getRequirements:getRequirements,
    updateStudent:updateStudent,
    actualizarEstudiante:updateStudent,
    forFicha:forFicha
  };

  HUB.register("ficha", api);
  window.BDLocalFicha = api;
  window.ConFicha = api;
  window.BL2ScreenAdapter = Object.assign({}, window.BL2ScreenAdapter || {}, {
    forFicha:forFicha,
    listStudents:api.listStudents,
    getStudentById:getStudentById
  });
})(window);

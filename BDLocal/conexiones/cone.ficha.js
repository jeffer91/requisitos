/* =========================================================
Nombre completo: cone.ficha.js
Ruta o ubicación: /BDLocal/conexiones/cone.ficha.js
Función o funciones:
- Conectar Ficha con la caché consolidada de BDLocal.
- Consultar estudiantes, períodos, divisiones y requisitos.
- Guardar ediciones mediante BL2Core.updateStudent.
- Exponer métodos de actualización compatibles con FichaModalidad.
- Refrescar la caché y la cola después de cada edición.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.1.0-write-through";
  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;
  if(!HUB || !U){ return; }

  function rows(options){
    options = options || {};
    var cache = U.readCache();
    var list = U.filterStudents(cache.students || [],options);
    var limit = Number(options.limit || 0);
    return limit > 0 ? list.slice(0,limit) : list;
  }

  function periods(){ return (U.readCache().periods || []).map(U.normalizePeriod).filter(Boolean); }

  function divisions(options){
    var map = {};
    rows(Object.assign({},options || {},{ limit:0 })).forEach(function(row){
      var division = U.text(row._division || row.division || "Sin división") || "Sin división";
      map[division] = true;
    });
    return Object.keys(map).sort(function(a,b){ return a.localeCompare(b,"es"); });
  }

  function getStudentById(id,options){
    id = U.text(id);
    if(!id){ return null; }
    return rows(Object.assign({},options || {},{
      matricula:options && options.matricula != null ? options.matricula : ""
    })).filter(function(row){
      return U.text(row.id) === id || U.text(row._id) === id ||
        U.text(row.studentId) === id || U.text(row.idEstudiantePeriodo) === id ||
        U.text(row.cedula) === id || U.text(row.numeroIdentificacion) === id;
    })[0] || null;
  }

  function getStudentByCedula(cedula,periodoId){
    cedula = U.normalizeCedula(cedula);
    return rows({ periodoId:periodoId || "",matricula:"" }).filter(function(row){
      return U.normalizeCedula(row.cedula || row.numeroIdentificacion) === cedula;
    })[0] || null;
  }

  function getRequirements(filter){
    filter = filter || {};
    var requirements = U.readCache().requirements || [];
    var periodoId = U.canonicalPeriodId(filter.periodoId || filter.periodId || "");
    var cedula = U.normalizeCedula(filter.cedula || filter.numeroIdentificacion || "");
    return requirements.filter(function(requirement){
      if(periodoId && !U.samePeriod(requirement.periodoId || requirement.periodId,periodoId)){ return false; }
      if(cedula && U.normalizeCedula(requirement.cedula || requirement.numeroIdentificacion) !== cedula){ return false; }
      return true;
    });
  }

  function updateStudent(id,changes,options){
    options = Object.assign({},options || {});
    var periodoId = U.canonicalPeriodId(options.periodoId || options.periodId || "");
    return HUB.ensureCoreReady().then(function(){
      if(!window.BL2Core || typeof window.BL2Core.updateStudent !== "function"){
        throw new Error("BL2Core.updateStudent no está disponible.");
      }
      return window.BL2Core.updateStudent(id,changes || {},options);
    }).then(function(saved){
      return HUB.refreshCache({
        source:"cone.ficha.updateStudent",
        periodoId:periodoId,
        full:true,
        immediate:true
      }).then(function(){
        try{
          window.dispatchEvent(new CustomEvent("ficha:student-saved",{
            detail:{ ok:true,id:id,periodoId:periodoId,changes:changes || {} }
          }));
        }catch(error){}
        return saved;
      });
    });
  }

  function updateStudentField(id,field,value,options){
    var changes = {};
    changes[field] = value;
    return updateStudent(id,changes,options || {});
  }

  function trackedUpdate(id,changes,options){
    return updateStudent(id,changes,options || {}).catch(function(error){
      try{
        window.dispatchEvent(new CustomEvent("ficha:student-save-error",{
          detail:{ ok:false,id:id,message:error && error.message ? error.message : String(error) }
        }));
      }catch(innerError){}
      return null;
    });
  }

  function forFicha(id,options){
    var student = getStudentById(id,options || {});
    return { found:!!student,student:student,source:"BDLocalConFicha" };
  }

  var api = {
    version:VERSION,
    source:"BDLocal/conexiones/cone.ficha.js",
    ready:HUB.ready,
    refresh:function(options){ return HUB.refreshCache(Object.assign({ source:"cone.ficha.refresh",full:true,immediate:true },options || {})); },
    periods:periods,
    listPeriods:periods,
    getPeriods:periods,
    rows:rows,
    listStudents:function(options){ var result = rows(options || {}); return { ok:true,rows:result,total:result.length,source:"BDLocalConFicha" }; },
    getStudents:rows,
    filter:rows,
    divisions:divisions,
    getStudentById:getStudentById,
    getStudentByCedula:getStudentByCedula,
    buscarPorCedula:getStudentByCedula,
    getRequirements:getRequirements,
    updateStudent:updateStudent,
    actualizarEstudiante:updateStudent,
    updateStudentField:updateStudentField,
    forFicha:forFicha
  };

  HUB.register("ficha",api);
  window.BDLocalFicha = api;
  window.ConFicha = api;

  window.BL2ScreenAdapter = Object.assign({},window.BL2ScreenAdapter || {},{
    forFicha:forFicha,
    listStudents:api.listStudents,
    getStudentById:getStudentById,
    updateStudent:trackedUpdate,
    updateStudentField:function(id,field,value,options){
      return trackedUpdate(id,(function(){ var patch = {}; patch[field] = value; return patch; })(),options || {});
    }
  });

  window.BL2EstudiantesRepo = Object.assign({},window.BL2EstudiantesRepo || {},{
    updateStudent:trackedUpdate,
    actualizar:trackedUpdate
  });
  window.ExcelLocalRepo = Object.assign({},window.ExcelLocalRepo || {},{
    updateStudent:trackedUpdate,
    updateStudentField:function(id,field,value,options){
      var patch = {};
      patch[field] = value;
      return trackedUpdate(id,patch,options || {});
    }
  });
  window.BL2DataEngine = Object.assign({},window.BL2DataEngine || {},{
    updateStudent:trackedUpdate
  });
})(window);

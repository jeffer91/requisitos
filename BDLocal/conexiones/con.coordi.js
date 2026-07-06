/* =========================================================
Nombre completo: con.coordi.js
Ruta o ubicacion: /Requisitos/BDLocal/conexiones/con.coordi.js
Funcion:
- Conectar pantallas de coordinacion con BDLocal.
- Reutilizar la conexion de Tabla para consultas y filtros.
========================================================= */
(function(window){
  "use strict";

  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;
  if(!HUB || !U){ return; }

  function tabla(){ return HUB.get("tabla") || window.BDLocalTabla || null; }

  function listPeriods(){
    return tabla() && typeof tabla().listPeriods === "function" ? tabla().listPeriods() : U.readCache().periods;
  }

  function listStudents(options){
    if(tabla() && typeof tabla().listStudents === "function"){
      return tabla().listStudents(options || {});
    }
    var rows = U.filterStudents(U.readCache().students, options || {});
    return { ok:true, rows:rows, total:rows.length, source:"BDLocalConCoordi" };
  }

  function getStudents(options){ return listStudents(options || {}).rows; }

  var api = {
    version:"1.0.0",
    source:"BDLocal/conexiones/con.coordi.js",
    ready:HUB.ready,
    refresh:function(){ return HUB.refreshCache({ source:"con.coordi.refresh" }); },
    listPeriods:listPeriods,
    getPeriods:listPeriods,
    periods:listPeriods,
    listStudents:listStudents,
    getStudents:getStudents,
    rows:getStudents,
    buscar:listStudents,
    getStudentByCedula:function(cedula, periodoId){
      var found = getStudents({ periodoId:periodoId || "", matricula:"" }).filter(function(row){
        return U.normalizeCedula(row.cedula || row.numeroIdentificacion) === U.normalizeCedula(cedula);
      })[0] || null;
      return found;
    }
  };

  HUB.register("coordi", api);
  window.BDLocalCoordi = api;
  window.ConCoordi = api;
})(window);

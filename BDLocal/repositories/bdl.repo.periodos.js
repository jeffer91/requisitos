(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  var P = window.BDLNormPeriodo;
  if(!B || !P){ throw new Error("BDLRepoPeriodos requiere BDLRepoBase y BDLNormPeriodo."); }

  function clean(periodo){
    var row = Object.assign({}, periodo || {});
    if(!row.periodoId){
      row = P.normalize(row, row._docId || row.id || row.value || row.label || row.periodoLabel || "");
    }
    row.periodoId = row.periodoId || row.id || row.value || "SIN_PERIODO";
    row.periodoLabel = row.periodoLabel || row.label || row.nombre || row.periodoId;
    row.estado = row.estado || "ACTIVO";
    row.activo = row.activo !== false;
    row.updatedAt = B.now();
    return row;
  }

  function guardar(periodo){
    var row = clean(periodo);
    return B.put(B.stores.periodos, row).then(function(){
      B.cacheClear();
      return row;
    });
  }

  function guardarDesdeRegistro(registro, fallback){
    return guardar(P.normalize(registro || {}, fallback));
  }

  function guardarMuchos(periodos){
    return B.putAll(B.stores.periodos, B.asArray(periodos).map(clean)).then(function(result){
      B.cacheClear();
      return result;
    });
  }

  function listar(){
    return B.list(B.stores.periodos, { limit: 0 }).then(function(rows){
      return rows.sort(function(a, b){
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
    });
  }

  function activos(){
    return B.byIndex(B.stores.periodos, "by_activo", true, { limit: 0 });
  }

  window.BDLRepoPeriodos = {
    guardar: guardar,
    guardarDesdeRegistro: guardarDesdeRegistro,
    guardarMuchos: guardarMuchos,
    listar: listar,
    activos: activos
  };
})(window);

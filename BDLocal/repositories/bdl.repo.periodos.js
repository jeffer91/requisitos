(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  var P = window.BDLNormPeriodo;
  if(!B || !P){ throw new Error("BDLRepoPeriodos requiere BDLRepoBase y BDLNormPeriodo."); }

  function guardar(periodo){
    var row = Object.assign({}, periodo || {});
    if(!row.periodoId){ row = P.normalize(row); }
    row.updatedAt = B.now();
    return B.put(B.stores.periodos, row).then(function(){
      B.cacheClear();
      return row;
    });
  }

  function guardarDesdeRegistro(registro, fallback){
    return guardar(P.normalize(registro || {}, fallback));
  }

  function guardarMuchos(periodos){
    return B.putAll(B.stores.periodos, B.asArray(periodos).map(function(p){
      p.updatedAt = B.now();
      return p;
    })).then(function(result){
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

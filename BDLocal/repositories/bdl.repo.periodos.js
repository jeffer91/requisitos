(function(window){
  "use strict";
  var B = window.BDLRepoBase;
  var P = window.BDLNormPeriodo;
  if(!B || !P){ throw new Error("BDLRepoPeriodos requiere BDLRepoBase y BDLNormPeriodo."); }

  var MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  function clean(periodo){
    var row = Object.assign({}, periodo || {});
    var normalized = P.normalize(row, row._docId || row.id || row.value || row.label || row.periodoLabel || row.periodoId || "");
    normalized.estado = normalized.estado || "ACTIVO";
    normalized.activo = normalized.activo !== false;
    normalized.updatedAt = B.now();
    return normalized;
  }
  function build(mesInicio, anioInicio, mesFin, anioFin){
    var mi = Math.max(1, Math.min(12, Number(mesInicio || 1)));
    var mf = Math.max(1, Math.min(12, Number(mesFin || 1)));
    var ai = Number(anioInicio || new Date().getFullYear());
    var af = Number(anioFin || ai);
    return clean({ periodoLabel: MESES[mi - 1] + " " + ai + " a " + MESES[mf - 1] + " " + af });
  }
  function guardar(periodo){ var row = clean(periodo); return B.put(B.stores.periodos, row).then(function(){ B.cacheClear(); return row; }); }
  function guardarManual(data){ return guardar(build(data.mesInicio, data.anioInicio, data.mesFin, data.anioFin)); }
  function guardarDesdeRegistro(registro, fallback){ return guardar(P.normalize(registro || {}, fallback)); }
  function guardarMuchos(periodos){
    var map = {};
    B.asArray(periodos).map(clean).forEach(function(row){ if(row.periodoId !== "SIN_PERIODO"){ map[row.periodoId] = Object.assign(map[row.periodoId] || {}, row); } });
    return B.putAll(B.stores.periodos, Object.keys(map).map(function(k){ return map[k]; })).then(function(result){ B.cacheClear(); return result; });
  }
  function listar(){
    return B.list(B.stores.periodos, { limit:0 }).then(function(rows){
      var map = {};
      B.asArray(rows).forEach(function(row){
        var c = clean(row);
        if(c.periodoId === "SIN_PERIODO"){ return; }
        map[c.periodoId] = Object.assign(map[c.periodoId] || {}, c);
      });
      return Object.keys(map).map(function(k){ return map[k]; }).sort(function(a,b){
        return String(b.periodoId || "").localeCompare(String(a.periodoId || ""));
      });
    });
  }
  function activos(){ return listar(); }
  function borrar(periodoId){ return B.remove(B.stores.periodos, periodoId).then(function(){ B.cacheClear(); return { ok:true, periodoId:periodoId }; }); }
  function purgar(){
    return B.list(B.stores.periodos, { limit:0 }).then(function(rows){
      var canon = {}, deletes = [], total = rows.length;
      B.asArray(rows).forEach(function(row){
        var oldId = row && row.periodoId;
        var c = clean(row);
        if(c.periodoId === "SIN_PERIODO"){ if(oldId){ deletes.push(oldId); } return; }
        canon[c.periodoId] = Object.assign(canon[c.periodoId] || {}, c);
        if(oldId && oldId !== c.periodoId){ deletes.push(oldId); }
      });
      var chain = Promise.resolve();
      deletes.forEach(function(id){ chain = chain.then(function(){ return B.remove(B.stores.periodos, id).catch(function(){ return null; }); }); });
      return chain.then(function(){ return B.putAll(B.stores.periodos, Object.keys(canon).map(function(k){ return canon[k]; })); }).then(function(){ B.cacheClear(); return { ok:true, revisados:total, normalizados:Object.keys(canon).length, borrados:deletes.length }; });
    });
  }

  window.BDLRepoPeriodos = { meses:MESES, build:build, guardar:guardar, guardarManual:guardarManual, guardarDesdeRegistro:guardarDesdeRegistro, guardarMuchos:guardarMuchos, listar:listar, activos:activos, borrar:borrar, purgar:purgar };
})(window);
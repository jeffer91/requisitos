(function(window){
  "use strict";
  var B = window.BDLRepoBase;
  var P = window.BDLNormPeriodo;
  if(!B || !P){ throw new Error("BDLRepoPeriodos requiere BDLRepoBase y BDLNormPeriodo."); }
  var MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  function two(n){ return String(n < 10 ? "0" + n : n); }
  function clean(periodo){
    var row = Object.assign({}, periodo || {});
    if(!row.periodoId){ row = P.normalize(row, row._docId || row.id || row.value || row.label || row.periodoLabel || ""); }
    row.periodoId = row.periodoId || row.id || row.value || "SIN_PERIODO";
    row.periodoLabel = row.periodoLabel || row.label || row.nombre || row.periodoId;
    row.estado = row.estado || "ACTIVO";
    row.activo = row.activo !== false;
    row.updatedAt = B.now();
    return row;
  }
  function build(mesInicio, anioInicio, mesFin, anioFin){
    var mi = Math.max(1, Math.min(12, Number(mesInicio || 1)));
    var mf = Math.max(1, Math.min(12, Number(mesFin || 1)));
    var ai = Number(anioInicio || new Date().getFullYear());
    var af = Number(anioFin || ai);
    var label = MESES[mi - 1] + " " + ai + " a " + MESES[mf - 1] + " " + af;
    var id = ai + "-" + two(mi) + "__" + af + "-" + two(mf);
    return { periodoId:id, periodoLabel:label, mesInicio:mi, anioInicio:ai, mesFin:mf, anioFin:af, estado:"ACTIVO", activo:true };
  }
  function guardar(periodo){ var row = clean(periodo); return B.put(B.stores.periodos, row).then(function(){ B.cacheClear(); return row; }); }
  function guardarManual(data){ return guardar(build(data.mesInicio, data.anioInicio, data.mesFin, data.anioFin)); }
  function guardarDesdeRegistro(registro, fallback){ return guardar(P.normalize(registro || {}, fallback)); }
  function guardarMuchos(periodos){ return B.putAll(B.stores.periodos, B.asArray(periodos).map(clean)).then(function(result){ B.cacheClear(); return result; }); }
  function listar(){ return B.list(B.stores.periodos, { limit:0 }).then(function(rows){ return rows.sort(function(a,b){ return String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")); }); }); }
  function activos(){ return B.byIndex(B.stores.periodos, "by_activo", true, { limit:0 }); }
  function borrar(periodoId){ return B.remove(B.stores.periodos, periodoId).then(function(){ B.cacheClear(); return { ok:true, periodoId:periodoId }; }); }
  window.BDLRepoPeriodos = { meses:MESES, build:build, guardar:guardar, guardarManual:guardarManual, guardarDesdeRegistro:guardarDesdeRegistro, guardarMuchos:guardarMuchos, listar:listar, activos:activos, borrar:borrar };
})(window);
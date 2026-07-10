/* =========================================================
Nombre completo: stats.carrera.guard.js
Ruta: /Stats/stats.carrera.guard.js
Función:
- Normalizar nombres de carreras ya cargadas antes de renderizar Stats.
- Evitar que nombres mal escritos agrupen mal estadísticas y filtros.
========================================================= */
(function(window){
  "use strict";

  function normalizeName(value){
    if(window.BDLNormCarrera){ return window.BDLNormCarrera.normalize(value).nombre; }
    return String(value == null ? "" : value).trim().toUpperCase() || "SIN CARRERA";
  }
  function pct(n,d){ return d ? Math.round((Number(n || 0) * 10000) / Number(d || 0)) / 100 : 0; }
  function normRow(row){
    row = Object.assign({}, row || {});
    var original = row._carrera || row.nombreCarrera || row.NombreCarrera || row.carrera || row.Carrera || "SIN CARRERA";
    var name = normalizeName(original);
    row._carreraOriginal = original;
    row._carrera = name;
    row.nombreCarrera = name;
    row.NombreCarrera = name;
    row.carrera = name;
    row.Carrera = name;
    return row;
  }
  function rebuildCarreras(rows){
    var map = {};
    (rows || []).forEach(function(row){
      row = normRow(row);
      var key = row._carrera || "SIN CARRERA";
      if(!map[key]){ map[key] = { key:key, total:0, cumple:0, pendiente:0, no_cumple:0, avance:0 }; }
      map[key].total += 1;
      var estado = row._estado && row._estado.id ? row._estado.id : "no_cumple";
      map[key][estado] = (map[key][estado] || 0) + 1;
    });
    Object.keys(map).forEach(function(key){ map[key].avance = pct(map[key].cumple, map[key].total); });
    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a,b){ return b.total - a.total || a.key.localeCompare(b.key,"es"); });
  }
  function patch(){
    if(!window.StatsCore || window.StatsCore.__carreraGuardPatched){ return false; }
    var originalResumen = window.StatsCore.resumen;
    var originalFiltered = window.StatsCore.filtered;
    window.StatsCore.resumen = function(opts){
      var data = originalResumen.call(window.StatsCore, opts || {});
      var rows = (data.rows || data.estudiantes || []).map(normRow);
      data.rows = rows;
      data.estudiantes = rows;
      data.carreras = rebuildCarreras(rows);
      data.careerList = data.carreras.map(function(c){ return c.key; });
      return data;
    };
    if(typeof originalFiltered === "function"){
      window.StatsCore.filtered = function(opts){ return (originalFiltered.call(window.StatsCore, opts || {}) || []).map(normRow); };
    }
    window.StatsCore.__carreraGuardPatched = true;
    return true;
  }
  patch();
  window.StatsCarreraGuard = { patch:patch, normalizeRow:normRow, rebuildCarreras:rebuildCarreras };
})(window);
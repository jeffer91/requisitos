(function(window){
  "use strict";

  var T = window.BDLNormText;
  if(!T){ throw new Error("BDLNormText debe cargarse antes de BDLNormPeriodo."); }

  var months = { enero:"01", ene:"01", febrero:"02", feb:"02", marzo:"03", mar:"03", abril:"04", abr:"04", mayo:"05", may:"05", junio:"06", jun:"06", julio:"07", jul:"07", agosto:"08", ago:"08", septiembre:"09", setiembre:"09", sep:"09", sept:"09", octubre:"10", oct:"10", noviembre:"11", nov:"11", diciembre:"12", dic:"12" };

  function extractYears(value){ return T.text(value).match(/20\d{2}/g) || []; }
  function extractMonths(value){
    var found = [];
    T.searchKey(value).split(" ").forEach(function(part){ var m = months[part] || ""; if(m && found.indexOf(m) < 0){ found.push(m); } });
    return found;
  }
  function buildId(value){
    var raw = T.text(value);
    if(!raw){ return "SIN_PERIODO"; }
    if(/^20\d{2}-\d{2}__20\d{2}-\d{2}$/.test(raw)){ return raw; }
    var years = extractYears(raw);
    var ms = extractMonths(raw);
    if(years.length >= 2 && ms.length >= 2){ return years[0] + "-" + ms[0] + "__" + years[1] + "-" + ms[1]; }
    if(years.length >= 1 && ms.length >= 2){ return years[0] + "-" + ms[0] + "__" + years[0] + "-" + ms[1]; }
    return T.key(raw) || "SIN_PERIODO";
  }
  function normalize(row, fallback){
    row = row || {};
    var raw = T.first(row, ["periodoId", "PeriodoId", "periodo", "Periodo", "periodoLabel", "PeriodoLabel", "cohorte", "Cohorte"]) || fallback || "";
    var id = buildId(raw);
    var revision = id === "SIN_PERIODO";
    return { periodoId:id, periodoLabel:T.cleanSpaces(row.periodoLabel || row.PeriodoLabel || raw) || "Sin período", estado:revision ? "REVISION" : "ACTIVO", activo:!revision, requiereRevision:revision, motivo:revision ? "periodoId vacío o no detectado" : "", totalEstudiantes:0, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
  }

  window.BDLNormPeriodo = { normalize:normalize, buildId:buildId, extractYears:extractYears, extractMonths:extractMonths };
})(window);
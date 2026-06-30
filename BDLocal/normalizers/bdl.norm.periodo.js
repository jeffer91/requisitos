(function(window){
  "use strict";

  var T = window.BDLNormText;
  if(!T){ throw new Error("BDLNormText debe cargarse antes de BDLNormPeriodo."); }

  var nombres = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  var months = { enero:1, ene:1, febrero:2, feb:2, marzo:3, mar:3, abril:4, abr:4, mayo:5, may:5, junio:6, jun:6, julio:7, jul:7, agosto:8, ago:8, septiembre:9, setiembre:9, sep:9, sept:9, octubre:10, oct:10, noviembre:11, nov:11, diciembre:12, dic:12 };

  function two(n){ n = Number(n || 0); return n < 10 ? "0" + n : String(n); }
  function titleMonth(n){ return nombres[Math.max(1, Math.min(12, Number(n || 1))) - 1]; }
  function label(ai, mi, af, mf){ return titleMonth(mi) + " " + ai + " a " + titleMonth(mf) + " " + af; }
  function id(ai, mi, af, mf){ return Number(ai) + "-" + two(mi) + "__" + Number(af) + "-" + two(mf); }
  function extractYears(value){ return T.text(value).match(/20\d{2}/g) || []; }
  function extractTextMonths(value){
    var found = [];
    T.searchKey(value).split(" ").forEach(function(part){ var m = months[part] || 0; if(m && found.indexOf(m) < 0){ found.push(m); } });
    return found;
  }
  function fromNumeric(raw){
    var m = T.text(raw).match(/(20\d{2})[-_\s]?(0?[1-9]|1[0-2])[-_\s]+(20\d{2})[-_\s]?(0?[1-9]|1[0-2])/);
    if(!m){ return null; }
    return { anioInicio:Number(m[1]), mesInicio:Number(m[2]), anioFin:Number(m[3]), mesFin:Number(m[4]) };
  }
  function parts(value){
    var raw = T.text(value);
    var n = fromNumeric(raw);
    if(n){ return n; }
    var years = extractYears(raw);
    var ms = extractTextMonths(raw);
    if(years.length >= 2 && ms.length >= 2){ return { anioInicio:Number(years[0]), mesInicio:ms[0], anioFin:Number(years[1]), mesFin:ms[1] }; }
    if(years.length >= 1 && ms.length >= 2){ return { anioInicio:Number(years[0]), mesInicio:ms[0], anioFin:Number(years[0]), mesFin:ms[1] }; }
    return null;
  }
  function normalize(row, fallback){
    row = row || {};
    var raw = T.first(row, ["periodoLabel", "PeriodoLabel", "label", "nombre", "periodoId", "PeriodoId", "periodo", "Periodo", "cohorte", "Cohorte", "id"]) || fallback || "";
    var p = parts(raw) || parts(row.id) || parts(row._docId);
    if(!p){
      return { periodoId:"SIN_PERIODO", periodoLabel:"Sin período", estado:"REVISION", activo:false, requiereRevision:true, motivo:"período vacío o no detectado", totalEstudiantes:0, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
    }
    return { periodoId:id(p.anioInicio, p.mesInicio, p.anioFin, p.mesFin), periodoLabel:label(p.anioInicio, p.mesInicio, p.anioFin, p.mesFin), mesInicio:p.mesInicio, anioInicio:p.anioInicio, mesFin:p.mesFin, anioFin:p.anioFin, estado:"ACTIVO", activo:true, requiereRevision:false, motivo:"", totalEstudiantes:Number(row.totalEstudiantes || 0), createdAt:row.createdAt || row.creadoEn || new Date().toISOString(), updatedAt:new Date().toISOString() };
  }

  window.BDLNormPeriodo = { normalize:normalize, buildId:function(v){ return normalize({}, v).periodoId; }, label:label, id:id, parts:parts, extractYears:extractYears, extractMonths:extractTextMonths };
})(window);
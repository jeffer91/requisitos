(function(window){
  "use strict";

  var KEY = "REQ_BDLOCAL_LEGACY_SNAPSHOT_V1";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value == null ? null : value)); }catch(error){ return value; } }
  function read(){
    try{ return JSON.parse(window.localStorage.getItem(KEY) || window.localStorage.getItem("REQ_EXCEL_LOCAL_V1:snapshot") || "{}"); }catch(error){ return {}; }
  }
  function snapshot(){
    var s = read();
    s.periods = Array.isArray(s.periods) ? s.periods : [];
    s.students = Array.isArray(s.students) ? s.students : [];
    s.history = Array.isArray(s.history) ? s.history : [];
    s.diagnostics = Array.isArray(s.diagnostics) ? s.diagnostics : [];
    s.meta = s.meta || {};
    return s;
  }
  function writeSnapshot(s){
    s = s || { periods:[], students:[], history:[], diagnostics:[], meta:{} };
    try{ window.localStorage.setItem(KEY, JSON.stringify(s)); }catch(error){}
    try{ window.localStorage.setItem("REQ_EXCEL_LOCAL_V1:snapshot", JSON.stringify(s)); }catch(error){}
    return clone(s);
  }
  function periodIdOf(row){ row = row || {}; return text(row.periodoId || row.PeriodoId || row.periodId || row.idPeriodo || row.periodo || row.Periodo || row.periodoLabel || row.PeriodoLabel || row._periodoId || row._periodo); }
  function samePeriod(a,b){ if(!text(b)){ return true; } return text(a) === text(b) || norm(a) === norm(b); }
  function divisionOf(row){ row = row || {}; return row._bl2Division || row.divisionPrincipal || row.division || row.Division || row["División"] || (Array.isArray(row.divisiones) ? row.divisiones[0] : "") || "Sin división"; }
  function estadoMatricula(row){ var v = norm((row || {}).estadoMatricula || (row || {}).EstadoMatricula || (row || {}).estado || (row || {}).Estado || (row || {})._estadoMatricula); return v.indexOf("retir") >= 0 ? "RETIRADO" : "ACTIVO"; }
  function filterStudents(opts){
    opts = opts || {};
    var s = snapshot();
    var p = text(opts.periodoId || opts.periodId || opts.period || "");
    var d = text(opts.division || "");
    var m = text(opts.estadoMatricula || opts.matricula || "");
    var rows = s.students.slice().filter(function(row){
      if(p && !samePeriod(periodIdOf(row), p)){ return false; }
      if(d && norm(divisionOf(row)) !== norm(d)){ return false; }
      if(m && estadoMatricula(row) !== m){ return false; }
      return true;
    });
    return rows;
  }
  function listPeriods(){
    var s = snapshot();
    var map = {};
    s.periods.forEach(function(p){ var id = text(p.periodoId || p.id || p.value || p.label || p.periodoLabel || p); if(id){ map[id] = p; } });
    s.students.forEach(function(row){ var id = periodIdOf(row); if(id && !map[id]){ map[id] = { id:id, periodoId:id, value:id, label:id, periodoLabel:id }; } });
    return Object.keys(map).map(function(k){ return typeof map[k] === "string" ? { id:k, periodoId:k, value:k, label:k, periodoLabel:k } : map[k]; });
  }

  window.ExcelLocalConfig = window.ExcelLocalConfig || { keys:{ snapshot:"REQ_EXCEL_LOCAL_V1:snapshot" } };
  window.ExcelLocalStorage = window.ExcelLocalStorage || { readSnapshot:snapshot, writeSnapshot:writeSnapshot };
  window.ExcelLocalRepo = window.ExcelLocalRepo || { getSnapshot:snapshot, listPeriods:listPeriods, listAllStudents:function(){ return snapshot().students.slice(); }, filterStudents:filterStudents, listStudentsByStatus:function(status, periodId){ return filterStudents({ matricula:status, periodId:periodId }); } };
  window.BLPeriodosCanon = window.BLPeriodosCanon || { samePeriod:samePeriod, normalizePeriod:function(p){ var id=text(p && (p.periodoId || p.id || p.value) || p); return { id:id, periodoId:id, value:id, label:text(p && (p.periodoLabel || p.label) || id), periodoLabel:text(p && (p.periodoLabel || p.label) || id) }; } };
  window.BLDivisionesService = window.BLDivisionesService || { studentDivision:divisionOf, hasDivision:function(row,d){ return !text(d) || norm(divisionOf(row)) === norm(d); }, listDivisionsWithEmpty:function(rows){ var m={}; (rows || []).forEach(function(r){ m[divisionOf(r)] = true; }); return Object.keys(m); } };
  window.BLCampos = window.BLCampos || { requirementLabel:function(key, fallback){ return fallback || key; } };
  window.BLNotasDefensa = window.BLNotasDefensa || { normalizarNota:function(v){ var n=Number(text(v).replace(",", ".")); return Number.isFinite(n) ? n : null; }, redondear2:function(v){ return Number.isFinite(v) ? Math.round(v * 100) / 100 : null; }, calcularNfin:function(a,b){ a=this.normalizarNota(a); b=this.normalizarNota(b); return a !== null && b !== null && a >= 7 ? this.redondear2(a * 0.7 + b * 0.3) : null; }, formatearNota:function(v){ var n=this.normalizarNota(v); return n === null ? "" : String(this.redondear2(n)); }, validarNota:function(v){ var n=this.normalizarNota(v); return text(v) === "" || (n !== null && n >= 0 && n <= 10); }, aplicarNotas:function(row,nart,ndef){ var fin=this.calcularNfin(nart,ndef); return { Notart:nart, Notdef:ndef, Notafinal:fin, nart:nart, ndef:ndef, nfin:fin, updatedAt:new Date().toISOString() }; }, extraerNotas:function(row){ return { nart:this.normalizarNota((row||{}).Notart || (row||{}).nart), ndef:this.normalizarNota((row||{}).Notdef || (row||{}).ndef), nfin:this.normalizarNota((row||{}).Notafinal || (row||{}).nfin), completo:text((row||{}).Notafinal || (row||{}).nfin) !== "" }; } };
  window.BL2StudentNormalizer = window.BL2StudentNormalizer || { normalize:function(row){ return Object.assign({}, row || {}); } };
  window.BL2RequirementsEngine = window.BL2RequirementsEngine || window.StatsRules || null;
  window.BL2DataEngine = window.BL2DataEngine || { invalidate:function(){}, listPeriods:listPeriods, listStudents:function(opts){ var rows=filterStudents(opts); return { rows:rows, total:rows.length }; } };
  window.BL2EstudiantesRepo = window.BL2EstudiantesRepo || { buscar:function(opts){ var rows=filterStudents(opts); return { rows:rows, total:rows.length }; } };
  window.BL2CacheResumen = window.BL2CacheResumen || { invalidate:function(){} };
  window.BL2LegacyAdapter = window.BL2LegacyAdapter || { invalidate:function(){} };
  window.BL2 = window.BL2 || { invalidate:function(){} };
  window.BaseLocalConnector = window.BaseLocalConnector || { status:function(){ return { ok:true, source:"BDLocalCompat" }; } };
})(window);

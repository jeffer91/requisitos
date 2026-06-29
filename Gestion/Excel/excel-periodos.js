/* =========================================================
Nombre completo: excel-periodos.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-periodos.js
Función o funciones:
- Crear y listar períodos usando la misma base local de BL.
- Evitar una lista separada de períodos en Carga.
- Mantener compatibilidad con períodos antiguos solo si la base local está vacía.
- Crear períodos con ID técnico único y nombre visible uniforme.
Con qué se conecta:
- excel-ui.periodo.js
- excel-ui.cargar.js
- excel-local.storage.js
- bl-periodos-canon.service.js
- baselocal.connector.js
========================================================= */
(function(window){
  "use strict";

  var LEGACY_KEY = "REQ_EXCEL_PERIODOS";
  var SNAPSHOT_KEY = "REQ_EXCEL_LOCAL_V1:snapshot";
  var MONTHS = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  function n(value){var x = parseInt(String(value == null ? "" : value).trim(), 10);return Number.isFinite(x) ? x : null;}
  function text(value){return String(value == null ? "" : value).trim();}
  function pad2(value){return String(value).padStart(2, "0");}
  function now(){return new Date().toISOString();}
  function meses(month){return MONTHS[month] || String(month);}

  function readLegacy(){try{var rows = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");return Array.isArray(rows) ? rows : [];}catch(error){return [];}}
  function emptySnapshot(){return {meta:{app:"Requisitos", module:"ExcelLocal", version:"1.0.0", createdAt:now(), updatedAt:now()}, periods:[], students:[], history:[], diagnostics:[]};}
  function readSnapshot(){if(window.ExcelLocalStorage && typeof window.ExcelLocalStorage.readSnapshot === "function"){return window.ExcelLocalStorage.readSnapshot();}try{var raw = localStorage.getItem(SNAPSHOT_KEY);return raw ? JSON.parse(raw) : emptySnapshot();}catch(error){return emptySnapshot();}}
  function writeSnapshot(snapshot){var clean = snapshot || emptySnapshot();clean.meta = clean.meta && typeof clean.meta === "object" ? clean.meta : {};clean.periods = Array.isArray(clean.periods) ? clean.periods : [];clean.students = Array.isArray(clean.students) ? clean.students : [];clean.history = Array.isArray(clean.history) ? clean.history : [];clean.diagnostics = Array.isArray(clean.diagnostics) ? clean.diagnostics : [];clean.meta.updatedAt = now();if(window.ExcelLocalStorage && typeof window.ExcelLocalStorage.writeSnapshot === "function"){return window.ExcelLocalStorage.writeSnapshot(clean);}localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(clean));return clean;}

  function idFromParts(ia, im, fa, fm){return ia + "-" + pad2(im) + "__" + fa + "-" + pad2(fm);}
  function labelFromParts(ia, im, fa, fm){return meses(im) + " " + ia + " a " + meses(fm) + " " + fa;}
  function normalizeText(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}
  function isCedulaLike(value){return /^\d{7,13}$/.test(text(value));}

  function normalizePeriod(period){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.normalizePeriod === "function"){
      return window.BLPeriodosCanon.normalizePeriod(period);
    }
    var source = Object.assign({}, period || {});
    var label = text(source.label || source.periodoLabel || source.periodo || source.id);
    var id = text(source.id || source.periodoId || source.value || label);
    return Object.assign({}, source, {id:id, periodoId:id, label:label || id, periodoLabel:label || id, updatedAt:text(source.updatedAt || source.actualizadoEn) || now()});
  }

  function periodKey(period){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.keyFromPeriod === "function"){
      return window.BLPeriodosCanon.keyFromPeriod(period);
    }
    return normalizeText(period && (period.label || period.periodoLabel || period.periodo || period.id));
  }

  function isValidPeriod(period){
    var value = text(period && (period.label || period.periodoLabel || period.periodo || period.id));
    var clean = normalizeText(value);
    if(!value || isCedulaLike(value)){return false;}
    return clean === "sin periodo" || clean === "sin_periodo" || /20\d{2}/.test(clean);
  }

  function normalizeList(rows){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.dedupe === "function"){
      return window.BLPeriodosCanon.dedupe(rows || []);
    }
    var map = {};var list = [];
    (rows || []).forEach(function(row){var period = normalizePeriod(row);var key = periodKey(period);if(!isValidPeriod(period) || !key || map[key]){return;}map[key] = true;list.push(period);});
    return list.sort(function(a, b){return String(a.label || a.id).localeCompare(String(b.label || b.id), "es");});
  }

  function validate(ia, im, fa, fm){
    ia = n(ia);im = n(im);fa = n(fa);fm = n(fm);
    if(!ia || !fa){throw new Error("El año inicial y final son obligatorios.");}
    if(im < 1 || im > 12 || fm < 1 || fm > 12){throw new Error("Los meses deben estar entre 1 y 12.");}
    if((ia * 100 + im) > (fa * 100 + fm)){throw new Error("El período inicial no puede ser posterior al final.");}
    var raw = {inicioAnio:ia, inicioMes:im, finAnio:fa, finMes:fm, id:idFromParts(ia, im, fa, fm), periodoId:idFromParts(ia, im, fa, fm), label:labelFromParts(ia, im, fa, fm), periodoLabel:labelFromParts(ia, im, fa, fm)};
    return normalizePeriod(raw);
  }

  async function crearDesdePartes(ia, im, fa, fm){
    var period = validate(ia, im, fa, fm);
    var snapshot = readSnapshot();
    snapshot.periods = Array.isArray(snapshot.periods) ? snapshot.periods : [];
    snapshot.history = Array.isArray(snapshot.history) ? snapshot.history : [];
    var key = periodKey(period);
    var index = snapshot.periods.findIndex(function(item){return periodKey(item) === key || text(item.id || item.periodoId) === period.id;});
    if(index >= 0){snapshot.periods[index] = Object.assign({}, snapshot.periods[index], period, {updatedAt:now()});}
    else{snapshot.periods.push(Object.assign({}, period, {createdAt:now(), updatedAt:now(), source:"carga"}));snapshot.history.push({id:"periodo_" + Date.now(), action:"crearPeriodo", periodoId:period.id, periodoLabel:period.label, fileName:"Carga", totalRows:0, createdAt:now()});}
    snapshot.periods = normalizeList(snapshot.periods);
    snapshot.meta = Object.assign({}, snapshot.meta || {}, {lastPeriodId:period.id, totalPeriods:snapshot.periods.length, totalStudents:Array.isArray(snapshot.students) ? snapshot.students.length : 0});
    var saved = writeSnapshot(snapshot);
    try{if(window.RequisitosBL && typeof window.RequisitosBL.mirrorSnapshotToCollections === "function"){window.RequisitosBL.mirrorSnapshotToCollections({force:true, silent:true});window.RequisitosBL.notificar("snapshot-changed", {source:"excel-periodos", periodoId:period.id, totalPeriods:snapshot.meta.totalPeriods});}}catch(error){}
    return period;
  }

  async function listarTodos(){var snapshot = readSnapshot();var fromBaseLocal = normalizeList(snapshot.periods || []);if(fromBaseLocal.length){return fromBaseLocal;}return normalizeList(readLegacy());}
  async function asegurarDemo(){return listarTodos();}

  window.ExcelPeriodos = {crearDesdePartes:crearDesdePartes, listarTodos:listarTodos, asegurarDemo:asegurarDemo, validate:validate};
})(window);

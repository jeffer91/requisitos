/* =========================================================
Nombre completo: bl2-conflicts.js
Ruta o ubicación: /Requisitos/BaseLocal2/sync/bl2-conflicts.js
Función o funciones:
- Detectar y resolver conflictos entre Base Local e información remota.
- Priorizar el registro más nuevo por updatedAt/ultimaSincronizacion.
- Conservar campos útiles para no perder datos de Excel/Firebase.
- Mantener IDs coherentes con idLocal para BL2 y cédula para Firebase.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.1-safe-merge";
  function tx(v){return String(v == null ? "" : v).trim();}
  function tm(v){var n = Date.parse(tx(v));return Number.isFinite(n) ? n : 0;}
  function clone(v){try{return JSON.parse(JSON.stringify(v == null ? null : v));}catch(e){return v;}}
  function hasData(v){if(v === undefined || v === null){return false;}if(Array.isArray(v)){return v.length > 0;}if(typeof v === "object"){return Object.keys(v).length > 0;}return tx(v) !== "";}
  function rowId(row,entity){row = row || {};if(entity === "periodo"){return tx(row.id || row.periodoId || row.label || row.periodoLabel);}return tx(row.idLocal || row._bl2IdLocal || row.cedula || row.numeroIdentificacion || row.Cedula || row.docId || row._docId || row.id);}
  function firestoreStudentId(row){row = row || {};var raw = tx(row.cedula || row.numeroIdentificacion || row.Cedula || row.docId || row._docId || row.id || row.idLocal);var m = raw.match(/^(\d{7,13})/);return m ? m[1] : raw;}
  function rowTime(row){row = row || {};return tm(row.updatedAt || row.ultimaSincronizacion || row.actualizadoEn || row.createdAt || row.creadoEn || "");}
  function newer(local,remote){var l = rowTime(local), r = rowTime(remote);if(l === r){return "same";}return l > r ? "local" : "remote";}
  function mergeValue(current,incoming,incomingNewer){if(!hasData(incoming)){return current;}if(!hasData(current)){return incoming;}if(Array.isArray(current) || Array.isArray(incoming)){var seen = {}, out = [];(Array.isArray(current) ? current : [current]).concat(Array.isArray(incoming) ? incoming : [incoming]).forEach(function(item){var k = tx(typeof item === "object" && item ? JSON.stringify(item) : item);if(!k || seen[k]){return;}seen[k] = true;out.push(item);});return out;}return incomingNewer ? incoming : current;}
  function mergeRow(local,remote){var l = clone(local || {}) || {};var r = clone(remote || {}) || {};var winner = newer(l,r);var incomingNewer = winner === "remote";var out = Object.assign({}, incomingNewer ? l : r);var inc = incomingNewer ? r : l;Object.keys(inc).forEach(function(k){out[k] = mergeValue(out[k], inc[k], true);});out.updatedAt = tx(out.updatedAt || inc.updatedAt || now());return out;}
  function now(){return new Date().toISOString();}
  function mergeRows(localRows,remoteRows,entity){var map = {}; (remoteRows || []).forEach(function(r){var id = rowId(r,entity);if(id){map[id] = clone(r);}});(localRows || []).forEach(function(l){var id = rowId(l,entity);if(!id){return;}map[id] = map[id] ? mergeRow(l,map[id]) : clone(l);});return Object.keys(map).map(function(k){return map[k];});}
  function mergeSnapshots(local,remote){local = local || {};remote = remote || {};return {meta:Object.assign({}, remote.meta || {}, local.meta || {}, {updatedAt:now(), source:"bl2_conflict_merge"}),periods:mergeRows(local.periods || [], remote.periods || [], "periodo"),students:mergeRows(local.students || [], remote.students || [], "estudiante"),history:(local.history || []).concat(remote.history || []).slice(0,200),diagnostics:(local.diagnostics || []).concat(remote.diagnostics || []).slice(0,80)};}
  function detect(local,remote,entity){var out = [], rm = {};(remote || []).forEach(function(r){var id = rowId(r,entity);if(id){rm[id] = r;}});(local || []).forEach(function(l){var id = rowId(l,entity), r = rm[id];if(id && r && rowTime(l) && rowTime(r) && rowTime(l) !== rowTime(r)){out.push({entity:entity,entityId:id,firestoreId:entity === "estudiante" ? firestoreStudentId(l || r) : id,winner:newer(l,r),localUpdatedAt:l.updatedAt || l.ultimaSincronizacion || "",remoteUpdatedAt:r.updatedAt || r.ultimaSincronizacion || ""});}});return out;}
  function status(){return {ok:true,mode:"conflicts_safe_merge",version:VERSION,updatedAt:now()};}
  window.BL2Conflicts = {version:VERSION,rowId:rowId,firestoreStudentId:firestoreStudentId,rowTime:rowTime,newer:newer,mergeValue:mergeValue,mergeRow:mergeRow,mergeRows:mergeRows,mergeSnapshots:mergeSnapshots,detect:detect,status:status};
})(window);

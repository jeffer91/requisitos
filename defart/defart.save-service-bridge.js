/* =========================================================
Archivo: defart.save-service-bridge.js
Ruta: /defart/defart.save-service-bridge.js
Función:
- Priorizar guardado DB_VERSION 2 para Defensas.
- Guardar notas_titulacion y cambios_pendientes.
- Usar guardado legacy solo como fallback.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block17";
  var previousSave = null;

  function text(v){ return String(v == null ? "" : v).trim(); }
  function num(v){
    var raw = text(v).replace(",", ".");
    if(!raw){ return null; }
    var n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n * 100) / 100)) : null;
  }
  function nfin(a,b){
    a = num(a); b = num(b);
    if(a == null || b == null || a < 7){ return null; }
    return Math.round(((a * 0.70) + (b * 0.30)) * 100) / 100;
  }
  function svc(){ return window.BDLServices && window.BDLServices.get ? window.BDLServices.get("defensas") : null; }
  function cambios(){ return window.BDLRepositories && window.BDLRepositories.get ? window.BDLRepositories.get("cambios") : null; }
  function stateRows(){
    try{
      var s = window.DefartApp && window.DefartApp.getState ? window.DefartApp.getState() : {};
      var d = s.data || {};
      return Array.isArray(d.exportRows) && d.exportRows.length ? d.exportRows : (Array.isArray(d.rows) ? d.rows : []);
    }catch(error){ return []; }
  }
  function rowId(row){ return text(row && (row._defId || row.idEstudiantePeriodo || row.studentId || row._docId || row.id || row.cedula)); }
  function findRow(change){
    var id = text(change && change.id);
    return stateRows().find(function(row){ return rowId(row) === id; }) || null;
  }
  function splitId(id){
    id = text(id);
    if(id.indexOf("__") < 0){ return { periodoId:"", cedula:"" }; }
    var parts = id.split("__");
    return { periodoId:parts[0], cedula:parts.slice(1).join("__") };
  }
  function notaFromChange(change){
    change = change || {};
    var row = findRow(change) || {};
    var id = text(row.idEstudiantePeriodo || row.studentId || row._docId || row._defId || change.id);
    var parts = splitId(id);
    var periodoId = text(row._periodoId || row.periodoId || row.periodId || parts.periodoId);
    var cedula = text(row._cedula || row.cedula || parts.cedula);
    var a = Object.prototype.hasOwnProperty.call(change, "nart") ? num(change.nart) : num(row._nart || row.Notart || row.notart);
    var b = Object.prototype.hasOwnProperty.call(change, "ndef") ? num(change.ndef) : num(row._ndef || row.Notdef || row.notdef);
    var f = nfin(a,b);
    return {
      idEstudiantePeriodo:id,
      studentId:id,
      periodoId:periodoId,
      cedula:cedula,
      Notart:a,
      Notdef:b,
      Notafinal:f,
      Nart:a,
      Ndef:b,
      Nfinal:f,
      notart:a,
      notdef:b,
      notafinal:f,
      estadoNota:f == null ? "PENDIENTE" : (f >= 7 ? "APROBADO" : "NO_APROBADO"),
      origen:"defensas",
      updatedAt:new Date().toISOString()
    };
  }
  function cambioFromNota(nota){
    return {
      periodoId:nota.periodoId,
      cedula:nota.cedula,
      tabla:"notas_titulacion",
      tipo:"notas_titulacion",
      registroId:nota.idEstudiantePeriodo,
      accion:"UPSERT",
      payload:nota,
      prioridad:1,
      estadoSheets:"PENDIENTE",
      estadoFirebase:"PENDIENTE",
      estadoSupabase:"PENDIENTE",
      source:"defensas",
      origen:"defensas"
    };
  }
  function saveDirect(changesList){
    changesList = Array.isArray(changesList) ? changesList : [];
    if(!changesList.length){ return Promise.resolve({ ok:true, saved:0, total:0, errors:[], message:"No hay cambios pendientes." }); }
    var service = svc();
    if(!service || typeof service.saveNota !== "function"){ return Promise.reject(new Error("BDLServiceDefensas.saveNota no disponible.")); }
    var repoCambios = cambios();
    var notes = changesList.map(notaFromChange).filter(function(n){ return n.idEstudiantePeriodo && n.periodoId && n.cedula; });
    if(!notes.length){ return Promise.reject(new Error("No se pudo construir notas completas.")); }
    var saved = 0;
    var errors = [];
    var chain = Promise.resolve();
    notes.forEach(function(nota){
      chain = chain.then(function(){
        return service.saveNota(nota).then(function(){
          saved += 1;
          if(repoCambios && typeof repoCambios.save === "function"){
            return repoCambios.save(cambioFromNota(nota)).catch(function(e){ errors.push(e.message || String(e)); });
          }
          errors.push("BDLRepoCambios no disponible.");
          return null;
        }).catch(function(e){ errors.push(e.message || String(e)); });
      });
    });
    return chain.then(function(){
      var result = { ok:errors.length === 0, saved:saved, total:changesList.length, errors:errors, direct:true, source:"notas_titulacion", message:saved + " cambio(s) guardado(s) en notas_titulacion." };
      try{ window.dispatchEvent(new CustomEvent("bdlocal:defensas-notas-direct-saved", { detail:result })); }catch(error){}
      try{ if(window.DefartServiceBridge && window.DefartServiceBridge.refresh){ window.DefartServiceBridge.refresh(); } }catch(error){}
      return result;
    });
  }
  function install(){
    if(!window.DefartCore || typeof window.DefartCore.saveNotes !== "function"){ return false; }
    if(window.DefartCore.__saveServiceBridge){ return true; }
    previousSave = window.DefartCore.saveNotes;
    window.DefartCore.saveNotes = function(changesList){
      return saveDirect(changesList).then(function(result){
        if(result.ok || result.saved > 0){ return result; }
        throw new Error(result.errors && result.errors.join(" | ") || "Guardado directo incompleto.");
      }).catch(function(error){
        console.warn("[DefartSaveServiceBridge] fallback legacy", error);
        return previousSave.call(window.DefartCore, changesList);
      });
    };
    window.DefartCore.__saveServiceBridge = true;
    return true;
  }
  window.DefartSaveServiceBridge = { version:VERSION, install:install, saveDirect:saveDirect, notaFromChange:notaFromChange, cambioFromNota:cambioFromNota };
  install();
})(window);

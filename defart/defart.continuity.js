/* =========================================================
Nombre completo: defart.continuity.js
Ruta o ubicación: /Requisitos/defart/defart.continuity.js
Función:
- Conectar Defensas con el motor de continuidad.
- Registrar cambios de N-ART, N-DEF y N-FIN como eventos críticos.
- No cambia la lógica principal de guardado de Defensas.
========================================================= */
(function(window){
  "use strict";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function noteValue(value){
    if(value === null || value === undefined || text(value) === ""){ return null; }
    var n = Number(text(value).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  function same(a,b){ return String(a == null ? "" : a) === String(b == null ? "" : b); }

  function snapshotRows(){
    try{
      if(!window.DefartCore || typeof window.DefartCore.summary !== "function"){ return []; }
      var data = window.DefartCore.summary({});
      return Array.isArray(data.rows) ? data.rows : [];
    }catch(error){ return []; }
  }

  function mapRows(rows){
    var map = {};
    (rows || []).forEach(function(row){
      if(row && row._defId){ map[row._defId] = row; }
      if(row && row._cedula){ map[row._cedula] = row; }
    });
    return map;
  }

  function finalOf(nart, ndef){
    if(window.DefartCore && typeof window.DefartCore.calculateFinal === "function"){
      return window.DefartCore.calculateFinal(nart, ndef);
    }
    if(nart === null || ndef === null || nart < 7){ return null; }
    return Math.round(((nart * 0.70) + (ndef * 0.30)) * 100) / 100;
  }

  function record(row, field, oldValue, newValue){
    if(!window.BDLManualEvents || !row){ return; }
    if(same(oldValue, newValue)){ return; }
    window.BDLManualEvents.recordNota(row, field, oldValue, newValue, {
      source: "DefartContinuity",
      nombre: row._nombre || "",
      carrera: row._carrera || ""
    });
  }

  function patch(){
    if(!window.DefartCore || typeof window.DefartCore.saveNotes !== "function"){ return false; }
    if(window.DefartCore.__continuityPatched){ return true; }
    var original = window.DefartCore.saveNotes;

    window.DefartCore.saveNotes = function(changes){
      changes = Array.isArray(changes) ? changes : [];
      var before = mapRows(snapshotRows());
      var result = original.call(window.DefartCore, changes);
      try{
        if(result && result.saved > 0){
          changes.forEach(function(change){
            var row = before[change.id];
            if(!row){ return; }
            var oldNart = row._nart;
            var oldNdef = row._ndef;
            var oldNfin = row._nfin;
            var newNart = Object.prototype.hasOwnProperty.call(change, "nart") ? noteValue(change.nart) : oldNart;
            var newNdef = Object.prototype.hasOwnProperty.call(change, "ndef") ? noteValue(change.ndef) : oldNdef;
            var newNfin = finalOf(newNart, newNdef);
            record(row, "Nart", oldNart, newNart);
            record(row, "Ndef", oldNdef, newNdef);
            record(row, "Nfin", oldNfin, newNfin);
          });
        }
      }catch(error){ console.warn("[DefartContinuity] No se pudo registrar continuidad", error); }
      return result;
    };

    window.DefartCore.__continuityPatched = true;
    return true;
  }

  patch();
  window.DefartContinuity = { patch: patch };
})(window);
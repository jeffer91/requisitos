/* =========================================================
Nombre completo: stats.notes.guard.js
Ruta: /Stats/stats.notes.guard.js
Función:
- Evitar que celdas vacías importadas como 0 se interpreten como notas reales.
- Mantener las notas reales si fueron editadas/guardadas por Defensas.
========================================================= */
(function(window){
  "use strict";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value){ if(value === null || value === undefined || text(value) === ""){ return null; } var n = Number(text(value).replace(",", ".")); return Number.isFinite(n) ? n : null; }
  function pick(row, names){ row = row || {}; for(var i=0;i<names.length;i+=1){ if(Object.prototype.hasOwnProperty.call(row, names[i]) && text(row[names[i]]) !== ""){ return row[names[i]]; } } return ""; }
  function hasManualNoteTrace(row){
    row = row || {};
    return !!text(row.notasDefensaActualizadasEn || row.fechaRegistroNotas || row.ultimaEdicionLocal || row.notasDefensaOrigen || "");
  }
  function calc(nart, ndef){ return nart !== null && ndef !== null && nart >= 7 ? Math.round(((nart * 0.7) + (ndef * 0.3)) * 100) / 100 : null; }

  function cleanExtract(row){
    row = row || {};
    var rawArt = pick(row, ["Notart","Nart","nart","N_ART","N-ART","NotaArt","notaArticulo"]);
    var rawDef = pick(row, ["Notdef","Ndef","ndef","N_DEF","N-DEF","NotaDef","notaDefensa"]);
    var rawFin = pick(row, ["Notafinal","NotaFinal","Nfin","nfin","N_FIN","N-FIN","notaFinal"]);
    var nart = num(rawArt), ndef = num(rawDef), nfin = num(rawFin);
    var allZero = nart === 0 && ndef === 0 && nfin === 0;
    if(allZero && !hasManualNoteTrace(row)){
      nart = null;
      ndef = null;
      nfin = null;
    }
    if(nfin === null){ nfin = calc(nart, ndef); }
    return { nart:nart, ndef:ndef, nfin:nfin, nfinCalculado:nfin, nfinGuardado:num(rawFin), completo:nfin !== null };
  }

  function patch(){
    window.BLNotasDefensa = window.BLNotasDefensa || {};
    window.BLNotasDefensa.extraerNotas = cleanExtract;
    if(!window.BLNotasDefensa.normalizarNota){ window.BLNotasDefensa.normalizarNota = num; }
    if(!window.BLNotasDefensa.calcularNfin){ window.BLNotasDefensa.calcularNfin = calc; }
    return true;
  }

  patch();
  window.StatsNotesGuard = { patch: patch, extract: cleanExtract };
})(window);
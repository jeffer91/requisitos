/* =========================================================
Nombre completo: defart.persistence.js
Ruta o ubicación: /Requisitos/defart/defart.persistence.js
Función:
- Duplicar el guardado de notas de Defensas hacia BDLocal/notas.
- Crear cambios pendientes en BDLocal/cambios para sincronización posterior.
- Mantener el guardado anterior de DefartCore como primera fuente de compatibilidad.
- No bloquear la pantalla si el mirror BDLocal falla; registrar advertencia en consola.
Con qué se conecta:
- defart.core.js
- BDLocal/repositories/bdl.repo.notas.js
- BDLocal/repositories/bdl.repo.cambios.js
- BDLocal/rules/bdl.rules.notas.js
- BDLocal/rules/bdl.rules.sync.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block7";
  var originalSaveNotes = null;

  function text(value){ return String(value == null ? "" : value).trim(); }

  function noteNumber(value){
    var raw = text(value).replace(",", ".");
    if(!raw){ return null; }
    var num = Number(raw);
    return Number.isFinite(num) ? Math.max(0, Math.min(10, Math.round(num * 100) / 100)) : null;
  }

  function finalNota(nart, ndef){
    nart = noteNumber(nart);
    ndef = noteNumber(ndef);
    if(nart == null || ndef == null){ return null; }
    return Math.round(((nart * 0.70) + (ndef * 0.30)) * 100) / 100;
  }

  function repo(name){
    if(window.BDLRepositories && typeof window.BDLRepositories.get === "function"){
      return window.BDLRepositories.get(name);
    }
    if(name === "notas"){ return window.BDLRepoNotas || null; }
    if(name === "cambios"){ return window.BDLRepoCambios || null; }
    return null;
  }

  function currentRows(){
    var rows = [];
    try{
      if(window.DefartApp && typeof window.DefartApp.getState === "function"){
        var state = window.DefartApp.getState() || {};
        var data = state.data || {};
        rows = Array.isArray(data.exportRows) ? data.exportRows : (Array.isArray(data.rows) ? data.rows : []);
      }
    }catch(error){}
    return Array.isArray(rows) ? rows : [];
  }

  function rowId(row){
    row = row || {};
    return text(row._defId || row.id || row._id || row.idEstudiantePeriodo || row.studentId || row.cedula || row.numeroIdentificacion);
  }

  function findRow(change){
    change = change || {};
    var id = text(change.id);
    var rows = currentRows();
    var found = rows.find(function(row){ return rowId(row) === id; });

    if(found){ return found; }

    try{
      if(window.BL2DataEngine && typeof window.BL2DataEngine.getStudentById === "function"){
        found = window.BL2DataEngine.getStudentById(id, { matricula: "" });
      }
    }catch(error){}

    return found || null;
  }

  function notaFromChange(change){
    var row = findRow(change) || {};
    var periodoId = text(row._periodoId || row.periodoId || row.periodId || "");
    var cedula = text(row._cedula || row.cedula || row.numeroIdentificacion || "");
    var idEstudiantePeriodo = text(row.idEstudiantePeriodo || row.studentId || (periodoId && cedula ? periodoId + "__" + cedula : ""));

    var nart = Object.prototype.hasOwnProperty.call(change, "nart") ? noteNumber(change.nart) : noteNumber(row._nart || row.Notart || row.Nart || row.nart);
    var ndef = Object.prototype.hasOwnProperty.call(change, "ndef") ? noteNumber(change.ndef) : noteNumber(row._ndef || row.Notdef || row.Ndef || row.ndef);
    var nfin = finalNota(nart, ndef);

    return {
      id: idEstudiantePeriodo,
      notaId: idEstudiantePeriodo,
      studentId: idEstudiantePeriodo,
      idEstudiantePeriodo: idEstudiantePeriodo,
      periodoId: periodoId,
      cedula: cedula,
      Notart: nart,
      Notdef: ndef,
      Notafinal: nfin,
      Nart: nart,
      Ndef: ndef,
      Nfinal: nfin,
      notart: nart,
      notdef: ndef,
      notafinal: nfin,
      origen: "defensas",
      updatedAt: new Date().toISOString()
    };
  }

  function buildCambio(nota){
    return {
      periodoId: nota.periodoId,
      cedula: nota.cedula,
      tabla: "notas",
      registroId: nota.id,
      accion: "UPSERT",
      payload: nota,
      prioridad: 1,
      source: "defensas",
      origen: "defensas"
    };
  }

  function mirrorChanges(changes){
    changes = Array.isArray(changes) ? changes : [];
    if(!changes.length){ return Promise.resolve({ ok:true, mirrored:0 }); }

    var notasRepo = repo("notas");
    var cambiosRepo = repo("cambios");

    if(!notasRepo || typeof notasRepo.saveMany !== "function"){
      return Promise.resolve({ ok:false, mirrored:0, message:"BDLRepoNotas no disponible." });
    }

    var notas = changes.map(notaFromChange).filter(function(nota){ return !!(nota.id && nota.periodoId && nota.cedula); });
    if(!notas.length){
      return Promise.resolve({ ok:false, mirrored:0, message:"No se pudo construir notas con período y cédula." });
    }

    return notasRepo.saveMany(notas).then(function(){
      if(!cambiosRepo || typeof cambiosRepo.saveMany !== "function"){
        return { ok:true, mirrored:notas.length, changes:0, message:"Notas guardadas; cambios pendientes no disponibles." };
      }
      return cambiosRepo.saveMany(notas.map(buildCambio), { tabla:"notas", accion:"UPSERT", prioridad:1, source:"defensas" }).then(function(){
        return { ok:true, mirrored:notas.length, changes:notas.length };
      });
    });
  }

  function patchCore(){
    if(!window.DefartCore || typeof window.DefartCore.saveNotes !== "function"){ return false; }
    if(window.DefartCore.__bdlPersistencePatch){ return true; }

    originalSaveNotes = window.DefartCore.saveNotes;

    window.DefartCore.saveNotes = function(changes){
      var result = originalSaveNotes.call(window.DefartCore, changes);
      Promise.resolve(result).then(function(saveResult){
        if(saveResult && saveResult.ok === false){ return null; }
        return mirrorChanges(changes).then(function(mirrorResult){
          try{ window.dispatchEvent(new CustomEvent("bdlocal:defensas-notas-mirrored", { detail: mirrorResult })); }catch(error){}
          return mirrorResult;
        });
      }).catch(function(error){
        console.warn("[DefartPersistence] No se pudo duplicar notas en BDLocal:", error);
      });
      return result;
    };

    window.DefartCore.__bdlPersistencePatch = true;
    return true;
  }

  function install(){
    patchCore();
  }

  window.DefartPersistence = {
    version: VERSION,
    install: install,
    mirrorChanges: mirrorChanges,
    notaFromChange: notaFromChange
  };

  install();
})(window);

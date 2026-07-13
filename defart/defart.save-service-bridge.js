/* =========================================================
Nombre completo: defart.save-service-bridge.js
Ruta o ubicación: /defart/defart.save-service-bridge.js
Función o funciones:
- Priorizar guardado DB_VERSION 2 para Defensas.
- Guardar notas_titulacion y cambios_pendientes.
- Reconstruir la caché compartida después de guardar notas.
- Notificar a Ficha, Stats, Reportes, Global y demás pantallas.
- Usar guardado legacy solo como fallback.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.2.0-shared-cache";
  var previousSave = null;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value){
    var raw = text(value).replace(",", ".");
    if(!raw){ return null; }
    var number = Number(raw);
    return Number.isFinite(number) ? Math.max(0,Math.min(10,Math.round(number * 100) / 100)) : null;
  }
  function nfin(article,defense){
    article = num(article);
    defense = num(defense);
    if(article == null || defense == null || article < 7){ return null; }
    return Math.round(((article * 0.70) + (defense * 0.30)) * 100) / 100;
  }
  function service(){ return window.BDLServices && window.BDLServices.get ? window.BDLServices.get("defensas") : null; }
  function changesRepo(){ return window.BDLRepositories && window.BDLRepositories.get ? window.BDLRepositories.get("cambios") : null; }

  function stateRows(){
    try{
      var state = window.DefartApp && window.DefartApp.getState ? window.DefartApp.getState() : {};
      var data = state.data || {};
      return Array.isArray(data.exportRows) && data.exportRows.length ? data.exportRows : (Array.isArray(data.rows) ? data.rows : []);
    }catch(error){ return []; }
  }

  function rowId(row){ return text(row && (row._defId || row.idEstudiantePeriodo || row.studentId || row._docId || row.id || row.cedula)); }
  function findRow(change){
    var id = text(change && change.id);
    return stateRows().find(function(row){ return rowId(row) === id; }) || null;
  }
  function splitId(id){
    id = text(id);
    if(id.indexOf("__") < 0){ return { periodoId:"",cedula:"" }; }
    var parts = id.split("__");
    return { periodoId:parts[0],cedula:parts.slice(1).join("__") };
  }

  function notaFromChange(change){
    change = change || {};
    var row = findRow(change) || {};
    var id = text(row.idEstudiantePeriodo || row.studentId || row._docId || row._defId || change.id);
    var parts = splitId(id);
    var periodoId = text(row._periodoId || row.periodoId || row.periodId || parts.periodoId);
    var cedula = text(row._cedula || row.cedula || parts.cedula);
    var article = Object.prototype.hasOwnProperty.call(change,"nart") ? num(change.nart) : num(row._nart || row.Notart || row.notart);
    var defense = Object.prototype.hasOwnProperty.call(change,"ndef") ? num(change.ndef) : num(row._ndef || row.Notdef || row.notdef);
    var finalGrade = nfin(article,defense);

    return {
      idEstudiantePeriodo:id,
      studentId:id,
      periodoId:periodoId,
      cedula:cedula,
      Notart:article,
      Notdef:defense,
      Notafinal:finalGrade,
      Nart:article,
      Ndef:defense,
      Nfinal:finalGrade,
      notart:article,
      notdef:defense,
      notafinal:finalGrade,
      estadoNota:finalGrade == null ? "PENDIENTE" : (finalGrade >= 7 ? "APROBADO" : "NO_APROBADO"),
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

  function refreshSharedCache(periodoId){
    var hub = window.BDLocalConexiones;
    if(!hub || typeof hub.refreshCache !== "function"){ return Promise.resolve(null); }
    return hub.refreshCache({
      source:"defart.save-service-bridge",
      periodoId:periodoId || "",
      full:true,
      immediate:true
    }).catch(function(error){
      console.warn("[DefartSaveServiceBridge] No se pudo refrescar la caché compartida",error);
      return null;
    });
  }

  function saveDirect(changesList){
    changesList = Array.isArray(changesList) ? changesList : [];
    if(!changesList.length){
      return Promise.resolve({ ok:true,saved:0,total:0,errors:[],message:"No hay cambios pendientes." });
    }

    var currentService = service();
    if(!currentService || typeof currentService.saveNota !== "function"){
      return Promise.reject(new Error("BDLServiceDefensas.saveNota no disponible."));
    }

    var repoCambios = changesRepo();
    var notes = changesList.map(notaFromChange).filter(function(note){
      return note.idEstudiantePeriodo && note.periodoId && note.cedula;
    });
    if(!notes.length){ return Promise.reject(new Error("No se pudo construir notas completas.")); }

    var saved = 0;
    var errors = [];
    var chain = Promise.resolve();

    notes.forEach(function(note){
      chain = chain.then(function(){
        return currentService.saveNota(note).then(function(){
          saved += 1;
          if(repoCambios && typeof repoCambios.save === "function"){
            return repoCambios.save(cambioFromNota(note)).catch(function(error){ errors.push(error.message || String(error)); });
          }
          errors.push("BDLRepoCambios no disponible.");
          return null;
        }).catch(function(error){ errors.push(error.message || String(error)); });
      });
    });

    return chain.then(function(){
      var result = {
        ok:errors.length === 0,
        saved:saved,
        total:changesList.length,
        errors:errors,
        direct:true,
        source:"notas_titulacion",
        message:saved + " cambio(s) guardado(s) en notas_titulacion."
      };

      var periodoId = notes[0] && notes[0].periodoId || "";
      return refreshSharedCache(periodoId).then(function(){
        try{ window.dispatchEvent(new CustomEvent("bdlocal:defensas-notas-direct-saved",{ detail:result })); }catch(error){}
        try{
          if(window.DefartServiceBridge && window.DefartServiceBridge.refresh){
            window.DefartServiceBridge.refresh();
          }
        }catch(error2){}
        return result;
      });
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
        console.warn("[DefartSaveServiceBridge] fallback legacy",error);
        return previousSave.call(window.DefartCore,changesList);
      });
    };
    window.DefartCore.__saveServiceBridge = true;
    return true;
  }

  window.DefartSaveServiceBridge = {
    version:VERSION,
    install:install,
    saveDirect:saveDirect,
    notaFromChange:notaFromChange,
    cambioFromNota:cambioFromNota,
    refreshSharedCache:refreshSharedCache
  };

  install();
})(window);

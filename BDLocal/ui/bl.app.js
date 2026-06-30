/* =========================================================
Nombre completo: bl.app.js
Ruta: /BDLocal/ui/bl.app.js
Función:
- Inicializar la nueva capa visual de BL.
- Agregar sincronización manual y diaria hacia Supabase para datos críticos.
========================================================= */
(function(window, document){
  "use strict";

  var DAILY_KEY = "REQ_SUPABASE_PROTECTED_DAILY_SYNC_V1";

  function bind(id, handler){ var node = document.getElementById(id); if(node){ node.addEventListener("click", handler); } }
  function today(){ return new Date().toISOString().slice(0, 10); }
  function now(){ return new Date().toISOString(); }
  function txt(value){ return String(value == null ? "" : value).trim(); }
  function print(id, value){
    var node = document.getElementById(id);
    if(!node){ return; }
    try{ node.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2); }
    catch(error){ node.textContent = String(value); }
  }

  function renderAll(){
    if(window.BLPanelStatus){ window.BLPanelStatus.render(); }
    if(window.BLPanelSettings){ window.BLPanelSettings.render(); }
    if(window.BLPanelDiagnostics){ window.BLPanelDiagnostics.render(); }
  }

  function ensureSupabaseManualBox(){
    var panel = document.getElementById("blPanelSupabase");
    if(!panel || document.getElementById("blBtnSupabaseManualSync")){ return; }
    var box = document.createElement("div");
    box.className = "bl-continuity-actions";
    box.innerHTML = '<button id="blBtnSupabaseManualSync" class="bl-btn primary">Sincronizar Supabase ahora</button>';
    var note = document.createElement("div");
    note.className = "bl-panel-note";
    note.textContent = "Respalda en Supabase períodos, cédulas mínimas, Telegram, notas y divisiones guardadas en BDLocal. También se intenta una vez al día.";
    var output = document.createElement("pre");
    output.id = "blSupabaseOutput";
    output.className = "bl-output";
    output.textContent = "Sin sincronización manual.";
    panel.appendChild(box);
    panel.appendChild(note);
    panel.appendChild(output);
  }

  function listStore(storeName){
    if(!window.BDLDB || !storeName){ return Promise.resolve([]); }
    return window.BDLDB.list(storeName, { limit:0 }).catch(function(){ return []; });
  }

  function protectedStores(){
    var s = window.BDLConfig && window.BDLConfig.stores ? window.BDLConfig.stores : {};
    return [
      { store:s.periodos || "periodos", table:"periodos" },
      { store:s.estudiantesResumen || "estudiantes_periodo_resumen", table:"estudiantes_periodo_resumen" },
      { store:s.estudiantesPersona || "estudiantes_persona", table:"sensible_estudiantes_persona" },
      { store:s.estudianteNotas || "estudiante_notas", table:"sensible_estudiante_notas" },
      { store:s.estudianteDivisiones || "estudiante_divisiones", table:"sensible_estudiante_divisiones" }
    ];
  }

  function recordKey(row, storeName){
    row = row || {};
    return txt(row.id || row.idNota || row.idEstudiantePeriodo || row.numeroIdentificacion || row.cedula || row.Cedula || row.periodoId || row.clave || (storeName + "_" + Date.now() + "_" + Math.random().toString(36).slice(2)));
  }

  function toCloudRow(def, row){
    row = row || {};
    if(window.BDLSupabaseMapper && typeof window.BDLSupabaseMapper.appRecord === "function"){
      return window.BDLSupabaseMapper.appRecord(def.table, row, {
        recordKey: recordKey(row, def.store),
        source: "bdlocal_supabase_protegido",
        syncStatus: "sincronizado"
      });
    }
    return {
      id: "requisitos__" + def.table + "__" + recordKey(row, def.store),
      module_key: "requisitos",
      table_key: def.table,
      record_key: recordKey(row, def.store),
      periodo_id: txt(row.periodoId || row.periodo || row.Periodo || ""),
      estudiante_id: txt(row.numeroIdentificacion || row.cedula || row.Cedula || ""),
      source: "bdlocal_supabase_protegido",
      sync_status: "sincronizado",
      schema_version: "1",
      payload: row,
      created_at: txt(row.createdAt || row.created_at || now()),
      updated_at: txt(row.updatedAt || row.actualizadoEn || row.actualizadaEn || now())
    };
  }

  function collectProtectedRows(){
    var summary = { stores:{}, rows:[] };
    var chain = Promise.resolve();
    protectedStores().forEach(function(def){
      chain = chain.then(function(){
        return listStore(def.store).then(function(rows){
          rows = Array.isArray(rows) ? rows : [];
          summary.stores[def.store] = rows.length;
          rows.forEach(function(row){ summary.rows.push(toCloudRow(def, row)); });
        });
      });
    });
    return chain.then(function(){ return summary; });
  }

  function upsertRows(table, rows){
    rows = Array.isArray(rows) ? rows : [];
    if(!rows.length){ return Promise.resolve({ total:0, batches:0 }); }
    if(!window.BDLSupabaseClient || typeof window.BDLSupabaseClient.upsert !== "function"){
      return Promise.reject(new Error("Cliente Supabase no disponible."));
    }
    var result = { total:rows.length, batches:0 };
    var chain = Promise.resolve();
    for(var i = 0; i < rows.length; i += 500){
      (function(batch){
        chain = chain.then(function(){
          return window.BDLSupabaseClient.upsert(table, batch, "id").then(function(){ result.batches += 1; });
        });
      })(rows.slice(i, i + 500));
    }
    return chain.then(function(){ return result; });
  }

  function syncSupabaseProtected(options){
    options = options || {};
    if(!window.BDLSupabaseConfig || !window.BDLSupabaseConfig.isConfigured()){
      return Promise.resolve({ ok:false, skipped:true, reason:"Supabase no configurado o pausado" });
    }
    return collectProtectedRows().then(function(pack){
      return upsertRows("app_records", pack.rows).then(function(up){
        var result = { ok:true, manual:options.manual === true, at:now(), table:"app_records", total:pack.rows.length, stores:pack.stores, upload:up };
        try{ window.localStorage.setItem(DAILY_KEY, today()); }catch(error){}
        return result;
      });
    });
  }

  function syncSupabaseNow(){
    print("blSupabaseOutput", "Respaldando datos críticos en Supabase...");
    if(window.BDLConnSettings && typeof window.BDLConnSettings.setEnabled === "function"){
      window.BDLConnSettings.setEnabled("supabase", true);
    }
    return syncSupabaseProtected({ manual:true }).then(function(result){
      print("blSupabaseOutput", result);
      if(window.BLPanelStatus){ window.BLPanelStatus.check(); }
      return result;
    }).catch(function(error){
      var result = { ok:false, error:error && error.message ? error.message : String(error) };
      print("blSupabaseOutput", result);
      return result;
    });
  }

  function syncSupabaseDailyIfNeeded(){
    try{ if(window.localStorage.getItem(DAILY_KEY) === today()){ return Promise.resolve({ skipped:true, reason:"ya_respaldado_hoy" }); } }catch(error){}
    return syncSupabaseProtected({ manual:false });
  }

  function boot(){
    if(window.BLTabs){ window.BLTabs.boot(); }
    if(window.BLPanelCloseDay){ window.BLPanelCloseDay.bind(); }
    if(window.BLPanelSheets){ window.BLPanelSheets.bind(); }
    ensureSupabaseManualBox();
    renderAll();
    bind("blBtnCheckContinuity", function(){
      if(window.BLPanelStatus){ window.BLPanelStatus.check().then(function(){ if(window.BLPanelDiagnostics){ window.BLPanelDiagnostics.render(); } }); }
    });
    bind("blBtnShowContinuityStatus", function(){
      if(window.BLPanelDiagnostics){ window.BLPanelDiagnostics.render(); }
      if(window.BLTabs){ window.BLTabs.activate("diagnostics"); }
    });
    bind("blBtnSupabaseManualSync", syncSupabaseNow);
    setTimeout(function(){ if(window.BLPanelStatus){ window.BLPanelStatus.check(); } }, 300);
    setTimeout(function(){ syncSupabaseDailyIfNeeded().catch(function(error){ console.warn("[Supabase protegido diario]", error); }); }, 3500);
  }

  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", boot); }
  else{ boot(); }

  window.BLApp = { boot: boot, renderAll: renderAll, syncSupabaseNow: syncSupabaseNow, syncSupabaseDailyIfNeeded: syncSupabaseDailyIfNeeded };
})(window, document);

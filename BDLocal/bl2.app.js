/* =========================================================
Nombre completo: bl2.app.js
Ruta o ubicación: /BDLocal/bl2.app.js
Función o funciones:
- Inicializar BL2 e IndexedDB.
- Controlar el período activo y el refresco general.
- Actualizar los indicadores principales.
- Integrar el Centro de Control BDLocal.
- Mantener prueba, respaldo y progreso global.
========================================================= */
(function(window, document){
  "use strict";

  var config = window.BL2Config || {};
  var core = window.BL2Core || null;
  var db = window.BL2DB || null;
  var backup = window.BL2Backup || null;
  var test = window.BL2Test || null;
  var sync = window.BL2Sync || null;
  var utils = config.utils || {};

  var state = {
    ready:false,
    booting:false,
    activePeriod:null,
    periods:[],
    lastImportSummary:null,
    syncBarTimer:null,
    eventsBound:false
  };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function byId(id){ return document.getElementById(id); }
  function setText(id, value){ var el = byId(id); if(el){ el.textContent = value; } }
  function nowISO(){ return utils.nowISO ? utils.nowISO() : new Date().toISOString(); }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function number(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }
  function formatNumber(value){ try{ return number(value).toLocaleString("es-EC"); }catch(error){ return String(number(value)); } }
  function formatDateTime(value){ var d = new Date(value || 0); return Number.isFinite(d.getTime()) ? d.toLocaleString("es-EC") : text(value || "—"); }

  function log(message, level){
    var box = byId("bl2-log");
    if(box){
      var item = document.createElement("div");
      item.className = "bl2-log-item " + (level ? "is-" + level : "");
      item.innerHTML = "<strong>" + esc(formatDateTime(nowISO())) + "</strong><span>" + esc(message) + "</span>";
      box.insertBefore(item, box.firstChild);
      while(box.children.length > 120){ box.removeChild(box.lastElementChild); }
    }
    if(core && typeof core.log === "function"){
      core.log(level === "error" ? "ERROR" : level === "warn" ? "WARN" : "INFO", message).catch(function(){});
    }
  }

  function setDbPill(status, message){
    var pill = byId("bl2-db-pill");
    if(!pill){ return; }
    pill.className = "bl2-pill " + (status === "ok" ? "bl2-pill-ok" : status === "bad" ? "bl2-pill-bad" : "bl2-pill-warn");
    pill.textContent = message || status;
  }

  function setRuntimePill(){ setText("bl2-runtime-pill", window.electronAPI ? "Electron" : "Navegador"); }

  function setButtonsDisabled(disabled){
    [
      "bl2-btn-refresh","bl2-btn-period-save","bl2-btn-test","bl2-btn-export",
      "bl2-btn-push-google","bl2-btn-push-firebase","bl2-btn-push-supabase",
      "bl2-btn-pull-sheets","bl2-btn-fetch-firebase-config","bl2-btn-sync-queue"
    ].forEach(function(id){ var button = byId(id); if(button){ button.disabled = !!disabled; } });
  }

  function selectedPeriod(){
    var select = byId("bl2-period-select");
    var id = text(select && select.value);
    if(!id && state.activePeriod){ id = text(state.activePeriod.id); }
    var row = state.periods.filter(function(period){ return text(period.id) === id; })[0];
    return { id:id, label:text(row && (row.label || row.periodoLabel) || id) };
  }

  function renderPeriods(){
    var select = byId("bl2-period-select");
    var list = byId("bl2-period-list");
    var search = text((byId("bl2-period-search") || {}).value).toLowerCase();
    var selected = state.activePeriod ? text(state.activePeriod.id) : text(select && select.value);

    if(select){
      select.innerHTML = '<option value="">Seleccione un período...</option>' + state.periods.map(function(period){
        var id = text(period.id);
        var label = text(period.label || period.periodoLabel || id);
        return '<option value="' + esc(id) + '"' + (id === selected ? " selected" : "") + '>' + esc(label) + '</option>';
      }).join("");
    }

    if(!list){ return; }
    var rows = state.periods.filter(function(period){ return !search || [period.id,period.label,period.periodoLabel].join(" ").toLowerCase().indexOf(search) >= 0; });
    if(!rows.length){ list.innerHTML = '<div class="bl2-empty">No hay períodos cargados todavía.</div>'; return; }
    list.innerHTML = rows.map(function(period){
      var id = text(period.id);
      var label = text(period.label || period.periodoLabel || id);
      var active = state.activePeriod && text(state.activePeriod.id) === id;
      return '<div class="bl2-period-item"><div><strong>' + esc(label) + '</strong><span>' + esc(id) + '</span></div><span class="bl2-pill ' + (active ? 'bl2-pill-ok' : 'bl2-pill-soft') + '">' + (active ? 'Activo' : 'Disponible') + '</span><button class="bl2-btn bl2-btn-light" type="button" data-bl2-period="' + esc(id) + '">Usar</button></div>';
    }).join("");
    Array.prototype.slice.call(list.querySelectorAll("[data-bl2-period]")).forEach(function(button){
      button.addEventListener("click", function(){
        var id = button.getAttribute("data-bl2-period");
        var period = state.periods.filter(function(row){ return text(row.id) === id; })[0];
        setPeriod(id, period ? period.label || period.periodoLabel : id);
      });
    });
  }

  function renderImportSummary(summary){
    var target = byId("bl2-import-summary");
    if(!target){ return; }
    if(!summary){ target.innerHTML = '<div class="bl2-empty">Todavía no existe una carga en esta sesión.</div>'; return; }
    var warnings = Array.isArray(summary.advertencias) ? summary.advertencias : [];
    var errors = Array.isArray(summary.errores) ? summary.errores : [];
    target.innerHTML = '<div class="bl2-summary-grid">'
      + '<div class="bl2-summary-item"><span>Período</span><strong>' + esc(summary.periodoLabel || summary.periodoId || "—") + '</strong></div>'
      + '<div class="bl2-summary-item"><span>Guardados</span><strong>' + formatNumber(summary.guardados) + '</strong></div>'
      + '<div class="bl2-summary-item"><span>Actualizados</span><strong>' + formatNumber(summary.actualizados) + '</strong></div>'
      + '<div class="bl2-summary-item"><span>Retirados</span><strong>' + formatNumber(summary.retirados) + '</strong></div></div>'
      + '<div class="bl2-warning-list">' + warnings.concat(errors).slice(0,8).map(function(item){ return '<div class="bl2-warning">' + esc(item) + '</div>'; }).join("") + '</div>';
  }

  function renderKPIs(){
    var active = state.activePeriod || {};
    setText("bl2-kpi-period", active.label || active.periodoLabel || "—");
    setText("bl2-kpi-period-id", active.id || "Sin seleccionar");
    if(!active.id || !core || typeof core.getSummary !== "function"){
      setText("bl2-kpi-students", "0");
      return Promise.resolve({});
    }
    return core.getSummary(active.id).then(function(summary){
      summary = summary || {};
      setText("bl2-kpi-students", formatNumber(summary.totalEstudiantes));
      setText("bdlc-kpi-active", formatNumber(summary.totalActivos));
      setText("bdlc-kpi-retired", formatNumber(summary.totalRetirados));
      setText("bl2-kpi-google", formatNumber(summary.pendientesGoogle));
      setText("bl2-kpi-firebase", formatNumber(summary.pendientesFirebase));
      return summary;
    }).catch(function(error){ log("No se pudieron actualizar los indicadores: " + error.message, "warn"); return {}; });
  }

  function refresh(){
    if(!core){ setDbPill("bad", "Sin núcleo"); return Promise.reject(new Error("BL2Core no está cargado.")); }
    return core.getPeriods().then(function(periods){
      state.periods = Array.isArray(periods) ? periods : [];
      return core.getActivePeriod();
    }).then(function(period){
      state.activePeriod = period || null;
      renderPeriods();
      renderImportSummary(state.lastImportSummary);
      return renderKPIs();
    }).then(function(summary){
      var tasks = [];
      if(window.BDLSyncUIBridge && typeof window.BDLSyncUIBridge.refreshCounts === "function"){ tasks.push(window.BDLSyncUIBridge.refreshCounts()); }
      if(window.BDLocalConfigUI && typeof window.BDLocalConfigUI.render === "function"){ tasks.push(window.BDLocalConfigUI.render()); }
      return Promise.all(tasks.map(function(task){ return Promise.resolve(task).catch(function(){ return null; }); })).then(function(){ return summary; });
    }).then(function(summary){
      setDbPill("ok", "BL2 activo");
      try{ window.dispatchEvent(new CustomEvent("bl2:app-refreshed",{ detail:{ activePeriod:state.activePeriod, summary:summary || {} } })); }catch(error){}
      return summary;
    }).catch(function(error){ setDbPill("bad", "Error BL2"); log("Error al refrescar BL2: " + error.message, "error"); throw error; });
  }

  function setPeriod(periodoId, periodoLabel){
    periodoId = text(periodoId);
    if(!periodoId){ notify("Seleccione un período válido.", "warning"); return Promise.resolve(null); }
    if(!core || typeof core.setActivePeriod !== "function"){ return Promise.reject(new Error("No se puede cambiar el período porque BL2Core no está disponible.")); }
    setButtonsDisabled(true);
    return core.setActivePeriod(periodoId, periodoLabel || periodoId).then(function(period){
      state.activePeriod = period;
      log("Período activo: " + (period.label || period.id), "ok");
      try{ window.dispatchEvent(new CustomEvent("bl2:period-changed",{ detail:{ period:period } })); }catch(error){}
      return refresh();
    }).finally(function(){ setButtonsDisabled(false); });
  }

  function notify(message, type){
    if(window.BDLocalConfigUI && typeof window.BDLocalConfigUI.notify === "function"){ window.BDLocalConfigUI.notify(message, type || "info"); }
    else{ window.alert(message); }
  }

  function handlePeriodSave(){
    var period = selectedPeriod();
    if(!period.id){ notify("Seleccione un período.", "warning"); return; }
    setPeriod(period.id, period.label).catch(function(error){ notify(error.message, "error"); });
  }

  function handleTest(){
    if(!test || typeof test.run !== "function"){ notify("BL2Test no está disponible.", "warning"); return; }
    setButtonsDisabled(true);
    log("Ejecutando prueba BL2...", "info");
    test.run({ log:true }).then(function(report){
      var ok = report && report.ok;
      notify(ok ? "Prueba BL2 correcta." : "La prueba BL2 detectó errores. Revise Diagnóstico y salud.", ok ? "success" : "error");
      log(ok ? "Prueba BL2 correcta." : "Prueba BL2 con errores.", ok ? "ok" : "error");
      return refresh();
    }).catch(function(error){ notify("Error en prueba BL2: " + error.message, "error"); log("Error en prueba BL2: " + error.message, "error"); }).finally(function(){ setButtonsDisabled(false); });
  }

  function handleExport(){
    var period = selectedPeriod();
    if(!backup || typeof backup.exportManual !== "function"){ notify("El módulo de respaldo no está disponible.", "warning"); return; }
    var all = window.confirm("Aceptar: respaldar toda la base.\nCancelar: respaldar solo el período activo.");
    if(!all && !period.id){ notify("Seleccione un período para crear el respaldo.", "warning"); return; }
    setButtonsDisabled(true);
    backup.exportManual({ scope:all ? "all" : "period", periodoId:all ? "" : period.id, periodoLabel:all ? "" : period.label }).then(function(result){
      notify("Respaldo exportado correctamente.", "success");
      log("Respaldo exportado: " + (result.fileName || "archivo JSON"), "ok");
    }).catch(function(error){ notify("No se pudo exportar: " + error.message, "error"); log("Error exportando respaldo: " + error.message, "error"); }).finally(function(){ setButtonsDisabled(false); });
  }

  function showSyncBar(detail){
    detail = detail || {};
    var bar = byId("bl2-sync-bar");
    var fill = byId("bl2-sync-progress");
    var percent = Math.max(0, Math.min(100, number(detail.percent)));
    if(!bar){ return; }
    bar.hidden = false;
    setText("bl2-sync-title", detail.target ? "Sincronizando " + detail.target : "Procesando BDLocal");
    setText("bl2-sync-detail", detail.detail || "Procesando...");
    setText("bl2-sync-percent", Math.round(percent) + "%");
    if(fill){ fill.style.width = percent + "%"; }
    window.clearTimeout(state.syncBarTimer);
    if(percent >= 100 || percent <= 0){ state.syncBarTimer = window.setTimeout(function(){ bar.hidden = true; }, 2500); }
  }

  function setupEvents(){
    if(state.eventsBound){ return; }
    state.eventsBound = true;
    var save = byId("bl2-btn-period-save");
    var refreshButton = byId("bl2-btn-refresh");
    var testButton = byId("bl2-btn-test");
    var exportButton = byId("bl2-btn-export");
    var search = byId("bl2-period-search");
    if(save){ save.addEventListener("click", handlePeriodSave); }
    if(refreshButton){ refreshButton.addEventListener("click", function(){ setButtonsDisabled(true); refresh().finally(function(){ setButtonsDisabled(false); }); }); }
    if(testButton){ testButton.addEventListener("click", handleTest); }
    if(exportButton){ exportButton.addEventListener("click", handleExport); }
    if(search){ search.addEventListener("input", renderPeriods); }

    window.addEventListener("bl2:sync-progress", function(event){ showSyncBar(event.detail || {}); });
    window.addEventListener("bl2:students-saved", function(event){ state.lastImportSummary = event.detail || null; renderImportSummary(state.lastImportSummary); refresh(); });
    window.addEventListener("bl2:student-updated", refresh);
    window.addEventListener("bdlocal:sync-v2-finished", refresh);
  }

  function initCenter(){
    var root = byId("bdlocal-control-center-root") || byId("bdlocal-config-root");
    if(window.BDLocalConfigUI && typeof window.BDLocalConfigUI.init === "function" && root){
      return Promise.resolve(window.BDLocalConfigUI.init({ container:root })).catch(function(error){ log("No se pudo iniciar la interfaz central: " + error.message, "warn"); return null; });
    }
    return Promise.resolve(null);
  }

  function boot(){
    if(state.booting || state.ready){ return Promise.resolve(state); }
    state.booting = true;
    setRuntimePill();
    setDbPill("warn", "Inicializando");
    setButtonsDisabled(true);

    if(!core || !db){
      state.booting = false;
      setDbPill("bad", "Faltan módulos");
      log("BL2 no puede iniciar porque faltan módulos.", "error");
      return Promise.reject(new Error("Faltan BL2Core o BL2DB."));
    }

    return core.init().then(function(){
      state.ready = true;
      setupEvents();
      return initCenter();
    }).then(function(){
      if(window.BDLSyncUIBridge && typeof window.BDLSyncUIBridge.bind === "function"){ window.BDLSyncUIBridge.bind(); }
      if(backup && typeof backup.dailyIfNeeded === "function"){
        backup.dailyIfNeeded({ scope:"all" }).catch(function(error){ log("Respaldo diario pendiente: " + error.message, "warn"); });
      }
      return refresh();
    }).then(function(result){
      setDbPill("ok", "BL2 activo");
      log("BL2 inicializado correctamente.", "ok");
      try{ window.dispatchEvent(new CustomEvent("bl2:ready",{ detail:{ ok:true, activePeriod:state.activePeriod } })); }catch(error){}
      return result;
    }).catch(function(error){
      state.ready = false;
      setDbPill("bad", "Error BL2");
      log("No se pudo iniciar BL2: " + error.message, "error");
      notify("No se pudo iniciar Base Local: " + error.message, "error");
      throw error;
    }).finally(function(){ state.booting = false; setButtonsDisabled(false); });
  }

  function runTarget(target){
    if(window.BDLSyncUIBridge && typeof window.BDLSyncUIBridge.runTarget === "function"){ return window.BDLSyncUIBridge.runTarget(target, { confirm:true }); }
    return Promise.reject(new Error("El puente de sincronización no está disponible."));
  }

  window.BL2App = {
    boot:boot,
    refresh:refresh,
    setPeriod:setPeriod,
    handleGoogleSync:function(){ return runTarget("google"); },
    handleFirebaseSync:function(){ return runTarget("firebase"); },
    getSelectedPeriod:selectedPeriod,
    getState:function(){ return { ready:state.ready, activePeriod:state.activePeriod, periods:state.periods.slice(), lastImportSummary:state.lastImportSummary }; }
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ boot().catch(function(){}); });
  }else{
    boot().catch(function(){});
  }
})(window, document);

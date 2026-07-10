/* =========================================================
Nombre completo: bl2.app.js
Ruta o ubicación: /BDLocal/bl2.app.js
Función o funciones:
- Inicializar Base Local únicamente después de cargar todos los módulos.
- Controlar el período activo, indicadores y refresco general.
- Resolver dinámicamente prueba, respaldo y sincronización.
- Volver a enlazar las acciones seguras después de construir la interfaz.
- No iniciar sincronizaciones externas automáticas.
========================================================= */
(function(window,document){
  "use strict";

  var state = {
    ready:false,
    booting:false,
    scriptsReady:false,
    activePeriod:null,
    periods:[],
    lastImportSummary:null,
    syncBarTimer:null,
    eventsBound:false
  };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function byId(name){ return document.getElementById(name); }
  function config(){ return window.BL2Config || {}; }
  function core(){ return window.BL2Core || null; }
  function db(){ return window.BL2DB || null; }
  function backup(){ return window.BL2Backup || window.BL2BackupV2 || null; }
  function test(){ return window.BL2Test || null; }
  function now(){ var utils = config().utils || {}; return typeof utils.nowISO === "function" ? utils.nowISO() : new Date().toISOString(); }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function number(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }
  function formatNumber(value){ try{ return number(value).toLocaleString("es-EC"); }catch(error){ return String(number(value)); } }
  function formatDate(value){ var parsed = new Date(value || 0); return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("es-EC") : text(value || "—"); }
  function setText(name,value){ var element = byId(name); if(element){ element.textContent = value; } }

  function log(message,level){
    var box = byId("bl2-log");
    if(box){
      var item = document.createElement("div");
      item.className = "bl2-log-item " + (level ? "is-" + level : "");
      item.innerHTML = "<strong>" + esc(formatDate(now())) + "</strong><span>" + esc(message) + "</span>";
      box.insertBefore(item,box.firstChild);
      while(box.children.length > 120){ box.removeChild(box.lastElementChild); }
    }
    var currentCore = core();
    if(currentCore && typeof currentCore.log === "function"){
      currentCore.log(level === "error" ? "ERROR" : level === "warn" ? "WARN" : "INFO",message).catch(function(){});
    }
  }

  function setDbPill(status,message){
    var pill = byId("bl2-db-pill");
    if(!pill){ return; }
    pill.className = "bl2-pill " + (status === "ok" ? "bl2-pill-ok" : status === "bad" ? "bl2-pill-bad" : "bl2-pill-warn");
    pill.textContent = message || status;
  }

  function setButtonsDisabled(disabled){
    [
      "bl2-btn-refresh","bl2-btn-period-save","bl2-btn-test","bl2-btn-export",
      "bl2-btn-push-google","bl2-btn-push-firebase","bl2-btn-push-supabase",
      "bl2-btn-pull-sheets","bl2-btn-fetch-firebase-config","bl2-btn-sync-queue"
    ].forEach(function(name){ var button = byId(name); if(button){ button.disabled = !!disabled; } });
  }

  function selectedPeriod(){
    var select = byId("bl2-period-select");
    var periodoId = text(select && select.value);
    if(!periodoId && state.activePeriod){ periodoId = text(state.activePeriod.id); }
    var row = state.periods.filter(function(period){ return text(period.id) === periodoId; })[0];
    return { id:periodoId,label:text(row && (row.label || row.periodoLabel) || periodoId) };
  }

  function renderPeriods(){
    var select = byId("bl2-period-select");
    var list = byId("bl2-period-list");
    var search = text((byId("bl2-period-search") || {}).value).toLowerCase();
    var selected = state.activePeriod ? text(state.activePeriod.id) : text(select && select.value);

    if(select){
      select.innerHTML = '<option value="">Seleccione un período...</option>' + state.periods.map(function(period){
        var periodoId = text(period.id);
        var label = text(period.label || period.periodoLabel || periodoId);
        return '<option value="' + esc(periodoId) + '"' + (periodoId === selected ? " selected" : "") + '>' + esc(label) + '</option>';
      }).join("");
    }

    if(!list){ return; }
    var rows = state.periods.filter(function(period){ return !search || [period.id,period.label,period.periodoLabel].join(" ").toLowerCase().indexOf(search) >= 0; });
    if(!rows.length){ list.innerHTML = '<div class="bl2-empty">No hay períodos cargados todavía.</div>'; return; }
    list.innerHTML = rows.map(function(period){
      var periodoId = text(period.id);
      var label = text(period.label || period.periodoLabel || periodoId);
      var active = state.activePeriod && text(state.activePeriod.id) === periodoId;
      return '<div class="bl2-period-item"><div><strong>' + esc(label) + '</strong><span>' + esc(periodoId) + '</span></div><span class="bl2-pill ' + (active ? 'bl2-pill-ok' : 'bl2-pill-soft') + '">' + (active ? 'Activo' : 'Disponible') + '</span><button class="bl2-btn bl2-btn-light" type="button" data-bl2-period="' + esc(periodoId) + '">Usar</button></div>';
    }).join("");
    Array.prototype.slice.call(list.querySelectorAll("[data-bl2-period]")).forEach(function(button){
      button.addEventListener("click",function(){
        var periodoId = button.getAttribute("data-bl2-period");
        var row = state.periods.filter(function(period){ return text(period.id) === periodoId; })[0];
        setPeriod(periodoId,row ? row.label || row.periodoLabel : periodoId).catch(function(error){ notify(error.message,"error"); });
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
    setText("bl2-kpi-period",active.label || active.periodoLabel || "—");
    setText("bl2-kpi-period-id",active.id || "Sin seleccionar");
    var currentCore = core();
    if(!active.id || !currentCore || typeof currentCore.getSummary !== "function"){
      setText("bl2-kpi-students","0");
      return Promise.resolve({});
    }
    return currentCore.getSummary(active.id).then(function(summary){
      summary = summary || {};
      setText("bl2-kpi-students",formatNumber(summary.totalEstudiantes));
      setText("bdlc-kpi-active",formatNumber(summary.totalActivos));
      setText("bdlc-kpi-retired",formatNumber(summary.totalRetirados));
      setText("bl2-kpi-google",formatNumber(summary.pendientesGoogle));
      setText("bl2-kpi-firebase",formatNumber(summary.pendientesFirebase));
      return summary;
    }).catch(function(error){ log("No se pudieron actualizar los indicadores: " + error.message,"warn"); return {}; });
  }

  function refresh(){
    var currentCore = core();
    if(!currentCore){ setDbPill("bad","Sin núcleo"); return Promise.reject(new Error("BL2Core no está cargado.")); }
    return currentCore.getPeriods().then(function(periods){
      state.periods = Array.isArray(periods) ? periods : [];
      return currentCore.getActivePeriod();
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
      if(window.BL2CloudPullSafe && typeof window.BL2CloudPullSafe.bind === "function"){ window.BL2CloudPullSafe.bind(); }
      setDbPill("ok","BL2 activo");
      try{ window.dispatchEvent(new CustomEvent("bl2:app-refreshed",{ detail:{ activePeriod:state.activePeriod,summary:summary || {} } })); }catch(error){}
      return summary;
    }).catch(function(error){ setDbPill("bad","Error BL2"); log("Error al refrescar BL2: " + error.message,"error"); throw error; });
  }

  function setPeriod(periodoId,periodoLabel){
    periodoId = text(periodoId);
    if(!periodoId){ notify("Seleccione un período válido.","warning"); return Promise.resolve(null); }
    var currentCore = core();
    if(!currentCore || typeof currentCore.setActivePeriod !== "function"){ return Promise.reject(new Error("No se puede cambiar el período.")); }
    setButtonsDisabled(true);
    return currentCore.setActivePeriod(periodoId,periodoLabel || periodoId).then(function(period){
      state.activePeriod = period;
      log("Período activo: " + (period.label || period.id),"ok");
      try{ window.dispatchEvent(new CustomEvent("bl2:period-changed",{ detail:{ period:period } })); }catch(error){}
      return refresh();
    }).finally(function(){ setButtonsDisabled(false); });
  }

  function notify(message,type){
    if(window.BDLocalConfigUI && typeof window.BDLocalConfigUI.notify === "function"){ window.BDLocalConfigUI.notify(message,type || "info"); }
    else{ window.alert(message); }
  }

  function handlePeriodSave(){
    var period = selectedPeriod();
    if(!period.id){ notify("Seleccione un período.","warning"); return; }
    setPeriod(period.id,period.label).catch(function(error){ notify(error.message,"error"); });
  }

  function handleTest(){
    var currentTest = test();
    if(!currentTest || typeof currentTest.run !== "function"){ notify("BL2Test no está disponible.","warning"); return; }
    setButtonsDisabled(true);
    log("Ejecutando prueba BL2 de solo lectura...","info");
    currentTest.run({ log:true }).then(function(report){
      var ok = report && report.ok;
      notify(ok ? "Prueba BL2 correcta." : "La prueba detectó controles pendientes. Revise Diagnóstico y salud.",ok ? "success" : "error");
      log(ok ? "Prueba BL2 correcta." : "Prueba BL2 con errores.",ok ? "ok" : "error");
      return refresh();
    }).catch(function(error){ notify("Error en prueba BL2: " + error.message,"error"); log("Error en prueba BL2: " + error.message,"error"); }).finally(function(){ setButtonsDisabled(false); });
  }

  function handleExport(){
    var currentBackup = backup();
    var period = selectedPeriod();
    if(!currentBackup || typeof currentBackup.exportManual !== "function"){ notify("El módulo de respaldo no está disponible.","warning"); return; }
    var all = window.confirm("Aceptar: respaldar toda la base.\nCancelar: respaldar solo el período activo.");
    if(!all && !period.id){ notify("Seleccione un período para crear el respaldo.","warning"); return; }
    setButtonsDisabled(true);
    currentBackup.exportManual({ scope:all ? "all" : "period",periodoId:all ? "" : period.id,periodoLabel:all ? "" : period.label }).then(function(result){
      notify("Respaldo exportado correctamente.","success");
      log("Respaldo exportado: " + (result.fileName || "archivo JSON"),"ok");
    }).catch(function(error){ notify("No se pudo exportar: " + error.message,"error"); log("Error exportando respaldo: " + error.message,"error"); }).finally(function(){ setButtonsDisabled(false); });
  }

  function showSyncBar(detail){
    detail = detail || {};
    var bar = byId("bl2-sync-bar");
    var fill = byId("bl2-sync-progress");
    var percent = Math.max(0,Math.min(100,number(detail.percent)));
    if(!bar){ return; }
    bar.hidden = false;
    setText("bl2-sync-title",detail.target ? "Sincronizando " + detail.target : "Procesando BDLocal");
    setText("bl2-sync-detail",detail.detail || "Procesando...");
    setText("bl2-sync-percent",Math.round(percent) + "%");
    if(fill){ fill.style.width = percent + "%"; }
    window.clearTimeout(state.syncBarTimer);
    if(percent >= 100 || percent <= 0){ state.syncBarTimer = window.setTimeout(function(){ bar.hidden = true; },2500); }
  }

  function setupEvents(){
    if(state.eventsBound){ return; }
    state.eventsBound = true;
    var save = byId("bl2-btn-period-save");
    var refreshButton = byId("bl2-btn-refresh");
    var testButton = byId("bl2-btn-test");
    var exportButton = byId("bl2-btn-export");
    var search = byId("bl2-period-search");
    if(save){ save.addEventListener("click",handlePeriodSave); }
    if(refreshButton){ refreshButton.addEventListener("click",function(){ setButtonsDisabled(true); refresh().finally(function(){ setButtonsDisabled(false); }); }); }
    if(testButton){ testButton.addEventListener("click",handleTest); }
    if(exportButton){ exportButton.addEventListener("click",handleExport); }
    if(search){ search.addEventListener("input",renderPeriods); }
    window.addEventListener("bl2:sync-progress",function(event){ showSyncBar(event.detail || {}); });
    window.addEventListener("bl2:students-saved",function(event){ state.lastImportSummary = event.detail || null; renderImportSummary(state.lastImportSummary); refresh(); });
    window.addEventListener("bl2:student-updated",refresh);
    window.addEventListener("bdlocal:sync-v2-finished",refresh);
  }

  function initCenter(){
    var root = byId("bdlocal-control-center-root") || byId("bdlocal-config-root");
    if(window.BDLocalConfigUI && typeof window.BDLocalConfigUI.init === "function" && root){
      return Promise.resolve(window.BDLocalConfigUI.init({ container:root })).catch(function(error){ log("No se pudo iniciar la interfaz central: " + error.message,"warn"); return null; });
    }
    return Promise.resolve(null);
  }

  function boot(){
    if(state.booting || state.ready){ return Promise.resolve(state); }
    state.booting = true;
    setText("bl2-runtime-pill",window.electronAPI ? "Electron" : "Navegador");
    setDbPill("warn","Inicializando");
    setButtonsDisabled(true);

    var currentCore = core();
    var currentDb = db();
    if(!currentCore || !currentDb){
      state.booting = false;
      setDbPill("bad","Faltan módulos");
      return Promise.reject(new Error("Faltan BL2Core o BL2DB."));
    }

    return currentCore.init().then(function(){
      state.ready = true;
      setupEvents();
      return initCenter();
    }).then(function(){
      if(window.BDLSyncUIBridge && typeof window.BDLSyncUIBridge.bind === "function"){ return window.BDLSyncUIBridge.bind(); }
      return null;
    }).then(function(){
      if(window.BL2CloudPullSafe && typeof window.BL2CloudPullSafe.bind === "function"){ window.BL2CloudPullSafe.bind(); }
      var currentBackup = backup();
      if(currentBackup && typeof currentBackup.dailyIfNeeded === "function"){
        currentBackup.dailyIfNeeded({ scope:"all" }).catch(function(error){ log("Respaldo diario pendiente: " + error.message,"warn"); });
      }
      return refresh();
    }).then(function(result){
      setDbPill("ok","BL2 activo");
      log("BL2 inicializado después de verificar todos los módulos.","ok");
      try{ window.dispatchEvent(new CustomEvent("bl2:ready",{ detail:{ ok:true,activePeriod:state.activePeriod } })); }catch(error){}
      return result;
    }).catch(function(error){
      state.ready = false;
      setDbPill("bad","Error BL2");
      log("No se pudo iniciar BL2: " + error.message,"error");
      notify("No se pudo iniciar Base Local: " + error.message,"error");
      throw error;
    }).finally(function(){ state.booting = false; setButtonsDisabled(false); });
  }

  function runTarget(target){
    if(window.BDLSyncUIBridge && typeof window.BDLSyncUIBridge.runTarget === "function"){ return window.BDLSyncUIBridge.runTarget(target,{ confirm:true,limit:25 }); }
    return Promise.reject(new Error("El puente de sincronización no está disponible."));
  }

  window.BL2App = {
    boot:boot,
    refresh:refresh,
    setPeriod:setPeriod,
    handleGoogleSync:function(){ return runTarget("google"); },
    handleFirebaseSync:function(){ return runTarget("firebase"); },
    getSelectedPeriod:selectedPeriod,
    getState:function(){ return { ready:state.ready,booting:state.booting,scriptsReady:state.scriptsReady,activePeriod:state.activePeriod,periods:state.periods.slice(),lastImportSummary:state.lastImportSummary }; }
  };

  function bootAfterScripts(){ state.scriptsReady = true; boot().catch(function(){}); }
  window.addEventListener("bdlocal:bl2-html-scripts-loaded",bootAfterScripts,{ once:true });

  var managedLoader = !!document.querySelector("script[data-bl2-loader-src]");
  if(!managedLoader){
    if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded",bootAfterScripts,{ once:true }); }
    else{ bootAfterScripts(); }
  }
})(window,document);

/* =========================================================
Archivo: bl2.app.js
Ruta: /BDLocal/bl2.app.js
Función:
- Controlar la pantalla principal BL2.
- Conectar botones: cargar, sincronizar Google, sincronizar Firebase,
  probar y exportar.
- Renderizar períodos, KPIs, resumen de carga, barra de sincronización y logs.
- Ejecutar sincronización frecuente de Google y diaria de Firebase en inactividad.
========================================================= */
(function(window, document){
  "use strict";

  var config = window.BL2Config || {};
  var core = window.BL2Core;
  var db = window.BL2DB;
  var importer = window.BL2Import;
  var sync = window.BL2Sync;
  var backup = window.BL2Backup;
  var test = window.BL2Test;
  var utils = config.utils || {};
  var settingsKeys = config.settingsKeys || {};
  var syncConfig = config.sync || {};

  var state = {
    ready: false,
    activePeriod: null,
    periods: [],
    lastImportSummary: null,
    idleTimer: null,
    syncBarTimer: null
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function esc(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function nowISO(){
    return utils.nowISO ? utils.nowISO() : new Date().toISOString();
  }

  function byId(id){
    return document.getElementById(id);
  }

  function setText(id, value){
    var el = byId(id);
    if(el){
      el.textContent = value;
    }
  }

  function setHTML(id, html){
    var el = byId(id);
    if(el){
      el.innerHTML = html;
    }
  }

  function formatNumber(value){
    var n = Number(value || 0);
    if(!Number.isFinite(n)){
      n = 0;
    }

    try{
      return n.toLocaleString("es-EC");
    }catch(error){
      return String(n);
    }
  }

  function formatDateTime(value){
    if(!text(value)){
      return "—";
    }

    var d = new Date(value);

    if(!Number.isFinite(d.getTime())){
      return text(value);
    }

    try{
      return d.toLocaleString("es-EC", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    }catch(error){
      return d.toLocaleString();
    }
  }

  function log(message, type){
    type = text(type || "info");

    var box = byId("bl2-log");
    if(!box){
      return;
    }

    var item = document.createElement("div");
    item.className = "bl2-log-item";
    item.innerHTML = "<strong>" + esc(formatDateTime(nowISO())) + "</strong><span>" + esc(message) + "</span>";

    if(box.querySelector(".bl2-log-item") && box.children.length > 120){
      box.removeChild(box.lastElementChild);
    }

    box.insertBefore(item, box.firstChild);

    if(core && typeof core.log === "function"){
      core.log(type === "error" ? "ERROR" : type === "warn" ? "WARN" : "INFO", message).catch(function(){});
    }
  }

  function setDbPill(status, message){
    var pill = byId("bl2-db-pill");
    if(!pill){
      return;
    }

    pill.className = "bl2-pill " + (
      status === "ok" ? "bl2-pill-ok" :
      status === "bad" ? "bl2-pill-bad" :
      "bl2-pill-warn"
    );

    pill.textContent = message || status;
  }

  function setRuntimePill(){
    var pill = byId("bl2-runtime-pill");
    if(!pill){
      return;
    }

    if(window.electronAPI){
      pill.textContent = "Electron";
    }else{
      pill.textContent = "Navegador";
    }
  }

  function setButtonsDisabled(disabled){
    [
      "bl2-btn-load",
      "bl2-btn-sync-google",
      "bl2-btn-sync-firebase",
      "bl2-btn-test",
      "bl2-btn-export",
      "bl2-btn-period-save",
      "bl2-btn-refresh"
    ].forEach(function(id){
      var btn = byId(id);
      if(btn){
        btn.disabled = !!disabled;
      }
    });
  }

  function getSelectedPeriod(){
    var select = byId("bl2-period-select");
    var value = select ? text(select.value) : "";

    if(!value && state.activePeriod){
      value = state.activePeriod.id;
    }

    var period = state.periods.find(function(item){
      return text(item.id) === value;
    });

    if(period){
      return {
        id: period.id,
        label: period.label || period.periodoLabel || period.id
      };
    }

    return {
      id: value,
      label: value
    };
  }

  function renderPeriods(){
    var select = byId("bl2-period-select");
    var list = byId("bl2-period-list");
    var search = text((byId("bl2-period-search") || {}).value).toLowerCase();

    var periods = state.periods.slice();

    if(search){
      periods = periods.filter(function(period){
        return [
          period.id,
          period.label,
          period.periodoLabel
        ].some(function(value){
          return text(value).toLowerCase().indexOf(search) >= 0;
        });
      });
    }

    if(select){
      var selected = state.activePeriod ? state.activePeriod.id : text(select.value);

      select.innerHTML = '<option value="">Seleccione un período...</option>' + state.periods.map(function(period){
        var id = text(period.id);
        var label = text(period.label || period.periodoLabel || id);

        return '<option value="' + esc(id) + '"' + (id === selected ? " selected" : "") + ">" + esc(label) + "</option>";
      }).join("");
    }

    if(list){
      if(!periods.length){
        list.innerHTML = '<div class="bl2-empty">No hay períodos cargados todavía.</div>';
        return;
      }

      list.innerHTML = periods.map(function(period){
        var id = text(period.id);
        var label = text(period.label || period.periodoLabel || id);
        var active = state.activePeriod && state.activePeriod.id === id;

        return ''
          + '<div class="bl2-period-item">'
          + '  <div>'
          + '    <strong>' + esc(label) + '</strong>'
          + '    <span>' + esc(id) + '</span>'
          + '  </div>'
          + '  <div class="bl2-period-meta">'
          + '    <span class="bl2-pill ' + (active ? 'bl2-pill-ok' : 'bl2-pill-soft') + '">' + (active ? 'Activo' : 'Disponible') + '</span>'
          + '  </div>'
          + '  <button class="bl2-btn bl2-btn-light" type="button" data-bl2-period="' + esc(id) + '">Usar</button>'
          + '</div>';
      }).join("");

      Array.prototype.slice.call(list.querySelectorAll("[data-bl2-period]")).forEach(function(btn){
        btn.addEventListener("click", function(){
          var id = btn.getAttribute("data-bl2-period");
          var period = state.periods.find(function(item){ return text(item.id) === id; });
          setPeriod(id, period ? period.label : id);
        });
      });
    }
  }

  function renderSummary(summary){
    var target = byId("bl2-import-summary");

    if(!target){
      return;
    }

    if(!summary){
      target.innerHTML = '<div class="bl2-empty">Todavía no se ha cargado ningún archivo en esta sesión.</div>';
      return;
    }

    var warnings = Array.isArray(summary.advertencias) ? summary.advertencias : [];
    var errors = Array.isArray(summary.errores) ? summary.errores : [];

    target.innerHTML = ''
      + '<div class="bl2-summary-grid">'
      + '  <div class="bl2-summary-item"><span>Período</span><strong>' + esc(summary.periodoLabel || summary.periodoId || "—") + '</strong></div>'
      + '  <div class="bl2-summary-item"><span>Guardados</span><strong>' + formatNumber(summary.guardados || 0) + '</strong></div>'
      + '  <div class="bl2-summary-item"><span>Actualizados</span><strong>' + formatNumber(summary.actualizados || 0) + '</strong></div>'
      + '  <div class="bl2-summary-item"><span>Duplicados</span><strong>' + formatNumber(summary.duplicados || 0) + '</strong></div>'
      + '</div>'
      + '<div class="bl2-warning-list">'
      + warnings.slice(0, 8).map(function(item){
        return '<div class="bl2-warning">' + esc(item) + '</div>';
      }).join("")
      + errors.slice(0, 8).map(function(item){
        return '<div class="bl2-warning">' + esc(item) + '</div>';
      }).join("")
      + ((warnings.length + errors.length) > 8 ? '<div class="bl2-warning">Hay más advertencias. Revise consola o registros.</div>' : '')
      + '</div>';
  }

  function renderKPIs(){
    var active = state.activePeriod || {};

    setText("bl2-kpi-period", active.label || "—");
    setText("bl2-kpi-period-id", active.id || "Sin seleccionar");

    if(!active.id || !core){
      setText("bl2-kpi-students", "0");
      setText("bl2-kpi-google", "0");
      setText("bl2-kpi-firebase", "0");
      setText("bl2-kpi-warnings", state.lastImportSummary ? String((state.lastImportSummary.advertencias || []).length) : "0");
      return Promise.resolve();
    }

    return core.getSummary(active.id).then(function(summary){
      setText("bl2-kpi-students", formatNumber(summary.totalEstudiantes || 0));
      setText("bl2-kpi-google", formatNumber(summary.pendientesGoogle || 0));
      setText("bl2-kpi-firebase", formatNumber(summary.pendientesFirebase || 0));
      setText("bl2-kpi-warnings", state.lastImportSummary ? formatNumber((state.lastImportSummary.advertencias || []).length) : "0");
      return summary;
    }).catch(function(error){
      log("No se pudieron actualizar KPIs: " + error.message, "warn");
    });
  }

  function refresh(){
    if(!core){
      setDbPill("bad", "Sin núcleo");
      return Promise.reject(new Error("BL2Core no está cargado."));
    }

    return core.getPeriods().then(function(periods){
      state.periods = Array.isArray(periods) ? periods : [];
      return core.getActivePeriod();
    }).then(function(period){
      state.activePeriod = period;
      renderPeriods();
      renderSummary(state.lastImportSummary);
      return renderKPIs();
    }).then(function(){
      setDbPill("ok", "BL2 activo");
    }).catch(function(error){
      setDbPill("bad", "Error BL2");
      log("Error al refrescar BL2: " + error.message, "error");
      throw error;
    });
  }

  function setPeriod(periodoId, periodoLabel){
    periodoId = text(periodoId);

    if(!periodoId){
      log("Seleccione un período válido.", "warn");
      return Promise.resolve(null);
    }

    return core.setActivePeriod(periodoId, periodoLabel || periodoId).then(function(period){
      state.activePeriod = period;
      log("Período activo: " + (period.label || period.id), "ok");
      return refresh();
    });
  }

  function handlePeriodSave(){
    var selected = getSelectedPeriod();

    if(!selected.id){
      alert("Seleccione un período.");
      return;
    }

    setPeriod(selected.id, selected.label);
  }

  function handleFileInput(event){
    var file = event && event.target && event.target.files ? event.target.files[0] : null;

    if(!file){
      return;
    }

    var period = getSelectedPeriod();

    if(!period.id){
      alert("Seleccione primero el período antes de cargar el Excel.");
      event.target.value = "";
      return;
    }

    setButtonsDisabled(true);
    log("Leyendo archivo: " + file.name, "info");

    importer.importFile(file, {
      periodoId: period.id,
      periodoLabel: period.label
    }).then(function(result){
      if(!result.students.length){
        throw new Error("El archivo no tiene estudiantes válidos para guardar.");
      }

      return core.saveStudents(result.students, {
        normalized: true,
        periodoId: period.id,
        periodoLabel: period.label,
        importResult: result
      });
    }).then(function(summary){
      state.lastImportSummary = summary;
      renderSummary(summary);
      log("Carga completada. Guardados: " + summary.guardados + ", actualizados: " + summary.actualizados + ".", "ok");

      if(backup && typeof backup.dailyIfNeeded === "function"){
        backup.dailyIfNeeded({
          scope: "all"
        }).catch(function(error){
          log("No se pudo crear respaldo diario: " + error.message, "warn");
        });
      }

      return refresh();
    }).catch(function(error){
      alert("No se pudo cargar el archivo: " + error.message);
      log("Error en carga: " + error.message, "error");
    }).finally(function(){
      setButtonsDisabled(false);
      event.target.value = "";
    });
  }

  function handleLoad(){
    var input = byId("bl2-file-input");

    if(!getSelectedPeriod().id){
      alert("Seleccione primero un período.");
      return;
    }

    if(input){
      input.click();
    }
  }

  function ensureGoogleUrl(){
    if(!sync || typeof sync.getGoogleScriptUrl !== "function"){
      return Promise.resolve("");
    }

    return sync.getGoogleScriptUrl().then(function(url){
      if(text(url)){
        return url;
      }

      var entered = prompt("Pegue la URL del Apps Script de Google Sheets:");

      if(!text(entered)){
        return "";
      }

      return sync.setGoogleScriptUrl(entered).then(function(){
        return entered;
      });
    });
  }

  function handleGoogleSync(force){
    var period = getSelectedPeriod();

    if(!period.id){
      alert("Seleccione un período.");
      return;
    }

    ensureGoogleUrl().then(function(url){
      if(!text(url)){
        log("Google Sheets no se sincronizó porque falta URL de Apps Script.", "warn");
        setText("bl2-google-status", "Pendiente de URL de Apps Script.");
        return null;
      }

      setButtonsDisabled(true);
      log("Iniciando sincronización Google Sheets...", "info");

      return sync.syncGoogle({
        periodoId: period.id,
        periodoLabel: period.label,
        force: !!force,
        fullPeriod: true
      }).then(function(result){
        if(result.ok){
          setText("bl2-google-status", "Última sincronización: " + formatDateTime(nowISO()));
          log("Google Sheets sincronizado.", "ok");
        }else{
          setText("bl2-google-status", "No sincronizado: " + (result.reason || result.error || "sin detalle"));
          log("Google Sheets no sincronizó: " + (result.reason || result.error || "sin detalle"), "warn");
        }

        return refresh();
      });
    }).catch(function(error){
      alert("Error Google Sheets: " + error.message);
      log("Error Google Sheets: " + error.message, "error");
    }).finally(function(){
      setButtonsDisabled(false);
    });
  }

  function chooseFirebaseAction(){
    var value = prompt(
      "Firebase por período:\n\n" +
      "1 = Subir período BL2 a Firebase\n" +
      "2 = Descargar período desde Firebase\n" +
      "3 = Comparar BL2 vs Firebase\n\n" +
      "Escriba 1, 2 o 3:",
      "1"
    );

    value = text(value);

    if(value === "2"){
      return "download";
    }

    if(value === "3"){
      return "compare";
    }

    if(value === "1"){
      return "upload";
    }

    return "";
  }

  function handleFirebaseSync(force){
    var period = getSelectedPeriod();

    if(!period.id){
      alert("Seleccione un período.");
      return;
    }

    var action = chooseFirebaseAction();

    if(!action){
      log("Sincronización Firebase cancelada.", "warn");
      return;
    }

    setButtonsDisabled(true);
    log("Iniciando Firebase: " + action + ".", "info");

    sync.syncFirebase({
      periodoId: period.id,
      periodoLabel: period.label,
      action: action,
      force: !!force
    }).then(function(result){
      if(result.ok){
        setText("bl2-firebase-status", "Última operación: " + action + " · " + formatDateTime(nowISO()));
        log("Firebase completado: " + action + ".", "ok");

        if(action === "compare" && result.detail){
          console.log("[BL2 Firebase Compare]", result);
          alert(
            "Comparación Firebase finalizada:\n\n" +
            "Locales: " + result.local + "\n" +
            "Firebase: " + result.remote + "\n" +
            "Iguales: " + result.equal + "\n" +
            "Diferentes: " + result.different + "\n" +
            "Solo BL2: " + result.onlyLocal + "\n" +
            "Solo Firebase: " + result.onlyRemote + "\n\n" +
            "El detalle está en consola."
          );
        }
      }else{
        setText("bl2-firebase-status", "Error: " + (result.error || "sin detalle"));
        log("Firebase falló: " + (result.error || "sin detalle"), "error");
      }

      return refresh();
    }).catch(function(error){
      alert("Error Firebase: " + error.message);
      log("Error Firebase: " + error.message, "error");
    }).finally(function(){
      setButtonsDisabled(false);
    });
  }

  function handleTest(){
    if(!test || typeof test.run !== "function"){
      alert("BL2Test no está disponible.");
      return;
    }

    setButtonsDisabled(true);
    log("Ejecutando prueba BL2...", "info");

    test.run({
      log: true
    }).then(function(report){
      if(report.ok){
        alert("Prueba BL2 correcta.\n\nAprobadas: " + report.summary.passed + "\nAdvertencias: " + report.summary.warned);
        log("Prueba BL2 correcta.", "ok");
      }else{
        alert("Prueba BL2 con errores.\n\nFallidas: " + report.summary.failed + "\nRevise consola.");
        log("Prueba BL2 con errores.", "error");
      }

      return refresh();
    }).catch(function(error){
      alert("Error en prueba BL2: " + error.message);
      log("Error en prueba BL2: " + error.message, "error");
    }).finally(function(){
      setButtonsDisabled(false);
    });
  }

  function handleExport(){
    var period = getSelectedPeriod();

    var scope = prompt(
      "Exportar respaldo JSON:\n\n" +
      "1 = Solo período activo\n" +
      "2 = Toda BL2\n\n" +
      "Escriba 1 o 2:",
      "1"
    );

    scope = text(scope);

    if(scope !== "1" && scope !== "2"){
      log("Exportación cancelada.", "warn");
      return;
    }

    setButtonsDisabled(true);

    backup.exportManual({
      scope: scope === "2" ? "all" : "period",
      periodoId: scope === "2" ? "" : period.id,
      periodoLabel: scope === "2" ? "" : period.label
    }).then(function(result){
      log("Respaldo exportado: " + result.fileName, "ok");
    }).catch(function(error){
      alert("No se pudo exportar: " + error.message);
      log("Error exportando respaldo: " + error.message, "error");
    }).finally(function(){
      setButtonsDisabled(false);
    });
  }

  function showSyncBar(detail){
    var bar = byId("bl2-sync-bar");
    var progress = byId("bl2-sync-progress");
    var percent = byId("bl2-sync-percent");

    if(!bar){
      return;
    }

    bar.hidden = false;

    setText("bl2-sync-title", detail.target === "firebase" ? "Sincronizando Firebase" : "Sincronizando Google Sheets");
    setText("bl2-sync-detail", detail.detail || "Procesando...");
    setText("bl2-sync-percent", Math.round(Number(detail.percent || 0)) + "%");

    if(progress){
      progress.style.width = Math.max(0, Math.min(100, Number(detail.percent || 0))) + "%";
    }

    if(state.syncBarTimer){
      clearTimeout(state.syncBarTimer);
    }

    if(Number(detail.percent || 0) >= 100 || Number(detail.percent || 0) <= 0){
      state.syncBarTimer = setTimeout(function(){
        bar.hidden = true;
      }, 2500);
    }
  }

  function setupEvents(){
    var btnLoad = byId("bl2-btn-load");
    var btnGoogle = byId("bl2-btn-sync-google");
    var btnFirebase = byId("bl2-btn-sync-firebase");
    var btnTest = byId("bl2-btn-test");
    var btnExport = byId("bl2-btn-export");
    var btnSavePeriod = byId("bl2-btn-period-save");
    var btnRefresh = byId("bl2-btn-refresh");
    var input = byId("bl2-file-input");
    var select = byId("bl2-period-select");
    var search = byId("bl2-period-search");

    if(btnLoad){ btnLoad.addEventListener("click", handleLoad); }
    if(btnGoogle){ btnGoogle.addEventListener("click", function(){ handleGoogleSync(true); }); }
    if(btnFirebase){ btnFirebase.addEventListener("click", function(){ handleFirebaseSync(true); }); }
    if(btnTest){ btnTest.addEventListener("click", handleTest); }
    if(btnExport){ btnExport.addEventListener("click", handleExport); }
    if(btnSavePeriod){ btnSavePeriod.addEventListener("click", handlePeriodSave); }
    if(btnRefresh){ btnRefresh.addEventListener("click", refresh); }
    if(input){ input.addEventListener("change", handleFileInput); }

    if(select){
      select.addEventListener("change", function(){
        var selected = getSelectedPeriod();
        if(selected.id){
          setPeriod(selected.id, selected.label);
        }
      });
    }

    if(search){
      search.addEventListener("input", renderPeriods);
    }

    window.addEventListener("bl2:sync-progress", function(event){
      showSyncBar(event.detail || {});
    });

    window.addEventListener("bl2:students-saved", function(event){
      state.lastImportSummary = event.detail || null;
      renderSummary(state.lastImportSummary);
      renderKPIs();
    });

    window.addEventListener("beforeunload", function(){
      try{
        if(sync && typeof sync.syncBeforeClose === "function"){
          sync.syncBeforeClose({
            force: true
          });
        }
      }catch(error){}
    });

    document.addEventListener("visibilitychange", function(){
      if(document.visibilityState === "hidden"){
        try{
          if(sync && typeof sync.syncBeforeClose === "function"){
            sync.syncBeforeClose({
              force: true
            });
          }
        }catch(error){}
      }
    });
  }

  function startIdleWorkers(){
    var idleMs = Number(syncConfig.idleSyncSeconds || 30) * 1000;
    var interval = Math.max(15000, idleMs);

    if(state.idleTimer){
      clearInterval(state.idleTimer);
    }

    state.idleTimer = setInterval(function(){
      if(!state.ready || !sync){
        return;
      }

      var period = state.activePeriod;

      if(!period || !period.id){
        return;
      }

      if(typeof sync.isIdle === "function" && !sync.isIdle()){
        return;
      }

      sync.maybeSyncGoogleIdle({
        periodoId: period.id,
        periodoLabel: period.label,
        fullPeriod: true
      }).then(function(result){
        if(result && result.ok && !result.skipped){
          setText("bl2-google-status", "Última sincronización automática: " + formatDateTime(nowISO()));
          refresh();
        }
      }).catch(function(error){
        setText("bl2-google-status", "Pendiente: " + error.message);
      });

      sync.maybeSyncFirebaseDaily({
        periodoId: period.id,
        periodoLabel: period.label,
        action: "upload"
      }).then(function(result){
        if(result && result.ok && !result.skipped){
          setText("bl2-firebase-status", "Sincronizado hoy: " + formatDateTime(nowISO()));
          refresh();
        }
      }).catch(function(error){
        setText("bl2-firebase-status", "Pendiente: " + error.message);
      });
    }, interval);
  }

  function boot(){
    setRuntimePill();
    setDbPill("warn", "Inicializando");
    setButtonsDisabled(true);

    if(!core || !db){
      setDbPill("bad", "Faltan módulos");
      log("BL2 no puede iniciar porque faltan módulos.", "error");
      return;
    }

    core.init().then(function(){
      state.ready = true;
      setDbPill("ok", "BL2 activo");
      log("BL2 inicializado correctamente.", "ok");
      setupEvents();
      startIdleWorkers();

      if(backup && typeof backup.dailyIfNeeded === "function"){
        backup.dailyIfNeeded({
          scope: "all"
        }).catch(function(error){
          log("Respaldo diario pendiente: " + error.message, "warn");
        });
      }

      return refresh();
    }).catch(function(error){
      setDbPill("bad", "Error BL2");
      alert("No se pudo iniciar BL2: " + error.message);
      log("No se pudo iniciar BL2: " + error.message, "error");
    }).finally(function(){
      setButtonsDisabled(false);
    });
  }

  window.BL2App = {
    boot: boot,
    refresh: refresh,
    setPeriod: setPeriod,
    handleGoogleSync: handleGoogleSync,
    handleFirebaseSync: handleFirebaseSync,
    getState: function(){
      return {
        ready: state.ready,
        activePeriod: state.activePeriod,
        periods: state.periods,
        lastImportSummary: state.lastImportSummary
      };
    }
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})(window, document);
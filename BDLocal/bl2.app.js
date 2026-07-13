/* =========================================================
Nombre completo: bl2.app.js
Ruta o ubicación: /BDLocal/bl2.app.js
Función o funciones:
- Inicializar BDLocal sin bloquear la interfaz por tareas secundarias.
- Controlar período activo, indicadores y refrescos con límites de tiempo.
- Ejecutar cola, conexiones, respaldos y panel central en segundo plano.
- Evitar refrescos simultáneos, bucles de eventos y listeners duplicados.
- Mantener todas las sincronizaciones externas exclusivamente manuales.
- Controlar las descargas de un período y de todos los períodos.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "2.4.0-all-periods-controls";
  var CORE_TIMEOUT_MS = 15000;
  var REFRESH_TIMEOUT_MS = 7000;
  var SECONDARY_TIMEOUT_MS = 8000;

  var state = {
    ready:false,
    booting:false,
    scriptsReady:false,
    activePeriod:null,
    periods:[],
    lastImportSummary:null,
    syncBarTimer:null,
    eventsBound:false,
    bootPromise:null,
    refreshPromise:null,
    refreshTimer:null,
    secondaryTimer:null,
    lastError:"",
    lastReadyAt:""
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

  function isElectron(){
    if(window.electronAPI){ return true; }
    try{ return !!(window.parent && window.parent !== window && window.parent.electronAPI); }
    catch(error){ return false; }
  }

  function timeout(task,ms,label){
    return new Promise(function(resolve,reject){
      var settled = false;
      var timer = window.setTimeout(function(){
        if(settled){ return; }
        settled = true;
        reject(new Error((label || "La operación") + " excedió " + Math.ceil(ms / 1000) + " segundos."));
      },Math.max(250,Number(ms || 0)));

      Promise.resolve()
        .then(function(){ return typeof task === "function" ? task() : task; })
        .then(function(result){
          if(settled){ return; }
          settled = true;
          window.clearTimeout(timer);
          resolve(result);
        })
        .catch(function(error){
          if(settled){ return; }
          settled = true;
          window.clearTimeout(timer);
          reject(error);
        });
    });
  }

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

  function background(label,task,timeoutMs){
    return timeout(task,timeoutMs || SECONDARY_TIMEOUT_MS,label).catch(function(error){
      log(label + ": " + (error && error.message ? error.message : String(error)),"warn");
      return null;
    });
  }

  function setDbPill(status,message){
    var pill = byId("bl2-db-pill");
    if(!pill){ return; }
    pill.className = "bl2-pill " + (status === "ok" ? "bl2-pill-ok" : status === "bad" ? "bl2-pill-bad" : "bl2-pill-warn");
    pill.textContent = message || status;
  }

  function setButtonsDisabled(disabled){
    [
      "bl2-btn-refresh",
      "bl2-btn-period-save",
      "bl2-btn-test",
      "bl2-btn-export",
      "bl2-btn-push-google",
      "bl2-btn-pull-sheets",
      "bl2-btn-pull-sheets-all",
      "bl2-btn-clean-sheets-duplicates",
      "bl2-btn-push-firebase",
      "bl2-btn-pull-firebase",
      "bl2-btn-pull-firebase-all",
      "bl2-btn-fetch-firebase-config",
      "bl2-btn-push-supabase",
      "bl2-btn-sync-queue"
    ].forEach(function(name){
      var button = byId(name);
      if(button){ button.disabled = !!disabled; }
    });
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

    var rows = state.periods.filter(function(period){
      return !search || [period.id,period.label,period.periodoLabel].join(" ").toLowerCase().indexOf(search) >= 0;
    });

    if(!rows.length){
      list.innerHTML = '<div class="bl2-empty">No hay períodos cargados todavía.</div>';
      return;
    }

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

    if(!summary){
      target.innerHTML = '<div class="bl2-empty">Todavía no existe una carga en esta sesión.</div>';
      return;
    }

    var warnings = Array.isArray(summary.advertencias) ? summary.advertencias : [];
    var errors = Array.isArray(summary.errores) ? summary.errores : [];

    target.innerHTML = '<div class="bl2-summary-grid">'
      + '<div class="bl2-summary-item"><span>Período</span><strong>' + esc(summary.periodoLabel || summary.periodoId || summary.periodosProcesados ? "Varios períodos" : "—") + '</strong></div>'
      + '<div class="bl2-summary-item"><span>Guardados</span><strong>' + formatNumber(summary.guardados || summary.aplicados) + '</strong></div>'
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

    return timeout(function(){ return currentCore.getSummary(active.id); },REFRESH_TIMEOUT_MS,"El resumen del período")
      .then(function(summary){
        summary = summary || {};
        setText("bl2-kpi-students",formatNumber(summary.totalEstudiantes));
        setText("bdlc-kpi-active",formatNumber(summary.totalActivos));
        setText("bdlc-kpi-retired",formatNumber(summary.totalRetirados));

        if(summary.pendientesGoogle != null){
          setText("bl2-kpi-google",formatNumber(summary.pendientesGoogle));
        }

        if(summary.pendientesFirebase != null){
          setText("bl2-kpi-firebase",formatNumber(summary.pendientesFirebase));
        }

        return summary;
      })
      .catch(function(error){
        log("No se pudieron actualizar los indicadores: " + error.message,"warn");
        return {};
      });
  }

  function runSecondaryRefresh(reason){
    window.clearTimeout(state.secondaryTimer);

    state.secondaryTimer = window.setTimeout(function(){
      var tasks = [];

      if(window.BDLocalConfigUI && typeof window.BDLocalConfigUI.render === "function"){
        tasks.push(background("Resumen secundario",function(){
          return window.BDLocalConfigUI.render({ refreshConnections:false,reason:reason || "refresh" });
        },SECONDARY_TIMEOUT_MS));
      }

      if(window.BDLSyncUIBridge && typeof window.BDLSyncUIBridge.refreshCounts === "function"){
        tasks.push(background("Conteo de sincronización",function(){
          return window.BDLSyncUIBridge.refreshCounts({ useCache:true,reason:reason || "refresh" });
        },SECONDARY_TIMEOUT_MS));
      }

      Promise.all(tasks).catch(function(){});
    },80);
  }

  function refresh(options){
    options = options || {};

    if(state.refreshPromise && !options.force){ return state.refreshPromise; }

    var currentCore = core();

    if(!currentCore){
      setDbPill("bad","Sin núcleo");
      return Promise.reject(new Error("BL2Core no está cargado."));
    }

    setDbPill("warn",state.ready ? "Actualizando" : "Inicializando");

    state.refreshPromise = timeout(function(){
      return currentCore.getPeriods();
    },REFRESH_TIMEOUT_MS,"La lectura de períodos").then(function(periods){
      state.periods = Array.isArray(periods) ? periods : [];
      return timeout(function(){ return currentCore.getActivePeriod(); },REFRESH_TIMEOUT_MS,"La lectura del período activo");
    }).then(function(period){
      state.activePeriod = period || null;
      renderPeriods();
      renderImportSummary(state.lastImportSummary);
      return renderKPIs();
    }).then(function(summary){
      if(window.BL2CloudPullSafe && typeof window.BL2CloudPullSafe.bind === "function"){
        try{ window.BL2CloudPullSafe.bind(); }
        catch(error){ log("No se pudo enlazar descarga segura: " + error.message,"warn"); }
      }

      setDbPill("ok","BL2 activo");
      state.lastError = "";

      try{
        window.dispatchEvent(new CustomEvent("bl2:app-refreshed",{
          detail:{ activePeriod:state.activePeriod,summary:summary || {},version:VERSION }
        }));
      }catch(error){}

      if(!options.skipSecondary){ runSecondaryRefresh(options.reason || "refresh"); }
      return summary;
    }).catch(function(error){
      state.lastError = error && error.message ? error.message : String(error);
      setDbPill("bad","Error BL2");
      log("Error al refrescar BL2: " + state.lastError,"error");
      throw error;
    }).finally(function(){
      state.refreshPromise = null;
    });

    return state.refreshPromise;
  }

  function scheduleRefresh(reason,delay){
    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(function(){
      refresh({ force:false,reason:reason || "event" }).catch(function(){});
    },Math.max(80,Number(delay || 180)));
  }

  function setPeriod(periodoId,periodoLabel){
    periodoId = text(periodoId);

    if(!periodoId){
      notify("Seleccione un período válido.","warning");
      return Promise.resolve(null);
    }

    var currentCore = core();

    if(!currentCore || typeof currentCore.setActivePeriod !== "function"){
      return Promise.reject(new Error("No se puede cambiar el período."));
    }

    setButtonsDisabled(true);
    setDbPill("warn","Cambiando período");

    return timeout(function(){
      return currentCore.setActivePeriod(periodoId,periodoLabel || periodoId);
    },REFRESH_TIMEOUT_MS,"El cambio de período").then(function(period){
      state.activePeriod = period;
      log("Período activo: " + (period.label || period.id),"ok");

      try{
        window.dispatchEvent(new CustomEvent("bl2:period-changed",{ detail:{ period:period } }));
      }catch(error){}

      return refresh({ force:true,reason:"period-changed" }).then(function(){ return period; });
    }).finally(function(){
      setButtonsDisabled(false);
    });
  }

  function notify(message,type){
    if(window.BDLocalConfigUI && typeof window.BDLocalConfigUI.notify === "function"){
      window.BDLocalConfigUI.notify(message,type || "info");
    }else{
      window.alert(message);
    }
  }

  function handlePeriodSave(){
    var period = selectedPeriod();
    if(!period.id){ notify("Seleccione un período.","warning"); return; }
    setPeriod(period.id,period.label).catch(function(error){ notify(error.message,"error"); });
  }

  function handleTest(){
    var currentTest = test();

    if(!currentTest || typeof currentTest.run !== "function"){
      notify("BL2Test no está disponible.","warning");
      return;
    }

    setButtonsDisabled(true);
    log("Ejecutando prueba BL2 de solo lectura...","info");

    timeout(function(){ return currentTest.run({ log:true }); },30000,"La prueba BL2")
      .then(function(report){
        var ok = report && report.ok;

        notify(
          ok ? "Prueba BL2 correcta." : "La prueba detectó controles pendientes. Revise Diagnóstico y salud.",
          ok ? "success" : "error"
        );

        log(ok ? "Prueba BL2 correcta." : "Prueba BL2 con errores.",ok ? "ok" : "error");
        return refresh({ force:true,reason:"test" });
      })
      .catch(function(error){
        notify("Error en prueba BL2: " + error.message,"error");
        log("Error en prueba BL2: " + error.message,"error");
      })
      .finally(function(){
        setButtonsDisabled(false);
      });
  }

  function handleExport(){
    var currentBackup = backup();
    var period = selectedPeriod();

    if(!currentBackup || typeof currentBackup.exportManual !== "function"){
      notify("El módulo de respaldo no está disponible.","warning");
      return;
    }

    var all = window.confirm("Aceptar: respaldar toda la base.\nCancelar: respaldar solo el período activo.");

    if(!all && !period.id){
      notify("Seleccione un período para crear el respaldo.","warning");
      return;
    }

    setButtonsDisabled(true);

    timeout(function(){
      return currentBackup.exportManual({
        scope:all ? "all" : "period",
        periodoId:all ? "" : period.id,
        periodoLabel:all ? "" : period.label
      });
    },30000,"La exportación del respaldo").then(function(result){
      notify("Respaldo exportado correctamente.","success");
      log("Respaldo exportado: " + (result.fileName || "archivo JSON"),"ok");
    }).catch(function(error){
      notify("No se pudo exportar: " + error.message,"error");
      log("Error exportando respaldo: " + error.message,"error");
    }).finally(function(){
      setButtonsDisabled(false);
    });
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

    if(percent >= 100 || percent <= 0){
      state.syncBarTimer = window.setTimeout(function(){ bar.hidden = true; },2500);
    }
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

    if(refreshButton){
      refreshButton.addEventListener("click",function(){
        setButtonsDisabled(true);

        refresh({ force:true,reason:"manual" })
          .catch(function(error){ notify("No se pudo actualizar: " + error.message,"error"); })
          .finally(function(){ setButtonsDisabled(false); });
      });
    }

    if(testButton){ testButton.addEventListener("click",handleTest); }
    if(exportButton){ exportButton.addEventListener("click",handleExport); }
    if(search){ search.addEventListener("input",renderPeriods); }

    window.addEventListener("bl2:sync-progress",function(event){
      showSyncBar(event.detail || {});
    });

    window.addEventListener("bl2:students-saved",function(event){
      state.lastImportSummary = event.detail || null;
      renderImportSummary(state.lastImportSummary);
      scheduleRefresh("students-saved",220);
    });

    window.addEventListener("bl2:student-updated",function(){
      scheduleRefresh("student-updated",220);
    });

    window.addEventListener("bdlocal:sync-v2-finished",function(){
      scheduleRefresh("sync-finished",300);
    });

    window.addEventListener("bl2:external-pull-finished",function(event){
      var detail = event && event.detail || {};
      state.lastImportSummary = detail.summary || detail;
      renderImportSummary(state.lastImportSummary);
      scheduleRefresh("external-pull-finished",300);
    });
  }

  function initCenter(){
    var root = byId("bdlocal-control-center-root") || byId("bdlocal-config-root");

    if(window.BDLocalConfigUI && typeof window.BDLocalConfigUI.init === "function" && root){
      return window.BDLocalConfigUI.init({ container:root,nonBlocking:true });
    }

    return Promise.resolve(null);
  }

  function startSecondaryModules(){
    background("Interfaz central",initCenter,SECONDARY_TIMEOUT_MS);

    if(window.BDLSyncUIBridge && typeof window.BDLSyncUIBridge.bind === "function"){
      background("Puente de sincronización",function(){
        return window.BDLSyncUIBridge.bind({ lazyQueue:true });
      },SECONDARY_TIMEOUT_MS);
    }

    if(window.BL2CloudPullSafe && typeof window.BL2CloudPullSafe.bind === "function"){
      try{ window.BL2CloudPullSafe.bind(); }
      catch(error){ log("Descarga segura: " + error.message,"warn"); }
    }

    var currentBackup = backup();

    if(currentBackup && typeof currentBackup.dailyIfNeeded === "function"){
      background("Respaldo diario",function(){
        return currentBackup.dailyIfNeeded({ scope:"all" });
      },15000);
    }
  }

  function boot(){
    if(state.ready){ return Promise.resolve(state); }
    if(state.bootPromise){ return state.bootPromise; }

    state.booting = true;
    setupEvents();
    setText("bl2-runtime-pill",isElectron() ? "Electron" : "Navegador");
    setDbPill("warn","Inicializando");
    setButtonsDisabled(true);

    var currentCore = core();
    var currentDb = db();

    if(!currentCore || !currentDb){
      state.booting = false;
      setButtonsDisabled(false);
      setDbPill("bad","Faltan módulos");
      return Promise.reject(new Error("Faltan BL2Core o BL2DB."));
    }

    state.bootPromise = timeout(function(){
      return currentCore.init();
    },CORE_TIMEOUT_MS,"La apertura de Base Local").then(function(){
      state.ready = true;
      state.lastReadyAt = now();
      setDbPill("ok","BL2 listo");
      setButtonsDisabled(false);

      try{
        window.dispatchEvent(new CustomEvent("bl2:core-ready",{
          detail:{ ok:true,version:VERSION,at:state.lastReadyAt }
        }));
      }catch(error){}

      startSecondaryModules();

      return refresh({ force:true,skipSecondary:true,reason:"boot" }).catch(function(error){
        log("BDLocal abrió, pero el resumen inicial quedó parcial: " + error.message,"warn");
        return {};
      });
    }).then(function(result){
      setDbPill("ok","BL2 activo");
      log("BL2 inicializado. Las tareas secundarias continuarán sin bloquear la pantalla.","ok");
      runSecondaryRefresh("boot");

      try{
        window.dispatchEvent(new CustomEvent("bl2:ready",{
          detail:{ ok:true,activePeriod:state.activePeriod,version:VERSION }
        }));
      }catch(error){}

      return result;
    }).catch(function(error){
      state.ready = false;
      state.lastError = error && error.message ? error.message : String(error);
      setDbPill("bad","Error BL2");
      log("No se pudo iniciar BL2: " + state.lastError,"error");
      notify("No se pudo iniciar Base Local: " + state.lastError,"error");
      throw error;
    }).finally(function(){
      state.booting = false;
      state.bootPromise = null;
      setButtonsDisabled(false);
    });

    return state.bootPromise;
  }

  function runTarget(target){
    if(window.BDLSyncUIBridge && typeof window.BDLSyncUIBridge.runTarget === "function"){
      return window.BDLSyncUIBridge.runTarget(target,{ confirm:true,limit:25 });
    }

    return Promise.reject(new Error("El puente de sincronización no está disponible."));
  }

  window.BL2App = {
    version:VERSION,
    boot:boot,
    refresh:refresh,
    scheduleRefresh:scheduleRefresh,
    setPeriod:setPeriod,
    handleGoogleSync:function(){ return runTarget("google"); },
    handleFirebaseSync:function(){ return runTarget("firebase"); },
    getSelectedPeriod:selectedPeriod,
    getState:function(){
      return {
        ready:state.ready,
        booting:state.booting,
        scriptsReady:state.scriptsReady,
        activePeriod:state.activePeriod,
        periods:state.periods.slice(),
        lastImportSummary:state.lastImportSummary,
        lastError:state.lastError,
        lastReadyAt:state.lastReadyAt,
        version:VERSION
      };
    }
  };

  function bootAfterScripts(){
    state.scriptsReady = true;
    boot().catch(function(){});
  }

  window.addEventListener("bdlocal:bl2-html-scripts-loaded",bootAfterScripts,{ once:true });

  var managedLoader = !!document.querySelector("script[data-bl2-loader-src]");

  if(!managedLoader){
    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded",bootAfterScripts,{ once:true });
    }else{
      bootAfterScripts();
    }
  }
})(window,document);
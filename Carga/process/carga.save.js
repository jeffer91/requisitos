/* =========================================================
Nombre completo: carga.save.js
Ruta o ubicación: /Requisitos/Carga/process/carga.save.js
Función o funciones:
- Guardar la carga validada en BDLocal/BL2.
- Esperar/cargar el adaptador BDLocal cuando Carga se abre sola o dentro de Maqueta.
- Usar período canónico obligatorio.
- Enviar datos a tablas inteligentes de BL2.
- Mantener compatibilidad con ConCarga, BDLocalCarga, BL2Core, BDLocal y BDLRepoEstudiantes.
- Crear eventos para respaldo y sincronización inteligente.
Con qué se conecta:
- carga.app.js
- carga.validator.js
- ../../BDLocal/adapters/bdl.screen-deps.js
- BDLocal/conexiones/con.carga.js
- BDLocal/bl2.core.js
========================================================= */
(function(window, document){
  "use strict";

  var ADAPTER_PATH = "../../BDLocal/adapters/bdl.screen-deps.js";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function emit(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail:detail || {} })); }catch(error){}
  }

  function windowValue(ctx, name){
    try{ return ctx && ctx[name] ? ctx[name] : null; }
    catch(error){ return null; }
  }

  function parentValue(name){
    try{ if(window.parent && window.parent !== window){ return windowValue(window.parent, name); } }catch(error){}
    return null;
  }

  function topValue(name){
    try{ if(window.top && window.top !== window){ return windowValue(window.top, name); } }catch(error){}
    return null;
  }

  function openerValue(name){
    try{ if(window.opener && window.opener !== window){ return windowValue(window.opener, name); } }catch(error){}
    return null;
  }

  function api(name){
    return windowValue(window, name) || parentValue(name) || topValue(name) || openerValue(name) || null;
  }

  function resolveFromThisScript(relative){
    var base = document.currentScript && document.currentScript.src ? document.currentScript.src : window.location.href;
    try{ return new URL(relative, base).href; }
    catch(error){ return relative; }
  }

  function scriptLoaded(src){
    return Array.prototype.slice.call(document.scripts || []).some(function(script){
      return script.src === src || script.getAttribute("data-carga-save-src") === src;
    });
  }

  function loadScript(relative){
    var src = resolveFromThisScript(relative);
    if(scriptLoaded(src)){ return Promise.resolve(src); }

    return new Promise(function(resolve, reject){
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.defer = false;
      script.setAttribute("data-carga-save-src", src);
      script.onload = function(){ resolve(src); };
      script.onerror = function(){ reject(new Error("No se pudo cargar " + src)); };
      document.head.appendChild(script);
    });
  }

  function hasAnySaveEngine(){
    var conCarga = api("ConCarga") || api("BDLocalCarga");
    var core = api("BL2Core");
    var bd = api("BDLocal");
    var repo = api("BDLRepoEstudiantes");

    return !!(
      (conCarga && (typeof conCarga.saveStudents === "function" || typeof conCarga.guardarEstudiantes === "function")) ||
      (core && typeof core.saveStudents === "function") ||
      (bd && (typeof bd.guardarEstudiantes === "function" || typeof bd.saveStudents === "function")) ||
      (repo && typeof repo.guardarMuchos === "function")
    );
  }

  function ensureScreenDepsReady(){
    if(hasAnySaveEngine()){
      return Promise.resolve(true);
    }

    var deps = api("BDLocalScreenDeps");
    if(deps && typeof deps.ready === "function"){
      return deps.ready().then(function(){ return true; }).catch(function(){ return true; });
    }

    if(window.BDLScreenDepsReady && typeof window.BDLScreenDepsReady.then === "function"){
      return window.BDLScreenDepsReady.then(function(){ return true; }).catch(function(){ return true; });
    }

    return loadScript(ADAPTER_PATH).then(function(){
      var loadedDeps = api("BDLocalScreenDeps");
      if(loadedDeps && typeof loadedDeps.ready === "function"){
        return loadedDeps.ready().then(function(){ return true; }).catch(function(){ return true; });
      }
      return true;
    }).catch(function(error){
      console.warn("[CargaSave] No se pudo cargar adaptador BDLocal. Se intentará con motores ya disponibles.", error);
      return true;
    });
  }

  function normalizeUnderscorePeriod(value){
    value = text(value);
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    if(match){ return match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]; }
    return value.replace(/_+/g, "__");
  }

  function localPeriod(){
    var id = "";
    var label = "";

    try{
      id = text(localStorage.getItem("carga.periodoSeleccionado"));
      label = text(localStorage.getItem("carga.periodoSeleccionadoLabel"));
    }catch(error){}

    id = normalizeUnderscorePeriod(id);

    return {
      periodoId:id,
      periodoLabel:label || id,
      periodoCanonicoId:id,
      periodoCanonicoLabel:label || id,
      valid:!!id
    };
  }

  function selectedPeriod(normalized, options){
    normalized = normalized || {};
    options = options || {};

    var detected = normalized.periodoDetectado || {};
    var local = localPeriod();

    var id = text(
      options.periodoCanonicoId ||
      options.periodoId ||
      detected.periodoCanonicoId ||
      detected.periodoId ||
      detected.id ||
      detected.value ||
      local.periodoId
    );

    id = normalizeUnderscorePeriod(id);

    var label = text(
      options.periodoCanonicoLabel ||
      options.periodoLabel ||
      detected.periodoCanonicoLabel ||
      detected.periodoLabel ||
      detected.label ||
      detected.nombre ||
      local.periodoLabel ||
      id
    );

    return {
      periodoId:id,
      periodoLabel:label || id,
      periodoCanonicoId:id,
      periodoCanonicoLabel:label || id,
      id:id,
      label:label || id,
      valid:!!id && id !== "SIN_PERIODO"
    };
  }

  function periodValid(periodo){
    return !!(periodo && periodo.periodoId && periodo.periodoId !== "SIN_PERIODO");
  }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "");
    if(/^\d{9}$/.test(raw)){ return "0" + raw; }
    return raw;
  }

  function firstValue(row, names){
    row = row || {};
    names = Array.isArray(names) ? names : [];
    var keys = Object.keys(row);
    var wanted = names.map(function(name){
      return text(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    });

    for(var i = 0; i < keys.length; i += 1){
      var key = text(keys[i]).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if(wanted.indexOf(key) >= 0){ return row[keys[i]]; }
    }
    return "";
  }

  function injectPeriod(row, periodo){
    row = Object.assign({}, row || {});

    var cedula = normalizeCedula(firstValue(row, [
      "numeroIdentificacion",
      "NumeroIdentificacion",
      "cedula",
      "Cédula",
      "Cedula",
      "identificacion",
      "documento"
    ]));

    row.cedula = cedula;
    row.numeroIdentificacion = row.numeroIdentificacion || cedula;
    row.periodoId = periodo.periodoId;
    row.periodoLabel = periodo.periodoLabel;
    row.periodoCanonicoId = periodo.periodoCanonicoId || periodo.periodoId;
    row.periodoCanonicoLabel = periodo.periodoCanonicoLabel || periodo.periodoLabel;
    row.ultimoPeriodoId = periodo.periodoId;
    row.estadoMatricula = text(row.estadoMatricula || row.EstadoMatricula || "ACTIVO").toUpperCase() || "ACTIVO";
    row.PeriodoId = row.periodoId;
    row.periodId = row.periodoId;
    row.Periodo = row.periodoLabel;
    row.PeriodoLabel = row.periodoLabel;
    row._periodoSeleccionado = row.periodoId;
    row._periodoSeleccionadoLabel = row.periodoLabel;

    return row;
  }

  function rowsFromNormalized(normalized){
    normalized = normalized || {};
    if(Array.isArray(normalized.rowsMapeadas)){ return normalized.rowsMapeadas; }
    if(Array.isArray(normalized.rows)){ return normalized.rows; }
    if(Array.isArray(normalized.students)){ return normalized.students; }
    return [];
  }

  function ensureBL2Ready(core){
    if(!core){ return Promise.resolve(null); }

    if(typeof core.getState === "function"){
      try{
        var st = core.getState() || {};
        if(st.initialized){ return Promise.resolve(core); }
      }catch(error){}
    }

    if(typeof core.init === "function"){
      return core.init().catch(function(error){
        console.warn("[CargaSave] BL2Core.init no pudo ejecutarse o ya estaba abierto", error);
        return null;
      }).then(function(){ return core; });
    }

    return Promise.resolve(core);
  }

  function normalizeResult(result, periodoInfo, preparedRows){
    result = result || {};
    preparedRows = Array.isArray(preparedRows) ? preparedRows : [];

    var warnings = result.warnings || result.advertencias || [];
    var errors = result.errors || result.errores || [];

    if(typeof warnings === "number"){ warnings = new Array(warnings).fill("Advertencia"); }
    if(typeof errors === "number"){ errors = new Array(errors).fill("Error"); }

    return Object.assign({}, result, {
      ok:result.ok !== false,
      periodoId:result.periodoId || periodoInfo.periodoId,
      periodoLabel:result.periodoLabel || periodoInfo.periodoLabel,
      total:result.total || result.totalEntrada || preparedRows.length,
      totalEntrada:result.totalEntrada || result.total || preparedRows.length,
      saved:result.saved || result.guardados || result.nuevos || 0,
      updated:result.updated || result.actualizados || 0,
      merged:result.merged || result.duplicados || result.duplicadosCorregidos || 0,
      guardados:result.guardados || result.saved || result.nuevos || 0,
      actualizados:result.actualizados || result.updated || 0,
      duplicados:result.duplicados || result.merged || 0,
      warnings:warnings,
      errors:errors,
      advertencias:warnings,
      errores:errors,
      changes:result.changes || result.cambios || []
    });
  }

  function enqueueSyncHint(result, periodoInfo){
    result = result || {};
    var changes = result.changes || result.cambios || [];
    var totalChanges = Array.isArray(changes) ? changes.length : Number(changes || 0);

    emit("bdlocal:changes-created", {
      source:"CargaSave",
      periodoId:periodoInfo.periodoId,
      periodoLabel:periodoInfo.periodoLabel,
      total:totalChanges,
      changes:Array.isArray(changes) ? changes : [],
      at:new Date().toISOString()
    });

    emit("bdlocal:sync-requested", {
      source:"CargaSave",
      reason:"carga_guardada",
      pending:totalChanges,
      lowCost:true,
      idleOnly:true,
      batchSize:50,
      at:new Date().toISOString()
    });
  }

  function callConCarga(preparedRows, periodoInfo, normalized, options){
    var con = api("ConCarga") || api("BDLocalCarga") || (api("BDLocalConexiones") && api("BDLocalConexiones").get && api("BDLocalConexiones").get("carga"));
    if(!con){ return Promise.resolve(null); }

    if(typeof con.guardarEstudiantes === "function"){
      return con.guardarEstudiantes(preparedRows, periodoInfo, options || {});
    }

    if(typeof con.saveStudents === "function"){
      return con.saveStudents(preparedRows, Object.assign({}, options || {}, periodoInfo));
    }

    return Promise.resolve(null);
  }

  function callBL2(preparedRows, periodoInfo, normalized, options){
    var core = api("BL2Core");
    if(!core || typeof core.saveStudents !== "function"){ return Promise.resolve(null); }

    return ensureBL2Ready(core).then(function(){
      return core.saveStudents(preparedRows, {
        normalized:true,
        periodoId:periodoInfo.periodoId,
        periodoLabel:periodoInfo.periodoLabel,
        periodoCanonicoId:periodoInfo.periodoCanonicoId,
        periodoCanonicoLabel:periodoInfo.periodoCanonicoLabel,
        source:options.source || "carga_excel",
        fileName:normalized.fileName || options.fileName || "",
        origen:normalized.origen || options.origen || "",
        importResult:{
          periodoId:periodoInfo.periodoId,
          periodoLabel:periodoInfo.periodoLabel,
          duplicados:normalized.duplicados || 0,
          advertencias:normalized.advertencias || [],
          errores:normalized.errores || []
        },
        sync:options.sync !== false,
        markRetired:options.markRetired !== false
      });
    });
  }

  function callBDLocal(preparedRows, periodoInfo, normalized, options){
    var bd = api("BDLocal");
    if(!bd){ return Promise.resolve(null); }

    if(typeof bd.guardarEstudiantes === "function"){
      return bd.guardarEstudiantes(preparedRows, periodoInfo, options || {});
    }

    if(typeof bd.saveStudents === "function"){
      return bd.saveStudents(preparedRows, Object.assign({}, options || {}, periodoInfo));
    }

    return Promise.resolve(null);
  }

  function callLegacyRepo(preparedRows, periodoInfo, normalized, options){
    var repo = api("BDLRepoEstudiantes");
    if(!repo || typeof repo.guardarMuchos !== "function"){ return Promise.resolve(null); }

    return repo.guardarMuchos(preparedRows, periodoInfo, {
      source:options.source || "carga_excel",
      fileName:normalized.fileName || options.fileName || "",
      origen:normalized.origen || options.origen || "",
      sync:options.sync !== false
    });
  }

  function updateAuxiliaryRepos(preparedRows, periodoInfo){
    var tasks = [];
    var carreras = api("BDLRepoCarreras");
    var requisitos = api("BDLRepoRequisitos");
    var dashboard = api("BDLRepoDashboard");

    if(carreras && typeof carreras.guardarDesdeEstudiantes === "function"){
      tasks.push(carreras.guardarDesdeEstudiantes(preparedRows).catch(function(error){
        console.warn("[CargaSave] No se pudo actualizar carreras", error);
        return null;
      }));
    }

    if(requisitos && typeof requisitos.guardarCatalogo === "function"){
      tasks.push(requisitos.guardarCatalogo().catch(function(error){
        console.warn("[CargaSave] No se pudo actualizar catálogo de requisitos", error);
        return null;
      }));
    }

    if(dashboard && typeof dashboard.recalcularBasico === "function"){
      tasks.push(dashboard.recalcularBasico(periodoInfo.periodoId).catch(function(error){
        console.warn("[CargaSave] No se pudo recalcular dashboard", error);
        return null;
      }));
    }

    return Promise.all(tasks);
  }

  function autoBackup(periodoInfo){
    var backup = api("BL2Backup");

    if(backup && typeof backup.autoAfterExcel === "function"){
      return backup.autoAfterExcel(periodoInfo.periodoId).catch(function(error){
        console.warn("[CargaSave] No se pudo crear respaldo automático", error);
        return null;
      });
    }

    if(backup && typeof backup.dailyIfNeeded === "function"){
      return backup.dailyIfNeeded({ scope:"period", periodoId:periodoInfo.periodoId, periodoLabel:periodoInfo.periodoLabel }).catch(function(error){
        console.warn("[CargaSave] No se pudo crear respaldo diario", error);
        return null;
      });
    }

    return Promise.resolve(null);
  }

  function trySaveWith(label, fn){
    return fn().catch(function(error){
      console.warn("[CargaSave] " + label + " no pudo guardar. Intentando siguiente motor.", error);
      return null;
    });
  }

  function save(normalized, validation, options){
    options = options || {};
    normalized = normalized || {};
    validation = validation || {};

    var rows = rowsFromNormalized(normalized);
    var periodoInfo = selectedPeriod(normalized, options);

    if(validation.ok === false && options.allowErrors !== true){
      return Promise.resolve({
        ok:false,
        saved:0,
        updated:0,
        merged:0,
        total:normalized.total || rows.length || 0,
        errors:validation.errors || [],
        warnings:validation.warnings || [],
        message:"La carga tiene errores y no fue guardada."
      });
    }

    if(!periodValid(periodoInfo)){
      return Promise.resolve({
        ok:false,
        saved:0,
        updated:0,
        merged:0,
        total:normalized.total || rows.length || 0,
        errors:[{ message:"No se puede guardar: primero selecciona un período." }],
        warnings:validation.warnings || [],
        message:"No se puede guardar: primero selecciona un período."
      });
    }

    var preparedRows = rows.map(function(row){ return injectPeriod(row, periodoInfo); });

    emit("bdlocal:carga-save-start", {
      total:preparedRows.length,
      periodoId:periodoInfo.periodoId,
      periodoLabel:periodoInfo.periodoLabel,
      at:new Date().toISOString()
    });

    return ensureScreenDepsReady().then(function(){
      return trySaveWith("ConCarga", function(){
        return callConCarga(preparedRows, periodoInfo, normalized, options);
      });
    }).then(function(result){
      if(result){ return result; }
      return trySaveWith("BL2Core", function(){
        return callBL2(preparedRows, periodoInfo, normalized, options);
      });
    }).then(function(result){
      if(result){ return result; }
      return trySaveWith("BDLocal", function(){
        return callBDLocal(preparedRows, periodoInfo, normalized, options);
      });
    }).then(function(result){
      if(result){ return result; }
      return trySaveWith("BDLRepoEstudiantes", function(){
        return callLegacyRepo(preparedRows, periodoInfo, normalized, options);
      });
    }).then(function(result){
      if(!result){
        throw new Error("No hay motor de guardado disponible. Falta ConCarga, BL2Core, BDLocal o BDLRepoEstudiantes.");
      }
      return result;
    }).then(function(result){
      var finalResult = normalizeResult(result, periodoInfo, preparedRows);
      return updateAuxiliaryRepos(preparedRows, periodoInfo).then(function(){
        return autoBackup(periodoInfo);
      }).then(function(){
        enqueueSyncHint(finalResult, periodoInfo);

        var hub = api("BDLocalConexiones");
        if(hub && typeof hub.refreshCache === "function"){
          hub.refreshCache({ source:"CargaSave.save" }).catch(function(){ return null; });
        }

        emit("bdlocal:carga-save-finish", {
          ok:finalResult.ok,
          total:finalResult.total,
          saved:finalResult.saved,
          updated:finalResult.updated,
          merged:finalResult.merged,
          warnings:Array.isArray(finalResult.warnings) ? finalResult.warnings.length : 0,
          errors:Array.isArray(finalResult.errors) ? finalResult.errors.length : 0,
          periodoId:periodoInfo.periodoId,
          periodoLabel:periodoInfo.periodoLabel,
          at:new Date().toISOString()
        });

        return finalResult;
      });
    }).catch(function(error){
      emit("bdlocal:carga-save-error", {
        ok:false,
        error:error && error.message ? error.message : String(error),
        periodoId:periodoInfo.periodoId,
        periodoLabel:periodoInfo.periodoLabel,
        at:new Date().toISOString()
      });
      throw error;
    });
  }

  window.CargaSave = {
    save:save,
    helpers:{
      selectedPeriod:selectedPeriod,
      injectPeriod:injectPeriod,
      normalizeCedula:normalizeCedula,
      normalizeUnderscorePeriod:normalizeUnderscorePeriod,
      ensureScreenDepsReady:ensureScreenDepsReady
    }
  };
})(window, document);

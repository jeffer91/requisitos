/* =========================================================
Nombre completo: carga.save.js
Ruta o ubicación: /Requisitos/Carga/process/carga.save.js
Función o funciones:
- Guardar únicamente archivos previamente analizados y aprobados.
- Exigir que la diferencia de cédulas no supere el 10%.
- Impedir dos guardados simultáneos.
- Seleccionar un solo motor antes de comenzar la escritura.
- No cambiar de motor si ocurre un error durante el guardado.
- Guardar únicamente en BDLocal y dejar las nubes pendientes.
- Actualizar repositorios auxiliares y crear respaldo local.
Con qué se conecta:
- carga.app.js
- carga.validator.js
- ../../BDLocal/adapters/bdl.screen-deps.js
- ConCarga / BDLocalCarga
- BL2Core
- BDLocal
- BDLRepoEstudiantes
========================================================= */
(function(window, document){
  "use strict";

  var ADAPTER_PATH =
    "../../BDLocal/adapters/bdl.screen-deps.js";

  var activeSave = null;

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function clone(value){
    if(value === undefined){
      return undefined;
    }

    try{
      return JSON.parse(JSON.stringify(value));
    }catch(error){
      return value;
    }
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(
        new CustomEvent(name, {
          detail:detail || {}
        })
      );
    }catch(error){}
  }

  function windowValue(context, name){
    try{
      return context && context[name]
        ? context[name]
        : null;
    }catch(error){
      return null;
    }
  }

  function api(name){
    var current = windowValue(window, name);

    if(current){
      return current;
    }

    try{
      if(window.parent && window.parent !== window){
        current = windowValue(window.parent, name);
      }
    }catch(error){}

    if(current){
      return current;
    }

    try{
      if(window.top && window.top !== window){
        current = windowValue(window.top, name);
      }
    }catch(error2){}

    if(current){
      return current;
    }

    try{
      if(window.opener && window.opener !== window){
        current = windowValue(window.opener, name);
      }
    }catch(error3){}

    return current || null;
  }

  function canonicalPeriodId(value){
    value = text(value);

    var match = value.match(
      /^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/
    );

    return match
      ? match[1] + "-" + match[2] + "__" +
        match[3] + "-" + match[4]
      : value.replace(/_+/g, "__");
  }

  function resolveFromScript(relative){
    var base =
      document.currentScript &&
      document.currentScript.src
        ? document.currentScript.src
        : window.location.href;

    try{
      return new URL(relative, base).href;
    }catch(error){
      return relative;
    }
  }

  function scriptLoaded(source){
    return Array.prototype
      .slice.call(document.scripts || [])
      .some(function(script){
        return (
          script.src === source ||
          script.getAttribute("data-carga-save-src") === source
        );
      });
  }

  function loadScript(relative){
    var source = resolveFromScript(relative);

    if(scriptLoaded(source)){
      return Promise.resolve(source);
    }

    return new Promise(function(resolve, reject){
      var script = document.createElement("script");

      script.src = source;
      script.async = false;
      script.defer = false;

      script.setAttribute(
        "data-carga-save-src",
        source
      );

      script.onload = function(){
        resolve(source);
      };

      script.onerror = function(){
        reject(
          new Error(
            "No se pudo cargar " + source
          )
        );
      };

      document.head.appendChild(script);
    });
  }

  function hasSaveEngine(){
    var connection =
      api("ConCarga") ||
      api("BDLocalCarga");

    var core = api("BL2Core");
    var database = api("BDLocal");
    var repository = api("BDLRepoEstudiantes");

    return !!(
      (
        connection &&
        (
          typeof connection.guardarEstudiantes === "function" ||
          typeof connection.saveStudents === "function"
        )
      ) ||
      (
        core &&
        typeof core.saveStudents === "function"
      ) ||
      (
        database &&
        (
          typeof database.guardarEstudiantes === "function" ||
          typeof database.saveStudents === "function"
        )
      ) ||
      (
        repository &&
        typeof repository.guardarMuchos === "function"
      )
    );
  }

  function ensureDependencies(){
    if(hasSaveEngine()){
      return Promise.resolve(true);
    }

    var dependencies = api("BDLocalScreenDeps");

    if(
      dependencies &&
      typeof dependencies.ready === "function"
    ){
      return dependencies.ready().then(function(){
        return true;
      });
    }

    if(
      window.BDLScreenDepsReady &&
      typeof window.BDLScreenDepsReady.then === "function"
    ){
      return window.BDLScreenDepsReady.then(function(){
        return true;
      });
    }

    return loadScript(ADAPTER_PATH)
      .then(function(){
        var loaded = api("BDLocalScreenDeps");

        if(
          loaded &&
          typeof loaded.ready === "function"
        ){
          return loaded.ready();
        }

        return true;
      });
  }

  function localPeriod(){
    var id = "";
    var label = "";

    try{
      id = localStorage.getItem(
        "carga.periodoSeleccionado"
      ) || "";

      label = localStorage.getItem(
        "carga.periodoSeleccionadoLabel"
      ) || "";
    }catch(error){}

    id = canonicalPeriodId(id);

    return {
      periodoId:id,
      periodoLabel:label || id,
      periodoCanonicoId:id,
      periodoCanonicoLabel:label || id,
      valid:!!id && id !== "SIN_PERIODO"
    };
  }

  function selectedPeriod(normalized, options){
    normalized = normalized || {};
    options = options || {};

    var detected =
      normalized.periodoDetectado || {};

    var local = localPeriod();

    var id = canonicalPeriodId(
      options.periodoCanonicoId ||
      options.periodoId ||
      detected.periodoCanonicoId ||
      detected.periodoId ||
      detected.id ||
      local.periodoId ||
      ""
    );

    var label = text(
      options.periodoCanonicoLabel ||
      options.periodoLabel ||
      detected.periodoCanonicoLabel ||
      detected.periodoLabel ||
      detected.label ||
      local.periodoLabel ||
      id
    );

    return {
      id:id,
      label:label || id,
      periodoId:id,
      periodoLabel:label || id,
      periodoCanonicoId:id,
      periodoCanonicoLabel:label || id,
      valid:!!id && id !== "SIN_PERIODO"
    };
  }

  function normalizeCedula(value){
    var result = text(value)
      .replace(/[^0-9A-Za-z]/g, "")
      .toUpperCase();

    if(/^\d{9}$/.test(result)){
      result = "0" + result;
    }

    return result;
  }

  function firstValue(row, fields){
    row = row || {};

    var normalize = function(value){
      return text(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    };

    var wanted = fields.map(normalize);
    var keys = Object.keys(row);

    for(var i = 0; i < keys.length; i += 1){
      if(wanted.indexOf(normalize(keys[i])) >= 0){
        return row[keys[i]];
      }
    }

    return "";
  }

  function injectPeriod(row, period){
    row = Object.assign({}, row || {});

    var cedula = normalizeCedula(
      firstValue(
        row,
        [
          "numeroIdentificacion",
          "NumeroIdentificacion",
          "identificacion",
          "cedula",
          "cédula",
          "documento"
        ]
      )
    );

    row.numeroIdentificacion = cedula;
    row.cedula = cedula;

    row.periodoId = period.periodoId;
    row.periodoLabel = period.periodoLabel;
    row.periodoCanonicoId = period.periodoId;
    row.periodoCanonicoLabel = period.periodoLabel;
    row.ultimoPeriodoId = period.periodoId;

    row.PeriodoId = period.periodoId;
    row.periodId = period.periodoId;
    row.Periodo = period.periodoLabel;
    row.PeriodoLabel = period.periodoLabel;

    row._periodoSeleccionado = period.periodoId;
    row._periodoSeleccionadoLabel =
      period.periodoLabel;

    row.estadoMatricula = text(
      row.estadoMatricula ||
      row.EstadoMatricula ||
      "ACTIVO"
    ).toUpperCase() || "ACTIVO";

    return row;
  }

  function rowsFromNormalized(normalized){
    normalized = normalized || {};

    if(Array.isArray(normalized.rowsMapeadas)){
      return normalized.rowsMapeadas;
    }

    if(Array.isArray(normalized.rows)){
      return normalized.rows;
    }

    if(Array.isArray(normalized.students)){
      return normalized.students;
    }

    return [];
  }

  function validateAnalysis(analysis, period){
    var limit = Number(
      (
        window.CargaConfig &&
        window.CargaConfig.maxPeriodDifferencePercent
      ) ||
      10
    );

    if(!analysis || analysis.ok !== true){
      throw new Error(
        "El archivo debe analizarse y aprobarse antes de guardar."
      );
    }

    if(
      canonicalPeriodId(analysis.periodoId) !==
      canonicalPeriodId(period.periodoId)
    ){
      throw new Error(
        "El período cambió después del análisis. " +
        "Analiza el archivo nuevamente."
      );
    }

    if(
      !analysis.firstLoad &&
      Number(analysis.percent || 0) > limit
    ){
      throw new Error(
        "La diferencia de cédulas supera el límite del " +
        limit +
        "%."
      );
    }

    return true;
  }

  function localOptions(options){
    options = options || {};

    return Object.assign({}, options, {
      sync:false,
      localOnly:true,
      cloudSync:false,
      manualCloudSync:true,

      batchSize:Number(
        options.batchSize ||
        (
          window.CargaConfig &&
          window.CargaConfig.defaultBatchSize
        ) ||
        250
      )
    });
  }

  function ensureCoreReady(core){
    if(!core){
      return Promise.resolve(null);
    }

    if(typeof core.getState === "function"){
      try{
        var current = core.getState() || {};

        if(current.initialized){
          return Promise.resolve(core);
        }
      }catch(error){}
    }

    if(typeof core.init === "function"){
      return core.init().then(function(){
        return core;
      });
    }

    return Promise.resolve(core);
  }

  function selectEngine(){
    var connection =
      api("ConCarga") ||
      api("BDLocalCarga");

    var core = api("BL2Core");
    var database = api("BDLocal");
    var repository = api("BDLRepoEstudiantes");

    if(
      connection &&
      typeof connection.guardarEstudiantes === "function"
    ){
      return {
        name:"ConCarga.guardarEstudiantes",

        save:function(rows, period, normalized, options){
          return connection.guardarEstudiantes(
            rows,
            period,
            localOptions(options)
          );
        }
      };
    }

    if(
      connection &&
      typeof connection.saveStudents === "function"
    ){
      return {
        name:"ConCarga.saveStudents",

        save:function(rows, period, normalized, options){
          return connection.saveStudents(
            rows,
            Object.assign(
              {},
              localOptions(options),
              period
            )
          );
        }
      };
    }

    if(
      core &&
      typeof core.saveStudents === "function"
    ){
      return {
        name:"BL2Core.saveStudents",

        save:function(rows, period, normalized, options){
          return ensureCoreReady(core).then(function(){
            return core.saveStudents(
              rows,
              Object.assign(
                {},
                localOptions(options),
                {
                  normalized:true,
                  periodoId:period.periodoId,
                  periodoLabel:period.periodoLabel,
                  periodoCanonicoId:period.periodoId,
                  periodoCanonicoLabel:period.periodoLabel,
                  source:options.source || "carga_excel",
                  fileName:normalized.fileName || "",
                  origen:normalized.origen || "",
                  markRetired:options.markRetired === true
                }
              )
            );
          });
        }
      };
    }

    if(
      database &&
      typeof database.guardarEstudiantes === "function"
    ){
      return {
        name:"BDLocal.guardarEstudiantes",

        save:function(rows, period, normalized, options){
          return database.guardarEstudiantes(
            rows,
            period,
            localOptions(options)
          );
        }
      };
    }

    if(
      database &&
      typeof database.saveStudents === "function"
    ){
      return {
        name:"BDLocal.saveStudents",

        save:function(rows, period, normalized, options){
          return database.saveStudents(
            rows,
            Object.assign(
              {},
              localOptions(options),
              period
            )
          );
        }
      };
    }

    if(
      repository &&
      typeof repository.guardarMuchos === "function"
    ){
      return {
        name:"BDLRepoEstudiantes.guardarMuchos",

        save:function(rows, period, normalized, options){
          return repository.guardarMuchos(
            rows,
            period,
            localOptions(options)
          );
        }
      };
    }

    return null;
  }

  function normalizeResult(result, period, rows, engineName){
    result = result || {};

    var warnings =
      result.warnings ||
      result.advertencias ||
      [];

    var errors =
      result.errors ||
      result.errores ||
      [];

    if(typeof warnings === "number"){
      warnings = new Array(warnings)
        .fill("Advertencia");
    }

    if(typeof errors === "number"){
      errors = new Array(errors)
        .fill("Error");
    }

    return Object.assign({}, result, {
      ok:result.ok !== false,
      engine:engineName,
      periodoId:period.periodoId,
      periodoLabel:period.periodoLabel,

      total:
        result.total ||
        result.totalEntrada ||
        rows.length,

      totalEntrada:
        result.totalEntrada ||
        result.total ||
        rows.length,

      saved:
        result.saved ||
        result.guardados ||
        result.nuevos ||
        0,

      guardados:
        result.guardados ||
        result.saved ||
        result.nuevos ||
        0,

      updated:
        result.updated ||
        result.actualizados ||
        0,

      actualizados:
        result.actualizados ||
        result.updated ||
        0,

      merged:
        result.merged ||
        result.duplicados ||
        result.duplicadosCorregidos ||
        0,

      duplicados:
        result.duplicados ||
        result.merged ||
        result.duplicadosCorregidos ||
        0,

      warnings:warnings,
      advertencias:warnings,
      errors:errors,
      errores:errors,
      changes:result.changes || result.cambios || []
    });
  }

  function updateAuxiliaryRepositories(rows, period){
    var tasks = [];

    var careers = api("BDLRepoCarreras");
    var requirements = api("BDLRepoRequisitos");
    var dashboard = api("BDLRepoDashboard");

    if(
      careers &&
      typeof careers.guardarDesdeEstudiantes === "function"
    ){
      tasks.push(
        careers.guardarDesdeEstudiantes(rows)
          .catch(function(error){
            console.warn(
              "[CargaSave] No se actualizaron carreras",
              error
            );

            return null;
          })
      );
    }

    if(
      requirements &&
      typeof requirements.guardarCatalogo === "function"
    ){
      tasks.push(
        requirements.guardarCatalogo()
          .catch(function(error){
            console.warn(
              "[CargaSave] No se actualizó el catálogo",
              error
            );

            return null;
          })
      );
    }

    if(
      dashboard &&
      typeof dashboard.recalcularBasico === "function"
    ){
      tasks.push(
        dashboard.recalcularBasico(period.periodoId)
          .catch(function(error){
            console.warn(
              "[CargaSave] No se recalculó el dashboard",
              error
            );

            return null;
          })
      );
    }

    return Promise.all(tasks);
  }

  function createBackup(period){
    var backup = api("BL2Backup");

    if(
      backup &&
      typeof backup.autoAfterExcel === "function"
    ){
      return backup.autoAfterExcel(period.periodoId)
        .catch(function(){
          return null;
        });
    }

    if(
      backup &&
      typeof backup.dailyIfNeeded === "function"
    ){
      return backup.dailyIfNeeded({
        scope:"period",
        periodoId:period.periodoId,
        periodoLabel:period.periodoLabel
      }).catch(function(){
        return null;
      });
    }

    return Promise.resolve(null);
  }

  function emitPendingClouds(result, period){
    var changes = result.changes || [];

    var total = Array.isArray(changes)
      ? changes.length
      : Number(changes || 0);

    emit("bdlocal:changes-created", {
      source:"CargaSave",
      localOnly:true,
      manualCloudSync:true,
      periodoId:period.periodoId,
      periodoLabel:period.periodoLabel,
      total:total,
      changes:Array.isArray(changes) ? changes : [],
      targets:["firebase", "supabase", "google"],
      message:
        "Guardado local correcto. Las nubes quedan pendientes.",
      at:new Date().toISOString()
    });

    emit("bdlocal:cloud-pending", {
      source:"CargaSave",
      periodoId:period.periodoId,
      periodoLabel:period.periodoLabel,
      total:total,
      firebase:"PENDIENTE",
      supabase:"PENDIENTE",
      google:"PENDIENTE",
      at:new Date().toISOString()
    });
  }

  function executeSave(normalized, validation, options){
    normalized = normalized || {};
    validation = validation || {};
    options = localOptions(options || {});

    var rows = rowsFromNormalized(normalized);
    var period = selectedPeriod(normalized, options);

    if(!rows.length){
      return Promise.resolve({
        ok:false,
        total:0,
        saved:0,
        updated:0,
        merged:0,
        message:"No existen estudiantes para guardar."
      });
    }

    if(
      validation.ok === false &&
      options.allowErrors !== true
    ){
      return Promise.resolve({
        ok:false,
        total:rows.length,
        saved:0,
        updated:0,
        merged:0,
        errors:validation.errors || [],
        warnings:validation.warnings || [],
        message:
          "La carga tiene errores y no fue guardada."
      });
    }

    if(!period.valid){
      return Promise.resolve({
        ok:false,
        total:rows.length,
        saved:0,
        updated:0,
        merged:0,
        message:"Selecciona un período antes de guardar."
      });
    }

    try{
      validateAnalysis(
        options.analysis,
        period
      );
    }catch(error){
      return Promise.resolve({
        ok:false,
        total:rows.length,
        saved:0,
        updated:0,
        merged:0,
        message:error.message || String(error)
      });
    }

    var preparedRows = rows.map(function(row){
      return injectPeriod(row, period);
    });

    emit("bdlocal:carga-save-start", {
      total:preparedRows.length,
      periodoId:period.periodoId,
      periodoLabel:period.periodoLabel,
      at:new Date().toISOString()
    });

    return ensureDependencies()
      .then(function(){
        var engine = selectEngine();

        if(!engine){
          throw new Error(
            "No existe un motor de guardado disponible en BDLocal."
          );
        }

        emit("bdlocal:carga-engine-selected", {
          engine:engine.name,
          periodoId:period.periodoId,
          total:preparedRows.length,
          at:new Date().toISOString()
        });

        return engine.save(
          clone(preparedRows),
          period,
          normalized,
          options
        ).then(function(result){
          return {
            raw:result,
            engineName:engine.name
          };
        });
      })
      .then(function(payload){
        var finalResult = normalizeResult(
          payload.raw,
          period,
          preparedRows,
          payload.engineName
        );

        if(finalResult.ok === false){
          return finalResult;
        }

        return updateAuxiliaryRepositories(
          preparedRows,
          period
        ).then(function(){
          return createBackup(period);
        }).then(function(){
          emitPendingClouds(
            finalResult,
            period
          );

          var hub = api("BDLocalConexiones");

          if(
            hub &&
            typeof hub.refreshCache === "function"
          ){
            hub.refreshCache({
              source:"CargaSave.save"
            }).catch(function(){
              return null;
            });
          }

          emit("bdlocal:carga-save-finish", {
            ok:true,
            engine:finalResult.engine,
            total:finalResult.total,
            saved:finalResult.saved,
            updated:finalResult.updated,
            merged:finalResult.merged,
            periodoId:period.periodoId,
            periodoLabel:period.periodoLabel,
            at:new Date().toISOString()
          });

          return finalResult;
        });
      })
      .catch(function(error){
        emit("bdlocal:carga-save-error", {
          ok:false,
          error:error.message || String(error),
          periodoId:period.periodoId,
          periodoLabel:period.periodoLabel,
          at:new Date().toISOString()
        });

        throw error;
      });
  }

  function save(normalized, validation, options){
    if(activeSave){
      return activeSave;
    }

    activeSave = executeSave(
      normalized,
      validation,
      options
    ).finally(function(){
      activeSave = null;
    });

    return activeSave;
  }

  window.CargaSave = {
    save:save,

    isSaving:function(){
      return !!activeSave;
    },

    helpers:{
      selectedPeriod:selectedPeriod,
      injectPeriod:injectPeriod,
      normalizeCedula:normalizeCedula,
      selectEngine:selectEngine,
      validateAnalysis:validateAnalysis,
      ensureDependencies:ensureDependencies
    }
  };
})(window, document);
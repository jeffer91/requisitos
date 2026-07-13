/* =========================================================
Nombre completo: carga.app.js
Ruta o ubicación: /Requisitos/Carga/carga.app.js
Función o funciones:
- Orquestar lectura, normalización, validación, comparación y guardado.
- Comparar cédulas del archivo con el período seleccionado.
- Bloquear la carga cuando la diferencia supera el 10%.
- Impedir guardados simultáneos o sin análisis aprobado.
- Solicitar a BDLocal el borrado seguro de estudiantes o períodos.
Con qué se conecta:
- carga.config.js
- carga.state.js
- readers/carga.reader.file.js
- process/carga.normalizer.js
- process/carga.validator.js
- process/carga.preview.js
- process/carga.report.js
- process/carga.save.js
- BL2Core / BDLocal
========================================================= */
(function(window){
  "use strict";

  var cfg = window.CargaConfig;
  var state = window.CargaState;

  if(!cfg || !state){
    throw new Error(
      "CargaConfig y CargaState deben cargarse antes de CargaApp."
    );
  }

  var approvedGuard = null;
  var saveInFlight = null;
  var deleteInFlight = null;

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

  function api(name){
    try{
      if(window[name]){
        return window[name];
      }
    }catch(error){}

    try{
      if(
        window.parent &&
        window.parent !== window &&
        window.parent[name]
      ){
        return window.parent[name];
      }
    }catch(error2){}

    try{
      if(
        window.top &&
        window.top !== window &&
        window.top[name]
      ){
        return window.top[name];
      }
    }catch(error3){}

    try{
      if(
        window.opener &&
        window.opener !== window &&
        window.opener[name]
      ){
        return window.opener[name];
      }
    }catch(error4){}

    return null;
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

  function localPeriod(){
    var id = "";
    var label = "";

    try{
      id =
        localStorage.getItem(
          "carga.periodoSeleccionado"
        ) || "";

      label =
        localStorage.getItem(
          "carga.periodoSeleccionadoLabel"
        ) || "";
    }catch(error){}

    id = canonicalPeriodId(id);

    return {
      periodoId:id,
      periodoLabel:label || id,
      periodoCanonicoId:id,
      periodoCanonicoLabel:label || id
    };
  }

  function mergeOptions(base, extra){
    var merged = Object.assign(
      {},
      localPeriod(),
      base || {},
      extra || {}
    );

    merged.periodoId = canonicalPeriodId(
      merged.periodoCanonicoId ||
      merged.periodoId ||
      merged.id ||
      ""
    );

    merged.periodoLabel = text(
      merged.periodoCanonicoLabel ||
      merged.periodoLabel ||
      merged.label ||
      merged.periodoId
    );

    merged.periodoCanonicoId =
      merged.periodoId;

    merged.periodoCanonicoLabel =
      merged.periodoLabel;

    return merged;
  }

  function requireModule(name, method){
    var module = window[name];

    if(
      !module ||
      (
        method &&
        typeof module[method] !== "function"
      )
    ){
      throw new Error(
        method
          ? name + "." + method + " no está disponible."
          : name + " no está disponible."
      );
    }

    return module;
  }

  function invalidateAnalysis(){
    approvedGuard = null;
  }

  function processRows(rows, options){
    options = mergeOptions(options || {});
    rows = Array.isArray(rows) ? rows : [];

    invalidateAnalysis();

    state.setStatus(
      cfg.estados.mapping,
      "Normalizando datos"
    );

    var normalized = requireModule(
      "CargaNormalizer",
      "normalizeRows"
    ).normalizeRows(rows, options);

    normalized.periodoDetectado =
      normalized.periodoDetectado || {};

    normalized.periodoDetectado.periodoId =
      canonicalPeriodId(
        normalized.periodoDetectado.periodoId ||
        options.periodoId
      );

    normalized.periodoDetectado.periodoLabel =
      text(
        normalized.periodoDetectado.periodoLabel ||
        options.periodoLabel ||
        options.periodoId
      );

    normalized.periodoDetectado.periodoCanonicoId =
      normalized.periodoDetectado.periodoId;

    normalized.periodoDetectado.periodoCanonicoLabel =
      normalized.periodoDetectado.periodoLabel;

    normalized.fileName = text(
      normalized.fileName ||
      options.fileName
    );

    normalized.origen = text(
      normalized.origen ||
      options.origen
    );

    state.patch({
      rows:rows,
      normalized:normalized,
      origen:normalized.origen,
      fileName:normalized.fileName
    });

    state.setStatus(
      cfg.estados.validating,
      "Validando datos"
    );

    var validation = requireModule(
      "CargaValidator",
      "validate"
    ).validate(normalized) || {};

    validation.errors =
      Array.isArray(validation.errors)
        ? validation.errors
        : [];

    validation.warnings =
      (
        Array.isArray(options.readerWarnings)
          ? options.readerWarnings
          : []
      ).concat(
        Array.isArray(validation.warnings)
          ? validation.warnings
          : []
      );

    validation.ok =
      validation.errors.length === 0 &&
      validation.ok !== false;

    var preview = {
      rows:[]
    };

    if(
      window.CargaPreview &&
      typeof window.CargaPreview.build === "function"
    ){
      try{
        preview = window.CargaPreview.build(
          normalized,
          validation
        );
      }catch(error){
        console.warn(
          "[CargaApp] Preview no disponible",
          error
        );
      }
    }

    state.patch({
      preview:
        preview &&
        Array.isArray(preview.rows)
          ? preview.rows
          : [],

      errors:validation.errors,
      warnings:validation.warnings
    });

    state.setStatus(
      validation.ok
        ? cfg.estados.ready
        : cfg.estados.error,

      validation.ok
        ? "Archivo listo para comparar"
        : "Archivo con errores"
    );

    emit("carga:processed", {
      total:rows.length,
      ok:validation.ok,
      errors:validation.errors.length,
      warnings:validation.warnings.length,
      periodoId:options.periodoId,
      fileName:normalized.fileName
    });

    return {
      normalized:normalized,
      validation:validation,
      preview:preview
    };
  }

  function readFile(file, options){
    if(!file){
      return Promise.reject(
        new Error("Selecciona un archivo.")
      );
    }

    options = mergeOptions(
      options || {},
      {
        fileName:file.name || ""
      }
    );

    state.reset();
    invalidateAnalysis();

    state.setStatus(
      cfg.estados.reading,
      "Leyendo archivo"
    );

    return requireModule(
      "CargaReaderFile",
      "read"
    ).read(file).then(function(result){
      result = result || {};

      var metadata = mergeOptions(
        options,
        {
          origen:
            result.origen ||
            "archivo",

          fileName:
            result.fileName ||
            options.fileName,

          detectedType:
            result.detectedType ||
            result.tipo ||
            "",

          encoding:
            result.encoding ||
            "",

          sheetName:
            result.sheetName ||
            "",

          readerWarnings:
            result.warnings ||
            []
        }
      );

      return processRows(
        result.rows || [],
        metadata
      );
    }).catch(function(error){
      state.setStatus(
        cfg.estados.error,
        error.message ||
        "No se pudo leer el archivo"
      );

      throw error;
    });
  }

  function readClipboard(value, options){
    options = mergeOptions(
      options || {},
      {
        origen:"clipboard",
        fileName:"pegado_manual"
      }
    );

    state.reset();
    invalidateAnalysis();

    return requireModule(
      "CargaReaderClipboard",
      "read"
    ).read(value).then(function(result){
      return processRows(
        result.rows || [],
        mergeOptions(
          options,
          result || {}
        )
      );
    });
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

    var normal = function(value){
      return text(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    };

    var wanted = fields.map(normal);
    var keys = Object.keys(row);

    for(var i = 0; i < keys.length; i += 1){
      if(
        wanted.indexOf(
          normal(keys[i])
        ) >= 0
      ){
        return row[keys[i]];
      }
    }

    return "";
  }

  function cedulaOf(row){
    return normalizeCedula(
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
  }

  function uniqueCedulas(rows){
    var map = {};

    (Array.isArray(rows) ? rows : [])
      .forEach(function(row){
        var id = cedulaOf(row);

        if(id){
          map[id] = true;
        }
      });

    return Object.keys(map).sort();
  }

  function signature(periodId, cedulas){
    var source =
      canonicalPeriodId(periodId) +
      "|" +
      cedulas.join("|");

    var hash = 2166136261;

    for(var i = 0; i < source.length; i += 1){
      hash ^= source.charCodeAt(i);

      hash +=
        (hash << 1) +
        (hash << 4) +
        (hash << 7) +
        (hash << 8) +
        (hash << 24);
    }

    return (
      canonicalPeriodId(periodId) +
      ":" +
      (hash >>> 0).toString(16) +
      ":" +
      cedulas.length
    );
  }

  function getStudents(periodId){
    var core = api("BL2Core");

    var connection =
      api("ConCarga") ||
      api("BDLocalCarga");

    if(
      core &&
      typeof core.getStudents === "function"
    ){
      return Promise.resolve(
        core.getStudents({
          periodoId:periodId,
          matricula:""
        })
      ).then(function(rows){
        return Array.isArray(rows)
          ? rows
          : [];
      });
    }

    if(
      connection &&
      typeof connection.getStudents === "function"
    ){
      return Promise.resolve(
        connection.getStudents({
          periodoId:periodId
        })
      ).then(function(rows){
        return Array.isArray(rows)
          ? rows
          : [];
      });
    }

    return Promise.reject(
      new Error(
        "BDLocal no permite consultar los estudiantes del período seleccionado."
      )
    );
  }

  function compareWithPeriod(period){
    period = period || {};

    var periodoId = canonicalPeriodId(
      period.periodoCanonicoId ||
      period.periodoId ||
      period.id ||
      ""
    );

    var current = state.get();

    if(!periodoId){
      return Promise.reject(
        new Error(
          "Selecciona un período antes de analizar."
        )
      );
    }

    if(!current.normalized){
      return Promise.reject(
        new Error(
          "Primero selecciona y lee un archivo."
        )
      );
    }

    var fileRows =
      current.normalized.rowsMapeadas ||
      current.rows ||
      [];

    var fileIds = uniqueCedulas(fileRows);

    if(!fileIds.length){
      return Promise.reject(
        new Error(
          "El archivo no contiene cédulas válidas."
        )
      );
    }

    return getStudents(periodoId)
      .then(function(existingRows){
        var existingIds =
          uniqueCedulas(existingRows);

        var fileMap = {};
        var existingMap = {};

        fileIds.forEach(function(id){
          fileMap[id] = true;
        });

        existingIds.forEach(function(id){
          existingMap[id] = true;
        });

        var common = fileIds.filter(function(id){
          return existingMap[id];
        });

        var onlyFile = fileIds.filter(function(id){
          return !existingMap[id];
        });

        var onlyExisting =
          existingIds.filter(function(id){
            return !fileMap[id];
          });

        var union = {};

        fileIds
          .concat(existingIds)
          .forEach(function(id){
            union[id] = true;
          });

        var different =
          onlyFile.length +
          onlyExisting.length;

        var firstLoad =
          existingIds.length === 0;

        var percent = firstLoad
          ? 0
          : (
              different /
              Math.max(
                1,
                Object.keys(union).length
              )
            ) * 100;

        var limit = Number(
          cfg.maxPeriodDifferencePercent || 10
        );

        var validationErrors =
          Array.isArray(current.errors)
            ? current.errors.length
            : 0;

        var ok =
          validationErrors === 0 &&
          (
            firstLoad ||
            percent <= limit
          );

        var message =
          validationErrors
            ? "Corrige los errores del archivo antes de guardar."
            : firstLoad
              ? "Primera carga del período: no existen estudiantes anteriores para comparar."
              : ok
                ? "La diferencia es " +
                  percent.toFixed(2) +
                  "%. Puede guardar el archivo."
                : "La diferencia es " +
                  percent.toFixed(2) +
                  "% y supera el límite del " +
                  limit +
                  "%. Revisa el período seleccionado.";

        var guard = {
          ok:ok,
          periodoId:periodoId,

          periodoLabel:text(
            period.periodoCanonicoLabel ||
            period.periodoLabel ||
            period.label ||
            periodoId
          ),

          existing:existingIds.length,
          inFile:fileIds.length,
          common:common.length,
          onlyFile:onlyFile.length,
          onlyExisting:onlyExisting.length,
          different:different,
          percent:Number(percent.toFixed(4)),
          limit:limit,
          firstLoad:firstLoad,
          sampleOnlyFile:onlyFile.slice(0, 20),
          sampleOnlyExisting:onlyExisting.slice(0, 20),
          signature:signature(periodoId, fileIds),
          message:message,
          checkedAt:new Date().toISOString()
        };

        approvedGuard = guard;

        emit(
          "carga:period-compared",
          clone(guard)
        );

        return clone(guard);
      });
  }

  function currentSignature(period){
    var current = state.get();

    var rows =
      current.normalized &&
      current.normalized.rowsMapeadas ||
      [];

    var id = canonicalPeriodId(
      period &&
      (
        period.periodoCanonicoId ||
        period.periodoId ||
        period.id
      )
    );

    return signature(
      id,
      uniqueCedulas(rows)
    );
  }

  function canSave(period){
    return !!(
      approvedGuard &&
      approvedGuard.ok &&
      approvedGuard.signature ===
        currentSignature(period)
    );
  }

  function buildReport(result, current){
    result = result || {};
    current = current || state.get();

    var report;

    if(
      window.CargaReport &&
      typeof window.CargaReport.build === "function"
    ){
      try{
        report = window.CargaReport.build(
          result,
          {
            ok:!(current.errors || []).length,
            errors:current.errors || [],
            warnings:current.warnings || [],
            total:(current.rows || []).length
          },
          current
        );
      }catch(error){}
    }

    report = report || {};

    return Object.assign(
      {},
      report,
      result,
      {
        ok:
          result.ok !== false &&
          report.ok !== false,

        total:
          result.total ||
          result.totalEntrada ||
          report.total ||
          (current.rows || []).length,

        saved:
          result.saved ||
          result.guardados ||
          report.saved ||
          report.guardados ||
          0,

        guardados:
          result.guardados ||
          result.saved ||
          report.guardados ||
          report.saved ||
          0,

        updated:
          result.updated ||
          result.actualizados ||
          report.updated ||
          report.actualizados ||
          0,

        actualizados:
          result.actualizados ||
          result.updated ||
          report.actualizados ||
          report.updated ||
          0,

        merged:
          result.merged ||
          result.duplicados ||
          report.merged ||
          report.duplicados ||
          0,

        duplicados:
          result.duplicados ||
          result.merged ||
          report.duplicados ||
          report.merged ||
          0
      }
    );
  }

  function save(options){
    options = mergeOptions(options || {});

    var period = {
      id:options.periodoId,
      periodoId:options.periodoId
    };

    if(saveInFlight){
      return saveInFlight;
    }

    if(!canSave(period)){
      return Promise.resolve({
        ok:false,
        total:0,
        saved:0,
        updated:0,
        merged:0,
        message:
          "El archivo debe analizarse y aprobarse antes de guardar."
      });
    }

    var current = state.get();

    state.setStatus(
      cfg.estados.committing,
      "Guardando en BDLocal"
    );

    saveInFlight = requireModule(
      "CargaSave",
      "save"
    ).save(
      clone(current.normalized),
      {
        ok:!(current.errors || []).length,
        errors:current.errors || [],
        warnings:current.warnings || []
      },
      Object.assign({}, options, {
        analysis:clone(approvedGuard),

        markRetired:
          approvedGuard.firstLoad
            ? false
            : options.markRetired === true
      })
    ).then(function(result){
      var report = buildReport(
        result,
        state.get()
      );

      state.patch({
        lastResult:report
      });

      state.setStatus(
        report.ok
          ? cfg.estados.done
          : cfg.estados.error,

        report.ok
          ? "Carga guardada"
          : report.message ||
            "Carga no guardada"
      );

      if(report.ok){
        invalidateAnalysis();
      }

      emit(
        "carga:saved",
        report
      );

      return report;
    }).catch(function(error){
      state.setStatus(
        cfg.estados.error,
        error.message ||
        "No se pudo guardar"
      );

      emit("carga:save-error", {
        error:error.message || String(error)
      });

      throw error;
    }).finally(function(){
      saveInFlight = null;
    });

    return saveInFlight;
  }

  function chunked(items, size, worker){
    var index = 0;

    function next(){
      if(index >= items.length){
        return Promise.resolve();
      }

      var batch = items.slice(
        index,
        index + size
      );

      index += size;

      return Promise.all(
        batch.map(worker)
      ).then(next);
    }

    return next();
  }

  function deleteStudentsByPeriod(period){
    if(deleteInFlight){
      return deleteInFlight;
    }

    var id = canonicalPeriodId(
      period &&
      (
        period.periodoCanonicoId ||
        period.periodoId ||
        period.id
      )
    );

    if(!id){
      return Promise.reject(
        new Error("Selecciona un período.")
      );
    }

    var core = api("BL2Core");

    var connection =
      api("ConCarga") ||
      api("BDLocalCarga");

    var target =
      connection ||
      core;

    if(
      target &&
      typeof target.deleteStudentsByPeriod === "function"
    ){
      deleteInFlight = Promise.resolve(
        target.deleteStudentsByPeriod(
          id,
          {
            localOnly:true,
            sync:false
          }
        )
      );
    }else if(
      core &&
      typeof core.deleteStudent === "function"
    ){
      deleteInFlight = getStudents(id)
        .then(function(rows){
          return chunked(
            rows,
            25,
            function(row){
              return core.deleteStudent(
                row.id ||
                row.idEstudiantePeriodo,
                {
                  localOnly:true,
                  sync:false
                }
              );
            }
          ).then(function(){
            return {
              ok:true,
              deleted:rows.length,
              message:
                "Se borraron " +
                rows.length +
                " estudiantes del período."
            };
          });
        });
    }else{
      return Promise.reject(
        new Error(
          "BDLocal no expone una función comprobable para borrar estudiantes."
        )
      );
    }

    deleteInFlight = deleteInFlight
      .then(function(result){
        invalidateAnalysis();

        return result || {
          ok:true,
          message:"Estudiantes borrados."
        };
      })
      .finally(function(){
        deleteInFlight = null;
      });

    return deleteInFlight;
  }

  function deletePeriod(period){
    if(deleteInFlight){
      return deleteInFlight;
    }

    var id = canonicalPeriodId(
      period &&
      (
        period.periodoCanonicoId ||
        period.periodoId ||
        period.id
      )
    );

    if(!id){
      return Promise.reject(
        new Error("Selecciona un período.")
      );
    }

    var core = api("BL2Core");

    var connection =
      api("ConCarga") ||
      api("BDLocalCarga");

    var target =
      connection ||
      core;

    if(
      target &&
      typeof target.deletePeriod === "function"
    ){
      deleteInFlight = Promise.resolve(
        target.deletePeriod(
          id,
          {
            deleteStudents:true,
            deleteDivisions:true,
            localOnly:true,
            sync:false
          }
        )
      );
    }else{
      return Promise.reject(
        new Error(
          "BDLocal no expone una función comprobable para borrar períodos."
        )
      );
    }

    deleteInFlight = deleteInFlight
      .then(function(result){
        invalidateAnalysis();

        return result || {
          ok:true,
          message:"Período borrado completamente."
        };
      })
      .finally(function(){
        deleteInFlight = null;
      });

    return deleteInFlight;
  }

  window.CargaApp = {
    processRows:processRows,
    readFile:readFile,
    readClipboard:readClipboard,
    compareWithPeriod:compareWithPeriod,
    canSave:canSave,
    invalidateAnalysis:invalidateAnalysis,
    save:save,
    deleteStudentsByPeriod:deleteStudentsByPeriod,
    deletePeriod:deletePeriod,
    state:state.get
  };
})(window);
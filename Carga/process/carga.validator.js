/* =========================================================
Nombre completo: carga.validator.js
Ruta o ubicación: /Requisitos/Carga/process/carga.validator.js
Función o funciones:
- Validar los estudiantes antes de guardar.
- Exigir un período seleccionado y al menos un registro válido.
- Detectar identificaciones vacías, nombres faltantes y carreras vacías.
- Detectar cédulas repetidas sin bloquearlas, porque se fusionarán.
- Comparar conjuntos de cédulas usando el límite máximo del 10%.
Con qué se conecta:
- carga.app.js
- carga.normalizer.js
- carga.config.js
- BDLNormPeriodo
- BDLNormEstudiante
- BDLValidatorEstudiante
========================================================= */
(function(window){
  "use strict";

  function text(value){
    return String(value == null ? "" : value).trim();
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

  function normalizeField(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function firstValue(row, fields){
    row = row || {};
    fields = Array.isArray(fields) ? fields : [];

    var wanted = fields.map(normalizeField);
    var keys = Object.keys(row);

    for(var i = 0; i < keys.length; i += 1){
      if(wanted.indexOf(normalizeField(keys[i])) >= 0){
        return row[keys[i]];
      }
    }

    return "";
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

  function cedulaOf(row){
    if(
      window.BDLNormEstudiante &&
      typeof window.BDLNormEstudiante.numero === "function"
    ){
      return normalizeCedula(
        window.BDLNormEstudiante.numero(row || {})
      );
    }

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

  function selectedPeriod(normalized){
    normalized = normalized || {};

    var detected = normalized.periodoDetectado || {};

    var id = canonicalPeriodId(
      detected.periodoCanonicoId ||
      detected.periodoId ||
      detected.id ||
      detected.value ||
      ""
    );

    var label = text(
      detected.periodoCanonicoLabel ||
      detected.periodoLabel ||
      detected.label ||
      detected.nombre ||
      id
    );

    if(
      window.BDLNormPeriodo &&
      typeof window.BDLNormPeriodo.normalize === "function"
    ){
      var result = window.BDLNormPeriodo.normalize(
        {},
        {
          periodoId:id,
          periodoLabel:label
        }
      );

      result.periodoId = canonicalPeriodId(
        result.periodoId || id
      );

      result.periodoLabel = text(
        result.periodoLabel || label || id
      );

      return result;
    }

    return {
      periodoId:id,
      periodoLabel:label || id,
      valid:!!id && id !== "SIN_PERIODO"
    };
  }

  function periodValid(period){
    if(
      window.BDLNormPeriodo &&
      typeof window.BDLNormPeriodo.isValid === "function"
    ){
      return window.BDLNormPeriodo.isValid(period);
    }

    return !!(
      period &&
      period.periodoId &&
      period.periodoId !== "SIN_PERIODO"
    );
  }

  function uniqueCedulas(rows){
    var map = {};

    (Array.isArray(rows) ? rows : [])
      .forEach(function(row){
        var cedula = cedulaOf(row);

        if(cedula){
          map[cedula] = true;
        }
      });

    return Object.keys(map).sort();
  }

  function duplicateCedulas(rows){
    var counts = {};

    (Array.isArray(rows) ? rows : [])
      .forEach(function(row){
        var cedula = cedulaOf(row);

        if(!cedula){
          return;
        }

        counts[cedula] = (counts[cedula] || 0) + 1;
      });

    return Object.keys(counts)
      .filter(function(cedula){
        return counts[cedula] > 1;
      })
      .map(function(cedula){
        return {
          cedula:cedula,
          cantidad:counts[cedula]
        };
      });
  }

  function compareCedulas(existingRows, fileRows, limit){
    var existing = uniqueCedulas(existingRows);
    var inFile = uniqueCedulas(fileRows);

    var existingMap = {};
    var fileMap = {};
    var unionMap = {};

    existing.forEach(function(cedula){
      existingMap[cedula] = true;
      unionMap[cedula] = true;
    });

    inFile.forEach(function(cedula){
      fileMap[cedula] = true;
      unionMap[cedula] = true;
    });

    var common = inFile.filter(function(cedula){
      return existingMap[cedula];
    });

    var onlyFile = inFile.filter(function(cedula){
      return !existingMap[cedula];
    });

    var onlyExisting = existing.filter(function(cedula){
      return !fileMap[cedula];
    });

    var firstLoad = existing.length === 0;
    var different = onlyFile.length + onlyExisting.length;
    var union = Object.keys(unionMap).length;

    limit = Number(
      limit ||
      (
        window.CargaConfig &&
        window.CargaConfig.maxPeriodDifferencePercent
      ) ||
      10
    );

    var percent = firstLoad
      ? 0
      : (different / Math.max(1, union)) * 100;

    return {
      ok:firstLoad || percent <= limit,
      existing:existing.length,
      inFile:inFile.length,
      common:common.length,
      onlyFile:onlyFile.length,
      onlyExisting:onlyExisting.length,
      different:different,
      union:union,
      percent:Number(percent.toFixed(4)),
      limit:limit,
      firstLoad:firstLoad,
      sampleOnlyFile:onlyFile.slice(0, 20),
      sampleOnlyExisting:onlyExisting.slice(0, 20)
    };
  }

  function validate(normalized){
    normalized = normalized || {};

    var rows = Array.isArray(normalized.rowsMapeadas)
      ? normalized.rowsMapeadas
      : [];

    var errors = [];
    var warnings = [];
    var period = selectedPeriod(normalized);

    if(!rows.length){
      errors.push({
        row:0,
        tipo:"SIN_REGISTROS",
        campo:"archivo",
        mensaje:"No se encontraron estudiantes para guardar."
      });
    }

    if(!periodValid(period)){
      errors.push({
        row:0,
        tipo:"PERIODO_NO_SELECCIONADO",
        campo:"periodo",
        mensaje:"Primero selecciona el período donde se guardará el archivo."
      });
    }

    var preparedRows = rows;

    if(
      window.BDLValidatorEstudiante &&
      typeof window.BDLValidatorEstudiante.validateRows === "function"
    ){
      try{
        var external = window.BDLValidatorEstudiante.validateRows(
          rows,
          period
        ) || {};

        errors = errors.concat(
          Array.isArray(external.errors)
            ? external.errors
            : []
        );

        warnings = warnings.concat(
          Array.isArray(external.warnings)
            ? external.warnings
            : []
        );

        preparedRows = Array.isArray(external.preparedRows)
          ? external.preparedRows
          : rows;
      }catch(error){
        warnings.push({
          row:0,
          tipo:"VALIDADOR_EXTERNO_NO_DISPONIBLE",
          campo:"archivo",
          mensaje:"Se aplicaron las validaciones internas de Carga."
        });
      }
    }

    rows.forEach(function(row, index){
      var cedula = cedulaOf(row);

      if(!cedula || cedula === "SIN_IDENTIFICACION"){
        errors.push({
          row:index + 1,
          tipo:"IDENTIFICACION_VACIA",
          campo:"numeroIdentificacion",
          mensaje:
            "Fila " +
            (index + 1) +
            ": estudiante sin identificación."
        });
      }else if(cedula.length < 6){
        errors.push({
          row:index + 1,
          tipo:"IDENTIFICACION_INVALIDA",
          campo:"numeroIdentificacion",
          mensaje:
            "Fila " +
            (index + 1) +
            ": la identificación es demasiado corta."
        });
      }else if(
        /^\d+$/.test(cedula) &&
        cedula.length !== 10
      ){
        warnings.push({
          row:index + 1,
          tipo:"IDENTIFICACION_REVISAR",
          campo:"numeroIdentificacion",
          mensaje:
            "Fila " +
            (index + 1) +
            ": revise la longitud de la identificación " +
            cedula +
            "."
        });
      }

      var names = text(
        firstValue(
          row,
          ["nombres", "nombre", "estudiante", "alumno"]
        )
      );

      if(!names){
        errors.push({
          row:index + 1,
          tipo:"NOMBRE_VACIO",
          campo:"nombres",
          mensaje:
            "Fila " +
            (index + 1) +
            ": estudiante sin nombres."
        });
      }

      var career = text(
        firstValue(
          row,
          [
            "nombreCarrera",
            "NombreCarrera",
            "carrera",
            "Carrera",
            "programa"
          ]
        )
      );

      if(!career){
        warnings.push({
          row:index + 1,
          tipo:"CARRERA_VACIA",
          campo:"nombreCarrera",
          mensaje:
            "Fila " +
            (index + 1) +
            ": no se detectó la carrera."
        });
      }
    });

    var duplicates = duplicateCedulas(rows);

    if(duplicates.length){
      warnings.push({
        row:0,
        tipo:"DUPLICADOS_EN_ARCHIVO",
        campo:"numeroIdentificacion",
        mensaje:
          "Se detectaron " +
          duplicates.length +
          " identificaciones repetidas. " +
          "Se fusionarán durante el guardado."
      });
    }

    return {
      ok:errors.length === 0,
      errors:errors,
      warnings:warnings,
      duplicates:duplicates,
      total:rows.length,
      totalCedulasUnicas:uniqueCedulas(rows).length,
      periodo:period,
      preparedRows:preparedRows,

      message:errors.length
        ? "La carga tiene errores y no puede guardarse."
        : "Archivo validado correctamente."
    };
  }

  window.CargaValidator = {
    validate:validate,
    compareCedulas:compareCedulas,
    uniqueCedulas:uniqueCedulas,
    duplicateCedulas:duplicateCedulas,
    normalizeCedula:normalizeCedula,
    selectedPeriod:selectedPeriod
  };
})(window);
/* =========================================================
Nombre completo: bdl.validator.estudiante.js
Ruta o ubicación: /Requisitos/BDLocal/data/validators/bdl.validator.estudiante.js
Función o funciones:
- Validar estudiantes antes de guardarlos en Base Local.
- Bloquear estudiantes sin período seleccionado.
- Validar cédula/identificación y evitar registros peligrosos.
- Detectar duplicados dentro de la misma carga sin detener toda la importación.
- Preparar mensajes claros para Carga, BDLocal y diagnóstico.
Con qué se conecta:
- bdl.norm.periodo.js
- bdl.norm.estudiante.js
- bdl.norm.carrera.js
- bdl.norm.division.js
- carga.validator.js
- bdl.repo.estudiantes.js
========================================================= */
(function(window){
  "use strict";

  var P = window.BDLNormPeriodo || null;
  var E = window.BDLNormEstudiante || null;
  var C = window.BDLNormCarrera || null;
  var D = window.BDLNormDivision || null;

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function key(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  function isEmpty(value){
    var v = text(value);
    return !v || v === "-" || v === "—" || v.toLowerCase() === "null" || v.toLowerCase() === "undefined";
  }

  function periodFromSelected(periodoInfo){
    periodoInfo = periodoInfo || {};

    if(P && typeof P.normalize === "function"){
      return P.normalize({}, {
        periodoId: periodoInfo.periodoId || periodoInfo.id || periodoInfo.value || "",
        periodoLabel: periodoInfo.periodoLabel || periodoInfo.label || periodoInfo.nombre || periodoInfo.periodoId || ""
      });
    }

    var id = text(periodoInfo.periodoId || periodoInfo.id || periodoInfo.value || "");
    var label = text(periodoInfo.periodoLabel || periodoInfo.label || periodoInfo.nombre || id);

    return {
      periodoId: id || "SIN_PERIODO",
      periodoLabel: label || "Sin período",
      valid: !!id && id !== "SIN_PERIODO"
    };
  }

  function injectPeriod(row, periodoInfo){
    row = Object.assign({}, row || {});
    periodoInfo = periodFromSelected(periodoInfo);

    row.periodoId = periodoInfo.periodoId;
    row.PeriodoId = periodoInfo.periodoId;
    row.periodId = periodoInfo.periodoId;
    row.periodo = periodoInfo.periodoLabel;
    row.Periodo = periodoInfo.periodoLabel;
    row.periodoLabel = periodoInfo.periodoLabel;
    row.PeriodoLabel = periodoInfo.periodoLabel;
    row._periodoSeleccionado = periodoInfo.periodoId;
    row._periodoSeleccionadoLabel = periodoInfo.periodoLabel;

    return row;
  }

  function periodIsValid(periodoInfo){
    if(P && typeof P.isValid === "function"){
      return P.isValid(periodoInfo);
    }
    return !!(periodoInfo && periodoInfo.periodoId && periodoInfo.periodoId !== "SIN_PERIODO");
  }

  function numero(row){
    if(E && typeof E.numero === "function"){
      return E.numero(row || {});
    }

    row = row || {};
    var raw = text(
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.cedula ||
      row.Cedula ||
      row.CEDULA ||
      row.identificacion ||
      row.Identificacion ||
      ""
    ).replace(/[^0-9]/g, "");

    if(raw.length === 9){
      raw = "0" + raw;
    }

    return raw || "SIN_IDENTIFICACION";
  }

  function nombres(row){
    if(E && typeof E.nombres === "function"){
      return E.nombres(row || {});
    }

    row = row || {};
    return text(row.nombres || row.Nombres || row.nombreCompleto || row.NombreCompleto || row.estudiante || row.Estudiante || "");
  }

  function carrera(row){
    row = row || {};

    if(C && typeof C.normalizeRow === "function"){
      return C.normalizeRow(row).nombreCarrera || "";
    }

    return text(row.nombreCarrera || row.NombreCarrera || row.carrera || row.Carrera || row.programa || row.Programa || "");
  }

  function division(row){
    row = row || {};

    if(D && typeof D.principal === "function"){
      return D.principal(row);
    }

    return text(row.division || row.Division || row.modalidad || row.Modalidad || "");
  }

  function validateRow(row, periodoInfo, options){
    options = options || {};
    var index = Number(options.index || 0);
    var sourceRow = Object.assign({}, row || {});
    var preparedRow = injectPeriod(sourceRow, periodoInfo);
    var selectedPeriod = periodFromSelected(periodoInfo);
    var errors = [];
    var warnings = [];
    var cedula = numero(preparedRow);
    var nombre = nombres(preparedRow);
    var carreraNombre = carrera(preparedRow);
    var divisionNombre = division(preparedRow);

    if(!periodIsValid(selectedPeriod)){
      errors.push({
        row: index + 1,
        tipo: "PERIODO_OBLIGATORIO",
        campo: "periodo",
        mensaje: "Primero selecciona un período. La Base Local no acepta estudiantes sin período."
      });
    }

    if(!cedula || cedula === "SIN_IDENTIFICACION"){
      errors.push({
        row: index + 1,
        tipo: "IDENTIFICACION_VACIA",
        campo: "numeroIdentificacion",
        mensaje: "El estudiante no tiene cédula o identificación válida."
      });
    }

    if(cedula && cedula !== "SIN_IDENTIFICACION" && cedula.length < 10){
      warnings.push({
        row: index + 1,
        tipo: "IDENTIFICACION_CORTA",
        campo: "numeroIdentificacion",
        mensaje: "La identificación tiene menos de 10 dígitos. Se guardará, pero conviene revisar."
      });
    }

    if(isEmpty(nombre) || nombre === "ESTUDIANTE SIN NOMBRE"){
      warnings.push({
        row: index + 1,
        tipo: "NOMBRE_VACIO",
        campo: "nombres",
        mensaje: "El estudiante no tiene nombre claro."
      });
    }

    if(isEmpty(carreraNombre) || key(carreraNombre) === "sin_carrera"){
      warnings.push({
        row: index + 1,
        tipo: "CARRERA_VACIA",
        campo: "carrera",
        mensaje: "El estudiante no tiene carrera detectada."
      });
    }

    if(isEmpty(divisionNombre) || key(divisionNombre) === "sin_division"){
      warnings.push({
        row: index + 1,
        tipo: "DIVISION_VACIA",
        campo: "division",
        mensaje: "El estudiante quedó con división vacía o Sin división."
      });
    }

    return {
      ok: errors.length === 0,
      row: index + 1,
      cedula: cedula,
      numeroIdentificacion: cedula,
      periodo: selectedPeriod,
      idEstudiantePeriodo: selectedPeriod.periodoId + "__" + cedula,
      preparedRow: preparedRow,
      errors: errors,
      warnings: warnings
    };
  }

  function validateRows(rows, periodoInfo, options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};

    var errors = [];
    var warnings = [];
    var preparedRows = [];
    var seen = {};
    var duplicates = [];

    rows.forEach(function(row, index){
      var validation = validateRow(row, periodoInfo, { index:index });
      preparedRows.push(validation.preparedRow);

      errors = errors.concat(validation.errors);
      warnings = warnings.concat(validation.warnings);

      if(validation.ok){
        var id = validation.idEstudiantePeriodo;
        if(seen[id] != null){
          duplicates.push({
            idEstudiantePeriodo: id,
            primeraFila: seen[id] + 1,
            filaDuplicada: index + 1,
            cedula: validation.cedula,
            periodoId: validation.periodo.periodoId
          });
        }else{
          seen[id] = index;
        }
      }
    });

    duplicates.forEach(function(item){
      warnings.push({
        row: item.filaDuplicada,
        tipo: "DUPLICADO_MISMA_CARGA",
        campo: "numeroIdentificacion",
        mensaje: "La misma cédula aparece más de una vez en el mismo período. Base Local fusionará y conservará el dato más completo.",
        detalle: item
      });
    });

    return {
      ok: errors.length === 0,
      total: rows.length,
      validos: preparedRows.length - errors.length,
      errors: errors,
      warnings: warnings,
      duplicates: duplicates,
      preparedRows: preparedRows,
      periodo: periodFromSelected(periodoInfo)
    };
  }

  function isOk(result){
    return !!(result && result.ok === true);
  }

  window.BDLValidatorEstudiante = {
    validateRow: validateRow,
    validateRows: validateRows,
    validate: validateRows,
    injectPeriod: injectPeriod,
    periodFromSelected: periodFromSelected,
    isOk: isOk
  };
})(window);
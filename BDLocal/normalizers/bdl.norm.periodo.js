/* =========================================================
Nombre completo: bdl.norm.periodo.js
Ruta o ubicación: /Requisitos/BDLocal/normalizers/bdl.norm.periodo.js
Función o funciones:
- Normalizar períodos académicos para Base Local.
- Usar como prioridad el período seleccionado antes de cargar Excel.
- Impedir que un estudiante quede como válido si no tiene período.
- Mantener compatibilidad con BDLKeys, BDLState, CargaValidator y BDLRepoEstudiantes.
Con qué se conecta:
- bdl.norm.text.js
- bdl.keys.js
- bdl.state.js
- carga.normalizer.js
- carga.validator.js
- bdl.repo.estudiantes.js
========================================================= */
(function(window){
  "use strict";

  var T = window.BDLNormText || null;
  var K = window.BDLKeys || null;

  if(!T){
    throw new Error("BDLNormText debe cargarse antes de BDLNormPeriodo.");
  }

  function text(value){
    if(T && typeof T.text === "function"){
      return T.text(value);
    }
    return String(value == null ? "" : value).trim();
  }

  function cleanSpaces(value){
    if(T && typeof T.cleanSpaces === "function"){
      return T.cleanSpaces(value);
    }
    return text(value).replace(/\s+/g, " ").trim();
  }

  function key(value){
    if(T && typeof T.key === "function"){
      return T.key(value);
    }
    if(K && typeof K.key === "function"){
      return K.key(value);
    }
    return cleanSpaces(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  function now(){
    return new Date().toISOString();
  }

  function first(row, fields){
    row = row || {};
    fields = fields || [];
    if(T && typeof T.first === "function"){
      return T.first(row, fields);
    }
    for(var i = 0; i < fields.length; i++){
      if(row[fields[i]] != null && text(row[fields[i]]) !== ""){
        return row[fields[i]];
      }
    }
    return "";
  }

  function activePeriodId(){
    try{
      if(window.BDLState && typeof window.BDLState.getPeriodoActivo === "function"){
        var statePeriod = cleanSpaces(window.BDLState.getPeriodoActivo());
        if(statePeriod){ return statePeriod; }
      }
    }catch(error){}

    try{
      if(window.BDLConfig && window.BDLConfig.keys && window.BDLConfig.keys.activePeriod){
        return cleanSpaces(window.localStorage.getItem(window.BDLConfig.keys.activePeriod) || "");
      }
    }catch(error){}

    return "";
  }

  function isEmptyPeriod(value){
    var raw = cleanSpaces(value);
    if(!raw){ return true; }
    var k = key(raw);
    return k === "sin_periodo" || k === "sinperiodo" || k === "seleccione_periodo" || k === "seleccione_un_periodo";
  }

  function monthNumber(value){
    var k = key(value);
    var months = {
      enero:1,
      febrero:2,
      marzo:3,
      abril:4,
      mayo:5,
      junio:6,
      julio:7,
      agosto:8,
      septiembre:9,
      setiembre:9,
      octubre:10,
      noviembre:11,
      diciembre:12
    };
    return months[k] || 0;
  }

  function extractMonths(value){
    var raw = cleanSpaces(value);
    var normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    var found = [];
    var seen = {};

    Object.keys({
      enero:1,
      febrero:2,
      marzo:3,
      abril:4,
      mayo:5,
      junio:6,
      julio:7,
      agosto:8,
      septiembre:9,
      setiembre:9,
      octubre:10,
      noviembre:11,
      diciembre:12
    }).forEach(function(name){
      var n = monthNumber(name);
      var re = new RegExp("(^|[^a-z])" + name + "([^a-z]|$)", "i");
      if(re.test(normalized) && !seen[n]){
        seen[n] = true;
        found.push(n);
      }
    });

    var numeric = raw.match(/\b(0?[1-9]|1[0-2])\b/g) || [];
    numeric.forEach(function(item){
      var n = Number(item);
      if(n >= 1 && n <= 12 && !seen[n]){
        seen[n] = true;
        found.push(n);
      }
    });

    return found;
  }

  function classify(value){
    var months = extractMonths(value);
    var has = function(a, b){
      return months.indexOf(a) >= 0 && months.indexOf(b) >= 0;
    };

    if(has(4, 9)){
      return {
        id: "REGULAR",
        label: "Regular",
        pattern: "ABRIL_SEPTIEMBRE",
        months: months
      };
    }

    if(has(10, 3)){
      return {
        id: "REGULAR",
        label: "Regular",
        pattern: "OCTUBRE_MARZO",
        months: months
      };
    }

    if(months.length){
      return {
        id: "PVC",
        label: "PVC",
        pattern: "PERIODO_CORTO",
        months: months
      };
    }

    return {
      id: "DESCONOCIDO",
      label: "Desconocido",
      pattern: "",
      months: months
    };
  }

  function selectedFromArgs(row, selected, selectedLabel){
    if(selected && typeof selected === "object"){
      return {
        id: cleanSpaces(
          selected.periodoId ||
          selected.id ||
          selected.value ||
          selected.key ||
          ""
        ),
        label: cleanSpaces(
          selected.periodoLabel ||
          selected.label ||
          selected.nombre ||
          selected.name ||
          selectedLabel ||
          selected.periodoId ||
          selected.id ||
          ""
        ),
        source: "argumento"
      };
    }

    if(cleanSpaces(selected)){
      return {
        id: cleanSpaces(selected),
        label: cleanSpaces(selectedLabel || selected),
        source: "seleccion"
      };
    }

    return null;
  }

  function selectedFromRow(row){
    row = row || {};
    var id = cleanSpaces(first(row, [
      "_periodoSeleccionado",
      "periodoSeleccionado",
      "periodoIdSeleccionado",
      "periodoId",
      "PeriodoId",
      "idPeriodo",
      "periodId",
      "Periodo",
      "periodo",
      "periodoLabel",
      "PeriodoLabel",
      "PeriodoAcademico",
      "periodoAcademico"
    ]));

    var label = cleanSpaces(first(row, [
      "_periodoSeleccionadoLabel",
      "periodoSeleccionadoLabel",
      "periodoLabel",
      "PeriodoLabel",
      "Periodo",
      "periodo",
      "nombrePeriodo",
      "NombrePeriodo",
      "periodoAcademico",
      "PeriodoAcademico"
    ]));

    if(!id && !label){ return null; }

    return {
      id: id || label,
      label: label || id,
      source: "fila"
    };
  }

  function normalize(row, selected, selectedLabel){
    row = row || {};

    var chosen =
      selectedFromArgs(row, selected, selectedLabel) ||
      selectedFromRow(row) ||
      {
        id: activePeriodId(),
        label: activePeriodId(),
        source: "periodo_activo"
      };

    var rawId = cleanSpaces(chosen && chosen.id);
    var rawLabel = cleanSpaces(chosen && chosen.label) || rawId;

    if(isEmptyPeriod(rawId) && isEmptyPeriod(rawLabel)){
      return {
        periodoId: "SIN_PERIODO",
        periodoLabel: "Sin período",
        id: "SIN_PERIODO",
        value: "SIN_PERIODO",
        label: "Sin período",
        nombre: "Sin período",
        periodoKey: "sin_periodo",
        tipoPeriodo: "DESCONOCIDO",
        periodoTipo: "DESCONOCIDO",
        pattern: "",
        months: [],
        source: chosen && chosen.source ? chosen.source : "no_detectado",
        valid: false,
        error: "PERIODO_OBLIGATORIO",
        message: "No se detectó período seleccionado. La Base Local no debe guardar estudiantes sin período.",
        updatedAt: now()
      };
    }

    var label = rawLabel || rawId;
    var id = rawId;

    if(!id || id === label){
      id = K && typeof K.periodoId === "function" ? K.periodoId(label) : key(label);
    }else{
      id = K && typeof K.periodoId === "function" ? K.periodoId(id) : key(id);
    }

    var type = classify(label || id);

    return {
      periodoId: id,
      periodoLabel: label,
      id: id,
      value: id,
      label: label,
      nombre: label,
      periodoKey: key(label || id),
      tipoPeriodo: type.id,
      periodoTipo: type.id,
      tipoPeriodoLabel: type.label,
      pattern: type.pattern,
      months: type.months,
      source: chosen && chosen.source ? chosen.source : "normalizado",
      valid: true,
      error: "",
      message: "",
      updatedAt: now()
    };
  }

  function isValid(periodoInfo){
    return !!(periodoInfo && periodoInfo.valid !== false && periodoInfo.periodoId && periodoInfo.periodoId !== "SIN_PERIODO");
  }

  function assertValid(row, selected, selectedLabel){
    var info = normalize(row, selected, selectedLabel);
    if(!isValid(info)){
      throw new Error(info.message || "Período obligatorio no seleccionado.");
    }
    return info;
  }

  window.BDLNormPeriodo = {
    normalize: normalize,
    normalizar: normalize,
    classify: classify,
    isValid: isValid,
    assertValid: assertValid,
    activePeriodId: activePeriodId,
    key: function(value){ return normalize({ periodo:value }).periodoId; },
    label: function(value){ return normalize({ periodo:value }).periodoLabel; }
  };
})(window);
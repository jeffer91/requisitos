/* =========================================================
Nombre completo: tabla.stage-policy.js
Ruta: /Gestion/Tabla/core/tabla.stage-policy.js
Función:
- Definir la etapa operativa actual del proceso regular.
- Considerar completos: Documentación, Prácticas, Vinculación, Inglés,
  Seguimiento a graduados y Actualización de datos.
- Considerar Académico, Financiero y Titulación como etapas posteriores.
- Exponer filtros simples: todos, fuera de etapa y cumplen etapa.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-current-stage";
  var U = window.TablaUtils || {};
  var N = window.TablaDataNormalizer || {};

  var REQUIRED_KEYS = [
    "documentacion",
    "practicasvinculacion",
    "vinculacion",
    "ingles",
    "seguimientograduados",
    "actualizaciondatos"
  ];

  var LATER_KEYS = [
    "academico",
    "financiero",
    "titulacion"
  ];

  var LABELS = {
    documentacion: "Documentación",
    practicasvinculacion: "Prácticas",
    vinculacion: "Vinculación",
    ingles: "Inglés",
    seguimientograduados: "Seguimiento a graduados",
    actualizaciondatos: "Actualización de datos",
    academico: "Académico",
    financiero: "Financiero",
    titulacion: "Titulación"
  };

  function text(value){
    return U.text
      ? U.text(value)
      : String(value == null ? "" : value).trim();
  }

  function key(value){
    return U.normalizeKey
      ? U.normalizeKey(value)
      : text(value)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "");
  }

  function requirementKey(item){
    item = item || {};
    var current = key(
      item.key ||
      item.field ||
      item.requisitoKey ||
      item.requirementKey ||
      item.label ||
      item.nombre ||
      ""
    );

    if(current === "documentacionacademica"){ return "documentacion"; }
    if(current === "practicaspreprofesionales"){ return "practicasvinculacion"; }
    if(current === "segundalengua"){ return "ingles"; }
    return current;
  }

  function statusOf(item){
    if(
      window.TablaRegularPolicy &&
      typeof window.TablaRegularPolicy.statusOf === "function"
    ){
      return window.TablaRegularPolicy.statusOf(item);
    }

    var value = item && typeof item === "object"
      ? (
          item.estado != null ? item.estado :
          item.status != null ? item.status :
          item.value != null ? item.value :
          item.valor
        )
      : item;

    if(N.statusFromValue){
      return N.statusFromValue(value);
    }

    var normalized = key(value);
    if(["cumple","cumplido","cumplida","aprobado","aprobada","si","ok","true","1"].indexOf(normalized) >= 0){
      return "cumple";
    }
    if(["noaplica","na","noaplicable"].indexOf(normalized) >= 0){
      return "no_aplica";
    }
    if(
      normalized.indexOf("nocumple") >= 0 ||
      ["no","falta","faltante","incumple","false","0"].indexOf(normalized) >= 0
    ){
      return "no_cumple";
    }
    return normalized ? "pendiente" : "sin_dato";
  }

  function requirementsFor(row){
    row = row || {};

    if(
      window.TablaFilters &&
      typeof window.TablaFilters.requirementsFor === "function"
    ){
      return window.TablaFilters.requirementsFor(row);
    }

    if(Array.isArray(row._requisitosAplicables)){
      return row._requisitosAplicables.slice();
    }

    if(Array.isArray(row._requisitos)){
      return row._requisitos.slice();
    }

    if(N.requirementsFor){
      return N.requirementsFor(row);
    }

    return [];
  }

  function analyze(row){
    var map = Object.create(null);

    requirementsFor(row).forEach(function(item){
      var id = requirementKey(item);
      if(id && !map[id]){
        map[id] = item;
      }
    });

    var complete = [];
    var incomplete = [];
    var missing = [];
    var pending = [];

    REQUIRED_KEYS.forEach(function(id){
      var item = map[id] || null;
      var status = item ? statusOf(item) : "sin_dato";

      if(status === "cumple" || status === "no_aplica"){
        complete.push(id);
        return;
      }

      incomplete.push(id);

      if(status === "no_cumple"){
        missing.push(id);
      }else{
        pending.push(id);
      }
    });

    return {
      complete: complete,
      incomplete: incomplete,
      missing: missing,
      pending: pending,
      outOfStage: incomplete.length > 0,
      compliesStage: incomplete.length === 0,
      requiredKeys: REQUIRED_KEYS.slice(),
      laterKeys: LATER_KEYS.slice()
    };
  }

  function normalizeMode(value){
    value = key(value);
    if(value === "fuera" || value === "out" || value === "fueradeetapa"){
      return "out";
    }
    if(value === "cumple" || value === "ok" || value === "cumplen"){
      return "ok";
    }
    return "all";
  }

  function matches(row, mode){
    mode = normalizeMode(mode);
    if(mode === "all"){ return true; }

    var state = analyze(row);
    return mode === "out"
      ? state.outOfStage
      : state.compliesStage;
  }

  function filter(rows, mode){
    rows = Array.isArray(rows) ? rows : [];
    return rows.filter(function(row){
      return matches(row, mode);
    });
  }

  function labelFor(id){
    return LABELS[id] || id;
  }

  function labels(ids){
    return (Array.isArray(ids) ? ids : []).map(labelFor);
  }

  window.TablaStagePolicy = {
    version: VERSION,
    requiredKeys: REQUIRED_KEYS.slice(),
    laterKeys: LATER_KEYS.slice(),
    labelsMap: Object.assign({}, LABELS),
    key: requirementKey,
    statusOf: statusOf,
    requirementsFor: requirementsFor,
    analyze: analyze,
    matches: matches,
    filter: filter,
    normalizeMode: normalizeMode,
    labelFor: labelFor,
    labels: labels
  };
})(window);

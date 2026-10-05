/* =========================================================
Nombre completo: tabla.nucleos-policy.js
Ruta: /Gestion/Tabla/core/tabla.nucleos-policy.js
Función:
- Definir la aptitud para ingresar a Núcleos.
- Exigir ocho requisitos previos completos.
- Excluir Titulación de esta validación.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-nucleos-eligibility";
  var U = window.TablaUtils || {};
  var N = window.TablaDataNormalizer || {};

  var REQUIRED_KEYS = [
    "academico",
    "documentacion",
    "practicasvinculacion",
    "vinculacion",
    "seguimientograduados",
    "ingles",
    "actualizaciondatos",
    "financiero"
  ];

  var LABELS = {
    academico: "Académico",
    documentacion: "Documentación",
    practicasvinculacion: "Prácticas preprofesionales",
    vinculacion: "Vinculación",
    seguimientograduados: "Seguimiento a graduados",
    ingles: "Inglés",
    actualizaciondatos: "Actualización de datos",
    financiero: "Financiero"
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
    if(current === "practicas"){ return "practicasvinculacion"; }
    if(current === "graduados"){ return "seguimientograduados"; }
    if(current === "segundalengua"){ return "ingles"; }
    if(current === "datos"){ return "actualizaciondatos"; }
    return current;
  }

  function statusOf(item){
    if(
      window.TablaStagePolicy &&
      typeof window.TablaStagePolicy.statusOf === "function"
    ){
      return window.TablaStagePolicy.statusOf(item);
    }

    if(N.statusFromValue){
      return N.statusFromValue(
        item && typeof item === "object"
          ? (item.estado != null ? item.estado : item.value)
          : item
      );
    }

    return key(item && typeof item === "object" ? item.estado : item);
  }

  function requirementsFor(row){
    row = row || {};

    if(N.requirementsFor){
      return N.requirementsFor(row);
    }
    if(Array.isArray(row._requisitos)){
      return row._requisitos.slice();
    }
    if(Array.isArray(row.requisitos)){
      return row.requisitos.slice();
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

    REQUIRED_KEYS.forEach(function(id){
      var item = map[id] || null;
      var status = item ? statusOf(item) : "sin_dato";

      if(status === "cumple" || status === "no_aplica"){
        complete.push(id);
      }else{
        incomplete.push(id);
      }
    });

    return {
      apto: incomplete.length === 0,
      complete: complete,
      incomplete: incomplete,
      missingLabels: incomplete.map(function(id){ return LABELS[id] || id; }),
      requiredKeys: REQUIRED_KEYS.slice()
    };
  }

  function normalizeMode(value){
    var current = key(value);
    if(["apto", "aptos", "cumple", "ok"].indexOf(current) >= 0){
      return "apto";
    }
    if(["noapto", "noaptos", "fuera", "nocumple"].indexOf(current) >= 0){
      return "no_apto";
    }
    return "";
  }

  function matches(row, mode){
    mode = normalizeMode(mode);
    if(!mode){ return true; }

    var state = analyze(row);
    return mode === "apto" ? state.apto : !state.apto;
  }

  function filter(rows, mode){
    rows = Array.isArray(rows) ? rows : [];
    return rows.filter(function(row){ return matches(row, mode); });
  }

  window.TablaNucleosPolicy = {
    version: VERSION,
    requiredKeys: REQUIRED_KEYS.slice(),
    labelsMap: Object.assign({}, LABELS),
    analyze: analyze,
    matches: matches,
    filter: filter,
    normalizeMode: normalizeMode
  };
})(window);

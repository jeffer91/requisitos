/* =========================================================
Nombre completo: tabla.regular-policy.js
Ruta: /Gestion/Tabla/core/tabla.regular-policy.js
Función:
- Aplicar la secuencia académica real de requisitos en períodos REGULARES.
- Reconocer como REGULAR únicamente Abril-Septiembre y Octubre-Marzo.
- Tratar Financiero como penúltimo requisito y Titulación como último.
- Evitar considerar Titulación como faltante mientras exista un requisito previo sin cumplir.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-regular-sequence";
  var N = window.TablaDataNormalizer || {};
  var U = window.TablaUtils || {};

  var ORDER = {
    academico: 10,
    documentacion: 20,
    documentacionacademica: 20,
    practicasvinculacion: 30,
    practicaspreprofesionales: 30,
    vinculacion: 40,
    seguimientograduados: 50,
    ingles: 60,
    segundalengua: 60,
    actualizaciondatos: 70,
    financiero: 80,
    titulacion: 90
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

  function array(value){
    return Array.isArray(value) ? value : [];
  }

  function requirementKey(item){
    item = item || {};
    return key(
      item.key ||
      item.field ||
      item.requisitoKey ||
      item.requirementKey ||
      item.label ||
      item.nombre ||
      ""
    );
  }

  function statusOf(item){
    var value = item;
    if(item && typeof item === "object"){
      value =
        item.estado != null ? item.estado :
        item.status != null ? item.status :
        item.value != null ? item.value :
        item.valor;
    }

    if(N.statusFromValue){
      return N.statusFromValue(value);
    }

    var normalized = key(value);
    if(["cumple","cumplido","cumplida","si","ok","true","1","aprobado","aprobada"].indexOf(normalized) >= 0){
      return "cumple";
    }
    if(["noaplica","na","noaplicable"].indexOf(normalized) >= 0){
      return "no_aplica";
    }
    if(
      normalized.indexOf("nocumple") >= 0 ||
      ["no","falta","faltante","incumple","false","0","reprobado","reprobada"].indexOf(normalized) >= 0
    ){
      return "no_cumple";
    }
    return normalized ? "pendiente" : "sin_dato";
  }

  function isRegular(row){
    row = row || {};
    if(row._esRegular === true){ return true; }
    if(row._esPVC === true){ return false; }

    if(N.classifyStudent){
      try{
        return N.classifyStudent(row).isRegular === true;
      }catch(error){}
    }

    var source = text(
      row._periodo ||
      row.periodoLabel ||
      row.periodo ||
      row._periodoId ||
      row.periodoId ||
      ""
    )
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    var byText =
      (source.indexOf("abril") >= 0 && source.indexOf("septiembre") >= 0) ||
      (source.indexOf("octubre") >= 0 && source.indexOf("marzo") >= 0);

    var byId =
      /20\d{2}[^0-9]*04.*20\d{2}[^0-9]*09/.test(source) ||
      /20\d{2}[^0-9]*10.*20\d{2}[^0-9]*03/.test(source);

    return byText || byId;
  }

  function requirementsFor(row){
    row = row || {};

    var rows = Array.isArray(row._requisitosAplicables)
      ? row._requisitosAplicables
      : Array.isArray(row._requisitos)
        ? row._requisitos
        : N.requirementsFor
          ? N.requirementsFor(row)
          : [];

    return array(rows).filter(function(item){
      if(!item){ return false; }
      if(item.applies === false){ return false; }
      if(statusOf(item) === "no_aplica"){ return false; }
      if(N.isFinalRequirement && N.isFinalRequirement(item)){ return false; }
      if(!isRegular(row) && requirementKey(item) === "titulacion"){ return false; }
      return true;
    });
  }

  function ordered(items){
    return array(items)
      .slice()
      .sort(function(a,b){
        var ak = requirementKey(a);
        var bk = requirementKey(b);
        return (ORDER[ak] || 500) - (ORDER[bk] || 500);
      });
  }

  function analyze(row){
    var requirements = ordered(requirementsFor(row));
    var regular = isRegular(row);
    var titulation = null;
    var prior = [];

    requirements.forEach(function(item){
      if(requirementKey(item) === "titulacion"){
        titulation = item;
      }else{
        prior.push(item);
      }
    });

    var priorBlocking = prior.filter(function(item){
      return statusOf(item) !== "cumple";
    });

    var priorMissing = prior.filter(function(item){
      return statusOf(item) === "no_cumple";
    });

    var titulationBlocked = !!(
      regular &&
      titulation &&
      priorBlocking.length
    );

    var missing = requirements.filter(function(item){
      if(statusOf(item) !== "no_cumple"){ return false; }
      if(requirementKey(item) === "titulacion" && titulationBlocked){ return false; }
      return true;
    });

    return {
      regular: regular,
      pvc: !regular,
      requirements: requirements,
      prior: prior,
      priorBlocking: ordered(priorBlocking),
      priorMissing: ordered(priorMissing),
      titulation: titulation,
      titulationBlocked: titulationBlocked,
      missing: ordered(missing)
    };
  }

  function isEffectiveMissing(row, item){
    if(statusOf(item) !== "no_cumple"){ return false; }

    if(requirementKey(item) !== "titulacion"){
      return true;
    }

    var state = analyze(row);
    return state.regular && !state.titulationBlocked;
  }

  window.TablaRegularPolicy = {
    version: VERSION,
    order: Object.assign({}, ORDER),
    key: requirementKey,
    statusOf: statusOf,
    isRegular: isRegular,
    requirementsFor: requirementsFor,
    ordered: ordered,
    analyze: analyze,
    isEffectiveMissing: isEffectiveMissing
  };
})(window);

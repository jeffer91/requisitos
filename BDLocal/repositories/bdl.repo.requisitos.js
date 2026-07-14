/* =========================================================
Nombre completo: bdl.repo.requisitos.js
Ruta o ubicación: /BDLocal/repositories/bdl.repo.requisitos.js
Función o funciones:
- Administrar requisitos_estudiante como fuente principal.
- Usar requisitos legacy solo como fallback.
- Aplicar la regla central de identificación validada.
- Forzar IDs derivados de cedula__periodoId.
- Consolidar duplicados por cédula, período y requisito.
- Priorizar siempre el registro actualizado más recientemente.
- Mantener los alias requeridos por Ficha, Tabla, Stats, Coordi y Global.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.0-latest-wins";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function normalizeKey(value){
    var utils = window.BL2Config && window.BL2Config.utils;

    return utils && typeof utils.normalizeKey === "function"
      ? utils.normalizeKey(value)
      : text(value)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");
  }

  function normalizeCedula(value){
    var rules = window.BDLRulesPersona;

    if(rules && typeof rules.normalizeCedula === "function"){
      return rules.normalizeCedula(value);
    }

    var utils = window.BL2Config && window.BL2Config.utils;

    if(utils && typeof utils.normalizeCedula === "function"){
      return utils.normalizeCedula(value);
    }

    var result = text(value)
      .replace(/[^0-9A-Za-z]/g, "")
      .toUpperCase();

    return /^\d{9}$/.test(result)
      ? "0" + result
      : result;
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

  function studentId(periodoId, cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);

    return periodoId && cedula
      ? cedula + "__" + periodoId
      : "";
  }

  function requirementId(periodoId, cedula, requisitoKey){
    var base = studentId(periodoId, cedula);
    var key = normalizeKey(requisitoKey || "requisito");

    return base && key
      ? base + "__" + key
      : "";
  }

  function store(){
    return Repos.storeName(
      "requisitosEstudiante",
      "requisitos_estudiante"
    );
  }

  function legacyStore(){
    return Repos.storeName(
      "requisitos",
      "requisitos"
    );
  }

  function firstValue(row, fields){
    row = row || {};
    fields = fields || [];

    for(var i = 0; i < fields.length; i += 1){
      if(
        row[fields[i]] !== undefined &&
        row[fields[i]] !== null &&
        text(row[fields[i]]) !== ""
      ){
        return row[fields[i]];
      }
    }

    return "";
  }

  function normalize(row){
    row = Object.assign({}, row || {});

    var periodoId = canonicalPeriodId(
      firstValue(row, [
        "periodoId",
        "periodId",
        "periodoCanonicoId",
        "ultimoPeriodoId",
        "idPeriodo",
        "_periodoId",
        "_bl2PeriodoId"
      ])
    );

    var cedula = normalizeCedula(
      firstValue(row, [
        "cedula",
        "numeroIdentificacion",
        "NumeroIdentificacion",
        "identificacion",
        "Identificacion",
        "Cedula",
        "Cédula",
        "_cedula"
      ])
    );

    var rawKey = firstValue(row, [
      "requisitoKey",
      "requirementKey",
      "key",
      "campo",
      "field",
      "nombre",
      "codigo",
      "requisitoLabel",
      "requisitoNombre"
    ]) || "requisito";

    var requisitoKey = normalizeKey(rawKey);
    var baseId = studentId(periodoId, cedula);
    var id = requirementId(
      periodoId,
      cedula,
      requisitoKey
    ) || text(row.id || "");

    var value = firstValue(row, [
      "valor",
      "value",
      "estado",
      "cumple",
      "aprobado",
      "resultado"
    ]);

    var displayKey = text(
      firstValue(row, [
        "key",
        "nombre",
        "requirementKey",
        "requisitoKey"
      ]) || rawKey
    );

    return Object.assign({}, row, {
      id: id,
      idEstudiantePeriodo: baseId,
      studentId: baseId,
      periodoId: periodoId,
      periodId: periodoId,
      periodoCanonicoId: periodoId,
      ultimoPeriodoId: periodoId,
      cedula: cedula,
      numeroIdentificacion: cedula,
      requisitoKey: requisitoKey,
      requirementKey: requisitoKey,
      key: text(row.key || displayKey || requisitoKey),
      nombre: text(row.nombre || displayKey || requisitoKey),
      estado: text(value),
      valor: text(value),
      updatedAt:
        text(row.updatedAt) ||
        text(row.fechaRegistro) ||
        text(row.createdAt) ||
        new Date().toISOString()
    });
  }

  function timeValue(row){
    row = row || {};

    var raw =
      text(row.updatedAt) ||
      text(row.fechaRegistro) ||
      text(row.createdAt) ||
      "";

    var parsed = raw ? Date.parse(raw) : NaN;

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function currentShapeScore(row){
    row = row || {};

    var score = 0;

    if(text(row.idEstudiantePeriodo)){ score += 4; }
    if(text(row.studentId)){ score += 3; }
    if(text(row.key)){ score += 2; }
    if(text(row.label)){ score += 2; }
    if(text(row.nombre)){ score += 1; }
    if(text(row.valor)){ score += 2; }
    if(text(row.source) === "v2_mirror"){ score += 2; }
    if(text(row.origen) === "BDLocal"){ score -= 1; }
    if(text(row.payloadJson)){ score -= 2; }
    if(text(row.origenCampo)){ score -= 1; }

    return score;
  }

  function isBetter(candidate, current){
    if(!current){
      return true;
    }

    var candidateTime = timeValue(candidate);
    var currentTime = timeValue(current);

    if(candidateTime !== currentTime){
      return candidateTime > currentTime;
    }

    var candidateScore = currentShapeScore(candidate);
    var currentScore = currentShapeScore(current);

    if(candidateScore !== currentScore){
      return candidateScore > currentScore;
    }

    var candidateHasValue = text(
      candidate && (candidate.valor || candidate.estado)
    ) !== "";

    var currentHasValue = text(
      current && (current.valor || current.estado)
    ) !== "";

    if(candidateHasValue !== currentHasValue){
      return candidateHasValue;
    }

    return false;
  }

  function dedupe(rows){
    var byId = Object.create(null);
    var order = [];

    (Array.isArray(rows) ? rows : [])
      .map(normalize)
      .forEach(function(row){
        var key =
          requirementId(
            row.periodoId,
            row.cedula,
            row.requisitoKey
          ) ||
          text(row.id);

        if(!key){
          return;
        }

        if(!Object.prototype.hasOwnProperty.call(byId, key)){
          order.push(key);
          byId[key] = row;
          return;
        }

        if(isBetter(row, byId[key])){
          byId[key] = row;
        }
      });

    return order.map(function(key){
      return byId[key];
    });
  }

  function applyFilters(rows, options){
    options = options || {};
    rows = dedupe(rows);

    var periodoId = canonicalPeriodId(
      options.periodoId || options.periodId || ""
    );

    var cedula = normalizeCedula(
      options.cedula || options.numeroIdentificacion || ""
    );

    var idEstudiantePeriodo = text(
      options.idEstudiantePeriodo || options.studentId || ""
    );

    var requisitoKey = normalizeKey(
      options.requisitoKey ||
      options.requirementKey ||
      options.key ||
      ""
    );

    if(periodoId){
      rows = rows.filter(function(row){
        return row.periodoId === periodoId;
      });
    }

    if(cedula){
      rows = rows.filter(function(row){
        return row.cedula === cedula;
      });
    }

    if(idEstudiantePeriodo){
      rows = rows.filter(function(row){
        return row.idEstudiantePeriodo === idEstudiantePeriodo;
      });
    }

    if(requisitoKey){
      rows = rows.filter(function(row){
        return row.requisitoKey === requisitoKey;
      });
    }

    return rows;
  }

  function list(options){
    options = options || {};

    return Repos.safeGetAll(store())
      .then(function(rows){
        rows = applyFilters(rows, options);

        if(rows.length){
          return rows;
        }

        return Repos.safeGetAll(legacyStore())
          .then(function(legacyRows){
            return applyFilters(
              legacyRows,
              options
            );
          });
      });
  }

  function save(row){
    var item = normalize(row);

    if(!item.id){
      return Promise.reject(
        new Error(
          "Requisito sin identificación, período o clave."
        )
      );
    }

    return Repos.safePut(store(), item);
  }

  function saveMany(rows){
    var items = dedupe(
      Array.isArray(rows) ? rows : []
    ).filter(function(row){
      return !!row.id;
    });

    return items.length
      ? Repos.bulkPut(store(), items)
      : Promise.resolve([]);
  }

  var api = {
    version: VERSION,
    list: list,
    save: save,
    saveMany: saveMany,
    normalize: normalize,
    dedupe: dedupe,
    studentId: studentId,
    requirementId: requirementId
  };

  Repos.register("requisitos", api);
  Repos.register("requisitos_estudiante", api);
  window.BDLRepoRequisitos = api;
})(window);

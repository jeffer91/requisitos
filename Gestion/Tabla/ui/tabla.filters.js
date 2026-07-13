/* =========================================================
Nombre completo: tabla.filters.js
Ruta: /Gestion/Tabla/ui/tabla.filters.js
Función:
- Aplicar filtros por período, división, matrícula, carrera, estado y búsqueda.
- Filtrar requisitos únicamente cuando existe un no_cumple real.
- No tratar sin_dato, pendiente o no_aplica como deuda.
- Excluir Titulación para PVC y excluir campos finales en todos los períodos.
- Construir opciones y resúmenes sin acceder directamente a Base Local.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "3.0.0-real-missing-only";
  var C = window.TablaConstants || {};
  var U = window.TablaUtils || {};
  var N = window.TablaDataNormalizer || {};

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

  function canonicalPeriod(value){
    return U.canonicalPeriodId
      ? U.canonicalPeriodId(value)
      : text(value);
  }

  function samePeriod(a, b){
    if(U.samePeriod){
      return U.samePeriod(a, b);
    }

    return !text(b) || canonicalPeriod(a) === canonicalPeriod(b);
  }

  function normalizeStatus(value){
    if(value && typeof value === "object"){
      value =
        value.estado != null ? value.estado :
        value.status != null ? value.status :
        value.value != null ? value.value :
        value.key != null ? value.key :
        value.label;
    }

    var clean = key(value);

    if([
      "cumple", "cumpletodo", "ok", "aprobado", "aprobada",
      "completo", "completa", "validado", "validada"
    ].indexOf(clean) >= 0){
      return "cumple";
    }

    if([
      "nocumple", "fallido", "fallida", "reprobado", "reprobada",
      "falta", "faltante", "incumple", "incompleto", "incompleta"
    ].indexOf(clean) >= 0){
      return "no_cumple";
    }

    if([
      "noaplica", "na", "noaplicable"
    ].indexOf(clean) >= 0){
      return "no_aplica";
    }

    if([
      "sindato", "sinvalor", "vacio", "vacia"
    ].indexOf(clean) >= 0){
      return "sin_dato";
    }

    return "pendiente";
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

  function isFinalRequirement(item){
    if(N.isFinalRequirement){
      return N.isFinalRequirement(item);
    }

    return array(C.periodPolicy && C.periodPolicy.finalKeys)
      .map(key)
      .indexOf(requirementKey(item)) >= 0;
  }

  function rowIsPVC(row){
    row = row || {};

    if(row._esPVC === true){ return true; }
    if(row._esRegular === true){ return false; }

    if(N.classifyStudent){
      return N.classifyStudent(row).isPVC === true;
    }

    return key(row._tipoPeriodo) === "pvc";
  }

  function requirementApplies(row, item){
    item = item || {};

    if(item.applies === false){ return false; }
    if(normalizeStatus(item.estado || item.status || item.value) === "no_aplica"){
      return false;
    }
    if(isFinalRequirement(item)){ return false; }
    if(rowIsPVC(row) && requirementKey(item) === "titulacion"){
      return false;
    }

    return true;
  }

  function requirementsFor(row){
    row = row || {};

    var requirements = Array.isArray(row._requisitosAplicables)
      ? row._requisitosAplicables
      : Array.isArray(row._requisitos)
        ? row._requisitos
        : N.requirementsFor
          ? N.requirementsFor(row)
          : [];

    return array(requirements).filter(function(item){
      return requirementApplies(row, item);
    });
  }

  function isTrueMissing(row, item){
    if(!requirementApplies(row, item)){ return false; }

    return normalizeStatus(
      item && (
        item.estado != null ? item.estado :
        item.status != null ? item.status :
        item.value
      )
    ) === "no_cumple";
  }

  function missingFor(row){
    row = row || {};

    var source = Array.isArray(row._requisitosFaltantes)
      ? row._requisitosFaltantes
      : requirementsFor(row);

    return array(source).filter(function(item){
      return isTrueMissing(row, item);
    });
  }

  function noDataFor(row){
    return requirementsFor(row).filter(function(item){
      var status = normalizeStatus(item.estado || item.status || item.value);
      return status === "sin_dato" || status === "pendiente";
    });
  }

  function rowStatus(row){
    row = row || {};
    var requirements = requirementsFor(row);

    if(N.generalStatus && requirements.length){
      var official = normalizeStatus(N.generalStatus(requirements));
      return official === "sin_dato" || official === "no_aplica"
        ? "pendiente"
        : official;
    }

    if(missingFor(row).length){
      return "no_cumple";
    }

    if(noDataFor(row).length || !requirements.length){
      return "pendiente";
    }

    if(requirements.every(function(item){
      return normalizeStatus(item.estado || item.status || item.value) === "cumple";
    })){
      return "cumple";
    }

    var stored = normalizeStatus(row._estadoGeneral);
    return stored === "sin_dato" || stored === "no_aplica"
      ? "pendiente"
      : stored;
  }

  function rowPeriodId(row){
    row = row || {};
    return canonicalPeriod(
      row._periodoId ||
      row.periodoCanonicoId ||
      row.periodoId ||
      row.periodId ||
      row._bl2PeriodoId ||
      ""
    );
  }

  function rowDivision(row){
    return text(row && (
      row._division ||
      row._bl2Division ||
      row.division ||
      row.Division ||
      row["División"]
    )) || "Sin división";
  }

  function rowCareer(row){
    return text(row && (
      row._carrera ||
      row.NombreCarrera ||
      row.nombreCarrera ||
      row.carrera ||
      row.Carrera
    ));
  }

  function rowMatricula(row){
    var value = text(row && (
      row._matricula ||
      row._estadoMatricula ||
      row.estadoMatricula ||
      row.matricula ||
      row.Matricula ||
      row["Matrícula"]
    ));

    return N.normalizeMatricula
      ? N.normalizeMatricula(value)
      : value.toUpperCase() || "ACTIVO";
  }

  function hasRequirementMissing(row, wantedKey){
    wantedKey = key(wantedKey);

    if(!wantedKey){ return true; }
    if(wantedKey === "falta"){
      return missingFor(row).length > 0;
    }

    return requirementsFor(row).some(function(item){
      var aliases = array(item.aliases).map(key);
      var matchesKey =
        requirementKey(item) === wantedKey ||
        aliases.indexOf(wantedKey) >= 0;

      return matchesKey && isTrueMissing(row, item);
    });
  }

  function searchableText(row){
    row = row || {};

    if(text(row._search)){
      return text(row._search).toLowerCase();
    }

    return [
      row._cedula,
      row.cedula,
      row.numeroIdentificacion,
      row._nombres,
      row.Nombres,
      row._carrera,
      row.NombreCarrera,
      row._division,
      row._periodo,
      row._tipoPeriodo,
      row._correo,
      row.CorreoPersonal,
      row.CorreoInstitucional,
      row._celular,
      row.Celular,
      row._telegramUser,
      row._telegramChatId
    ].map(text).join(" ").toLowerCase();
  }

  function normalizeFilters(filters){
    filters = filters || {};

    var rawStatus = text(filters.status || filters.estado || "");

    return {
      periodId: canonicalPeriod(
        filters.periodId || filters.periodoId || ""
      ),
      division: text(filters.division),
      matricula: text(filters.matricula),
      career: text(filters.career || filters.carrera),
      status: normalizeStatus(rawStatus),
      hasStatus: !!rawStatus,
      search: text(filters.search || filters.query).toLowerCase(),
      requirements: array(
        filters.requirements || filters.requisitos
      ).map(key).filter(Boolean)
    };
  }

  function matches(row, filters){
    filters = normalizeFilters(filters);

    if(filters.periodId && !samePeriod(rowPeriodId(row), filters.periodId)){
      return false;
    }

    if(filters.division && key(rowDivision(row)) !== key(filters.division)){
      return false;
    }

    if(filters.matricula && key(rowMatricula(row)) !== key(filters.matricula)){
      return false;
    }

    if(filters.career && key(rowCareer(row)) !== key(filters.career)){
      return false;
    }

    if(filters.hasStatus && rowStatus(row) !== filters.status){
      return false;
    }

    if(filters.search && searchableText(row).indexOf(filters.search) < 0){
      return false;
    }

    if(
      filters.requirements.length &&
      !filters.requirements.some(function(requirement){
        return hasRequirementMissing(row, requirement);
      })
    ){
      return false;
    }

    return true;
  }

  function apply(rows, filters){
    return array(rows).filter(function(row){
      return matches(row, filters || {});
    });
  }

  function baseForOptions(rows, filters){
    filters = filters || {};

    return apply(rows, {
      periodId: filters.periodId || filters.periodoId || "",
      matricula: filters.matricula || "",
      search: "",
      status: "",
      requirements: []
    });
  }

  function uniqueSorted(values){
    var map = Object.create(null);

    array(values).forEach(function(value){
      value = text(value);
      if(value){ map[key(value)] = value; }
    });

    return Object.keys(map)
      .map(function(itemKey){ return map[itemKey]; })
      .sort(function(a, b){
        return a.localeCompare(b, "es", {sensitivity: "base"});
      });
  }

  function options(rows, filters){
    filters = filters || {};

    var base = baseForOptions(rows, filters);
    var divisions = uniqueSorted(base.map(rowDivision));
    var division = text(filters.division);

    var careerRows = division
      ? base.filter(function(row){
          return key(rowDivision(row)) === key(division);
        })
      : base;

    var careers = uniqueSorted(careerRows.map(rowCareer));
    var career = text(filters.career || filters.carrera);

    if(division && divisions.map(key).indexOf(key(division)) < 0){
      divisions = uniqueSorted(divisions.concat([division]));
    }

    if(career && careers.map(key).indexOf(key(career)) < 0){
      careers = uniqueSorted(careers.concat([career]));
    }

    return {
      divisions: divisions,
      careers: careers
    };
  }

  function summary(rows){
    rows = array(rows);

    var result = {
      total: rows.length,
      cumple: 0,
      pendiente: 0,
      no_cumple: 0,
      carreras: 0,
      conTelegram: 0,
      conChatId: 0,
      faltantes: 0,
      sinDato: 0
    };

    var careers = Object.create(null);

    rows.forEach(function(row){
      var status = rowStatus(row);
      var career = rowCareer(row);

      if(status === "cumple"){
        result.cumple += 1;
      }else if(status === "no_cumple"){
        result.no_cumple += 1;
      }else{
        result.pendiente += 1;
      }

      if(career){ careers[key(career)] = true; }
      if(text(row._telegramUser) || text(row._telegramChatId)){
        result.conTelegram += 1;
      }
      if(text(row._telegramChatId)){
        result.conChatId += 1;
      }
      if(missingFor(row).length){
        result.faltantes += 1;
      }
      if(noDataFor(row).length){
        result.sinDato += 1;
      }
    });

    result.carreras = Object.keys(careers).length;
    return result;
  }

  window.TablaFilters = {
    version: VERSION,
    normalize: normalizeFilters,
    matches: matches,
    apply: apply,
    options: options,
    summary: summary,
    rowStatus: rowStatus,
    rowPeriodId: rowPeriodId,
    rowDivision: rowDivision,
    rowCareer: rowCareer,
    rowMatricula: rowMatricula,
    requirementsFor: requirementsFor,
    missingFor: missingFor,
    noDataFor: noDataFor,
    hasRequirementMissing: hasRequirementMissing
  };
})(window);

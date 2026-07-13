/* =========================================================
Nombre completo: tabla.filters.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/ui/tabla.filters.js
Función o funciones:
- Aplicar los filtros funcionales de la pantalla Tabla.
- Filtrar por período, división, matrícula, carrera, estado, búsqueda y requisitos.
- Construir las opciones de división y carrera sin acceder directamente a BDLocal.
- Calcular el resumen de los estudiantes filtrados.
Con qué se conecta:
- tabla.constants.js
- tabla.utils.js
- tabla.data-normalizer.js
- tabla.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0";
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
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "");
  }

  function array(value){
    return Array.isArray(value)
      ? value
      : [];
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

    return (
      !text(b) ||
      canonicalPeriod(a) === canonicalPeriod(b)
    );
  }

  function normalizeStatus(value){
    if(
      value &&
      typeof value === "object"
    ){
      value =
        value.value ||
        value.key ||
        value.estado ||
        value.label ||
        "";
    }

    var clean = key(value);

    if(
      clean === "cumple" ||
      clean === "cumpletodo" ||
      clean === "ok" ||
      clean === "aprobado"
    ){
      return "cumple";
    }

    if(
      clean === "nocumple" ||
      clean === "no_cumple" ||
      clean === "fallido" ||
      clean === "reprobado"
    ){
      return "no_cumple";
    }

    return "pendiente";
  }

  function rowStatus(row){
    row = row || {};

    if(
      row._estadoGeneral != null &&
      text(row._estadoGeneral) !== ""
    ){
      return normalizeStatus(
        row._estadoGeneral
      );
    }

    var requirements =
      requirementsFor(row);

    if(N.generalStatus){
      return normalizeStatus(
        N.generalStatus(requirements)
      );
    }

    if(!requirements.length){
      return "pendiente";
    }

    if(
      requirements.every(
        function(item){
          return (
            normalizeStatus(
              item.estado
            ) === "cumple"
          );
        }
      )
    ){
      return "cumple";
    }

    if(
      requirements.some(
        function(item){
          return (
            normalizeStatus(
              item.estado
            ) === "no_cumple"
          );
        }
      )
    ){
      return "no_cumple";
    }

    return "pendiente";
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
    return text(
      row &&
      (
        row._division ||
        row._bl2Division ||
        row.division ||
        row.Division ||
        row["División"]
      )
    ) || "Sin división";
  }

  function rowCareer(row){
    return text(
      row &&
      (
        row._carrera ||
        row.NombreCarrera ||
        row.nombreCarrera ||
        row.carrera ||
        row.Carrera
      )
    );
  }

  function rowMatricula(row){
    var value = text(
      row &&
      (
        row._matricula ||
        row._estadoMatricula ||
        row.estadoMatricula ||
        row.matricula ||
        row.Matricula ||
        row["Matrícula"]
      )
    );

    if(N.normalizeMatricula){
      return N.normalizeMatricula(value);
    }

    return (
      value.toUpperCase() ||
      "ACTIVO"
    );
  }

  function requirementsFor(row){
    row = row || {};

    if(
      Array.isArray(
        row._requisitos
      )
    ){
      return row._requisitos;
    }

    if(N.requirementsFor){
      return N.requirementsFor(row);
    }

    return [];
  }

  function missingFor(row){
    row = row || {};

    if(
      Array.isArray(
        row._requisitosFaltantes
      )
    ){
      return row._requisitosFaltantes;
    }

    if(N.missingRequirements){
      return N.missingRequirements(row);
    }

    return requirementsFor(row)
      .filter(function(item){
        return (
          normalizeStatus(
            item.estado
          ) !== "cumple"
        );
      });
  }

  function hasRequirementMissing(
    row,
    requirementKey
  ){
    requirementKey =
      key(requirementKey);

    if(!requirementKey){
      return true;
    }

    if(requirementKey === "falta"){
      return (
        missingFor(row).length > 0
      );
    }

    return requirementsFor(row)
      .some(function(item){
        var itemKey = key(
          item.key ||
          item.field ||
          item.label
        );

        var aliases =
          array(item.aliases)
            .map(key);

        return (
          (
            itemKey ===
              requirementKey ||
            aliases.indexOf(
              requirementKey
            ) >= 0
          ) &&
          normalizeStatus(
            item.estado ||
            item.value
          ) !== "cumple"
        );
      });
  }

  function searchableText(row){
    row = row || {};

    if(text(row._search)){
      return text(
        row._search
      ).toLowerCase();
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
      row._correo,
      row.CorreoPersonal,
      row.CorreoInstitucional,
      row._celular,
      row.Celular,
      row._telegramUser,
      row._telegramChatId
    ]
      .map(text)
      .join(" ")
      .toLowerCase();
  }

  function normalizeFilters(filters){
    filters = filters || {};

    return {
      periodId:
        canonicalPeriod(
          filters.periodId ||
          filters.periodoId ||
          ""
        ),

      division:
        text(filters.division),

      matricula:
        text(filters.matricula),

      career:
        text(
          filters.career ||
          filters.carrera
        ),

      status:
        normalizeStatus(
          filters.status ||
          filters.estado ||
          ""
        ),

      hasStatus:
        !!text(
          filters.status ||
          filters.estado
        ),

      search:
        text(
          filters.search ||
          filters.query
        ).toLowerCase(),

      requirements:
        array(
          filters.requirements ||
          filters.requisitos
        )
          .map(key)
          .filter(Boolean)
    };
  }

  function matches(row, filters){
    filters =
      normalizeFilters(filters);

    if(
      filters.periodId &&
      !samePeriod(
        rowPeriodId(row),
        filters.periodId
      )
    ){
      return false;
    }

    if(
      filters.division &&
      key(rowDivision(row)) !==
        key(filters.division)
    ){
      return false;
    }

    if(
      filters.matricula &&
      key(rowMatricula(row)) !==
        key(filters.matricula)
    ){
      return false;
    }

    if(
      filters.career &&
      key(rowCareer(row)) !==
        key(filters.career)
    ){
      return false;
    }

    if(
      filters.hasStatus &&
      rowStatus(row) !==
        filters.status
    ){
      return false;
    }

    if(
      filters.search &&
      searchableText(row)
        .indexOf(
          filters.search
        ) < 0
    ){
      return false;
    }

    if(
      filters.requirements.length &&
      !filters.requirements.some(
        function(requirementKey){
          return hasRequirementMissing(
            row,
            requirementKey
          );
        }
      )
    ){
      return false;
    }

    return true;
  }

  function apply(rows, filters){
    return array(rows)
      .filter(function(row){
        return matches(
          row,
          filters || {}
        );
      });
  }

  function baseForOptions(
    rows,
    filters
  ){
    filters = filters || {};

    return apply(rows, {
      periodId:
        filters.periodId ||
        filters.periodoId ||
        "",

      matricula:
        filters.matricula ||
        "",

      search:
        "",

      status:
        "",

      requirements:
        []
    });
  }

  function uniqueSorted(values){
    var map =
      Object.create(null);

    array(values)
      .forEach(function(value){
        value = text(value);

        if(value){
          map[key(value)] = value;
        }
      });

    return Object.keys(map)
      .map(function(itemKey){
        return map[itemKey];
      })
      .sort(function(a, b){
        return a.localeCompare(
          b,
          "es",
          {
            sensitivity: "base"
          }
        );
      });
  }

  function options(rows, filters){
    filters = filters || {};

    var base =
      baseForOptions(
        rows,
        filters
      );

    var divisions =
      uniqueSorted(
        base.map(rowDivision)
      );

    var division =
      text(filters.division);

    var careerRows =
      division
        ? base.filter(
            function(row){
              return (
                key(
                  rowDivision(row)
                ) ===
                key(division)
              );
            }
          )
        : base;

    var careers =
      uniqueSorted(
        careerRows.map(
          rowCareer
        )
      );

    if(
      division &&
      divisions
        .map(key)
        .indexOf(
          key(division)
        ) < 0
    ){
      divisions.push(division);
      divisions =
        uniqueSorted(divisions);
    }

    var career = text(
      filters.career ||
      filters.carrera
    );

    if(
      career &&
      careers
        .map(key)
        .indexOf(
          key(career)
        ) < 0
    ){
      careers.push(career);
      careers =
        uniqueSorted(careers);
    }

    return {
      divisions:
        divisions,

      careers:
        careers
    };
  }

  function summary(rows){
    rows = array(rows);

    var result = {
      total:
        rows.length,

      cumple:
        0,

      pendiente:
        0,

      no_cumple:
        0,

      carreras:
        0,

      conTelegram:
        0,

      conChatId:
        0,

      faltantes:
        0
    };

    var careers =
      Object.create(null);

    rows.forEach(function(row){
      var status =
        rowStatus(row);

      var career =
        rowCareer(row);

      if(status === "cumple"){
        result.cumple += 1;
      }else if(
        status === "no_cumple"
      ){
        result.no_cumple += 1;
      }else{
        result.pendiente += 1;
      }

      if(career){
        careers[key(career)] =
          true;
      }

      if(
        text(row._telegramUser) ||
        text(row._telegramChatId)
      ){
        result.conTelegram += 1;
      }

      if(
        text(row._telegramChatId)
      ){
        result.conChatId += 1;
      }

      if(
        missingFor(row).length
      ){
        result.faltantes += 1;
      }
    });

    result.carreras =
      Object.keys(careers)
        .length;

    return result;
  }

  window.TablaFilters = {
    version:
      VERSION,

    normalize:
      normalizeFilters,

    matches:
      matches,

    apply:
      apply,

    options:
      options,

    summary:
      summary,

    rowStatus:
      rowStatus,

    rowPeriodId:
      rowPeriodId,

    rowDivision:
      rowDivision,

    rowCareer:
      rowCareer,

    rowMatricula:
      rowMatricula,

    requirementsFor:
      requirementsFor,

    missingFor:
      missingFor,

    hasRequirementMissing:
      hasRequirementMissing
  };
})(window);
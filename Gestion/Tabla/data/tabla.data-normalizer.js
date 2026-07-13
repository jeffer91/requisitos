/* =========================================================
Nombre completo: tabla.data-normalizer.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/data/tabla.data-normalizer.js
Función o funciones:
- Normalizar períodos, estudiantes, requisitos y datos de contacto.
- Crear los campos internos usados por Tabla sin alterar los datos originales.
- Unificar estados de matrícula, requisitos, Telegram y búsqueda.
- Vincular los requisitos separados de BDLocal con cada estudiante.
Con qué se conecta:
- tabla.constants.js
- tabla.utils.js
- BLDivisionesService y BLCampos cuando están disponibles.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.1";

  var C =
    window.TablaConstants ||
    {};

  var U =
    window.TablaUtils ||
    {};

  var ALIASES =
    C.aliases ||
    {};

  var REQUIREMENTS =
    Array.isArray(C.requirements)
      ? C.requirements
      : [];

  function text(value){
    return U.text
      ? U.text(value)
      : String(
          value == null
            ? ""
            : value
        ).trim();
  }

  function key(value){
    return U.normalizeKey
      ? U.normalizeKey(value)
      : text(value)
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            ""
          );
  }

  function pick(
    row,
    aliases,
    fallback
  ){
    return U.pick
      ? U.pick(
          row,
          aliases,
          fallback
        )
      : fallback;
  }

  function statusFromValue(value){
    var clean = key(value);

    if(!clean){
      return "pendiente";
    }

    if(
      [
        "si",
        "s",
        "ok",
        "cumple",
        "cumplido",
        "aprobado",
        "aprobada",
        "1",
        "true",
        "x",
        "validado",
        "validada",
        "completo",
        "completa"
      ].indexOf(clean) >= 0
    ){
      return "cumple";
    }

    if(
      clean.indexOf(
        "nocumple"
      ) >= 0 ||
      clean.indexOf(
        "reprob"
      ) >= 0 ||
      [
        "no",
        "n",
        "0",
        "false",
        "falta",
        "faltante",
        "incompleto",
        "incompleta"
      ].indexOf(clean) >= 0
    ){
      return "no_cumple";
    }

    return "pendiente";
  }

  function requirementValueFromList(
    row,
    definition
  ){
    row = row || {};
    definition = definition || {};

    var list =
      Array.isArray(row.requisitos)
        ? row.requisitos
        : Array.isArray(row.requirements)
          ? row.requirements
          : Array.isArray(row._requisitos)
            ? row._requisitos
            : [];

    if(!list.length){
      return "";
    }

    var acceptedKeys = [
      definition.key,
      definition.field,
      definition.label
    ]
      .concat(
        Array.isArray(
          definition.aliases
        )
          ? definition.aliases
          : []
      )
      .map(function(value){
        return key(value);
      })
      .filter(Boolean);

    for(
      var index = 0;
      index < list.length;
      index += 1
    ){
      var item =
        list[index] ||
        {};

      var itemKeys = [
        item.requisitoKey,
        item.key,
        item.nombre,
        item.label,
        item.field
      ]
        .map(function(value){
          return key(value);
        })
        .filter(Boolean);

      var matches =
        itemKeys.some(function(itemKey){
          return (
            acceptedKeys.indexOf(
              itemKey
            ) >= 0
          );
        });

      if(!matches){
        continue;
      }

      var value =
        item.valor != null &&
        text(item.valor) !== ""
          ? item.valor
          : item.estado != null &&
            text(item.estado) !== ""
            ? item.estado
            : item.value != null &&
              text(item.value) !== ""
              ? item.value
              : item.status;

      if(
        value != null &&
        text(value) !== ""
      ){
        return value;
      }
    }

    return "";
  }

  function requirementValue(
    row,
    definition
  ){
    var valueFromList =
      requirementValueFromList(
        row,
        definition
      );

    if(
      text(valueFromList) !== ""
    ){
      return valueFromList;
    }

    try{
      if(
        window.BLCampos &&
        typeof window.BLCampos
          .getValue === "function"
      ){
        var official =
          window.BLCampos
            .getValue(
              row,
              definition.field ||
              definition.key,
              ""
            );

        if(
          official != null &&
          text(official) !== ""
        ){
          return official;
        }
      }
    }catch(error){}

    return pick(
      row,
      definition.aliases ||
      [definition.key],
      ""
    );
  }

  function requirementLabel(
    definition
  ){
    try{
      if(
        window.BLCampos &&
        typeof window.BLCampos
          .requirementLabel ===
          "function"
      ){
        return (
          text(
            window.BLCampos
              .requirementLabel(
                definition.key,
                definition.label
              )
          ) ||
          definition.label
        );
      }
    }catch(error){}

    return (
      definition.label ||
      definition.key
    );
  }

  function normalizeRequirement(
    row,
    definition
  ){
    var value =
      requirementValue(
        row || {},
        definition || {}
      );

    var status =
      statusFromValue(value);

    return {
      key:
        definition.key ||
        key(definition.label),

      field:
        definition.field ||
        definition.key ||
        "",

      label:
        requirementLabel(
          definition
        ),

      value:
        text(value),

      estado:
        status,

      estadoLabel:
        status === "cumple"
          ? "Cumple"
          : status === "no_cumple"
            ? "No cumple"
            : "Pendiente"
    };
  }

  function requirementsFor(row){
    return REQUIREMENTS.map(
      function(definition){
        return normalizeRequirement(
          row || {},
          definition
        );
      }
    );
  }

  function missingRequirements(row){
    if(
      row &&
      Array.isArray(
        row._requisitosFaltantes
      )
    ){
      return row
        ._requisitosFaltantes
        .slice();
    }

    return requirementsFor(row)
      .filter(function(item){
        return (
          item.estado !==
          "cumple"
        );
      });
  }

  function generalStatus(
    requirements
  ){
    requirements =
      Array.isArray(requirements)
        ? requirements
        : [];

    if(!requirements.length){
      return "pendiente";
    }

    if(
      requirements.every(
        function(item){
          return (
            item.estado ===
            "cumple"
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
            item.estado ===
            "no_cumple"
          );
        }
      )
    ){
      return "no_cumple";
    }

    return "pendiente";
  }

  function normalizeMatricula(value){
    var clean = key(value);

    if(!clean){
      return "ACTIVO";
    }

    if(
      /retir|inactiv|desert|anulad|baja/
        .test(clean)
    ){
      return "RETIRADO";
    }

    if(
      /activ|matriculad|vigente|regular/
        .test(clean)
    ){
      return "ACTIVO";
    }

    return text(value)
      .toUpperCase();
  }

  function shortCareer(value){
    var original =
      text(value);

    var shortened =
      original
        .replace(
          /^UNIVERSITARIA\s+EN\s+/i,
          ""
        )
        .replace(
          /^TECNOLOG[IÍ]A\s+SUPERIOR\s+EN\s+/i,
          ""
        )
        .replace(
          /^T[EÉ]CNICO\s+SUPERIOR\s+EN\s+/i,
          ""
        )
        .replace(
          /\s+(ONLINE|PRESENCIAL|H[IÍ]BRIDA)$/i,
          ""
        )
        .trim();

    return (
      shortened ||
      original
    );
  }

  function resolveDivision(row){
    var direct = text(
      pick(
        row,
        ALIASES.division ||
        [],
        ""
      )
    );

    try{
      if(
        window.BLDivisionesService &&
        typeof window.BLDivisionesService
          .studentDivision ===
          "function"
      ){
        var resolved = text(
          window.BLDivisionesService
            .studentDivision(
              row || {}
            )
        );

        if(
          resolved &&
          key(resolved) !==
            "sindivision"
        ){
          return resolved;
        }
      }
    }catch(error){}

    if(
      direct &&
      key(direct) !==
        "sindivision"
    ){
      return direct;
    }

    if(
      row &&
      Array.isArray(row.divisiones) &&
      row.divisiones.length
    ){
      return (
        text(row.divisiones[0]) ||
        "Sin división"
      );
    }

    return "Sin división";
  }

  function normalizePeriod(period){
    period =
      period &&
      typeof period === "object"
        ? period
        : {
            id: period,
            label: period
          };

    var id =
      U.periodIdOf
        ? U.periodIdOf(period)
        : text(
            period.id ||
            period.periodoId ||
            period.value
          );

    var label =
      U.periodLabelOf
        ? U.periodLabelOf(period)
        : text(
            period.label ||
            period.nombre ||
            id
          );

    if(!id){
      return null;
    }

    return Object.assign(
      {},
      period,
      {
        id: id,
        value: id,
        key: id,
        label: label || id,
        nombre: label || id,
        periodoId: id,
        periodId: id,
        periodoLabel:
          label || id,

        periodoCanonicoId:
          id,

        periodoCanonicoLabel:
          label || id,

        divisiones:
          Array.isArray(
            period.divisiones
          )
            ? period
                .divisiones
                .slice()
            : [],

        carrerasDetectadas:
          Array.isArray(
            period
              .carrerasDetectadas
          )
            ? period
                .carrerasDetectadas
                .slice()
            : []
      }
    );
  }

  function telegramInfo(row){
    row = row || {};

    var user =
      U.normalizeTelegramUser
        ? U.normalizeTelegramUser(
            pick(
              row,
              ALIASES.telegramUser ||
              [],
              ""
            )
          )
        : text(
            pick(
              row,
              ALIASES.telegramUser ||
              [],
              ""
            )
          ).replace(
            /^@+/,
            ""
          );

    var chatId = text(
      pick(
        row,
        ALIASES.telegramChatId ||
        [],
        ""
      )
    );

    return {
      user: user,
      username: user,
      chatId: chatId,
      hasUser: !!user,
      hasChatId: !!chatId,

      hasTelegram:
        !!(
          user ||
          chatId
        ),

      canOpen:
        !!user,

      canBot:
        !!chatId,

      label:
        chatId
          ? "Chat ID disponible"
          : user
            ? "@" + user
            : "Sin Telegram",

      url:
        user
          ? (
              "https://t.me/" +
              encodeURIComponent(
                user
              )
            )
          : ""
    };
  }

  function normalizeStudent(
    row,
    options
  ){
    row =
      row &&
      typeof row === "object"
        ? row
        : {};

    options =
      options ||
      {};

    var cedula =
      U.normalizeCedula
        ? U.normalizeCedula(
            pick(
              row,
              ALIASES.cedula ||
              [],
              ""
            )
          )
        : text(
            pick(
              row,
              ALIASES.cedula ||
              [],
              ""
            )
          );

    var names = text(
      pick(
        row,
        ALIASES.names ||
        [],
        ""
      )
    );

    var career = text(
      pick(
        row,
        ALIASES.career ||
        [],
        ""
      )
    );

    var careerCode = text(
      pick(
        row,
        ALIASES.careerCode ||
        [],
        ""
      )
    );

    var periodId =
      U.canonicalPeriodId
        ? U.canonicalPeriodId(
            pick(
              row,
              ALIASES.periodId ||
              [],
              options.periodId ||
              ""
            )
          )
        : text(
            pick(
              row,
              ALIASES.periodId ||
              [],
              options.periodId ||
              ""
            )
          );

    var periodLabel = text(
      pick(
        row,
        ALIASES.periodLabel ||
        [],
        options.periodLabel ||
        periodId
      )
    );

    var email =
      U.normalizeEmail
        ? U.normalizeEmail(
            pick(
              row,
              ALIASES.email ||
              [],
              ""
            )
          )
        : text(
            pick(
              row,
              ALIASES.email ||
              [],
              ""
            )
          );

    var phoneRaw = text(
      pick(
        row,
        ALIASES.phone ||
        [],
        ""
      )
    );

    var phone =
      U.normalizePhone
        ? U.normalizePhone(
            phoneRaw
          )
        : phoneRaw;

    var telegram =
      telegramInfo(row);

    var reqs =
      requirementsFor(row);

    var missing =
      reqs.filter(
        function(item){
          return (
            item.estado !==
            "cumple"
          );
        }
      );

    var id = text(
      pick(
        row,
        ALIASES.id ||
        [],
        ""
      )
    );

    var division =
      resolveDivision(row);

    var matricula =
      normalizeMatricula(
        pick(
          row,
          ALIASES.matricula ||
          [],
          ""
        )
      );

    if(!id){
      id = [
        cedula,
        periodId,
        careerCode ||
          key(career)
      ]
        .filter(Boolean)
        .join("::");
    }

    var normalized =
      Object.assign(
        {},
        row,
        {
          _id:
            id,

          _bl2Id:
            id,

          _cedula:
            cedula,

          _nombres:
            names,

          _carrera:
            career,

          _carreraCorta:
            shortCareer(
              career
            ),

          _codigoCarrera:
            careerCode,

          _periodoId:
            periodId,

          _bl2PeriodoId:
            periodId,

          _periodo:
            periodLabel ||
            periodId,

          _bl2Periodo:
            periodLabel ||
            periodId,

          _division:
            division,

          _bl2Division:
            division,

          _matricula:
            matricula,

          _correo:
            email,

          _celular:
            phone,

          _celularOriginal:
            phoneRaw,

          _telegramUser:
            telegram.user,

          _telegramChatId:
            telegram.chatId,

          _telegramTiene:
            telegram.hasTelegram,

          _telegramBot:
            telegram.canBot,

          _tablaTelegramInfo:
            telegram,

          _requisitos:
            reqs,

          _requisitosFaltantes:
            missing,

          _estadoGeneral:
            generalStatus(
              reqs
            )
        }
      );

    normalized._search = [
      cedula,
      names,
      career,
      careerCode,
      periodLabel,
      periodId,
      division,
      email,
      phone,
      telegram.user,
      telegram.chatId
    ]
      .join(" ")
      .toLowerCase();

    return normalized;
  }

  function normalizeStudents(
    rows,
    options
  ){
    rows =
      Array.isArray(rows)
        ? rows
        : [];

    var normalized =
      rows.map(function(row){
        return normalizeStudent(
          row,
          options || {}
        );
      });

    if(U.uniqueBy){
      return U.uniqueBy(
        normalized,

        function(row, index){
          return (
            row._id ||
            [
              row._cedula,
              row._periodoId,
              index
            ].join("::")
          );
        }
      );
    }

    return normalized;
  }

  function attachRequirements(
    rows,
    requirements
  ){
    rows =
      Array.isArray(rows)
        ? rows
        : [];

    requirements =
      Array.isArray(requirements)
        ? requirements
        : [];

    var grouped =
      Object.create(null);

    function identity(item){
      item = item || {};

      var cedula = text(
        item._cedula ||
        item.cedula ||
        item.numeroIdentificacion ||
        item.NumeroIdentificacion ||
        ""
      );

      var periodId = text(
        item._periodoId ||
        item.periodoId ||
        item.periodId ||
        item.periodoCanonicoId ||
        item.ultimoPeriodoId ||
        ""
      );

      if(
        !cedula ||
        !periodId
      ){
        return "";
      }

      return (
        key(cedula) +
        "::" +
        key(periodId)
      );
    }

    requirements.forEach(
      function(item){
        var itemIdentity =
          identity(item);

        if(!itemIdentity){
          return;
        }

        if(!grouped[itemIdentity]){
          grouped[itemIdentity] = [];
        }

        grouped[itemIdentity]
          .push(item);
      }
    );

    return rows.map(
      function(row){
        var studentIdentity =
          identity(row);

        var list =
          studentIdentity
            ? grouped[
                studentIdentity
              ] || []
            : [];

        if(!list.length){
          return row;
        }

        return Object.assign(
          {},
          row,
          {
            requisitos:
              list.slice(),

            requirements:
              list.slice()
          }
        );
      }
    );
  }

  function normalizeEnvelope(cache){
    cache =
      cache &&
      typeof cache === "object"
        ? cache
        : {};

    var rawRequirements =
      Array.isArray(
        cache.requirements
      )
        ? cache.requirements
            .slice()
        : Array.isArray(
            cache.requisitos
          )
          ? cache.requisitos
              .slice()
          : [];

    var rawStudents =
      Array.isArray(
        cache.students
      )
        ? cache.students
        : Array.isArray(
            cache.rows
          )
          ? cache.rows
          : [];

    var studentsWithRequirements =
      attachRequirements(
        rawStudents,
        rawRequirements
      );

    return {
      meta:
        cache.meta &&
        typeof cache.meta ===
          "object"
          ? Object.assign(
              {},
              cache.meta
            )
          : {},

      periods:
        (
          Array.isArray(
            cache.periods
          )
            ? cache.periods
            : []
        )
          .map(
            normalizePeriod
          )
          .filter(Boolean),

      students:
        normalizeStudents(
          studentsWithRequirements
        ),

      requirements:
        rawRequirements,

      summaries:
        cache.summaries &&
        typeof cache.summaries ===
          "object"
          ? Object.assign(
              {},
              cache.summaries
            )
          : {},

      diagnostics:
        Array.isArray(
          cache.diagnostics
        )
          ? cache.diagnostics
              .slice()
          : []
    };
  }

  function studentKey(row){
    row = row || {};

    return text(
      row._id ||
      [
        row._cedula,
        row._periodoId,
        row._codigoCarrera ||
          key(row._carrera)
      ].join("::")
    );
  }

  window.TablaDataNormalizer = {
    version:
      VERSION,

    statusFromValue:
      statusFromValue,

    normalizeRequirement:
      normalizeRequirement,

    requirementsFor:
      requirementsFor,

    missingRequirements:
      missingRequirements,

    generalStatus:
      generalStatus,

    normalizeMatricula:
      normalizeMatricula,

    normalizePeriod:
      normalizePeriod,

    normalizeStudent:
      normalizeStudent,

    normalizeStudents:
      normalizeStudents,

    normalizeEnvelope:
      normalizeEnvelope,

    telegramInfo:
      telegramInfo,

    studentKey:
      studentKey,

    shortCareer:
      shortCareer
  };
})(window);
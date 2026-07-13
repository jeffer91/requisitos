/* =========================================================
Nombre completo: tabla.data-normalizer.js
Ruta: /Gestion/Tabla/data/tabla.data-normalizer.js
Función:
- Normalizar períodos, estudiantes, contactos y requisitos.
- Aplicar la política REGULAR/PVC utilizada por Ficha.
- Excluir campos finales de los requisitos normales.
- Diferenciar cumple, no_cumple, no_aplica, pendiente y sin_dato.
- Vincular requisitos por cédula y período exactos.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "3.0.0-regular-pvc";
  var C = window.TablaConstants || {};
  var U = window.TablaUtils || {};
  var ALIASES = C.aliases || {};
  var STATUS = C.requirementStatus || {};
  var TYPES = C.periodTypes || {regular: "REGULAR", pvc: "PVC"};

  function text(value){
    return U.text ? U.text(value) : String(value == null ? "" : value).trim();
  }

  function array(value){
    return Array.isArray(value) ? value : [];
  }

  function object(value){
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function key(value){
    if(U.normalizeKey){ return U.normalizeKey(value); }
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function normalizeCedula(value){
    return U.normalizeCedula
      ? U.normalizeCedula(value)
      : text(value).replace(/[^0-9A-Za-z]/g, "");
  }

  function canonicalPeriod(value){
    return U.canonicalPeriodId
      ? U.canonicalPeriodId(value)
      : text(value);
  }

  function pick(row, aliases, fallback){
    row = object(row);
    aliases = array(aliases);

    if(U.pick){
      return U.pick(row, aliases, fallback);
    }

    var names = Object.keys(row);
    var wanted = aliases.map(key);
    var i;

    for(i = 0; i < aliases.length; i += 1){
      if(
        Object.prototype.hasOwnProperty.call(row, aliases[i]) &&
        row[aliases[i]] != null &&
        text(row[aliases[i]]) !== ""
      ){
        return row[aliases[i]];
      }
    }

    for(i = 0; i < names.length; i += 1){
      if(
        wanted.indexOf(key(names[i])) >= 0 &&
        row[names[i]] != null &&
        text(row[names[i]]) !== ""
      ){
        return row[names[i]];
      }
    }

    return fallback;
  }

  function findField(row, aliases){
    row = object(row);
    aliases = array(aliases);
    var names = Object.keys(row);
    var wanted = aliases.map(key);
    var i;

    for(i = 0; i < aliases.length; i += 1){
      if(Object.prototype.hasOwnProperty.call(row, aliases[i])){
        return {found: true, value: row[aliases[i]], field: aliases[i]};
      }
    }

    for(i = 0; i < names.length; i += 1){
      if(wanted.indexOf(key(names[i])) >= 0){
        return {found: true, value: row[names[i]], field: names[i]};
      }
    }

    return {found: false, value: "", field: ""};
  }

  function statusFromValue(value){
    if(value && typeof value === "object"){
      value = value.estado != null
        ? value.estado
        : value.status != null
          ? value.status
          : value.value != null
            ? value.value
            : value.valor;
    }

    var clean = key(value);

    if(!clean){
      return STATUS.noData || "sin_dato";
    }

    if(
      [
        "noaplica", "na", "n/a", "notapplicable",
        "noaplicable", "noaplicaesteperiodo"
      ].indexOf(clean) >= 0
    ){
      return STATUS.notApplicable || "no_aplica";
    }

    if(
      [
        "si", "s", "ok", "cumple", "cumplido", "cumplida",
        "aprobado", "aprobada", "1", "true", "x",
        "validado", "validada", "completo", "completa"
      ].indexOf(clean) >= 0
    ){
      return STATUS.ok || "cumple";
    }

    if(
      clean.indexOf("nocumple") >= 0 ||
      clean.indexOf("reprob") >= 0 ||
      [
        "no", "n", "0", "false", "falta", "faltante",
        "incompleto", "incompleta", "incumple", "rechazado",
        "rechazada", "pendienteporcumplir"
      ].indexOf(clean) >= 0
    ){
      return STATUS.failed || "no_cumple";
    }

    if(
      [
        "pendiente", "revision", "enrevision", "porvalidar",
        "procesando", "enproceso"
      ].indexOf(clean) >= 0
    ){
      return STATUS.pending || "pendiente";
    }

    return STATUS.pending || "pendiente";
  }

  function statusLabel(status){
    switch(status){
      case "cumple": return "Cumple";
      case "no_cumple": return "No cumple";
      case "no_aplica": return "No aplica";
      case "sin_dato": return "Sin dato";
      default: return "Pendiente";
    }
  }

  function definitionKeys(definition){
    definition = object(definition);
    return [
      definition.key,
      definition.field,
      definition.label
    ].concat(array(definition.aliases))
      .map(key)
      .filter(Boolean);
  }

  function isFinalRequirement(value){
    var currentKey = key(
      value && typeof value === "object"
        ? value.key || value.field || value.requisitoKey || value.nombre || value.label
        : value
    );

    return array(
      C.periodPolicy && C.periodPolicy.finalKeys
    ).map(key).indexOf(currentKey) >= 0;
  }

  function requirementValueFromList(row, definition){
    row = object(row);
    definition = object(definition);

    var list = Array.isArray(row.requisitos)
      ? row.requisitos
      : Array.isArray(row.requirements)
        ? row.requirements
        : Array.isArray(row._requisitosRaw)
          ? row._requisitosRaw
          : [];

    var accepted = definitionKeys(definition);
    var i;

    for(i = 0; i < list.length; i += 1){
      var item = object(list[i]);
      var itemKeys = [
        item.requisitoKey,
        item.requirementKey,
        item.key,
        item.field,
        item.nombre,
        item.label
      ].map(key).filter(Boolean);

      if(!itemKeys.some(function(itemKey){ return accepted.indexOf(itemKey) >= 0; })){
        continue;
      }

      var value = item.valor != null
        ? item.valor
        : item.estado != null
          ? item.estado
          : item.value != null
            ? item.value
            : item.status;

      return {
        found: true,
        value: value,
        source: "requirements",
        raw: item
      };
    }

    return {found: false, value: "", source: "", raw: null};
  }

  function requirementValue(row, definition){
    row = object(row);
    definition = object(definition);

    var fromList = requirementValueFromList(row, definition);
    if(fromList.found){ return fromList; }

    try{
      if(
        window.BLCampos &&
        typeof window.BLCampos.getValue === "function"
      ){
        var official = window.BLCampos.getValue(
          row,
          definition.field || definition.key,
          undefined
        );

        if(official !== undefined && official !== null && text(official) !== ""){
          return {
            found: true,
            value: official,
            source: "BLCampos",
            raw: null
          };
        }
      }
    }catch(error){}

    var direct = findField(
      row,
      array(definition.aliases).concat([
        definition.key,
        definition.field
      ])
    );

    return {
      found: direct.found,
      value: direct.value,
      source: direct.found ? "student" : "",
      raw: null,
      field: direct.field
    };
  }

  function requirementLabel(definition){
    definition = object(definition);

    try{
      if(
        window.BLCampos &&
        typeof window.BLCampos.requirementLabel === "function"
      ){
        return text(
          window.BLCampos.requirementLabel(
            definition.key,
            definition.label
          )
        ) || definition.label || definition.key;
      }
    }catch(error){}

    return definition.label || definition.key;
  }

  function normalizedPeriodText(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function classifyPeriod(value){
    var raw = value && typeof value === "object"
      ? text(
          pick(
            value,
            array(ALIASES.periodLabel).concat(array(ALIASES.periodId)),
            ""
          )
        )
      : text(value);

    var normalized = normalizedPeriodText(raw);
    var patterns = array(
      C.periodPolicy && C.periodPolicy.regularPatterns
    );

    if(!patterns.length){
      patterns = [
        ["octubre", "marzo"],
        ["abril", "septiembre"]
      ];
    }

    var regular = patterns.some(function(pattern){
      return array(pattern).every(function(token){
        return normalized.indexOf(normalizedPeriodText(token)) >= 0;
      });
    });

    return {
      id: regular ? (TYPES.regular || "REGULAR") : (TYPES.pvc || "PVC"),
      label: regular ? "Regular" : "PVC",
      isRegular: regular,
      isPVC: !regular,
      pattern: regular ? "REGULAR" : "PVC",
      raw: raw,
      normalized: normalized
    };
  }

  function classifyStudent(row){
    row = object(row);
    var periodValue = pick(
      row,
      array(ALIASES.periodLabel).concat(array(ALIASES.periodId)),
      ""
    );
    return classifyPeriod(periodValue);
  }

  function applicableDefinitions(row){
    var output = array(C.baseRequirements).slice();
    if(classifyStudent(row).isRegular){
      output = output.concat(array(C.regularOnlyRequirements));
    }

    return output.filter(function(definition){
      return !isFinalRequirement(definition);
    });
  }

  function normalizeRequirement(row, definition){
    definition = object(definition);
    var result = requirementValue(row || {}, definition);
    var status = statusFromValue(result.found ? result.value : "");

    return {
      key: definition.key || key(definition.label),
      field: definition.field || definition.key || "",
      label: requirementLabel(definition),
      aliases: array(definition.aliases).slice(),
      group: definition.group || "requisito",
      value: text(result.value),
      rawValue: result.value,
      estado: status,
      status: status,
      estadoLabel: statusLabel(status),
      found: result.found,
      source: result.source || "",
      applies: status !== "no_aplica",
      cumple: status === "cumple",
      missing: status === "no_cumple",
      noData: status === "sin_dato",
      pending: status === "pendiente"
    };
  }

  function requirementsFor(row){
    return applicableDefinitions(row).map(function(definition){
      return normalizeRequirement(row || {}, definition);
    });
  }

  function missingRequirements(row){
    if(row && Array.isArray(row._requisitosFaltantes)){
      return row._requisitosFaltantes.slice();
    }

    return requirementsFor(row).filter(function(item){
      return item.estado === "no_cumple";
    });
  }

  function noDataRequirements(row){
    if(row && Array.isArray(row._requisitosSinDato)){
      return row._requisitosSinDato.slice();
    }

    return requirementsFor(row).filter(function(item){
      return item.estado === "sin_dato" || item.estado === "pendiente";
    });
  }

  function generalStatus(requirements){
    requirements = array(requirements).filter(function(item){
      return item && item.estado !== "no_aplica";
    });

    if(!requirements.length){
      return "pendiente";
    }

    if(requirements.some(function(item){ return item.estado === "no_cumple"; })){
      return "no_cumple";
    }

    if(
      requirements.some(function(item){
        return item.estado === "sin_dato" || item.estado === "pendiente";
      })
    ){
      return "pendiente";
    }

    return requirements.every(function(item){ return item.estado === "cumple"; })
      ? "cumple"
      : "pendiente";
  }

  function normalizeMatricula(value){
    var clean = key(value);

    if(!clean){ return "ACTIVO"; }
    if(/retir|inactiv|desert|anulad|baja/.test(clean)){ return "RETIRADO"; }
    if(/activ|matriculad|vigente|regular/.test(clean)){ return "ACTIVO"; }

    return text(value).toUpperCase();
  }

  function shortCareer(value){
    var original = text(value);
    var shortened = original
      .replace(/^UNIVERSITARIA\s+EN\s+/i, "")
      .replace(/^TECNOLOG[IÍ]A\s+SUPERIOR\s+EN\s+/i, "")
      .replace(/^T[EÉ]CNICO\s+SUPERIOR\s+EN\s+/i, "")
      .replace(/\s+(ONLINE|PRESENCIAL|H[IÍ]BRIDA)$/i, "")
      .trim();

    return shortened || original;
  }

  function resolveDivision(row){
    row = object(row);
    var direct = text(pick(row, ALIASES.division || [], ""));

    try{
      if(
        window.BLDivisionesService &&
        typeof window.BLDivisionesService.studentDivision === "function"
      ){
        var resolved = text(window.BLDivisionesService.studentDivision(row));
        if(resolved && key(resolved) !== "sindivision"){ return resolved; }
      }
    }catch(error){}

    if(direct && key(direct) !== "sindivision"){ return direct; }
    if(Array.isArray(row.divisiones) && row.divisiones.length){
      return text(row.divisiones[0]) || "Sin división";
    }

    return "Sin división";
  }

  function normalizePeriod(period){
    period = period && typeof period === "object"
      ? period
      : {id: period, label: period};

    var id = U.periodIdOf
      ? U.periodIdOf(period)
      : text(period.id || period.periodoId || period.value);

    var label = U.periodLabelOf
      ? U.periodLabelOf(period)
      : text(period.label || period.nombre || period.periodoLabel || id);

    if(!id){ return null; }

    var classification = classifyPeriod(label || id);

    return Object.assign({}, period, {
      id: id,
      value: id,
      key: id,
      label: label || id,
      nombre: label || id,
      periodoId: id,
      periodId: id,
      periodoLabel: label || id,
      periodoCanonicoId: id,
      periodoCanonicoLabel: label || id,
      tipoPeriodo: classification.id,
      isRegular: classification.isRegular,
      isPVC: classification.isPVC,
      divisiones: array(period.divisiones).slice(),
      carrerasDetectadas: array(period.carrerasDetectadas).slice()
    });
  }

  function telegramInfo(row){
    row = object(row);

    var userRaw = pick(row, ALIASES.telegramUser || [], "");
    var user = U.normalizeTelegramUser
      ? U.normalizeTelegramUser(userRaw)
      : text(userRaw).replace(/^@+/, "");

    var chatId = text(pick(row, ALIASES.telegramChatId || [], ""));

    return {
      user: user,
      username: user,
      chatId: chatId,
      hasUser: !!user,
      hasChatId: !!chatId,
      hasTelegram: !!(user || chatId),
      canOpen: !!user,
      canBot: !!chatId,
      label: chatId ? "Chat ID disponible" : user ? "@" + user : "Sin Telegram",
      url: user ? "https://t.me/" + encodeURIComponent(user) : ""
    };
  }

  function normalizeStudent(row, options){
    row = object(row);
    options = object(options);

    var cedula = normalizeCedula(pick(row, ALIASES.cedula || [], ""));
    var names = text(pick(row, ALIASES.names || [], ""));
    var career = text(pick(row, ALIASES.career || [], ""));
    var careerCode = text(pick(row, ALIASES.careerCode || [], ""));

    var periodId = canonicalPeriod(
      pick(row, ALIASES.periodId || [], options.periodId || "")
    );

    var periodLabel = text(
      pick(
        row,
        ALIASES.periodLabel || [],
        options.periodLabel || periodId
      )
    );

    var personalEmailRaw = pick(row, ALIASES.personalEmail || [], "");
    var institutionalEmailRaw = pick(row, ALIASES.institutionalEmail || [], "");
    var emailRaw = pick(row, ALIASES.email || [], personalEmailRaw || institutionalEmailRaw);

    var personalEmail = U.normalizeEmail
      ? U.normalizeEmail(personalEmailRaw)
      : text(personalEmailRaw);

    var institutionalEmail = U.normalizeEmail
      ? U.normalizeEmail(institutionalEmailRaw)
      : text(institutionalEmailRaw);

    var email = U.normalizeEmail
      ? U.normalizeEmail(emailRaw)
      : text(emailRaw);

    var phoneRaw = text(pick(row, ALIASES.phone || [], ""));
    var phone = U.normalizePhone ? U.normalizePhone(phoneRaw) : phoneRaw;
    var telegram = telegramInfo(row);
    var division = resolveDivision(row);

    var periodProbe = Object.assign({}, row, {
      _periodo: periodLabel || periodId,
      _periodoId: periodId
    });

    var classification = classifyStudent(periodProbe);
    var reqs = requirementsFor(periodProbe);
    var missing = reqs.filter(function(item){ return item.estado === "no_cumple"; });
    var noData = reqs.filter(function(item){
      return item.estado === "sin_dato" || item.estado === "pendiente";
    });
    var noApply = reqs.filter(function(item){ return item.estado === "no_aplica"; });

    if(classification.isPVC){
      noApply = noApply.concat(
        array(C.regularOnlyRequirements).map(function(definition){
          return {
            key: definition.key,
            field: definition.field || definition.key,
            label: requirementLabel(definition),
            aliases: array(definition.aliases).slice(),
            group: definition.group || "regular",
            value: "",
            rawValue: "",
            estado: "no_aplica",
            status: "no_aplica",
            estadoLabel: "No aplica",
            found: false,
            source: "period-policy",
            applies: false,
            cumple: false,
            missing: false,
            noData: false,
            pending: false
          };
        })
      );
    }

    var id = text(pick(row, ALIASES.id || [], ""));
    if(!id){
      id = [cedula, periodId, careerCode || key(career)].filter(Boolean).join("::");
    }

    var matricula = normalizeMatricula(pick(row, ALIASES.matricula || [], ""));

    var normalized = Object.assign({}, row, {
      _id: id,
      _bl2Id: id,
      _cedula: cedula,
      _nombres: names,
      _carrera: career,
      _carreraCorta: shortCareer(career),
      _codigoCarrera: careerCode,
      _periodoId: periodId,
      _bl2PeriodoId: periodId,
      _periodo: periodLabel || periodId,
      _bl2Periodo: periodLabel || periodId,
      _tipoPeriodo: classification.id,
      _periodoClasificacion: classification,
      _esRegular: classification.isRegular,
      _esPVC: classification.isPVC,
      _division: division,
      _bl2Division: division,
      _matricula: matricula,
      _correoPersonal: personalEmail,
      _correoInstitucional: institutionalEmail,
      _correo: email || personalEmail || institutionalEmail,
      _celular: phone,
      _celularOriginal: phoneRaw,
      _telegramUser: telegram.user,
      _telegramChatId: telegram.chatId,
      _telegramTiene: telegram.hasTelegram,
      _telegramBot: telegram.canBot,
      _tablaTelegramInfo: telegram,
      _requisitosRaw: array(row.requisitos || row.requirements).slice(),
      _requisitos: reqs,
      _requisitosAplicables: reqs,
      _requisitosFaltantes: missing,
      _requisitosSinDato: noData,
      _requisitosNoAplican: noApply,
      _estadoGeneral: generalStatus(reqs)
    });

    normalized._search = [
      cedula,
      names,
      career,
      careerCode,
      periodLabel,
      periodId,
      classification.id,
      division,
      personalEmail,
      institutionalEmail,
      email,
      phone,
      telegram.user,
      telegram.chatId
    ].join(" ").toLowerCase();

    return normalized;
  }

  function normalizeStudents(rows, options){
    rows = array(rows);
    var normalized = rows.map(function(row){
      return normalizeStudent(row, options || {});
    });

    if(U.uniqueBy){
      return U.uniqueBy(normalized, function(row, index){
        return row._id || [row._cedula, row._periodoId, index].join("::");
      });
    }

    var seen = Object.create(null);
    return normalized.filter(function(row, index){
      var id = row._id || [row._cedula, row._periodoId, index].join("::");
      if(seen[id]){ return false; }
      seen[id] = true;
      return true;
    });
  }

  function identity(item){
    item = object(item);
    var cedula = normalizeCedula(
      item._cedula || item.cedula || item.numeroIdentificacion ||
      item.NumeroIdentificacion || ""
    );

    var periodId = canonicalPeriod(
      item._periodoId || item.periodoId || item.periodId ||
      item.periodoCanonicoId || item.ultimoPeriodoId || ""
    );

    return cedula && periodId ? cedula + "::" + periodId : "";
  }

  function attachRequirements(rows, requirements){
    rows = array(rows);
    requirements = array(requirements);
    var grouped = Object.create(null);

    requirements.forEach(function(item){
      var itemIdentity = identity(item);
      if(!itemIdentity || isFinalRequirement(item)){ return; }
      if(!grouped[itemIdentity]){ grouped[itemIdentity] = []; }
      grouped[itemIdentity].push(item);
    });

    return rows.map(function(row){
      var list = grouped[identity(row)] || [];
      return Object.assign({}, row, {
        requisitos: list.slice(),
        requirements: list.slice(),
        _requisitosRaw: list.slice()
      });
    });
  }

  function normalizeEnvelope(cache){
    cache = object(cache);

    var rawRequirements = array(cache.requirements || cache.requisitos)
      .filter(function(item){ return !isFinalRequirement(item); });

    var rawStudents = array(cache.students || cache.rows);
    var periods = array(cache.periods).map(normalizePeriod).filter(Boolean);
    var periodMap = Object.create(null);

    periods.forEach(function(period){
      periodMap[canonicalPeriod(period.periodoId || period.id)] = period.periodoLabel || period.label;
    });

    var studentsWithRequirements = attachRequirements(rawStudents, rawRequirements);
    var students = studentsWithRequirements.map(function(row){
      var rowPeriodId = canonicalPeriod(
        pick(row, ALIASES.periodId || [], "")
      );

      return normalizeStudent(row, {
        periodId: rowPeriodId,
        periodLabel: periodMap[rowPeriodId] || ""
      });
    });

    return {
      meta: Object.assign({}, object(cache.meta)),
      periods: periods,
      students: students,
      requirements: rawRequirements.slice(),
      summaries: Object.assign({}, object(cache.summaries)),
      diagnostics: array(cache.diagnostics).slice()
    };
  }

  function studentKey(row){
    row = object(row);
    return text(
      row._id ||
      [
        row._cedula,
        row._periodoId,
        row._codigoCarrera || key(row._carrera)
      ].join("::")
    );
  }

  window.TablaDataNormalizer = {
    version: VERSION,
    statusFromValue: statusFromValue,
    statusLabel: statusLabel,
    classifyPeriod: classifyPeriod,
    classifyStudent: classifyStudent,
    applicableDefinitions: applicableDefinitions,
    isFinalRequirement: isFinalRequirement,
    normalizeRequirement: normalizeRequirement,
    requirementsFor: requirementsFor,
    missingRequirements: missingRequirements,
    noDataRequirements: noDataRequirements,
    generalStatus: generalStatus,
    normalizeMatricula: normalizeMatricula,
    normalizePeriod: normalizePeriod,
    normalizeStudent: normalizeStudent,
    normalizeStudents: normalizeStudents,
    attachRequirements: attachRequirements,
    normalizeEnvelope: normalizeEnvelope,
    telegramInfo: telegramInfo,
    studentKey: studentKey,
    shortCareer: shortCareer
  };
})(window);

/* =========================================================
Nombre completo: ficha.core.js
Ruta o ubicación: /Requisitos/Ficha/ficha.core.js
Función:
- Preparar estudiantes una sola vez por período/matrícula.
- Crear índice interno de búsqueda.
- Buscar en memoria sin llamar siempre a la base.
- Entregar datos listos para llenar la ficha.
- Generar mensajes para WhatsApp, Telegram y correo.
- Generar enlace mailto para abrir Outlook/correo predeterminado.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "4.1.0-ficha-prearmada-email";

  var cache = {
    periods:null,
    base:{},
    byId:{},
    divisions:{},
    listKey:"",
    listRows:[],
    full:{},
    reqs:{},
    specials:{},
    notes:{}
  };

  var FALLBACK_BASE = [
    req("academico", "Académico"),
    req("documentacion", "Documentación"),
    req("financiero", "Financiero"),
    req("practicasvinculacion", "Prácticas"),
    req("vinculacion", "Vinculación"),
    req("seguimientograduados", "Seguimiento graduados"),
    req("ingles", "Inglés"),
    req("actualizaciondatos", "Actualización de datos")
  ];

  var FALLBACK_EXTRA = [
    req("titulacion", "Titulación")
  ];

  var FALLBACK_FINAL = [
    req("aprobaciontitulacion", "Aprobación titulación", "final"),
    req("aprobacioncomplexivoproyecto", "Aprobación complexivo/proyecto", "final")
  ];

  var NOTE_FIELDS = [
    {
      key:"nart",
      label:"Nart",
      aliases:["Notart","notart","Nart","nart","N_ART","N-ART","NotaArt","notaArt","notaArticulo","nota_articulo"]
    },
    {
      key:"ndef",
      label:"Ndef",
      aliases:["Notdef","notdef","Ndef","ndef","N_DEF","N-DEF","NotaDef","notaDef","notaDefensa","nota_defensa"]
    },
    {
      key:"nfin",
      label:"Nfin",
      aliases:["Notafinal","notafinal","NotaFinal","notaFinal","Nfin","nfin","N_FIN","N-FIN","Nota final","nota final"]
    }
  ];

  var CORREO_PERSONAL_ALIASES = [
    "_correoPersonal","_bl2CorreoPersonal","correoPersonal","CorreoPersonal",
    "correopersonal","correo","Correo","email","Email","mail","Mail"
  ];

  var CORREO_INSTITUCIONAL_ALIASES = [
    "_correoInstitucional","_bl2CorreoInstitucional","correoInstitucional",
    "CorreoInstitucional","correoinstitucional","correoInst","CorreoInst",
    "emailInstitucional","EmailInstitucional","mailInstitucional"
  ];

  var CELULAR_ALIASES = [
    "_celular","_bl2Celular","celular","Celular","telefono","Telefono",
    "Teléfono","telf","Telf","whatsapp","WhatsApp","numeroCelular","NumeroCelular"
  ];

  var TELEGRAM_USER_ALIASES = [
    "_telegramUser","telegramUser","TelegramUser","telegramuser",
    "usuarioTelegram","UsuarioTelegram","usuariotelegram","telegram","Telegram"
  ];

  var TELEGRAM_CHAT_ID_ALIASES = [
    "_telegramChatId","telegramChatId","TelegramChatId","telegramchatid",
    "chatIdTelegram","ChatIdTelegram","chatidtelegram","chatId","ChatId","chatid"
  ];

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function compact(value){
    return norm(value).replace(/[^a-z0-9]/g, "");
  }

  function label(key, fallback){
    try{
      if(window.BLCampos && typeof window.BLCampos.requirementLabel === "function"){
        return window.BLCampos.requirementLabel(key, fallback);
      }
    }catch(error){}
    return fallback || key;
  }

  function req(key, fallback, group){
    return {
      key:key,
      field:key,
      label:label(key, fallback),
      group:group || "requisito"
    };
  }

  function cloneReq(item){
    item = item || {};
    return {
      key:item.key,
      field:item.field || item.key,
      label:item.label || item.key,
      group:item.group || "requisito",
      icon:item.icon || ""
    };
  }

  function cloneList(list){
    return (list || []).map(cloneReq);
  }

  function normalizer(){ return window.BL2StudentNormalizer || null; }
  function reqEngine(){ return window.BL2RequirementsEngine || window.StatsRules || null; }
  function dataEngine(){ return window.BL2DataEngine || null; }
  function screenAdapter(){ return window.BL2ScreenAdapter || null; }
  function bl2Students(){ return window.BL2EstudiantesRepo || null; }
  function bl2Reqs(){ return window.BL2RequisitosRepo || null; }
  function notasService(){ return window.BLNotasDefensa || null; }
  function excelRepo(){ return window.ExcelLocalRepo || null; }

  function source(){
    if(dataEngine()){ return "BL2DataEngine"; }
    if(bl2Students()){ return "BL2"; }
    return "ExcelLocalRepo";
  }

  function pick(row, aliases, fallback){
    row = row || {};
    aliases = aliases || [];

    var keys = Object.keys(row);
    var wanted = aliases.map(compact);
    var i;

    for(i = 0; i < aliases.length; i += 1){
      if(Object.prototype.hasOwnProperty.call(row, aliases[i]) && text(row[aliases[i]]) !== ""){
        return row[aliases[i]];
      }
    }

    for(i = 0; i < keys.length; i += 1){
      if(wanted.indexOf(compact(keys[i])) >= 0 && row[keys[i]] != null && text(row[keys[i]]) !== ""){
        return row[keys[i]];
      }
    }

    return fallback;
  }

  function fieldValue(row, field, fallback){
    row = row || {};

    try{
      if(normalizer() && typeof normalizer().value === "function"){
        var nv = normalizer().value(row, field);
        if(text(nv) !== ""){ return nv; }
      }
    }catch(error){}

    try{
      if(window.BLCampos && typeof window.BLCampos.getValue === "function"){
        var bv = window.BLCampos.getValue(row, field, fallback);
        if(text(bv) !== ""){ return bv; }
      }
    }catch(error){}

    return pick(row, [field], fallback);
  }

  function estadoMatricula(value){
    return norm(value || "ACTIVO") === "retirado" ? "RETIRADO" : "ACTIVO";
  }

  function samePeriod(a, b){
    if(!text(b)){ return true; }

    try{
      if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){
        return window.BLPeriodosCanon.samePeriod(a, b);
      }
    }catch(error){}

    return text(a) === text(b) || norm(a) === norm(b);
  }

  function periodDisplay(row){
    row = row || {};
    var raw = text(row._periodoNormalizado || row._periodo || row.periodoLabel || row.periodoId || row.ultimoPeriodoId || row.periodo || row.Periodo);

    if(!raw){ return "Sin período"; }

    try{
      if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.normalizePeriod === "function"){
        var normalized = window.BLPeriodosCanon.normalizePeriod({
          id:raw,
          periodoId:raw,
          label:raw,
          periodoLabel:raw
        });
        return text(normalized.label || normalized.periodoLabel || raw) || raw;
      }
    }catch(error){}

    return raw;
  }

  function divisionOf(row){
    row = row || {};

    if(row._bl2Division){ return row._bl2Division; }

    try{
      if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function"){
        return window.BLDivisionesService.studentDivision(row);
      }
    }catch(error){}

    var list = Array.isArray(row.divisiones) ? row.divisiones : [];
    return list[0] || row.division || row.Division || row.División || "Sin división";
  }

  function hasDivision(row, division){
    if(!text(division)){ return true; }

    try{
      if(window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function"){
        return window.BLDivisionesService.hasDivision(row, division);
      }
    }catch(error){}

    return norm(divisionOf(row)) === norm(division);
  }

  function telegramInfo(row){
    row = row || {};
    var user = text(pick(row, TELEGRAM_USER_ALIASES, "")).replace(/^@+/, "");
    var chatId = text(pick(row, TELEGRAM_CHAT_ID_ALIASES, ""));

    return {
      user:user,
      chatId:chatId,
      hasTelegram:!!(user || chatId),
      canSendByBot:!!chatId
    };
  }

  function searchTextFor(row){
    row = row || {};
    return norm([
      row._cedula,
      row._nombres,
      row._carrera,
      row._division,
      row._correo,
      row._correoPersonal,
      row._correoInstitucional,
      row._celular,
      row._periodo,
      row._periodoId,
      row._estadoMatricula,
      row._telegramUser,
      row._telegramChatId
    ].join(" "));
  }

  function normalizeLight(row){
    row = row || {};

    var r = normalizer() && typeof normalizer().normalize === "function"
      ? normalizer().normalize(row, {clone:false})
      : Object.assign({}, row);

    var correoPersonal = text(r._bl2CorreoPersonal || fieldValue(r, "correoPersonal", pick(r, CORREO_PERSONAL_ALIASES, "")));
    var correoInstitucional = text(r._bl2CorreoInstitucional || fieldValue(r, "correoInstitucional", pick(r, CORREO_INSTITUCIONAL_ALIASES, "")));
    var correoPrincipal = text(r._bl2Correo || r._correo || r.correo || r.Correo || correoPersonal || correoInstitucional);
    var celular = text(r._bl2Celular || fieldValue(r, "celular", pick(r, CELULAR_ALIASES, "")));
    var tg = telegramInfo(r);

    var out = {
      _id:text(r._bl2Id || r.cedula || r.numeroIdentificacion || r.numeroidentificacion || r._docId || r.docId || r.id),
      _cedula:text(r._bl2Id || r.cedula || r.numeroIdentificacion || r.numeroidentificacion || r.Cedula || r.NumeroIdentificacion),
      _nombres:text(r._bl2Nombre || r.nombres || r.Nombres || r.nombre || r.Nombre || r.estudiante || r.Estudiante || r.apellidosNombres || r.ApellidosNombres),
      _carrera:text(r._bl2Carrera || r.nombrecarrera || r.nombreCarrera || r.NombreCarrera || r.carrera || r.Carrera) || "SIN CARRERA",
      _division:divisionOf(r),
      _sede:text(r._bl2Sede || fieldValue(r, "sede", r.Sede || "")),
      _horario:text(r._bl2Jornada || pick(r, ["horariocomplexivo", "HorarioComplexivo", "horarioComplexivo", "horario", "jornada", "Jornada"], "")),
      _correoPersonal:correoPersonal || correoPrincipal,
      _correoInstitucional:correoInstitucional,
      _correo:correoPrincipal || correoPersonal || correoInstitucional,
      _celular:celular,
      _periodo:text(r._bl2Periodo || r.periodoLabel || r.periodo || r.Periodo || r.periodoId || r._bl2PeriodoId),
      _periodoId:text(r._bl2PeriodoId || r.periodoId || r.ultimoPeriodoId || r.periodId || r._bl2Periodo || r.periodoLabel || r.periodo),
      _estadoMatricula:estadoMatricula(r._bl2EstadoMatricula || fieldValue(r, "estadoMatricula", r.estadoMatricula)),
      _telegramUser:tg.user,
      _telegramChatId:tg.chatId,
      _telegramTiene:tg.hasTelegram,
      _raw:r
    };

    out._searchText = searchTextFor(out);
    return out;
  }

  function normalizeFull(row){
    if(row && row._fichaFull === VERSION){ return row; }

    var light = normalizeLight(row || {});
    var full = Object.assign({}, row || {}, light);

    full._periodoNormalizado = periodDisplay(full);
    full._approval = studentApproval(full);
    full._estado = estadoGeneral(full);
    full._finalApproval = finalApproval(full);
    full._fichaFull = VERSION;

    return full;
  }

  function estadoCelda(value){
    try{
      if(reqEngine() && typeof reqEngine().cellStatus === "function"){
        return reqEngine().cellStatus(value);
      }
    }catch(error){}

    var k = norm(value);

    if(["cumple","si","sí","s","ok","aprobado","aprobada","1","true","x","validado","completo","completa"].indexOf(k) >= 0){
      return "cumple";
    }

    if(["no aplica","no_aplica","na","n/a"].indexOf(k) >= 0){
      return "no_aplica";
    }

    return "no_cumple";
  }

  function reqValue(row, item){
    item = item || {};

    try{
      if(reqEngine() && typeof reqEngine().valueOf === "function"){
        return reqEngine().valueOf(row || {}, item.key || item.field);
      }
    }catch(error){}

    try{
      if(bl2Reqs() && typeof bl2Reqs().field === "function"){
        return bl2Reqs().field(row || {}, item.key || item.field, "");
      }
    }catch(error){}

    return fieldValue(row, item.field || item.key, pick(row, [item.key], ""));
  }

  function classifyStudent(row){
    try{
      if(reqEngine() && typeof reqEngine().classifyStudent === "function"){
        return reqEngine().classifyStudent(row || {});
      }
    }catch(error){}

    var raw = text(row && (row._periodo || row.periodoLabel || row.periodoId));
    var n = norm(raw);
    var regular = (n.indexOf("octubre") >= 0 && n.indexOf("marzo") >= 0) || (n.indexOf("abril") >= 0 && n.indexOf("septiembre") >= 0);

    return {
      id:regular ? "REGULAR" : "PVC",
      label:regular ? "Regular" : "PVC",
      isPVC:!regular,
      isRegular:regular,
      pattern:regular ? "REGULAR" : "PVC",
      raw:raw
    };
  }

  function requirementsForStudent(row){
    try{
      if(reqEngine() && typeof reqEngine().requirementsForStudent === "function"){
        return cloneList(reqEngine().requirementsForStudent(row || {}));
      }
    }catch(error){}

    return classifyStudent(row).id === "REGULAR"
      ? cloneList(FALLBACK_BASE.concat(FALLBACK_EXTRA))
      : cloneList(FALLBACK_BASE);
  }

  function finalRequirements(){
    try{
      if(reqEngine() && Array.isArray(reqEngine().FINAL_REQUIREMENTS)){
        return cloneList(reqEngine().FINAL_REQUIREMENTS);
      }
    }catch(error){}

    return cloneList(FALLBACK_FINAL);
  }

  function requirementStatus(row, item){
    try{
      if(reqEngine() && typeof reqEngine().requirementStatus === "function"){
        return reqEngine().requirementStatus(row || {}, item.key);
      }
    }catch(error){}

    var estado = estadoCelda(reqValue(row, item));

    return {
      key:item.key,
      label:item.label,
      status:estado,
      labelStatus:estado === "cumple" ? "Cumple" : (estado === "no_aplica" ? "No aplica" : "No cumple"),
      cumple:estado === "cumple",
      applies:estado !== "no_aplica"
    };
  }

  function studentApproval(row){
    try{
      if(reqEngine() && typeof reqEngine().studentApproval === "function"){
        return reqEngine().studentApproval(row || {});
      }
    }catch(error){}

    var applicable = requirementsForStudent(row);
    var missing = applicable.filter(function(item){
      return estadoCelda(reqValue(row, item)) !== "cumple";
    });
    var type = classifyStudent(row);

    return {
      approved:missing.length === 0,
      label:missing.length ? "No cumple" : "Aprobado",
      applicableRequirements:applicable,
      missingRequirements:missing,
      notApplicableRequirements:type.id === "PVC" ? cloneList(FALLBACK_EXTRA) : [],
      periodType:type
    };
  }

  function finalApproval(row){
    try{
      if(reqEngine() && typeof reqEngine().finalApproval === "function"){
        return reqEngine().finalApproval(row || {});
      }
    }catch(error){}

    return finalRequirements().map(function(item){
      var estado = estadoCelda(reqValue(row, item));
      return {
        key:item.key,
        label:item.label,
        status:estado,
        cumple:estado === "cumple"
      };
    });
  }

  function estadoGeneral(row){
    var approval = studentApproval(row);
    var total = approval.applicableRequirements ? approval.applicableRequirements.length : 0;
    var missing = approval.missingRequirements ? approval.missingRequirements.length : 0;

    return {
      id:approval.approved ? "cumple" : "no_cumple",
      label:approval.approved ? "Aprobado" : "No cumple",
      ok:Math.max(0, total - missing),
      no:missing,
      pend:0,
      approved:approval.approved,
      periodType:approval.periodType,
      applicableRequirements:approval.applicableRequirements || [],
      missingRequirements:approval.missingRequirements || [],
      notApplicableRequirements:approval.notApplicableRequirements || []
    };
  }

  function periods(){
    if(cache.periods){ return cache.periods.slice(); }

    var list = [];

    try{
      if(dataEngine() && typeof dataEngine().listPeriods === "function"){
        list = dataEngine().listPeriods() || [];
      }
    }catch(error){}

    if(!list.length){
      try{
        if(bl2Students() && typeof bl2Students().listPeriods === "function"){
          list = bl2Students().listPeriods() || [];
        }
      }catch(error){}
    }

    if(!list.length){
      try{
        if(excelRepo() && typeof excelRepo().listPeriods === "function"){
          list = excelRepo().listPeriods() || [];
        }
      }catch(error){}
    }

    cache.periods = list.slice();
    return list;
  }

  function baseKey(options){
    options = options || {};
    return [
      source(),
      text(options.periodId),
      options.matricula == null ? "ACTIVO" : text(options.matricula)
    ].join("|");
  }

  function resultKey(options){
    options = options || {};
    return [
      baseKey(options),
      text(options.division),
      norm(options.search),
      Number(options.limit || 400)
    ].join("|");
  }

  function rememberRows(key, rows){
    var map = {};

    (rows || []).forEach(function(row){
      var id = text(row._id);
      var cedula = text(row._cedula);

      if(id && !map[id]){ map[id] = row; }
      if(cedula && !map[cedula]){ map[cedula] = row; }
    });

    cache.byId[key] = map;
  }

  function rowsFromDataEngine(options){
    try{
      if(dataEngine() && typeof dataEngine().listStudents === "function"){
        var response = dataEngine().listStudents({
          periodId:options.periodId || "",
          division:"",
          matricula:options.matricula == null ? "ACTIVO" : options.matricula,
          search:"",
          limit:50000,
          force:options.force === true
        });

        return response && Array.isArray(response.rows) ? response.rows : [];
      }
    }catch(error){
      console.warn("[FichaCore] BL2DataEngine falló", error);
    }

    return [];
  }

  function rowsFromBL2(options){
    try{
      if(bl2Students() && typeof bl2Students().buscar === "function"){
        var response = bl2Students().buscar({
          periodId:options.periodId || "",
          division:"",
          matricula:options.matricula == null ? "ACTIVO" : options.matricula,
          search:"",
          limit:50000,
          force:options.force === true
        });

        return response && Array.isArray(response.rows) ? response.rows : [];
      }
    }catch(error){
      console.warn("[FichaCore] BL2EstudiantesRepo falló", error);
    }

    return [];
  }

  function rowsFromExcel(options){
    if(!excelRepo()){ return []; }

    try{
      if(typeof excelRepo().filterStudents === "function"){
        return excelRepo().filterStudents({
          periodoId:options.periodId || "",
          estadoMatricula:options.matricula || "",
          division:""
        }) || [];
      }

      if(typeof excelRepo().listStudentsByStatus === "function"){
        return excelRepo().listStudentsByStatus(options.matricula || "", options.periodId || "") || [];
      }

      if(typeof excelRepo().listAllStudents === "function"){
        return excelRepo().listAllStudents() || [];
      }
    }catch(error){}

    return [];
  }

  function postFilterRows(rows, options){
    options = options || {};

    var q = norm(options.search || "");
    var tokens = q ? q.split(" ").filter(Boolean) : [];
    var periodId = text(options.periodId);
    var division = text(options.division);
    var matricula = options.matricula == null ? "ACTIVO" : text(options.matricula);

    return (rows || []).filter(function(row){
      if(matricula && row._estadoMatricula !== matricula){ return false; }
      if(periodId && !samePeriod(row._periodoId || row._periodo, periodId)){ return false; }
      if(division && !hasDivision(row, division)){ return false; }

      if(tokens.length){
        var hay = row._searchText || searchTextFor(row);
        if(!tokens.every(function(token){ return hay.indexOf(token) >= 0; })){
          return false;
        }
      }

      return true;
    });
  }

  function baseRows(options){
    options = options || {};

    var payload = {
      periodId:options.periodId || "",
      matricula:options.matricula == null ? "ACTIVO" : options.matricula,
      force:options.force === true
    };

    var key = baseKey(payload);

    if(!payload.force && cache.base[key]){
      return cache.base[key].slice();
    }

    var raw = rowsFromDataEngine(payload);

    if(!raw.length){ raw = rowsFromBL2(payload); }
    if(!raw.length){ raw = rowsFromExcel(payload); }

    var prepared = (raw || []).map(normalizeLight);

    prepared = postFilterRows(prepared, {
      periodId:payload.periodId,
      matricula:payload.matricula,
      division:"",
      search:""
    });

    cache.base[key] = prepared.slice();
    rememberRows(key, prepared);

    return prepared;
  }

  function queryRowsLight(options){
    options = options || {};

    var payload = {
      periodId:options.periodId || "",
      division:options.division || "",
      matricula:options.matricula == null ? "ACTIVO" : options.matricula,
      search:options.search || "",
      limit:Math.max(1, Number(options.limit || 400) || 400),
      force:options.force === true
    };

    var key = resultKey(payload) + (payload.force ? "|force" : "");

    if(!payload.force && cache.listKey === key && Array.isArray(cache.listRows)){
      return cache.listRows.slice();
    }

    var rows = postFilterRows(baseRows(payload), payload).slice(0, payload.limit);

    cache.listKey = key;
    cache.listRows = rows.slice();

    return rows;
  }

  function students(matricula){
    return queryRowsLight({
      matricula:matricula == null ? "ACTIVO" : matricula,
      limit:400
    });
  }

  function filter(options){
    return queryRowsLight(options || {});
  }

  function divisions(list, options){
    options = options || {};

    var payload = {
      periodId:options.periodId || "",
      matricula:options.matricula == null ? "ACTIVO" : options.matricula,
      force:options.force === true
    };

    var key = baseKey(payload);

    if(!list && cache.divisions[key]){
      return cache.divisions[key].slice();
    }

    var rows = list || baseRows(payload);
    var map = {};

    rows.forEach(function(row){
      map[divisionOf(row) || "Sin división"] = true;
    });

    var out = Object.keys(map).sort(function(a, b){
      return a.localeCompare(b, "es");
    });

    if(!list){
      cache.divisions[key] = out.slice();
    }

    return out;
  }

  function findInCache(id, options){
    var wanted = text(id);
    if(!wanted){ return null; }

    options = options || {};

    var key = baseKey({
      periodId:options.periodId || "",
      matricula:options.matricula == null ? "ACTIVO" : options.matricula
    });

    if(cache.byId[key] && cache.byId[key][wanted]){
      return cache.byId[key][wanted];
    }

    if(!cache.base[key]){
      baseRows(options);
    }

    if(cache.byId[key] && cache.byId[key][wanted]){
      return cache.byId[key][wanted];
    }

    return (cache.listRows || []).find(function(row){
      return text(row._id) === wanted || text(row._cedula) === wanted;
    }) || null;
  }

  function getById(id, options){
    var wanted = text(id);
    options = options || {};

    if(!wanted){ return null; }

    var fullKey = wanted + "|" + text(options.periodId) + "|" + (options.matricula == null ? "ACTIVO" : text(options.matricula));

    if(cache.full[fullKey]){
      return cache.full[fullKey];
    }

    var cached = findInCache(wanted, options);

    if(cached){
      cache.full[fullKey] = normalizeFull(cached._raw || cached);
      return cache.full[fullKey];
    }

    try{
      if(screenAdapter() && typeof screenAdapter().forFicha === "function"){
        var s = screenAdapter().forFicha(wanted, options);
        if(s && s.found && s.student){
          cache.full[fullKey] = normalizeFull(s.student);
          return cache.full[fullKey];
        }
      }
    }catch(error){}

    try{
      if(dataEngine() && typeof dataEngine().getStudentById === "function"){
        var d = dataEngine().getStudentById(wanted, options);
        if(d){
          cache.full[fullKey] = normalizeFull(d);
          return cache.full[fullKey];
        }
      }
    }catch(error2){}

    try{
      if(bl2Students() && typeof bl2Students().obtenerPorCedula === "function"){
        var b = bl2Students().obtenerPorCedula(wanted, options);
        if(b){
          cache.full[fullKey] = normalizeFull(b);
          return cache.full[fullKey];
        }
      }
    }catch(error3){}

    return null;
  }

  function buildReq(row, item){
    var status = requirementStatus(row, item);
    var raw = text(reqValue(row, item));

    return {
      key:status.key || item.key,
      field:item.field || item.key,
      label:status.label || item.label,
      icon:item.icon || "",
      value:raw || (status.applies === false ? "NO APLICA" : "NO CUMPLE"),
      estado:status.status,
      aplica:status.applies !== false,
      periodType:status.periodType
    };
  }

  function rowCacheId(row, suffix){
    row = row || {};
    return [
      text(row._id || row._cedula),
      text(row._periodoId || row._periodo),
      suffix || ""
    ].join("|");
  }

  function requisitos(row){
    row = normalizeFull(row || {});
    var key = rowCacheId(row, "reqs");

    if(cache.reqs[key]){
      return cache.reqs[key].slice();
    }

    cache.reqs[key] = requirementsForStudent(row).map(function(item){
      return buildReq(row, item);
    }).filter(function(item){
      return item.aplica !== false;
    });

    return cache.reqs[key].slice();
  }

  function especiales(row){
    row = normalizeFull(row || {});
    var key = rowCacheId(row, "specials");

    if(cache.specials[key]){
      return cache.specials[key].slice();
    }

    cache.specials[key] = finalRequirements().map(function(item){
      return buildReq(row, item);
    });

    return cache.specials[key].slice();
  }

  function pendientes(row, includeSpecial){
    var sourceList = includeSpecial ? requisitos(row).concat(especiales(row)) : requisitos(row);

    return sourceList.filter(function(item){
      return item.estado !== "cumple" && item.estado !== "no_aplica";
    });
  }

  function numberValue(value){
    if(notasService() && typeof notasService().normalizarNota === "function"){
      return notasService().normalizarNota(value);
    }

    var raw = text(value).replace(",", ".");
    if(!raw){ return null; }

    var n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function round2(value){
    if(notasService() && typeof notasService().redondear2 === "function"){
      return notasService().redondear2(value);
    }

    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  }

  function calcularNfin(nart, ndef){
    if(notasService() && typeof notasService().calcularNfin === "function"){
      return notasService().calcularNfin(nart, ndef);
    }

    var art = numberValue(nart);
    var def = numberValue(ndef);

    if(art === null || def === null || art < 7){
      return null;
    }

    return round2((art * 0.70) + (def * 0.30));
  }

  function estadoNota(value){
    var n = numberValue(value);
    return n != null && n >= 7 ? "cumple" : "no_cumple";
  }

  function notasDesdeServicio(row){
    if(!(notasService() && typeof notasService().extraerNotas === "function")){
      return null;
    }

    var info = notasService().extraerNotas(row || {});
    var values = {
      nart:info.nart,
      ndef:info.ndef,
      nfin:info.nfin
    };

    return NOTE_FIELDS.map(function(note){
      var n = values[note.key];

      return {
        key:note.key,
        label:note.label,
        value:n == null ? "—" : String(round2(n)),
        number:n,
        estado:estadoNota(n)
      };
    });
  }

  function notas(row){
    row = normalizeFull(row || {});
    var key = rowCacheId(row, "notes");

    if(cache.notes[key]){
      return cache.notes[key].slice();
    }

    try{
      if(bl2Reqs() && typeof bl2Reqs().notes === "function"){
        cache.notes[key] = bl2Reqs().notes(row, NOTE_FIELDS) || [];
        return cache.notes[key].slice();
      }
    }catch(error){}

    var fromService = notasDesdeServicio(row);

    if(fromService){
      cache.notes[key] = fromService.slice();
      return cache.notes[key].slice();
    }

    var nart = numberValue(pick(row, NOTE_FIELDS[0].aliases, ""));
    var ndef = numberValue(pick(row, NOTE_FIELDS[1].aliases, ""));
    var nfin = numberValue(pick(row, NOTE_FIELDS[2].aliases, ""));

    if(nfin === null){
      nfin = calcularNfin(nart, ndef);
    }

    var values = {
      nart:nart,
      ndef:ndef,
      nfin:nfin
    };

    cache.notes[key] = NOTE_FIELDS.map(function(note){
      var n = values[note.key];

      return {
        key:note.key,
        label:note.label,
        value:n == null ? "—" : String(round2(n)),
        number:n,
        estado:estadoNota(n)
      };
    });

    return cache.notes[key].slice();
  }

  function telegramUrl(row){
    var info = telegramInfo(row);

    if(info.user){
      return "https://t.me/" + encodeURIComponent(info.user.replace(/^@+/, ""));
    }

    if(info.chatId){
      return "tg://user?id=" + encodeURIComponent(info.chatId);
    }

    return "";
  }

  function saludo(){
    var h = new Date().getHours();

    if(h < 12){ return "Buen día"; }
    if(h < 19){ return "Buena tarde"; }
    return "Buena noche";
  }

  function cleanPendingList(row, includeSpecial){
    return pendientes(row, includeSpecial).filter(function(item){
      var key = text(item && item.key).toLowerCase();
      var itemLabel = norm(item && item.label);

      return key !== "aprobaciontitulacion" &&
        key !== "aprobacioncomplexivoproyecto" &&
        itemLabel !== "aprobacion titulacion" &&
        itemLabel !== "aprobacion complexivo/proyecto";
    });
  }

  function studentMessage(row){
    row = normalizeFull(row || {});

    var faltantes = cleanPendingList(row, false);

    var lines = [
      saludo() + ", " + (row._nombres || "estudiante") + ".",
      "",
      "Le escribe Mgs. Jefferson Villarreal, Coordinador de Titulación.",
      "",
      "Carrera: " + (row._carrera || "—"),
      "Período: " + (periodDisplay(row) || "—"),
      ""
    ];

    if(faltantes.length){
      lines.push("Requisitos pendientes:");
      faltantes.forEach(function(item){
        lines.push("- " + item.label);
      });
    }else{
      lines.push("No registra requisitos pendientes.");
    }

    lines.push(
      "",
      "Por favor revisar y regularizar la información pendiente.",
      "Para cualquier consulta, escribir al WhatsApp: 098 840 2774."
    );

    return lines.join("\n");
  }

  function whatsappUrl(row){
    var base = normalizeLight(row || {});
    var phone = text(base._celular).replace(/[^0-9]/g, "");

    if(!phone){
      return "";
    }

    if(phone.length === 10 && phone.charAt(0) === "0"){
      phone = "593" + phone.slice(1);
    }

    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(studentMessage(base._raw || base));
  }

  function isValidEmail(value){
    value = text(value);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function emailList(row){
    row = normalizeLight(row || {});

    var raw = [
      row._correoPersonal,
      row._correoInstitucional,
      row._correo,
      row._raw && row._raw.correoPersonal,
      row._raw && row._raw.correoInstitucional,
      row._raw && row._raw.correo,
      row._raw && row._raw.Correo,
      row._raw && row._raw.email,
      row._raw && row._raw.Email
    ];

    var seen = {};
    var out = [];

    raw.forEach(function(value){
      var email = text(value);
      var key = email.toLowerCase();

      if(email && isValidEmail(email) && !seen[key]){
        seen[key] = true;
        out.push(email);
      }
    });

    return out;
  }

  function emailSubject(row){
    row = normalizeFull(row || {});
    return "Requisitos pendientes de titulación - " + (row._nombres || "Estudiante");
  }

  function emailMessage(row){
    row = normalizeFull(row || {});

    var faltantes = cleanPendingList(row, false);
    var lines = [
      saludo() + ", " + (row._nombres || "estudiante") + ".",
      "",
      "Le escribe Mgs. Jefferson Villarreal, Coordinador de Titulación.",
      "",
      "Se registra la siguiente información para su proceso de titulación:",
      "",
      "Carrera: " + (row._carrera || "—"),
      "Período: " + (periodDisplay(row) || "—"),
      ""
    ];

    if(faltantes.length){
      lines.push("Requisitos pendientes:");
      faltantes.forEach(function(item){
        lines.push("- " + item.label);
      });
    }else{
      lines.push("No registra requisitos pendientes en la ficha.");
    }

    lines.push(
      "",
      "Por favor revisar y regularizar la información pendiente.",
      "",
      "Para cualquier consulta, puede escribir al WhatsApp: 098 840 2774.",
      "",
      "Saludos cordiales,",
      "Mgs. Jefferson Villarreal",
      "Coordinador de Titulación"
    );

    return lines.join("\n");
  }

  function emailUrl(row){
    var emails = emailList(row);

    if(!emails.length){
      return "";
    }

    var to = emails.map(encodeURIComponent).join(",");
    var subject = encodeURIComponent(emailSubject(row));
    var body = encodeURIComponent(emailMessage(row));

    return "mailto:" + to + "?subject=" + subject + "&body=" + body;
  }

  function toText(row){
    if(!row){
      return "";
    }

    row = normalizeFull(row);

    var faltantes = pendientes(row, true);
    var tg = telegramInfo(row);
    var ns = notas(row);
    var approval = studentApproval(row);

    var lines = [
      "FICHA DEL ESTUDIANTE",
      "Nombre: " + row._nombres,
      "Cédula: " + row._cedula,
      "Carrera: " + row._carrera,
      "Período: " + periodDisplay(row),
      "Matrícula: " + row._estadoMatricula,
      "Tipo de período: " + (approval.periodType && approval.periodType.label || "—"),
      "Estado: " + (row._estado && row._estado.label || "—"),
      "Correo personal: " + (row._correoPersonal || "—"),
      "Correo institucional: " + (row._correoInstitucional || "—"),
      "Celular: " + (row._celular || "—"),
      "Telegram: " + (tg.user || tg.chatId || "—"),
      "",
      "REQUISITOS PENDIENTES"
    ];

    if(faltantes.length){
      faltantes.forEach(function(item){
        lines.push("- " + item.label);
      });
    }else{
      lines.push("Sin requisitos pendientes.");
    }

    lines.push("", "NOTAS");

    ns.forEach(function(note){
      lines.push(note.label + ": " + note.value);
    });

    return lines.join("\n");
  }

  function invalidate(){
    cache.periods = null;
    cache.base = {};
    cache.byId = {};
    cache.divisions = {};
    cache.listKey = "";
    cache.listRows = [];
    cache.full = {};
    cache.reqs = {};
    cache.specials = {};
    cache.notes = {};

    try{
      if(dataEngine() && typeof dataEngine().invalidate === "function"){
        dataEngine().invalidate();
      }
    }catch(error){}

    try{
      if(window.BL2CacheResumen && typeof window.BL2CacheResumen.invalidate === "function"){
        window.BL2CacheResumen.invalidate();
      }
    }catch(error){}
  }

  window.FichaCore = {
    VERSION:VERSION,
    BASE_REQS:FALLBACK_BASE,
    EXTRA_REQS:FALLBACK_EXTRA,
    SPECIAL_REQS:FALLBACK_FINAL,
    ALL_REQS:FALLBACK_BASE.concat(FALLBACK_EXTRA).concat(FALLBACK_FINAL),
    NOTE_FIELDS:NOTE_FIELDS,
    periods:periods,
    students:students,
    divisions:divisions,
    filter:filter,
    getById:getById,
    requisitos:requisitos,
    especiales:especiales,
    pendientes:pendientes,
    notas:notas,
    whatsappUrl:whatsappUrl,
    telegramUrl:telegramUrl,
    telegramInfo:telegramInfo,
    studentMessage:studentMessage,
    emailList:emailList,
    emailSubject:emailSubject,
    emailMessage:emailMessage,
    emailUrl:emailUrl,
    toText:toText,
    estadoCelda:estadoCelda,
    estadoNota:estadoNota,
    estadoMatricula:estadoMatricula,
    divisionOf:divisionOf,
    fieldValue:fieldValue,
    reqValue:reqValue,
    studentApproval:studentApproval,
    finalApproval:finalApproval,
    requirementsForStudent:requirementsForStudent,
    invalidate:invalidate,
    source:source,
    calcularNfin:calcularNfin,
    normalizeStudent:normalizeFull,
    normalizeLight:normalizeLight,
    normalizeFull:normalizeFull,
    searchTextFor:searchTextFor,
    periodDisplay:periodDisplay,
    cacheInfo:function(){
      return {
        baseKeys:Object.keys(cache.base).length,
        listRows:cache.listRows.length,
        fullKeys:Object.keys(cache.full).length,
        source:source()
      };
    }
  };
})(window);
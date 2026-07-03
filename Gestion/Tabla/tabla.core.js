/* =========================================================
Nombre completo: tabla.core.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.core.js
Función o funciones:
- Leer estudiantes desde BL2DataEngine y usar BL2/ExcelLocalRepo solo como respaldo.
- Normalizar una sola vez los estudiantes mientras no cambie la base.
- Calcular estado general respetando reglas Regular/PVC cuando exista BL2RequirementsEngine.
- Aplicar filtros de período, división, matrícula, carrera, estado y búsqueda.
- Entregar resultados paginados para no renderizar toda la base en pantalla.
- Entregar opciones de filtros sin recalcular toda la tabla varias veces.
- Comparar períodos de forma estable usando id, label y texto normalizado.
- Normalizar datos de WhatsApp y Telegram para contacto individual y masivo.
Con qué se conecta:
- ../../BDLocal/adapters/bdl.screen-deps.js
- BL2DataEngine / BL2StudentNormalizer / BL2RequirementsEngine cuando existan
- BL2EstudiantesRepo cuando exista
- ExcelLocalRepo como respaldo
- tabla.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.1.1-tabla-core-periodo-estable";

  var TELEGRAM_USER_ALIASES = [
    "_telegramUser",
    "telegramUser",
    "TelegramUser",
    "telegramuser",
    "usuarioTelegram",
    "UsuarioTelegram",
    "usuariotelegram",
    "telegram",
    "Telegram"
  ];

  var TELEGRAM_CHAT_ID_ALIASES = [
    "_telegramChatId",
    "telegramChatId",
    "TelegramChatId",
    "telegramchatid",
    "chatIdTelegram",
    "ChatIdTelegram",
    "chatidtelegram",
    "chatId",
    "ChatId",
    "chatid"
  ];

  var BASE_REQUIREMENTS = [
    {key:"academico", label:"Académico"},
    {key:"documentacion", label:"Documentación"},
    {key:"financiero", label:"Financiero"},
    {key:"practicasvinculacion", label:"Prácticas"},
    {key:"vinculacion", label:"Vinculación"},
    {key:"seguimientograduados", label:"Seguimiento graduados"},
    {key:"ingles", label:"Inglés"},
    {key:"actualizaciondatos", label:"Actualización de datos"}
  ];

  var cache = {
    baseKey:"",
    baseRows:[],
    filterKey:"",
    filterRows:[],
    optionsKey:"",
    options:null,
    periodsKey:"",
    periods:[]
  };

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

  function safeJson(value){
    try{
      return JSON.stringify(value || "");
    }catch(error){
      return String(value || "");
    }
  }

  function cleanTelegramUser(value){
    return text(value).replace(/^@+/, "").trim();
  }

  function dataEngine(){
    return window.BL2DataEngine || null;
  }

  function normalizer(){
    return window.BL2StudentNormalizer || null;
  }

  function reqEngine(){
    return window.BL2RequirementsEngine || window.StatsRules || null;
  }

  function bl2Repo(){
    return window.BL2EstudiantesRepo || null;
  }

  function pager(){
    return window.BL2PaginationService || null;
  }

  function repo(){
    if(!window.ExcelLocalRepo){
      throw new Error("ExcelLocalRepo no disponible. Primero carga Base Local.");
    }
    return window.ExcelLocalRepo;
  }

  function hasCore(){
    return !!(dataEngine() && typeof dataEngine().listStudents === "function");
  }

  function hasBL2Repo(){
    return !!(bl2Repo() && typeof bl2Repo().buscar === "function");
  }

  function source(){
    return hasCore() ? "BL2DataEngine" : (hasBL2Repo() ? "BL2" : "ExcelLocalRepo");
  }

  function clearCache(){
    cache = {
      baseKey:"",
      baseRows:[],
      filterKey:"",
      filterRows:[],
      optionsKey:"",
      options:null,
      periodsKey:"",
      periods:[]
    };
  }

  function keyPart(value){
    return encodeURIComponent(text(value));
  }

  function makeBaseKey(opts){
    opts = opts || {};
    return [
      source(),
      keyPart(opts.periodId),
      keyPart(opts.division),
      keyPart(opts.matricula == null ? "ACTIVO" : opts.matricula),
      keyPart(opts.search),
      opts.force === true ? "force" : ""
    ].join("|");
  }

  function makeFilterKey(opts){
    opts = opts || {};
    return [
      makeBaseKey(opts),
      keyPart(opts.career),
      keyPart(opts.status)
    ].join("|");
  }

  function makeOptionsKey(opts){
    opts = opts || {};
    return [
      source(),
      keyPart(opts.periodId),
      keyPart(opts.matricula == null ? "ACTIVO" : opts.matricula),
      keyPart(opts.division)
    ].join("|");
  }

  function estadoMatricula(value){
    return norm(value || "ACTIVO") === "retirado" ? "RETIRADO" : "ACTIVO";
  }

  function pick(row, aliases, fallback){
    row = row || {};
    aliases = aliases || [];
    var keys = Object.keys(row);
    var i;
    var j;
    var value;

    for(i = 0; i < aliases.length; i += 1){
      if(Object.prototype.hasOwnProperty.call(row, aliases[i])){
        value = row[aliases[i]];
        if(value != null && text(value) !== ""){return value;}
      }
    }

    for(i = 0; i < aliases.length; i += 1){
      for(j = 0; j < keys.length; j += 1){
        if(compact(keys[j]) === compact(aliases[i])){
          value = row[keys[j]];
          if(value != null && text(value) !== ""){return value;}
        }
      }
    }

    return fallback;
  }

  function telegramInfo(row){
    row = row || {};
    var user = cleanTelegramUser(pick(row, TELEGRAM_USER_ALIASES, ""));
    var chatId = text(pick(row, TELEGRAM_CHAT_ID_ALIASES, ""));

    return {
      user:user,
      chatId:chatId,
      hasTelegram:!!(user || chatId),
      canSendByBot:!!chatId
    };
  }

  function telegramUrl(row){
    var info = telegramInfo(row);
    if(info.user){return "https://t.me/" + encodeURIComponent(info.user);}
    if(info.chatId){return "tg://user?id=" + encodeURIComponent(info.chatId);}
    return "";
  }

  function valueOf(row, key){
    row = row || {};

    try{
      if(reqEngine() && typeof reqEngine().valueOf === "function"){
        return reqEngine().valueOf(row, key);
      }
    }catch(error){}

    try{
      if(normalizer() && typeof normalizer().value === "function"){
        return normalizer().value(row, key);
      }
    }catch(error){}

    if(Object.prototype.hasOwnProperty.call(row, key)){return row[key];}
    return "";
  }

  function estadoCelda(value){
    try{
      if(reqEngine() && typeof reqEngine().cellStatus === "function"){
        return reqEngine().cellStatus(value);
      }
    }catch(error){}

    var key = norm(value);
    if([
      "si",
      "sí",
      "s",
      "ok",
      "cumple",
      "aprobado",
      "aprobada",
      "1",
      "true",
      "x",
      "validado",
      "validada",
      "completo",
      "completa"
    ].indexOf(key) >= 0){
      return "cumple";
    }

    if(!key){return "pendiente";}
    return "no_cumple";
  }

  function applicableRequirements(row){
    try{
      if(reqEngine() && typeof reqEngine().requirementsForStudent === "function"){
        var list = reqEngine().requirementsForStudent(row || {});
        if(Array.isArray(list)){return list;}
      }
    }catch(error){}

    return BASE_REQUIREMENTS.slice();
  }

  function estadoEstudiante(row){
    row = row || {};

    try{
      if(reqEngine() && typeof reqEngine().studentApproval === "function"){
        var approval = reqEngine().studentApproval(row);
        var applicable = Array.isArray(approval && approval.applicableRequirements) ? approval.applicableRequirements : [];
        var missing = Array.isArray(approval && approval.missingRequirements) ? approval.missingRequirements : [];
        var pending = Array.isArray(approval && approval.pendingRequirements) ? approval.pendingRequirements : [];
        var okCount = Math.max(0, applicable.length - missing.length - pending.length);
        var id = approval && approval.approved ? "cumple" : (pending.length ? "pendiente" : "no_cumple");

        return {
          id:id,
          label:id === "cumple" ? "Cumple todo" : (id === "pendiente" ? "Con pendientes" : "No cumple"),
          ok:okCount,
          no:missing.length,
          pend:pending.length,
          approved:!!(approval && approval.approved),
          missingRequirements:missing,
          pendingRequirements:pending,
          applicableRequirements:applicable
        };
      }
    }catch(error){}

    var ok = 0;
    var no = 0;
    var pend = 0;

    applicableRequirements(row).forEach(function(req){
      var state = estadoCelda(valueOf(row, req.key));
      if(state === "cumple"){ok += 1;}
      else if(state === "pendiente"){pend += 1;}
      else{no += 1;}
    });

    var finalId = no ? "no_cumple" : (pend ? "pendiente" : "cumple");

    return {
      id:finalId,
      label:finalId === "cumple" ? "Cumple todo" : (finalId === "pendiente" ? "Con pendientes" : "No cumple"),
      ok:ok,
      no:no,
      pend:pend,
      approved:finalId === "cumple",
      missingRequirements:[],
      pendingRequirements:[],
      applicableRequirements:applicableRequirements(row)
    };
  }

  function snapshot(){
    return repo().getSnapshot ? repo().getSnapshot() : {periods:[], students:[]};
  }

  function periodId(item){
    item = item || {};
    if(typeof item !== "object"){return text(item);}
    return text(item.id || item.periodoId || item.periodId || item.value || item.key || item.codigo || item.label || item.periodoLabel || item.nombre || item.name);
  }

  function periodLabel(item){
    item = item || {};
    if(typeof item !== "object"){return text(item);}
    return text(item.label || item.periodoLabel || item.nombre || item.name || item.descripcion || item.id || item.periodoId || item.periodId || item.value || item.key);
  }

  function normalizePeriod(item){
    var id = periodId(item);
    var label = periodLabel(item) || id;
    if(!id && !label){return null;}
    return {
      id:id || label,
      value:id || label,
      label:label || id,
      raw:item
    };
  }

  function rawPeriods(){
    try{
      if(dataEngine() && typeof dataEngine().listPeriods === "function"){
        return dataEngine().listPeriods() || [];
      }
    }catch(error){}

    try{
      if(hasBL2Repo() && typeof bl2Repo().listPeriods === "function"){
        return bl2Repo().listPeriods() || [];
      }
    }catch(error){}

    try{
      if(repo().listPeriods){return repo().listPeriods() || [];}
      return snapshot().periods || [];
    }catch(error){
      return [];
    }
  }

  function periods(){
    var raw = rawPeriods();
    var key = source() + "|" + safeJson(raw);
    var map = Object.create(null);
    var out = [];

    if(cache.periodsKey === key && Array.isArray(cache.periods)){
      return cache.periods.slice();
    }

    raw.forEach(function(item){
      var p = normalizePeriod(item);
      var k;
      if(!p){return;}
      k = compact(p.id || p.label);
      if(!k){return;}
      if(!map[k]){
        map[k] = true;
        out.push(p);
      }
    });

    out.sort(function(a, b){
      return text(a.label || a.id).localeCompare(text(b.label || b.id), "es");
    });

    cache.periodsKey = key;
    cache.periods = out.slice();
    return out;
  }

  function periodTokens(value){
    var out = [];

    function add(v){
      v = text(v);
      if(v){out.push(v);}
    }

    if(value && typeof value === "object"){
      add(value.id);
      add(value.periodoId);
      add(value.periodId);
      add(value.value);
      add(value.key);
      add(value.codigo);
      add(value.label);
      add(value.periodoLabel);
      add(value.nombre);
      add(value.name);
      add(value.descripcion);
      add(value.raw);
    }else{
      add(value);
    }

    return out;
  }

  function sameToken(a, b){
    if(!text(a) || !text(b)){return false;}
    return text(a) === text(b) || norm(a) === norm(b) || compact(a) === compact(b);
  }

  function samePeriod(a, b){
    if(!text(b)){return true;}
    if(!text(a)){return false;}

    try{
      if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){
        if(window.BLPeriodosCanon.samePeriod(a, b)){return true;}
      }
    }catch(error){}

    var aTokens = periodTokens(a);
    var bTokens = periodTokens(b);
    var i;
    var j;

    for(i = 0; i < aTokens.length; i += 1){
      for(j = 0; j < bTokens.length; j += 1){
        if(sameToken(aTokens[i], bTokens[j])){return true;}
      }
    }

    return false;
  }

  function rowPeriodId(row){
    row = row || {};
    return text(row._bl2PeriodoId || row.periodoId || row.ultimoPeriodoId || row.periodId || row.idPeriodo || row._periodoId);
  }

  function rowPeriodLabel(row){
    row = row || {};
    return text(row._bl2Periodo || row.periodoLabel || row.periodo || row.Periodo || row._periodo || rowPeriodId(row));
  }

  function rowPeriodTokens(row){
    row = row || {};
    return [
      row._periodoId,
      row._periodo,
      row._bl2PeriodoId,
      row._bl2Periodo,
      row.periodoId,
      row.periodId,
      row.idPeriodo,
      row.ultimoPeriodoId,
      row.periodoLabel,
      row.periodo,
      row.Periodo
    ].filter(function(value){return text(value);});
  }

  function rowMatchesPeriod(row, wanted){
    if(!text(wanted)){return true;}
    return rowPeriodTokens(row).some(function(value){
      return samePeriod(value, wanted);
    });
  }

  function divisionOf(row){
    row = row || {};

    if(row._bl2Division){return row._bl2Division;}

    try{
      if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function"){
        return window.BLDivisionesService.studentDivision(row);
      }
    }catch(error){}

    var list = Array.isArray(row.divisiones) ? row.divisiones : [];
    return text(list[0] || row.division || row.Division || row["División"] || row.divisionPrincipal || "Sin división") || "Sin división";
  }

  function hasDivision(row, division){
    if(!text(division)){return true;}

    try{
      if(window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function"){
        return window.BLDivisionesService.hasDivision(row, division);
      }
    }catch(error){}

    if(row && row._bl2Division){return norm(row._bl2Division) === norm(division);}
    return norm(divisionOf(row)) === norm(division);
  }

  function normalizeRow(row){
    if(normalizer() && typeof normalizer().normalize === "function"){
      try{return normalizer().normalize(row || {}, {clone:false});}catch(error){}
    }
    return Object.assign({}, row || {});
  }

  function buildSearchText(row){
    return norm([
      row._cedula,
      row._nombres,
      row._carrera,
      row._division,
      row._correo,
      row._correoPersonal,
      row._correoInstitucional,
      row._celular,
      row._telegramUser,
      row._telegramChatId,
      row._periodo,
      row._periodoId,
      row.periodoLabel,
      row.periodoId,
      row.periodo,
      row._estadoMatricula,
      row._estadoGeneral && row._estadoGeneral.label
    ].join(" "));
  }

  function decorate(row){
    var r = normalizeRow(row);
    var tg = telegramInfo(r);

    r._estadoGeneral = estadoEstudiante(r);
    r._estadoMatricula = estadoMatricula(r._bl2EstadoMatricula || r.estadoMatricula || r.EstadoMatricula || r.matricula);
    r._cedula = text(r._bl2Id || r.cedula || r.Cedula || r.numeroIdentificacion || r.NumeroIdentificacion || r.identificacion || r.Identificacion);
    r._nombres = text(r._bl2Nombre || r.nombres || r.Nombres || r.nombre || r.Nombre || r.estudiante || r.Estudiante);
    r._carrera = text(r._bl2Carrera || r.nombrecarrera || r.nombreCarrera || r.NombreCarrera || r.carrera || r.Carrera) || "SIN CARRERA";
    r._division = divisionOf(r);
    r._celular = text(r._bl2Celular || r.celular || r.Celular || r.telefono || r.Telefono || r.whatsapp || r.Whatsapp);
    r._correoPersonal = text(r._bl2CorreoPersonal || r.correopersonal || r.CorreoPersonal || r.correoPersonal);
    r._correoInstitucional = text(r._bl2CorreoInstitucional || r.correoinstitucional || r.CorreoInstitucional || r.correoInstitucional);
    r._correo = text(r._correoPersonal || r._correoInstitucional || r.correo || r.Correo || r.email || r.Email);
    r._periodoId = rowPeriodId(r);
    r._periodo = rowPeriodLabel(r) || r._periodoId || "SIN PERÍODO";
    r._telegramUser = tg.user;
    r._telegramChatId = tg.chatId;
    r._telegramTiene = tg.hasTelegram;
    r._telegramBot = tg.canSendByBot;
    r._searchText = buildSearchText(r);

    return r;
  }

  function rowsFromCore(opts){
    var result = dataEngine().listStudents({
      periodId:opts.periodId || "",
      division:opts.division || "",
      matricula:opts.matricula == null ? "ACTIVO" : opts.matricula,
      search:opts.search || "",
      limit:0,
      force:opts.force === true
    }) || {};

    return (result.rows || []).map(decorate);
  }

  function rowsFromRepo(opts){
    var result = bl2Repo().buscar({
      periodId:opts.periodId || "",
      division:opts.division || "",
      matricula:opts.matricula == null ? "ACTIVO" : opts.matricula,
      search:opts.search || "",
      limit:0
    }) || {};

    return (result.rows || []).map(decorate);
  }

  function rowsFromExcel(opts){
    var matricula = opts.matricula == null ? "ACTIVO" : text(opts.matricula);
    var rows = [];

    try{
      if(repo().filterStudents){
        rows = repo().filterStudents({
          periodoId:opts.periodId || "",
          periodId:opts.periodId || "",
          estadoMatricula:matricula,
          matricula:matricula,
          division:opts.division || ""
        });
      }else if(repo().listStudentsByStatus && matricula !== undefined){
        rows = repo().listStudentsByStatus(matricula || "");
      }else if(repo().listAllStudents){
        rows = repo().listAllStudents();
      }else{
        rows = snapshot().students || [];
      }
    }catch(error){
      rows = [];
    }

    return (rows || []).map(decorate);
  }

  function baseRows(opts){
    opts = opts || {};
    var key = makeBaseKey(opts);
    var rows = [];

    if(cache.baseKey === key && Array.isArray(cache.baseRows)){
      return cache.baseRows;
    }

    try{
      if(hasCore()){
        rows = rowsFromCore(opts);
        cache.baseKey = key;
        cache.baseRows = rows;
        return rows;
      }
    }catch(error){
      console.warn("[TablaCore] BL2DataEngine falló", error);
    }

    try{
      if(hasBL2Repo()){
        rows = rowsFromRepo(opts);
        cache.baseKey = key;
        cache.baseRows = rows;
        return rows;
      }
    }catch(error2){
      console.warn("[TablaCore] BL2EstudiantesRepo falló", error2);
    }

    rows = rowsFromExcel(opts);
    cache.baseKey = key;
    cache.baseRows = rows;
    return rows;
  }

  function normalizeStatusFilter(status){
    status = text(status);
    if(status === "pendiente"){return "pendiente";}
    return status;
  }

  function filterAll(opts){
    opts = opts || {};

    var key = makeFilterKey(opts);
    var q = norm(opts.search);
    var periodIdValue = text(opts.periodId);
    var division = text(opts.division);
    var career = text(opts.career || opts.carrera);
    var status = normalizeStatusFilter(opts.status || opts.estado);
    var matricula = opts.matricula == null ? "ACTIVO" : text(opts.matricula);
    var rows;

    if(cache.filterKey === key && Array.isArray(cache.filterRows)){
      return cache.filterRows;
    }

    rows = baseRows(opts).filter(function(row){
      if(matricula && row._estadoMatricula !== matricula){return false;}
      if(periodIdValue && !rowMatchesPeriod(row, periodIdValue)){return false;}
      if(division && !hasDivision(row, division)){return false;}
      if(career && row._carrera !== career){return false;}
      if(status && (!row._estadoGeneral || row._estadoGeneral.id !== status)){return false;}
      if(q && String(row._searchText || "").indexOf(q) < 0){return false;}
      return true;
    });

    cache.filterKey = key;
    cache.filterRows = rows;
    return rows;
  }

  function filter(opts){
    return filterAll(opts);
  }

  function listOptions(values){
    var map = Object.create(null);

    (values || []).forEach(function(value){
      value = text(value);
      if(value){map[value] = true;}
    });

    return Object.keys(map).sort(function(a, b){
      return a.localeCompare(b, "es");
    });
  }

  function careers(list){
    return listOptions((list || baseRows({matricula:"ACTIVO", limit:0})).map(function(row){
      return row._carrera || "SIN CARRERA";
    }));
  }

  function divisions(list, opts){
    opts = opts || {};

    if(!list && hasBL2Repo() && typeof bl2Repo().listDivisions === "function"){
      try{
        return bl2Repo().listDivisions({
          periodId:opts.periodId || "",
          matricula:opts.matricula == null ? "ACTIVO" : opts.matricula
        }) || [];
      }catch(error){}
    }

    var rows = list || baseRows({
      periodId:opts.periodId || "",
      matricula:opts.matricula == null ? "ACTIVO" : opts.matricula,
      limit:0
    });

    try{
      if(window.BLDivisionesService && typeof window.BLDivisionesService.listDivisionsWithEmpty === "function"){
        return window.BLDivisionesService.listDivisionsWithEmpty(rows, "");
      }
    }catch(error){}

    return listOptions(rows.map(function(row){return divisionOf(row);}));
  }

  function options(opts){
    opts = opts || {};
    var key = makeOptionsKey(opts);
    var rows;
    var divisionMap = Object.create(null);
    var careerMap = Object.create(null);

    if(cache.optionsKey === key && cache.options){
      return {
        divisions:(cache.options.divisions || []).slice(),
        careers:(cache.options.careers || []).slice()
      };
    }

    rows = baseRows({
      periodId:opts.periodId || "",
      matricula:opts.matricula == null ? "ACTIVO" : opts.matricula,
      division:"",
      search:""
    });

    rows.forEach(function(row){
      var div = text(row._division || divisionOf(row)) || "Sin división";
      divisionMap[div] = true;

      if(!text(opts.division) || hasDivision(row, opts.division)){
        careerMap[text(row._carrera) || "SIN CARRERA"] = true;
      }
    });

    cache.optionsKey = key;
    cache.options = {
      divisions:Object.keys(divisionMap).sort(function(a, b){return a.localeCompare(b, "es");}),
      careers:Object.keys(careerMap).sort(function(a, b){return a.localeCompare(b, "es");})
    };

    return {
      divisions:cache.options.divisions.slice(),
      careers:cache.options.careers.slice()
    };
  }

  function buildPager(total, opts){
    opts = opts || {};
    var size = Number(opts.pageSize || 100) || 100;
    var pages = Math.max(1, Math.ceil(total / size));
    var page = Math.min(Math.max(1, Number(opts.page || 1) || 1), pages);
    var offset = (page - 1) * size;
    var p;

    if(pager() && typeof pager().build === "function"){
      try{
        p = pager().build(total, {page:page, pageSize:size});
        p.page = page;
        p.pageSize = size;
        p.offset = offset;
        p.pages = pages;
        p.total = total;
        p.hasPrev = page > 1;
        p.hasNext = page < pages;
        p.label = total + " registros";
        return p;
      }catch(error){}
    }

    return {
      page:page,
      pageSize:size,
      offset:offset,
      total:total,
      pages:pages,
      hasPrev:page > 1,
      hasNext:page < pages,
      label:total + " registros"
    };
  }

  function page(opts){
    opts = opts || {};
    var rows = filterAll(opts);
    var pageInfo = buildPager(rows.length, opts);
    var pageRows = rows.slice(pageInfo.offset, pageInfo.offset + pageInfo.pageSize);

    return {
      rows:pageRows,
      allRows:rows,
      total:rows.length,
      pagination:pageInfo,
      summary:summary(rows),
      source:source()
    };
  }

  function summary(list){
    list = Array.isArray(list) ? list : [];
    var careerMap = Object.create(null);
    var counters = {
      total:list.length,
      cumple:0,
      pendiente:0,
      no_cumple:0,
      carreras:0
    };

    list.forEach(function(row){
      var id = row._estadoGeneral && row._estadoGeneral.id ? row._estadoGeneral.id : "no_cumple";
      if(!Object.prototype.hasOwnProperty.call(counters, id)){counters[id] = 0;}
      counters[id] += 1;
      careerMap[text(row._carrera) || "SIN CARRERA"] = true;
    });

    counters.carreras = Object.keys(careerMap).length;
    return counters;
  }

  function whatsappUrl(row){
    var phone = text(row && row._celular).replace(/[^0-9]/g, "");
    var msg;

    if(!phone){return "";}

    if(phone.length === 10 && phone.charAt(0) === "0"){
      phone = "593" + phone.slice(1);
    }

    msg = "Estimado/a " + ((row && row._nombres) || "estudiante") + ", le escribimos sobre sus requisitos de titulación.";
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(msg);
  }

  window.TablaCore = {
    version:VERSION,
    estadoEstudiante:estadoEstudiante,
    estadoMatricula:estadoMatricula,
    periods:periods,
    students:function(matricula){
      return baseRows({matricula:matricula == null ? "ACTIVO" : matricula});
    },
    careers:careers,
    divisions:divisions,
    options:options,
    filter:filter,
    page:page,
    summary:summary,
    whatsappUrl:whatsappUrl,
    telegramInfo:telegramInfo,
    telegramUrl:telegramUrl,
    decorate:decorate,
    divisionOf:divisionOf,
    samePeriod:samePeriod,
    source:source,
    clearCache:clearCache
  };
})(window);
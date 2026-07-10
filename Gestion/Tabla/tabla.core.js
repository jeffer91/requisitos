/* =========================================================
Nombre completo: tabla.core.js
Ruta: /Requisitos/Gestion/Tabla/tabla.core.js
Función:
- Motor de datos para Tabla.
- Lee estudiantes desde BL2DataEngine, BL2EstudiantesRepo o ExcelLocalRepo.
- Filtra por período, división, carrera, búsqueda y requisitos activos.
- Versión corregida para reducir cuelgues:
  1) decoración liviana inicial,
  2) cálculo de requisitos bajo demanda y con caché,
  3) opciones de carrera/división sin recalcular requisitos,
  4) caché por filtros para evitar reprocesar en cada render.
========================================================= */
(function(window){
  "use strict";

  var VERSION="2.3.0-tabla-core-lazy-cache";

  var REQS=[
    {key:"academico",short:"Aca",label:"Académico",aliases:["academico","académico","aprobacionAcademica","aprobacion_academica"]},
    {key:"documentacion",short:"Doc",label:"Documentación académica",aliases:["documentacion","documentación","documentacionacademica","documentación académica","documentos"]},
    {key:"financiero",short:"Fin",label:"Financiero",aliases:["financiero","deuda","pago","pagos","estadoFinanciero"]},
    {key:"titulacion",short:"Tit",label:"Titulación",aliases:["titulacion","titulación","aprobaciontitulacion","aprobacionTitulacion"]},
    {key:"practicasvinculacion",short:"PP",label:"Prácticas preprofesionales",aliases:["practicasvinculacion","prácticas vinculación","practicas","prácticas","practicaspreprofesionales"]},
    {key:"vinculacion",short:"Vinc",label:"Vinculación",aliases:["vinculacion","vinculación"]},
    {key:"seguimientograduados",short:"Grad",label:"Seguimiento a graduados",aliases:["seguimientograduados","seguimiento graduados","graduados"]},
    {key:"ingles",short:"Ing",label:"Segunda lengua / Inglés",aliases:["ingles","inglés","segundalengua","segunda lengua"]},
    {key:"actualizaciondatos",short:"Datos",label:"Actualización de datos",aliases:["actualizaciondatos","actualización datos","datos"]}
  ];

  var ALIAS={
    falta:"falta",faltan:"falta",in:"falta",incompleto:"falta",incompletos:"falta",
    aca:"academico",academico:"academico",academica:"academico",
    doc:"documentacion",docs:"documentacion",documentacion:"documentacion",documentos:"documentacion",
    fin:"financiero",financiero:"financiero",deuda:"financiero",pago:"financiero",pagos:"financiero",
    tit:"titulacion",titulacion:"titulacion",
    pp:"practicasvinculacion",practicas:"practicasvinculacion",practicasvinculacion:"practicasvinculacion",
    vinc:"vinculacion",vinculacion:"vinculacion",
    grad:"seguimientograduados",graduados:"seguimientograduados",seguimientograduados:"seguimientograduados",
    ing:"ingles",ingles:"ingles",segundalengua:"ingles",
    datos:"actualizaciondatos",actualizaciondatos:"actualizaciondatos",
    nart:"nota_articulo",notaarticulo:"nota_articulo",nota_articulo:"nota_articulo",
    ndef:"nota_defensa",notadefensa:"nota_defensa",nota_defensa:"nota_defensa",
    sinarticulo:"sin_articulo",sin_articulo:"sin_articulo",
    noaprueba:"no_aprueba",no_aprueba:"no_aprueba"
  };

  var NOTE={nota_articulo:true,nota_defensa:true,sin_articulo:true,no_aprueba:true};
  var TG_USER=["_telegramUser","telegramUser","TelegramUser","telegramuser","usuarioTelegram","UsuarioTelegram","usuariotelegram","telegram","Telegram"];
  var TG_ID=["_telegramChatId","telegramChatId","TelegramChatId","telegramchatid","chatIdTelegram","ChatIdTelegram","chatidtelegram","chatId","ChatId","chatid"];

  var cache={
    baseKey:"",
    baseRows:[],
    filterKey:"",
    filterRows:[],
    pageKey:"",
    pageResult:null,
    optionsKey:"",
    options:null,
    periodsKey:"",
    periods:[]
  };

  function text(value){return String(value==null?"":value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g,"");}
  function enc(value){return encodeURIComponent(text(value));}
  function json(value){try{return JSON.stringify(value||"");}catch(error){return String(value||"");}}

  function dataEngine(){return window.BL2DataEngine||null;}
  function normalizer(){return window.BL2StudentNormalizer||null;}
  function reqEngine(){return window.BL2RequirementsEngine||window.StatsRules||null;}
  function bl2Repo(){return window.BL2EstudiantesRepo||null;}
  function pager(){return window.BL2PaginationService||null;}

  function repo(){
    if(!window.ExcelLocalRepo)throw new Error("ExcelLocalRepo no disponible. Primero carga Base Local.");
    return window.ExcelLocalRepo;
  }

  function hasCore(){return !!(dataEngine()&&typeof dataEngine().listStudents==="function");}
  function hasBL2Repo(){return !!(bl2Repo()&&typeof bl2Repo().buscar==="function");}
  function source(){return hasCore()?"BL2DataEngine":(hasBL2Repo()?"BL2":"ExcelLocalRepo");}

  function clearCache(){
    cache={baseKey:"",baseRows:[],filterKey:"",filterRows:[],pageKey:"",pageResult:null,optionsKey:"",options:null,periodsKey:"",periods:[]};
  }

  function reqKey(value){return ALIAS[compact(value)]||compact(value);}

  function reqFilters(value){
    var out=[];
    var map={};

    function add(item){
      var key=reqKey(item);
      if(key&&!map[key]&&key!=="todos"&&key!=="all"){
        map[key]=true;
        out.push(key);
      }
    }

    if(Array.isArray(value)){
      value.forEach(add);
    }else if(value&&typeof value==="object"){
      Object.keys(value).forEach(function(key){if(value[key])add(key);});
    }else if(text(value)){
      text(value).split(/[|,;\s]+/).forEach(add);
    }

    return out;
  }

  function reqFiltersFromOpts(opts){
    opts=opts||{};
    return reqFilters(opts.requirements||opts.activeRequirements||opts.requirementFilters||opts.reqFilters||opts.filtrosRequisitos||opts.requisitosActivos||"");
  }

  function makeBaseKey(opts){
    opts=opts||{};
    return [
      source(),
      enc(opts.periodId),
      enc(opts.division),
      enc(opts.matricula==null?"ACTIVO":opts.matricula),
      enc(opts.search),
      opts.force===true?"force":""
    ].join("|");
  }

  function makeFilterKey(opts){
    opts=opts||{};
    return [
      makeBaseKey(opts),
      enc(opts.career||opts.carrera),
      enc(opts.status||opts.estado),
      enc(reqFiltersFromOpts(opts).join(","))
    ].join("|");
  }

  function makePageKey(opts){
    opts=opts||{};
    return [makeFilterKey(opts),Number(opts.page||1)||1,Number(opts.pageSize||100)||100].join("|");
  }

  function makeOptionsKey(opts){
    opts=opts||{};
    return [source(),enc(opts.periodId),enc(opts.matricula==null?"ACTIVO":opts.matricula),enc(opts.division)].join("|");
  }

  function estadoMatricula(value){
    return norm(value||"ACTIVO")==="retirado"?"RETIRADO":"ACTIVO";
  }

  function pick(row,aliases,fallback){
    row=row||{};
    aliases=aliases||[];

    var keys=Object.keys(row);
    var i;
    var j;
    var value;

    for(i=0;i<aliases.length;i++){
      if(Object.prototype.hasOwnProperty.call(row,aliases[i])){
        value=row[aliases[i]];
        if(value!=null&&text(value)!=="")return value;
      }
    }

    for(i=0;i<aliases.length;i++){
      for(j=0;j<keys.length;j++){
        if(compact(keys[j])===compact(aliases[i])){
          value=row[keys[j]];
          if(value!=null&&text(value)!=="")return value;
        }
      }
    }

    return fallback;
  }

  function reqDef(key){
    key=reqKey(key);
    for(var i=0;i<REQS.length;i++){
      if(REQS[i].key===key)return REQS[i];
    }
    return {key:key,short:key,label:key,aliases:[key]};
  }

  function telegramInfo(row){
    row=row||{};
    var user=text(pick(row,TG_USER,"")).replace(/^@+/,"");
    var chatId=text(pick(row,TG_ID,""));

    return {user:user,chatId:chatId,hasTelegram:!!(user||chatId),canSendByBot:!!chatId};
  }

  function telegramUrl(row){
    var info=telegramInfo(row);
    if(info.user)return "https://t.me/"+encodeURIComponent(info.user);
    if(info.chatId)return "tg://user?id="+encodeURIComponent(info.chatId);
    return "";
  }

  function valueOf(row,key){
    row=row||{};
    key=reqKey(key);

    var def=reqDef(key);
    var value;

    try{
      if(reqEngine()&&typeof reqEngine().valueOf==="function"){
        value=reqEngine().valueOf(row,key);
        if(value!=null&&text(value)!=="")return value;
      }
    }catch(error){}

    try{
      if(normalizer()&&typeof normalizer().value==="function"){
        value=normalizer().value(row,key);
        if(value!=null&&text(value)!=="")return value;
      }
    }catch(error2){}

    if(Object.prototype.hasOwnProperty.call(row,key))return row[key];

    return pick(row,def.aliases||[key],"");
  }

  function estadoCelda(value){
    try{
      if(reqEngine()&&typeof reqEngine().cellStatus==="function"){
        var status=reqEngine().cellStatus(value);
        if(status)return status;
      }
    }catch(error){}

    var key=norm(value);

    if(["si","sí","s","ok","cumple","aprobado","aprobada","1","true","x","validado","validada","completo","completa"].indexOf(key)>=0)return "cumple";
    if(!key||key==="pendiente"||key==="por revisar"||key==="sin registrar")return "pendiente";

    return "no_cumple";
  }

  function estadoLabel(status){
    return status==="cumple"?"Cumple":(status==="pendiente"?"Pendiente":"No cumple");
  }

  function applicableRequirements(row){
    var list=[];

    try{
      if(reqEngine()&&typeof reqEngine().requirementsForStudent==="function"){
        list=reqEngine().requirementsForStudent(row||{})||[];
      }
    }catch(error){
      list=[];
    }

    if(!Array.isArray(list)||!list.length)list=REQS.slice();

    var map={};
    var out=[];

    list.forEach(function(item){
      var def;

      if(typeof item==="string"){
        def=reqDef(item);
      }else{
        def=Object.assign({},reqDef(item.key||item.id||item.field||item.campo||item.label),item);
      }

      def.key=reqKey(def.key||def.id||def.field||def.campo||def.label);

      if(!def.key||NOTE[def.key]||map[def.key])return;

      map[def.key]=true;
      out.push(def);
    });

    return out;
  }

  function requirementInfo(row,key){
    var def=reqDef(key);
    var raw=valueOf(row,def.key);
    var status=estadoCelda(raw);

    return {
      key:def.key,
      short:def.short,
      label:def.label,
      value:text(raw),
      estado:status,
      estadoLabel:estadoLabel(status),
      missing:status!=="cumple"
    };
  }

  function requirementStatusMap(row){
    var out={};

    applicableRequirements(row).forEach(function(req){
      out[req.key]=requirementInfo(row,req.key);
    });

    return out;
  }

  function ensureRequirementState(row){
    row=row||{};

    if(row._tablaReqReady)return row;

    var reqs=applicableRequirements(row);
    var map={};
    var missing=[];
    var no=0;
    var pend=0;

    reqs.forEach(function(req){
      var info=requirementInfo(row,req.key);
      map[req.key]=info;

      if(info.missing){
        missing.push(info);
        if(info.estado==="no_cumple")no+=1;
        else if(info.estado==="pendiente")pend+=1;
      }
    });

    var id=no?"no_cumple":(pend?"pendiente":"cumple");

    row._reqStatusMap=map;
    row._requisitosFaltantes=missing;
    row._estadoGeneral={
      id:id,
      label:id==="cumple"?"Cumple todo":(id==="pendiente"?"Con pendientes":"No cumple"),
      ok:Math.max(0,reqs.length-missing.length),
      no:no,
      pend:pend,
      approved:id==="cumple",
      missingRequirements:missing,
      pendingRequirements:missing.filter(function(item){return item.estado==="pendiente";}),
      applicableRequirements:reqs
    };
    row._notasInfo=noteInfo(row);
    row._tablaReqReady=true;

    return row;
  }

  function missingRequirements(row){
    row=ensureRequirementState(row||{});
    return (row._requisitosFaltantes||[]).slice();
  }

  function hasAnyMissing(row){
    row=ensureRequirementState(row||{});
    return (row._requisitosFaltantes||[]).length>0;
  }

  function num(value){
    var raw=text(value).replace(",",".").replace(/[^0-9.\-]/g,"");
    if(!raw)return null;

    var n=Number(raw);
    return isNaN(n)?null:n;
  }

  function firstNum(row,aliases){
    return num(pick(row||{},aliases||[],""));
  }

  function noteInfo(row){
    row=row||{};

    var art=firstNum(row,["_notart","notart","Notart","N-Art","NART","notaArticulo","nota_articulo","articulo","Artículo","Articulo"]);
    var def=firstNum(row,["_notdef","notdef","Notdef","N-Def","NDEF","notaDefensa","nota_defensa","defensa","Defensa"]);
    var fin=firstNum(row,["_notafinal","notafinal","Notafinal","N-Fin","NFIN","notaFinal","nota_final","final"]);

    if(fin==null&&art!=null&&def!=null)fin=Number((art*0.7+def*0.3).toFixed(2));

    return {
      articulo:art,
      defensa:def,
      final:fin,
      faltaArticulo:art==null||art<7,
      faltaDefensa:def==null||def<7,
      sinArticulo:art==null,
      noAprueba:art==null||art<7||def==null||def<7||(fin!=null&&fin<7)
    };
  }

  function noteFilterMatches(row,key){
    var info=row&&row._notasInfo?row._notasInfo:noteInfo(row||{});

    if(key==="nota_articulo")return !!info.faltaArticulo;
    if(key==="nota_defensa")return !!info.faltaDefensa;
    if(key==="sin_articulo")return !!info.sinArticulo;
    if(key==="no_aprueba")return !!info.noAprueba;

    return false;
  }

  function hasRequirementMissing(row,key){
    key=reqKey(key);

    if(key==="falta")return hasAnyMissing(row);
    if(NOTE[key])return noteFilterMatches(row,key);

    row=ensureRequirementState(row||{});

    if(!row._reqStatusMap[key]){
      row._reqStatusMap[key]=requirementInfo(row,key);
    }

    return !!(row._reqStatusMap[key]&&row._reqStatusMap[key].missing);
  }

  function matchesRequirementFilters(row,filters){
    filters=reqFilters(filters);

    if(!filters.length)return true;

    var specific=filters.filter(function(key){return key!=="falta";});

    if(!specific.length)return hasAnyMissing(row);

    return specific.every(function(key){
      return hasRequirementMissing(row,key);
    });
  }

  function estadoEstudiante(row){
    row=ensureRequirementState(row||{});
    return Object.assign({},row._estadoGeneral);
  }

  function snapshot(){
    return repo().getSnapshot?repo().getSnapshot():{periods:[],students:[]};
  }

  function periodId(item){
    item=item||{};
    if(typeof item!=="object")return text(item);
    return text(item.id||item.periodoId||item.periodId||item.value||item.key||item.codigo||item.label||item.periodoLabel||item.nombre||item.name);
  }

  function periodLabel(item){
    item=item||{};
    if(typeof item!=="object")return text(item);
    return text(item.label||item.periodoLabel||item.nombre||item.name||item.descripcion||item.id||item.periodoId||item.periodId||item.value||item.key);
  }

  function normalizePeriod(item){
    var id=periodId(item);
    var label=periodLabel(item)||id;

    if(!id&&!label)return null;

    return {id:id||label,value:id||label,label:label||id,raw:item};
  }

  function rawPeriods(){
    try{
      if(dataEngine()&&typeof dataEngine().listPeriods==="function")return dataEngine().listPeriods()||[];
    }catch(error){}

    try{
      if(hasBL2Repo()&&typeof bl2Repo().listPeriods==="function")return bl2Repo().listPeriods()||[];
    }catch(error2){}

    try{
      if(repo().listPeriods)return repo().listPeriods()||[];
      return snapshot().periods||[];
    }catch(error3){
      return [];
    }
  }

  function periods(){
    var raw=rawPeriods();
    var key=source()+"|"+json(raw);
    var map={};
    var out=[];

    if(cache.periodsKey===key&&Array.isArray(cache.periods))return cache.periods.slice();

    raw.forEach(function(item){
      var period=normalizePeriod(item);
      var key2;

      if(!period)return;

      key2=compact(period.id||period.label);
      if(!key2||map[key2])return;

      map[key2]=true;
      out.push(period);
    });

    out.sort(function(a,b){return text(a.label||a.id).localeCompare(text(b.label||b.id),"es");});

    cache.periodsKey=key;
    cache.periods=out.slice();

    return out;
  }

  function periodTokens(value){
    var out=[];

    function add(item){
      item=text(item);
      if(item)out.push(item);
    }

    if(value&&typeof value==="object"){
      ["id","periodoId","periodId","value","key","codigo","label","periodoLabel","nombre","name","descripcion","raw"].forEach(function(key){add(value[key]);});
    }else{
      add(value);
    }

    return out;
  }

  function sameToken(a,b){
    return !!(text(a)&&text(b)&&(text(a)===text(b)||norm(a)===norm(b)||compact(a)===compact(b)));
  }

  function samePeriod(a,b){
    if(!text(b))return true;
    if(!text(a))return false;

    try{
      if(window.BLPeriodosCanon&&typeof window.BLPeriodosCanon.samePeriod==="function"&&window.BLPeriodosCanon.samePeriod(a,b))return true;
    }catch(error){}

    var A=periodTokens(a);
    var B=periodTokens(b);

    for(var i=0;i<A.length;i++){
      for(var j=0;j<B.length;j++){
        if(sameToken(A[i],B[j]))return true;
      }
    }

    return false;
  }

  function rowPeriodId(row){
    row=row||{};
    return text(row._bl2PeriodoId||row.periodoId||row.ultimoPeriodoId||row.periodId||row.idPeriodo||row._periodoId);
  }

  function rowPeriodLabel(row){
    row=row||{};
    return text(row._bl2Periodo||row.periodoLabel||row.periodo||row.Periodo||row._periodo||rowPeriodId(row));
  }

  function rowPeriodTokens(row){
    row=row||{};
    return [row._periodoId,row._periodo,row._bl2PeriodoId,row._bl2Periodo,row.periodoId,row.periodId,row.idPeriodo,row.ultimoPeriodoId,row.periodoLabel,row.periodo,row.Periodo].filter(function(value){return text(value);});
  }

  function rowMatchesPeriod(row,wanted){
    if(!text(wanted))return true;
    return rowPeriodTokens(row).some(function(value){return samePeriod(value,wanted);});
  }

  function divisionOf(row){
    row=row||{};

    if(row._bl2Division)return row._bl2Division;

    try{
      if(window.BLDivisionesService&&typeof window.BLDivisionesService.studentDivision==="function"){
        return window.BLDivisionesService.studentDivision(row);
      }
    }catch(error){}

    var list=Array.isArray(row.divisiones)?row.divisiones:[];

    return text(list[0]||row.division||row.Division||row["División"]||row.divisionPrincipal||"Sin división")||"Sin división";
  }

  function hasDivision(row,division){
    if(!text(division))return true;

    try{
      if(window.BLDivisionesService&&typeof window.BLDivisionesService.hasDivision==="function"){
        return window.BLDivisionesService.hasDivision(row,division);
      }
    }catch(error){}

    if(row&&row._bl2Division)return norm(row._bl2Division)===norm(division);

    return norm(divisionOf(row))===norm(division);
  }

  function normalizeRow(row){
    if(normalizer()&&typeof normalizer().normalize==="function"){
      try{return normalizer().normalize(row||{},{clone:true});}catch(error){}
    }

    return Object.assign({},row||{});
  }

  function abreviarCarrera(value){
    var original=text(value)||"SIN CARRERA";
    var key=norm(original);
    var prefix=key.indexOf("universitaria")>=0||key.indexOf("universitario")>=0||key.indexOf("licenciatura")>=0?"U.":"T.";

    if(key.indexOf("administr")>=0)return prefix+" Admin";
    if(key.indexOf("enfermer")>=0)return prefix+" Enf";
    if(key.indexOf("software")>=0||key.indexOf("desarrollo")>=0)return prefix+" Software";
    if(key.indexOf("marketing")>=0||key.indexOf("mercad")>=0)return prefix+" Mkt";
    if(key.indexOf("alimento")>=0)return prefix+" Alimentos";
    if(key.indexOf("talento")>=0||key.indexOf("humano")>=0)return prefix+" Tal. Hum";
    if(key.indexOf("redes")>=0||key.indexOf("fibra")>=0)return prefix+" Redes";
    if(key.indexOf("electron")>=0)return prefix+" Electr";
    if(original.length<=18)return original;

    return original.split(/\s+/).filter(function(word){return word.length>3;}).slice(0,2).join(" ")||original.slice(0,18);
  }

  function buildSearchText(row){
    return norm([
      row._cedula,row._nombres,row._carrera,row._carreraCorta,row._division,
      row._correo,row._correoPersonal,row._correoInstitucional,row._celular,
      row._telegramUser,row._telegramChatId,row._periodo,row._periodoId,
      row.periodoLabel,row.periodoId,row.periodo,row._estadoMatricula
    ].join(" "));
  }

  function decorate(row){
    var r=normalizeRow(row);
    var tg=telegramInfo(r);

    r._estadoMatricula=estadoMatricula(r._bl2EstadoMatricula||r.estadoMatricula||r.EstadoMatricula||r.matricula);
    r._cedula=text(r._bl2Id||r.cedula||r.Cedula||r.numeroIdentificacion||r.NumeroIdentificacion||r.identificacion||r.Identificacion);
    r._nombres=text(r._bl2Nombre||r.nombres||r.Nombres||r.nombre||r.Nombre||r.estudiante||r.Estudiante)||"SIN NOMBRE";
    r._carrera=text(r._bl2Carrera||r.nombrecarrera||r.nombreCarrera||r.NombreCarrera||r.carrera||r.Carrera)||"SIN CARRERA";
    r._carreraCorta=abreviarCarrera(r._carrera);
    r._division=divisionOf(r);
    r._celular=text(r._bl2Celular||r.celular||r.Celular||r.telefono||r.Telefono||r.whatsapp||r.Whatsapp);
    r._correoPersonal=text(r._bl2CorreoPersonal||r.correopersonal||r.CorreoPersonal||r.correoPersonal);
    r._correoInstitucional=text(r._bl2CorreoInstitucional||r.correoinstitucional||r.CorreoInstitucional||r.correoInstitucional);
    r._correo=text(r._correoPersonal||r._correoInstitucional||r.correo||r.Correo||r.email||r.Email);
    r._periodoId=rowPeriodId(r);
    r._periodo=rowPeriodLabel(r)||r._periodoId||"SIN PERÍODO";
    r._telegramUser=tg.user;
    r._telegramChatId=tg.chatId;
    r._telegramTiene=tg.hasTelegram;
    r._telegramBot=tg.canSendByBot;
    r._searchText=buildSearchText(r);
    r._tablaReqReady=false;

    return r;
  }

  function rowsFromCore(opts){
    var result=dataEngine().listStudents({
      periodId:opts.periodId||"",
      division:opts.division||"",
      matricula:opts.matricula==null?"ACTIVO":opts.matricula,
      search:opts.search||"",
      limit:0,
      force:opts.force===true
    })||{};

    return (result.rows||[]).map(decorate);
  }

  function rowsFromRepo(opts){
    var result=bl2Repo().buscar({
      periodId:opts.periodId||"",
      division:opts.division||"",
      matricula:opts.matricula==null?"ACTIVO":opts.matricula,
      search:opts.search||"",
      limit:0
    })||{};

    return (result.rows||[]).map(decorate);
  }

  function rowsFromExcel(opts){
    var matricula=opts.matricula==null?"ACTIVO":text(opts.matricula);
    var rows=[];

    try{
      if(repo().filterStudents){
        rows=repo().filterStudents({periodoId:opts.periodId||"",periodId:opts.periodId||"",estadoMatricula:matricula,matricula:matricula,division:opts.division||""});
      }else if(repo().listStudentsByStatus&&matricula!==undefined){
        rows=repo().listStudentsByStatus(matricula||"");
      }else if(repo().listAllStudents){
        rows=repo().listAllStudents();
      }else{
        rows=snapshot().students||[];
      }
    }catch(error){
      rows=[];
    }

    return (rows||[]).map(decorate);
  }

  function baseRows(opts){
    opts=opts||{};

    var key=makeBaseKey(opts);
    var rows=[];

    if(cache.baseKey===key&&Array.isArray(cache.baseRows))return cache.baseRows;

    try{
      if(hasCore()){
        rows=rowsFromCore(opts);
        cache.baseKey=key;
        cache.baseRows=rows;
        return rows;
      }
    }catch(error){
      console.warn("[TablaCore] BL2DataEngine falló",error);
    }

    try{
      if(hasBL2Repo()){
        rows=rowsFromRepo(opts);
        cache.baseKey=key;
        cache.baseRows=rows;
        return rows;
      }
    }catch(error2){
      console.warn("[TablaCore] BL2EstudiantesRepo falló",error2);
    }

    rows=rowsFromExcel(opts);
    cache.baseKey=key;
    cache.baseRows=rows;

    return rows;
  }

  function normalizeStatusFilter(status){
    status=text(status);
    if(status==="pendiente")return "pendiente";
    if(status==="no cumple")return "no_cumple";
    if(status==="cumple todo")return "cumple";
    return status;
  }

  function filterAll(opts){
    opts=opts||{};

    var key=makeFilterKey(opts);
    var query=norm(opts.search);
    var period=text(opts.periodId);
    var division=text(opts.division);
    var career=text(opts.career||opts.carrera);
    var status=normalizeStatusFilter(opts.status||opts.estado);
    var matricula=opts.matricula==null?"ACTIVO":text(opts.matricula);
    var filters=reqFiltersFromOpts(opts);
    var rows;

    if(cache.filterKey===key&&Array.isArray(cache.filterRows))return cache.filterRows;

    rows=baseRows(opts).filter(function(row){
      if(matricula&&row._estadoMatricula!==matricula)return false;
      if(period&&!rowMatchesPeriod(row,period))return false;
      if(division&&!hasDivision(row,division))return false;
      if(career&&row._carrera!==career)return false;
      if(query&&String(row._searchText||"").indexOf(query)<0)return false;

      if(status){
        ensureRequirementState(row);
        if(!row._estadoGeneral||row._estadoGeneral.id!==status)return false;
      }

      if(filters.length&&!matchesRequirementFilters(row,filters))return false;

      return true;
    });

    cache.filterKey=key;
    cache.filterRows=rows;

    return rows;
  }

  function filter(opts){return filterAll(opts);}

  function listOptions(values){
    var map={};

    (values||[]).forEach(function(value){
      value=text(value);
      if(value)map[value]=true;
    });

    return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});
  }

  function careers(list){
    return listOptions((list||baseRows({matricula:"ACTIVO",limit:0})).map(function(row){return row._carrera||"SIN CARRERA";}));
  }

  function divisions(list,opts){
    opts=opts||{};

    if(!list&&hasBL2Repo()&&typeof bl2Repo().listDivisions==="function"){
      try{return bl2Repo().listDivisions({periodId:opts.periodId||"",matricula:opts.matricula==null?"ACTIVO":opts.matricula})||[];}catch(error){}
    }

    var rows=list||baseRows({periodId:opts.periodId||"",matricula:opts.matricula==null?"ACTIVO":opts.matricula,limit:0});

    try{
      if(window.BLDivisionesService&&typeof window.BLDivisionesService.listDivisionsWithEmpty==="function"){
        return window.BLDivisionesService.listDivisionsWithEmpty(rows,"");
      }
    }catch(error2){}

    return listOptions(rows.map(function(row){return divisionOf(row);}));
  }

  function options(opts){
    opts=opts||{};

    var key=makeOptionsKey(opts);
    var rows;
    var divisionMap={};
    var careerMap={};

    if(cache.optionsKey===key&&cache.options){
      return {divisions:(cache.options.divisions||[]).slice(),careers:(cache.options.careers||[]).slice()};
    }

    rows=baseRows({periodId:opts.periodId||"",matricula:opts.matricula==null?"ACTIVO":opts.matricula,division:"",search:""});

    rows.forEach(function(row){
      var div=text(row._division||divisionOf(row))||"Sin división";
      divisionMap[div]=true;

      if(!text(opts.division)||hasDivision(row,opts.division)){
        careerMap[text(row._carrera)||"SIN CARRERA"]=true;
      }
    });

    cache.optionsKey=key;
    cache.options={
      divisions:Object.keys(divisionMap).sort(function(a,b){return a.localeCompare(b,"es");}),
      careers:Object.keys(careerMap).sort(function(a,b){return a.localeCompare(b,"es");})
    };

    return {divisions:cache.options.divisions.slice(),careers:cache.options.careers.slice()};
  }

  function buildPager(total,opts){
    opts=opts||{};

    var size=Number(opts.pageSize||100)||100;
    var pages=Math.max(1,Math.ceil(total/size));
    var page=Math.min(Math.max(1,Number(opts.page||1)||1),pages);
    var offset=(page-1)*size;
    var built;

    if(pager()&&typeof pager().build==="function"){
      try{
        built=pager().build(total,{page:page,pageSize:size});
        built.page=page;
        built.pageSize=size;
        built.offset=offset;
        built.pages=pages;
        built.total=total;
        built.hasPrev=page>1;
        built.hasNext=page<pages;
        built.label=total+" registros";
        return built;
      }catch(error){}
    }

    return {page:page,pageSize:size,offset:offset,total:total,pages:pages,hasPrev:page>1,hasNext:page<pages,label:total+" registros"};
  }

  function summary(list){
    list=Array.isArray(list)?list:[];

    var careerMap={};
    var count={total:list.length,cumple:0,pendiente:0,no_cumple:0,carreras:0,faltan:0};

    list.forEach(function(row){
      ensureRequirementState(row);

      var id=row._estadoGeneral&&row._estadoGeneral.id?row._estadoGeneral.id:"no_cumple";

      if(!Object.prototype.hasOwnProperty.call(count,id))count[id]=0;
      count[id]+=1;

      if((row._requisitosFaltantes||[]).length)count.faltan+=1;

      careerMap[text(row._carrera)||"SIN CARRERA"]=true;
    });

    count.carreras=Object.keys(careerMap).length;

    return count;
  }

  function page(opts){
    opts=opts||{};

    var key=makePageKey(opts);
    var rows;
    var pagination;
    var pageRows;
    var result;

    if(cache.pageKey===key&&cache.pageResult){
      return {
        rows:cache.pageResult.rows.slice(),
        allRows:cache.pageResult.allRows.slice(),
        total:cache.pageResult.total,
        pagination:Object.assign({},cache.pageResult.pagination),
        summary:Object.assign({},cache.pageResult.summary),
        source:cache.pageResult.source
      };
    }

    rows=filterAll(opts);
    pagination=buildPager(rows.length,opts);
    pageRows=rows.slice(pagination.offset,pagination.offset+pagination.pageSize);

    result={
      rows:pageRows,
      allRows:rows,
      total:rows.length,
      pagination:pagination,
      summary:summary(rows),
      source:source()
    };

    cache.pageKey=key;
    cache.pageResult=result;

    return {
      rows:result.rows.slice(),
      allRows:result.allRows.slice(),
      total:result.total,
      pagination:Object.assign({},result.pagination),
      summary:Object.assign({},result.summary),
      source:result.source
    };
  }

  function requirementSummary(list){
    var out={};

    REQS.forEach(function(req){
      out[req.key]={key:req.key,short:req.short,label:req.label,total:0};
    });

    (Array.isArray(list)?list:[]).forEach(function(row){
      ensureRequirementState(row);

      Object.keys(out).forEach(function(key){
        if(hasRequirementMissing(row,key))out[key].total+=1;
      });
    });

    return out;
  }

  function whatsappUrl(row){
    var phone=text(row&&row._celular).replace(/[^0-9]/g,"");
    var message;

    if(!phone)return "";

    if(phone.length===10&&phone.charAt(0)==="0")phone="593"+phone.slice(1);

    message="Saludos, "+((row&&row._nombres)||"estudiante")+". Desde el área de Titulación se informa que existen novedades en su proceso.";

    return "https://wa.me/"+phone+"?text="+encodeURIComponent(message);
  }

  window.TablaCore={
    version:VERSION,
    REQUIREMENT_DEFS:REQS.slice(),
    estadoEstudiante:estadoEstudiante,
    estadoMatricula:estadoMatricula,
    estadoCelda:estadoCelda,
    periods:periods,
    students:function(matricula){return baseRows({matricula:matricula==null?"ACTIVO":matricula});},
    careers:careers,
    divisions:divisions,
    options:options,
    filter:filter,
    page:page,
    summary:summary,
    requirementSummary:requirementSummary,
    requirementInfo:requirementInfo,
    requirementStatusMap:requirementStatusMap,
    missingRequirements:missingRequirements,
    hasAnyMissing:hasAnyMissing,
    hasRequirementMissing:hasRequirementMissing,
    matchesRequirementFilters:matchesRequirementFilters,
    normalizeRequirementFilters:reqFilters,
    normalizeRequirementKey:reqKey,
    noteInfo:noteInfo,
    abreviarCarrera:abreviarCarrera,
    whatsappUrl:whatsappUrl,
    telegramInfo:telegramInfo,
    telegramUrl:telegramUrl,
    decorate:decorate,
    divisionOf:divisionOf,
    samePeriod:samePeriod,
    source:source,
    clearCache:clearCache,
    _ensureRequirementState:ensureRequirementState
  };
})(window);
/* =========================================================
Nombre completo: bdl.screen-deps.js
Ruta: /BDLocal/adapters/bdl.screen-deps.js
Función:
- Entregar a cada pantalla la caché compartida ya preparada por la ventana principal.
- Evitar abrir IndexedDB, reconstruir BDLocal y cargar todos los conectores al entrar a una pantalla.
- Mantener las APIs síncronas usadas por Tabla, Ficha, Stats, Coordi, Global y Reportes.
- Activar el núcleo pesado únicamente cuando una acción solicita lectura completa o escritura.
- Respetar el orquestador y los adaptadores completos cuando se ejecuta dentro del Centro de datos.
- Publicar cada escritura local a la ventana principal para mantener coherencia entre pantallas.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.1.0-shared-cache-coherent";
  var CACHE_KEY="REQ_BDLOCAL_CONEXIONES_CACHE_V1";
  var OLD_SNAPSHOT_KEY="REQ_EXCEL_LOCAL_V1:snapshot";
  var MESSAGE={
    publish:"requisitos:bdlocal-cache:publish",
    request:"requisitos:bdlocal-cache:request",
    response:"requisitos:bdlocal-cache:response",
    updated:"requisitos:bdlocal-cache:updated"
  };
  var currentScript=document.currentScript;
  var base=currentScript&&currentScript.src?currentScript.src:window.location.href;
  var pending=Object.create(null);
  var sequence=0;
  var heavyPromise=null;
  var readyPromise=null;
  var connectors=Object.create(null);
  var metrics={parentRequests:0,parentResponses:0,parentPublishes:0,localFallbacks:0,heavyActivations:0,cacheUpdates:0,cacheInvalidations:0,storageWrites:0,storageFailures:0};
  var memory={cache:null,revision:0,updatedAt:"",source:"empty"};

  function text(value){return String(value==null?"":value).trim();}
  function nowISO(){return new Date().toISOString();}
  function array(value){return Array.isArray(value)?value:[];}
  function object(value){return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}
  function safeParse(value,fallback){try{return value?JSON.parse(value):fallback;}catch(error){return fallback;}}
  function clone(value){
    if(value==null||typeof value!=="object"){return value;}
    try{if(typeof window.structuredClone==="function"){return window.structuredClone(value);}}catch(error){}
    try{return JSON.parse(JSON.stringify(value));}catch(inner){return value;}
  }
  function normalizeBasic(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();}
  function normalizeKey(value){return normalizeBasic(value).toLowerCase().replace(/[^a-z0-9]+/g,"");}
  function normalizeCedula(value){var raw=text(value).replace(/[^0-9A-Za-z]/g,"");return /^\d{9}$/.test(raw)?"0"+raw:raw;}
  function canonicalPeriodId(value){
    value=text(value);if(!value){return "";}
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function studentPeriodId(periodoId,cedula){periodoId=canonicalPeriodId(periodoId);cedula=normalizeCedula(cedula);return periodoId&&cedula?cedula+"__"+periodoId:"";}
  function samePeriod(a,b){a=canonicalPeriodId(a);b=canonicalPeriodId(b);return !b||!!a&&(a===b||normalizeKey(a)===normalizeKey(b));}
  function containsText(haystack,needle){needle=normalizeBasic(needle).toLowerCase();return !needle||normalizeBasic(haystack).toLowerCase().indexOf(needle)>=0;}
  function emptyCache(){return {meta:{source:"empty",updatedAt:nowISO(),revision:0,totalPeriods:0,totalStudents:0,totalRequirements:0},periods:[],students:[],requirements:[],summaries:{},diagnostics:[]};}
  function cacheRevision(cache){return Math.max(0,Number(cache&&cache.meta&&cache.meta.revision||0));}
  function cacheTime(cache){var value=Date.parse(text(cache&&cache.meta&&cache.meta.updatedAt||""));return Number.isFinite(value)?value:0;}
  function cacheWeight(cache){return array(cache&&cache.students).length*1000000+array(cache&&cache.periods).length*1000+array(cache&&cache.requirements).length;}
  function hasData(cache){return !!(cache&&(array(cache.periods).length||array(cache.students).length||array(cache.requirements).length));}

  function normalizePeriod(period){
    period=period||{};
    if(period.__bdlFastPeriodVersion===VERSION){return period;}
    var id=canonicalPeriodId(period.periodoCanonicoId||period.periodoId||period.periodId||period.id||period.value||period.key||"");
    if(!id){return null;}
    var label=text(period.periodoCanonicoLabel||period.periodoLabel||period.label||period.nombre||period.name||id);
    return Object.assign({},period,{id:id,value:id,key:id,label:label,nombre:label,periodoId:id,periodId:id,periodoCanonicoId:id,periodoCanonicoLabel:label,__bdlFastPeriodVersion:VERSION});
  }

  function normalizeStudent(row){
    row=row||{};
    if(row.__bdlFastStudentVersion===VERSION){return row;}
    var result=Object.assign({},row);
    var cedula=normalizeCedula(result.cedula||result.numeroIdentificacion||result.NumeroIdentificacion||result.identificacion||result.Identificacion||result.Cedula||result["Cédula"]||"");
    var periodoId=canonicalPeriodId(result.periodoCanonicoId||result.periodoId||result.periodId||result.ultimoPeriodoId||result.idPeriodo||result._periodoId||result._bl2PeriodoId||"");
    var nombres=text(result.Nombres||result.nombres||result.nombreCompleto||result.Nombre||result.nombre||result.Estudiante||result.estudiante||result._nombres||"");
    var carrera=text(result.NombreCarrera||result.nombreCarrera||result.Carrera||result.carrera||result._carrera||"");
    var division=text(result._division||result._bl2Division||result.division||result.Division||result["División"]||result.divisionActual||"Sin división")||"Sin división";
    var estado=text(result._estadoMatricula||result.estadoMatricula||result.EstadoMatricula||result.estado||result.Estado||"ACTIVO").toUpperCase()==="RETIRADO"?"RETIRADO":"ACTIVO";
    var id=text(result.idEstudiantePeriodo||result.studentId||result.id||result._id||studentPeriodId(periodoId,cedula));
    result.cedula=cedula;result.numeroIdentificacion=result.numeroIdentificacion||cedula;result.NumeroIdentificacion=result.NumeroIdentificacion||cedula;
    result.periodoId=periodoId;result.periodId=periodoId;result.periodoCanonicoId=periodoId;
    result.Nombres=result.Nombres||nombres;result.nombres=result.nombres||nombres;result.nombreCompleto=result.nombreCompleto||nombres;
    result.NombreCarrera=result.NombreCarrera||carrera;result.nombreCarrera=result.nombreCarrera||carrera;
    result.division=result.division||division;result._division=result._division||division;
    result.estadoMatricula=estado;result._estadoMatricula=estado;
    result.idEstudiantePeriodo=result.idEstudiantePeriodo||id;result.studentId=result.studentId||id;
    result.__bdlFastStudentVersion=VERSION;
    return result;
  }

  function normalizeCache(cache){
    cache=object(cache);var result={
      meta:Object.assign({},object(cache.meta)),
      periods:array(cache.periods),students:array(cache.students),requirements:array(cache.requirements),
      summaries:object(cache.summaries),diagnostics:array(cache.diagnostics)
    };
    result.meta.totalPeriods=result.periods.length;result.meta.totalStudents=result.students.length;result.meta.totalRequirements=result.requirements.length;
    result.meta.updatedAt=result.meta.updatedAt||nowISO();result.meta.fastAdapterVersion=VERSION;
    return result;
  }

  function incomingWins(incoming,current){
    var incomingRevision=cacheRevision(incoming);var currentRevision=cacheRevision(current);
    if(incomingRevision!==currentRevision){return incomingRevision>currentRevision;}
    var incomingAt=cacheTime(incoming);var currentAt=cacheTime(current);
    if(incomingAt!==currentAt){return incomingAt>currentAt;}
    return cacheWeight(incoming)>=cacheWeight(current);
  }

  function mergeCache(incoming,current,options){
    options=options||{};incoming=normalizeCache(incoming||emptyCache());current=normalizeCache(current||emptyCache());
    var preferred=options.preferIncoming===true?incoming:(incomingWins(incoming,current)?incoming:current);
    var fallback=preferred===incoming?current:incoming;
    var result=normalizeCache(preferred);
    if(options.allowEmpty!==true){
      if(!result.periods.length&&fallback.periods.length){result.periods=fallback.periods;}
      if(!result.students.length&&fallback.students.length){result.students=fallback.students;}
      if(!result.requirements.length&&fallback.requirements.length){result.requirements=fallback.requirements;}
      if(!result.diagnostics.length&&fallback.diagnostics.length){result.diagnostics=fallback.diagnostics;}
    }
    result.summaries=Object.assign({},fallback.summaries||{},result.summaries||{});
    result.meta=Object.assign({},fallback.meta||{},result.meta||{}, {
      totalPeriods:result.periods.length,totalStudents:result.students.length,totalRequirements:result.requirements.length,fastAdapterVersion:VERSION
    });
    return result;
  }

  function setMemory(cache,source,options){
    options=options||{};cache=normalizeCache(cache||emptyCache());
    var prepared=options.force===true?cache:mergeCache(cache,memory.cache||emptyCache(),{allowEmpty:options.allowEmpty===true,preferIncoming:options.preferIncoming===true});
    var incoming=cacheRevision(prepared);var current=cacheRevision(memory.cache);
    if(memory.cache&&options.force!==true&&incoming>0&&current>incoming){return memory.cache;}
    memory.cache=prepared;memory.revision=Math.max(incoming,current);memory.updatedAt=text(prepared.meta.updatedAt||nowISO());memory.source=text(source||prepared.meta.source||"shared");
    metrics.cacheUpdates+=1;
    return memory.cache;
  }

  function storageValue(key){try{return window.localStorage.getItem(key)||"";}catch(error){return "";}}
  function persist(cache){
    var raw="";try{raw=JSON.stringify(cache);}catch(error){metrics.storageFailures+=1;return false;}
    try{window.localStorage.setItem(CACHE_KEY,raw);metrics.storageWrites+=1;return true;}catch(error2){metrics.storageFailures+=1;return false;}
  }
  function loadLocalFallback(){
    var cache=safeParse(storageValue(CACHE_KEY),null)||safeParse(storageValue(OLD_SNAPSHOT_KEY),null)||emptyCache();
    metrics.localFallbacks+=1;return setMemory(cache,"localStorage-fallback",{allowEmpty:false,preferIncoming:true});
  }
  function readCache(force){
    if(force===true){return loadLocalFallback();}
    if(!memory.cache){loadLocalFallback();}
    return memory.cache||emptyCache();
  }

  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:Object.assign({at:nowISO()},detail||{})}));}catch(error){}}
  function post(message){try{return !!(window.parent&&window.parent!==window&&typeof window.parent.postMessage==="function"&&(window.parent.postMessage(message,"*"),true));}catch(error){return false;}}

  function acceptSharedCache(cache,source,options){
    options=options||{};
    var prepared=setMemory(cache||emptyCache(),source||"parent-update",{
      allowEmpty:options.allowEmpty===true,
      preferIncoming:options.preferIncoming!==false,
      force:options.force===true
    });
    if(options.persist===true){persist(prepared);}
    if(options.emit!==false){
      emit("bdlocal:screen-data-updated",{
        source:source||"parent-update",revision:cacheRevision(prepared),periods:prepared.periods.length,students:prepared.students.length,requirements:prepared.requirements.length,periodoId:text(prepared.meta&&prepared.meta.periodoId||"")
      });
    }
    return prepared;
  }

  function writeCache(cache,options){
    options=options||{};
    var current=readCache();
    var prepared=mergeCache(cache,current,{allowEmpty:options.allowEmpty===true,preferIncoming:true});
    var incomingRevision=cacheRevision(prepared);
    var nextRevision=options.respectIncomingRevision===true&&incomingRevision>cacheRevision(current)
      ? incomingRevision
      : Math.max(memory.revision+1,cacheRevision(current)+1,incomingRevision+1);
    prepared.meta=Object.assign({},prepared.meta||{}, {
      source:options.source||prepared.meta.source||"BDLocalScreenDeps.fast",
      updatedAt:nowISO(),revision:nextRevision,
      totalPeriods:prepared.periods.length,totalStudents:prepared.students.length,totalRequirements:prepared.requirements.length,
      periodoId:canonicalPeriodId(options.periodoId||prepared.meta.periodoId||""),
      operation:text(options.operation||prepared.meta.operation||"refresh").toLowerCase(),
      sourceScreen:text(options.sourceScreen||prepared.meta.sourceScreen||"screen").toLowerCase(),
      fastAdapterVersion:VERSION
    });
    var saved=setMemory(prepared,options.source||"writeCache",{allowEmpty:options.allowEmpty===true,preferIncoming:true,force:true});
    memory.revision=nextRevision;
    var stored=options.persist===false?false:persist(saved);
    emit("bdlocal:conexiones-cache-updated",{
      source:options.source||"writeCache",revision:nextRevision,periods:saved.periods.length,students:saved.students.length,requirements:saved.requirements.length,volatile:!stored
    });
    if(options.broadcast!==false){
      metrics.parentPublishes+=1;
      post({
        type:MESSAGE.publish,source:options.source||saved.meta.source||"BDLocalScreenDeps.fast",cache:saved,cacheKey:CACHE_KEY,revision:nextRevision,
        allowEmpty:options.allowEmpty===true,persisted:stored,periodoId:saved.meta.periodoId||"",operation:saved.meta.operation||"refresh",sourceScreen:saved.meta.sourceScreen||"screen",at:nowISO()
      });
    }
    return saved;
  }

  function invalidateCache(options){
    options=options||{};metrics.cacheInvalidations+=1;
    if(options.dropData===true){memory.cache=null;memory.revision=0;memory.updatedAt="";memory.source=text(options.reason||"invalidated");return null;}
    memory.source=text(options.reason||"invalidated");
    return memory.cache;
  }

  function requestSharedCache(options){
    options=options||{};var timeout=Math.max(150,Number(options.timeout||650));
    if(!window.parent||window.parent===window){return Promise.resolve(readCache());}
    var requestId="bdl-fast-"+Date.now()+"-"+(++sequence);metrics.parentRequests+=1;
    return new Promise(function(resolve){
      var timer=window.setTimeout(function(){delete pending[requestId];resolve(readCache());},timeout);
      pending[requestId]={resolve:function(cache){window.clearTimeout(timer);delete pending[requestId];resolve(acceptSharedCache(cache,"parent-response",{emit:false,preferIncoming:true}));}};
      if(!post({type:MESSAGE.request,requestId:requestId,cacheKey:CACHE_KEY,revision:memory.revision,at:nowISO()})){
        window.clearTimeout(timer);delete pending[requestId];resolve(readCache());
      }
    });
  }

  function handleMessage(event){
    var data=event&&event.data;if(!data||typeof data!=="object"){return;}
    if(data.cacheKey&&data.cacheKey!==CACHE_KEY){return;}
    if(data.type!==MESSAGE.response&&data.type!==MESSAGE.updated){return;}
    var cache=acceptSharedCache(data.cache||data.snapshot||readCache(),data.type===MESSAGE.response?"parent-response":"parent-update",{emit:data.type===MESSAGE.updated,preferIncoming:true});
    metrics.parentResponses+=1;
    if(data.type===MESSAGE.response&&data.requestId&&pending[data.requestId]){pending[data.requestId].resolve(cache);}
  }

  function filterStudents(rows,options){
    options=options||{};rows=array(rows);
    var periodoId=canonicalPeriodId(options.periodoId||options.periodId||options.period||"");
    var matricula=text(options.estadoMatricula||options.matricula||"").toUpperCase();
    var division=normalizeKey(options.division||"");var carrera=normalizeBasic(options.carrera||options.career||"").toLowerCase();
    var sede=normalizeBasic(options.sede||"").toLowerCase();var search=normalizeBasic(options.search||options.busqueda||options.query||"").toLowerCase();
    var limit=Math.max(0,Number(options.limit||0));var out=[];
    for(var i=0;i<rows.length;i+=1){
      var row=normalizeStudent(rows[i]);
      if(periodoId&&!samePeriod(row.periodoId||row._periodoId||row.ultimoPeriodoId,periodoId)){continue;}
      if(matricula&&text(row._estadoMatricula||row.estadoMatricula).toUpperCase()!==matricula){continue;}
      if(division&&normalizeKey(row._division||row.division||"Sin división")!==division){continue;}
      if(carrera&&!containsText([row.NombreCarrera,row.nombreCarrera,row.Carrera,row.carrera,row.CodigoCarrera,row.codigoCarrera].join(" "),carrera)){continue;}
      if(sede&&!containsText([row.Sede,row.sede,row._sede].join(" "),sede)){continue;}
      if(search&&!containsText([row.cedula,row.numeroIdentificacion,row.Nombres,row.nombres,row.nombreCompleto,row.NombreCarrera,row.nombreCarrera,row.division,row._division,row.Sede,row.sede,row.CorreoPersonal,row.CorreoInstitucional,row.correoPersonal,row.correoInstitucional,row.Celular,row.celular,row.telegramUser,row.telegramChatId].join(" "),search)){continue;}
      out.push(row);if(limit>0&&out.length>=limit){break;}
    }
    return out;
  }

  function resolve(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function loadScript(relative,attribute){
    var src=resolve(relative);var scripts=Array.prototype.slice.call(document.scripts||[]);
    if(scripts.some(function(script){return script.src===src;})){return Promise.resolve(src);}
    return new Promise(function(resolvePromise,reject){
      var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;
      script.setAttribute(attribute||"data-bdl-fast-src",src);
      script.onload=function(){resolvePromise(src);};script.onerror=function(){reject(new Error("No se pudo cargar "+relative));};
      (document.head||document.documentElement).appendChild(script);
    });
  }

  var existingHub=window.BDLocalConexiones||null;
  var fullHub=!!(
    existingHub&&
    typeof existingHub.ensureCoreReady==="function"&&
    typeof existingHub.refreshCache==="function"&&
    typeof existingHub.status==="function"&&
    !/shared-cache-first|full-hub-safe|shared-cache-coherent/i.test(text(existingHub.version))
  );
  var nativeRegister=fullHub&&typeof existingHub.register==="function"?existingHub.register.bind(existingHub):null;
  var nativeGet=fullHub&&typeof existingHub.get==="function"?existingHub.get.bind(existingHub):null;
  var nativeReady=fullHub&&typeof existingHub.ready==="function"?existingHub.ready.bind(existingHub):null;
  var nativeEnsureCore=fullHub?existingHub.ensureCoreReady.bind(existingHub):null;
  var nativeRefresh=fullHub?existingHub.refreshCache.bind(existingHub):null;
  var nativeStatus=fullHub?existingHub.status.bind(existingHub):null;

  function ensureHeavy(){
    if(fullHub){return Promise.resolve(existingHub);}
    if(heavyPromise){return heavyPromise;}
    metrics.heavyActivations+=1;
    var fastEnsure=hub.ensureCoreReady;
    heavyPromise=loadScript("../conexiones/cone.index.js","data-bdl-heavy-src").then(function(){
      var current=window.BDLocalConexiones;
      if(!current||current.ensureCoreReady===fastEnsure){throw new Error("El núcleo completo de BDLocal no quedó disponible.");}
      return current;
    }).catch(function(error){heavyPromise=null;throw error;});
    return heavyPromise;
  }

  function register(name,api){
    name=text(name);if(!name||!api){return false;}connectors[name]=api;
    if(nativeRegister){return nativeRegister(name,api);}
    hub[name]=api;return true;
  }
  function get(name){
    name=text(name);
    if(nativeGet){return nativeGet(name)||connectors[name]||hub[name]||null;}
    return connectors[name]||hub[name]||null;
  }
  function ready(options){
    options=options||{};
    if(nativeReady){return nativeReady(options);}
    if(readyPromise&&!options.force){return readyPromise;}
    readyPromise=requestSharedCache({timeout:Number(options.sharedTimeout||options.timeout||650)}).then(function(cache){
      emit("bdlocal:screen-deps-ready",{ok:true,ready:true,source:memory.source,periods:cache.periods.length,students:cache.students.length,requirements:cache.requirements.length,version:VERSION});
      return {ok:true,ready:true,source:"shared-cache",periods:cache.periods.length,students:cache.students.length,requirements:cache.requirements.length,version:VERSION};
    }).finally(function(){readyPromise=null;});
    return readyPromise;
  }
  function ensureCoreReady(){return nativeEnsureCore?nativeEnsureCore():ensureHeavy().then(function(current){return current.ensureCoreReady();});}
  function refreshCache(options){
    options=Object.assign({},options||{});
    if(nativeRefresh){return nativeRefresh(options);}
    var full=options.full===true||options.force===true||options.mode==="full";
    if(!full){return requestSharedCache({timeout:Number(options.timeout||500)});}
    return ensureHeavy().then(function(current){return current.refreshCache(options);});
  }
  function hubStatus(){
    if(nativeStatus){return nativeStatus();}
    var cache=readCache();return {ok:true,ready:true,version:VERSION,mode:"shared-cache-first",periods:cache.periods.length,students:cache.students.length,requirements:cache.requirements.length,connectors:Object.keys(connectors),heavyActive:!!heavyPromise,metrics:Object.assign({},metrics)};
  }

  var utils=Object.assign({},window.BDLocalConUtils||{}, {
    version:VERSION,text:text,nowISO:nowISO,array:array,object:object,clone:clone,safeParse:safeParse,
    normalizeBasic:normalizeBasic,normalizeKey:normalizeKey,normalizeCedula:normalizeCedula,canonicalPeriodId:canonicalPeriodId,
    studentPeriodId:studentPeriodId,samePeriod:samePeriod,containsText:containsText,normalizePeriod:normalizePeriod,
    normalizeStudent:normalizeStudent,filterStudents:filterStudents,emptyCache:emptyCache,hasData:hasData,
    cacheRevision:cacheRevision,readCache:readCache,writeCache:writeCache,requestSharedCache:requestSharedCache,
    acceptSharedCache:acceptSharedCache,invalidateCache:invalidateCache,emit:emit
  });
  window.BDLocalConUtils=utils;

  var hub=existingHub||{};
  if(!fullHub){
    Object.assign(hub,{version:VERSION,register:register,get:get,ready:ready,ensureCoreReady:ensureCoreReady,refreshCache:refreshCache,status:hubStatus,metrics:function(){return Object.assign({},metrics);},utils:utils,activateHeavy:ensureHeavy});
  }else if(typeof hub.activateHeavy!=="function"){
    hub.activateHeavy=function(){return Promise.resolve(hub);};
  }
  window.BDLocalConexiones=hub;

  function listPeriodsSync(){return readCache().periods.map(normalizePeriod).filter(Boolean);}
  function getStudentsSync(options){return filterStudents(readCache().students,options||{});}
  function listStudentsSync(options){var rows=getStudentsSync(options||{});return {ok:true,rows:rows,students:rows,estudiantes:rows,total:rows.length,periodList:listPeriodsSync(),source:"BDLocalScreenDeps.fast"};}
  function getRequirementsSync(filters){
    filters=filters||{};var periodoId=canonicalPeriodId(filters.periodoId||filters.periodId||"");var cedula=normalizeCedula(filters.cedula||filters.numeroIdentificacion||"");
    return readCache().requirements.filter(function(row){return (!periodoId||samePeriod(row.periodoId||row.periodId||row.periodoCanonicoId,periodoId))&&(!cedula||normalizeCedula(row.cedula||row.numeroIdentificacion)===cedula);});
  }
  function getSummarySync(periodoId){
    periodoId=canonicalPeriodId(periodoId||"");var cache=readCache();var stored=cache.summaries&&(cache.summaries[periodoId]||cache.summaries[normalizeKey(periodoId)]);
    if(stored&&typeof stored==="object"){return Object.assign({id:periodoId,periodoId:periodoId,source:"BDLocalScreenDeps.fast.cache"},stored);}
    var rows=getStudentsSync({periodoId:periodoId,matricula:""});var activos=rows.filter(function(row){return text(row.estadoMatricula||row._estadoMatricula).toUpperCase()!=="RETIRADO";}).length;
    return {id:periodoId,periodoId:periodoId,totalEstudiantes:rows.length,totalActivos:activos,totalRetirados:rows.length-activos,source:"BDLocalScreenDeps.fast"};
  }
  function getStudentByCedula(cedula,periodoId){cedula=normalizeCedula(cedula);return getStudentsSync({periodoId:periodoId||"",matricula:""}).filter(function(row){return normalizeCedula(row.cedula||row.numeroIdentificacion)===cedula;})[0]||null;}
  function getStudentById(id,options){id=text(id);return getStudentsSync(Object.assign({},options||{},{matricula:options&&options.matricula!=null?options.matricula:""})).filter(function(row){return [row.id,row._id,row.studentId,row.idEstudiantePeriodo,row.cedula,row.numeroIdentificacion].some(function(value){return text(value)===id;});})[0]||null;}

  var excel={version:VERSION,source:"BDLocalScreenDeps.fast",ready:ready,getSnapshot:function(){return readCache();},listPeriods:listPeriodsSync,getPeriods:listPeriodsSync,periods:listPeriodsSync,listStudents:listStudentsSync,getStudents:getStudentsSync,getRows:getStudentsSync,rows:getStudentsSync,all:getStudentsSync,listAllStudents:function(){return getStudentsSync({matricula:""});},filterStudents:getStudentsSync,search:function(q,options){return listStudentsSync(Object.assign({},options||{},{search:q||""}));},getSummary:getSummarySync,summary:getSummarySync,getRequirements:getRequirementsSync,getStudentByCedula:getStudentByCedula,getStudentById:getStudentById,invalidate:function(){return true;}};
  var engine=Object.assign({},excel,{search:function(options){return listStudentsSync(options||{});},requirements:getRequirementsSync,stats:function(periodoId){return {periodoId:periodoId,estudiantes:getStudentsSync({periodoId:periodoId,matricula:""}),requisitos:getRequirementsSync({periodoId:periodoId}),resumen:getSummarySync(periodoId),source:"BDLocalScreenDeps.fast"};}});
  var studentsAdapter={version:VERSION,source:"BDLocalScreenDeps.fast",ready:ready,buscar:listStudentsSync,getStudents:getStudentsSync,listStudents:listStudentsSync,filterStudents:getStudentsSync,listAllStudents:function(){return getStudentsSync({matricula:""});},obtenerPorCedula:getStudentByCedula,getStudentByCedula:getStudentByCedula,getStudentById:getStudentById,listPeriods:listPeriodsSync,getPeriods:listPeriodsSync,invalidate:function(){return true;}};
  var reportsAdapter={version:VERSION,source:"BDLocalScreenDeps.fast",ready:ready,buildReportData:function(filters){var rows=getStudentsSync(filters||{});return {ok:true,source:"BDLocalScreenDeps.fast",filters:filters||{},generatedAt:nowISO(),estudiantes:rows,rows:rows,requisitos:getRequirementsSync(filters||{}),periodos:listPeriodsSync(),resumen:{totalEstudiantes:rows.length}};},getStudents:getStudentsSync,listStudents:listStudentsSync,getRequirements:getRequirementsSync,getSummary:getSummarySync,getPeriods:listPeriodsSync,listPeriods:listPeriodsSync,invalidate:function(){return true;}};

  function mergeAdapter(existing,fast){return fullHub&&existing?existing:Object.assign({},existing||{},fast);}
  window.ExcelLocalRepo=mergeAdapter(window.ExcelLocalRepo,excel);
  window.BL2DataEngine=mergeAdapter(window.BL2DataEngine,engine);
  window.BL2EstudiantesRepo=mergeAdapter(window.BL2EstudiantesRepo,studentsAdapter);
  window.BL2ReportesRepo=mergeAdapter(window.BL2ReportesRepo,reportsAdapter);

  window.BDLocalScreenDeps={
    version:VERSION,ready:ready,status:hubStatus,load:loadScript,readCache:readCache,writeCache:writeCache,
    acceptSharedCache:acceptSharedCache,invalidate:invalidateCache,clearMemo:function(){return invalidateCache({dropData:true,reason:"clearMemo"});},
    filterStudents:getStudentsSync,listStudents:listStudentsSync,listPeriods:listPeriodsSync,getRequirements:getRequirementsSync,getSummary:getSummarySync,getStudentByCedula:getStudentByCedula,getStudentById:getStudentById,
    ensureSyncAdapters:function(){return {excel:window.ExcelLocalRepo,engine:window.BL2DataEngine,estudiantes:window.BL2EstudiantesRepo,reportes:window.BL2ReportesRepo};},
    ensureDivisionesService:function(){return Promise.resolve(window.BLDivisionesService||null);},normalizeStudent:normalizeStudent,normalizePeriod:normalizePeriod,activateHeavy:ensureHeavy
  };

  window.addEventListener("message",handleMessage);
  window.addEventListener("storage",function(event){
    if(event&&[CACHE_KEY,OLD_SNAPSHOT_KEY].indexOf(event.key)>=0){
      invalidateCache({dropData:true,reason:"storage"});readCache(true);emit("bdlocal:screen-data-updated",{source:"storage",revision:cacheRevision(memory.cache)});
    }
  });
  readCache();
  window.BDLScreenDepsReady=ready();
})(window,document);

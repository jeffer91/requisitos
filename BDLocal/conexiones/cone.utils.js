/* =========================================================
Nombre completo: cone.utils.js
Ruta o ubicación: /Requisitos/BDLocal/conexiones/cone.utils.js
Función o funciones:
- Centralizar utilidades compartidas por todos los conectores de BDLocal.
- Mantener una caché normalizada en memoria y persistirla solo cuando corresponde.
- Evitar lecturas síncronas, clonaciones profundas y normalizaciones repetidas en cada consulta.
- Compartir cambios entre ventanas o iframes con revisión y descarte de mensajes obsoletos.
- Conservar la última caché válida cuando localStorage no admite archivos grandes.
- Filtrar estudiantes por período, matrícula, división, carrera, sede y búsqueda.
Con qué se conecta:
- cone.index.js y los conectores cone.*.js.
- bdl.screen-deps.js.
- Tabla, Ficha, Stats, Coordi, Reportes, Defensas y Carga.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.5.0-central-cache-dedup";
  var CACHE_KEY="REQ_BDLOCAL_CONEXIONES_CACHE_V1";
  var SIGNAL_KEY="REQ_BDLOCAL_CONEXIONES_SIGNAL_V1";

  var MESSAGE={
    publish:"requisitos:bdlocal-cache:publish",
    request:"requisitos:bdlocal-cache:request",
    response:"requisitos:bdlocal-cache:response",
    updated:"requisitos:bdlocal-cache:updated"
  };

  var memo={
    raw:null,
    cache:null,
    volatile:false,
    dirty:true,
    memoryAt:0,
    revision:0,
    storageReads:0,
    storageWrites:0,
    skippedWrites:0,
    parseCount:0,
    lastWriteAt:0
  };

  var pending=Object.create(null);
  var requestSequence=0;
  var lastSignal={
    signature:"",
    at:0
  };

  function text(value){
    return String(value==null?"":value).trim();
  }

  function nowISO(){
    return new Date().toISOString();
  }

  function array(value){
    return Array.isArray(value)?value:[];
  }

  function object(value){
    return value&&typeof value==="object"&&!Array.isArray(value)
      ?value
      :{};
  }

  function hasRows(value){
    return Array.isArray(value)&&value.length>0;
  }

  function clone(value){
    if(value==null||typeof value!=="object"){
      return value;
    }

    try{
      if(typeof window.structuredClone==="function"){
        return window.structuredClone(value);
      }
    }catch(error){}

    try{
      return JSON.parse(JSON.stringify(value));
    }catch(innerError){
      return value;
    }
  }

  function safeParse(value,fallback){
    try{
      if(!value){
        return fallback;
      }

      var parsed=JSON.parse(value);
      return parsed==null?fallback:parsed;
    }catch(error){
      return fallback;
    }
  }

  function storageGet(key){
    memo.storageReads+=1;

    try{
      return window.localStorage.getItem(key)||"";
    }catch(error){
      return "";
    }
  }

  function storageSet(key,value){
    try{
      window.localStorage.setItem(key,value);
      memo.storageWrites+=1;
      return true;
    }catch(error){
      return false;
    }
  }

  function storageSetIfChanged(key,value,currentRaw){
    if(typeof currentRaw==="string"&&currentRaw===value){
      memo.skippedWrites+=1;

      return {
        ok:true,
        skipped:true
      };
    }

    return {
      ok:storageSet(key,value),
      skipped:false
    };
  }

  function normalizeBasic(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .replace(/\s+/g," ")
      .trim();
  }

  function normalizeKey(value){
    return normalizeBasic(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,"");
  }

  function normalizeCedula(value){
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }

  function canonicalPeriodId(value){
    value=text(value);

    if(!value){
      return "";
    }

    var match=value.match(
      /^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/
    );

    return match
      ?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]
      :value.replace(/_+/g,"__");
  }

  function samePeriod(a,b){
    a=canonicalPeriodId(a);
    b=canonicalPeriodId(b);

    return !b||!!a&&(
      a===b||
      normalizeKey(a)===normalizeKey(b)
    );
  }

  function normalizePeriod(period){
    period=period||{};

    if(period.__bdlConUtilsPeriodVersion===VERSION){
      return period;
    }

    var id=canonicalPeriodId(
      period.periodoCanonicoId||
      period.periodoId||
      period.periodId||
      period.id||
      period.value||
      period.key||
      ""
    );

    if(!id){
      return null;
    }

    var label=text(
      period.periodoCanonicoLabel||
      period.periodoLabel||
      period.label||
      period.nombre||
      period.name||
      id
    );

    var result=Object.assign({},period,{
      id:id,
      value:id,
      key:id,
      label:label,
      nombre:label,
      periodoId:id,
      periodId:id,
      periodoLabel:label,
      periodoCanonicoId:id,
      periodoCanonicoLabel:label,
      divisiones:Array.isArray(period.divisiones)
        ?period.divisiones
        :[],
      carrerasDetectadas:Array.isArray(
        period.carrerasDetectadas
      )
        ?period.carrerasDetectadas
        :[]
    });

    result.__bdlConUtilsPeriodVersion=VERSION;
    return result;
  }

  function normalizeStudent(row){
    row=row||{};

    if(row.__bdlConUtilsStudentVersion===VERSION){
      return row;
    }

    var result=Object.assign({},row);

    var cedula=normalizeCedula(
      result.cedula||
      result.numeroIdentificacion||
      result.NumeroIdentificacion||
      result.identificacion||
      result.Identificacion||
      result.Cedula||
      result["Cédula"]||
      ""
    );

    var periodoId=canonicalPeriodId(
      result.periodoCanonicoId||
      result.periodoId||
      result.periodId||
      result.ultimoPeriodoId||
      result.idPeriodo||
      result._periodoId||
      result._bl2PeriodoId||
      ""
    );

    var periodoLabel=text(
      result.periodoCanonicoLabel||
      result.periodoLabel||
      result.periodo||
      result.Periodo||
      result._periodo||
      result._bl2Periodo||
      periodoId
    );

    var nombres=text(
      result.Nombres||
      result.nombres||
      result.nombreCompleto||
      result.Nombre||
      result.nombre||
      result.Estudiante||
      result.estudiante||
      result._nombres||
      ""
    );

    var carrera=text(
      result.NombreCarrera||
      result.nombreCarrera||
      result.Carrera||
      result.carrera||
      result._carrera||
      ""
    );

    var codigoCarrera=text(
      result.CodigoCarrera||
      result.codigoCarrera||
      result.codCarrera||
      ""
    );

    var sede=text(
      result.Sede||
      result.sede||
      result.campus||
      result._sede||
      ""
    );

    var division=text(
      result._division||
      result._bl2Division||
      result.division||
      result.Division||
      result["División"]||
      result.divisionActual||
      "Sin división"
    )||"Sin división";

    var estado=text(
      result._estadoMatricula||
      result.estadoMatricula||
      result.EstadoMatricula||
      result.estado||
      result.Estado||
      "ACTIVO"
    ).toUpperCase()==="RETIRADO"
      ?"RETIRADO"
      :"ACTIVO";

    result.id=
      result.id||
      result._id||
      result.idEstudiantePeriodo||
      (
        cedula&&periodoId
          ?cedula+"__"+periodoId
          :cedula
      );

    result._id=result._id||result.id;

    result.studentId=
      result.studentId||
      result.idEstudiantePeriodo||
      result.id;

    result.idEstudiantePeriodo=
      result.idEstudiantePeriodo||
      (
        cedula&&periodoId
          ?periodoId+"__"+cedula
          :result.studentId||result.id
      );

    result.cedula=cedula;
    result._cedula=result._cedula||cedula;
    result.numeroIdentificacion=
      result.numeroIdentificacion||cedula;
    result.NumeroIdentificacion=
      result.NumeroIdentificacion||cedula;

    result.periodoId=periodoId;
    result.periodId=periodoId;
    result.ultimoPeriodoId=
      result.ultimoPeriodoId||periodoId;
    result.periodoCanonicoId=
      result.periodoCanonicoId||periodoId;
    result.periodoLabel=periodoLabel;
    result.periodoCanonicoLabel=
      result.periodoCanonicoLabel||periodoLabel;
    result.Periodo=result.Periodo||periodoLabel;
    result._periodoId=result._periodoId||periodoId;
    result._periodo=result._periodo||periodoLabel;

    result.Nombres=result.Nombres||nombres;
    result.nombres=result.nombres||nombres;
    result.nombreCompleto=
      result.nombreCompleto||nombres;
    result._nombres=result._nombres||nombres;

    result.NombreCarrera=
      result.NombreCarrera||carrera;
    result.nombreCarrera=
      result.nombreCarrera||carrera;
    result.Carrera=result.Carrera||carrera;
    result.carrera=result.carrera||carrera;
    result.CodigoCarrera=
      result.CodigoCarrera||codigoCarrera;
    result.codigoCarrera=
      result.codigoCarrera||codigoCarrera;
    result._carrera=
      result._carrera||
      carrera||
      codigoCarrera||
      "SIN CARRERA";

    result.Sede=result.Sede||sede;
    result.sede=result.sede||sede;
    result._sede=
      result._sede||
      sede||
      "SIN SEDE";

    result.division=division;
    result.Division=result.Division||division;
    result._division=division;

    result.divisiones=
      Array.isArray(result.divisiones)&&
      result.divisiones.length
        ?result.divisiones
        :(
          normalizeKey(division)!=="sindivision"
            ?[division]
            :[]
        );

    result._estadoMatricula=estado;
    result.estadoMatricula=estado;
    result.__bdlConUtilsStudentVersion=VERSION;

    return result;
  }

  function emptyCache(){
    return {
      meta:{
        app:"Requisitos",
        module:"BDLocalConexiones",
        version:VERSION,
        source:"empty",
        updatedAt:nowISO(),
        totalPeriods:0,
        totalStudents:0,
        refreshMode:"empty",
        revision:0
      },
      periods:[],
      students:[],
      requirements:[],
      summaries:{},
      diagnostics:[]
    };
  }

  function normalizeCache(cache){
    cache=
      cache&&typeof cache==="object"
        ?cache
        :emptyCache();

    if(
      cache.meta&&
      cache.meta.__bdlConUtilsCacheVersion===VERSION
    ){
      return cache;
    }

    var result={
      meta:Object.assign({},object(cache.meta)),
      periods:array(cache.periods)
        .map(normalizePeriod)
        .filter(Boolean),
      students:array(cache.students)
        .map(normalizeStudent),
      requirements:array(cache.requirements),
      summaries:object(cache.summaries),
      diagnostics:array(cache.diagnostics)
    };

    result.meta.app=
      result.meta.app||"Requisitos";

    result.meta.module=
      result.meta.module||"BDLocalConexiones";

    result.meta.version=VERSION;

    result.meta.source=
      result.meta.source||"cache";

    result.meta.updatedAt=
      result.meta.updatedAt||nowISO();

    result.meta.totalPeriods=
      result.periods.length;

    result.meta.totalStudents=
      result.students.length;

    result.meta.revision=Number(
      result.meta.revision||0
    );

    result.meta.__bdlConUtilsCacheVersion=VERSION;

    return result;
  }

  function hasData(cache){
    cache=cache||{};

    return hasRows(cache.periods)||
      hasRows(cache.students)||
      hasRows(cache.requirements);
  }

  function cacheTime(cache){
    var value=Date.parse(
      text(
        cache&&
        cache.meta&&
        cache.meta.updatedAt
      )
    );

    return Number.isFinite(value)?value:0;
  }

  function cacheRevision(cache){
    return Number(
      cache&&
      cache.meta&&
      cache.meta.revision||
      0
    );
  }

  function cacheWeight(cache){
    cache=cache||{};

    return array(cache.students).length*1000000+
      array(cache.periods).length*1000+
      array(cache.requirements).length;
  }

  function incomingWins(incoming,current){
    var incomingRevision=cacheRevision(incoming);
    var currentRevision=cacheRevision(current);

    if(incomingRevision!==currentRevision){
      return incomingRevision>currentRevision;
    }

    var incomingAt=cacheTime(incoming);
    var currentAt=cacheTime(current);

    if(incomingAt!==currentAt){
      return incomingAt>currentAt;
    }

    return cacheWeight(incoming)>=cacheWeight(current);
  }

  function mergeCache(incoming,current,options){
    options=options||{};

    incoming=normalizeCache(
      incoming||emptyCache()
    );

    current=normalizeCache(
      current||emptyCache()
    );

    var allowEmpty=options.allowEmpty===true;

    var preferred=
      options.preferIncoming===true
        ?incoming
        :(
          incomingWins(incoming,current)
            ?incoming
            :current
        );

    var fallback=
      preferred===incoming
        ?current
        :incoming;

    var result={
      meta:Object.assign(
        {},
        object(fallback.meta),
        object(preferred.meta)
      ),
      periods:preferred.periods,
      students:preferred.students,
      requirements:preferred.requirements,
      summaries:Object.assign(
        {},
        object(fallback.summaries),
        object(preferred.summaries)
      ),
      diagnostics:preferred.diagnostics
    };

    if(!allowEmpty){
      if(
        !hasRows(result.periods)&&
        hasRows(fallback.periods)
      ){
        result.periods=fallback.periods;
      }

      if(
        !hasRows(result.students)&&
        hasRows(fallback.students)
      ){
        result.students=fallback.students;
      }

      if(
        !hasRows(result.requirements)&&
        hasRows(fallback.requirements)
      ){
        result.requirements=
          fallback.requirements;
      }
    }

    if(
      !hasRows(result.diagnostics)&&
      hasRows(fallback.diagnostics)
    ){
      result.diagnostics=
        fallback.diagnostics;
    }

    result.meta.version=VERSION;

    result.meta.totalPeriods=
      result.periods.length;

    result.meta.totalStudents=
      result.students.length;

    result.meta.volatileProtected=true;
    result.meta.__bdlConUtilsCacheVersion=VERSION;

    return result;
  }

  function readCache(force){
    if(!force&&memo.cache&&!memo.dirty){
      return memo.cache;
    }

    var raw=storageGet(CACHE_KEY);

    if(
      !force&&
      memo.cache&&
      memo.raw===raw
    ){
      memo.dirty=false;
      return memo.cache;
    }

    memo.parseCount+=1;

    var stored=normalizeCache(
      safeParse(raw,null)
    );

    if(memo.cache){
      memo.cache=mergeCache(
        stored,
        memo.cache,
        {allowEmpty:false}
      );
    }else{
      memo.cache=stored;
    }

    memo.raw=raw;
    memo.volatile=false;
    memo.dirty=false;
    memo.memoryAt=Date.now();

    memo.revision=Math.max(
      memo.revision,
      cacheRevision(memo.cache)
    );

    return memo.cache;
  }

  function postToParent(message){
    try{
      if(
        window.parent&&
        window.parent!==window&&
        typeof window.parent.postMessage==="function"
      ){
        window.parent.postMessage(message,"*");
        return true;
      }
    }catch(error){}

    return false;
  }

  function emit(name,detail,options){
    options=options||{};

    detail=Object.assign(
      {at:nowISO()},
      detail||{}
    );

    try{
      window.dispatchEvent(
        new CustomEvent(name,{
          detail:detail
        })
      );
    }catch(error){}

    if(options.signal===false){
      return;
    }

    var payload={
      name:name,
      detail:detail
    };

    var signature="";

    try{
      signature=JSON.stringify(payload);
    }catch(error2){
      signature=name+"|"+detail.at;
    }

    var now=Date.now();

    if(
      lastSignal.signature===signature&&
      now-lastSignal.at<120
    ){
      return;
    }

    lastSignal.signature=signature;
    lastSignal.at=now;

    storageSet(SIGNAL_KEY,signature);
  }

  function writeCache(cache,options){
    options=options||{};

    var current=memo.cache||readCache();
    var incomingRevision=cacheRevision(cache);
    var currentRevision=cacheRevision(current);

    if(
      options.respectIncomingRevision===true&&
      incomingRevision>0&&
      incomingRevision<=currentRevision
    ){
      memo.skippedWrites+=1;
      return current;
    }

    if(
      cache===current&&
      !options.forceWrite
    ){
      memo.skippedWrites+=1;
      return current;
    }

    var prepared=mergeCache(
      cache,
      current,
      {
        allowEmpty:options.allowEmpty===true,
        preferIncoming:true
      }
    );

    memo.revision=Math.max(
      memo.revision+1,
      cacheRevision(prepared)+1,
      currentRevision+1
    );

    prepared.meta=Object.assign(
      {},
      prepared.meta,
      {
        updatedAt:nowISO(),
        version:VERSION,
        revision:memo.revision,
        totalPeriods:prepared.periods.length,
        totalStudents:prepared.students.length,
        __bdlConUtilsCacheVersion:VERSION
      }
    );

    var raw="";

    try{
      raw=JSON.stringify(prepared);
    }catch(error){
      memo.cache=prepared;
      memo.volatile=true;
      memo.dirty=false;
      memo.memoryAt=Date.now();

      if(options.emit!==false){
        emit(
          "bdlocal:conexiones-cache-warning",
          {
            ok:false,
            volatile:true,
            source:
              options.source||
              prepared.meta.source||
              "BDLocalConexiones",
            message:
              error&&error.message
                ?error.message
                :String(error),
            revision:memo.revision
          }
        );
      }

      return prepared;
    }

    var writeResult=storageSetIfChanged(
      CACHE_KEY,
      raw,
      memo.raw
    );

    var stored=writeResult.ok;

    memo.raw=stored?raw:memo.raw;
    memo.cache=prepared;
    memo.volatile=!stored;
    memo.dirty=false;
    memo.memoryAt=Date.now();
    memo.lastWriteAt=memo.memoryAt;

    if(options.emit!==false){
      emit(
        "bdlocal:conexiones-cache-updated",
        {
          ok:stored,
          skippedWrite:writeResult.skipped,
          volatile:!stored,
          periods:prepared.periods.length,
          students:prepared.students.length,
          requirements:
            prepared.requirements.length,
          refreshMode:
            prepared.meta.refreshMode||"",
          source:
            prepared.meta.source||
            "BDLocal",
          revision:memo.revision
        }
      );
    }

    if(options.broadcast!==false){
      postToParent({
        type:MESSAGE.publish,
        source:
          options.source||
          prepared.meta.source||
          "BDLocalConexiones",
        cache:prepared,
        cacheKey:CACHE_KEY,
        revision:memo.revision,
        allowEmpty:options.allowEmpty===true,
        at:nowISO()
      });
    }

    return prepared;
  }

  function invalidateCache(options){
    options=options||{};

    memo.raw=null;
    memo.dirty=true;

    if(options.dropData===true){
      memo.cache=null;
      memo.volatile=false;
      memo.memoryAt=0;
      return;
    }

    if(memo.cache){
      memo.volatile=true;
    }
  }

  function requestSharedCache(options){
    options=options||{};

    var timeout=Math.max(
      150,
      Number(options.timeout||1800)
    );

    if(
      !window.parent||
      window.parent===window
    ){
      return Promise.resolve(readCache());
    }

    var requestId=
      "bdl-cache-"+
      Date.now()+
      "-"+
      (++requestSequence);

    return new Promise(function(resolve){
      var timer=window.setTimeout(function(){
        delete pending[requestId];
        resolve(readCache());
      },timeout);

      pending[requestId]={
        resolve:function(shared){
          window.clearTimeout(timer);
          delete pending[requestId];

          resolve(
            shared||
            readCache()
          );
        }
      };

      if(!postToParent({
        type:MESSAGE.request,
        requestId:requestId,
        cacheKey:CACHE_KEY,
        revision:memo.revision,
        at:nowISO()
      })){
        window.clearTimeout(timer);
        delete pending[requestId];
        resolve(readCache());
      }
    });
  }

  function handleSharedMessage(event){
    var data=event&&event.data;

    if(
      !data||
      typeof data!=="object"
    ){
      return;
    }

    if(
      data.type!==MESSAGE.response&&
      data.type!==MESSAGE.updated
    ){
      return;
    }

    var shared;

    if(
      data.cache&&
      typeof data.cache==="object"
    ){
      shared=writeCache(
        data.cache,
        {
          broadcast:false,
          emit:false,
          source:"parent-frame-cache",
          allowEmpty:
            data.allowEmpty===true,
          respectIncomingRevision:true
        }
      );
    }else{
      invalidateCache();
      shared=readCache(true);
    }

    if(
      data.type===MESSAGE.response&&
      data.requestId&&
      pending[data.requestId]
    ){
      pending[data.requestId].resolve(shared);
    }

    if(data.type===MESSAGE.updated){
      emit(
        "bdlocal:screen-data-updated",
        {
          source:"parent-frame-cache",
          periods:shared.periods.length,
          students:shared.students.length,
          requirements:
            shared.requirements.length,
          revision:cacheRevision(shared)
        }
      );
    }
  }

  function containsText(haystack,needle){
    needle=normalizeBasic(needle)
      .toLowerCase();

    if(!needle){
      return true;
    }

    return normalizeBasic(haystack)
      .toLowerCase()
      .indexOf(needle)>=0;
  }

  function filterStudents(rows,options){
    options=options||{};
    rows=Array.isArray(rows)?rows:[];

    var periodoId=canonicalPeriodId(
      options.periodoId||
      options.periodId||
      options.period||
      ""
    );

    var matricula=text(
      options.estadoMatricula||
      options.matricula||
      ""
    ).toUpperCase();

    var division=normalizeKey(
      options.division||""
    );

    var carrera=normalizeBasic(
      options.carrera||
      options.career||
      ""
    ).toLowerCase();

    var sede=normalizeBasic(
      options.sede||""
    ).toLowerCase();

    var search=normalizeBasic(
      options.search||
      options.busqueda||
      options.query||
      ""
    ).toLowerCase();

    var limit=Math.max(
      0,
      Number(options.limit||0)
    );

    var out=[];

    for(var i=0;i<rows.length;i+=1){
      var input=rows[i];

      var row=
        input&&
        input.__bdlConUtilsStudentVersion===VERSION
          ?input
          :normalizeStudent(input);

      if(
        periodoId&&
        !samePeriod(
          row.periodoId||
          row._periodoId||
          row.ultimoPeriodoId,
          periodoId
        )
      ){
        continue;
      }

      if(
        matricula&&
        text(
          row._estadoMatricula||
          row.estadoMatricula
        ).toUpperCase()!==matricula
      ){
        continue;
      }

      if(
        division&&
        normalizeKey(
          row._division||
          row.division
        )!==division
      ){
        continue;
      }

      if(
        carrera&&
        !containsText(
          [
            row.NombreCarrera,
            row.nombreCarrera,
            row.Carrera,
            row.carrera,
            row.CodigoCarrera,
            row.codigoCarrera,
            row._carrera
          ].join(" "),
          carrera
        )
      ){
        continue;
      }

      if(
        sede&&
        !containsText(
          [
            row.Sede,
            row.sede,
            row._sede
          ].join(" "),
          sede
        )
      ){
        continue;
      }

      if(
        search&&
        !containsText(
          [
            row.cedula,
            row.numeroIdentificacion,
            row.NumeroIdentificacion,
            row.Nombres,
            row.nombres,
            row.nombreCompleto,
            row._nombres,
            row.NombreCarrera,
            row.nombreCarrera,
            row.Carrera,
            row.carrera,
            row.CodigoCarrera,
            row.codigoCarrera,
            row._carrera,
            row._division,
            row.division,
            row.Sede,
            row.sede,
            row._sede,
            row.CorreoPersonal,
            row.CorreoInstitucional,
            row.correoPersonal,
            row.correoInstitucional,
            row.Celular,
            row.celular,
            row.telefono,
            row.telegramUser,
            row.TelegramUser,
            row.telegramChatId,
            row.TelegramChatId
          ].join(" "),
          search
        )
      ){
        continue;
      }

      out.push(row);

      if(limit>0&&out.length>=limit){
        break;
      }
    }

    return out;
  }

  function getGlobal(name){
    return window[name]||null;
  }

  window.addEventListener(
    "message",
    handleSharedMessage
  );

  window.addEventListener(
    "storage",
    function(event){
      if(!event||event.key===CACHE_KEY){
        if(
          !event||
          event.newValue!==memo.raw
        ){
          memo.dirty=true;
          memo.raw=null;
        }
      }
    }
  );

  window.BDLocalConUtils={
    version:VERSION,
    cacheKey:CACHE_KEY,
    signalKey:SIGNAL_KEY,
    messages:Object.assign({},MESSAGE),
    text:text,
    nowISO:nowISO,
    clone:clone,
    safeParse:safeParse,
    normalizeBasic:normalizeBasic,
    normalizeKey:normalizeKey,
    normalizeCedula:normalizeCedula,
    canonicalPeriodId:canonicalPeriodId,
    normalizePeriod:normalizePeriod,
    samePeriod:samePeriod,
    normalizeStudent:normalizeStudent,
    filterStudents:filterStudents,
    emptyCache:emptyCache,
    normalizeCache:normalizeCache,
    mergeCache:mergeCache,
    hasData:hasData,
    readCache:readCache,
    writeCache:writeCache,
    invalidateCache:invalidateCache,
    requestSharedCache:requestSharedCache,
    emit:emit,
    getGlobal:getGlobal,

    status:function(){
      var cache=readCache();

      return {
        version:VERSION,
        volatile:memo.volatile,
        periods:cache.periods.length,
        students:cache.students.length,
        requirements:
          cache.requirements.length,
        memoryAt:memo.memoryAt,
        revision:cacheRevision(cache),
        storageReads:memo.storageReads,
        storageWrites:memo.storageWrites,
        skippedWrites:memo.skippedWrites,
        parseCount:memo.parseCount,
        lastWriteAt:memo.lastWriteAt
      };
    }
  };
})(window);
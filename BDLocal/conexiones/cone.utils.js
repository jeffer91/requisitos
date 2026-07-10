(function(window){
  "use strict";

  var VERSION="1.3.0-volatile-last-good";
  var CACHE_KEY="REQ_BDLOCAL_CONEXIONES_CACHE_V1";
  var SIGNAL_KEY="REQ_BDLOCAL_CONEXIONES_SIGNAL_V1";
  var MESSAGE={
    publish:"requisitos:bdlocal-cache:publish",
    request:"requisitos:bdlocal-cache:request",
    response:"requisitos:bdlocal-cache:response",
    updated:"requisitos:bdlocal-cache:updated"
  };

  var memo={raw:null,cache:null,volatile:false,memoryAt:0};
  var pending=Object.create(null);
  var requestSequence=0;

  function text(value){return String(value==null?"":value).trim();}
  function nowISO(){return new Date().toISOString();}
  function clone(value){try{return structuredClone(value);}catch(error){try{return JSON.parse(JSON.stringify(value));}catch(inner){return value;}}}
  function array(value){return Array.isArray(value)?value:[];}
  function hasRows(value){return Array.isArray(value)&&value.length>0;}
  function object(value){return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}

  function safeParse(value,fallback){
    try{
      if(!value){return fallback;}
      var parsed=JSON.parse(value);
      return parsed==null?fallback:parsed;
    }catch(error){return fallback;}
  }

  function storageGet(key){
    try{return window.localStorage.getItem(key)||"";}
    catch(error){return "";}
  }

  function storageSet(key,value){
    try{
      window.localStorage.setItem(key,value);
      return true;
    }catch(error){return false;}
  }

  function normalizeBasic(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
  }

  function normalizeKey(value){return normalizeBasic(value).toLowerCase().replace(/[^a-z0-9]+/g,"");}

  function normalizeCedula(value){
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }

  function canonicalPeriodId(value){
    value=text(value);
    if(!value){return "";}
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }

  function samePeriod(a,b){
    a=canonicalPeriodId(a);
    b=canonicalPeriodId(b);
    return !b||!!a&&(a===b||normalizeKey(a)===normalizeKey(b));
  }

  function normalizePeriod(period){
    period=period||{};
    var id=canonicalPeriodId(period.periodoCanonicoId||period.periodoId||period.periodId||period.id||period.value||period.key||"");
    if(!id){return null;}
    var label=text(period.periodoCanonicoLabel||period.periodoLabel||period.label||period.nombre||period.name||id);
    return Object.assign({},period,{
      id:id,value:id,key:id,label:label,nombre:label,
      periodoId:id,periodId:id,periodoLabel:label,
      periodoCanonicoId:id,periodoCanonicoLabel:label,
      divisiones:Array.isArray(period.divisiones)?period.divisiones:[],
      carrerasDetectadas:Array.isArray(period.carrerasDetectadas)?period.carrerasDetectadas:[]
    });
  }

  function emptyCache(){
    return {
      meta:{
        app:"Requisitos",module:"BDLocalConexiones",version:VERSION,source:"empty",
        updatedAt:nowISO(),totalPeriods:0,totalStudents:0,refreshMode:"empty"
      },
      periods:[],students:[],requirements:[],summaries:{},diagnostics:[]
    };
  }

  function normalizeStudent(row){
    row=Object.assign({},row||{});

    var cedula=normalizeCedula(
      row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.identificacion||
      row.Identificacion||row.Cedula||row["Cédula"]||""
    );

    var periodoId=canonicalPeriodId(
      row.periodoId||row.periodId||row.ultimoPeriodoId||row.idPeriodo||
      row._periodoId||row._bl2PeriodoId||""
    );

    var periodoLabel=text(
      row.periodoLabel||row.periodo||row.Periodo||row._periodo||row._bl2Periodo||periodoId
    );

    var nombres=text(row.Nombres||row.nombres||row.nombreCompleto||row.Nombre||row.nombre||row.Estudiante||row.estudiante||row._nombres||"");
    var carrera=text(row.NombreCarrera||row.nombreCarrera||row.Carrera||row.carrera||row._carrera||"");
    var division=text(row._division||row.division||row.Division||row["División"]||"Sin división");
    var estado=text(row._estadoMatricula||row.estadoMatricula||row.EstadoMatricula||"ACTIVO").toUpperCase()==="RETIRADO"?"RETIRADO":"ACTIVO";

    row.id=row.id||row._id||(cedula&&periodoId?cedula+"__"+periodoId:cedula);
    row._id=row._id||row.id;
    row.studentId=row.studentId||row.idEstudiantePeriodo||row.id;
    row.idEstudiantePeriodo=row.idEstudiantePeriodo||(cedula&&periodoId?cedula+"__"+periodoId:row.studentId||row.id);
    row.cedula=cedula;
    row._cedula=row._cedula||cedula;
    row.numeroIdentificacion=row.numeroIdentificacion||cedula;
    row.NumeroIdentificacion=row.NumeroIdentificacion||cedula;
    row.periodoId=periodoId;
    row.periodId=periodoId;
    row.ultimoPeriodoId=row.ultimoPeriodoId||periodoId;
    row.periodoLabel=periodoLabel;
    row.Periodo=row.Periodo||periodoLabel;
    row._periodoId=row._periodoId||periodoId;
    row._periodo=row._periodo||periodoLabel;
    row.Nombres=row.Nombres||nombres;
    row.nombres=row.nombres||nombres;
    row.nombreCompleto=row.nombreCompleto||nombres;
    row._nombres=row._nombres||nombres;
    row.NombreCarrera=row.NombreCarrera||carrera;
    row.Carrera=row.Carrera||carrera;
    row._carrera=row._carrera||carrera||"SIN CARRERA";
    row.division=row.division||division;
    row._division=division;
    row._estadoMatricula=estado;
    row.estadoMatricula=row.estadoMatricula||estado;
    return row;
  }

  function normalizeCache(cache){
    cache=cache&&typeof cache==="object"?clone(cache):emptyCache();
    cache.meta=object(cache.meta);
    cache.periods=array(cache.periods).map(normalizePeriod).filter(Boolean);
    cache.students=array(cache.students).map(normalizeStudent);
    cache.requirements=array(cache.requirements);
    cache.summaries=object(cache.summaries);
    cache.diagnostics=array(cache.diagnostics);
    cache.meta.app=cache.meta.app||"Requisitos";
    cache.meta.module=cache.meta.module||"BDLocalConexiones";
    cache.meta.version=VERSION;
    cache.meta.source=cache.meta.source||"cache";
    cache.meta.updatedAt=cache.meta.updatedAt||nowISO();
    cache.meta.totalPeriods=cache.periods.length;
    cache.meta.totalStudents=cache.students.length;
    return cache;
  }

  function hasData(cache){
    cache=cache||{};
    return hasRows(cache.periods)||hasRows(cache.students)||hasRows(cache.requirements);
  }

  function cacheTime(cache){
    var value=Date.parse(text(cache&&cache.meta&&cache.meta.updatedAt));
    return Number.isFinite(value)?value:0;
  }

  function cacheWeight(cache){
    cache=cache||{};
    return array(cache.students).length*1000000+array(cache.periods).length*1000+array(cache.requirements).length;
  }

  function preferCache(a,b){
    a=normalizeCache(a||emptyCache());
    b=normalizeCache(b||emptyCache());
    var at=cacheTime(a);
    var bt=cacheTime(b);
    if(at!==bt){return at>bt?a:b;}
    return cacheWeight(a)>=cacheWeight(b)?a:b;
  }

  function mergeCache(incoming,current,options){
    options=options||{};
    incoming=normalizeCache(incoming||emptyCache());
    current=normalizeCache(current||emptyCache());
    var allowEmpty=options.allowEmpty===true;
    var preferred=preferCache(incoming,current);
    var fallback=preferred===incoming?current:incoming;
    var result=normalizeCache(preferred);

    if(!allowEmpty){
      if(!hasRows(result.periods)&&hasRows(fallback.periods)){result.periods=clone(fallback.periods);}
      if(!hasRows(result.students)&&hasRows(fallback.students)){result.students=clone(fallback.students);}
      if(!hasRows(result.requirements)&&hasRows(fallback.requirements)){result.requirements=clone(fallback.requirements);}
    }

    result.summaries=Object.assign({},object(fallback.summaries),object(result.summaries));
    if(!hasRows(result.diagnostics)&&hasRows(fallback.diagnostics)){result.diagnostics=clone(fallback.diagnostics);}
    result.meta=Object.assign({},object(fallback.meta),object(result.meta),{
      version:VERSION,
      updatedAt:text(result.meta.updatedAt)||nowISO(),
      totalPeriods:result.periods.length,
      totalStudents:result.students.length,
      volatileProtected:true
    });
    return normalizeCache(result);
  }

  function readCache(force){
    var raw=storageGet(CACHE_KEY);
    var stored=normalizeCache(safeParse(raw,null));

    if(memo.cache){
      if(memo.volatile){
        memo.cache=mergeCache(memo.cache,stored,{allowEmpty:false});
        return clone(memo.cache);
      }
      if(!force&&memo.raw===raw){return clone(memo.cache);}
      memo.cache=mergeCache(stored,memo.cache,{allowEmpty:false});
      memo.raw=raw;
      return clone(memo.cache);
    }

    memo.raw=raw;
    memo.cache=stored;
    memo.volatile=false;
    memo.memoryAt=Date.now();
    return clone(stored);
  }

  function postToParent(message){
    try{
      if(window.parent&&window.parent!==window&&typeof window.parent.postMessage==="function"){
        window.parent.postMessage(clone(message),"*");
        return true;
      }
    }catch(error){}
    return false;
  }

  function writeCache(cache,options){
    options=options||{};
    var current=memo.cache||normalizeCache(safeParse(storageGet(CACHE_KEY),null));
    cache=mergeCache(cache,current,{allowEmpty:options.allowEmpty===true});
    cache.meta.updatedAt=nowISO();
    cache.meta.version=VERSION;

    var raw="";
    try{raw=JSON.stringify(cache);}catch(error){raw=JSON.stringify(emptyCache());}

    var stored=storageSet(CACHE_KEY,raw);
    memo.raw=stored?raw:storageGet(CACHE_KEY);
    memo.cache=cache;
    memo.volatile=!stored;
    memo.memoryAt=Date.now();

    emit("bdlocal:conexiones-cache-updated",{
      ok:stored,
      volatile:!stored,
      periods:cache.periods.length,
      students:cache.students.length,
      requirements:cache.requirements.length,
      refreshMode:cache.meta.refreshMode||"",
      source:cache.meta.source||"BDLocal"
    });

    if(options.broadcast!==false){
      postToParent({
        type:MESSAGE.publish,
        source:options.source||cache.meta.source||"BDLocalConexiones",
        cache:cache,
        allowEmpty:options.allowEmpty===true,
        at:nowISO()
      });
    }

    return clone(cache);
  }

  function invalidateCache(options){
    options=options||{};
    memo.raw=null;
    if(options.dropData===true){
      memo.cache=null;
      memo.volatile=false;
      memo.memoryAt=0;
    }else if(memo.cache){
      memo.volatile=true;
    }
  }

  function emit(name,detail){
    detail=Object.assign({at:nowISO()},clone(detail||{}));
    try{window.dispatchEvent(new CustomEvent(name,{detail:detail}));}catch(error){}
    storageSet(SIGNAL_KEY,JSON.stringify({name:name,detail:detail}));
  }

  function requestSharedCache(options){
    options=options||{};
    var timeout=Math.max(150,Number(options.timeout||1800));

    if(!window.parent||window.parent===window){return Promise.resolve(readCache());}

    var requestId="bdl-cache-"+Date.now()+"-"+(++requestSequence);

    return new Promise(function(resolve){
      var timer=window.setTimeout(function(){
        delete pending[requestId];
        resolve(readCache());
      },timeout);

      pending[requestId]={
        resolve:function(cache){
          window.clearTimeout(timer);
          delete pending[requestId];
          resolve(cache||readCache());
        }
      };

      if(!postToParent({type:MESSAGE.request,requestId:requestId,at:nowISO()})){
        window.clearTimeout(timer);
        delete pending[requestId];
        resolve(readCache());
      }
    });
  }

  function handleSharedMessage(event){
    var data=event&&event.data;
    if(!data||typeof data!=="object"){return;}
    if(data.type!==MESSAGE.response&&data.type!==MESSAGE.updated){return;}
    if(!data.cache||typeof data.cache!=="object"){return;}

    var shared=writeCache(data.cache,{broadcast:false,source:"parent-frame-cache",allowEmpty:data.allowEmpty===true});

    if(data.type===MESSAGE.response&&data.requestId&&pending[data.requestId]){
      pending[data.requestId].resolve(shared);
    }

    if(data.type===MESSAGE.updated){
      emit("bdlocal:screen-data-updated",{
        source:"parent-frame-cache",
        periods:shared.periods.length,
        students:shared.students.length,
        requirements:shared.requirements.length
      });
    }
  }

  function filterStudents(rows,options){
    options=options||{};
    rows=Array.isArray(rows)?rows.map(normalizeStudent):[];

    var periodoId=canonicalPeriodId(options.periodoId||options.periodId||options.period||"");
    var matricula=text(options.estadoMatricula||options.matricula||"");
    var division=normalizeBasic(options.division||"").toLowerCase();
    var search=normalizeBasic(options.search||options.busqueda||options.query||"").toLowerCase();
    var limit=Number(options.limit||0);

    var out=rows.filter(function(row){
      if(periodoId&&!samePeriod(row.periodoId||row._periodoId||row.ultimoPeriodoId,periodoId)){return false;}
      if(matricula&&text(row._estadoMatricula||row.estadoMatricula).toUpperCase()!==matricula.toUpperCase()){return false;}
      if(division&&normalizeBasic(row._division||row.division||"").toLowerCase()!==division){return false;}

      if(search){
        var hay=normalizeBasic([
          row.cedula,row.numeroIdentificacion,row.Nombres,row.nombres,row._nombres,
          row.NombreCarrera,row.CodigoCarrera,row._carrera,row._division,
          row.CorreoPersonal,row.CorreoInstitucional,row.Celular
        ].join(" ")).toLowerCase();
        if(hay.indexOf(search)<0){return false;}
      }
      return true;
    });

    return limit>0?out.slice(0,limit):out;
  }

  function getGlobal(name){return window[name]||null;}

  window.addEventListener("message",handleSharedMessage);

  window.BDLocalConUtils={
    version:VERSION,
    cacheKey:CACHE_KEY,
    signalKey:SIGNAL_KEY,
    messages:clone(MESSAGE),
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
        requirements:cache.requirements.length,
        memoryAt:memo.memoryAt
      };
    }
  };
})(window);

/* =========================================================
Nombre completo: maq-baselocal-session.js
Ruta o ubicación: /Requisitos/Maqueta/maq-baselocal-session.js
Función o funciones:
- Mantener en la ventana principal una copia compartida de BDLocal.
- Recibir caché desde Carga o BL mediante postMessage seguro.
- Entregar la misma caché a Tabla, Ficha, Stats, Coordi y Reportes.
- Combinar períodos, estudiantes y requisitos sin reemplazar colecciones válidas por vacías.
- Conservar la última copia completa aunque localStorage no admita el tamaño del contenido.
- No sincronizar servicios externos ni modificar IndexedDB.
========================================================= */
(function(window,document){
  "use strict";

  var SNAPSHOT_KEY="REQ_EXCEL_LOCAL_V1:snapshot";
  var CACHE_KEY="REQ_BDLOCAL_CONEXIONES_CACHE_V1";
  var SIGNAL_KEY="REQ_BL_SIGNAL_V1";
  var STATUS_KEY="REQ_MAQ_BASELOCAL_SESSION_STATUS_V1";
  var VERSION="1.3.0-collection-safe-bridge";

  var MESSAGE={
    publish:"requisitos:bdlocal-cache:publish",
    request:"requisitos:bdlocal-cache:request",
    response:"requisitos:bdlocal-cache:response",
    updated:"requisitos:bdlocal-cache:updated"
  };

  var cache={
    ready:false,
    raw:"",
    snapshot:null,
    loadedAt:"",
    updatedAt:"",
    source:"lazy",
    volatile:false,
    errorMessage:""
  };

  function now(){return new Date().toISOString();}
  function clone(value){try{return structuredClone(value);}catch(error){try{return JSON.parse(JSON.stringify(value==null?null:value));}catch(inner){return value;}}}
  function safeParse(value,fallback){try{return value?JSON.parse(value):fallback;}catch(error){return fallback;}}
  function array(value){return Array.isArray(value)?value:[];}
  function object(value){return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}
  function hasRows(value){return Array.isArray(value)&&value.length>0;}

  function emptySnapshot(){
    var at=now();
    return {
      meta:{app:"Requisitos",module:"BDLocalCompartida",source:"maq-session",version:VERSION,createdAt:at,updatedAt:at,totalPeriods:0,totalStudents:0,refreshMode:"empty"},
      periods:[],students:[],requirements:[],summaries:{},history:[],diagnostics:[]
    };
  }

  function normalizeSnapshot(snapshot){
    var base=snapshot&&typeof snapshot==="object"?clone(snapshot):emptySnapshot();
    base.meta=object(base.meta);
    base.periods=array(base.periods);
    base.students=array(base.students);
    base.requirements=array(base.requirements);
    base.summaries=object(base.summaries);
    base.history=array(base.history);
    base.diagnostics=array(base.diagnostics);
    base.meta.app=base.meta.app||"Requisitos";
    base.meta.module=base.meta.module||"BDLocalCompartida";
    base.meta.version=VERSION;
    base.meta.totalPeriods=base.periods.length;
    base.meta.totalStudents=base.students.length;
    base.meta.updatedAt=base.meta.updatedAt||now();
    return base;
  }

  function hasData(snapshot){
    snapshot=snapshot||{};
    return hasRows(snapshot.students)||hasRows(snapshot.periods)||hasRows(snapshot.requirements);
  }

  function snapshotTime(snapshot){
    var value=Date.parse(String(snapshot&&snapshot.meta&&snapshot.meta.updatedAt||""));
    return Number.isFinite(value)?value:0;
  }

  function snapshotWeight(snapshot){
    snapshot=snapshot||{};
    return array(snapshot.students).length*1000000+array(snapshot.periods).length*1000+array(snapshot.requirements).length;
  }

  function preferredSnapshot(a,b){
    a=normalizeSnapshot(a||emptySnapshot());
    b=normalizeSnapshot(b||emptySnapshot());
    var at=snapshotTime(a);
    var bt=snapshotTime(b);
    if(at!==bt){return at>bt?a:b;}
    return snapshotWeight(a)>=snapshotWeight(b)?a:b;
  }

  function mergeSnapshots(incoming,current,options){
    options=options||{};
    incoming=normalizeSnapshot(incoming||emptySnapshot());
    current=normalizeSnapshot(current||emptySnapshot());

    if(options.replace===true){return incoming;}

    var preferred=preferredSnapshot(incoming,current);
    var fallback=preferred===incoming?current:incoming;
    var result=normalizeSnapshot(preferred);
    var allowEmpty=options.allowEmpty===true;

    if(!allowEmpty){
      if(!hasRows(result.periods)&&hasRows(fallback.periods)){result.periods=clone(fallback.periods);}
      if(!hasRows(result.students)&&hasRows(fallback.students)){result.students=clone(fallback.students);}
      if(!hasRows(result.requirements)&&hasRows(fallback.requirements)){result.requirements=clone(fallback.requirements);}
      if(!hasRows(result.history)&&hasRows(fallback.history)){result.history=clone(fallback.history);}
      if(!hasRows(result.diagnostics)&&hasRows(fallback.diagnostics)){result.diagnostics=clone(fallback.diagnostics);}
    }

    result.summaries=Object.assign({},object(fallback.summaries),object(result.summaries));
    result.meta=Object.assign({},object(fallback.meta),object(result.meta),{
      version:VERSION,
      totalPeriods:result.periods.length,
      totalStudents:result.students.length,
      collectionSafe:true,
      bridgeVersion:VERSION
    });
    return normalizeSnapshot(result);
  }

  function saveStatus(status){
    var data=Object.assign({version:VERSION,updatedAt:now()},status||{});
    try{window.localStorage.setItem(STATUS_KEY,JSON.stringify(data));}catch(error){}
    return data;
  }

  function emit(kind,payload){
    var detail=Object.assign({kind:kind,at:now()},payload||{});
    try{window.dispatchEvent(new CustomEvent("maq:baselocal-session:"+kind,{detail:clone(detail)}));}catch(error){}
    try{window.localStorage.setItem(SIGNAL_KEY,JSON.stringify({id:"maq-session-"+Date.now(),kind:"session-"+kind,payload:detail,at:now()}));}catch(error){}
  }

  function storageValue(key){
    try{return window.localStorage.getItem(key)||"";}catch(error){return "";}
  }

  function readLocalSnapshot(){
    var rawCache=storageValue(CACHE_KEY);
    var rawLegacy=storageValue(SNAPSHOT_KEY);
    var current=safeParse(rawCache,null);
    var legacy=safeParse(rawLegacy,null);
    return {
      raw:rawCache||rawLegacy||"",
      snapshot:mergeSnapshots(current,legacy,{allowEmpty:false})
    };
  }

  function ensureReady(options){
    options=options||{};
    var force=options.force===true;
    if(cache.ready&&!force){return getStatus();}

    try{
      var local=readLocalSnapshot();
      var existing=cache.snapshot||emptySnapshot();
      var snapshot=mergeSnapshots(local.snapshot,existing,{allowEmpty:false});
      cache.ready=true;
      cache.raw=local.raw;
      cache.snapshot=snapshot;
      cache.loadedAt=cache.loadedAt||now();
      cache.updatedAt=now();
      cache.source=hasData(snapshot)?(local.raw?"localStorage-merged":"memory"):"empty";
      cache.errorMessage="";

      var status=getStatus();
      saveStatus(status);
      emit("ready",status);
      return status;
    }catch(error){
      cache.ready=true;
      cache.raw=cache.raw||"";
      cache.snapshot=cache.snapshot||emptySnapshot();
      cache.loadedAt=cache.loadedAt||now();
      cache.updatedAt=now();
      cache.source="fallback";
      cache.errorMessage=error&&error.message?error.message:String(error);
      var failed=getStatus();
      saveStatus(failed);
      emit("error",failed);
      return failed;
    }
  }

  function getSnapshot(options){
    options=options||{};
    ensureReady({force:options.force===true});
    return options.clone===false?cache.snapshot:clone(cache.snapshot);
  }

  function persistSnapshot(raw){
    var stored=false;
    try{
      window.localStorage.setItem(CACHE_KEY,raw);
      stored=true;
    }catch(error){}
    try{window.localStorage.setItem(SNAPSHOT_KEY,raw);}catch(error2){}
    return stored;
  }

  function setSnapshot(snapshot,options){
    options=options||{};
    var current=cache.snapshot||readLocalSnapshot().snapshot||emptySnapshot();
    var clean=mergeSnapshots(snapshot,current,{
      allowEmpty:options.allowEmpty===true,
      replace:options.replace===true
    });
    clean.meta=Object.assign({},clean.meta||{}, {
      source:options.source||clean.meta.source||"setSnapshot",
      updatedAt:now(),
      totalPeriods:clean.periods.length,
      totalStudents:clean.students.length,
      bridgeVersion:VERSION,
      collectionSafe:true
    });

    var raw="";
    try{raw=JSON.stringify(clean);}catch(error){raw=JSON.stringify(emptySnapshot());}
    var stored=options.alreadyStored===true?true:persistSnapshot(raw);

    cache.ready=true;
    cache.raw=stored?raw:cache.raw;
    cache.snapshot=clean;
    cache.updatedAt=now();
    cache.loadedAt=cache.loadedAt||now();
    cache.source=options.source||"setSnapshot";
    cache.volatile=!stored;
    cache.errorMessage="";

    var status=getStatus();
    status.persisted=stored;
    saveStatus(status);
    emit("updated",status);
    return options.clone===false?clean:clone(clean);
  }

  function invalidate(reason){
    cache.ready=false;
    cache.errorMessage="";
    cache.source=reason||"invalidate";
    emit("invalidated",{reason:reason||"manual"});
  }

  function getCounts(){ensureReady();return getCountsRaw();}

  function getStatus(){
    var counts=cache.snapshot?getCountsRaw():{periods:0,students:0,requirements:0,history:0};
    return {
      ok:!cache.errorMessage,
      ready:cache.ready,
      source:cache.source,
      loadedAt:cache.loadedAt,
      updatedAt:cache.updatedAt,
      errorMessage:cache.errorMessage,
      periods:counts.periods,
      students:counts.students,
      requirements:counts.requirements,
      history:counts.history,
      volatile:cache.volatile,
      bridge:true,
      collectionSafe:true,
      version:VERSION
    };
  }

  function getCountsRaw(){
    return {
      periods:Array.isArray(cache.snapshot&&cache.snapshot.periods)?cache.snapshot.periods.length:0,
      students:Array.isArray(cache.snapshot&&cache.snapshot.students)?cache.snapshot.students.length:0,
      requirements:Array.isArray(cache.snapshot&&cache.snapshot.requirements)?cache.snapshot.requirements.length:0,
      history:Array.isArray(cache.snapshot&&cache.snapshot.history)?cache.snapshot.history.length:0
    };
  }

  function isKnownFrameSource(source){
    if(!source){return false;}
    try{
      var frames=document.querySelectorAll("iframe");
      for(var index=0;index<frames.length;index+=1){
        if(frames[index].contentWindow===source){return true;}
      }
    }catch(error){}
    return false;
  }

  function send(target,message){
    try{
      if(target&&typeof target.postMessage==="function"){
        target.postMessage(clone(message),"*");
        return true;
      }
    }catch(error){}
    return false;
  }

  function broadcastSnapshot(reason,exceptSource){
    var snapshot=getSnapshot();
    var message={
      type:MESSAGE.updated,
      reason:reason||"updated",
      cache:snapshot,
      status:getStatus(),
      allowEmpty:false,
      at:now()
    };

    try{
      var frames=document.querySelectorAll("iframe");
      Array.prototype.forEach.call(frames,function(frame){
        if(frame.contentWindow&&frame.contentWindow!==exceptSource){send(frame.contentWindow,message);}
      });
    }catch(error){}

    return message;
  }

  function acceptPublishedCache(event,data){
    if(!isKnownFrameSource(event.source)){return;}

    var incoming=normalizeSnapshot(data.cache||data.snapshot||emptySnapshot());
    var current=getSnapshot();
    var merged=mergeSnapshots(incoming,current,{allowEmpty:data.allowEmpty===true});

    if(!hasData(incoming)&&hasData(current)&&data.allowEmpty!==true){
      send(event.source,{
        type:MESSAGE.response,
        requestId:data.requestId||"",
        cache:current,
        status:getStatus(),
        ignoredEmpty:true,
        at:now()
      });
      return;
    }

    setSnapshot(merged,{source:data.source||"iframe-publish",allowEmpty:data.allowEmpty===true});
    broadcastSnapshot(data.source||"iframe-publish",event.source);
  }

  function handleMessage(event){
    var data=event&&event.data;
    if(!data||typeof data!=="object"||!data.type){return;}

    if(data.type===MESSAGE.publish){
      acceptPublishedCache(event,data);
      return;
    }

    if(data.type===MESSAGE.request){
      if(!isKnownFrameSource(event.source)){return;}
      ensureReady();
      send(event.source,{
        type:MESSAGE.response,
        requestId:String(data.requestId||""),
        cache:getSnapshot(),
        status:getStatus(),
        allowEmpty:false,
        at:now()
      });
    }
  }

  function boot(){
    ensureReady();
    saveStatus(getStatus());
    emit("lazy",{ready:cache.ready,source:cache.source,message:"Base Local compartida preparada sin reemplazar colecciones válidas por respuestas vacías."});
  }

  window.addEventListener("message",handleMessage);

  window.MAQ_BASELOCAL_SESSION={
    version:VERSION,
    key:SNAPSHOT_KEY,
    cacheKey:CACHE_KEY,
    messages:clone(MESSAGE),
    ensureReady:ensureReady,
    getSnapshot:getSnapshot,
    setSnapshot:setSnapshot,
    mergeSnapshots:mergeSnapshots,
    publishSnapshot:function(snapshot,options){
      var result=setSnapshot(snapshot,options||{});
      broadcastSnapshot(options&&options.source||"parent-publish");
      return result;
    },
    broadcastSnapshot:broadcastSnapshot,
    invalidate:invalidate,
    getCounts:getCounts,
    getStatus:getStatus
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot);
  }else{
    boot();
  }
})(window,document);

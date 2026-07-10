/* =========================================================
Nombre completo: tabla.data-guard.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.data-guard.js
Función o funciones:
- Conservar la última caché válida de períodos, estudiantes y requisitos.
- Evitar que respuestas vacías transitorias oculten datos válidos en Tabla.
- No clonar la base completa en cada lectura o evento.
- No sobrescribir conectores reales ni servicios paginados de BDLocal.
- Instalar adaptadores de emergencia únicamente cuando una API no existe.
- Agrupar eventos repetidos para evitar múltiples recargas del mismo cambio.
Con qué se conecta:
- BDLocalConUtils.
- BDLocalScreenDeps.
- ConTabla y BDLocalTabla.
- BL2DataEngine, BL2EstudiantesRepo y ExcelLocalRepo.
- tabla.core.js y tabla.app.js.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.1.0-light-last-good";
  var FALLBACK_SOURCE="TablaDataGuardFallback";
  var CACHE_KEY="REQ_BDLOCAL_CONEXIONES_CACHE_V1";
  var OLD_CACHE_KEY="REQ_EXCEL_LOCAL_V1:snapshot";

  var lastGood={
    meta:{source:"tabla-data-guard",updatedAt:""},
    periods:[],
    students:[],
    requirements:[],
    summaries:{},
    diagnostics:[]
  };

  var state={
    installed:false,
    timer:null,
    refreshTimer:null,
    revision:0,
    lastEvent:""
  };

  function text(value){return String(value==null?"":value).trim();}
  function array(value){return Array.isArray(value)?value:[];}
  function object(value){return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}
  function hasRows(value){return Array.isArray(value)&&value.length>0;}

  function hasData(cache){
    cache=cache||{};
    return hasRows(cache.periods)||hasRows(cache.students)||hasRows(cache.requirements);
  }

  function utils(){
    return window.BDLocalConUtils||null;
  }

  function normalizeEnvelope(cache){
    cache=cache&&typeof cache==="object"?cache:{};

    return {
      meta:object(cache.meta),
      periods:array(cache.periods),
      students:array(cache.students),
      requirements:array(cache.requirements),
      summaries:object(cache.summaries),
      diagnostics:array(cache.diagnostics)
    };
  }

  function remember(cache){
    cache=normalizeEnvelope(cache);

    if(hasRows(cache.periods)&&cache.periods!==lastGood.periods){
      lastGood.periods=cache.periods;
    }

    if(hasRows(cache.students)&&cache.students!==lastGood.students){
      lastGood.students=cache.students;
    }

    if(hasRows(cache.requirements)&&cache.requirements!==lastGood.requirements){
      lastGood.requirements=cache.requirements;
    }

    if(Object.keys(cache.summaries).length){
      lastGood.summaries=cache.summaries;
    }

    if(hasRows(cache.diagnostics)){
      lastGood.diagnostics=cache.diagnostics;
    }

    if(hasData(cache)){
      state.revision+=1;
      lastGood.meta=Object.assign({},lastGood.meta,cache.meta,{
        source:text(cache.meta&&cache.meta.source)||"tabla-data-guard",
        updatedAt:text(cache.meta&&cache.meta.updatedAt)||new Date().toISOString(),
        totalPeriods:lastGood.periods.length,
        totalStudents:lastGood.students.length,
        guarded:true,
        guardVersion:VERSION,
        guardRevision:state.revision
      });
    }

    return cache;
  }

  function preserve(cache,allowEmpty){
    cache=remember(cache);

    if(allowEmpty===true||!hasData(lastGood)){
      return cache;
    }

    var periods=hasRows(cache.periods)?cache.periods:lastGood.periods;
    var students=hasRows(cache.students)?cache.students:lastGood.students;
    var requirements=hasRows(cache.requirements)?cache.requirements:lastGood.requirements;
    var summaries=Object.keys(cache.summaries).length?cache.summaries:lastGood.summaries;
    var diagnostics=hasRows(cache.diagnostics)?cache.diagnostics:lastGood.diagnostics;

    return {
      meta:Object.assign({},lastGood.meta,cache.meta,{
        totalPeriods:periods.length,
        totalStudents:students.length,
        preservedByTablaGuard:true,
        guardVersion:VERSION
      }),
      periods:periods,
      students:students,
      requirements:requirements,
      summaries:summaries,
      diagnostics:diagnostics
    };
  }

  function readFresh(force){
    var U=utils();

    try{
      if(U&&typeof U.readCache==="function"){
        return U.readCache(force===true);
      }
    }catch(error){}

    try{
      if(window.BDLocalScreenDeps&&typeof window.BDLocalScreenDeps.readCache==="function"){
        return window.BDLocalScreenDeps.readCache(force===true);
      }
    }catch(error2){}

    return {};
  }

  function stableCache(options){
    options=options||{};
    return preserve(readFresh(options.force===true),options.allowEmpty===true);
  }

  function filterStudents(rows,options){
    var U=utils();

    if(U&&typeof U.filterStudents==="function"){
      return U.filterStudents(rows,options||{});
    }

    rows=array(rows);
    var limit=Math.max(0,Number(options&&options.limit||0));
    return limit>0?rows.slice(0,limit):rows.slice();
  }

  function listPeriods(){
    var U=utils();

    return stableCache().periods.map(function(item){
      if(U&&typeof U.normalizePeriod==="function"){
        return U.normalizePeriod(item);
      }
      return item;
    }).filter(Boolean);
  }

  function listStudents(options){
    options=options||{};

    var rows=filterStudents(stableCache().students,options);

    return {
      ok:true,
      rows:rows,
      total:rows.length,
      periodList:listPeriods(),
      source:FALLBACK_SOURCE
    };
  }

  function getStudents(options){
    return listStudents(options||{}).rows;
  }

  function listAllStudents(){
    return getStudents({matricula:""});
  }

  function listStudentsByStatus(status,periodoId){
    return getStudents({
      matricula:status||"",
      periodoId:periodoId||""
    });
  }

  function normalizeCedula(value){
    var U=utils();
    return U&&typeof U.normalizeCedula==="function"
      ? U.normalizeCedula(value)
      : text(value).replace(/[^0-9A-Za-z]/g,"");
  }

  function getStudentById(id,options){
    id=text(id);
    if(!id)return null;

    var rows=getStudents(Object.assign({},options||{}, {
      matricula:options&&options.matricula!=null?options.matricula:""
    }));

    for(var i=0;i<rows.length;i+=1){
      var row=rows[i]||{};
      if(
        text(row.id)===id||
        text(row._id)===id||
        text(row.studentId)===id||
        text(row.idEstudiantePeriodo)===id||
        text(row.cedula)===id||
        text(row.numeroIdentificacion)===id
      ){
        return row;
      }
    }

    return null;
  }

  function getStudentByCedula(cedula,periodoId){
    var wanted=normalizeCedula(cedula);
    var rows=getStudents({periodoId:periodoId||"",matricula:""});

    for(var i=0;i<rows.length;i+=1){
      var row=rows[i]||{};
      if(normalizeCedula(row.cedula||row.numeroIdentificacion)===wanted){
        return row;
      }
    }

    return null;
  }

  function getSnapshot(){
    var cache=stableCache();

    return {
      meta:cache.meta,
      periods:cache.periods,
      students:cache.students,
      requirements:cache.requirements,
      summaries:cache.summaries,
      diagnostics:cache.diagnostics,
      history:[]
    };
  }

  function fallbackCommon(){
    return {
      source:FALLBACK_SOURCE,
      listPeriods:listPeriods,
      getPeriods:listPeriods,
      periods:listPeriods,
      listStudents:listStudents,
      getStudents:getStudents,
      getRows:getStudents,
      rows:getStudents,
      all:getStudents,
      listar:getStudents,
      listAllStudents:listAllStudents,
      filterStudents:getStudents,
      listStudentsByStatus:listStudentsByStatus,
      getStudentById:getStudentById,
      getStudentByCedula:getStudentByCedula,
      buscarPorCedula:getStudentByCedula,
      byCedula:getStudentByCedula,
      getSnapshot:getSnapshot
    };
  }

  function isFallback(api){
    return !!(api&&api.source===FALLBACK_SOURCE);
  }

  function addMissing(api,methods){
    api=api&&typeof api==="object"?api:{};

    Object.keys(methods).forEach(function(key){
      if(typeof api[key]!=="function"&&key!=="source"){
        api[key]=methods[key];
      }
    });

    if(!api.source){
      api.source=FALLBACK_SOURCE;
    }

    return api;
  }

  function installFallbackAdapters(){
    var common=fallbackCommon();

    if(!window.BL2DataEngine||isFallback(window.BL2DataEngine)){
      window.BL2DataEngine=Object.assign({},common,{
        search:function(options){return listStudents(options||{});}
      });
    }else{
      addMissing(window.BL2DataEngine,common);
    }

    if(!window.ExcelLocalRepo||isFallback(window.ExcelLocalRepo)){
      window.ExcelLocalRepo=Object.assign({},common,{
        search:function(query,options){
          return listStudents(Object.assign({},options||{},{search:query||""}));
        }
      });
    }else{
      addMissing(window.ExcelLocalRepo,common);
    }

    if(!window.BL2EstudiantesRepo||isFallback(window.BL2EstudiantesRepo)){
      window.BL2EstudiantesRepo={
        source:FALLBACK_SOURCE,
        buscar:listStudents,
        listPeriods:listPeriods,
        getPeriods:listPeriods,
        getStudents:getStudents,
        listStudents:listStudents,
        listAllStudents:listAllStudents,
        filterStudents:getStudents,
        getStudentById:getStudentById,
        getStudentByCedula:getStudentByCedula,
        obtenerPorCedula:getStudentByCedula
      };
    }

    state.installed=true;
    return true;
  }

  function clearTablaCache(){
    try{
      if(window.TablaCore&&typeof window.TablaCore.clearCache==="function"){
        window.TablaCore.clearCache();
      }
    }catch(error){}
  }

  function requestTabla(delay){
    if(state.refreshTimer){
      window.clearTimeout(state.refreshTimer);
    }

    state.refreshTimer=window.setTimeout(function(){
      state.refreshTimer=null;
      clearTablaCache();

      try{
        if(window.TablaApp&&typeof window.TablaApp.request==="function"){
          window.TablaApp.request(false,20);
        }
      }catch(error){}
    },Math.max(0,Number(delay||40)));
  }

  function captureAndInstall(eventName){
    state.lastEvent=text(eventName);

    try{stableCache();}catch(error){}
    installFallbackAdapters();
  }

  function scheduleCapture(eventName,refreshTable){
    state.lastEvent=text(eventName);

    if(state.timer){
      window.clearTimeout(state.timer);
    }

    state.timer=window.setTimeout(function(){
      state.timer=null;
      captureAndInstall(state.lastEvent);
      if(refreshTable!==false)requestTabla(30);
    },80);
  }

  function realConnector(){
    var api=window.ConTabla||window.BDLocalTabla||null;
    return api&&api.source!==FALLBACK_SOURCE?api:null;
  }

  function refreshTabla(){
    var api=realConnector();
    var task=null;

    try{
      if(api&&typeof api.refresh==="function"){
        task=api.refresh({source:"TablaDataGuard.refresh",full:true,immediate:true});
      }else if(window.BDLocalConexiones&&typeof window.BDLocalConexiones.refreshCache==="function"){
        task=window.BDLocalConexiones.refreshCache({source:"TablaDataGuard.refresh",full:true,immediate:true});
      }
    }catch(error){
      task=Promise.reject(error);
    }

    return Promise.resolve(task).catch(function(){
      return null;
    }).then(function(){
      scheduleCapture("manual-refresh",true);
      return stableCache({force:true});
    });
  }

  [
    "bdlocal:conexiones-cache-updated",
    "bdlocal:screen-data-updated",
    "bdlocal:screen-deps-ready",
    "bdlocal:legacy-ready",
    "bdlocal:legacy-snapshot",
    "requisitos:bl:snapshot-changed"
  ].forEach(function(name){
    window.addEventListener(name,function(){
      scheduleCapture(name,true);
    });
  });

  window.addEventListener("storage",function(event){
    if(!event||event.key===CACHE_KEY||event.key===OLD_CACHE_KEY){
      scheduleCapture("storage:"+(event&&event.key||"unknown"),true);
    }
  });

  window.TablaDataGuard={
    version:VERSION,
    source:FALLBACK_SOURCE,
    install:installFallbackAdapters,
    refresh:refreshTabla,
    readCache:stableCache,
    clear:function(){
      lastGood={
        meta:{source:"tabla-data-guard",updatedAt:""},
        periods:[],
        students:[],
        requirements:[],
        summaries:{},
        diagnostics:[]
      };
      state.revision+=1;
      clearTablaCache();
    },
    status:function(){
      return {
        ok:true,
        version:VERSION,
        installed:state.installed,
        periods:lastGood.periods.length,
        students:lastGood.students.length,
        requirements:lastGood.requirements.length,
        source:lastGood.meta&&lastGood.meta.source||"",
        revision:state.revision,
        lastEvent:state.lastEvent
      };
    }
  };

  captureAndInstall("initial");
  requestTabla(120);
})(window);
/* =========================================================
Nombre completo: tabla.data-guard.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.data-guard.js
Función o funciones:
- Conservar la última caché válida de períodos, estudiantes y requisitos.
- Evitar que una respuesta vacía transitoria reemplace datos válidos en Tabla.
- Leer la caché volátil de BDLocal cuando localStorage no puede guardar archivos grandes.
- Reinstalar adaptadores estables después de actualizaciones entre iframes.
- No usar MutationObserver, intervalos ni escrituras repetitivas.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-last-good-cache";
  var lastGood={
    meta:{source:"tabla-data-guard",updatedAt:""},
    periods:[],
    students:[],
    requirements:[],
    summaries:{},
    diagnostics:[]
  };
  var installed=false;
  var originalUtilsRead=null;
  var originalUtilsWrite=null;

  function text(value){return String(value==null?"":value).trim();}
  function clone(value){
    try{return structuredClone(value);}catch(error){
      try{return JSON.parse(JSON.stringify(value));}catch(inner){return value;}
    }
  }
  function array(value){return Array.isArray(value)?value:[];}
  function hasRows(value){return Array.isArray(value)&&value.length>0;}
  function hasData(cache){
    cache=cache||{};
    return hasRows(cache.periods)||hasRows(cache.students)||hasRows(cache.requirements);
  }
  function normalized(cache){
    cache=cache&&typeof cache==="object"?clone(cache):{};
    cache.meta=cache.meta&&typeof cache.meta==="object"?cache.meta:{};
    cache.periods=array(cache.periods);
    cache.students=array(cache.students);
    cache.requirements=array(cache.requirements);
    cache.summaries=cache.summaries&&typeof cache.summaries==="object"?cache.summaries:{};
    cache.diagnostics=array(cache.diagnostics);
    return cache;
  }

  function remember(cache){
    cache=normalized(cache);
    if(hasRows(cache.periods)){lastGood.periods=clone(cache.periods);}
    if(hasRows(cache.students)){lastGood.students=clone(cache.students);}
    if(hasRows(cache.requirements)){lastGood.requirements=clone(cache.requirements);}
    if(cache.summaries&&Object.keys(cache.summaries).length){lastGood.summaries=clone(cache.summaries);}
    if(hasRows(cache.diagnostics)){lastGood.diagnostics=clone(cache.diagnostics);}
    if(hasData(cache)){
      lastGood.meta=Object.assign({},lastGood.meta,clone(cache.meta||{}),{
        source:text(cache.meta&&cache.meta.source)||"tabla-data-guard",
        updatedAt:new Date().toISOString(),
        totalPeriods:lastGood.periods.length,
        totalStudents:lastGood.students.length,
        guarded:true,
        guardVersion:VERSION
      });
    }
    return cache;
  }

  function preserve(cache,allowEmpty){
    cache=remember(cache);
    if(allowEmpty===true||!hasData(lastGood)){return cache;}
    if(!hasRows(cache.periods)&&hasRows(lastGood.periods)){cache.periods=clone(lastGood.periods);}
    if(!hasRows(cache.students)&&hasRows(lastGood.students)){cache.students=clone(lastGood.students);}
    if(!hasRows(cache.requirements)&&hasRows(lastGood.requirements)){cache.requirements=clone(lastGood.requirements);}
    if((!cache.summaries||!Object.keys(cache.summaries).length)&&lastGood.summaries){cache.summaries=clone(lastGood.summaries);}
    cache.meta=Object.assign({},lastGood.meta,cache.meta||{}, {
      totalPeriods:cache.periods.length,
      totalStudents:cache.students.length,
      preservedByTablaGuard:true,
      guardVersion:VERSION
    });
    return cache;
  }

  function utils(){return window.BDLocalConUtils||null;}

  function stableCache(){
    var U=utils();
    var fresh=null;
    try{
      if(U&&typeof U.readCache==="function"){
        fresh=U.readCache();
      }else if(window.BDLocalScreenDeps&&typeof window.BDLocalScreenDeps.readCache==="function"){
        fresh=window.BDLocalScreenDeps.readCache();
      }
    }catch(error){fresh=null;}
    return preserve(fresh||{},false);
  }

  function patchUtils(){
    var U=utils();
    if(!U||U.__tablaDataGuardVersion===VERSION){return false;}

    originalUtilsRead=typeof U.readCache==="function"?U.readCache.bind(U):null;
    originalUtilsWrite=typeof U.writeCache==="function"?U.writeCache.bind(U):null;

    if(originalUtilsRead){
      U.readCache=function(force){
        var fresh;
        try{fresh=originalUtilsRead(force);}catch(error){fresh={};}
        return clone(preserve(fresh,false));
      };
    }

    if(originalUtilsWrite){
      U.writeCache=function(cache,options){
        options=options||{};
        var prepared=preserve(cache,options.allowEmpty===true);
        return originalUtilsWrite(prepared,options);
      };
    }

    U.__tablaDataGuardVersion=VERSION;
    return true;
  }

  function filterStudents(rows,options){
    var U=utils();
    if(U&&typeof U.filterStudents==="function"){
      return U.filterStudents(rows,options||{});
    }
    return array(rows).slice();
  }

  function listPeriods(){
    var U=utils();
    return stableCache().periods.map(function(item){
      return U&&typeof U.normalizePeriod==="function"?U.normalizePeriod(item):item;
    }).filter(Boolean);
  }

  function listStudents(options){
    options=options||{};
    var rows=filterStudents(stableCache().students,options);
    var limit=Number(options.limit||0);
    if(limit>0){rows=rows.slice(0,limit);}
    return {
      ok:true,
      rows:rows,
      total:rows.length,
      periodList:listPeriods(),
      source:"TablaStableCache"
    };
  }

  function getStudents(options){return listStudents(options||{}).rows;}
  function listAllStudents(){return getStudents({matricula:""});}
  function listStudentsByStatus(status,periodoId){return getStudents({matricula:status||"",periodoId:periodoId||""});}

  function getStudentById(id,options){
    id=text(id);
    if(!id){return null;}
    return getStudents(Object.assign({},options||{}, {
      matricula:options&&options.matricula!=null?options.matricula:""
    })).filter(function(row){
      return text(row.id)===id||text(row._id)===id||text(row.studentId)===id||
        text(row.idEstudiantePeriodo)===id||text(row.cedula)===id||text(row.numeroIdentificacion)===id;
    })[0]||null;
  }

  function getStudentByCedula(cedula,periodoId){
    var U=utils();
    var wanted=U&&typeof U.normalizeCedula==="function"?U.normalizeCedula(cedula):text(cedula);
    return getStudents({periodoId:periodoId||"",matricula:""}).filter(function(row){
      var value=U&&typeof U.normalizeCedula==="function"?U.normalizeCedula(row.cedula||row.numeroIdentificacion):text(row.cedula||row.numeroIdentificacion);
      return value===wanted;
    })[0]||null;
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

  function installAdapters(){
    patchUtils();
    var common={
      source:"TablaStableCache",
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

    window.BL2DataEngine=Object.assign({},window.BL2DataEngine||{},common,{
      search:function(options){return listStudents(options||{});}
    });
    window.ExcelLocalRepo=Object.assign({},window.ExcelLocalRepo||{},common,{
      search:function(query,options){return listStudents(Object.assign({},options||{},{search:query||""}));}
    });
    window.BL2EstudiantesRepo=Object.assign({},window.BL2EstudiantesRepo||{}, {
      source:"TablaStableCache",
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
    });

    [window.ConTabla,window.BDLocalTabla].forEach(function(api){
      if(api&&typeof api==="object"){
        Object.assign(api,common,{search:function(query,options){return listStudents(Object.assign({},options||{},{search:query||""}));}});
      }
    });

    installed=true;
    return true;
  }

  function refreshTabla(){
    installAdapters();
    try{
      if(window.TablaCore&&typeof window.TablaCore.clearCache==="function"){
        window.TablaCore.clearCache();
      }
      if(window.TablaApp&&typeof window.TablaApp.request==="function"){
        window.TablaApp.request(false,30);
      }
    }catch(error){}
  }

  function captureAndInstall(){
    try{stableCache();}catch(error){}
    installAdapters();
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
      captureAndInstall();
    });
  });

  window.addEventListener("storage",function(event){
    if(!event||event.key==="REQ_BDLOCAL_CONEXIONES_CACHE_V1"||event.key==="REQ_EXCEL_LOCAL_V1:snapshot"){
      captureAndInstall();
    }
  });

  window.TablaDataGuard={
    version:VERSION,
    install:installAdapters,
    refresh:refreshTabla,
    readCache:stableCache,
    status:function(){
      return {
        ok:true,
        version:VERSION,
        installed:installed,
        periods:lastGood.periods.length,
        students:lastGood.students.length,
        requirements:lastGood.requirements.length,
        source:lastGood.meta&&lastGood.meta.source||""
      };
    }
  };

  captureAndInstall();
  window.setTimeout(refreshTabla,200);
})(window);

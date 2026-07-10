/* =========================================================
Nombre completo: cone.tabla.js
Ruta o ubicación: /Requisitos/BDLocal/conexiones/cone.tabla.js
Función o funciones:
- Ser la única conexión de lectura entre Base Local y Tabla.
- Mantener una copia estable en memoria sin releer localStorage por filtro.
- Recibir actualizaciones del puente compartido y conservar la última colección válida.
- Exponer períodos, estudiantes y actualización manual sin sobrescribir datos con respuestas vacías.
========================================================= */
(function(window){
  "use strict";

  var HUB=window.BDLocalConexiones;
  var U=window.BDLocalConUtils;
  if(!HUB||!U){return;}

  var VERSION="2.0.0-tabla-direct-connection";
  var state={cache:null,revision:"",updatedAt:"",refreshPromise:null};
  var searchMemo=typeof WeakMap==="function"?new WeakMap():null;

  function text(value){return U.text?U.text(value):String(value==null?"":value).trim();}
  function array(value){return Array.isArray(value)?value:[];}
  function hasRows(value){return Array.isArray(value)&&value.length>0;}
  function normalize(value){
    return U.normalizeBasic?U.normalizeBasic(value).toLowerCase():text(value).toLowerCase();
  }
  function cedula(value){return U.normalizeCedula?U.normalizeCedula(value):text(value).replace(/[^0-9A-Za-z]/g,"");}
  function period(value){return U.canonicalPeriodId?U.canonicalPeriodId(value):text(value);}

  function signature(cache){
    cache=cache||{};
    var meta=cache.meta||{};
    return [
      text(meta.updatedAt),
      array(cache.periods).length,
      array(cache.students).length,
      array(cache.requirements).length
    ].join("|");
  }

  function normalizeCache(cache){
    if(U.normalizeCache){return U.normalizeCache(cache||U.emptyCache());}
    cache=cache&&typeof cache==="object"?cache:{};
    cache.meta=cache.meta&&typeof cache.meta==="object"?cache.meta:{};
    cache.periods=array(cache.periods);
    cache.students=array(cache.students);
    cache.requirements=array(cache.requirements);
    cache.summaries=cache.summaries&&typeof cache.summaries==="object"?cache.summaries:{};
    cache.diagnostics=array(cache.diagnostics);
    return cache;
  }

  function mergeIncoming(incoming,allowEmpty){
    incoming=normalizeCache(incoming);
    if(state.cache&&U.mergeCache){
      incoming=U.mergeCache(incoming,state.cache,{allowEmpty:allowEmpty===true});
    }else if(state.cache&&allowEmpty!==true){
      if(!hasRows(incoming.periods)&&hasRows(state.cache.periods)){incoming.periods=state.cache.periods;}
      if(!hasRows(incoming.students)&&hasRows(state.cache.students)){incoming.students=state.cache.students;}
      if(!hasRows(incoming.requirements)&&hasRows(state.cache.requirements)){incoming.requirements=state.cache.requirements;}
    }
    return incoming;
  }

  function installCache(incoming,options){
    options=options||{};
    var next=mergeIncoming(incoming,options.allowEmpty===true);
    var nextRevision=signature(next);
    var changed=nextRevision!==state.revision;

    state.cache=next;
    state.revision=nextRevision;
    state.updatedAt=new Date().toISOString();
    if(changed&&searchMemo){searchMemo=new WeakMap();}

    if(changed&&options.emit!==false){
      try{
        window.dispatchEvent(new CustomEvent("tabla:cache-updated",{detail:status()}));
      }catch(error){}
    }
    return next;
  }

  function readLatest(options){
    options=options||{};
    var cache;
    try{cache=U.readCache(options.force===true);}catch(error){cache=state.cache||U.emptyCache();}
    return installCache(cache,{allowEmpty:options.allowEmpty===true,emit:options.emit!==false});
  }

  function current(){return state.cache||readLatest({emit:false});}

  function rowPeriod(row){
    row=row||{};
    return period(row.periodoCanonicoId||row.periodoId||row.periodId||row.ultimoPeriodoId||row.idPeriodo||row._periodoId||row._bl2PeriodoId||"");
  }

  function rowDivision(row){
    row=row||{};
    var list=Array.isArray(row.divisiones)?row.divisiones:[];
    return text(row._division||row._bl2Division||row.division||row.Division||row["División"]||list[0]||"Sin división");
  }

  function rowCareer(row){
    row=row||{};
    return text(row.NombreCarrera||row.nombreCarrera||row.Carrera||row.carrera||row._carrera||row.CodigoCarrera||row.codigoCarrera||"");
  }

  function rowSearch(row){
    if(searchMemo&&row&&typeof row==="object"&&searchMemo.has(row)){return searchMemo.get(row);}
    var value=normalize([
      row&&row.cedula,row&&row.numeroIdentificacion,row&&row.NumeroIdentificacion,
      row&&row.Nombres,row&&row.nombres,row&&row.nombreCompleto,row&&row.Nombre,row&&row.nombre,
      rowCareer(row),rowDivision(row),row&&row.Sede,row&&row.sede,
      row&&row.CorreoPersonal,row&&row.correoPersonal,row&&row.CorreoInstitucional,row&&row.correoInstitucional,
      row&&row.Celular,row&&row.celular,row&&row.telegramUser,row&&row.telegramChatId
    ].join(" "));
    if(searchMemo&&row&&typeof row==="object"){searchMemo.set(row,value);}
    return value;
  }

  function matches(row,options){
    options=options||{};
    var wantedPeriod=period(options.periodoId||options.periodId||options.period||"");
    var wantedStatus=text(options.matricula||options.estadoMatricula||"").toUpperCase();
    var wantedDivision=normalize(options.division||"");
    var wantedCareer=normalize(options.carrera||options.career||"");
    var wantedSearch=normalize(options.search||options.busqueda||options.query||"");
    var currentStatus=text(row&&row._estadoMatricula||row&&row.estadoMatricula||row&&row.EstadoMatricula||"ACTIVO").toUpperCase();

    if(wantedPeriod&&!(U.samePeriod?U.samePeriod(rowPeriod(row),wantedPeriod):rowPeriod(row)===wantedPeriod)){return false;}
    if(wantedStatus&&currentStatus!==wantedStatus){return false;}
    if(wantedDivision&&normalize(rowDivision(row))!==wantedDivision){return false;}
    if(wantedCareer&&normalize(rowCareer(row))!==wantedCareer){return false;}
    if(wantedSearch&&rowSearch(row).indexOf(wantedSearch)<0){return false;}
    return true;
  }

  function listPeriods(){
    return array(current().periods).map(function(item){return U.normalizePeriod?U.normalizePeriod(item):item;}).filter(Boolean);
  }

  function getStudents(options){
    options=options||{};
    var rows=array(current().students).filter(function(row){return matches(row,options);});
    var limit=Number(options.limit||0);
    return limit>0?rows.slice(0,limit):rows;
  }

  function listStudents(options){
    var rows=getStudents(options||{});
    return {
      ok:true,
      rows:rows,
      total:rows.length,
      periodList:listPeriods(),
      source:"ConTablaDirect",
      revision:state.revision
    };
  }

  function getStudentById(id,options){
    id=text(id);
    if(!id){return null;}
    return getStudents(Object.assign({},options||{},{matricula:options&&options.matricula!=null?options.matricula:""})).filter(function(row){
      return text(row&&row.id)===id||text(row&&row._id)===id||text(row&&row.studentId)===id||
        text(row&&row.idEstudiantePeriodo)===id||text(row&&row.cedula)===id||text(row&&row.numeroIdentificacion)===id;
    })[0]||null;
  }

  function getStudentByCedula(value,periodoId){
    var wanted=cedula(value);
    return getStudents({periodoId:periodoId||"",matricula:""}).filter(function(row){
      return cedula(row&&row.cedula||row&&row.numeroIdentificacion)===wanted;
    })[0]||null;
  }

  function refresh(options){
    options=Object.assign({source:"cone.tabla.refresh",full:true,immediate:true},options||{});
    if(state.refreshPromise){return state.refreshPromise;}

    state.refreshPromise=Promise.resolve(HUB.refreshCache(options)).then(function(cache){
      return installCache(cache||U.readCache(),{allowEmpty:options.allowEmpty===true,emit:true});
    }).catch(function(error){
      readLatest({emit:true});
      throw error;
    }).finally(function(){state.refreshPromise=null;});

    return state.refreshPromise;
  }

  function ready(){
    return Promise.resolve(HUB.ready()).then(function(){
      readLatest({emit:false});
      return status();
    });
  }

  function status(){
    var cache=current();
    return {
      ok:true,
      version:VERSION,
      source:"ConTablaDirect",
      revision:state.revision,
      periods:array(cache.periods).length,
      students:array(cache.students).length,
      requirements:array(cache.requirements).length,
      refreshing:!!state.refreshPromise,
      updatedAt:state.updatedAt
    };
  }

  function syncFromShared(){readLatest({emit:true});}
  window.addEventListener("bdlocal:conexiones-cache-updated",syncFromShared);
  window.addEventListener("bdlocal:screen-data-updated",syncFromShared);

  var api={
    version:VERSION,
    source:"ConTablaDirect",
    ready:ready,
    refresh:refresh,
    status:status,
    revision:function(){return state.revision;},
    getSnapshot:function(){return current();},
    listPeriods:listPeriods,
    getPeriods:listPeriods,
    periods:listPeriods,
    periodos:listPeriods,
    listStudents:listStudents,
    getStudents:getStudents,
    rows:getStudents,
    getRows:getStudents,
    listarEstudiantes:getStudents,
    listAllStudents:function(){return getStudents({matricula:""});},
    filterStudents:getStudents,
    listStudentsByStatus:function(statusValue,periodoId){return getStudents({matricula:statusValue||"",periodoId:periodoId||""});},
    getStudentById:getStudentById,
    getStudentByCedula:getStudentByCedula,
    buscarPorCedula:getStudentByCedula,
    search:function(query,options){return listStudents(Object.assign({},options||{},{search:query||""}));}
  };

  HUB.register("tabla",api);
  window.BDLocalTabla=api;
  window.ConTabla=api;

  window.BL2DataEngine=Object.assign({},window.BL2DataEngine||{},api,{source:"ConTablaDirect"});
  window.BL2EstudiantesRepo=Object.assign({},window.BL2EstudiantesRepo||{},api,{
    buscar:listStudents,
    obtenerPorCedula:getStudentByCedula
  });
  window.ExcelLocalRepo=Object.assign({},window.ExcelLocalRepo||{},api,{
    all:getStudents,
    listar:getStudents,
    byCedula:getStudentByCedula
  });

  readLatest({emit:false});
})(window);
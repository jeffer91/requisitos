/* =========================================================
Nombre completo: defart.service-bridge.js
Ruta o ubicación: /Requisitos/defart/defart.service-bridge.js
Función:
- Conectar DefartCore exclusivamente con ConDefart.
- Consultar páginas y exportaciones sin llamar servicios de BDLocal desde la pantalla.
- Mantener caché, filtros y paginación compatibles con DefartApp.
========================================================= */
(function(window){
  "use strict";

  var VERSION="0.3.0-condefart-only";
  var originalSummary=null;
  var cache=Object.create(null);
  var loading=Object.create(null);
  var lastSummary=null;
  var lastFilterKey="";

  function text(value){return String(value==null?"":value).trim();}
  function connector(){return window.ConDefart||window.BDLocalConeDefart||null;}

  function pageState(){
    window.DEFART_PAGING=window.DEFART_PAGING||{page:1,limit:25,filterKey:"",lastInfo:null};
    if(!window.DEFART_PAGING.limit){window.DEFART_PAGING.limit=25;}
    if(!window.DEFART_PAGING.page){window.DEFART_PAGING.page=1;}
    return window.DEFART_PAGING;
  }

  function filterKey(options){
    options=options||{};
    return JSON.stringify({
      periodId:options.periodId||"",division:options.division||"",
      career:options.career||"",status:options.status||"",sede:options.sede||"",
      search:options.search||"",sortKey:options.sortKey||"_nombre",sortDir:options.sortDir||"asc"
    });
  }

  function cacheKey(options){
    var paging=pageState();
    return filterKey(options)+"::"+(paging.page||1)+"::"+(paging.limit||25);
  }

  function clearCache(options){
    cache=Object.create(null);
    loading=Object.create(null);
    if(options&&options.resetPage){pageState().page=1;}
    lastSummary=null;
  }

  function refresh(){
    clearCache({resetPage:false});
    try{if(window.DefartApp&&typeof window.DefartApp.render==="function"){window.DefartApp.render();}}catch(error){}
  }

  function setPage(page){
    var paging=pageState();
    var info=paging.lastInfo||{};
    var totalPages=Number(info.totalPages||1);
    page=Number(page||1);
    if(!Number.isFinite(page)||page<1){page=1;}
    if(totalPages&&page>totalPages){page=totalPages;}
    paging.page=page;
    clearCache({resetPage:false});
    refresh();
  }

  function nextPage(){setPage((pageState().lastInfo&&pageState().lastInfo.page||pageState().page||1)+1);}
  function prevPage(){setPage((pageState().lastInfo&&pageState().lastInfo.page||pageState().page||1)-1);}

  function applyPagingInfo(paged){
    var paging=pageState();
    paged=paged||{};
    var info={
      page:Number(paged.page||paging.page||1),limit:Number(paged.limit||paging.limit||25),
      total:Number(paged.total||0),totalPages:Number(paged.totalPages||1),
      start:paged.total?((Number(paged.page||1)-1)*Number(paged.limit||25))+1:0,
      end:paged.total?Math.min(Number(paged.total||0),Number(paged.page||1)*Number(paged.limit||25)):0,
      hasPrev:!!paged.hasPrev,hasNext:!!paged.hasNext
    };
    paging.page=info.page;
    paging.limit=info.limit;
    paging.lastInfo=info;
    return info;
  }

  function sourceRow(row,index){
    row=Object.assign({},row||{});
    var id=text(row.idEstudiantePeriodo||row.studentId||row.id||"");
    row._docId=row._docId||id||row.cedula||("fila_"+index);
    row._bl2PeriodoId=row._bl2PeriodoId||row.periodoId||row.periodId||"";
    row._bl2Periodo=row._bl2Periodo||row.periodoLabel||row.periodo||row.periodoId||"";
    row._bl2Nombre=row._bl2Nombre||row.nombreCompleto||row.nombres||row.Nombres||row.nombre||row.Nombre||"";
    row._bl2Carrera=row._bl2Carrera||row.carrera||row.nombreCarrera||row.NombreCarrera||"";
    row._bl2Sede=row._bl2Sede||row.sede||row.Sede||"";
    row._bl2Division=row._bl2Division||row.division||row.Division||"";
    row._bl2EstadoMatricula=row._bl2EstadoMatricula||row.estadoMatricula||"ACTIVO";
    row.cedula=row.cedula||row._cedula||"";
    row.Notart=row.Notart!=null?row.Notart:row.notart;
    row.Notdef=row.Notdef!=null?row.Notdef:row.notdef;
    row.Notafinal=row.Notafinal!=null?row.Notafinal:row.notafinal;
    return row;
  }

  function decorateRows(rows){
    rows=Array.isArray(rows)?rows:[];
    if(!window.DefartCore||typeof window.DefartCore.decorate!=="function"){return rows;}
    return rows.map(function(row,index){return window.DefartCore.decorate(sourceRow(row,index),index);});
  }

  function unique(rows,getter,keep){
    var map=Object.create(null);
    if(text(keep)){map[text(keep)]=true;}
    (rows||[]).forEach(function(row){var value=text(getter(row));if(value){map[value]=true;}});
    return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});
  }

  function kpis(rows,total){
    var result={total:Number(total||rows.length||0)};
    ["Sin requisitos","Pendiente Art","Supletorio Art","Pendiente Def","Supletorio Def","Completo"].forEach(function(key){result[key]=0;});
    rows.forEach(function(row){result[row._estadoDefensa]=(result[row._estadoDefensa]||0)+1;});
    return result;
  }

  function buildSummary(paged,options,fullRows){
    options=options||{};
    paged=paged||{};
    var rows=decorateRows(paged.rows||[]);
    var exportRows=fullRows?decorateRows(fullRows):rows.slice();
    var info=applyPagingInfo(paged);
    var allForLists=exportRows.length?exportRows:rows;
    return {
      rows:rows,exportRows:exportRows,kpis:kpis(rows,paged.total),
      periodList:unique(allForLists,function(row){return row._periodoId;},options.periodId).map(function(id){return {id:id,label:id};}),
      divisionList:unique(allForLists,function(row){return row._division;},options.division),
      careerList:unique(allForLists,function(row){return row._carrera;},options.career),
      sedeList:unique(allForLists,function(row){return row._sede;},options.sede),
      states:["Sin requisitos","Pendiente Art","Supletorio Art","Pendiente Def","Supletorio Def","Completo"],
      pagination:info,
      diagnostics:{
        ok:true,generatedAt:new Date().toISOString(),version:VERSION,source:"ConDefart",
        total:paged.total||rows.length,visible:rows.length,page:info.page,limit:info.limit,
        totalPages:info.totalPages,queryMode:paged.source||"connector",exportRows:exportRows.length,filters:options
      }
    };
  }

  function connectorOptions(options){
    var paging=pageState();
    return Object.assign({},options||{}, {
      periodoId:options&&options.periodId||"",periodo:options&&options.periodId||"",
      division:options&&options.division||"",carrera:options&&options.career||"",
      career:options&&options.career||"",estado:options&&options.status||"",
      sede:options&&options.sede||"",search:options&&options.search||"",
      sortKey:options&&options.sortKey||"_nombre",sortDir:options&&options.sortDir||"asc",
      page:Number(paging.page||1),limit:Number(paging.limit||25)
    });
  }

  function fetchFullForExport(key,options){
    var current=connector();
    if(!current||typeof current.getFiltered!=="function"){return;}
    current.getFiltered(connectorOptions(options)).then(function(rows){
      if(cache[key]){
        cache[key].exportRows=decorateRows(rows||[]);
        cache[key].diagnostics.exportRows=cache[key].exportRows.length;
      }
    }).catch(function(){});
  }

  function fetchPage(key,options){
    var current=connector();
    if(!current||typeof current.getPage!=="function"||loading[key]){return;}
    loading[key]=true;
    current.getPage(connectorOptions(options)).then(function(paged){
      cache[key]=buildSummary(paged||{},options||null);
      lastSummary=cache[key];
      fetchFullForExport(key,options||{});
      window.setTimeout(function(){
        try{if(window.DefartApp&&typeof window.DefartApp.render==="function"){window.DefartApp.render();}}catch(error){}
      },0);
    }).catch(function(error){
      try{console.warn("[DefartServiceBridge] ConDefart:",error);}catch(innerError){}
    }).finally(function(){loading[key]=false;});
  }

  function connectorSummary(options){
    options=options||{};
    var keyFilters=filterKey(options);
    var paging=pageState();
    if(lastFilterKey&&lastFilterKey!==keyFilters){paging.page=1;clearCache({resetPage:false});}
    lastFilterKey=keyFilters;
    paging.filterKey=keyFilters;
    var key=cacheKey(options);
    if(cache[key]){return cache[key];}
    fetchPage(key,options);
    if(lastSummary){
      return Object.assign({},lastSummary,{rows:[],diagnostics:Object.assign({},lastSummary.diagnostics||{},{loading:true,requested:true})});
    }
    return originalSummary
      ?originalSummary(options)
      :{rows:[],periodList:[],divisionList:[],careerList:[],sedeList:[],kpis:{total:0},diagnostics:{loading:true,source:"ConDefart_pending"}};
  }

  function install(){
    if(!window.DefartCore||typeof window.DefartCore.summary!=="function"||window.DefartCore.__serviceBridge){return false;}
    originalSummary=window.DefartCore.summary;
    window.DefartCore.summary=connectorSummary;
    window.DefartCore.__serviceBridge=true;
    return true;
  }

  window.DefartServiceBridge={
    version:VERSION,install:install,clear:clearCache,refresh:refresh,
    setPage:setPage,nextPage:nextPage,prevPage:prevPage,pageState:pageState
  };
  install();
})(window);
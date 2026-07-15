/* =========================================================
Nombre completo: defart.service-bridge.js
Ruta: /defart/defart.service-bridge.js
Función:
- Conectar DefartCore exclusivamente con ConDefart.
- Consultar una sola página durante filtros y búsquedas.
- Ignorar respuestas antiguas que ya no corresponden a los filtros activos.
- Consultar la exportación completa únicamente al descargar Excel.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.1.0-stable-lazy-export";
  var cache=Object.create(null);
  var loading=Object.create(null);
  var exportCache=Object.create(null);
  var exportLoading=Object.create(null);
  var lastSummary=null;
  var lastFilterKey="";
  var activeKey="";
  var epoch=0;

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
      periodId:options.periodId||"",
      division:options.division||"",
      career:options.career||"",
      status:options.status||"",
      sede:options.sede||"",
      search:options.search||"",
      sortKey:options.sortKey||"_nombre",
      sortDir:options.sortDir||"asc"
    });
  }
  function cacheKey(options){
    var paging=pageState();
    return filterKey(options)+"::"+(paging.page||1)+"::"+(paging.limit||25);
  }
  function resetQueries(options){
    options=options||{};
    epoch+=1;
    cache=Object.create(null);
    loading=Object.create(null);
    activeKey="";
    if(options.clearExport!==false){
      exportCache=Object.create(null);
      exportLoading=Object.create(null);
    }
    if(options.resetPage){pageState().page=1;}
    if(options.keepLast!==true){lastSummary=null;}
  }
  function clearCache(options){
    options=options||{};
    resetQueries({
      resetPage:!!options.resetPage,
      keepLast:!!options.keepLast,
      clearExport:options.clearExport!==false
    });
  }
  function renderApp(){
    window.setTimeout(function(){
      try{
        if(window.DefartApp&&typeof window.DefartApp.render==="function"){
          window.DefartApp.render();
        }
      }catch(error){}
    },0);
  }
  function refresh(){
    resetQueries({resetPage:false,keepLast:false,clearExport:true});
    renderApp();
  }
  function setPage(page){
    var paging=pageState();
    var info=paging.lastInfo||{};
    var totalPages=Number(info.totalPages||1);
    page=Number(page||1);
    if(!Number.isFinite(page)||page<1){page=1;}
    if(totalPages&&page>totalPages){page=totalPages;}
    paging.page=page;
    resetQueries({resetPage:false,keepLast:false,clearExport:false});
    renderApp();
  }
  function nextPage(){setPage((pageState().lastInfo&&pageState().lastInfo.page||pageState().page||1)+1);}
  function prevPage(){setPage((pageState().lastInfo&&pageState().lastInfo.page||pageState().page||1)-1);}
  function applyPagingInfo(paged){
    var paging=pageState();
    paged=paged||{};
    var info={
      page:Number(paged.page||paging.page||1),
      limit:Number(paged.limit||paging.limit||25),
      total:Number(paged.total||0),
      totalPages:Number(paged.totalPages||1),
      start:paged.total?((Number(paged.page||1)-1)*Number(paged.limit||25))+1:0,
      end:paged.total?Math.min(Number(paged.total||0),Number(paged.page||1)*Number(paged.limit||25)):0,
      hasPrev:!!paged.hasPrev,
      hasNext:!!paged.hasNext
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
    (rows||[]).forEach(function(row){
      var value=text(getter(row));
      if(value){map[value]=true;}
    });
    return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});
  }
  function kpis(rows,total){
    var result={total:Number(total||rows.length||0)};
    ["Sin requisitos","Pendiente Art","Supletorio Art","Pendiente Def","Supletorio Def","Completo"].forEach(function(key){result[key]=0;});
    rows.forEach(function(row){result[row._estadoDefensa]=(result[row._estadoDefensa]||0)+1;});
    return result;
  }
  function buildSummary(paged,options){
    options=options||{};
    paged=paged||{};
    var rows=decorateRows(paged.rows||[]);
    var info=applyPagingInfo(paged);
    return {
      rows:rows,
      exportRows:rows.slice(),
      kpis:kpis(rows,paged.total),
      periodList:unique(rows,function(row){return row._periodoId;},options.periodId).map(function(id){return {id:id,label:id};}),
      divisionList:unique(rows,function(row){return row._division;},options.division),
      careerList:unique(rows,function(row){return row._carrera;},options.career),
      sedeList:unique(rows,function(row){return row._sede;},options.sede),
      states:["Sin requisitos","Pendiente Art","Supletorio Art","Pendiente Def","Supletorio Def","Completo"],
      pagination:info,
      diagnostics:{
        ok:true,
        generatedAt:new Date().toISOString(),
        version:VERSION,
        source:"ConDefart",
        total:paged.total||rows.length,
        visible:rows.length,
        page:info.page,
        limit:info.limit,
        totalPages:info.totalPages,
        queryMode:paged.source||"connector",
        exportRows:rows.length,
        exportMode:"lazy",
        filters:options
      }
    };
  }
  function connectorOptions(options){
    var paging=pageState();
    options=options||{};
    return Object.assign({},options,{
      periodoId:options.periodId||"",
      periodo:options.periodId||"",
      division:options.division||"",
      carrera:options.career||"",
      career:options.career||"",
      estado:options.status||"",
      estadoDefensa:options.status||"",
      statusDefensa:options.status||"",
      sede:options.sede||"",
      search:options.search||"",
      sortKey:options.sortKey||"_nombre",
      sortDir:options.sortDir||"asc",
      page:Number(paging.page||1),
      limit:Number(paging.limit||25)
    });
  }
  function errorSummary(error,options){
    return {
      rows:[],
      exportRows:[],
      periodList:[],
      divisionList:[],
      careerList:[],
      sedeList:[],
      states:[],
      kpis:{total:0},
      pagination:{page:1,limit:25,total:0,totalPages:1,start:0,end:0,hasPrev:false,hasNext:false},
      diagnostics:{
        ok:false,
        source:"ConDefart",
        version:VERSION,
        error:error&&error.message?error.message:String(error),
        filters:options||{}
      }
    };
  }
  function fetchPage(key,options){
    var current=connector();
    if(!current||typeof current.getPage!=="function"||loading[key]){return;}
    var requestEpoch=epoch;
    var request=Promise.resolve().then(function(){
      return current.getPage(connectorOptions(options));
    });
    loading[key]=request;
    request.then(function(paged){
      if(requestEpoch!==epoch){return;}
      var summary=buildSummary(paged||{},options||{});
      cache[key]=summary;
      if(activeKey===key){
        lastSummary=summary;
        renderApp();
      }
    }).catch(function(error){
      if(requestEpoch!==epoch){return;}
      var summary=errorSummary(error,options);
      cache[key]=summary;
      if(activeKey===key){
        lastSummary=summary;
        renderApp();
      }
      try{console.warn("[DefartServiceBridge] ConDefart:",error);}catch(innerError){}
    }).finally(function(){
      if(loading[key]===request){delete loading[key];}
    });
  }
  function loadingSummary(options){
    var base=lastSummary||errorSummary(new Error("Cargando"),options);
    return Object.assign({},base,{
      rows:[],
      exportRows:[],
      diagnostics:Object.assign({},base.diagnostics||{}, {
        ok:true,
        loading:true,
        requested:true,
        source:"ConDefart_pending",
        version:VERSION,
        filters:options||{}
      })
    });
  }
  function connectorSummary(options){
    options=options||{};
    var keyFilters=filterKey(options);
    var paging=pageState();
    if(lastFilterKey&&lastFilterKey!==keyFilters){
      paging.page=1;
      resetQueries({resetPage:false,keepLast:true,clearExport:false});
    }
    lastFilterKey=keyFilters;
    paging.filterKey=keyFilters;
    var key=cacheKey(options);
    activeKey=key;
    if(cache[key]){return cache[key];}
    fetchPage(key,options);
    return loadingSummary(options);
  }
  function getExportRows(options){
    options=options||{};
    var key=filterKey(options);
    if(exportCache[key]){return Promise.resolve(exportCache[key].slice());}
    if(exportLoading[key]){return exportLoading[key];}
    var current=connector();
    if(!current||typeof current.getFiltered!=="function"){
      return Promise.reject(new Error("ConDefart.getFiltered no está disponible."));
    }
    var exportOptions=connectorOptions(options);
    exportOptions.page=1;
    exportOptions.limit=0;
    exportLoading[key]=Promise.resolve(current.getFiltered(exportOptions)).then(function(rows){
      rows=decorateRows(rows||[]);
      exportCache[key]=rows;
      return rows.slice();
    }).finally(function(){delete exportLoading[key];});
    return exportLoading[key];
  }
  function install(){
    if(!window.DefartCore||typeof window.DefartCore.summary!=="function"||window.DefartCore.__serviceBridge){return false;}
    window.DefartCore.summary=connectorSummary;
    window.DefartCore.__serviceBridge=true;
    return true;
  }

  window.DefartServiceBridge={
    version:VERSION,
    install:install,
    clear:clearCache,
    refresh:refresh,
    setPage:setPage,
    nextPage:nextPage,
    prevPage:prevPage,
    pageState:pageState,
    getExportRows:getExportRows
  };
  install();
})(window);
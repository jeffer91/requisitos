/* =========================================================
Nombre completo: defart.service-bridge.js
Ruta: /defart/defart.service-bridge.js
Función:
- Conectar DefartCore exclusivamente con ConDefart.
- Cargar una base completa por período/búsqueda y filtrar localmente.
- Aplicar Estado después de decorar requisitos y notas.
- Construir catálogos completos de período, división y carrera.
- Paginar únicamente después de aplicar todos los filtros.
- Reutilizar caché para cambios rápidos de filtros.
========================================================= */
(function(window){
  "use strict";

  var VERSION="2.0.0-correct-local-filters";
  var baseCache=Object.create(null);
  var baseLoading=Object.create(null);
  var summaryCache=Object.create(null);
  var lastSummary=null;
  var activeSummaryKey="";
  var lastFilterKey="";
  var epoch=0;

  function text(value){return String(value==null?"":value).trim();}
  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .replace(/\s+/g," ")
      .trim()
      .toLowerCase();
  }
  function connector(){return window.ConDefart||window.BDLocalConeDefart||null;}
  function pageState(){
    window.DEFART_PAGING=window.DEFART_PAGING||{page:1,limit:25,filterKey:"",lastInfo:null};
    if(!window.DEFART_PAGING.limit){window.DEFART_PAGING.limit=25;}
    if(!window.DEFART_PAGING.page){window.DEFART_PAGING.page=1;}
    return window.DEFART_PAGING;
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
    return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es",{numeric:true,sensitivity:"base"});});
  }
  function periodItems(periods,rows,keep){
    var map=Object.create(null);
    (Array.isArray(periods)?periods:[]).forEach(function(item){
      var id=text(item&&typeof item==="object"?(item.id||item.periodoId||item.periodId||item.value||item.key):item);
      var label=text(item&&typeof item==="object"?(item.label||item.periodoLabel||item.nombre||item.name||id):item);
      if(id){map[id]={id:id,label:label||id};}
    });
    (rows||[]).forEach(function(row){
      var id=text(row._periodoId||row.periodoId||row.periodId);
      var label=text(row._periodoLabel||row.periodoLabel||row.periodo||id);
      if(id&&!map[id]){map[id]={id:id,label:label||id};}
    });
    if(text(keep)&&!map[text(keep)]){map[text(keep)]={id:text(keep),label:text(keep)};}
    return Object.keys(map).map(function(key){return map[key];}).sort(function(a,b){
      return text(a.label||a.id).localeCompare(text(b.label||b.id),"es",{numeric:true,sensitivity:"base"});
    });
  }
  function states(){
    return ["Requisitos no cargados","Sin requisitos","Pendiente Art","Supletorio Art","Pendiente Def","Supletorio Def","Completo"];
  }
  function baseKey(options){
    options=options||{};
    return JSON.stringify({
      periodId:options.periodId||"",
      search:options.search||"",
      sede:options.sede||""
    });
  }
  function fullFilterKey(options){
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
  function summaryKey(options){
    var paging=pageState();
    return fullFilterKey(options)+"::"+(paging.page||1)+"::"+(paging.limit||25);
  }
  function connectorBaseOptions(options){
    options=options||{};
    return {
      periodoId:options.periodId||"",
      periodo:options.periodId||"",
      search:options.search||"",
      busqueda:options.search||"",
      sede:options.sede||"",
      page:1,
      limit:0,
      matricula:"ACTIVO"
    };
  }
  function fetchBase(options){
    options=options||{};
    var key=baseKey(options);
    if(baseCache[key]){return Promise.resolve(baseCache[key]);}
    if(baseLoading[key]){return baseLoading[key];}

    var current=connector();
    if(!current||typeof current.getFiltered!=="function"){
      return Promise.reject(new Error("ConDefart.getFiltered no está disponible."));
    }

    var requestEpoch=epoch;
    var rowsPromise=Promise.resolve(current.getFiltered(connectorBaseOptions(options)));
    var periodsPromise=typeof current.listPeriods==="function"
      ? Promise.resolve(current.listPeriods()).catch(function(){return [];})
      : Promise.resolve([]);

    baseLoading[key]=Promise.all([rowsPromise,periodsPromise]).then(function(values){
      if(requestEpoch!==epoch){throw new Error("Consulta reemplazada por filtros más recientes.");}
      var result={
        rows:decorateRows(values[0]||[]),
        periods:Array.isArray(values[1])?values[1]:[],
        generatedAt:new Date().toISOString()
      };
      baseCache[key]=result;
      return result;
    }).finally(function(){delete baseLoading[key];});

    return baseLoading[key];
  }
  function same(value,expected){return !text(expected)||norm(value)===norm(expected);}
  function applyLocalFilters(rows,options){
    options=options||{};
    return (rows||[]).filter(function(row){
      if(options.division&&!same(row._division,options.division)){return false;}
      if(options.career&&!same(row._carrera,options.career)){return false;}
      if(options.status&&!same(row._estadoDefensa,options.status)){return false;}
      if(options.sede&&!same(row._sede,options.sede)){return false;}
      return true;
    });
  }
  function compareValue(row,key){
    if(key==="_nart"||key==="_ndef"||key==="_nfin"){
      var number=Number(row&&row[key]);
      return Number.isFinite(number)?number:-999;
    }
    return norm(row&&row[key]);
  }
  function sortRows(rows,options){
    rows=(rows||[]).slice();
    options=options||{};
    var key=options.sortKey||"_nombre";
    var direction=options.sortDir==="desc"?-1:1;
    rows.sort(function(a,b){
      var av=compareValue(a,key);
      var bv=compareValue(b,key);
      if(av<bv){return -1*direction;}
      if(av>bv){return 1*direction;}
      return 0;
    });
    return rows;
  }
  function kpis(rows){
    var result={total:(rows||[]).length};
    states().forEach(function(key){result[key]=0;});
    (rows||[]).forEach(function(row){
      var key=text(row._estadoDefensa||"Sin requisitos");
      result[key]=(result[key]||0)+1;
    });
    return result;
  }
  function paginate(rows){
    var paging=pageState();
    var limit=Math.max(1,Number(paging.limit||25));
    var total=rows.length;
    var totalPages=Math.max(1,Math.ceil(total/limit));
    var page=Math.max(1,Number(paging.page||1));
    if(page>totalPages){page=totalPages;}
    paging.page=page;
    paging.limit=limit;
    var start=(page-1)*limit;
    var visible=rows.slice(start,start+limit);
    var info={
      page:page,
      limit:limit,
      total:total,
      totalPages:totalPages,
      start:total?start+1:0,
      end:total?Math.min(start+limit,total):0,
      hasPrev:page>1,
      hasNext:page<totalPages
    };
    paging.lastInfo=info;
    return {rows:visible,info:info};
  }
  function buildSummary(base,options){
    options=options||{};
    base=base||{rows:[],periods:[]};

    var allRows=Array.isArray(base.rows)?base.rows:[];
    var rowsForDivision=allRows.slice();
    var rowsAfterDivision=rowsForDivision.filter(function(row){return same(row._division,options.division);});
    var rowsAfterCareer=rowsAfterDivision.filter(function(row){return same(row._carrera,options.career);});
    var rowsBeforeStatus=rowsAfterCareer.filter(function(row){return same(row._sede,options.sede);});
    var filtered=sortRows(applyLocalFilters(allRows,options),options);
    var paged=paginate(filtered);

    return {
      rows:paged.rows,
      exportRows:filtered.slice(),
      kpis:kpis(rowsBeforeStatus),
      periodList:periodItems(base.periods,allRows,options.periodId),
      divisionList:unique(rowsForDivision,function(row){return row._division;},options.division),
      careerList:unique(rowsAfterDivision,function(row){return row._carrera;},options.career),
      sedeList:unique(rowsAfterCareer,function(row){return row._sede;},options.sede),
      states:states(),
      pagination:paged.info,
      diagnostics:{
        ok:true,
        loading:false,
        generatedAt:new Date().toISOString(),
        version:VERSION,
        source:"ConDefart_local_filters",
        totalBase:allRows.length,
        totalFiltered:filtered.length,
        visible:paged.rows.length,
        page:paged.info.page,
        limit:paged.info.limit,
        totalPages:paged.info.totalPages,
        filters:options
      }
    };
  }
  function errorSummary(error,options){
    return {
      rows:[],
      exportRows:[],
      periodList:lastSummary&&lastSummary.periodList?lastSummary.periodList:[],
      divisionList:lastSummary&&lastSummary.divisionList?lastSummary.divisionList:[],
      careerList:lastSummary&&lastSummary.careerList?lastSummary.careerList:[],
      sedeList:lastSummary&&lastSummary.sedeList?lastSummary.sedeList:[],
      states:states(),
      kpis:{total:0},
      pagination:{page:1,limit:pageState().limit||25,total:0,totalPages:1,start:0,end:0,hasPrev:false,hasNext:false},
      diagnostics:{
        ok:false,
        loading:false,
        source:"ConDefart",
        version:VERSION,
        error:error&&error.message?error.message:String(error),
        filters:options||{}
      }
    };
  }
  function loadingSummary(options){
    var previous=lastSummary||errorSummary(new Error("Cargando"),options);
    return Object.assign({},previous,{
      rows:[],
      exportRows:[],
      diagnostics:Object.assign({},previous.diagnostics||{}, {
        ok:true,
        loading:true,
        requested:true,
        source:"ConDefart_pending",
        version:VERSION,
        filters:options||{}
      })
    });
  }
  function requestSummary(options,key){
    fetchBase(options).then(function(base){
      var summary=buildSummary(base,options);
      summaryCache[key]=summary;
      if(activeSummaryKey===key){
        lastSummary=summary;
        renderApp();
      }
    }).catch(function(error){
      if(/reemplazada/i.test(text(error&&error.message))){return;}
      var summary=errorSummary(error,options);
      summaryCache[key]=summary;
      if(activeSummaryKey===key){
        lastSummary=summary;
        renderApp();
      }
      try{console.warn("[DefartServiceBridge]",error);}catch(innerError){}
    });
  }
  function connectorSummary(options){
    options=options||{};
    var currentFilterKey=fullFilterKey(options);
    var paging=pageState();

    if(lastFilterKey&&lastFilterKey!==currentFilterKey){
      paging.page=1;
    }
    lastFilterKey=currentFilterKey;
    paging.filterKey=currentFilterKey;

    var key=summaryKey(options);
    activeSummaryKey=key;
    if(summaryCache[key]){return summaryCache[key];}

    var cachedBase=baseCache[baseKey(options)];
    if(cachedBase){
      var summary=buildSummary(cachedBase,options);
      summaryCache[key]=summary;
      lastSummary=summary;
      return summary;
    }

    requestSummary(options,key);
    return loadingSummary(options);
  }
  function clearCache(options){
    options=options||{};
    epoch+=1;
    baseCache=Object.create(null);
    baseLoading=Object.create(null);
    summaryCache=Object.create(null);
    activeSummaryKey="";
    if(options.resetPage){pageState().page=1;}
    if(options.keepLast!==true){lastSummary=null;}
  }
  function refresh(){
    clearCache({resetPage:false,keepLast:false});
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
    summaryCache=Object.create(null);
    renderApp();
  }
  function nextPage(){setPage((pageState().lastInfo&&pageState().lastInfo.page||pageState().page||1)+1);}
  function prevPage(){setPage((pageState().lastInfo&&pageState().lastInfo.page||pageState().page||1)-1);}
  function getExportRows(options){
    options=options||{};
    var cached=baseCache[baseKey(options)];
    if(cached){return Promise.resolve(sortRows(applyLocalFilters(cached.rows,options),options));}
    return fetchBase(options).then(function(base){return sortRows(applyLocalFilters(base.rows,options),options);});
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
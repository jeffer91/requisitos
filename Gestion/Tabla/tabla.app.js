/* =========================================================
Nombre completo: tabla.app.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.app.js
Función o funciones:
- Controlar filtros, chips, paginación, indicadores y filas de Tabla.
- Esperar exclusivamente la conexión ConTabla antes del primer render.
- Usar la caché compartida cuando ya contiene datos y consultar IndexedDB solo si está vacía o al pulsar Actualizar.
- Evitar actualizaciones paralelas, eventos repetidos y esperas infinitas.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="3.0.0-direct-connector-app";
  var DEFAULT_PAGE_SIZE=75;
  var RENDER_DELAY=50;
  var SEARCH_DELAY=250;
  var EVENT_DELAY=120;
  var REFRESH_TIMEOUT=45000;

  var state={
    periodId:"",division:"",matricula:"ACTIVO",career:"",status:"",search:"",requirements:["falta"],
    rows:[],allRows:[],page:1,pageSize:DEFAULT_PAGE_SIZE,pagination:null,
    timer:null,eventTimer:null,periodKey:"",depKey:"",tableKey:"",divisionOptions:[],careerOptions:[],
    rendering:false,pendingRender:false,refreshing:false,booted:false,lastError:"",dataRevision:""
  };

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function setText(id,value){var node=el(id);if(node){node.textContent=value;}}
  function option(value,label,selected){return '<option value="'+esc(value)+'" '+(selected?'selected':'')+'>'+esc(label)+'</option>';}

  function status(message,cls){
    var box=el("tabla-status");
    if(box){box.textContent=message;box.className="tabla-status "+(cls||"");}
  }

  function connector(){
    return window.ConTabla||window.BDLocalTabla||(
      window.BDLocalConexiones&&typeof window.BDLocalConexiones.get==="function"
        ?window.BDLocalConexiones.get("tabla")
        :null
    );
  }

  function connectorStatus(){
    var api=connector();
    try{return api&&typeof api.status==="function"?(api.status()||{}):{};}catch(error){return {};}
  }

  function connectorRevision(){
    var api=connector();
    try{
      if(api&&typeof api.revision==="function"){return text(api.revision());}
      return text(connectorStatus().revision);
    }catch(error){return "";}
  }

  function source(){return window.TablaCore&&TablaCore.source?TablaCore.source():"ConTablaDirect";}
  function pid(item){
    item=item||{};
    return typeof item!=="object"?text(item):text(item.id||item.periodoId||item.periodId||item.value||item.key||item.label||item.periodoLabel||item.nombre||item.name);
  }
  function plabel(item){
    item=item||{};
    return typeof item!=="object"?text(item):text(item.label||item.periodoLabel||item.nombre||item.name||item.descripcion||item.id||item.periodoId||item.periodId||item.value||item.key);
  }
  function listKey(items){return (items||[]).map(function(item){return pid(item)+"::"+plabel(item);}).join("||");}
  function filtersKey(){
    return [source(),state.dataRevision,state.periodId,state.division,state.matricula,state.career,state.status,state.search,state.page,state.pageSize,state.requirements.join(",")].join("|");
  }
  function rowsKey(rows){
    return (rows||[]).map(function(row){return [row._cedula,row._nombres,row._carreraCorta||row._carrera,row._celular?1:0,row._correo?1:0].join("~");}).join("||");
  }

  function loadActions(){
    if(window.TablaActions){return;}
    if(document.querySelector('script[src*="tabla.actions.js"],script[data-tabla-actions="tabla.actions.js"],script[data-tabla-lazy="tabla.actions.js"]')){return;}
    var script=document.createElement("script");
    script.src="tabla.actions.js";
    script.async=false;
    script.setAttribute("data-tabla-actions","tabla.actions.js");
    document.body.appendChild(script);
  }

  function fillPeriods(){
    var select=el("tabla-periodo");
    if(!select||!window.TablaCore||!TablaCore.periods){return;}
    var periods=TablaCore.periods()||[];
    var key=source()+"|"+state.dataRevision+"|"+listKey(periods);
    if(state.periodKey!==key){
      select.innerHTML=option("","Todos",!state.periodId)+periods.map(function(item){
        var id=pid(item);
        return option(id,plabel(item)||id,state.periodId===id);
      }).join("");
      state.periodKey=key;
    }
    if(select.value!==state.periodId){select.value=state.periodId;}
  }

  function fillDeps(){
    var division=el("tabla-division");
    var career=el("tabla-carrera");
    var key=[source(),state.dataRevision,state.periodId,state.matricula,state.division].join("|");
    if(state.depKey!==key){
      var opts=window.TablaCore&&TablaCore.options
        ?TablaCore.options({periodId:state.periodId,matricula:state.matricula,division:state.division})
        :{divisions:[],careers:[]};
      state.divisionOptions=opts.divisions||[];
      state.careerOptions=opts.careers||[];
      state.depKey=key;
    }
    if(division){
      division.innerHTML=option("","Todas",!state.division)+state.divisionOptions.map(function(value){return option(value,value,state.division===value);}).join("");
      if(division.value!==state.division){division.value=state.division;}
    }
    if(career){
      career.innerHTML=option("","Todas",!state.career)+state.careerOptions.map(function(value){return option(value,value,state.career===value);}).join("");
      if(career.value!==state.career){career.value=state.career;}
    }
  }

  function chips(){
    var wrap=el("tabla-req-chips");
    if(!wrap){return;}
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-req-filter]"),function(button){
      var key=button.getAttribute("data-req-filter");
      var active=state.requirements.indexOf(key)>=0;
      button.classList.toggle("is-active",active);
      button.setAttribute("aria-pressed",active?"true":"false");
    });
  }

  function request(reset,delay){
    if(reset){state.page=1;}
    if(state.timer){window.clearTimeout(state.timer);}
    state.timer=window.setTimeout(function(){state.timer=null;render();},typeof delay==="number"?delay:RENDER_DELAY);
  }

  function clearVisualCaches(){
    if(window.TablaCore&&TablaCore.clearCache){TablaCore.clearCache();}
    state.periodKey="";
    state.depKey="";
    state.tableKey="";
  }

  function requestFromEvent(){
    var nextRevision=connectorRevision();
    if(nextRevision&&nextRevision===state.dataRevision){return;}
    if(state.eventTimer){window.clearTimeout(state.eventTimer);}
    state.eventTimer=window.setTimeout(function(){
      state.eventTimer=null;
      state.dataRevision=connectorRevision();
      clearVisualCaches();
      request(false,20);
    },EVENT_DELAY);
  }

  function renderTable(rows){
    var wrap=el("tabla-table-wrap");
    if(!wrap){return;}
    if(!rows.length){
      if(state.tableKey!=="empty"){wrap.innerHTML='<div class="empty">Sin datos.</div>';state.tableKey="empty";}
      return;
    }
    var key=filtersKey()+"::"+rowsKey(rows);
    if(state.tableKey===key){
      if(window.TablaActions&&TablaActions.enhance){TablaActions.enhance(50);}
      return;
    }
    var html='<table><thead><tr>'+[
      '<th>Cédula</th>','<th>Nombre</th>','<th>Carrera</th>','<th>Msg</th>',
      '<th>Último</th>','<th>WA</th>','<th>TG</th>','<th>Mail</th>'
    ].join("")+'</tr></thead><tbody>';
    html+=rows.map(function(row){
      return '<tr data-cedula="'+esc(row._cedula)+'">'+
        '<td class="nowrap">'+esc(row._cedula)+'</td>'+ 
        '<td>'+esc(row._nombres)+'</td>'+ 
        '<td><span class="tabla-career-short" title="'+esc(row._carrera)+'">'+esc(row._carreraCorta||row._carrera)+'</span></td>'+ 
        '<td><select class="tabla-message-select" aria-label="Tipo de mensaje"><option value="requisitos">Falta req.</option></select></td>'+ 
        '<td><span class="tabla-last-message">—</span></td>'+ 
        '<td><button class="tabla-channel action-whats" type="button" disabled>WA <small>0</small></button></td>'+ 
        '<td><button class="tabla-channel action-telegram" type="button">TG <small>0</small></button></td>'+ 
        '<td><button class="tabla-channel action-mail" type="button" disabled>Mail <small>0</small></button></td>'+ 
      '</tr>';
    }).join("");
    wrap.innerHTML=html+'</tbody></table>';
    state.tableKey=key;
    if(window.TablaActions&&TablaActions.enhance){TablaActions.enhance(30);}
  }

  function pageButtons(pagination){
    state.pagination=pagination||{page:1,pages:1,total:0,label:"0 registros",hasPrev:false,hasNext:false};
    setText("tabla-count-text",state.pagination.total+" registro(s) filtrados");
    setText("tabla-page-text","Página "+state.pagination.page+" de "+state.pagination.pages);
    setText("tabla-page-label",state.pagination.label);
    var first=el("tabla-page-first");
    var prev=el("tabla-page-prev");
    var next=el("tabla-page-next");
    var last=el("tabla-page-last");
    if(first){first.disabled=!state.pagination.hasPrev;}
    if(prev){prev.disabled=!state.pagination.hasPrev;}
    if(next){next.disabled=!state.pagination.hasNext;}
    if(last){last.disabled=!state.pagination.hasNext;}
  }

  function applySummary(summary){
    summary=summary||{};
    setText("tabla-kpi-total",summary.total||0);
    setText("tabla-kpi-ok",summary.cumple||0);
    setText("tabla-kpi-pend",summary.pendiente||0);
    setText("tabla-kpi-no",summary.no_cumple||0);
    setText("tabla-kpi-carreras",summary.carreras||0);
  }

  function render(){
    var started=Date.now();
    if(state.rendering){state.pendingRender=true;return;}
    state.rendering=true;
    state.pendingRender=false;
    try{
      if(!window.TablaCore||!TablaCore.page){throw new Error("TablaCore no disponible.");}
      state.dataRevision=connectorRevision()||state.dataRevision;
      status("Cargando tabla...","");
      fillPeriods();
      fillDeps();
      chips();
      var result=TablaCore.page({
        periodId:state.periodId,division:state.division,matricula:state.matricula,
        career:state.career,status:state.status,search:state.search,page:state.page,
        pageSize:state.pageSize,requirements:state.requirements
      });
      state.rows=result.rows||[];
      state.allRows=result.allRows||[];
      applySummary(result.summary||{});
      pageButtons(result.pagination);
      renderTable(state.rows);
      status("Tabla cargada por "+(result.source||source())+" · "+(Date.now()-started)+" ms.","ok");
      state.lastError="";
    }catch(error){
      state.lastError=error&&error.message?error.message:String(error);
      console.error("[TablaApp]",error);
      status(state.lastError,"warn");
    }finally{
      state.rendering=false;
      if(state.pendingRender){state.pendingRender=false;request(false,80);}
    }
  }

  function withTimeout(promise,timeout){
    return new Promise(function(resolve,reject){
      var settled=false;
      var timer=window.setTimeout(function(){
        if(settled){return;}
        settled=true;
        reject(new Error("La actualización de Base Local superó "+Math.round(timeout/1000)+" segundos."));
      },timeout);
      Promise.resolve(promise).then(function(value){
        if(settled){return;}
        settled=true;
        window.clearTimeout(timer);
        resolve(value);
      },function(error){
        if(settled){return;}
        settled=true;
        window.clearTimeout(timer);
        reject(error);
      });
    });
  }

  function refreshFromBDLocal(options){
    options=options||{};
    if(state.refreshing){return Promise.resolve(null);}
    state.refreshing=true;
    status("Actualizando Tabla desde Base Local...","");
    var api=connector();
    var task=api&&typeof api.refresh==="function"
      ?api.refresh({source:options.source||"TablaApp.refresh",full:true,immediate:true})
      :window.BDLocalConexiones&&typeof window.BDLocalConexiones.refreshCache==="function"
        ?window.BDLocalConexiones.refreshCache({source:options.source||"TablaApp.refresh",full:true,immediate:true})
        :Promise.reject(new Error("ConTabla no está disponible."));

    return withTimeout(task,REFRESH_TIMEOUT).catch(function(error){
      state.lastError=error&&error.message?error.message:String(error);
      console.warn("[TablaApp refresh]",error);
      status(state.lastError,"warn");
      return null;
    }).then(function(){
      state.dataRevision=connectorRevision();
      clearVisualCaches();
      render();
    }).finally(function(){state.refreshing=false;});
  }

  function resetDeps(){state.division="";state.career="";state.page=1;state.depKey="";state.tableKey="";}
  function bind(id,eventName,handler){var node=el(id);if(node){node.addEventListener(eventName,handler);}}

  function bindFilters(){
    bind("tabla-periodo","change",function(event){state.periodId=event.target.value;resetDeps();request(true,20);});
    bind("tabla-division","change",function(event){state.division=event.target.value;state.career="";state.page=1;state.depKey="";state.tableKey="";request(false,20);});
    bind("tabla-carrera","change",function(event){state.career=event.target.value;state.page=1;state.tableKey="";request(false,20);});
    bind("tabla-search","input",function(event){state.search=event.target.value;state.page=1;state.tableKey="";request(false,SEARCH_DELAY);});
    bind("tabla-refresh","click",function(){refreshFromBDLocal({source:"TablaApp.manual"});});
  }

  function bindPagination(){
    bind("tabla-page-first","click",function(){if(state.page===1){return;}state.page=1;state.tableKey="";request(false,10);});
    bind("tabla-page-prev","click",function(){var page=Math.max(1,state.page-1);if(page===state.page){return;}state.page=page;state.tableKey="";request(false,10);});
    bind("tabla-page-next","click",function(){var max=state.pagination?state.pagination.pages:state.page+1;var page=Math.min(max,state.page+1);if(page===state.page){return;}state.page=page;state.tableKey="";request(false,10);});
    bind("tabla-page-last","click",function(){var page=state.pagination?state.pagination.pages:state.page;if(page===state.page){return;}state.page=page;state.tableKey="";request(false,10);});
  }

  function bindChips(){
    var box=el("tabla-req-chips");
    if(!box){return;}
    box.addEventListener("click",function(event){
      var button=event.target&&event.target.closest?event.target.closest("[data-req-filter]"):null;
      if(!button){return;}
      var key=button.getAttribute("data-req-filter");
      var index=state.requirements.indexOf(key);
      if(key==="falta"){
        state.requirements=index>=0?[]:["falta"];
      }else{
        state.requirements=state.requirements.filter(function(value){return value!=="falta";});
        index=state.requirements.indexOf(key);
        if(index>=0){state.requirements.splice(index,1);}else{state.requirements.push(key);}
      }
      state.page=1;
      state.tableKey="";
      request(false,20);
    });
  }

  function bindBaseEvents(){
    window.addEventListener("tabla:cache-updated",requestFromEvent);
    window.addEventListener("bdlocal:screen-data-updated",requestFromEvent);
  }

  function connectionReady(){
    if(window.BDLocalConexiones&&typeof window.BDLocalConexiones.ready==="function"){
      return Promise.resolve(window.BDLocalConexiones.ready()).then(function(){
        var api=connector();
        return api&&typeof api.ready==="function"?api.ready():api;
      });
    }
    var api=connector();
    return api&&typeof api.ready==="function"?Promise.resolve(api.ready()):Promise.resolve(api);
  }

  function boot(){
    if(state.booted){return;}
    state.booted=true;
    loadActions();
    bindFilters();
    bindPagination();
    bindChips();
    bindBaseEvents();
    status("Conectando Tabla con Base Local...","");

    connectionReady().then(function(){
      state.dataRevision=connectorRevision();
      var info=connectorStatus();
      if(Number(info.students||0)>0||Number(info.periods||0)>0){
        clearVisualCaches();
        render();
        return null;
      }
      return refreshFromBDLocal({source:"TablaApp.initial-empty"});
    }).catch(function(error){
      state.lastError=error&&error.message?error.message:String(error);
      status(state.lastError,"warn");
    });
  }

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}

  window.TablaApp={
    version:VERSION,
    render:render,
    request:request,
    refresh:refreshFromBDLocal,
    getState:function(){return Object.assign({},state,{rows:state.rows.slice(),allRows:state.allRows.slice()});},
    setPageSize:function(size){
      size=Number(size)||DEFAULT_PAGE_SIZE;
      state.pageSize=Math.max(25,Math.min(300,size));
      state.page=1;
      state.tableKey="";
      request(false,20);
    }
  };
})(window,document);
/* =========================================================
Nombre completo: tabla.app.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.app.js
Función:
- Control visual de la pantalla Tabla.
- Maneja filtros, chips, paginación, KPIs y render de filas.
- Versión corregida para reducir cuelgues al ingresar:
  1) evita renders repetidos por eventos de BDLocal,
  2) evita reconstruir la tabla si los datos no cambiaron,
  3) usa una paginación más liviana,
  4) coordina mejor TablaActions después de pintar.
========================================================= */
(function(window,document){
  "use strict";

  var DEFAULT_PAGE_SIZE=75;
  var RENDER_DELAY=90;
  var SEARCH_DELAY=300;
  var EVENT_DELAY=350;

  var state={
    periodId:"",
    division:"",
    matricula:"ACTIVO",
    career:"",
    status:"",
    search:"",
    requirements:["falta"],
    rows:[],
    allRows:[],
    page:1,
    pageSize:DEFAULT_PAGE_SIZE,
    pagination:null,
    timer:null,
    eventTimer:null,
    periodKey:"",
    depKey:"",
    tableKey:"",
    divisionOptions:[],
    careerOptions:[],
    rendering:false,
    pendingRender:false,
    booted:false,
    lastError:""
  };

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}

  function status(message,cls){
    var box=el("tabla-status");
    if(box){
      box.textContent=message;
      box.className="tabla-status "+(cls||"");
    }
  }

  function setText(id,value){
    var node=el(id);
    if(node)node.textContent=value;
  }

  function option(value,label,selected){
    return '<option value="'+esc(value)+'" '+(selected?'selected':'')+'>'+esc(label)+'</option>';
  }

  function source(){
    return window.TablaCore&&TablaCore.source?TablaCore.source():"Base Local";
  }

  function pid(item){
    item=item||{};
    return typeof item!=="object"
      ? text(item)
      : text(item.id||item.periodoId||item.periodId||item.value||item.key||item.label||item.periodoLabel||item.nombre||item.name);
  }

  function plabel(item){
    item=item||{};
    return typeof item!=="object"
      ? text(item)
      : text(item.label||item.periodoLabel||item.nombre||item.name||item.descripcion||item.id||item.periodoId||item.periodId||item.value||item.key);
  }

  function listKey(items){
    return (items||[]).map(function(item){
      return pid(item)+"::"+plabel(item);
    }).join("||");
  }

  function filtersKey(){
    return [
      source(),
      state.periodId,
      state.division,
      state.matricula,
      state.career,
      state.status,
      state.search,
      state.page,
      state.pageSize,
      state.requirements.join(",")
    ].join("|");
  }

  function rowsKey(rows){
    return (rows||[]).map(function(row){
      return [row._cedula,row._nombres,row._carreraCorta||row._carrera,row._celular?1:0,row._correo?1:0].join("~");
    }).join("||");
  }

  function loadActions(){
    if(window.TablaActions)return;
    if(document.querySelector('script[src*="tabla.actions.js"],script[data-tabla-actions="tabla.actions.js"],script[data-tabla-lazy="tabla.actions.js"]'))return;

    var script=document.createElement("script");
    script.src="tabla.actions.js";
    script.async=false;
    script.setAttribute("data-tabla-actions","tabla.actions.js");
    document.body.appendChild(script);
  }

  function fillPeriods(){
    var select=el("tabla-periodo");
    var periods;
    var key;

    if(!select||!window.TablaCore||!TablaCore.periods)return;

    periods=TablaCore.periods()||[];
    key=source()+"|"+listKey(periods);

    if(state.periodKey!==key){
      select.innerHTML=option("","Todos",!state.periodId)+periods.map(function(item){
        var id=pid(item);
        return option(id,plabel(item)||id,state.periodId===id);
      }).join("");

      state.periodKey=key;
    }

    if(select.value!==state.periodId)select.value=state.periodId;
  }

  function fillDeps(){
    var division=el("tabla-division");
    var career=el("tabla-carrera");
    var opts;
    var key=[source(),state.periodId,state.matricula,state.division].join("|");

    if(state.depKey!==key){
      opts=window.TablaCore&&TablaCore.options
        ? TablaCore.options({periodId:state.periodId,matricula:state.matricula,division:state.division})
        : {divisions:[],careers:[]};

      state.divisionOptions=opts.divisions||[];
      state.careerOptions=opts.careers||[];
      state.depKey=key;
    }

    if(division){
      division.innerHTML=option("","Todas",!state.division)+state.divisionOptions.map(function(value){
        return option(value,value,state.division===value);
      }).join("");

      if(division.value!==state.division)division.value=state.division;
    }

    if(career){
      career.innerHTML=option("","Todas",!state.career)+state.careerOptions.map(function(value){
        return option(value,value,state.career===value);
      }).join("");

      if(career.value!==state.career)career.value=state.career;
    }
  }

  function chips(){
    var wrap=el("tabla-req-chips");
    if(!wrap)return;

    Array.prototype.forEach.call(wrap.querySelectorAll("[data-req-filter]"),function(button){
      var key=button.getAttribute("data-req-filter");
      var active=state.requirements.indexOf(key)>=0;

      button.classList.toggle("is-active",active);
      button.setAttribute("aria-pressed",active?"true":"false");
    });
  }

  function request(reset,delay){
    if(reset)state.page=1;

    if(state.timer)clearTimeout(state.timer);

    state.timer=setTimeout(function(){
      state.timer=null;
      render();
    },typeof delay==="number"?delay:RENDER_DELAY);
  }

  function requestFromEvent(){
    if(state.eventTimer)clearTimeout(state.eventTimer);

    state.eventTimer=setTimeout(function(){
      state.eventTimer=null;

      if(window.TablaCore&&TablaCore.clearCache){
        TablaCore.clearCache();
      }

      state.periodKey="";
      state.depKey="";
      state.tableKey="";
      request(false,40);
    },EVENT_DELAY);
  }

  function renderTable(rows){
    var wrap=el("tabla-table-wrap");
    var key;
    var html;

    if(!wrap)return;

    if(!rows.length){
      key="empty";
      if(state.tableKey!==key){
        wrap.innerHTML='<div class="empty">Sin datos.</div>';
        state.tableKey=key;
      }
      return;
    }

    key=filtersKey()+"::"+rowsKey(rows);

    if(state.tableKey===key){
      if(window.TablaActions&&TablaActions.enhance)TablaActions.enhance(80);
      return;
    }

    html='<table><thead><tr>'+[
      '<th>Cédula</th>',
      '<th>Nombre</th>',
      '<th>Carrera</th>',
      '<th>Msg</th>',
      '<th>Último</th>',
      '<th>WA</th>',
      '<th>TG</th>',
      '<th>Mail</th>'
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

    if(window.TablaActions&&TablaActions.enhance){
      TablaActions.enhance(60);
    }
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

    if(first)first.disabled=!state.pagination.hasPrev;
    if(prev)prev.disabled=!state.pagination.hasPrev;
    if(next)next.disabled=!state.pagination.hasNext;
    if(last)last.disabled=!state.pagination.hasNext;
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
    var result;
    var summary;
    var started=Date.now();

    if(state.rendering){
      state.pendingRender=true;
      return;
    }

    state.rendering=true;
    state.pendingRender=false;

    try{
      if(!window.TablaCore||!TablaCore.page){
        throw new Error("TablaCore no disponible.");
      }

      status("Cargando tabla...","");

      fillPeriods();
      fillDeps();
      chips();

      result=TablaCore.page({
        periodId:state.periodId,
        division:state.division,
        matricula:state.matricula,
        career:state.career,
        status:state.status,
        search:state.search,
        page:state.page,
        pageSize:state.pageSize,
        requirements:state.requirements
      });

      state.rows=result.rows||[];
      state.allRows=result.allRows||[];

      summary=result.summary||(
        window.TablaCore&&TablaCore.summary?TablaCore.summary(state.allRows):{}
      );

      applySummary(summary);
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

      if(state.pendingRender){
        state.pendingRender=false;
        request(false,120);
      }
    }
  }

  function resetDeps(){
    state.division="";
    state.career="";
    state.page=1;
    state.depKey="";
    state.tableKey="";
  }

  function bind(id,eventName,handler){
    var node=el(id);
    if(node)node.addEventListener(eventName,handler);
  }

  function bindFilters(){
    bind("tabla-periodo","change",function(event){
      state.periodId=event.target.value;
      resetDeps();
      request(true,40);
    });

    bind("tabla-division","change",function(event){
      state.division=event.target.value;
      state.career="";
      state.page=1;
      state.depKey="";
      state.tableKey="";
      request(false,40);
    });

    bind("tabla-carrera","change",function(event){
      state.career=event.target.value;
      state.page=1;
      state.tableKey="";
      request(false,40);
    });

    bind("tabla-search","input",function(event){
      state.search=event.target.value;
      state.page=1;
      state.tableKey="";
      request(false,SEARCH_DELAY);
    });

    bind("tabla-refresh","click",function(){
      if(window.TablaCore&&TablaCore.clearCache){
        TablaCore.clearCache();
      }

      state.periodKey="";
      state.depKey="";
      state.tableKey="";
      request(false,20);
    });
  }

  function bindPagination(){
    bind("tabla-page-first","click",function(){
      if(state.page===1)return;
      state.page=1;
      state.tableKey="";
      request(false,20);
    });

    bind("tabla-page-prev","click",function(){
      var page=Math.max(1,state.page-1);
      if(page===state.page)return;
      state.page=page;
      state.tableKey="";
      request(false,20);
    });

    bind("tabla-page-next","click",function(){
      var max=state.pagination?state.pagination.pages:state.page+1;
      var page=Math.min(max,state.page+1);
      if(page===state.page)return;
      state.page=page;
      state.tableKey="";
      request(false,20);
    });

    bind("tabla-page-last","click",function(){
      var page=state.pagination?state.pagination.pages:state.page;
      if(page===state.page)return;
      state.page=page;
      state.tableKey="";
      request(false,20);
    });
  }

  function bindChips(){
    var box=el("tabla-req-chips");

    if(!box)return;

    box.addEventListener("click",function(event){
      var button=event.target&&event.target.closest?event.target.closest("[data-req-filter]"):null;
      var key;
      var index;

      if(!button)return;

      key=button.getAttribute("data-req-filter");
      index=state.requirements.indexOf(key);

      if(key==="falta"){
        state.requirements=index>=0?[]:["falta"];
      }else{
        state.requirements=state.requirements.filter(function(value){return value!=="falta";});
        index=state.requirements.indexOf(key);

        if(index>=0){
          state.requirements.splice(index,1);
        }else{
          state.requirements.push(key);
        }
      }

      state.page=1;
      state.tableKey="";
      request(false,40);
    });
  }

  function bindBaseEvents(){
    window.addEventListener("bdlocal:legacy-ready",requestFromEvent);
    window.addEventListener("bdlocal:legacy-snapshot",requestFromEvent);
    window.addEventListener("requisitos:bl:snapshot-changed",requestFromEvent);
  }

  function boot(){
    if(state.booted)return;
    state.booted=true;

    loadActions();
    bindFilters();
    bindPagination();
    bindChips();
    bindBaseEvents();

    request(false,120);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot);
  }else{
    boot();
  }

  window.TablaApp={
    render:render,
    request:request,
    refresh:function(){
      if(window.TablaCore&&TablaCore.clearCache)TablaCore.clearCache();
      state.periodKey="";
      state.depKey="";
      state.tableKey="";
      request(false,20);
    },
    getState:function(){
      return Object.assign({},state,{rows:state.rows.slice(),allRows:state.allRows.slice()});
    },
    setPageSize:function(size){
      size=Number(size)||DEFAULT_PAGE_SIZE;
      state.pageSize=Math.max(25,Math.min(300,size));
      state.page=1;
      state.tableKey="";
      request(false,30);
    }
  };
})(window,document);
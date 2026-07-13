/* =========================================================
Nombre completo: repo.app.js
Ruta o ubicación: /Requisitos/Reportes/repo.app.js
Función o funciones:
- Renderizar reportes desde la caché consolidada de BDLocal.
- Esperar que los adaptadores terminen de cargar antes del primer reporte.
- Refrescar realmente BDLocal al presionar Actualizar.
- Reaccionar a cargas y ediciones hechas en otras pantallas.
- Mantener filtros, copiado, impresión y exportaciones.
========================================================= */
(function(window,document){
  "use strict";

  var state = {
    tipo:"general",
    periodId:"",
    division:"",
    matricula:"ACTIVO",
    career:"",
    data:null,
    refreshTimer:null,
    rendering:false,
    booted:false
  };

  function el(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function status(message,cls){ var node = el("repo-status"); if(node){ node.textContent = message; node.className = "repo-status " + (cls || ""); } }
  function option(value,label,selected){ return '<option value="' + esc(value) + '" ' + (selected ? "selected" : "") + '>' + esc(label) + '</option>'; }
  function source(){ return window.RepoCore && typeof window.RepoCore.source === "function" ? window.RepoCore.source() : "Base Local"; }

  function connector(){
    return window.ConReportes || window.BDLocalReportes ||
      (window.BDLocalConexiones && typeof window.BDLocalConexiones.get === "function" ? window.BDLocalConexiones.get("reportes") : null);
  }

  function fillFilters(data){
    var period = el("repo-periodo");
    var division = el("repo-division");
    var career = el("repo-carrera");
    var matricula = el("repo-matricula");

    if(period){
      period.innerHTML = option("","Todos",!state.periodId) + (data.periodList || []).map(function(item){
        return option(item.id,item.label || item.periodoLabel || item.id,state.periodId === item.id);
      }).join("");
      period.value = state.periodId;
    }
    if(matricula){ matricula.value = state.matricula; }
    if(division){
      division.innerHTML = option("","Todas",!state.division) + (data.divisionList || []).map(function(value){ return option(value,value,state.division === value); }).join("");
      if(state.division && (data.divisionList || []).indexOf(state.division) < 0){ state.division = ""; }
      division.value = state.division;
    }
    if(career){
      career.innerHTML = option("","Todas",!state.career) + (data.careerList || []).map(function(value){ return option(value,value,state.career === value); }).join("");
      if(state.career && (data.careerList || []).indexOf(state.career) < 0){ state.career = ""; }
      career.value = state.career;
    }
  }

  function pill(kind,value){
    var cls = kind === "ok" ? "pill-ok" : kind === "bad" ? "pill-bad" : "pill-warn";
    return '<span class="pill ' + cls + '">' + esc(value) + '</span>';
  }

  function table(headers,rows){
    if(!rows || !rows.length){ return '<div class="empty">Sin datos.</div>'; }
    var html = '<table><thead><tr>' + headers.map(function(header){ return '<th>' + esc(header.label) + '</th>'; }).join("") + '</tr></thead><tbody>';
    html += rows.map(function(row){
      return '<tr>' + headers.map(function(header){
        var value = typeof header.value === "function" ? header.value(row) : row[header.key];
        return '<td>' + value + '</td>';
      }).join("") + '</tr>';
    }).join("");
    return html + '</tbody></table>';
  }

  function renderTables(data){
    el("repo-carreras").innerHTML = table([
      { label:"Carrera",key:"key" },
      { label:"Total",key:"total" },
      { label:"Cumple",value:function(row){ return pill("ok",row.cumple); } },
      { label:"Pendiente",value:function(row){ return pill("warn",row.pendiente); } },
      { label:"No cumple",value:function(row){ return pill("bad",row.no_cumple); } },
      { label:"Avance",value:function(row){ return row.avance + "%"; } }
    ],data.carreras);
    el("repo-carreras-meta").textContent = (data.carreras || []).length + " carreras";

    el("repo-requisitos").innerHTML = table([
      { label:"Requisito",key:"label" },
      { label:"Cumple",value:function(row){ return pill("ok",row.cumple); } },
      { label:"Pendiente",value:function(row){ return pill("warn",row.pendiente); } },
      { label:"No cumple",value:function(row){ return pill("bad",row.no_cumple); } },
      { label:"Atención",key:"atencion" }
    ],data.requisitos);

    var pending = (data.pendientes || []).slice(0,300);
    el("repo-estudiantes").innerHTML = table([
      { label:"Estudiante",value:function(row){ return esc(row._nombres || "Sin nombre"); } },
      { label:"Cédula",value:function(row){ return '<span class="nowrap">' + esc(row._cedula) + '</span>'; } },
      { label:"Carrera",value:function(row){ return esc(row._carrera); } },
      { label:"División",value:function(row){ return esc(row._division || "Sin división"); } },
      { label:"Matrícula",value:function(row){ return pill(row._estadoMatricula === "RETIRADO" ? "bad" : "ok",row._estadoMatricula); } },
      { label:"Estado",value:function(row){ return pill(row._estado.id === "no_cumple" ? "bad" : "warn",row._estado.label); } },
      { label:"Pend.",value:function(row){ return row._estado.pend; } },
      { label:"No",value:function(row){ return row._estado.no; } }
    ],pending);
    el("repo-estudiantes-meta").textContent = (data.pendientes || []).length + " estudiantes";
  }

  function render(){
    if(state.rendering){ return; }
    state.rendering = true;
    try{
      if(!window.RepoCore || typeof window.RepoCore.build !== "function"){
        throw new Error("RepoCore no está disponible.");
      }
      state.data = window.RepoCore.build({
        tipo:state.tipo,
        periodId:state.periodId,
        division:state.division,
        matricula:state.matricula,
        career:state.career
      });
      var data = state.data;
      fillFilters(data);
      el("repo-total").textContent = data.kpis.total;
      el("repo-ok").textContent = data.kpis.cumple;
      el("repo-pend").textContent = data.kpis.pendiente;
      el("repo-no").textContent = data.kpis.no_cumple;
      el("repo-avance").textContent = data.kpis.avance + "%";
      el("repo-preview").value = data.text;
      el("repo-generated-at").textContent = new Date(data.generatedAt).toLocaleString();
      renderTables(data);
      el("repo-diagnostics").textContent = JSON.stringify({
        generatedAt:data.generatedAt,
        source:data.source || source(),
        filters:data.filters,
        total:data.kpis.total,
        carreras:data.carreras.length,
        requisitos:data.requisitos.length,
        pendientes:data.pendientes.length,
        divisionList:data.divisionList || []
      },null,2);
      status("Reportes cargado por " + source() + ". Matrícula: " + (state.matricula || "Todos") + ". División: " + (state.division || "Todas") + ".","ok");
    }catch(error){
      console.error("[Reportes]",error);
      status(error.message || String(error),"warn");
    }finally{
      state.rendering = false;
    }
  }

  function refreshFromBDLocal(){
    status("Actualizando Reportes desde Base Local...","");
    var api = connector();
    var task = api && typeof api.refresh === "function"
      ? api.refresh({ source:"RepoApp.refresh",full:true,immediate:true })
      : window.BDLocalConexiones && typeof window.BDLocalConexiones.refreshCache === "function"
        ? window.BDLocalConexiones.refreshCache({ source:"RepoApp.refresh",full:true,immediate:true })
        : Promise.resolve(null);
    return Promise.resolve(task).catch(function(error){
      console.warn("[Reportes refresh]",error);
      return null;
    }).then(function(){ render(); });
  }

  function scheduleRender(){
    if(state.refreshTimer){ clearTimeout(state.refreshTimer); }
    state.refreshTimer = setTimeout(function(){ state.refreshTimer = null; render(); },220);
  }

  function bind(){
    el("repo-tipo").addEventListener("change",function(event){ state.tipo = event.target.value; render(); });
    el("repo-periodo").addEventListener("change",function(event){ state.periodId = event.target.value; state.division = ""; state.career = ""; render(); });
    el("repo-division").addEventListener("change",function(event){ state.division = event.target.value; state.career = ""; render(); });
    el("repo-matricula").addEventListener("change",function(event){ state.matricula = event.target.value; state.division = ""; state.career = ""; render(); });
    el("repo-carrera").addEventListener("change",function(event){ state.career = event.target.value; render(); });
    el("repo-refresh").addEventListener("click",refreshFromBDLocal);
    el("repo-copy").addEventListener("click",function(){ window.RepoExport.copyText(state.data && state.data.text).then(function(){ status("Reporte copiado.","ok"); }); });
    el("repo-print").addEventListener("click",function(){ window.print(); });
    el("repo-export-txt").addEventListener("click",function(){ window.RepoExport.exportTxt(state.data); });
    el("repo-export-html").addEventListener("click",function(){ window.RepoExport.exportHtml(state.data); });
    el("repo-export-json").addEventListener("click",function(){ window.RepoExport.exportJson(state.data); });

    ["bdlocal:screen-data-updated","bdlocal:legacy-snapshot","requisitos:bl:snapshot-changed"].forEach(function(name){
      window.addEventListener(name,scheduleRender);
    });
    window.addEventListener("storage",function(event){
      if(event && ["REQ_BDLOCAL_CONEXIONES_CACHE_V1","REQ_BDLOCAL_LEGACY_SNAPSHOT_V1","REQ_EXCEL_LOCAL_V1:snapshot"].indexOf(event.key) >= 0){ scheduleRender(); }
    });
  }

  function connectionReady(){
    if(window.BDLScreenDepsReady && typeof window.BDLScreenDepsReady.then === "function"){
      return window.BDLScreenDepsReady.catch(function(){ return null; });
    }
    if(window.BDLocalScreenDeps && typeof window.BDLocalScreenDeps.ready === "function"){
      return window.BDLocalScreenDeps.ready().catch(function(){ return null; });
    }
    return Promise.resolve(null);
  }

  function boot(){
    if(state.booted){ return; }
    state.booted = true;
    bind();
    status("Conectando Reportes con Base Local...","");
    connectionReady().then(refreshFromBDLocal);
  }

  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded",boot); }
  else{ boot(); }

  window.RepoApp = {
    render:render,
    refresh:refreshFromBDLocal,
    getState:function(){ return Object.assign({},state); }
  };
})(window,document);

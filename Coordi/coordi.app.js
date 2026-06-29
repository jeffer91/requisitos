/* =========================================================
Nombre completo: coordi.app.js
Ruta o ubicación: /Requisitos/Coordi/coordi.app.js
Función o funciones:
- Renderizar panel de coordinación.
- Manejar filtros por período, división, carrera y prioridad.
- Renderizar tablas, mensajes y exportación.
- Mostrar si la vista viene desde BL2/cache o desde ExcelLocalRepo.
- Evitar construcción pesada duplicada al abrir la pantalla.
Con qué se conecta:
- coordi.core.js
- coordi.export.js
========================================================= */
(function(window,document){
  "use strict";
  var state={periodId:"",division:"",career:"",priority:"",messageType:"general",data:null};
  function el(id){return document.getElementById(id);}function text(v){return String(v==null?"":v).trim();}
  function esc(v){return text(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function status(msg,cls){var s=el("coordi-status");if(s){s.textContent=msg;s.className="coordi-status "+(cls||"");}}
  function option(value,label,selected){return '<option value="'+esc(value)+'" '+(selected?'selected':'')+'>'+esc(label)+'</option>';}
  function source(){return window.CoordiCore&&typeof window.CoordiCore.source==="function"?window.CoordiCore.source():"Base Local";}
  function fillFilters(data){var p=el("coordi-periodo"), d=el("coordi-division"), c=el("coordi-carrera");if(p){p.innerHTML=option("","Todos",!state.periodId)+(data.periodList||[]).map(function(x){return option(x.id,x.label||x.periodoLabel||x.id,state.periodId===x.id);}).join("");}if(d){d.innerHTML=option("","Todas",!state.division)+(data.divisionList||[]).map(function(x){return option(x,x,state.division===x);}).join("");if(state.division&&!(data.divisionList||[]).some(function(x){return x===state.division;})){state.division="";d.value="";}else{d.value=state.division;}}if(c){c.innerHTML=option("","Todas",!state.career)+(data.careerList||[]).map(function(x){return option(x,x,state.career===x);}).join("");if(state.career&&!(data.careerList||[]).some(function(x){return x===state.career;})){state.career="";c.value="";}else{c.value=state.career;}}}
  function pill(level,label){var cls=level==="alta"?"pill-alta":level==="media"?"pill-media":"pill-baja";return '<span class="pill '+cls+'">'+esc(label||level)+'</span>';}
  function table(headers,rows){if(!rows||!rows.length)return '<div class="empty">Sin datos.</div>';var html='<table><thead><tr>'+headers.map(function(h){return '<th>'+esc(h.label)+'</th>';}).join('')+'</tr></thead><tbody>';html+=rows.map(function(row){return '<tr>'+headers.map(function(h){var value=typeof h.value==="function"?h.value(row):row[h.key];return '<td>'+value+'</td>';}).join('')+'</tr>';}).join('');return html+'</tbody></table>';}
  function renderCareers(data){el("coordi-carreras").innerHTML=table([{label:"Carrera",key:"key"},{label:"Total",key:"total"},{label:"Alta",value:function(r){return pill("alta",r.alta);}},{label:"Media",value:function(r){return pill("media",r.media);}},{label:"Pendientes",key:"pendientes"},{label:"No cumple",key:"noCumple"}],data.carreras);el("coordi-carreras-meta").textContent=(data.carreras||[]).length+" carreras";}
  function renderReqs(data){el("coordi-requisitos").innerHTML=table([{label:"Requisito",key:"label"},{label:"Pendiente",value:function(r){return pill("media",r.pendiente);}},{label:"No cumple",value:function(r){return pill("alta",r.no_cumple);}},{label:"Atención",key:"atencion"}],data.requisitos);}
  function renderStudents(data){var rows=(data.rows||[]).slice(0,300);el("coordi-estudiantes").innerHTML=table([{label:"Prioridad",value:function(r){return pill(r._priority.level,r._priority.label);}},{label:"Estudiante",value:function(r){return esc(r._nombres||"Sin nombre");}},{label:"Cédula",value:function(r){return '<span class="nowrap">'+esc(r._cedula)+'</span>'; }},{label:"Carrera",value:function(r){return esc(r._carrera);}},{label:"División",value:function(r){return esc(r._division||"Sin división");}},{label:"Pend.",value:function(r){return r._priority.pend;}},{label:"No",value:function(r){return r._priority.no;}}],rows);el("coordi-estudiantes-meta").textContent=(data.rows||[]).length+" estudiantes";}
  function renderMessage(data){var msg=window.CoordiCore.message(data,state.messageType);el("coordi-message").value=msg;}
  function render(){try{state.data=window.CoordiCore.summary({periodId:state.periodId,division:state.division,career:state.career,priority:state.priority});var d=state.data;fillFilters(d);el("coordi-total").textContent=d.kpis.total;el("coordi-alta").textContent=d.kpis.alta;el("coordi-media").textContent=d.kpis.media;el("coordi-baja").textContent=d.kpis.baja;el("coordi-carreras-total").textContent=d.kpis.carreras;renderCareers(d);renderReqs(d);renderStudents(d);renderMessage(d);el("coordi-diagnostics").textContent=JSON.stringify(d.diagnostics,null,2);status("Coordi cargado por "+source()+". División: "+(state.division||"Todas")+".","ok");}catch(e){console.error("[Coordi]",e);status(e.message||String(e),"warn");}}
  function bind(){el("coordi-periodo").addEventListener("change",function(e){state.periodId=e.target.value;state.division="";state.career="";render();});el("coordi-division").addEventListener("change",function(e){state.division=e.target.value;state.career="";render();});el("coordi-carrera").addEventListener("change",function(e){state.career=e.target.value;render();});el("coordi-prioridad").addEventListener("change",function(e){state.priority=e.target.value;render();});el("coordi-message-type").addEventListener("change",function(e){state.messageType=e.target.value;renderMessage(state.data);});el("coordi-refresh").addEventListener("click",render);el("coordi-export-json").addEventListener("click",function(){window.CoordiExport.exportJson(state.data);});el("coordi-copy-summary").addEventListener("click",function(){window.CoordiExport.copyText(window.CoordiExport.summaryText(state.data)).then(function(){status("Resumen copiado.","ok");});});el("coordi-copy-message").addEventListener("click",function(){window.CoordiExport.copyText(el("coordi-message").value).then(function(){status("Mensaje copiado.","ok");});});}
  function boot(){if(window.BL2&&typeof window.BL2.status==="function"){window.BL2.status({deep:false});}bind();render();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})(window,document);

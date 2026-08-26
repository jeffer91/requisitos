/* =========================================================
Nombre completo: stats.numeric-tables.js
Ruta: /Stats/stats.numeric-tables.js
Función:
- Mostrar valores absolutos de requisitos sin volver a consultar BDLocal.
- Diferenciar Total, Aplica, Cumple, No cumple y No aplica.
- Mostrar guion cuando un porcentaje no tiene denominador aplicable.
- Reorganizar la tabla de aprobación final con el mismo criterio numérico.
- Mejorar el texto de las barras para que indique "cumple de aplica · porcentaje".
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-absolute-values";
  var scheduled=false;
  var observer=null;

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function num(value){value=Number(value);return Number.isFinite(value)?value:0;}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function pct(value,total){return total>0?Math.round((num(value)*10000)/num(total))/100:null;}

  function currentData(){
    if(!window.StatsApp||typeof window.StatsApp.getState!=="function"){return null;}
    var state=window.StatsApp.getState()||{};
    return state.data||null;
  }

  function metrics(row){
    row=row||{};
    var total=num(row.total);
    var noAplica=num(row.no_aplica);
    var aplica=row.aplica===undefined||row.aplica===null
      ?Math.max(0,total-noAplica)
      :num(row.aplica);
    var cumple=num(row.cumple);
    var noCumple=num(row.no_cumple);
    var avance=pct(cumple,aplica);

    return {
      total:total,
      aplica:aplica,
      cumple:cumple,
      noCumple:noCumple,
      noAplica:noAplica,
      avance:avance
    };
  }

  function percentage(value){
    return value===null?"—":value+"%";
  }

  function table(rows,kind){
    rows=Array.isArray(rows)?rows:[];
    if(!rows.length){return '<div class="empty">Sin datos.</div>';}

    var label=kind==="final"?"Resultado final":"Requisito";
    var sortKey=kind==="final"?"stats-final-numeric":"stats-requirements-numeric";
    var html='<table class="stats-sortable-table stats-data-table" data-sortable="true" data-sort-key="'+sortKey+'"><thead><tr>'+
      '<th data-sort-type="text">'+label+'</th>'+
      '<th data-sort-type="number">Total</th>'+
      '<th data-sort-type="number">Aplica</th>'+
      '<th data-sort-type="number">Cumple</th>'+
      '<th data-sort-type="number">No cumple</th>'+
      '<th data-sort-type="number">No aplica</th>'+
      '<th data-sort-type="percent">Cumplimiento</th>'+
      '</tr></thead><tbody>';

    html+=rows.map(function(row){
      var m=metrics(row);
      var labelText=esc(row.label||row.key||"Sin dato");
      var percentText=percentage(m.avance);
      var percentSort=m.avance===null?-1:m.avance;
      var rowClass=m.aplica===0?" class=\"is-not-applicable\"":"";

      return '<tr'+rowClass+'>'+
        '<td data-sort="'+labelText+'"><strong>'+labelText+'</strong></td>'+
        '<td data-sort="'+m.total+'"><span class="stats-number-pill stats-number-total">'+m.total+'</span></td>'+
        '<td data-sort="'+m.aplica+'"><span class="stats-number-pill stats-number-applies">'+m.aplica+'</span></td>'+
        '<td data-sort="'+m.cumple+'"><span class="stats-number-pill stats-number-ok">'+m.cumple+'</span></td>'+
        '<td data-sort="'+m.noCumple+'"><span class="stats-number-pill stats-number-bad">'+m.noCumple+'</span></td>'+
        '<td data-sort="'+m.noAplica+'"><span class="stats-number-pill stats-number-na">'+m.noAplica+'</span></td>'+
        '<td data-sort="'+percentSort+'"><strong class="stats-percent-value'+(m.avance===null?' is-na':'')+'">'+percentText+'</strong></td>'+
      '</tr>';
    }).join("");

    return html+'</tbody></table>';
  }

  function updateRequirementBars(rows){
    var bars=document.querySelectorAll("#stats-requisitos .stats-bar-row");
    rows.forEach(function(row,index){
      var bar=bars[index];
      if(!bar){return;}
      var m=metrics(row);
      var value=bar.querySelector(".stats-bar-value");
      if(value){
        value.textContent=m.cumple+" de "+m.aplica+" · "+percentage(m.avance);
        value.title=m.aplica>0
          ?m.cumple+" estudiantes cumplen de "+m.aplica+" a quienes aplica el requisito."
          :"Este requisito no aplica al universo filtrado.";
      }
      bar.classList.toggle("is-not-applicable",m.aplica===0);
    });
  }

  function renderRequirements(data){
    var target=el("stats-requisitos-tabla");
    var meta=el("stats-requisitos-tabla-meta");
    if(!target){return;}

    if(!data){
      target.innerHTML='<div class="empty">Cargando detalle numérico...</div>';
      if(meta){meta.textContent="Preparando datos";}
      return;
    }

    if(data._requiresPeriod){
      target.innerHTML='<div class="empty">Selecciona un período para ver los valores absolutos.</div>';
      if(meta){meta.textContent="0 estudiantes";}
      return;
    }

    var rows=Array.isArray(data.requisitos)?data.requisitos:[];
    target.innerHTML=table(rows,"requirements");
    if(meta){meta.textContent=num(data.total)+" estudiantes según filtros";}
    updateRequirementBars(rows);
  }

  function renderFinal(data){
    var target=el("stats-finales");
    if(!target||!data||data._requiresPeriod){return;}
    target.innerHTML=table(data.requisitosFinales||[],"final");
  }

  function bindSorting(){
    if(window.StatsTables&&typeof window.StatsTables.bindAll==="function"){
      window.StatsTables.bindAll(document);
    }
  }

  function render(){
    var data=currentData();
    renderRequirements(data);
    renderFinal(data);
    bindSorting();
  }

  function schedule(){
    if(scheduled){return;}
    scheduled=true;
    setTimeout(function(){scheduled=false;render();},0);
  }

  function bind(){
    var status=el("stats-status");
    if(status&&typeof MutationObserver==="function"){
      observer=new MutationObserver(schedule);
      observer.observe(status,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["class"]});
    }

    ["stats-periodo","stats-sede","stats-division","stats-matricula","stats-carrera","stats-estado","stats-requisito"].forEach(function(id){
      var node=el(id);
      if(node){node.addEventListener("change",schedule);}
    });

    var refresh=el("stats-refresh");
    if(refresh){refresh.addEventListener("click",schedule);}

    window.addEventListener("stats:notes-loaded",schedule);
    window.addEventListener("stats:cache-invalidated",schedule);
    schedule();
  }

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind);}else{bind();}

  window.StatsNumericTables={version:VERSION,render:render,metrics:metrics};
})(window,document);

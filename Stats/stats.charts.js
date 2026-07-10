/* =========================================================
Nombre completo: stats.charts.js
Ruta o ubicación: /Requisitos/Stats/stats.charts.js
Función o funciones:
- Renderizar gráficos propios de Stats sin librerías externas.
- Mostrar cumplimiento general, requisito seleccionado, requisitos normales y aprobación final.
- Crear indicadores visuales compactos: cumple, no cumple, porcentaje y no aplica.
- Mantener salida HTML segura para uso desde stats.app.js.
Con qué se conecta:
- stats.html
- stats.css
- stats.core.js
- stats.app.js
========================================================= */
(function(window,document){
  "use strict";

  function text(value){return String(value==null?"":value).trim();}
  function num(value){value=Number(value);return isFinite(value)?value:0;}
  function pct(value,total){return total?Math.round((num(value)*10000)/num(total))/100:0;}
  function clamp(value,min,max){value=num(value);return Math.max(min,Math.min(max,value));}
  function el(id){return document.getElementById(id);}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function formatPercent(value){value=num(value);return (Math.round(value*100)/100)+"%";}

  function empty(message){
    return '<div class="stats-chart-empty">'+esc(message||"Sin datos para mostrar.")+'</div>';
  }

  function metric(label,value,sub,type){
    return '<article class="stats-chart-metric '+esc(type||"")+'">'
      + '<span>'+esc(label)+'</span>'
      + '<strong>'+esc(value)+'</strong>'
      + (sub?'<small>'+esc(sub)+'</small>':'')
      + '</article>';
  }

  function progress(label,value,total,type){
    var percent=pct(value,total);
    return '<div class="stats-chart-progress '+esc(type||"")+'">'
      + '<div class="stats-chart-progress-head"><strong>'+esc(label)+'</strong><span>'+esc(value)+' / '+esc(total)+' · '+formatPercent(percent)+'</span></div>'
      + '<div class="stats-chart-track"><i style="width:'+clamp(percent,0,100)+'%"></i></div>'
      + '</div>';
  }

  function stacked(ok,no,total){
    total=num(total);
    var okPct=total?pct(ok,total):0;
    var noPct=total?pct(no,total):0;
    return '<div class="stats-chart-stacked" aria-label="Cumplimiento general">'
      + '<span class="ok" style="width:'+clamp(okPct,0,100)+'%"></span>'
      + '<span class="bad" style="width:'+clamp(noPct,0,100)+'%"></span>'
      + '</div>'
      + '<div class="stats-chart-legend"><span><i class="ok"></i>Cumple '+formatPercent(okPct)+'</span><span><i class="bad"></i>No cumple '+formatPercent(noPct)+'</span></div>';
  }

  function donut(percent,label){
    percent=clamp(percent,0,100);
    return '<div class="stats-donut" style="--stats-donut:'+percent+';background:conic-gradient(var(--primary) '+percent+'%, #e2e8f0 0)">'
      + '<div><strong>'+formatPercent(percent)+'</strong><span>'+esc(label||"avance")+'</span></div>'
      + '</div>';
  }

  function horizontalBars(items,opts){
    opts=opts||{};
    items=items||[];
    if(!items.length)return empty(opts.empty||"Sin datos.");
    var top=opts.limit?items.slice(0,opts.limit):items.slice();
    return '<div class="stats-chart-bars">'+top.map(function(item){
      var total=num(item.total||item.aplica||0);
      var value=num(item.value==null?item.cumple:item.value);
      var percent=opts.percentKey?num(item[opts.percentKey]):pct(value,total);
      return '<div class="stats-chart-bar">'
        + '<div class="stats-chart-bar-head"><strong title="'+esc(item.label||item.key||item.name)+'">'+esc(item.label||item.key||item.name)+'</strong><span>'+esc(value)+' / '+esc(total)+' · '+formatPercent(percent)+'</span></div>'
        + '<div class="stats-chart-track"><i style="width:'+clamp(percent,0,100)+'%"></i></div>'
        + '</div>';
    }).join("")+'</div>';
  }

  function finalCards(data){
    var rows=data&&data.requisitosFinales?data.requisitosFinales:[];
    if(!rows.length)return empty("Sin datos de aprobación final.");
    return '<div class="stats-chart-final-grid">'+rows.map(function(item){
      var total=num(item.aplica||item.total||0);
      var percent=pct(item.cumple,total);
      return '<article class="stats-final-mini">'
        + '<div>'+donut(percent,item.label)+'</div>'
        + '<div><h3>'+esc(item.label)+'</h3>'
        + '<p><strong>'+esc(item.cumple)+'</strong> cumplen de '+esc(total)+'</p>'
        + '<p><span class="bad-text">'+esc(item.no_cumple)+'</span> no cumplen</p></div>'
        + '</article>';
    }).join("")+'</div>';
  }

  function renderGeneral(data,targetId){
    var target=el(targetId||"stats-chart-general");
    if(!target)return;
    data=data||{};
    var total=num(data.total);
    var ok=num(data.estados&&data.estados.cumple);
    var bad=num(data.estados&&data.estados.no_cumple);
    var avance=num(data.avanceGeneral);
    if(!total){target.innerHTML=empty("Sin estudiantes para los filtros seleccionados.");return;}
    target.innerHTML='<div class="stats-chart-panel">'
      + '<div class="stats-chart-top">'+donut(avance,"avance")+'<div class="stats-chart-metrics">'
      + metric("Aprobados",ok,formatPercent(pct(ok,total)),"ok")
      + metric("No cumplen",bad,formatPercent(pct(bad,total)),"bad")
      + metric("Total",total,"estudiantes","")
      + '</div></div>'
      + stacked(ok,bad,total)
      + '</div>';
  }

  function renderSelected(data,targetId){
    var target=el(targetId||"stats-chart-selected");
    var meta=el("stats-selected-requisito-meta");
    if(!target)return;
    var selected=data&&data.selectedRequirement;
    if(!selected){
      if(meta)meta.textContent="Todos";
      target.innerHTML=empty("Selecciona un requisito para ver cumple, no cumple y porcentaje.");
      return;
    }
    var stats=selected.stats||{};
    var total=num(stats.aplica||stats.total||0);
    var ok=num(stats.cumple);
    var bad=num(stats.no_cumple);
    var avance=pct(ok,total);
    if(meta)meta.textContent=selected.label||"Requisito";
    target.innerHTML='<div class="stats-chart-panel">'
      + '<div class="stats-chart-top">'+donut(avance,"cumplimiento")+'<div class="stats-chart-metrics">'
      + metric("Cumple",ok,formatPercent(pct(ok,total)),"ok")
      + metric("No cumple",bad,formatPercent(pct(bad,total)),"bad")
      + metric("Evaluados",total,"estudiantes","")
      + '</div></div>'
      + progress(selected.label||"Requisito",ok,total,"selected")
      + (stats.no_aplica?'<p class="stats-chart-note">No aplica para '+esc(stats.no_aplica)+' estudiante(s).</p>':'')
      + '</div>';
  }

  function renderRequirements(data,targetId){
    var target=el(targetId||"stats-chart-requisitos");
    if(!target)return;
    target.innerHTML=horizontalBars(data&&data.requisitos?data.requisitos:[],{empty:"Sin requisitos para mostrar."});
  }

  function renderFinal(data,targetId){
    var target=el(targetId||"stats-chart-final");
    if(!target)return;
    target.innerHTML=finalCards(data||{});
  }

  function renderAll(data){
    renderGeneral(data,"stats-chart-general");
    renderSelected(data,"stats-chart-selected");
    renderRequirements(data,"stats-chart-requisitos");
    renderFinal(data,"stats-chart-final");
  }

  window.StatsCharts={
    renderGeneral:renderGeneral,
    renderSelected:renderSelected,
    renderRequirements:renderRequirements,
    renderFinal:renderFinal,
    renderAll:renderAll,
    helpers:{empty:empty,metric:metric,progress:progress,donut:donut,horizontalBars:horizontalBars}
  };
})(window,document);

/* =========================================================
Nombre completo: stats.notes.charts.js
Ruta o ubicación: /Requisitos/Stats/stats.notes.charts.js
Función o funciones:
- Renderizar gráficos HTML/CSS para el dashboard analítico de notas.
- Mostrar promedios por carrera, comparación Nart vs Ndef, pendientes y distribución por rangos.
Con qué se conecta:
- stats.notes.analytics.js
- stats.notes.js
- stats.notes.analytics.css
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value==null?"":value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function num(value){value=Number(value);return Number.isFinite(value)?value:0;}
  function fmt(value,suffix){return value===null||value===undefined||value===""?"—":esc(value)+(suffix||"");}
  function pct(value,max){max=Number(max||0);return max?Math.max(2,Math.min(100,(Number(value||0)/max)*100)):0;}

  function empty(msg){return '<div class="stats-note-empty">'+esc(msg||"Sin datos para graficar.")+'</div>';}

  function chartCard(title,subtitle,body){
    return '<article class="stats-note-chart-card">'
      + '<header><div><h3>'+esc(title)+'</h3><p>'+esc(subtitle||"")+'</p></div></header>'
      + body
      + '</article>';
  }

  function barChart(title,subtitle,rows,options){
    options=options||{};
    rows=(rows||[]).filter(function(row){return row&&row[options.valueKey]!==null&&row[options.valueKey]!==undefined;}).slice(0,options.limit||8);
    if(!rows.length)return chartCard(title,subtitle,empty());
    var max=Math.max.apply(Math,rows.map(function(row){return num(row[options.valueKey]);}).concat([10]));
    var html='<div class="stats-note-bars">'+rows.map(function(row){
      var value=num(row[options.valueKey]);
      return '<div class="stats-note-bar-row">'
        + '<div class="stats-note-bar-label" title="'+esc(row[options.labelKey]||row.carrera||row.rango)+'">'+esc(row[options.labelKey]||row.carrera||row.rango)+'</div>'
        + '<div class="stats-note-bar-track"><i style="width:'+pct(value,max)+'%"></i></div>'
        + '<div class="stats-note-bar-number">'+fmt(value,options.suffix||"")+'</div>'
        + '</div>';
    }).join('')+'</div>';
    return chartCard(title,subtitle,html);
  }

  function groupedNartNdef(rows){
    rows=(rows||[]).filter(function(row){return row.promNart!==null||row.promNdef!==null;}).slice().sort(function(a,b){return num(b.total)-num(a.total);}).slice(0,8);
    if(!rows.length)return chartCard("Nart vs Ndef por carrera","Comparación del promedio de artículo y defensa.",empty());
    var html='<div class="stats-note-grouped">'+rows.map(function(row){
      var nart=num(row.promNart),ndef=num(row.promNdef);
      return '<div class="stats-note-group-row">'
        + '<strong title="'+esc(row.carrera)+'">'+esc(row.carrera)+'</strong>'
        + '<div class="stats-note-mini-bars">'
        + '<span class="art" style="width:'+pct(nart,10)+'%"><em>Nart '+fmt(row.promNart,'')+'</em></span>'
        + '<span class="def" style="width:'+pct(ndef,10)+'%"><em>Ndef '+fmt(row.promNdef,'')+'</em></span>'
        + '</div>'
        + '<small>'+fmt(row.diferenciaNdefNart,' pts')+'</small>'
        + '</div>';
    }).join('')+'</div>';
    return chartCard("Nart vs Ndef por carrera","Detecta si la defensa sube o baja el rendimiento frente al artículo.",html);
  }

  function semaforoCarreras(rows){
    rows=(rows||[]).slice().sort(function(a,b){return num(b.riesgoAlto)-num(a.riesgoAlto)||num(b.sinNfin)-num(a.sinNfin);}).slice(0,8);
    if(!rows.length)return chartCard("Semáforo por carrera","Estado académico por riesgo y pendientes.",empty());
    var html='<div class="stats-note-semaforo-list">'+rows.map(function(row){
      return '<div class="stats-note-semaforo-row is-'+esc(row.semaforo)+'">'
        + '<span></span><strong>'+esc(row.carrera)+'</strong>'
        + '<small>Riesgo: '+esc(row.riesgoAlto)+' · Pendientes: '+esc(row.sinNfin)+' · Prom: '+fmt(row.promNfin,'')+'</small>'
        + '</div>';
    }).join('')+'</div>';
    return chartCard("Semáforo por carrera","Rojo: atención prioritaria. Amarillo: revisar. Verde: estable.",html);
  }

  function render(analisis){
    analisis=analisis||{};
    var carreras=analisis.carreras||[];
    return '<section class="stats-note-chart-grid">'
      + barChart("Promedio final por carrera","Top carreras por Nfin promedio.",carreras.slice().sort(function(a,b){return num(b.promNfin)-num(a.promNfin);}),{labelKey:"carrera",valueKey:"promNfin",limit:8})
      + groupedNartNdef(carreras)
      + barChart("Notas finales pendientes","Carreras con más estudiantes sin Nfin.",carreras.slice().sort(function(a,b){return num(b.sinNfin)-num(a.sinNfin);}),{labelKey:"carrera",valueKey:"sinNfin",limit:8})
      + barChart("Distribución por rangos","Cantidad de estudiantes por rango de nota final.",analisis.rangos||[],{labelKey:"rango",valueKey:"total",limit:10})
      + semaforoCarreras(carreras)
      + barChart("Riesgo alto por carrera","Carreras con más estudiantes en riesgo académico alto.",carreras.slice().sort(function(a,b){return num(b.riesgoAlto)-num(a.riesgoAlto);}),{labelKey:"carrera",valueKey:"riesgoAlto",limit:8})
      + '</section>';
  }

  window.StatsNotesCharts={render:render,barChart:barChart,groupedNartNdef:groupedNartNdef};
})(window);

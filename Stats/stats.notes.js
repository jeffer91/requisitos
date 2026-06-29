/* =========================================================
Nombre completo: stats.notes.js
Ruta o ubicación: /Requisitos/Stats/stats.notes.js
Función o funciones:
- Renderizar dashboard analítico de notas en Stats.
- Mostrar KPIs, lectura automática, distribución, ranking, tendencia y resumen por carrera.
- Usar stats.notes.analytics.js para mantener los cálculos fuertes fuera de la vista.
Con qué se conecta:
- stats.html
- stats.css
- stats.notes.analytics.css
- stats.notes.analytics.js
- stats.core.js
- stats.app.js
========================================================= */
(function(window,document){
  "use strict";

  function text(value){return String(value==null?"":value).trim();}
  function el(id){return document.getElementById(id);}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function fmt(value){return value===null||value===undefined||value===""?"—":esc(value);}
  function num(value){value=Number(value);return Number.isFinite(value)?value:0;}
  function pct(value,total){return total?Math.round((num(value)*10000)/num(total))/100:0;}

  function card(label,value,sub,type){
    return '<article class="stats-note-card '+esc(type||"")+'">'
      + '<span>'+esc(label)+'</span>'
      + '<strong>'+fmt(value)+'</strong>'
      + (sub?'<small>'+esc(sub)+'</small>':'')
      + '</article>';
  }

  function bar(label,value,total,type){
    var percent=pct(value,total);
    return '<div class="notes-analytics-bar '+esc(type||"")+'">'
      + '<div class="notes-analytics-bar-head"><strong>'+esc(label)+'</strong><span>'+esc(value)+' · '+esc(percent)+'%</span></div>'
      + '<div class="notes-analytics-track"><i style="width:'+Math.max(0,Math.min(100,percent))+'%"></i></div>'
      + '</div>';
  }

  function renderLectura(lectura){
    lectura=Array.isArray(lectura)?lectura:[];
    return '<section class="notes-analytics-panel notes-analytics-reading">'
      + '<div class="notes-analytics-panel-head"><h3>Lectura automática</h3><span>Análisis ejecutivo</span></div>'
      + (lectura.length?'<ul>'+lectura.map(function(item){return '<li>'+esc(item)+'</li>';}).join('')+'</ul>':'<div class="empty">Sin lectura automática todavía.</div>')
      + '</section>';
  }

  function renderRangos(rangos,total){
    rangos=Array.isArray(rangos)?rangos:[];
    return '<section class="notes-analytics-panel">'
      + '<div class="notes-analytics-panel-head"><h3>Distribución de notas finales</h3><span>Rangos de Nfin</span></div>'
      + '<div class="notes-analytics-bars">'+rangos.map(function(item){
        var tipo=item.rango==="Menor a 7"?'bad':(item.rango==="Sin nota final"?'warn':'ok');
        return bar(item.rango,item.total,total,tipo);
      }).join('')+'</div>'
      + '</section>';
  }

  function renderRankings(rankings){
    rankings=rankings||{};
    var mejor=(rankings.mejoresPromedios||[])[0];
    var riesgo=(rankings.masRiesgo||[])[0];
    var pendientes=(rankings.masPendientes||[])[0];
    var defensa=(rankings.defensaMasBaja||[])[0];
    return '<section class="notes-analytics-panel notes-analytics-ranking">'
      + '<div class="notes-analytics-panel-head"><h3>Prioridades rápidas</h3><span>Ranking</span></div>'
      + '<div class="notes-ranking-grid">'
      + '<article><span>Mejor carrera</span><strong>'+fmt(mejor&&mejor.carrera)+'</strong><small>Promedio: '+fmt(mejor&&mejor.promNfin)+'</small></article>'
      + '<article><span>Mayor riesgo</span><strong>'+fmt(riesgo&&riesgo.carrera)+'</strong><small>Riesgo alto: '+fmt(riesgo&&riesgo.riesgoAlto)+'</small></article>'
      + '<article><span>Más pendientes</span><strong>'+fmt(pendientes&&pendientes.carrera)+'</strong><small>Nfin pendiente: '+fmt(pendientes&&pendientes.sinNfin)+'</small></article>'
      + '<article><span>Defensa más baja</span><strong>'+fmt(defensa&&defensa.carrera)+'</strong><small>Brecha: '+fmt(defensa&&defensa.diferenciaNdefNart)+'</small></article>'
      + '</div></section>';
  }

  function renderCarreras(carreras){
    carreras=Array.isArray(carreras)?carreras:[];
    if(!carreras.length)return '<section class="notes-analytics-panel"><div class="empty">Sin carreras para analizar.</div></section>';
    var rows=carreras.slice(0,16).map(function(c){
      return '<tr>'
        + '<td><strong>'+esc(c.carrera)+'</strong><small>'+esc(c.diagnostico||'')+'</small></td>'
        + '<td>'+esc(c.total)+'</td>'
        + '<td>'+fmt(c.promNart)+'</td>'
        + '<td>'+fmt(c.promNdef)+'</td>'
        + '<td><strong>'+fmt(c.promNfin)+'</strong></td>'
        + '<td>'+fmt(c.sinNfin)+'</td>'
        + '<td>'+fmt(c.riesgoAlto)+'</td>'
        + '<td><span class="notes-semaforo is-'+esc(c.semaforo||'gris')+'">'+esc(c.semaforo||'gris')+'</span></td>'
        + '</tr>';
    }).join('');
    return '<section class="notes-analytics-panel notes-analytics-careers">'
      + '<div class="notes-analytics-panel-head"><h3>Resumen por carrera</h3><span>'+esc(carreras.length)+' carreras</span></div>'
      + '<div class="notes-analytics-table-wrap"><table class="notes-analytics-table"><thead><tr><th>Carrera</th><th>Total</th><th>Nart</th><th>Ndef</th><th>Nfin</th><th>Pend.</th><th>Riesgo</th><th>Semáforo</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
      + '</section>';
  }

  function renderTendencias(tendencias){
    tendencias=Array.isArray(tendencias)?tendencias.filter(function(item){return item.periodo!=="SIN FECHA";}):[];
    if(!tendencias.length)return '';
    return '<section class="notes-analytics-panel notes-analytics-trends">'
      + '<div class="notes-analytics-panel-head"><h3>Tendencia de registro</h3><span>Notas finales por mes</span></div>'
      + '<div class="notes-analytics-bars">'+tendencias.slice(-8).map(function(item){return bar(item.periodo,item.conNfin,item.total,'');}).join('')+'</div>'
      + '</section>';
  }

  function fallback(data,target){
    var n=(data&&data.notasResumen)||{};
    var total=n.total||0;
    target.innerHTML='<section class="stats-notes-grid">'
      + card("Total",total,"estudiantes evaluados","")
      + card("Con nota",n.conNota||0,"con nota final","ok")
      + card("Sin nota",n.sinNota||0,"pendientes de registro","bad")
      + card("Promedio",n.promedio,"nota final","")
      + card("Mínima",n.minima,"nota final","")
      + card("Máxima",n.maxima,"nota final","")
      + '</section>';
  }

  function render(data,targetId){
    var target=el(targetId||"stats-notes");
    if(!target)return;
    if(!window.StatsNotesAnalytics||typeof window.StatsNotesAnalytics.analizar!=="function"){
      fallback(data,target);
      return;
    }
    var analisis=window.StatsNotesAnalytics.analizar(data||{});
    var r=analisis.resumen||{};
    target.innerHTML=''
      + '<section class="stats-notes-grid notes-analytics-kpis">'
      + card("Total",r.total,"estudiantes analizados","")
      + card("Prom. Nart",r.promNart,"artículo","")
      + card("Prom. Ndef",r.promNdef,"defensa","")
      + card("Prom. Nfin",r.promNfin,"nota final","")
      + card("Aprobación",r.porcentajeAprobacion+"%",(r.aprobados||0)+" aprobados","ok")
      + card("Riesgo alto",r.riesgoAlto||0,"revisión prioritaria","bad")
      + '</section>'
      + '<section class="notes-analytics-dashboard">'
      + renderLectura(analisis.lectura)
      + renderRankings(analisis.rankings)
      + renderRangos(analisis.rangos,r.total)
      + renderTendencias(analisis.tendencias)
      + renderCarreras(analisis.carreras)
      + '</section>';
  }

  window.StatsNotes={render:render};
})(window,document);

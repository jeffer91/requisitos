/* =========================================================
Nombre completo: stats.notes.priorities.js
Ruta o ubicación: /Requisitos/Stats/stats.notes.priorities.js
Función o funciones:
- Agregar un panel de prioridades académicas al dashboard de Notas.
- Mostrar acciones sugeridas por carrera, estudiantes para revisar y resumen ejecutivo.
- Trabajar encima del render existente sin romper la pantalla actual.
Con qué se conecta:
- stats.notes.analytics.js
- stats.notes.charts.js
- stats.notes.enhancer.js
- stats.notes.js
========================================================= */
(function(window,document){
  "use strict";

  var renderAnterior=window.StatsNotes&&window.StatsNotes.render;

  function text(value){return String(value==null?"":value).trim();}
  function el(id){return document.getElementById(id);}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function val(value){return value===null||value===undefined||value===""?"—":esc(value);}
  function n(value){value=Number(value);return Number.isFinite(value)?value:0;}

  function prioridadCarrera(c){
    c=c||{};
    if(n(c.riesgoAlto)>0)return "Revisar estudiantes con alerta alta antes de cerrar notas.";
    if(n(c.sinNdef)>0)return "Completar o verificar notas de defensa pendientes.";
    if(n(c.sinNfin)>0)return "Calcular o registrar notas finales pendientes.";
    if(c.diferenciaNdefNart!==null&&Number(c.diferenciaNdefNart)<0)return "Comparar rúbrica de defensa con artículo porque la defensa baja el promedio.";
    if(c.promNfin!==null&&Number(c.promNfin)<7.5)return "Revisar refuerzo académico porque el promedio final está cerca del mínimo.";
    return "Mantener seguimiento normal.";
  }

  function nivelPrioridad(c){
    if(n(c.riesgoAlto)>0||n(c.sinNdef)>3||n(c.sinNfin)>3)return "alta";
    if(n(c.sinNdef)>0||n(c.sinNfin)>0||(c.promNfin!==null&&Number(c.promNfin)<7.5))return "media";
    return "baja";
  }

  function construirAcciones(analisis){
    var carreras=(analisis.carreras||[]).slice();
    return carreras.map(function(c){
      return {carrera:c.carrera,total:c.total,promNfin:c.promNfin,sinNdef:c.sinNdef,sinNfin:c.sinNfin,riesgoAlto:c.riesgoAlto,semaforo:c.semaforo,nivel:nivelPrioridad(c),accion:prioridadCarrera(c)};
    }).sort(function(a,b){
      var peso={alta:3,media:2,baja:1};
      return (peso[b.nivel]-peso[a.nivel])||n(b.riesgoAlto)-n(a.riesgoAlto)||n(b.sinNfin)-n(a.sinNfin)||text(a.carrera).localeCompare(text(b.carrera),"es");
    }).slice(0,10);
  }

  function resumenEjecutivo(analisis){
    var r=analisis.resumen||{};
    var carreras=analisis.carreras||[];
    var rojas=carreras.filter(function(c){return c.semaforo==="rojo";}).length;
    var amarillas=carreras.filter(function(c){return c.semaforo==="amarillo";}).length;
    var verdes=carreras.filter(function(c){return c.semaforo==="verde";}).length;
    return [
      {label:"Carreras en rojo",value:rojas,detail:"atención prioritaria"},
      {label:"Carreras en amarillo",value:amarillas,detail:"revisión recomendada"},
      {label:"Carreras en verde",value:verdes,detail:"avance estable"},
      {label:"Ndef pendientes",value:r.sinNdef||0,detail:"defensas por completar"},
      {label:"Nfin pendientes",value:r.sinNfin||0,detail:"finales por calcular"},
      {label:"Alertas altas",value:r.riesgoAlto||0,detail:"casos críticos"}
    ];
  }

  function renderResumen(items){
    return '<div class="notes-priority-kpis">'+items.map(function(item){
      return '<article><span>'+esc(item.label)+'</span><strong>'+esc(item.value)+'</strong><small>'+esc(item.detail)+'</small></article>';
    }).join('')+'</div>';
  }

  function renderAcciones(acciones){
    if(!acciones.length)return '<div class="stats-note-empty">No hay prioridades con los filtros actuales.</div>';
    return '<div class="notes-priority-actions">'+acciones.map(function(a){
      return '<article class="notes-priority-action is-'+esc(a.nivel)+'">'
        + '<div><strong>'+esc(a.carrera)+'</strong><small>Total: '+esc(a.total)+' · Nfin: '+val(a.promNfin)+' · Pend. defensa: '+esc(a.sinNdef)+' · Pend. final: '+esc(a.sinNfin)+'</small></div>'
        + '<p>'+esc(a.accion)+'</p>'
        + '<span>'+esc(a.nivel)+'</span>'
        + '</article>';
    }).join('')+'</div>';
  }

  function renderEstudiantes(rows){
    rows=(rows||[]).slice(0,12);
    if(!rows.length)return '<div class="stats-note-empty">No hay estudiantes para revisión prioritaria.</div>';
    var html='<table class="notes-priority-table"><thead><tr><th>Estudiante</th><th>Carrera</th><th>Nart</th><th>Ndef</th><th>Nfin</th><th>Motivo</th></tr></thead><tbody>';
    html+=rows.map(function(r){return '<tr><td><strong>'+esc(r.nombre)+'</strong><small>'+esc(r.cedula)+'</small></td><td>'+esc(r.carrera)+'</td><td>'+val(r.nart)+'</td><td>'+val(r.ndef)+'</td><td>'+val(r.nfin)+'</td><td>'+esc(r.motivo)+'</td></tr>';}).join('');
    return '<div class="notes-priority-table-wrap">'+html+'</tbody></table></div>';
  }

  function insertar(data,targetId){
    if(!window.StatsNotesAnalytics||typeof window.StatsNotesAnalytics.analizar!=="function")return;
    var target=el(targetId||"stats-notes");
    if(!target||target.querySelector(".notes-priority-panel"))return;
    var analisis=window.StatsNotesAnalytics.analizar(data||{});
    var acciones=construirAcciones(analisis);
    var html='<section class="notes-priority-panel">'
      + '<header><div><h3>Prioridades académicas</h3><p>Qué revisar primero según notas, pendientes y semáforo por carrera.</p></div></header>'
      + renderResumen(resumenEjecutivo(analisis))
      + '<div class="notes-priority-grid">'
      + '<article class="notes-priority-card"><h4>Acciones sugeridas por carrera</h4>'+renderAcciones(acciones)+'</article>'
      + '<article class="notes-priority-card"><h4>Estudiantes para revisión</h4>'+renderEstudiantes(analisis.estudiantesRiesgo||[])+'</article>'
      + '</div>'
      + '</section>';
    target.insertAdjacentHTML('beforeend',html);
  }

  function render(data,targetId){
    if(typeof renderAnterior==="function")renderAnterior(data,targetId);
    insertar(data,targetId);
  }

  window.StatsNotes=window.StatsNotes||{};
  window.StatsNotes.render=render;
  window.StatsNotes.insertarPrioridades=insertar;
})(window,document);

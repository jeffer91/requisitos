/* =========================================================
Nombre completo: stats.notes.js
Ruta o ubicación: /Requisitos/Stats/stats.notes.js
Función o funciones:
- Mostrar estudiantes con nota y sin nota.
- Calcular promedios, mínimos y máximos de Nart, Ndef y Nfin.
- Mostrar notas finales pendientes, distribución por rangos y semáforo por carrera.
- Evitar lecturas automáticas, rankings y comparaciones innecesarias.
========================================================= */
(function(window,document){
  "use strict";

  function text(value){return String(value==null?"":value).trim();}
  function el(id){return document.getElementById(id);}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function num(value){
    if(value===null||value===undefined||text(value)===""){return null;}
    var result=Number(text(value).replace(",","."));
    return Number.isFinite(result)?result:null;
  }
  function round2(value){return Number.isFinite(value)?Math.round((value+Number.EPSILON)*100)/100:null;}
  function avg(values){return values.length?round2(values.reduce(function(a,b){return a+b;},0)/values.length):null;}
  function min(values){return values.length?round2(Math.min.apply(Math,values)):null;}
  function max(values){return values.length?round2(Math.max.apply(Math,values)):null;}
  function fmt(value){return value===null||value===undefined||value===""?"—":esc(value);}
  function pct(value,total){return total?Math.round((Number(value||0)*10000)/Number(total||0))/100:0;}
  function rowsOf(data){
    if(data&&data.selectedRequirement&&Array.isArray(data.selectedRequirement.rows)){return data.selectedRequirement.rows;}
    if(data&&Array.isArray(data.rows)){return data.rows;}
    if(data&&Array.isArray(data.estudiantes)){return data.estudiantes;}
    return [];
  }
  function notesOf(row){
    if(row&&row._notas){
      return {nart:num(row._notas.nart),ndef:num(row._notas.ndef),nfin:num(row._notas.nfin)};
    }
    if(window.StatsCore&&typeof window.StatsCore.extractNotes==="function"){
      var notes=window.StatsCore.extractNotes(row||{})||{};
      return {nart:num(notes.nart),ndef:num(notes.ndef),nfin:num(notes.nfin)};
    }
    return {nart:null,ndef:null,nfin:null};
  }
  function nameOf(row){return text(row&&row._nombres)||text(row&&row.Nombres)||text(row&&row.nombres)||text(row&&row.nombre)||"Sin nombre";}
  function idOf(row){return text(row&&row._cedula)||text(row&&row.cedula)||text(row&&row.numeroIdentificacion)||"";}
  function careerOf(row){return text(row&&row._carrera)||text(row&&row.NombreCarrera)||text(row&&row.carrera)||"SIN CARRERA";}

  function card(label,value,sub,type){
    return '<article class="'+esc(type||"")+'"><span>'+esc(label)+'</span><strong>'+fmt(value)+'</strong><small>'+esc(sub||"")+'</small></article>';
  }
  function build(rows){
    var nart=[],ndef=[],nfin=[];
    var conAny=0;
    var pending=[];
    var ranges={"Sin nota final":0,"Menor a 7":0,"7.00 - 7.49":0,"7.50 - 7.99":0,"8.00 - 8.99":0,"9.00 - 10":0};
    var careers=Object.create(null);

    rows.forEach(function(row){
      var notes=notesOf(row);
      var hasAny=notes.nart!==null||notes.ndef!==null||notes.nfin!==null;
      if(hasAny){conAny+=1;}
      if(notes.nart!==null){nart.push(notes.nart);}
      if(notes.ndef!==null){ndef.push(notes.ndef);}
      if(notes.nfin!==null){nfin.push(notes.nfin);}
      if(notes.nfin===null){
        pending.push({nombre:nameOf(row),cedula:idOf(row),carrera:careerOf(row),nart:notes.nart,ndef:notes.ndef,nfin:notes.nfin});
        ranges["Sin nota final"]+=1;
      }else if(notes.nfin<7){ranges["Menor a 7"]+=1;}
      else if(notes.nfin<7.5){ranges["7.00 - 7.49"]+=1;}
      else if(notes.nfin<8){ranges["7.50 - 7.99"]+=1;}
      else if(notes.nfin<9){ranges["8.00 - 8.99"]+=1;}
      else{ranges["9.00 - 10"]+=1;}

      var career=careerOf(row);
      if(!careers[career]){
        careers[career]={carrera:career,total:0,conNart:0,conNdef:0,conNfin:0,nart:[],ndef:[],nfin:[]};
      }
      var item=careers[career];
      item.total+=1;
      if(notes.nart!==null){item.conNart+=1;item.nart.push(notes.nart);}
      if(notes.ndef!==null){item.conNdef+=1;item.ndef.push(notes.ndef);}
      if(notes.nfin!==null){item.conNfin+=1;item.nfin.push(notes.nfin);}
    });

    var careerRows=Object.keys(careers).map(function(key){
      var item=careers[key];
      var sinNfin=item.total-item.conNfin;
      var promNfin=avg(item.nfin);
      var cobertura=pct(item.conNfin,item.total);
      var semaforo="gris";
      if(item.total){
        if(cobertura<65||(promNfin!==null&&promNfin<7)){semaforo="rojo";}
        else if(cobertura<85||(promNfin!==null&&promNfin<7.5)){semaforo="amarillo";}
        else{semaforo="verde";}
      }
      return {
        carrera:item.carrera,
        total:item.total,
        conNart:item.conNart,
        conNdef:item.conNdef,
        conNfin:item.conNfin,
        sinNfin:sinNfin,
        promNart:avg(item.nart),
        promNdef:avg(item.ndef),
        promNfin:promNfin,
        cobertura:cobertura,
        semaforo:semaforo
      };
    }).sort(function(a,b){return b.total-a.total||a.carrera.localeCompare(b.carrera,"es");});

    return {
      total:rows.length,
      conAny:conAny,
      sinAny:rows.length-conAny,
      conNart:nart.length,
      conNdef:ndef.length,
      conNfin:nfin.length,
      metrics:{
        nart:{promedio:avg(nart),minima:min(nart),maxima:max(nart)},
        ndef:{promedio:avg(ndef),minima:min(ndef),maxima:max(ndef)},
        nfin:{promedio:avg(nfin),minima:min(nfin),maxima:max(nfin)}
      },
      pending:pending.sort(function(a,b){return a.carrera.localeCompare(b.carrera,"es")||a.nombre.localeCompare(b.nombre,"es");}),
      ranges:Object.keys(ranges).map(function(key){return {label:key,total:ranges[key],percent:pct(ranges[key],rows.length)};}),
      careers:careerRows
    };
  }

  function metricsTable(metrics){
    return '<div class="stats-notes-table-wrap"><table><thead><tr><th>Indicador</th><th>Nart</th><th>Ndef</th><th>Nfin</th></tr></thead><tbody>'
      + '<tr><td><strong>Promedio</strong></td><td>'+fmt(metrics.nart.promedio)+'</td><td>'+fmt(metrics.ndef.promedio)+'</td><td>'+fmt(metrics.nfin.promedio)+'</td></tr>'
      + '<tr><td><strong>Mínima</strong></td><td>'+fmt(metrics.nart.minima)+'</td><td>'+fmt(metrics.ndef.minima)+'</td><td>'+fmt(metrics.nfin.minima)+'</td></tr>'
      + '<tr><td><strong>Máxima</strong></td><td>'+fmt(metrics.nart.maxima)+'</td><td>'+fmt(metrics.ndef.maxima)+'</td><td>'+fmt(metrics.nfin.maxima)+'</td></tr>'
      + '</tbody></table></div>';
  }
  function pendingTable(rows){
    if(!rows.length){return '<div class="empty">No existen notas finales pendientes con los filtros actuales.</div>';}
    return '<div class="stats-notes-table-wrap"><table><thead><tr><th>#</th><th>Estudiante</th><th>Cédula</th><th>Carrera</th><th>Nart</th><th>Ndef</th></tr></thead><tbody>'
      + rows.map(function(row,index){return '<tr><td>'+(index+1)+'</td><td><strong>'+esc(row.nombre)+'</strong></td><td>'+esc(row.cedula)+'</td><td>'+esc(row.carrera)+'</td><td>'+fmt(row.nart)+'</td><td>'+fmt(row.ndef)+'</td></tr>';}).join("")
      + '</tbody></table></div>';
  }
  function rangeChart(rows,total){
    return '<div class="stats-note-range-list">'+rows.map(function(item){
      var cls=item.label==="Sin nota final"?"is-empty":(item.label==="Menor a 7"?"is-bad":"");
      return '<div class="stats-note-range-row '+cls+'"><strong>'+esc(item.label)+'</strong><div class="stats-note-range-track"><i style="width:'+Math.max(0,Math.min(100,item.percent))+'%"></i></div><span>'+item.total+' · '+item.percent+'%</span></div>';
    }).join("")+'</div>';
  }
  function careersTable(rows){
    if(!rows.length){return '<div class="empty">No existen notas por carrera.</div>';}
    return '<div class="stats-notes-table-wrap"><table><thead><tr><th>Carrera</th><th>Total</th><th>Prom. Nart</th><th>Prom. Ndef</th><th>Prom. Nfin</th><th>Sin Nfin</th><th>Cobertura</th><th>Estado</th></tr></thead><tbody>'
      + rows.map(function(row){return '<tr><td><strong>'+esc(row.carrera)+'</strong></td><td>'+row.total+'</td><td>'+fmt(row.promNart)+'</td><td>'+fmt(row.promNdef)+'</td><td><strong>'+fmt(row.promNfin)+'</strong></td><td>'+row.sinNfin+'</td><td>'+row.cobertura+'%</td><td><span class="stats-note-semaphore is-'+esc(row.semaforo)+'">'+esc(row.semaforo)+'</span></td></tr>';}).join("")
      + '</tbody></table></div>';
  }

  function render(data,targetId){
    var target=el(targetId||"stats-notes");
    if(!target){return;}
    if(data&&data._requiresPeriod){target.innerHTML='<div class="empty">Selecciona un período para ver notas.</div>';return;}
    var result=build(rowsOf(data));
    target.innerHTML='<section class="stats-notes-dashboard">'
      + '<div class="stats-notes-summary-grid">'
      + card("Total",result.total,"estudiantes evaluados","")
      + card("Con alguna nota",result.conAny,"tienen Nart, Ndef o Nfin","is-ok")
      + card("Sin notas",result.sinAny,"no tienen ninguna nota","is-bad")
      + card("Con Nart",result.conNart,"nota de artículo","")
      + card("Con Ndef",result.conNdef,"nota de defensa","")
      + card("Con Nfin",result.conNfin,"nota final","")
      + '</div>'
      + '<div class="stats-notes-panel"><header><div><h3>Resumen de notas registradas</h3></div><span>Solo se calculan valores existentes</span></header>'+metricsTable(result.metrics)+'</div>'
      + '<div class="stats-notes-columns">'
      + '<article class="stats-notes-panel"><header><div><h3>Notas finales pendientes</h3></div><span>'+result.pending.length+' estudiantes</span></header>'+pendingTable(result.pending)+'</article>'
      + '<article class="stats-notes-panel"><header><div><h3>Distribución por rangos</h3></div><span>'+result.conNfin+' notas finales</span></header>'+rangeChart(result.ranges,result.total)+'</article>'
      + '</div>'
      + '<div class="stats-notes-panel"><header><div><h3>Promedios y semáforo por carrera</h3></div><span>'+result.careers.length+' carreras</span></header>'+careersTable(result.careers)+'</div>'
      + '</section>';
  }

  window.StatsNotes={render:render,build:build};
})(window,document);

/* =========================================================
Nombre completo: stats.closure.js
Ruta o ubicación: /Stats/stats.closure.js
Función:
- Convertir Stats en una herramienta de cierre de período.
- Contar cohorte completa, activos, retirados, estudiantes que llegan con requisitos completos y quienes no llegan.
- Explicar las causas de no llegada sin perder que un estudiante puede tener varias causas.
- Mostrar el detalle de estudiantes y la aprobación final por requisito.
- Usar exclusivamente StatsCore/BDLocal; no consulta Firebase directamente.
========================================================= */
(function(window,document){
  "use strict";

  var scheduled=false;
  var observer=null;

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function pct(value,total){
    var numerator=Number(value);
    var denominator=Number(total);
    if(!Number.isFinite(numerator)||!Number.isFinite(denominator)||denominator<=0){return 0;}
    return Math.round((numerator*10000)/denominator)/100;
  }
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}

  function currentState(){
    return window.StatsApp&&typeof window.StatsApp.getState==="function"
      ? window.StatsApp.getState()||{}
      : {};
  }

  function approvalOf(row){
    if(row&&row._approval){return row._approval;}
    if(window.StatsRules&&typeof window.StatsRules.studentApproval==="function"){
      return window.StatsRules.studentApproval(row||{})||{};
    }
    return {approved:false,missingRequirements:[],applicableRequirements:[]};
  }

  function isRetired(row){
    var value=text(row&&(row._estadoMatricula||row.estadoMatricula||row.EstadoMatricula||"ACTIVO")).toUpperCase();
    return value==="RETIRADO"||row&&row.retirado===true;
  }

  function nameOf(row){return text(row&&(row._nombres||row.nombres||row.Nombres||row.nombre||row.Nombre))||"Sin nombre";}
  function idOf(row){return text(row&&(row._cedula||row.cedula||row.Cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.identificacion));}
  function careerOf(row){return text(row&&(row._carrera||row.nombreCarrera||row.NombreCarrera||row.carrera||row.Carrera))||"SIN CARRERA";}

  function missingLabels(row){
    var approval=approvalOf(row);
    return (approval.missingRequirements||[]).map(function(item){
      return text(item&&item.label||item&&item.key||item);
    }).filter(Boolean);
  }

  function finalSummaries(rows){
    var finals=window.StatsRules&&Array.isArray(window.StatsRules.FINAL_REQUIREMENTS)
      ? window.StatsRules.FINAL_REQUIREMENTS
      : [];

    return finals.map(function(item){
      var result={key:item.key,label:item.label||item.key,total:0,cumple:0,no_cumple:0,avance:0};
      rows.forEach(function(row){
        var status=window.StatsRules&&typeof window.StatsRules.requirementStatus==="function"
          ? window.StatsRules.requirementStatus(row,item.key)
          : null;
        if(status&&status.applies===false){return;}
        result.total+=1;
        if(status&&status.cumple){result.cumple+=1;}else{result.no_cumple+=1;}
      });
      result.avance=pct(result.cumple,result.total);
      return result;
    });
  }

  function build(){
    var state=currentState();
    var periodId=text(state.periodId);

    if(!periodId||!window.StatsCore||typeof window.StatsCore.resumen!=="function"){
      return {requiresPeriod:true,periodId:periodId};
    }

    var data=window.StatsCore.resumen({
      periodId:periodId,
      division:text(state.division),
      matricula:"",
      career:text(state.career),
      status:"",
      requirementKey:"",
      force:false
    })||{};

    var rows=Array.isArray(data.rows)?data.rows:[];
    var active=[];
    var retired=[];
    var reached=[];
    var incomplete=[];
    var causes=Object.create(null);
    var detail=[];

    rows.forEach(function(row){
      if(isRetired(row)){
        retired.push(row);
        causes.Retiro=(causes.Retiro||0)+1;
        detail.push({row:row,causes:["Retiro"],type:"retirado"});
        return;
      }

      active.push(row);
      var approval=approvalOf(row);
      if(approval.approved){
        reached.push(row);
        return;
      }

      incomplete.push(row);
      var missing=missingLabels(row);
      if(!missing.length){missing=["Requisitos incompletos"];} 
      missing.forEach(function(label){causes[label]=(causes[label]||0)+1;});
      detail.push({row:row,causes:missing,type:"requisito"});
    });

    var notReached=retired.length+incomplete.length;
    var causesRows=Object.keys(causes).map(function(label){
      return {label:label,total:causes[label],percent:pct(causes[label],notReached)};
    }).sort(function(a,b){return b.total-a.total||a.label.localeCompare(b.label,"es");});

    detail.sort(function(a,b){
      return careerOf(a.row).localeCompare(careerOf(b.row),"es")||nameOf(a.row).localeCompare(nameOf(b.row),"es");
    });

    var incidentTotal=causesRows.reduce(function(sum,item){return sum+item.total;},0);
    var scope=[periodId];
    if(text(state.division)){scope.push(text(state.division));}
    if(text(state.career)){scope.push(text(state.career));}

    return {
      requiresPeriod:false,
      periodId:periodId,
      scope:scope.join(" · "),
      total:rows.length,
      active:active.length,
      retired:retired.length,
      reached:reached.length,
      incomplete:incomplete.length,
      notReached:notReached,
      arrivalRate:pct(reached.length,rows.length),
      activeArrivalRate:pct(reached.length,active.length),
      causes:causesRows,
      incidents:incidentTotal,
      detail:detail,
      final:finalSummaries(reached)
    };
  }

  function kpi(label,value,sub,cls){
    return '<article class="stats-closure-kpi '+esc(cls||"")+'"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(sub||"")+'</small></article>';
  }

  function causesHtml(report){
    if(!report.causes.length){return '<div class="empty">No existen causas de no llegada con el alcance actual.</div>';}
    return '<div class="stats-closure-causes">'+report.causes.map(function(item){
      return '<div class="stats-closure-cause">'
        +'<div><strong>'+esc(item.label)+'</strong><small>'+item.total+' estudiante'+(item.total===1?'':'s')+'</small></div>'
        +'<div class="stats-closure-cause-track"><i style="width:'+Math.max(0,Math.min(100,item.percent))+'%"></i></div>'
        +'<b>'+item.percent+'%</b>'
        +'</div>';
    }).join("")+'</div>';
  }

  function finalHtml(report){
    if(!report.final.length){return '<div class="empty">No se encontraron campos de aprobación final.</div>';}
    return '<div class="stats-closure-final-grid">'+report.final.map(function(item){
      return '<article><span>'+esc(item.label)+'</span><strong>'+item.cumple+' / '+item.total+'</strong><small>'+item.avance+'% aprobado · '+item.no_cumple+' no aprobado/pendiente</small></article>';
    }).join("")+'</div>';
  }

  function detailHtml(report){
    if(!report.detail.length){return '<div class="empty">Todos los estudiantes de la cohorte llegaron con requisitos completos.</div>';}
    return '<div class="stats-table-wrap stats-closure-detail"><table><thead><tr><th>#</th><th>Estudiante</th><th>Cédula</th><th>Carrera</th><th>Estado</th><th>Motivo(s)</th></tr></thead><tbody>'
      +report.detail.map(function(item,index){
        return '<tr>'
          +'<td>'+(index+1)+'</td>'
          +'<td><strong>'+esc(nameOf(item.row))+'</strong></td>'
          +'<td>'+esc(idOf(item.row))+'</td>'
          +'<td>'+esc(careerOf(item.row))+'</td>'
          +'<td><span class="stats-closure-state '+(item.type==="retirado"?'is-retired':'is-pending')+'">'+(item.type==="retirado"?'Retirado':'No llegó')+'</span></td>'
          +'<td>'+item.causes.map(function(cause){return '<span class="stats-closure-reason">'+esc(cause)+'</span>';}).join(" ")+'</td>'
          +'</tr>';
      }).join("")
      +'</tbody></table></div>';
  }

  function render(){
    var target=el("stats-closure-report");
    if(!target){return;}

    var report=build();
    var scope=el("stats-closure-scope");

    if(report.requiresPeriod){
      if(scope){scope.textContent="Selecciona un período";}
      target.innerHTML='<div class="empty">Selecciona el período terminado para generar el reporte de cierre.</div>';
      return;
    }

    if(scope){scope.textContent=report.scope;}

    target.innerHTML=''
      +'<p class="stats-closure-note">El cierre usa la cohorte completa del período (activos + retirados). Los filtros Matrícula, Estado y Requisito no alteran este reporte; División y Carrera sí permiten segmentarlo.</p>'
      +'<div class="stats-closure-kpis">'
      +kpi("Registrados",report.total,"cohorte del período","")
      +kpi("Activos al cierre",report.active,"sin retirados","")
      +kpi("Retirados",report.retired,"salieron del proceso","is-retired")
      +kpi("Llegaron",report.reached,"requisitos completos","is-ok")
      +kpi("No llegaron",report.notReached,"retirados + requisitos pendientes","is-bad")
      +kpi("Tasa de llegada",report.arrivalRate+"%","sobre toda la cohorte","is-rate")
      +'</div>'
      +'<div class="stats-closure-grid">'
      +'<article class="stats-card"><div class="stats-card-head"><h2>¿Por qué no llegaron?</h2><span>'+report.incidents+' incidencias en '+report.notReached+' estudiantes</span></div>'
      +causesHtml(report)
      +'<p class="stats-closure-footnote">Un estudiante puede tener varias causas; por eso los porcentajes de causas pueden sumar más de 100%.</p></article>'
      +'<article class="stats-card"><div class="stats-card-head"><h2>Aprobación final de quienes llegaron</h2><span>'+report.reached+' estudiantes con requisitos completos</span></div>'
      +finalHtml(report)+'</article>'
      +'</div>'
      +'<article class="stats-card stats-closure-detail-card"><div class="stats-card-head"><h2>Detalle de quienes no llegaron</h2><span>'+report.notReached+' estudiantes únicos</span></div>'
      +detailHtml(report)+'</article>';
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

    ["stats-periodo","stats-division","stats-carrera"].forEach(function(id){
      var node=el(id);if(node){node.addEventListener("change",schedule);}
    });

    var refresh=el("stats-refresh");if(refresh){refresh.addEventListener("click",schedule);}
    window.addEventListener("stats:cache-invalidated",schedule);
    window.addEventListener("bdlocal:conexiones-cache-updated",schedule);
    window.addEventListener("requisitos:bdlocal-cambio-disponible",schedule);
    schedule();
  }

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind);}else{bind();}

  window.StatsClosure={version:"1.0.1-rate-fix",build:build,render:render,refresh:schedule};
})(window,document);

/* =========================================================
Nombre completo: coo.mail.visual.js
Ruta: /Coordi/coo.mail.visual.js
Función:
- Mejorar únicamente el correo general de Coordi.
- Mantener destinatarios, copias y apertura definidos por COOMail.
- Mostrar una tabla HTML compacta en la vista previa.
- Generar una tabla de texto compacta para Outlook Web.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-compact-compliance-mail";
  var mail=window.COOMail;
  if(!mail||mail.__visualGeneralPatched){return;}

  var originalBuild=typeof mail.build==="function"?mail.build.bind(mail):null;
  var originalGeneral=typeof mail.buildGeneralCompliance==="function"?mail.buildGeneralCompliance.bind(mail):null;
  if(!originalBuild||!originalGeneral){return;}

  function text(value){return String(value==null?"":value).trim();}
  function arr(value){return Array.isArray(value)?value:[];}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function fmt(value){return Number(value||0).toLocaleString("es-EC");}
  function pct(value){return Number(value||0).toLocaleString("es-EC",{minimumFractionDigits:1,maximumFractionDigits:1})+"%";}
  function filterValue(report,key,fallback){return text(report&&report.filters&&report.filters[key])||fallback||"";}
  function periodLabel(report){return filterValue(report,"periodLabel",filterValue(report,"periodId","Período no definido"));}
  function divisionLabel(report){return filterValue(report,"division","Todas");}
  function careerLabel(report){return filterValue(report,"career","");}
  function processText(report){var type=report&&report.periodType||{};return type.id==="PVC"||type.isPVC?"proceso PVC":"proceso de titulación";}
  function greetingSentence(saludo){return /^(estimados|estimadas)\b/i.test(text(saludo))?"Reciban un cordial saludo.":"Reciba un cordial saludo.";}

  function signaturePlain(){
    var firma=window.COOConfig&&window.COOConfig.firma||{};
    return ["Saludos cordiales,",(firma.titulo?firma.titulo+" ":"")+(firma.nombre||"Jefferson Villarreal"),firma.cargo||"Coordinador de Titulación",firma.institucion||"ITSQMET"].join("\n");
  }
  function signatureHtml(){
    var firma=window.COOConfig&&window.COOConfig.firma||{};
    return '<p style="margin:16px 0 0;line-height:1.45;">Saludos cordiales,<br><strong>'+esc((firma.titulo?firma.titulo+" ":"")+(firma.nombre||"Jefferson Villarreal"))+'</strong><br>'+esc(firma.cargo||"Coordinador de Titulación")+'<br>'+esc(firma.institucion||"ITSQMET")+'</p>';
  }
  function statusStyle(value){value=Number(value||0);if(value>=80){return "background:#dcfce7;color:#166534;";}if(value>=60){return "background:#fef3c7;color:#92400e;";}return "background:#fee2e2;color:#991b1b;";}

  function summaryHtml(report,global){
    var cells=[["Período",periodLabel(report)],["División",divisionLabel(report)],["Evaluados",fmt(global.totalEstudiantesRevisados)]];
    if(careerLabel(report)){cells.splice(2,0,["Carrera",careerLabel(report)]);}
    return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:760px;margin:10px 0 12px;font-family:Arial,sans-serif;font-size:12px;"><tr>'+cells.map(function(cell){return '<td style="border:1px solid #dbe3ee;background:#f8fafc;padding:8px 10px;vertical-align:top;"><span style="display:block;color:#64748b;font-size:10px;font-weight:700;margin-bottom:2px;">'+esc(cell[0])+'</span><strong>'+esc(cell[1])+'</strong></td>';}).join("")+'</tr></table>';
  }

  function complianceHtml(rows){
    rows=arr(rows);
    if(!rows.length){return '<p><strong>Sin datos para mostrar.</strong></p>';}
    var html='<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:760px;font-family:Arial,sans-serif;font-size:12px;color:#0f172a;margin:8px 0 14px;"><thead><tr>';
    ["Requisito","Evaluados","Cumplen","Pendientes","Cumplimiento"].forEach(function(label){html+='<th style="border:1px solid #cbd5e1;background:#1e3a8a;color:#fff;padding:7px 9px;text-align:'+(label==="Requisito"?"left":"center")+';">'+label+'</th>';});
    html+='</tr></thead><tbody>';
    rows.forEach(function(row,index){
      var bg=index%2===0?"#ffffff":"#f8fafc";
      html+='<tr><td style="border:1px solid #cbd5e1;background:'+bg+';padding:7px 9px;font-weight:600;">'+esc(row.label||row.requisito||"Requisito")+'</td>'+
        '<td style="border:1px solid #cbd5e1;background:'+bg+';padding:7px 9px;text-align:center;">'+fmt(row.total)+'</td>'+
        '<td style="border:1px solid #cbd5e1;background:'+bg+';padding:7px 9px;text-align:center;">'+fmt(row.cumplen)+'</td>'+
        '<td style="border:1px solid #cbd5e1;background:'+bg+';padding:7px 9px;text-align:center;font-weight:600;">'+fmt(row.noCumplen)+'</td>'+
        '<td style="border:1px solid #cbd5e1;padding:7px 9px;text-align:center;font-weight:700;'+statusStyle(row.porcentaje)+'">'+pct(row.porcentaje)+'</td></tr>';
    });
    return html+'</tbody></table>';
  }

  function plainTable(rows){
    rows=arr(rows);
    if(!rows.length){return "Sin datos para mostrar.";}
    var lines=["Requisito | Eval. | Cumplen | Pend. | %","------------------------------------------------------------"];
    rows.forEach(function(row){lines.push([text(row.label||row.requisito||"Requisito"),fmt(row.total),fmt(row.cumplen),fmt(row.noCumplen),pct(row.porcentaje)].join(" | "));});
    return lines.join("\n");
  }

  function buildGeneralCompliance(report){
    report=report||{};
    var base=originalGeneral(report)||{};
    var global=report.global||{};
    var rows=arr(report.compliance||global.cumplimiento);
    var saludo=text(global.saludo||"Estimados coordinadores de área");
    var greeting=greetingSentence(saludo);
    var career=careerLabel(report);

    var html='<div style="font-family:Arial,sans-serif;color:#0f172a;font-size:13px;line-height:1.45;max-width:780px;">'+
      '<p style="margin:0 0 10px;"><strong>'+esc(saludo)+':</strong></p>'+
      '<p style="margin:0 0 10px;">'+esc(greeting)+'</p>'+
      '<p style="margin:0 0 10px;">Remito el <strong>reporte general de cumplimiento de requisitos</strong> de los estudiantes del '+esc(processText(report))+' <strong>'+esc(periodLabel(report))+'</strong>.</p>'+
      summaryHtml(report,global)+
      '<p style="margin:10px 0 6px;font-weight:700;color:#1e3a8a;">Estado de cumplimiento por requisito</p>'+
      complianceHtml(rows)+
      '<p style="margin:0 0 10px;">Se solicita a las áreas correspondientes realizar el <strong>seguimiento prioritario de los casos pendientes</strong>, con el fin de regularizar la situación de los estudiantes y asegurar la continuidad del proceso de titulación.</p>'+
      '<p style="margin:0 0 10px;">Agradezco de antemano su atención y gestión oportuna.</p>'+signatureHtml()+'</div>';

    var plain=[saludo+":","",greeting,"","Remito el reporte general de cumplimiento de requisitos de los estudiantes del "+processText(report)+" "+periodLabel(report)+".","","RESUMEN GENERAL","Período: "+periodLabel(report),"División: "+divisionLabel(report)];
    if(career){plain.push("Carrera: "+career);}
    plain=plain.concat(["Evaluados: "+fmt(global.totalEstudiantesRevisados),"","ESTADO DE CUMPLIMIENTO POR REQUISITO",plainTable(rows),"","Se solicita a las áreas correspondientes realizar el seguimiento prioritario de los casos pendientes, con el fin de regularizar la situación de los estudiantes y asegurar la continuidad del proceso de titulación.","","Agradezco de antemano su atención y gestión oportuna.","",signaturePlain()]);

    return Object.assign({},base,{html:html,plain:plain.join("\n")});
  }

  mail.buildGeneralCompliance=buildGeneralCompliance;
  mail.buildGlobal=buildGeneralCompliance;
  mail.build=function(report,options){options=options||{};if(options.kind==="global"||options.kind==="general"){return buildGeneralCompliance(report);}return originalBuild(report,options);};
  mail.__visualGeneralPatched=true;
  mail.visualGeneralVersion=VERSION;
  window.COOMailVisual={version:VERSION,buildGeneralCompliance:buildGeneralCompliance};
})(window);

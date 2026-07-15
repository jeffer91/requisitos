/* =========================================================
Nombre completo: infor.qa.js
Ruta o ubicación: /Requisitos/Infor/core/infor.qa.js
Función o funciones:
- Revisar que Infor utilice ConInfor como conexión exclusiva.
- Validar dependencias, estado mínimo y preparación para exportar.
- Mostrar advertencias sobre Excel, NÚCLEOS, complexivo e inconsistencias.
========================================================= */
(function(window,document){
  "use strict";

  function text(value){return String(value==null?"":value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}

  var MODULES=[
    {name:"ConInfor",value:"ConInfor",required:true},
    {name:"StatsRules",value:"StatsRules",required:true},
    {name:"InforPeriodo",value:"InforPeriodo",required:true},
    {name:"InforExcel",value:"InforExcel",required:true},
    {name:"InforRegular",value:"InforRegular",required:true},
    {name:"InforMatch",value:"InforMatch",required:true},
    {name:"InforCronogramaParser",value:"InforCronogramaParser",required:true},
    {name:"InforReport",value:"InforReport",required:true},
    {name:"InforGemini",value:"InforGemini",required:true},
    {name:"InforState",value:"InforState",required:true},
    {name:"InforWordExport",value:"InforWordExport",required:true},
    {name:"InforPdfExport",value:"InforPdfExport",required:true}
  ];

  function moduleChecks(){
    return MODULES.map(function(item){
      var ok=!!window[item.value];
      return {
        type:ok?"ok":(item.required?"error":"warn"),label:item.name,
        message:ok?"Disponible":(item.required?"No cargado":"No disponible")
      };
    });
  }

  function connectionChecks(){
    var current=window.ConInfor||null;
    var status={};
    try{status=current&&typeof current.status==="function"?current.status()||{}:{};}catch(error){}
    return [
      {
        type:current&&status.ok!==false?"ok":"error",
        label:"Conexión BDLocal",
        message:current
          ?("ConInfor · "+Number(status.periods||0)+" períodos · "+Number(status.students||0)+" estudiantes")
          :"ConInfor no está disponible"
      },
      {
        type:window.ExcelLocalRepo||window.BL2EstudiantesRepo?"warn":"ok",
        label:"Acceso heredado",
        message:window.ExcelLocalRepo||window.BL2EstudiantesRepo
          ?"Los adaptadores pueden existir por compatibilidad, pero Infor no debe consultarlos."
          :"Infor no depende de adaptadores heredados."
      }
    ];
  }

  function sheetMessage(snapshot){
    var sheets=snapshot.excelData&&Array.isArray(snapshot.excelData.sheets)?snapshot.excelData.sheets:[];
    if(!sheets.length){return "Sin hojas leídas";}
    return sheets.map(function(sheet){
      return sheet.name+": "+(sheet.ignored?"ignorada":((sheet.detectedStudents||0)+" filas"))+(sheet.reason?" ("+sheet.reason+")":"");
    }).join(" · ");
  }

  function stateChecks(snapshot){
    snapshot=snapshot||{};
    var checks=[];
    var hasPeriod=!!text(snapshot.periodId||snapshot.periodLabel);
    var excelRows=snapshot.excelData&&Array.isArray(snapshot.excelData.rows)?snapshot.excelData.rows.length:0;
    var match=snapshot.matchResult||null;
    var matchSummary=match&&match.summary?match.summary:null;
    var regular=match&&match.regularAnalysis?match.regularAnalysis:null;
    var report=snapshot.reportDraft||null;
    var key=window.InforState&&typeof window.InforState.getGeminiKey==="function"?window.InforState.getGeminiKey():"";
    var regularSummary=regular&&regular.summary?regular.summary:{};
    var nucleos=regular&&regular.nucleos?regular.nucleos:{};
    var complexivo=regular&&regular.complexivo?regular.complexivo:{};

    checks.push({type:hasPeriod?"ok":"warn",label:"Período",message:hasPeriod?"Seleccionado":"Pendiente de seleccionar"});
    checks.push({type:excelRows>0?"ok":"warn",label:"Excel",message:excelRows>0?(excelRows+" filas detectadas · "+sheetMessage(snapshot)):"Sin filas detectadas"});
    checks.push({type:regular?"ok":"warn",label:"NÚCLEOS",message:regular?((nucleos.total||0)+" estudiantes · "+(nucleos.aprobados||0)+" con 4 núcleos aprobados · "+(nucleos.retirados||0)+" retirados"):"Pendiente de ejecutar"});
    checks.push({type:regular?"ok":"warn",label:"Complexivo",message:regular?((complexivo.totalFinal||0)+" estudiantes únicos · "+(regularSummary.supletorios||0)+" con supletorio"):"Pendiente de ejecutar"});
    checks.push({type:regularSummary.inconsistencias?"warn":(regular?"ok":"warn"),label:"Inconsistencias",message:regular?((regularSummary.inconsistencias||0)+" estudiantes con complexivo sin 4 núcleos aprobados"):"Pendiente de ejecutar"});
    checks.push({type:matchSummary&&matchSummary.total?(matchSummary.pendientes?"warn":"ok"):"warn",label:"Unión BDLocal",message:matchSummary?(matchSummary.unidos+" unidos, "+matchSummary.pendientes+" pendientes · fuente "+(matchSummary.baseSource||"ConInfor")):"Sin unión todavía"});
    checks.push({type:key?"ok":"warn",label:"Gemini",message:key?"Clave configurada":"Clave pendiente"});
    checks.push({type:report&&report.ok?"ok":"warn",label:"Motor informe",message:report&&report.ok?(report.sections.length+" secciones listas"):"Pendiente de procesar"});
    checks.push({type:report&&report.ok?"ok":"warn",label:"Exportación",message:report&&report.ok?"Word/PDF habilitados":"Exportación bloqueada hasta procesar"});
    return checks;
  }

  function run(){
    var snapshot=window.InforState&&typeof window.InforState.getState==="function"?window.InforState.getState():{};
    var checks=moduleChecks().concat(connectionChecks()).concat(stateChecks(snapshot));
    var errors=checks.filter(function(item){return item.type==="error";}).length;
    var warnings=checks.filter(function(item){return item.type==="warn";}).length;
    return {ok:errors===0,errors:errors,warnings:warnings,checks:checks,generatedAt:new Date().toISOString()};
  }

  function badge(type){
    if(type==="ok"){return "<span class='infor-pill-mini ok'>OK</span>";}
    if(type==="error"){return "<span class='infor-pill-mini bad'>ERROR</span>";}
    return "<span class='infor-pill-mini warn'>REVISAR</span>";
  }

  function render(result){
    var box=document.getElementById("infor-qa-results");
    if(!box){return;}
    result=result||run();
    var html="<div class='infor-table-wrap'><table class='infor-small-table'><thead><tr><th>Estado</th><th>Elemento</th><th>Detalle</th></tr></thead><tbody>";
    html+=result.checks.map(function(item){return "<tr><td>"+badge(item.type)+"</td><td>"+esc(item.label)+"</td><td>"+esc(item.message)+"</td></tr>";}).join("");
    html+="</tbody></table></div>";
    html+="<p class='infor-muted'>Errores: "+result.errors+" · Advertencias: "+result.warnings+" · "+esc(result.generatedAt)+"</p>";
    box.innerHTML=html;
  }

  function boot(){
    var btn=document.getElementById("infor-qa-run");
    if(btn){btn.addEventListener("click",function(){render(run());});}
    window.addEventListener("infor:connection-ready",function(){render(run());});
    window.setTimeout(function(){render(run());},350);
  }

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
  window.InforQA={run:run,render:render};
})(window,document);
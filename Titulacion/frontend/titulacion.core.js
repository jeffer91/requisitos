/* =========================================================
Nombre completo: titulacion.core.js
Ruta o ubicación: /Requisitos/Titulacion/frontend/titulacion.core.js
Función o funciones:
- Leer estudiantes desde BaseLocal/ExcelLocalRepo.
- Generar información rápida del estado de titulación.
- Crear guía, comunicado y resumen de requisitos.
Con qué se conecta:
- excel-local.repo.js
- titulacion.app.js
========================================================= */
(function(window){
  "use strict";
  var REQS=[
    {key:"academico",label:"Académico"},{key:"documentacion",label:"Documentación"},{key:"financiero",label:"Financiero"},{key:"titulacion",label:"Titulación"},{key:"practicasvinculacion",label:"Prácticas/Vinculación"},{key:"vinculacion",label:"Vinculación"},{key:"seguimientograduados",label:"Seguimiento graduados"},{key:"ingles",label:"Inglés"},{key:"actualizaciondatos",label:"Actualización datos"},{key:"aprobaciontitulacion",label:"Aprobación titulación"},{key:"aprobacioncomplexivoproyecto",label:"Aprobación complexivo/proyecto"}
  ];
  var GUIDE=[
    {title:"1. Requisito",text:"Carga el Excel, crea o selecciona período y analiza la información."},
    {title:"2. Bl",text:"Verifica que BaseLocal tenga períodos, estudiantes e historial."},
    {title:"3. tabla",text:"Filtra estudiantes por período, carrera, estado o búsqueda general."},
    {title:"4. Ficha",text:"Revisa el detalle individual de cada estudiante y sus requisitos."},
    {title:"5. Stats",text:"Consulta avance general, cumplimiento por requisito y resumen por carrera."},
    {title:"6. Coordi",text:"Prioriza estudiantes y carreras para seguimiento administrativo."},
    {title:"7. Repor",text:"Genera reportes copiables, imprimibles y exportables."},
    {title:"8. Defensas",text:"Revisa agenda, mensajes y exportación de defensas."}
  ];
  function text(v){return String(v==null?"":v).trim();}
  function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
  function pct(n,d){return d?Math.round((n*10000)/d)/100:0;}
  function estadoCelda(v){var k=norm(v);if(!k)return "pendiente";if(["si","s","ok","cumple","aprobado","aprobada","1","true","x","validado","completo"].indexOf(k)>=0)return "cumple";if(["no","n","no cumple","reprobado","reprobada","0","false","falta","incompleto"].indexOf(k)>=0)return "no_cumple";return "pendiente";}
  function repo(){if(!window.ExcelLocalRepo)throw new Error("ExcelLocalRepo no disponible. Primero carga un Excel en Requisito.");return window.ExcelLocalRepo;}
  function periods(){return repo().listPeriods?repo().listPeriods():repo().getSnapshot().periods||[];}
  function rawStudents(){return repo().listAllStudents?repo().listAllStudents():repo().getSnapshot().students||[];}
  function estadoGeneral(row){var ok=0,no=0,pend=0;REQS.forEach(function(req){var e=estadoCelda(row[req.key]);if(e==="cumple")ok++;else if(e==="no_cumple")no++;else pend++;});if(no>0)return {id:"no_cumple",label:"No habilitado",ok:ok,no:no,pend:pend};if(pend>0)return {id:"pendiente",label:"Con pendientes",ok:ok,no:no,pend:pend};return {id:"listo",label:"Listo",ok:ok,no:no,pend:pend};}
  function decorate(row){var r=Object.assign({},row||{});r._cedula=text(r.cedula||r.numeroIdentificacion||r.numeroidentificacion);r._nombres=text(r.nombres||r.nombre||r.estudiante);r._carrera=text(r.nombrecarrera||r.nombreCarrera||r.carrera)||"SIN CARRERA";r._periodo=text(r.periodoLabel||r.periodoId)||"SIN PERÍODO";r._periodoId=text(r.periodoId);r._estado=estadoGeneral(r);return r;}
  function filtered(opts){opts=opts||{};var periodId=text(opts.periodId),career=text(opts.career);return rawStudents().map(decorate).filter(function(s){if(periodId&&s._periodoId!==periodId)return false;if(career&&s._carrera!==career)return false;return true;});}
  function unique(list,getter){var map={};list.forEach(function(x){var v=text(getter(x));if(v)map[v]=true;});return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});}
  function byCareer(list){var map={};list.forEach(function(s){var k=s._carrera;if(!map[k])map[k]={key:k,total:0,listo:0,pendiente:0,no_cumple:0,avance:0};map[k].total++;map[k][s._estado.id]++;});Object.keys(map).forEach(function(k){map[k].avance=pct(map[k].listo,map[k].total);});return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return b.no_cumple-a.no_cumple||b.pendiente-a.pendiente||a.key.localeCompare(b.key,"es");});}
  function byRequirement(list){return REQS.map(function(req){var r={key:req.key,label:req.label,total:list.length,cumple:0,pendiente:0,no_cumple:0,atencion:0,avance:0};list.forEach(function(row){r[estadoCelda(row[req.key])]++;});r.atencion=r.no_cumple*3+r.pendiente;r.avance=pct(r.cumple,r.total);return r;}).sort(function(a,b){return b.atencion-a.atencion;});}
  function build(opts){opts=opts||{};var rows=filtered(opts);var k={total:rows.length,listo:0,pendiente:0,no_cumple:0,avance:0};rows.forEach(function(s){k[s._estado.id]++;});k.avance=pct(k.listo,k.total);var data={vista:text(opts.vista)||"resumen",generatedAt:new Date().toISOString(),kpis:k,carreras:byCareer(rows),requisitos:byRequirement(rows),periodList:periods(),careerList:unique(rawStudents().map(decorate),function(s){return s._carrera;}),guide:GUIDE.slice(),rows:rows,filters:opts};data.text=makeText(data);return data;}
  function makeText(data){var k=data.kpis||{};if(data.vista==="guia")return GUIDE.map(function(g){return g.title+"\n"+g.text;}).join("\n\n");if(data.vista==="comunicado")return "Estimados estudiantes,\n\nSe informa que el seguimiento de requisitos de titulación se encuentra en revisión.\n\nTotal revisados: "+(k.total||0)+".\nListos: "+(k.listo||0)+".\nCon pendientes: "+(k.pendiente||0)+".\nNo habilitados: "+(k.no_cumple||0)+".\n\nPor favor, revisar los pendientes reportados y completar la información solicitada por el área correspondiente.";var req=(data.requisitos||[])[0];var car=(data.carreras||[])[0];return "INFOR - RESUMEN DE TITULACIÓN\n\nTotal estudiantes: "+(k.total||0)+"\nListos: "+(k.listo||0)+"\nCon pendientes: "+(k.pendiente||0)+"\nNo habilitados: "+(k.no_cumple||0)+"\nAvance: "+(k.avance||0)+"%\n\nRequisito con mayor atención: "+(req?req.label+" (pendientes: "+req.pendiente+", no cumple: "+req.no_cumple+")":"Sin datos")+"\nCarrera con mayor atención: "+(car?car.key+" (pendientes: "+car.pendiente+", no habilitados: "+car.no_cumple+")":"Sin datos");}
  window.TitulacionCore={REQS:REQS,GUIDE:GUIDE,periods:periods,build:build,estadoGeneral:estadoGeneral};
})(window);

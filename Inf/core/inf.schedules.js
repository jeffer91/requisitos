/* Datos variables exclusivamente por período; nunca escriben en BDLocal. */
(function(window) {
"use strict";
var KEY="ITSQMET_INF_CRONOGRAMAS_V1";
var EXAMPLE="Octubre 2025 a Marzo 2026";
var COMPLEX=[
  {
    "activity": "Núcleo 1",
    "start": "30/3/2026",
    "end": "2/4/2026",
    "phase": "",
    "status": "NO_VERIFICADO"
  },
  {
    "activity": "Núcleo 2",
    "start": "6/4/2026",
    "end": "9/4/2026",
    "phase": "",
    "status": "NO_VERIFICADO"
  },
  {
    "activity": "Núcleo 3",
    "start": "10/4/2026",
    "end": "14/4/2026",
    "phase": "",
    "status": "NO_VERIFICADO"
  },
  {
    "activity": "Núcleo 4",
    "start": "15/4/2026",
    "end": "18/4/2026",
    "phase": "",
    "status": "NO_VERIFICADO"
  },
  {
    "activity": "Examen Complexivo",
    "start": "20/4/2026",
    "end": "24/4/2026",
    "phase": "",
    "status": "NO_VERIFICADO"
  },
  {
    "activity": "Supletorio",
    "start": "4/5/2026",
    "end": "4/5/2026",
    "phase": "",
    "status": "NO_VERIFICADO"
  }
];
var THESIS=[
  {
    "phase": "Fase 1: Inicio y planificación",
    "activity": "Inducción",
    "start": "16/12/2025",
    "end": "16/12/2025",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 1: Inicio y planificación",
    "activity": "Clase Redacción eficiente de tesis",
    "start": "28/1/2026",
    "end": "28/1/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 1: Inicio y planificación",
    "activity": "Elaboración de propuesta de temas",
    "start": "1/2/2026",
    "end": "1/2/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 1: Inicio y planificación",
    "activity": "Aprobación del tema",
    "start": "2/2/2026",
    "end": "4/2/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 1: Inicio y planificación",
    "activity": "Elaboración del plan de titulación",
    "start": "8/2/2026",
    "end": "8/2/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 1: Inicio y planificación",
    "activity": "Aprobación del plan",
    "start": "9/2/2026",
    "end": "11/2/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 2: Desarrollo y tutorías",
    "activity": "Desarrollo del trabajo (redacción)",
    "start": "11/2/2026",
    "end": "28/2/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 2: Desarrollo y tutorías",
    "activity": "Borrador 1",
    "start": "1/3/2026",
    "end": "1/3/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 2: Desarrollo y tutorías",
    "activity": "Revisión del borrador 1 con el estudiante",
    "start": "2/3/2026",
    "end": "5/3/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 2: Desarrollo y tutorías",
    "activity": "Borrador 2",
    "start": "8/3/2026",
    "end": "8/3/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 2: Desarrollo y tutorías",
    "activity": "Revisión del borrador 2 con el estudiante",
    "start": "9/3/2026",
    "end": "13/3/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 2: Desarrollo y tutorías",
    "activity": "Ajustes finales del trabajo",
    "start": "14/3/2026",
    "end": "19/3/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 2: Desarrollo y tutorías",
    "activity": "Entrega de trabajo de titulación",
    "start": "22/3/2026",
    "end": "22/3/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 2: Desarrollo y tutorías",
    "activity": "Aprobación del tutor e informe antiplagio",
    "start": "23/3/2026",
    "end": "25/3/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 2: Desarrollo y tutorías",
    "activity": "Fin de clases",
    "start": "27/3/2026",
    "end": "27/3/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 3: Defensa final",
    "activity": "Preparación de defensa",
    "start": "25/3/2026",
    "end": "8/4/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 3: Defensa final",
    "activity": "Defensa de tesis",
    "start": "14/4/2026",
    "end": "15/4/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 3: Defensa final",
    "activity": "Tutoría extra de supletorio",
    "start": "14/4/2026",
    "end": "15/4/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 3: Defensa final",
    "activity": "Supletorio defensa",
    "start": "16/4/2026",
    "end": "18/4/2026",
    "status": "NO_VERIFICADO"
  },
  {
    "phase": "Fase 3: Defensa final",
    "activity": "Cierre del proceso",
    "start": "20/4/2026",
    "end": "20/4/2026",
    "status": "NO_VERIFICADO"
  }
];
var statuses=Object.freeze(["NO_VERIFICADO","EJECUTADO","PENDIENTE","REPROGRAMADO","NO_EJECUTADO"]);
function text(s){return String(s==null?"":s).trim();}
function clone(x){return JSON.parse(JSON.stringify(x));}
function day(s){
  var m=text(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!m)return null;
  var d=Number(m[1]),mo=Number(m[2]),year=Number(m[3]);
  if(year<1900||year>2200)return null;
  var dt=new Date(Date.UTC(year,mo-1,d));
  return dt.getUTCDate()===d&&dt.getUTCMonth()===mo-1&&dt.getUTCFullYear()===year?dt.getTime():null;
}
function issue(row){
  if(!text(row.activity))return "Actividad vacía";
  var start=day(row.start),end=day(row.end);
  if(start===null||end===null)return "Fecha inválida (dd/mm/aaaa)";
  if(start>end)return "Inicio posterior a fin";
  if(statuses.indexOf(row.status||"NO_VERIFICADO")<0)return "Estado no reconocido";
  return "";
}
function validate(data){
  var faults=[];
  ["complexivo","trabajo"].forEach(function(mode){
    (data[mode]||[]).forEach(function(row,i){var e=issue(row);if(e)faults.push(mode+" · fila "+(i+1)+": "+e);});
  });
  return faults;
}
function all(){
  try {
    var out=JSON.parse(window.localStorage.getItem(KEY)||"{}");
    return out && typeof out==="object" && !Array.isArray(out)?out:{};
  } catch(e) { return {}; }
}
function example(period){
  return {
    period:period,source:period===EXAMPLE?"Cronogramas proporcionados por el usuario":"Nuevo cronograma",
    complexivo:period===EXAMPLE?clone(COMPLEX):[],
    trabajo:period===EXAMPLE?clone(THESIS):[],
    saved:false
  };
}
function load(period){
  var label=text(period);if(!label)throw Error("Debes identificar el período académico.");
  var stored=all()[label];
  if(!stored)return example(label);
  return {period:label,source:"Cronogramas guardados en este equipo",
    complexivo:Array.isArray(stored.complexivo)?clone(stored.complexivo):[],
    trabajo:Array.isArray(stored.trabajo)?clone(stored.trabajo):[],saved:true};
}
function save(data){
  var period=text(data.period);
  if(!period)throw Error("El período académico es obligatorio.");
  var errors=validate(data);if(errors.length)throw Error(errors.join("\n"));
  var source=all();source[period]={complexivo:clone(data.complexivo||[]),trabajo:clone(data.trabajo||[])};
  try{window.localStorage.setItem(KEY,JSON.stringify(source));}
  catch(err){throw Error("El almacenamiento local no guardó el cronograma: "+err.message);}
  return load(period);
}
window.InfSchedules=Object.freeze({
  key:KEY,examplePeriod:EXAMPLE,load:load,save:save,periods:function(){return Object.keys(all()).sort();},
  statuses:statuses,validate:validate,issue:issue,day:day,example:example
});
})(window);

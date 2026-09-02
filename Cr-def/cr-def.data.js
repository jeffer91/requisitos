/* =========================================================
Nombre completo: cr-def.data.js
Ruta: /Cr-def/cr-def.data.js
Función:
- Leer exclusivamente desde ConCrDef.
- Trabajar con estudiantes activos e IDs/períodos canónicos.
- Hidratar requisitos, notas y cronogramas persistidos.
========================================================= */
(function(window){
  "use strict";
  var rules=window.CR_DEF_RULES||{};
  function text(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function norm(value){return text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}
  function clone(value){if(value===undefined)return undefined;try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function connector(){return window.ConCrDef||window.BDLocalConeCrDef||null;}
  function utils(){return window.BDLocalConUtils||(window.BDLocalConexiones&&window.BDLocalConexiones.utils)||{};}
  function canonicalPeriodId(value){var u=utils();if(typeof u.canonicalPeriodId==="function")return u.canonicalPeriodId(value);value=text(value);var m=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return m?m[1]+"-"+m[2]+"__"+m[3]+"-"+m[4]:value.replace(/_+/g,"__");}
  function samePeriod(a,b){var u=utils();return typeof u.samePeriod==="function"?u.samePeriod(a,b):canonicalPeriodId(a)===canonicalPeriodId(b);}
  function normalizeCedula(value){var u=utils();if(typeof u.normalizeCedula==="function")return u.normalizeCedula(value);var raw=text(value).replace(/[^\dA-Za-z]/g,"");return /^\d{9}$/.test(raw)?"0"+raw:raw;}
  function studentPeriodId(periodoId,cedula){var u=utils();if(typeof u.studentPeriodId==="function")return u.studentPeriodId(periodoId,cedula);return normalizeCedula(cedula)+"__"+canonicalPeriodId(periodoId);}
  function readFirst(row,keys){row=row||{};var raw=Object.keys(row),mapped=raw.map(function(k){return {key:k,norm:norm(k)};});for(var i=0;i<keys.length;i++){var wanted=norm(keys[i]),exact=mapped.find(function(x){return x.norm===wanted;});if(exact&&text(row[exact.key])!=="")return row[exact.key];}for(var j=0;j<keys.length;j++){var part=norm(keys[j]),found=mapped.find(function(x){return x.norm.indexOf(part)!==-1;});if(found&&text(row[found.key])!=="")return row[found.key];}return "";}
  function cedulaOf(row){return normalizeCedula(readFirst(row,["cedula","numeroIdentificacion","NumeroIdentificacion","identificacion","Identificación","documento"]));}
  function periodoIdOf(row){return canonicalPeriodId(readFirst(row,["periodoId","periodId","ultimoPeriodoId","periodo"]));}
  function nombreOf(row){return text(readFirst(row,["nombreCompleto","Nombres","nombres","Nombre","nombre","Estudiante","estudiante"]));}
  function carreraOf(row){return text(readFirst(row,["carrera","NombreCarrera","nombreCarrera","Carrera"]));}
  function sedeOf(row){var sede=text(readFirst(row,["Sede","sede","Campus","campus"])),key=norm(sede);if(key==="matriz")return "Matriz";if(key==="sur")return "Sur";if(key==="norte")return "Norte";if(key==="manta")return "Manta";if(key==="virtual"||key==="online")return "Virtual";return sede;}
  function updatedAtOf(row){return text(readFirst(row,["updatedAt","actualizadoEn","fechaActualizacion","createdAt"]));}
  function makeKey(periodoId,cedula){return studentPeriodId(periodoId,cedula);}
  function groupByPeriodoCedula(rows){var map=Object.create(null);(rows||[]).forEach(function(row){var c=cedulaOf(row),p=periodoIdOf(row);if(!c||!p)return;var k=makeKey(p,c);(map[k]=map[k]||[]).push(row);});return map;}
  function putRequirement(record,row){
    var label=text(readFirst(row,["requisito","requisitoLabel","nombreRequisito","requisitoNombre","requisitoKey","campo","field","nombre"]));
    var estado=text(readFirst(row,["estado","estadoKey","valor","value","cumple","aprobado","resultado"]));
    if(!label||!estado)return;record[label]=estado;var key=norm(label);
    if(key.indexOf("academ")!==-1){record["Académico"]=estado;record.Academico=estado;}
    if(key.indexOf("document")!==-1){record["Documentación"]=estado;record.Documentacion=estado;}
    if(key.indexOf("financier")!==-1||key.indexOf("pago")!==-1)record.Financiero=estado;
    if(key.indexOf("titulacion")!==-1){record["Titulación"]=estado;record.Titulacion=estado;}
    if(key.indexOf("practic")!==-1){record["Prácticas"]=estado;record["PrácticasVinculacion"]=estado;}
    if(key.indexOf("vincul")!==-1){record["Vinculación"]=estado;record.Vinculacion=estado;}
    if(key.indexOf("seguimiento")!==-1){record["Seguimiento graduados"]=estado;record.SeguimientoGraduados=estado;}
    if(key.indexOf("ingles")!==-1){record["Inglés"]=estado;record.Ingles=estado;}
    if(key.indexOf("actualizacion")!==-1&&key.indexOf("dato")!==-1){record["Actualización de datos"]=estado;record["ActualizaciónDatos"]=estado;}
  }
  function noteNumber(row,aliases){var value=readFirst(row||{},aliases);if(value===""||value==null)return null;if(rules.helpers&&typeof rules.helpers.toNumber==="function")return rules.helpers.toNumber(value);var n=Number(String(value).replace(",","."));return Number.isFinite(n)?n:null;}
  function putNotes(record,rows){(rows||[]).filter(Boolean).forEach(function(row){Object.keys(row||{}).forEach(function(k){if(record[k]==null||record[k]==="")record[k]=row[k];});var a=noteNumber(row,["Notart","Nart","notart","notaArticulo","nota_articulo","nota artículo","articulo"]),d=noteNumber(row,["Notdef","Ndef","notdef","notaDefensa","nota_defensa","nota defensa","defensa"]),f=noteNumber(row,["Notafinal","Nfinal","notafinal","notaFinal","nota final"]);if(a!=null){record.notaArticulo=a;record.Notart=a;}if(d!=null){record.notaDefensa=d;record.Notdef=d;}if(f!=null){record.notaFinal=f;record.Notafinal=f;}});}
  function buildFirma(periodoId,students,requirements){students=students||[];requirements=requirements||[];var all=students.concat(requirements),max=all.reduce(function(m,row){var v=updatedAtOf(row);return v>m?v:m;},""),totalNotas=students.filter(function(row){return noteNumber(row,["Notart","Nart","notart","notaArticulo"])!=null||noteNumber(row,["Notdef","Ndef","notdef","notaDefensa"])!=null;}).length,raw=[periodoId,students.length,requirements.length,totalNotas,max].join("|"),hash=0;for(var i=0;i<raw.length;i++){hash=((hash<<5)-hash)+raw.charCodeAt(i);hash|=0;}return {periodoId:periodoId,hash:String(hash)+"::"+raw.length,maxUpdatedAt:max,totalMatriculas:students.length,totalEstudiantes:students.length,totalRequisitos:requirements.length,totalNotas:totalNotas,calculatedAt:new Date().toISOString(),source:"ConCrDef"};}
  function ensureConnector(){var c=connector();if(!c)return Promise.reject(new Error("ConCrDef no está cargado."));return typeof c.ready==="function"?c.ready().then(function(r){if(r&&r.ok===false)throw new Error(r.error||"ConCrDef no está listo.");return c;}):Promise.resolve(c);}
  function listarPeriodos(){return ensureConnector().then(function(c){return typeof c.listPeriods==="function"?c.listPeriods():(typeof c.getPeriods==="function"?c.getPeriods():[]);}).then(function(rows){var seen={};return (rows||[]).map(function(row){var id=canonicalPeriodId(row&&(row.id||row.periodoId||row.value||row.key));return {id:id,label:text(row&&(row.label||row.periodoLabel||row.nombre||id))};}).filter(function(row){if(!row.id||seen[row.id])return false;seen[row.id]=true;return true;});});}
  function readPeriod(periodoId){periodoId=canonicalPeriodId(periodoId);return ensureConnector().then(function(c){if(typeof c.read!=="function")throw new Error("ConCrDef.read no está disponible.");return c.read({periodoId:periodoId,periodId:periodoId,matricula:"ACTIVO"});}).then(function(response){if(!response||response.ok===false)throw new Error(response&&response.error||"ConCrDef no entregó datos.");var data=response.data||{};return {students:Array.isArray(data.students)?data.students:[],requirements:Array.isArray(data.requirements)?data.requirements:[],schedules:Array.isArray(data.schedules)?data.schedules:[]};});}
  function scheduleMap(rows){var map={};(rows||[]).forEach(function(row){var c=cedulaOf(row),p=periodoIdOf(row),i=Number(row.intento||1);if(c&&p)map[makeKey(p,c)+"__"+i]=row;});return map;}
  function mergeSchedule(row,s){if(!s)return row;["aula","dia","hora","sede","tribunal1","tribunal2","tribunal3"].forEach(function(k){if(text(s[k])!=="")row[k]=s[k];});row.cronogramaEstado=text(s.estadoCronograma||s.cronogramaEstado||"BORRADOR").toUpperCase();row.cronograma={persisted:true,id:s.id||"",estado:row.cronogramaEstado,fechaISO:s.fechaISO||"",horaInicio:s.horaInicio||"",horaFin:s.horaFin||"",updatedAt:s.updatedAt||""};if(text(row.dia)&&text(row.hora)&&row.cronogramaEstado!=="ANULADO"){row.estadoClave="programado";row.estado="Defensa programada";}return row;}
  function isActive(row){var v=text(readFirst(row,["estadoMatricula","EstadoMatricula","_estadoMatricula","estado","Estado"])).toUpperCase();return !v||v==="ACTIVO";}
  function cargarAptos(periodoId){
    periodoId=canonicalPeriodId(periodoId);if(!periodoId)return Promise.resolve({rows:[],firma:null,resumen:{aptos:0,bloqueados:0}});
    return readPeriod(periodoId).then(function(data){
      var students=data.students,requirements=data.requirements,byReq=groupByPeriodoCedula(requirements),saved=scheduleMap(data.schedules),rows=[],bloqueados=0,defensaAprobada=0,retirados=0;
      students.forEach(function(baseRow){
        if(!isActive(baseRow)){retirados++;return;}var cedula=cedulaOf(baseRow);if(!cedula)return;var rowPeriod=periodoIdOf(baseRow)||periodoId;if(rowPeriod&&!samePeriod(rowPeriod,periodoId))return;
        var key=makeKey(periodoId,cedula),record=Object.assign({},clone(baseRow));record.cedula=cedula;record.periodoId=periodoId;record.nombre=nombreOf(baseRow);record.carrera=carreraOf(baseRow);record.sede=sedeOf(baseRow);
        var embedded=(Array.isArray(baseRow.requisitos)?baseRow.requisitos:[]).concat(Array.isArray(baseRow.requirements)?baseRow.requirements:[]);record.requisitos=embedded.concat(byReq[key]||[]);record.requirements=record.requisitos;record.requisitos.forEach(function(req){putRequirement(record,req);});putNotes(record,[baseRow,baseRow._bdlNotas]);
        var ev=rules&&typeof rules.evaluarAptitud==="function"?rules.evaluarAptitud(record):{apto:false,estadoClave:"bloqueado",estado:"No apto",alertas:["Reglas Cr-def no disponibles."]};
        if(ev.estadoClave==="defensa-aprobada"){defensaAprobada++;return;}if(!ev.apto){bloqueados++;return;}
        var intento=Number(ev.intento||1),row={id:key,periodoId:periodoId,intento:intento,tipoDefensa:ev.tipoDefensa||(intento===2?"SUPLETORIO":"ORDINARIA"),aula:"",dia:"",hora:"",sede:record.sede,cedula:cedula,nombre:record.nombre,carrera:record.carrera,notaArticulo:ev.notaArticulo==null?"":ev.notaArticulo,notaDefensa:ev.notaDefensa,tribunal1:"",tribunal2:"",tribunal3:"",estadoClave:ev.estadoClave,estado:ev.estado,alertas:ev.alertas||[],raw:record};
        rows.push(mergeSchedule(row,saved[key+"__"+intento]));
      });
      rows.sort(function(a,b){return [a.carrera,a.sede,a.nombre].join("|").localeCompare([b.carrera,b.sede,b.nombre].join("|"),"es");});
      return {rows:rows,firma:buildFirma(periodoId,students,requirements),resumen:{aptos:rows.filter(function(r){return r.estadoClave==="apto";}).length,supletorios:rows.filter(function(r){return r.estadoClave==="supletorio";}).length,programados:rows.filter(function(r){return r.estadoClave==="programado";}).length,bloqueados:bloqueados,defensaAprobada:defensaAprobada,retiradosExcluidos:retirados,totalBase:students.length}};
    });
  }
  function calcularFirma(periodoId){periodoId=canonicalPeriodId(periodoId);return readPeriod(periodoId).then(function(data){return buildFirma(periodoId,data.students,data.requirements);});}
  function guardarCronograma(rows){rows=(rows||[]).filter(function(row){return text(row.cedula)&&text(row.periodoId)&&text(row.dia)&&text(row.hora);});if(!rows.length)return Promise.resolve([]);return ensureConnector().then(function(c){if(typeof c.saveSchedules!=="function")throw new Error("ConCrDef.saveSchedules no está disponible.");return c.saveSchedules(rows.map(function(row){return {periodoId:canonicalPeriodId(row.periodoId),cedula:normalizeCedula(row.cedula),intento:Number(row.intento||1),tipoDefensa:row.tipoDefensa||"ORDINARIA",aula:row.aula||"",dia:row.dia||"",hora:row.hora||"",sede:row.sede||"",tribunal1:row.tribunal1||"",tribunal2:row.tribunal2||"",tribunal3:row.tribunal3||"",estadoCronograma:row.cronogramaEstado||"BORRADOR",fechaISO:row.cronograma&&row.cronograma.fechaISO||"",updatedAt:new Date().toISOString()};}),{source:"Cr-def.scheduler"});});}
  window.CR_DEF_DATA=Object.freeze({dbAvailable:function(){return !!connector();},connectionAvailable:function(){return !!connector();},listarPeriodos:listarPeriodos,cargarAptos:cargarAptos,calcularFirma:calcularFirma,guardarCronograma:guardarCronograma,helpers:Object.freeze({text:text,norm:norm,cedulaOf:cedulaOf,readFirst:readFirst,canonicalPeriodId:canonicalPeriodId,samePeriod:samePeriod,studentPeriodId:studentPeriodId})});
})(window);

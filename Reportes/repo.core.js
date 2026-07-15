/* =========================================================
Nombre completo: repo.core.js
Ruta o ubicación: /Reportes/repo.core.js
Función o funciones:
- Leer períodos, estudiantes y requisitos exclusivamente mediante ConReportes.
- Relacionar requisitos por cédula y período antes de calcular el reporte.
- Generar reportes generales, por carrera, por requisito y pendientes.
- Filtrar por período, división, matrícula y carrera.
========================================================= */
(function(window){
  "use strict";

  var VERSION="3.0.0-conreportes-only";
  var FALLBACK_REQS=[
    {key:"academico",label:"Académico"},
    {key:"documentacion",label:"Documentación"},
    {key:"financiero",label:"Financiero"},
    {key:"practicasvinculacion",label:"Prácticas"},
    {key:"vinculacion",label:"Vinculación"},
    {key:"seguimientograduados",label:"Seguimiento graduados"},
    {key:"ingles",label:"Inglés"},
    {key:"actualizaciondatos",label:"Actualización datos"}
  ];

  function connector(){return window.ConReportes||window.BDLocalReportes||null;}
  function rules(){return window.StatsRules||null;}
  function text(value){return String(value==null?"":value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]+/g,"");}
  function arr(value){return Array.isArray(value)?value:[];}
  function pct(value,total){return total?Math.round((Number(value||0)*10000)/Number(total||0))/100:0;}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function canonicalPeriodId(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function normalizeCedula(value){var raw=text(value).replace(/[^0-9A-Za-z]/g,"");return /^\d{9}$/.test(raw)?"0"+raw:raw;}
  function samePeriod(a,b){a=canonicalPeriodId(a);b=canonicalPeriodId(b);return !b||a===b||compact(a)===compact(b);}
  function first(row,keys){
    row=row||{};
    for(var i=0;i<keys.length;i+=1){if(row[keys[i]]!==undefined&&row[keys[i]]!==null&&text(row[keys[i]])!==""){return row[keys[i]];}}
    return "";
  }
  function cedulaOf(row){return normalizeCedula(first(row||{},["_cedula","cedula","Cedula","Cédula","numeroIdentificacion","NumeroIdentificacion","identificacion","Identificacion","_bl2Id"]));}
  function periodOf(row){return canonicalPeriodId(first(row||{},["_periodoId","periodoId","periodId","periodoCanonicoId","ultimoPeriodoId","idPeriodo","_bl2PeriodoId","periodo","Periodo"]));}
  function requirementKey(req){
    req=req||{};
    var nested=req.requisito&&typeof req.requisito==="object"?req.requisito:null;
    return text(req.requisitoKey||req.requirementKey||req.key||req.campo||req.field||req.codigo||req.nombre||(nested&&(nested.key||nested.id||nested.nombre))||(typeof req.requisito==="string"?req.requisito:""));
  }
  function requirementValue(req){
    req=req||{};
    var keys=["valor","value","estado","cumple","aprobado","resultado"];
    for(var i=0;i<keys.length;i+=1){
      var value=req[keys[i]];
      if(value===undefined||value===null){continue;}
      if(value&&typeof value==="object"){value=value.id||value.value||value.label||"";}
      if(typeof value==="boolean"||typeof value==="number"||text(value)!==""){return value;}
    }
    return "";
  }
  function normalizeRequirement(req){
    req=Object.assign({},req||{});
    var key=requirementKey(req);
    req.requisitoKey=key;
    req.requirementKey=key;
    req.valor=requirementValue(req);
    req.cedula=cedulaOf(req);
    req.periodoId=periodOf(req);
    return req;
  }
  function periodList(){
    var con=connector();
    if(!con){return [];}
    var rows=[];
    try{
      if(typeof con.listPeriods==="function"){rows=con.listPeriods()||[];}
      else if(typeof con.getPeriods==="function"){rows=con.getPeriods()||[];}
    }catch(error){}
    return arr(rows).map(function(item){
      if(typeof item==="string"){return {id:canonicalPeriodId(item),periodoId:canonicalPeriodId(item),label:item,periodoLabel:item};}
      item=item||{};
      var id=canonicalPeriodId(item.id||item.periodoId||item.periodId||item.value||item.label||item.periodoLabel);
      var label=text(item.label||item.periodoLabel||item.nombre||item.name||id);
      return id||label?Object.assign({},item,{id:id||label,periodoId:id||label,label:label||id,periodoLabel:label||id}):null;
    }).filter(Boolean);
  }
  function readBundle(filters){
    var con=connector();
    if(!con){throw new Error("ConReportes no está disponible.");}
    filters=Object.assign({},filters||{});
    filters.periodoId=canonicalPeriodId(filters.periodoId||filters.periodId||"");
    filters.periodId=filters.periodoId;
    var result=null;
    if(typeof con.buildReportData==="function"){result=con.buildReportData(filters);}
    else if(typeof con.build==="function"){result=con.build(filters);}
    else if(typeof con.report==="function"){result=con.report(filters);}
    result=result||{};
    if(result&&typeof result.then==="function"){throw new Error("ConReportes debe entregar datos síncronos a RepoCore.");}
    var students=arr(result.estudiantes||result.rows||result.students);
    var requirements=arr(result.requisitos||result.requirements);
    if(!students.length&&typeof con.getStudents==="function"){students=arr(con.getStudents(filters));}
    if(!requirements.length&&typeof con.getRequirements==="function"){requirements=arr(con.getRequirements(filters));}
    return {students:students,requirements:requirements,periods:arr(result.periodos||result.periods).length?arr(result.periodos||result.periods):periodList(),source:text(result.source)||"ConReportes"};
  }
  function hydrateStudents(students,requirements){
    var index=Object.create(null);
    arr(requirements).map(normalizeRequirement).forEach(function(req){
      if(!req.cedula||!req.requisitoKey){return;}
      if(!index[req.cedula]){index[req.cedula]=[];}
      index[req.cedula].push(req);
    });
    return arr(students).map(function(input){
      var row=Object.assign({},input||{});
      var cedula=cedulaOf(row);
      var periodoId=periodOf(row);
      var related=(index[cedula]||[]).filter(function(req){return !periodoId||!req.periodoId||samePeriod(req.periodoId,periodoId);});
      row.requisitos=related.map(clone);
      related.forEach(function(req){if(req.requisitoKey){row[req.requisitoKey]=req.valor;}});
      return row;
    });
  }
  function estadoMatricula(value){return norm(value||"ACTIVO")==="retirado"?"RETIRADO":"ACTIVO";}
  function divisionOf(row){
    row=row||{};
    var list=arr(row.divisiones||row.Divisiones);
    var firstDivision=list[0]&&typeof list[0]==="object"?(list[0].nombre||list[0].label||list[0].id):list[0];
    return text(row._division||row._bl2Division||row.divisionPrincipal||row.division||row.Division||row["División"]||firstDivision||"Sin división")||"Sin división";
  }
  function valueOf(row,key){
    try{if(rules()&&typeof rules().valueOf==="function"){return rules().valueOf(row||{},key);}}catch(error){}
    if(row&&Object.prototype.hasOwnProperty.call(row,key)){return row[key];}
    var wanted=compact(key),found="";
    Object.keys(row||{}).some(function(property){if(compact(property)===wanted){found=row[property];return true;}return false;});
    return found;
  }
  function estadoCelda(value){
    try{if(rules()&&typeof rules().cellStatus==="function"){return rules().cellStatus(value);}}catch(error){}
    return ["cumple","aprobado","aprobada","si","sí","ok","1","true","x"].indexOf(norm(value))>=0?"cumple":"no_cumple";
  }
  function applicableReqs(row){
    try{if(rules()&&typeof rules().requirementsForStudent==="function"){return arr(rules().requirementsForStudent(row||{}));}}catch(error){}
    return FALLBACK_REQS.slice();
  }
  function estadoGeneral(row){
    try{
      if(rules()&&typeof rules().studentApproval==="function"){
        var approval=rules().studentApproval(row||{});
        return {id:approval.approved?"cumple":"no_cumple",label:approval.approved?"Cumple todo":"No cumple",ok:arr(approval.applicableRequirements).length-arr(approval.missingRequirements).length,no:arr(approval.missingRequirements).length,pend:0,approved:approval.approved,applicableRequirements:arr(approval.applicableRequirements),missingRequirements:arr(approval.missingRequirements)};
      }
    }catch(error){}
    var ok=0,no=0;
    applicableReqs(row).forEach(function(req){if(estadoCelda(valueOf(row,req.key))==="cumple"){ok+=1;}else{no+=1;}});
    return {id:no?"no_cumple":"cumple",label:no?"No cumple":"Cumple todo",ok:ok,no:no,pend:0,approved:no===0};
  }
  function decorate(input){
    var row=Object.assign({},input||{});
    row._cedula=cedulaOf(row);
    row._nombres=text(first(row,["_nombres","nombres","Nombres","nombre","Nombre","estudiante","Estudiante"]));
    row._carrera=text(first(row,["_carrera","nombreCarrera","NombreCarrera","nombrecarrera","carrera","Carrera","programa","Programa"]))||"SIN CARRERA";
    row._division=divisionOf(row);
    row._periodoId=periodOf(row);
    row._periodo=text(first(row,["_periodo","periodoLabel","periodoCanonicoLabel","periodo","Periodo","_periodoId"]))||row._periodoId||"SIN PERÍODO";
    row._estadoMatricula=estadoMatricula(first(row,["_estadoMatricula","estadoMatricula","EstadoMatricula","_bl2EstadoMatricula"]));
    row._estado=estadoGeneral(row);
    return row;
  }
  function filterList(list,opts){
    opts=opts||{};
    var periodId=canonicalPeriodId(opts.periodId||opts.periodoId||"");
    var division=text(opts.division||"");
    var career=text(opts.career||opts.carrera||"");
    var matricula=opts.matricula==null?"ACTIVO":text(opts.matricula);
    return arr(list).filter(function(row){
      if(matricula&&row._estadoMatricula!==matricula){return false;}
      if(periodId&&!samePeriod(row._periodoId||row._periodo,periodId)){return false;}
      if(division&&norm(row._division)!==norm(division)){return false;}
      if(career&&norm(row._carrera)!==norm(career)){return false;}
      return true;
    });
  }
  function options(values){var map=Object.create(null);arr(values).forEach(function(value){value=text(value);if(value){map[norm(value)]=value;}});return Object.keys(map).map(function(key){return map[key];}).sort(function(a,b){return a.localeCompare(b,"es");});}
  function careers(list){return options(arr(list).map(function(row){return row._carrera||"SIN CARRERA";}));}
  function divisions(list){return options(arr(list).map(function(row){return row._division||"Sin división";}));}
  function byCareer(list){
    var map=Object.create(null);
    arr(list).forEach(function(row){var key=row._carrera||"SIN CARRERA";if(!map[key]){map[key]={key:key,total:0,cumple:0,pendiente:0,no_cumple:0,avance:0};}map[key].total+=1;map[key][row._estado.id]=(map[key][row._estado.id]||0)+1;});
    Object.keys(map).forEach(function(key){map[key].avance=pct(map[key].cumple,map[key].total);});
    return Object.keys(map).map(function(key){return map[key];}).sort(function(a,b){return b.no_cumple-a.no_cumple||a.key.localeCompare(b.key,"es");});
  }
  function requirementCatalog(list){
    var map=Object.create(null);
    FALLBACK_REQS.forEach(function(req){map[compact(req.key)]=clone(req);});
    arr(list).forEach(function(row){
      applicableReqs(row).forEach(function(req){var key=text(req.key||req.id);if(key){map[compact(key)]={key:key,label:text(req.label||req.nombre||key)};}});
      arr(row.requisitos).forEach(function(req){var key=requirementKey(req);if(key&&!map[compact(key)]){map[compact(key)]={key:key,label:text(req.requisitoLabel||req.label||req.nombre||key)};}});
    });
    return Object.keys(map).map(function(key){return map[key];});
  }
  function byRequirement(list){
    return requirementCatalog(list).map(function(req){
      var result={key:req.key,label:req.label,total:0,cumple:0,pendiente:0,no_cumple:0,avance:0,atencion:0};
      arr(list).forEach(function(row){
        var applies=applicableReqs(row).some(function(item){return compact(item.key||item.id)===compact(req.key);});
        if(!applies){return;}
        result.total+=1;
        if(estadoCelda(valueOf(row,req.key))==="cumple"){result.cumple+=1;}else{result.no_cumple+=1;}
      });
      result.avance=pct(result.cumple,result.total);
      result.atencion=result.no_cumple*3+result.pendiente;
      return result;
    }).filter(function(result){return result.total>0;}).sort(function(a,b){return b.atencion-a.atencion||a.label.localeCompare(b.label,"es");});
  }
  function pendingStudents(list){return arr(list).filter(function(row){return row._estado.id!=="cumple";}).sort(function(a,b){return (b._estado.no*3+b._estado.pend)-(a._estado.no*3+a._estado.pend)||(a._nombres||"").localeCompare(b._nombres||"","es");});}
  function makeText(data){
    var k=data.kpis;
    var lines=["REPORTE DE REQUISITOS","Fecha: "+new Date(data.generatedAt).toLocaleString(),"Tipo: "+data.tipo,"Matrícula: "+(data.filters.matricula||"Todos"),"División: "+(data.filters.division||"Todas"),"","RESUMEN GENERAL","Total estudiantes: "+k.total,"Cumplen todo: "+k.cumple,"Con pendientes: "+k.pendiente,"No cumplen: "+k.no_cumple,"Avance general: "+k.avance+"%",""];
    if(data.carreras[0]){lines.push("Carrera con mayor atención: "+data.carreras[0].key+" (No cumple: "+data.carreras[0].no_cumple+")");}
    if(data.requisitos[0]){lines.push("Requisito crítico: "+data.requisitos[0].label+" (No cumple: "+data.requisitos[0].no_cumple+")");}
    lines.push("","RECOMENDACIÓN","Priorizar estudiantes activos que registran requisitos pendientes.");
    return lines.join("\n");
  }
  function makeHtml(data){return "<h1>Reporte de Requisitos</h1><pre>"+makeText(data).replace(/&/g,"&amp;").replace(/</g,"&lt;")+"</pre>";}
  function build(opts){
    opts=Object.assign({},opts||{});
    if(opts.matricula==null){opts.matricula="ACTIVO";}
    var broadFilters={periodoId:opts.periodId||opts.periodoId||"",periodId:opts.periodId||opts.periodoId||"",matricula:opts.matricula};
    var bundle=readBundle(broadFilters);
    var base=hydrateStudents(bundle.students,bundle.requirements).map(decorate);
    var list=filterList(base,opts);
    var baseForDivision=filterList(base,{periodId:opts.periodId||"",division:"",matricula:opts.matricula,career:""});
    var baseForCareer=filterList(base,{periodId:opts.periodId||"",division:opts.division||"",matricula:opts.matricula,career:""});
    var kpis={total:list.length,cumple:0,pendiente:0,no_cumple:0,avance:0};
    list.forEach(function(row){kpis[row._estado.id]=(kpis[row._estado.id]||0)+1;});
    kpis.avance=pct(kpis.cumple,kpis.total);
    var data={tipo:text(opts.tipo)||"general",generatedAt:new Date().toISOString(),kpis:kpis,carreras:byCareer(list),requisitos:byRequirement(list),pendientes:pendingStudents(list),periodList:periodList(),divisionList:divisions(baseForDivision),careerList:careers(baseForCareer),rows:list,filters:clone(opts),source:"ConReportes",version:VERSION};
    data.text=makeText(data);
    data.html=makeHtml(data);
    return data;
  }
  function source(){return "ConReportes";}

  window.RepoCore={
    version:VERSION,REQS:FALLBACK_REQS,periods:periodList,careers:careers,divisions:divisions,
    build:build,estadoCelda:estadoCelda,estadoGeneral:estadoGeneral,estadoMatricula:estadoMatricula,
    divisionOf:divisionOf,source:source,hydrateStudents:hydrateStudents
  };
})(window);

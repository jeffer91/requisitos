/* Motor de cálculos institucionales del informe PVC. */
(function(window){
  "use strict";
  var U=window.InPVCUtils;
  function pick(row,names){for(var i=0;i<names.length;i+=1){var value=row&&row[names[i]];if(value!==undefined&&value!==null&&U.text(value)!==""){return value;}}return null;}
  function normalizeStudent(row){
    row=row||{};var nart=U.number(pick(row,["nart","Notart","Nart","notaArticulo"]));var ndef=U.number(pick(row,["ndef","Notdef","Ndef","notaDefensa"]));var nfin=U.number(pick(row,["nfin","Notafinal","Nfinal","notaFinal"]));
    if(nfin==null&&nart!=null&&ndef!=null){nfin=Math.round(((nart*.70)+(ndef*.30))*100)/100;}
    var state=U.text(row.estadoPVC);if(!state){state=nfin==null?(nart==null&&ndef==null?"NO_RINDIO":"PENDIENTE"):(nfin>=7?"APROBADO":"REPROBADO");}
    return {id:U.text(row.idEstudiantePeriodo||row.studentId||row.id),cedula:U.text(row.cedula||row.numeroIdentificacion),nombre:U.text(row.nombres||row.Nombres||row.nombreCompleto||row.nombre),carrera:U.text(row.carrera||row.NombreCarrera||row.nombreCarrera)||"SIN CARRERA",nart:nart,ndef:ndef,nfin:nfin,estado:state};
  }
  function group(students){var map=Object.create(null);students.forEach(function(s){if(!map[s.carrera]){map[s.carrera]=[];}map[s.carrera].push(s);});return map;}
  function average(rows,key){var values=rows.map(function(r){return r[key];}).filter(function(v){return v!=null;});return values.length?Math.round((values.reduce(function(a,b){return a+b;},0)/values.length)*100)/100:null;}
  function count(rows,state){return rows.filter(function(r){return r.estado===state;}).length;}
  function careerSummary(career,rows){return {carrera:career,total:rows.length,unidadIntegracion:rows.length,rindieron:rows.filter(function(r){return r.nart!=null||r.ndef!=null||r.nfin!=null;}).length,aprobados:count(rows,"APROBADO"),aprobadosSupletorio:0,reprobados:count(rows,"REPROBADO"),pendientes:rows.filter(function(r){return r.estado==="PENDIENTE"||r.estado==="NO_RINDIO";}).length,noCumple:count(rows,"NO_CUMPLE_REQUISITOS"),promedioArticulo:average(rows,"nart"),promedioDefensa:average(rows,"ndef"),promedioFinal:average(rows,"nfin")};}
  function create(metadata,rawStudents){
    var students=(rawStudents||[]).map(normalizeStudent).sort(function(a,b){var c=a.carrera.localeCompare(b.carrera,"es");return c||a.nombre.localeCompare(b.nombre,"es");});var groups=group(students);var careers=Object.keys(groups).sort(function(a,b){return a.localeCompare(b,"es");}).map(function(c){return careerSummary(c,groups[c]);});
    var total=students.length,approved=count(students,"APROBADO"),failed=count(students,"REPROBADO"),noRequirements=count(students,"NO_CUMPLE_REQUISITOS"),pending=total-approved-failed-noRequirements,rend=students.filter(function(r){return r.nart!=null||r.ndef!=null||r.nfin!=null;}).length;
    var context={metadata:Object.assign({periodoId:"",periodoLabel:"",codigoInforme:"",fechaElaboracion:new Date().toISOString().slice(0,10)},metadata||{}),students:students,groups:groups,careers:careers,summary:{total:total,unidadIntegracion:total,rindieron:rend,aprobados:approved,reprobados:failed,noCumple:noRequirements,pendientes:pending,porcentajeAprobacion:U.pct(approved,total),promedioArticulo:average(students,"nart"),promedioDefensa:average(students,"ndef"),promedioFinal:average(students,"nfin")},charts:{carreras:careers.map(function(c){return {label:c.carrera,value:c.total};}),articulo:[{label:"Aprobados",value:students.filter(function(s){return s.nart!=null&&s.nart>=7;}).length},{label:"No aprobados o sin nota",value:students.filter(function(s){return s.nart==null||s.nart<7;}).length}],defensa:[{label:"Aprobados",value:students.filter(function(s){return s.ndef!=null&&s.ndef>=7;}).length},{label:"No aprobados o sin nota",value:students.filter(function(s){return s.ndef==null||s.ndef<7;}).length}],final:[{label:"Aprobados",value:approved},{label:"Reprobados",value:failed},{label:"Pendientes / no rindieron",value:pending},{label:"No cumplieron requisitos",value:noRequirements}]}};
    context.sections=(window.InPVCSections||[]).slice().sort(function(a,b){return a.order-b.order;}).map(function(section){return section.build(context);});context.ok=students.length>0;context.generatedAt=new Date().toISOString();return context;
  }
  window.InPVCModel={create:create,normalizeStudent:normalizeStudent};
})(window);

/* Inf: consolidación verificable de núcleos estructurantes.
 * Nunca confundir nota teórica/práctica de Ncomplex con un núcleo.
 * No calcular notas de los 4 controles y caso sin fórmula oficial. */
(function(window){
 "use strict";
 function text(v){return String(v==null?"":v).trim();}
 function id(row){return text(row&&(
   row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion||
   row._cedula||row.Cedula||row["Cédula"])).replace(/[^0-9A-Za-z]/g,"").toUpperCase();}
 function period(row){return text(row&&(row.periodoId||row.periodId||row.periodoCanonicoId||row._periodoId||"")).replace(/_+/g,"__");}
 function normalized(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]/g,"").toLowerCase();}
 function career(row){return text(row&&(row.NombreCarrera||row.nombreCarrera||row.carrera||row.Carrera||row.nombre_carrera||""));}
 function fullName(row){return text(row&&(row.Nombres||row.nombres||row.nombreCompleto||row.Estudiante||row.Nombre||row.nombre));}
 function value(row,names){
   for(var i=0;i<names.length;i++){var v=row&&row[names[i]];if(v!==undefined&&v!==null&&text(v)!=="")return v;}
   return null;
 }
 function grade(v){
   if(v===null||v===undefined||text(v)==="")return null;
   var n=Number(text(v).replace(",","."));
   return Number.isFinite(n)&&n>=0&&n<=10?Math.round(n*100)/100:null;
 }
 function nucleusEntries(row){
   var nested=row.nucleos||row.nucleosEstructurantes||row.calificacionesNucleos||
     row.notasNucleos||row.nuclei||null;
   var items=[];
   if(Array.isArray(nested)){
     nested.forEach(function(item,i){items.push({num:Number(value(item,["nucleo","numeroNucleo","numero","number"])||i+1),raw:item});});
   }else if(nested&&typeof nested==="object"){
     Object.keys(nested).forEach(function(k){
       var n=Number(k.replace(/[^0-9]/g,""));if(n>=1&&n<=4)items.push({num:n,raw:nested[k]});
     });
   }
   if(!items.length){
     for(var n=1;n<=4;n++){
       var block=row["nucleo"+n]||row["Nucleo"+n]||row["núcleo"+n];
       if(block&&typeof block==="object"){items.push({num:n,raw:block});}
     }
     var single=Number(value(row,["nucleoNumero","numeroNucleo","nucleo","núcleo"]));
     if(single>=1&&single<=4&&(
       text(row.origen||row.tipo||row.fuente).toLowerCase().includes("nucle")||
       text(row.tipoEvaluacion||"").toLowerCase().includes("nucle"))){
       items.push({num:single,raw:row});
     }
   }
   return items.filter(function(x){return Number.isInteger(x.num)&&x.num>=1&&x.num<=4&&x.raw&&typeof x.raw==="object";})
    .map(function(x){
      var source=x.raw,ev=(Array.isArray(source.evaluaciones)?source.evaluaciones:[]);
      var controls=[1,2,3,4].map(function(n){
        return grade(value(source,["evaluacion"+n,"evaluación"+n,"notaEvaluacion"+n,"nota"+n,"e"+n])||ev[n-1]);
      });
      var caseGrade=grade(value(source,["casoEstudio","notaCasoEstudio","notaCaso","caso"]));
      var final=grade(value(source,["notaFinal","promedioFinal","promedioNucleo","calificacionFinal","notaNucleo"]));
      if(final===null&&controls.every(function(v){return v===null;})&&caseGrade===null)return null;
      return {number:x.num,evaluations:controls,caseGrade:caseGrade,finalGrade:final,
        source:text(source.fuente||source.origen||row.origen||"registro BDLocal")};
    }).filter(Boolean);
 }
 function build(snapshot,knownCareers){
   snapshot=snapshot||{};var rows=Array.isArray(snapshot.students)?snapshot.students:[];
   var people=Object.create(null);(snapshot.persons||[]).forEach(function(r){if(id(r))people[id(r)]=r;});
   var byIdentity=Object.create(null);
   rows.forEach(function(r){var key=id(r);if(key&&!byIdentity[key])byIdentity[key]=r;});
   var labels=Object.create(null);
   (knownCareers||[]).forEach(function(c){labels[normalized(c.career)]=c.career;});
   function label(name){return labels[normalized(name)]||text(name)||"Carrera no identificada";}
   var groups=Object.create(null),unknown=0,accepted=0;
   Object.keys(byIdentity).forEach(function(key){
     var row=byIdentity[key],c=label(career(row)),person=people[key],name=fullName(row)||fullName(person)||"Nombre no disponible";
     var group=groups[c]||(groups[c]={career:c,students:[],nuclei:[1,2,3,4].map(function(n){return {number:n,rows:[],average:null,graded:0};})});
     group.students.push({cedula:key,name:name});
   });
   var entries=(snapshot.nuclei||[]).concat(snapshot.notes||[]);
   var candidates=Object.create(null);
   entries.forEach(function(row){
     var key=id(row);if(!key||!byIdentity[key])return;
     var actualPeriod=period(row),selected=text(snapshot.periodoId).replace(/_+/g,"__");
     if(actualPeriod&&selected&&actualPeriod!==selected)return;
     var parsed=nucleusEntries(row);
     parsed.forEach(function(n){
       var candidate=key+"|"+n.number,score=(n.finalGrade!==null?10:0)+
        n.evaluations.filter(function(v){return v!==null;}).length+(n.caseGrade!==null?1:0);
       var current=candidates[candidate];
       if(!current||score>current.score)candidates[candidate]={n:n,score:score,key:key};
     });
   });
   Object.keys(candidates).forEach(function(key){
     var found=candidates[key],student=byIdentity[found.key],c=label(career(student)),g=groups[c];
     if(!g){unknown++;return;}
     var n=found.n,entry=g.nuclei[n.number-1];
     entry.rows.push({cedula:found.key,name:fullName(student)||fullName(people[found.key])||"Nombre no disponible",
       evaluations:n.evaluations,caseGrade:n.caseGrade,finalGrade:n.finalGrade,source:n.source});
     accepted++;
   });
   Object.keys(groups).forEach(function(c){
     var group=groups[c];group.students.sort(function(a,b){return a.name.localeCompare(b.name,"es");});
     group.nuclei.forEach(function(n){
       n.rows.sort(function(a,b){return a.name.localeCompare(b.name,"es");});
       var grades=n.rows.map(function(r){return r.finalGrade;}).filter(function(v){return v!==null;});
       n.graded=grades.length;
       n.average=grades.length?Math.round(grades.reduce(function(a,b){return a+b;},0)/grades.length*100)/100:null;
     });
   });
   var arr=Object.keys(groups).sort(function(a,b){return a.localeCompare(b,"es");}).map(function(k){return groups[k];});
   var withGrades=arr.reduce(function(sum,g){return sum+g.nuclei.reduce(function(s,n){return s+n.graded;},0);},0);
   return {periodoId:text(snapshot.periodoId),source:snapshot.source||"",readOnly:true,
    dataAvailable:accepted>0,students: Object.keys(byIdentity).length,
    observations:accepted,gradedNucleusRecords:withGrades,unmatched:unknown,
    careers:arr,missingGradeSource:accepted===0,
    note:"Los promedios se calculan solo con notas finales por núcleo registradas; no se deducen de controles parciales ni del examen complexivo."};
 }
 window.InfResults=Object.freeze({build:build,nucleusEntries:nucleusEntries});
})(window);

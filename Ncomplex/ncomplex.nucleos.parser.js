/* Carga de notas Moodle: NO calcula ponderaciones no verificadas.
 * Las cuatro evaluaciones, taller, prueba y total de Moodle son datos separados. */
(function(w){"use strict";
function txt(v){return String(v==null?"":v).trim();}
function normal(v){return txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9]+/g," ").replace(/\s+/g," ").trim().toLowerCase();}
function fingerprint(v){return normal(v).split(" ").filter(Boolean).sort().join("|");}
function num(v){
 if(v===null||v===undefined||txt(v)===""||txt(v)==="-")return null;
 var n=Number(txt(v).replace(",","."));
 return Number.isFinite(n)&&n>=0&&n<=10?Math.round(n*100)/100:null;
}
function splitInput(input){
 var source=String(input==null?"":input).replace(/\r\n?/g,"\n").replace(/\u00a0/g," ");
 var list=[];
 source.split("\n").forEach(function(line){
  if(/^\s*\|.*\|\s*$/.test(line)){
   line.trim().slice(1,-1).split("|").forEach(function(t){list.push(txt(t));});
  }else line.split("\t").forEach(function(t){list.push(txt(t));});
 });
 return list.filter(function(t){return !!t && !/^:?-{3,}:?$/.test(t);});
}
function role(value){
 var key=normal(value);
 if(/^(cuestionario|tarea|actividad|quiz|evaluacion)/.test(key)){
  var parcial=key.match(/evaluacion parcial ([1-4])\b/);
  if(parcial)return "e"+parcial[1];
  var roman=key.match(/evaluacion parcial (i|ii|iii|iv)$/);
  if(roman)return "e"+({i:1,ii:2,iii:3,iv:4}[roman[1]]);
  if(/taller practico(?: 1)?$/.test(key))return "taller";
  if(/caso de estudio$/.test(key))return "casoEstudio";
  if(/prueba$/.test(key))return "prueba";
  return key.length>12?"extra:"+key:"desconocida";
 }
 if(/^(media de calificaciones|suma|total)\s*total del curso/.test(key))return "totalMoodle";
 return "";
}
function email(v){return /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i.test(txt(v));}
function grade(v){return v==="-"||/^\d+(?:[.,]\d+)?$/.test(txt(v));}
function nameAt(list,index){
 for(var i=index-1;i>=0&&i>index-9;i--){
  var t=txt(list[i]),k=normal(t);
  if(email(t))break;
  if(!t||/^(nombre|direccion de correo|participantes|mostrando|buscar usuarios|curso|configuracion|cuestionario)/.test(k))continue;
  if(grade(t)||role(t)||/^[A-Z]{1,3}$/.test(t))continue;
  if(t.split(/\s+/).length>=2)return t;
 }
 return "";
}
function parse(input){
 var parts=splitInput(input),indices=[],warnings=[],errors=[];
 parts.forEach(function(item,i){if(email(item))indices.push(i);});
 if(!indices.length)return {ok:false,rows:[],headers:[],course:"",warnings:[],errors:["No se detectaron correos de estudiantes."]};
 var head=parts.slice(0,indices[0]);
 var headers=head.map(role).filter(Boolean);
 var expected=["e1","e2","e3","e4"];
 expected.forEach(function(k){if(headers.indexOf(k)<0)errors.push("Falta la columna "+k.toUpperCase()+".");});
 if(headers.indexOf("totalMoodle")<0)warnings.push("No se encontró Total del curso: se conservarán las actividades sin inventar nota final.");
 if(headers.some(function(h){return h==="desconocida";}))errors.push("Hay columnas de Moodle sin identificar; no se desplazarán las notas.");
 if(headers.some(function(h){return h.indexOf("extra:")===0;}))
  warnings.push("Se conservaron actividades adicionales sin atribuirles una ponderación inventada.");
 var courses=head.filter(function(t){return /\b(t-?nucleo)\b|\bnucleo\s*[-:]/i.test(normal(t));});
 var course=courses[0]||head.find(function(t){return /^\s*T-NUCLEO/i.test(t);})||"";
 var rows=[];
 indices.forEach(function(pos,i){
  var end=i+1<indices.length?indices[i+1]:parts.length,tail=parts.slice(pos+1,end);
  var vals=[];
  for(var j=0;j<tail.length;j++){
   var t=txt(tail[j]);
   if(/promedio general/i.test(t))break;
   if(grade(t))vals.push(t);
   else if(vals.length>=headers.length)break;
  }
  var issues=[];
  if(headers.length!==vals.length)issues.push("Columnas desalineadas: "+vals.length+" notas frente a "+headers.length+" encabezados.");
  if(errors.length)issues.push(errors.join(" "));
  var out={rowNumber:i+1,nombreCompleto:nameAt(parts,pos),correo:parts[pos].toLowerCase(),cedula:"",
   evaluaciones:[null,null,null,null],taller:null,prueba:null,casoEstudio:null,
   actividadesAdicionales:[],totalMoodle:null,
   rawValues:vals.slice(),issues:issues};
  headers.forEach(function(k,c){
   var value=vals[c],parsed=num(value);
   if(value!==undefined && value!=="-" && parsed===null)out.issues.push(k+": valor inválido o fuera de 0–10.");
   if(/^e[1-4]$/.test(k))out.evaluaciones[Number(k.slice(1))-1]=parsed;
   else if(k==="taller"||k==="prueba"||k==="casoEstudio"||k==="totalMoodle")out[k]=parsed;
   else if(k.indexOf("extra:")===0)out.actividadesAdicionales.push({actividad:k.slice(6),nota:parsed});
  });
  if(!out.nombreCompleto)out.issues.push("Nombre sin identificar.");
  out.blocked=out.issues.length>0;
  rows.push(out);
 });
 return {ok:rows.length>0&&errors.length===0,format:"moodle_nucleos",course:course,
  headers:headers,rows:rows,total:rows.length,errors:errors,warnings:warnings};
}
function uniqueMap(rows,fn){
 var out=Object.create(null);
 rows.forEach(function(row){var key=fn(row);if(!key)return;(out[key]||(out[key]=[])).push(row);});
 return out;
}
function studentId(st){return txt(st.cedula||st.numeroIdentificacion||st.NumeroIdentificacion||st._cedula);}
function studentName(st){return txt(st.Nombres||st.nombres||st.nombreCompleto||st.nombre);}
function studentEmails(st){return [st.correoInstitucional,st.CorreoInstitucional,st.correoPersonal,
 st.CorreoPersonal,st.Correos,st.correo,st.Correo,st.email,st.Email,
 st.direccionCorreo,st.direccionCorreoInstitucional].filter(Boolean).map(function(v){return txt(v).toLowerCase();});}
function match(rows,students,overrides){
 overrides=overrides||{};
 students=Array.isArray(students)?students:[];
 var byCed=uniqueMap(students,studentId),byName=uniqueMap(students,function(st){return fingerprint(studentName(st));}),byMail=Object.create(null),seen=Object.create(null),matched=[],review=[];
 students.forEach(function(st){studentEmails(st).forEach(function(mail){(byMail[mail]||(byMail[mail]=[])).push(st);});});
 function distinct(list){var found=Object.create(null);return (list||[]).filter(function(st){
 var ced=studentId(st);
 // Dos carreras o modalidades de una misma persona no son una sola matrícula.
 var matricula=[txt(st.idEstudiantePeriodo||st.studentId||st.id),ced,
  txt(st.CodigoCarrera||st.codigoCarrera||st.NombreCarrera||st.nombreCarrera),
  txt(st.modalidadEstudio||st.Modalidad||st.tipoModalidad)].join("|");
 if(!ced||found[matricula])return false;found[matricula]=true;return true;
});}
 rows.forEach(function(row){
  if(row.blocked){review.push({row:row,reason:row.issues.join(" | ")});return;}
  var emailStudents=distinct(byMail[txt(row.correo).toLowerCase()]),name=txt(row.nombreCompleto),nameMatches=distinct(byName[fingerprint(name)]);
  if(!nameMatches.length && name.split(/\s+/)[0].length>=5){
   for(var i=1;i<=3;i++){
    var tokens=name.split(/\s+/);tokens[0]=tokens[0].slice(i);
    var options=distinct(byName[fingerprint(tokens.join(" "))]);if(options.length===1){nameMatches=options;break;}
   }
  }
  var selected=txt(overrides[String(row.rowNumber)]);
  var found=null,manual=false;
  if(selected){
   var verified=distinct(byCed[selected]);
   if(verified.length===1){found=verified[0];manual=true;}
   else {review.push({row:row,reason:"La cédula seleccionada no identifica una matrícula única."});return;}
  }
  if(row.cedula&&!found){
   var ident=distinct(byCed[txt(row.cedula)]);if(ident.length===1)found=ident[0];
  }
  if(!found&&emailStudents.length===1)found=emailStudents[0];
  if(!found&&!emailStudents.length&&nameMatches.length===1)found=nameMatches[0];
  if(!found){review.push({row:row,reason:"Estudiante no encontrado o coincidencia ambigua."});return;}
  if(!manual&&(emailStudents.length>1 || nameMatches.length>1 ||
    (emailStudents.length===1 && nameMatches.length===1 && studentId(emailStudents[0])!==studentId(nameMatches[0])))){
   review.push({row:row,reason:"El correo y el nombre no coinciden de manera unívoca."});return;
  }
  var key=studentId(found);
  seen[key]=(seen[key]||0)+1;
  matched.push({student:found,imported:row,matchMethod:manual?"manual":"verificado"});
 });
 var duplicates=Object.create(null);
 matched.forEach(function(item){if(seen[studentId(item.student)]>1)
  (duplicates[studentId(item.student)]||(duplicates[studentId(item.student)]=[])).push(item);
 });
 var choices=overrides._rows||{},accepted=[];
 matched.forEach(function(item){
  var ced=studentId(item.student),repeated=duplicates[ced];
  if(!repeated){accepted.push(item);return;}
  var selected=Number(choices[ced]);
  if(!selected || !repeated.some(function(other){return other.imported.rowNumber===selected;})){
   review.push({row:item.imported,cedula:ced,candidates:repeated.map(function(c){return c.imported;}),
    reason:"Dos o más registros Moodle para la misma matrícula. Elige cuál conservar."});return;
  }
  if(item.imported.rowNumber===selected)accepted.push(item);
 });
 return {matches:accepted,review:review,duplicates:duplicates,total:rows.length,
   matched:accepted.length,pending:review.length};
}
function detect(course,catalog){
 var label=normal(course);
 if(!label)return [];
 return (catalog||[]).map(function(c){
  var candidates=(c.nuclei||[]).filter(function(n){return normal(n.name).length>=5 &&
   (label.includes(normal(n.name))||normal(n.name).includes(label.replace(/^t nucleo/,"").trim())&&label.length>12);});
  return candidates.map(function(n){return {career:c.career,number:n.number,name:n.name};});
 }).reduce(function(a,b){return a.concat(b);},[]);
}
w.NcomplexNucleosParser=Object.freeze({parse:parse,match:match,num:num,detect:detect,fingerprint:fingerprint});
})(window);

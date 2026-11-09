/* =========================================================
Nombre completo: trabajo.parser.js
Ruta: /Trabajo/trabajo.parser.js
Función:
- Leer el texto copiado de una o varias actas SENESCYT de trabajo de titulación
  (bloques que empiezan con «Nombres: Cedula: Código de Carrera: Carrera:»).
- Extraer todo: estudiante, acta, tutor, lector, vocales, criterios y promedios.
- Recalcular cada subtotal y la nota final (60 % escrito + 40 % defensa oral)
  y rechazar el acta si el texto copiado no cuadra con lo que dice el acta.
- No escribe nada: solo devuelve datos y errores.
========================================================= */
(function(root){
  "use strict";

  var VERSION="1.0.0-acta-senescyt";
  var TOLERANCE=0.011;        // subtotales con 2 decimales
  var FINAL_TOLERANCE=0.051;  // la nota final del acta viene redondeada a 1 decimal
  var CARGOS=["PRIMER VOCAL","SEGUNDO VOCAL","TERCER VOCAL"];

  function text(value){return String(value==null?"":value).trim();}
  function norm(value){
    return text(value).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ").toUpperCase();
  }
  function number(value){
    var match=text(value).match(/^-?\d+(?:[.,]\d+)?$/);
    return match?Number(match[0].replace(",",".")):null;
  }
  function round(value,digits){var f=Math.pow(10,digits||2);return Math.round((value+Number.EPSILON)*f)/f;}
  function close(a,b,tolerance){return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=(tolerance||TOLERANCE);}
  function cedula(value){var raw=text(value).replace(/\D/g,"");return /^\d{9}$/.test(raw)?"0"+raw:raw;}
  function isoDate(value){
    var m=text(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(!m){return "";}
    var d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]);
    var date=new Date(Date.UTC(y,mo-1,d));
    if(date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d){return "";}
    return y+"-"+String(mo).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  }
  function hash(value){
    var h=2166136261,s=String(value||"");
    for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return "t"+(h>>>0).toString(16).padStart(8,"0");
  }

  function lines(raw){return String(raw==null?"":raw).replace(/\r\n?/g,"\n").split("\n");}
  function nonEmptyAfter(list,index){
    for(var i=index+1;i<list.length;i++){if(text(list[i])){return {value:text(list[i]),index:i};}}
    return {value:"",index:-1};
  }
  // Valor de una etiqueta: en la misma línea tras el tabulador, o en la siguiente línea con contenido.
  function labeled(list,pattern){
    for(var i=0;i<list.length;i++){
      if(pattern.test(norm(list[i]))){
        var parts=list[i].split("\t");
        var rest=text(parts.slice(1).join(" "));
        if(rest){return rest;}
        return nonEmptyAfter(list,i).value;
      }
    }
    return "";
  }
  function findIndex(list,pattern,from){
    for(var i=from||0;i<list.length;i++){if(pattern.test(norm(list[i]))){return i;}}
    return -1;
  }

  function splitBlocks(raw){
    var all=lines(raw),starts=[];
    all.forEach(function(line,index){if(/^NOMBRES:/.test(norm(line))){starts.push(index);}});
    return starts.map(function(start,i){return all.slice(start,i+1<starts.length?starts[i+1]:all.length);});
  }

  function readSection(list,startPattern,endPattern,label,errors){
    var start=findIndex(list,startPattern),end=start<0?-1:findIndex(list,endPattern,start+1);
    if(start<0||end<0){errors.push("No se encontró la sección "+label+".");return null;}
    var criterios=[],totals=[],current=null;
    for(var i=start+1;i<end;i++){
      var line=list[i];if(!text(line)){continue;}
      var parts=line.split("\t").map(text).filter(Boolean);
      if(parts.length>=2&&number(parts[0])===null&&number(parts[1])!==null){
        current={criterio:parts[0],puntajeMaximo:number(parts[1]),notas:[]};
        criterios.push(current);continue;
      }
      var value=number(line);
      if(value===null){errors.push(label+": línea no reconocida «"+text(line).slice(0,60)+"».");continue;}
      if(current&&current.notas.length<3){current.notas.push(value);}else{totals.push(value);}
    }
    if(criterios.length!==4){errors.push(label+": se esperaban 4 criterios y se leyeron "+criterios.length+".");}
    criterios.forEach(function(c){
      if(c.notas.length!==3){errors.push(label+" · "+c.criterio+": faltan notas de los 3 vocales.");return;}
      c.notas.forEach(function(n,k){
        if(n<0||n>c.puntajeMaximo+1e-9){errors.push(label+" · "+c.criterio+": "+CARGOS[k].toLowerCase()+" puso "+n+" sobre "+c.puntajeMaximo+".");}
      });
    });
    var maxSum=round(criterios.reduce(function(a,c){return a+(c.puntajeMaximo||0);},0),2);
    if(criterios.length===4&&maxSum!==10){errors.push(label+": los puntajes máximos suman "+maxSum+", no 10.");}
    if(totals.length!==3){errors.push(label+": se esperaban 3 totales por vocal y se leyeron "+totals.length+".");}
    var computed=[0,1,2].map(function(k){
      return round(criterios.reduce(function(a,c){return a+(Number.isFinite(c.notas[k])?c.notas[k]:0);},0),2);
    });
    computed.forEach(function(sum,k){
      if(totals.length===3&&!close(sum,totals[k])){
        errors.push(label+": el total del "+CARGOS[k].toLowerCase()+" dice "+totals[k]+" pero sus criterios suman "+sum+".");
      }
    });
    return {criterios:criterios,totalesPorVocal:totals.length===3?totals:computed,
      promedio:round((computed[0]+computed[1]+computed[2])/3,2)};
  }

  function parseBlock(list,index){
    var errors=[],warnings=[];
    var headerIndex=findIndex(list,/^NOMBRES:/);
    var header=nonEmptyAfter(list,headerIndex).value.split("\t").map(text);
    var acta={
      indice:index+1,
      nombres:header[0]||"",cedula:cedula(header[1]),codigoCarrera:text(header[2]).toUpperCase(),nombreCarrera:header[3]||"",
      numeroActaSenescyt:text(labeled(list,/^NUMERO DE ACTA DE GRADO:/)).replace(/\D/g,""),
      fechaActaGradoTexto:labeled(list,/^FECHA ACTA DE GRADO:/)
    };
    acta.fechaActaGrado=isoDate(acta.fechaActaGradoTexto);
    acta.calificacionTutor=number(labeled(list,/^CALIFICACION TUTOR:/));
    acta.calificacionLector=number(labeled(list,/^CALIFICACION LECTOR:/));
    var escritoCabecera=number(labeled(list,/^PROMEDIO TRABAJO ESCRITO:/));
    acta.promedioTrabajoEscrito=number(labeled(list,/^1\. PROMEDIO TRABAJO ESCRITO/));
    acta.promedioEvaluacionPractica=number(labeled(list,/^2\. PROMEDIO EVALUACION PRACTICA/));
    acta.promedioEvaluacionDefensa=number(labeled(list,/^3\. PROMEDIO EVALUACION DEFENSA/));
    acta.promedioDefensaOral=number(labeled(list,/^4\. PROMEDIO DEFENSA ORAL/));
    acta.notaFinal=number(labeled(list,/^5\. CALIFICACION FINAL/));

    // Vocales: el nombre está en la línea siguiente a «PRIMER/SEGUNDO/TERCER VOCAL».
    acta.vocales=CARGOS.map(function(cargo,k){
      var at=findIndex(list,new RegExp(cargo+"\\s*$"));
      var name=at<0?"":text(nonEmptyAfter(list,at).value.split("\t")[0]);
      if(!name||/VOCAL$/.test(norm(name))){errors.push("No se leyó el nombre del "+cargo.toLowerCase()+".");}
      return {orden:k+1,cargo:cargo,nombre:name};
    });

    var practica=readSection(list,/^EVALUACION PRACTICA$/,/^EVALUACION DE LA DEFENSA$/,"Evaluación práctica",errors);
    var defensa=readSection(list,/^EVALUACION DE LA DEFENSA$/,/^1\. PROMEDIO TRABAJO ESCRITO/,"Evaluación de la defensa",errors);
    acta.evaluacionPractica=practica?{criterios:practica.criterios,totalesPorVocal:practica.totalesPorVocal}:null;
    acta.evaluacionDefensa=defensa?{criterios:defensa.criterios,totalesPorVocal:defensa.totalesPorVocal}:null;

    // Datos básicos.
    if(!/^\d{10}$/.test(acta.cedula)){errors.push("Cédula inválida: «"+(header[1]||"")+"».");}
    if(!acta.nombres){errors.push("Falta el nombre del estudiante.");}
    if(!/^[0-9A-Z]+-[A-Z]-\d+$/.test(acta.codigoCarrera)){warnings.push("Código de carrera con formato no habitual: «"+acta.codigoCarrera+"».");}
    if(!acta.numeroActaSenescyt){errors.push("Falta el número de acta de grado.");}
    if(!acta.fechaActaGrado){errors.push("Fecha de acta inválida: «"+acta.fechaActaGradoTexto+"».");}
    ["calificacionTutor","calificacionLector","promedioTrabajoEscrito","promedioEvaluacionPractica",
     "promedioEvaluacionDefensa","promedioDefensaOral","notaFinal"].forEach(function(field){
      var v=acta[field];
      if(v===null||v<0||v>10){errors.push("Falta o es inválido: "+field+".");}
    });

    // Recalcular el acta completa.
    if(errors.length===0){
      var escrito=round((acta.calificacionTutor+acta.calificacionLector)/2,2);
      if(!close(escrito,acta.promedioTrabajoEscrito)){errors.push("Trabajo escrito: (tutor + lector) / 2 = "+escrito+", el acta dice "+acta.promedioTrabajoEscrito+".");}
      if(escritoCabecera!==null&&!close(escritoCabecera,acta.promedioTrabajoEscrito)){errors.push("El promedio del trabajo escrito no coincide entre la cabecera y el resumen.");}
      if(practica&&!close(practica.promedio,acta.promedioEvaluacionPractica)){errors.push("Evaluación práctica: el promedio de los vocales es "+practica.promedio+", el acta dice "+acta.promedioEvaluacionPractica+".");}
      if(defensa&&!close(defensa.promedio,acta.promedioEvaluacionDefensa)){errors.push("Evaluación de la defensa: el promedio de los vocales es "+defensa.promedio+", el acta dice "+acta.promedioEvaluacionDefensa+".");}
      var oral=round((acta.promedioEvaluacionPractica+acta.promedioEvaluacionDefensa)/2,2);
      if(!close(oral,acta.promedioDefensaOral)){errors.push("Defensa oral: (práctica + defensa) / 2 = "+oral+", el acta dice "+acta.promedioDefensaOral+".");}
      acta.notaFinalCalculada=round(acta.promedioTrabajoEscrito*0.6+acta.promedioDefensaOral*0.4,2);
      if(!close(acta.notaFinalCalculada,acta.notaFinal,FINAL_TOLERANCE)){
        errors.push("Nota final: 60 % escrito + 40 % defensa oral = "+acta.notaFinalCalculada+", el acta dice "+acta.notaFinal+".");
      }
    }
    acta.textoOriginalHash=hash(list.join("\n").trim());
    return {ok:errors.length===0,acta:acta,errors:errors,warnings:warnings};
  }

  function parse(raw){
    var blocks=splitBlocks(raw);
    var results=blocks.map(parseBlock);
    var seenActa=Object.create(null),seenCedula=Object.create(null);
    results.forEach(function(r){
      var a=r.acta;
      if(a.numeroActaSenescyt){
        if(seenActa[a.numeroActaSenescyt]&&seenActa[a.numeroActaSenescyt]!==a.cedula){
          r.errors.push("El acta "+a.numeroActaSenescyt+" aparece también para otra cédula ("+seenActa[a.numeroActaSenescyt]+").");r.ok=false;
        }
        seenActa[a.numeroActaSenescyt]=a.cedula;
      }
      if(a.cedula){
        if(seenCedula[a.cedula]){r.errors.push("La cédula "+a.cedula+" está repetida en lo pegado.");r.ok=false;}
        seenCedula[a.cedula]=true;
      }
    });
    return {version:VERSION,total:results.length,validas:results.filter(function(r){return r.ok;}).length,actas:results};
  }

  var api={version:VERSION,parse:parse,parseBlock:parseBlock,isoDate:isoDate,hash:hash};
  root.TrabajoParser=api;
  if(typeof module!=="undefined"&&module.exports){module.exports=api;}
})(typeof window!=="undefined"?window:globalThis);

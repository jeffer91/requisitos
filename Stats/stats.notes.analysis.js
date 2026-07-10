/* =========================================================
Nombre completo: stats.notes.analysis.js
Ruta o ubicación: /Requisitos/Stats/stats.notes.analysis.js
Función o funciones:
- Construir análisis avanzado de notas para Stats.
- Calcular promedios por carrera, cobertura, faltantes, ranking, distribución y estudiantes con notas incompletas.
- Trabajar con las notas normalizadas que entrega stats.core.js en row._notas.
Con qué se conecta:
- stats.core.js
- stats.notes.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value==null?"":value).trim();}
  function num(value){value=Number(value);return Number.isFinite(value)?value:null;}
  function round2(value){return Number.isFinite(value)?Math.round((value+Number.EPSILON)*100)/100:null;}
  function pct(value,total){return total?round2((value*100)/total):0;}
  function add(list,value){value=num(value);if(value!==null)list.push(value);}
  function avg(list){return list&&list.length?round2(list.reduce(function(a,b){return a+b;},0)/list.length):null;}
  function min(list){return list&&list.length?round2(Math.min.apply(Math,list)):null;}
  function max(list){return list&&list.length?round2(Math.max.apply(Math,list)):null;}

  function nameOf(row){return text(row&&row._nombres)||text(row&&row.Nombre)||text(row&&row.nombre)||text(row&&row.Estudiante)||"Sin nombre";}
  function idOf(row){return text(row&&row._cedula)||text(row&&row.Cedula)||text(row&&row.cedula)||text(row&&row.identificacion)||"";}
  function careerOf(row){return text(row&&row._carrera)||text(row&&row.Carrera)||text(row&&row.carrera)||"SIN CARRERA";}

  function notesOf(row){
    var notes=row&&row._notas?row._notas:{};
    return {
      nart:num(notes.nart),
      ndef:num(notes.ndef),
      nfin:num(notes.nfin)
    };
  }

  function noteState(notes){
    var hasArt=notes.nart!==null;
    var hasDef=notes.ndef!==null;
    var hasFin=notes.nfin!==null;
    if(hasArt&&hasDef&&hasFin)return "Completa";
    if(!hasArt&&!hasDef&&!hasFin)return "Sin notas";
    if(hasArt&&!hasDef)return hasFin?"Falta N-DEF":"Falta N-DEF y N-FIN";
    if(!hasArt&&hasDef)return hasFin?"Falta N-ART":"Falta N-ART y N-FIN";
    if(hasArt&&hasDef&&!hasFin)return "Falta N-FIN";
    return "Incompleta";
  }

  function makeCareerItem(career){
    return {
      carrera:career,
      total:0,
      conNart:0,
      conNdef:0,
      conNfin:0,
      sinNart:0,
      sinNdef:0,
      sinNfin:0,
      completas:0,
      incompletas:0,
      nartValues:[],
      ndefValues:[],
      nfinValues:[],
      promedioNart:null,
      promedioNdef:null,
      promedioNfin:null,
      minimaNfin:null,
      maximaNfin:null,
      coberturaNfin:0
    };
  }

  function distributionBucket(nfin){
    if(nfin===null)return "sinNota";
    if(nfin>=9)return "r9_10";
    if(nfin>=8)return "r8_899";
    if(nfin>=7)return "r7_799";
    return "menor7";
  }

  function finalizeCareer(item){
    item.sinNart=item.total-item.conNart;
    item.sinNdef=item.total-item.conNdef;
    item.sinNfin=item.total-item.conNfin;
    item.promedioNart=avg(item.nartValues);
    item.promedioNdef=avg(item.ndefValues);
    item.promedioNfin=avg(item.nfinValues);
    item.minimaNfin=min(item.nfinValues);
    item.maximaNfin=max(item.nfinValues);
    item.coberturaNfin=pct(item.conNfin,item.total);
    delete item.nartValues;
    delete item.ndefValues;
    delete item.nfinValues;
    return item;
  }

  function pickRanking(careers){
    var withAvg=careers.filter(function(item){return item.promedioNfin!==null;});
    var bestAvg=withAvg.slice().sort(function(a,b){return b.promedioNfin-a.promedioNfin;})[0]||null;
    var worstAvg=withAvg.slice().sort(function(a,b){return a.promedioNfin-b.promedioNfin;})[0]||null;
    var missingMost=careers.slice().sort(function(a,b){return b.sinNfin-a.sinNfin||b.total-a.total;})[0]||null;
    var coverageBest=careers.slice().filter(function(item){return item.total>0;}).sort(function(a,b){return b.coberturaNfin-a.coberturaNfin||b.total-a.total;})[0]||null;
    return {bestAvg:bestAvg,worstAvg:worstAvg,missingMost:missingMost,coverageBest:coverageBest};
  }

  function build(rows){
    rows=Array.isArray(rows)?rows:[];
    var careerMap={};
    var allNart=[],allNdef=[],allNfin=[];
    var distribution={r9_10:0,r8_899:0,r7_799:0,menor7:0,sinNota:0};
    var missingStudents=[];
    var completas=0;
    var incompletas=0;

    rows.forEach(function(row){
      var career=careerOf(row);
      var notes=notesOf(row);
      var state=noteState(notes);
      if(!careerMap[career])careerMap[career]=makeCareerItem(career);
      var item=careerMap[career];

      item.total++;
      if(notes.nart!==null){item.conNart++;add(item.nartValues,notes.nart);add(allNart,notes.nart);}
      if(notes.ndef!==null){item.conNdef++;add(item.ndefValues,notes.ndef);add(allNdef,notes.ndef);}
      if(notes.nfin!==null){item.conNfin++;add(item.nfinValues,notes.nfin);add(allNfin,notes.nfin);}

      if(state==="Completa"){item.completas++;completas++;}
      else{
        item.incompletas++;
        incompletas++;
        missingStudents.push({nombre:nameOf(row),cedula:idOf(row),carrera:career,nart:notes.nart,ndef:notes.ndef,nfin:notes.nfin,estado:state});
      }

      distribution[distributionBucket(notes.nfin)]++;
    });

    var careers=Object.keys(careerMap).map(function(key){return finalizeCareer(careerMap[key]);}).sort(function(a,b){return b.total-a.total||a.carrera.localeCompare(b.carrera,"es");});
    var summary={
      total:rows.length,
      conNart:allNart.length,
      conNdef:allNdef.length,
      conNota:allNfin.length,
      sinNota:rows.length-allNfin.length,
      completas:completas,
      incompletas:incompletas,
      promedioNart:avg(allNart),
      promedioNdef:avg(allNdef),
      promedio:avg(allNfin),
      minima:min(allNfin),
      maxima:max(allNfin),
      coberturaNfin:pct(allNfin.length,rows.length)
    };

    return {
      resumen:summary,
      carreras:careers,
      ranking:pickRanking(careers),
      distribucion:distribution,
      estudiantesIncompletos:missingStudents.sort(function(a,b){return a.carrera.localeCompare(b.carrera,"es")||a.nombre.localeCompare(b.nombre,"es");})
    };
  }

  window.StatsNotesAnalysis={build:build,noteState:noteState,notesOf:notesOf};
})(window);

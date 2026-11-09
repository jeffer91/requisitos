/* =========================================================
Nombre completo: complexivo.moodle.js
Ruta: /Complexivo/complexivo.moodle.js
Función:
- Motor propio de lectura del libro de calificaciones de Moodle del Examen
  Complexivo (Notas → Complexivo). No depende de Ncomplex.
- Acepta uno o varios libros pegados juntos: cada uno empieza con su título
  «Examen Complexivo <Carrera> <mes> <mes> <año>]».
- Reconoce las columnas por su encabezado, no por posición:
    Cuestionario … TEÓRICO …            → teórico ordinario
    Cuestionario … PRACTICO …           → práctico ordinario
    … SUPLETORIO / … VERSIÓN 2          → supletorio
    Media de calificaciones / Suma      → totales de Moodle (se ignoran:
                                          la app calcula las ponderaciones)
- Escala de Moodle 0–100 → escala oficial 0–10.
- «-» = no rindió · «0,00» = nota real · líneas en blanco = ruido de Moodle.
- No escribe nada: solo devuelve datos y errores.
========================================================= */
(function(root){
  "use strict";

  var VERSION="1.0.0-moodle-complexivo";
  var MONTHS={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12,
    ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,sept:9,oct:10,nov:11,dic:12};

  function text(value){return String(value==null?"":value).replace(/ /g," ").trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ").toUpperCase();}
  function round(value){return Math.round((value+Number.EPSILON)*100)/100;}
  function isEmail(value){return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(text(value));}
  function pad(n){return String(n).padStart(2,"0");}

  function isTitle(line){return /^EXAMEN COMPLEXIVO\b/.test(norm(line))&&/\]\s*$/.test(text(line))&&!/MOSTRANDO/.test(norm(line));}

  // «Examen Complexivo Educación Básica octubre marzo 2026]» → carrera y período.
  function readTitle(line){
    var raw=text(line).replace(/\]\s*$/,"").replace(/^examen complexivo\s*/i,"");
    var words=raw.split(/\s+/),year=null,months=[],cut=words.length;
    for(var i=words.length-1;i>=0;i--){
      var w=norm(words[i]).toLowerCase();
      if(/^20\d{2}$/.test(w)&&year===null&&months.length===0){year=Number(w);cut=i;continue;}
      if(MONTHS[w]&&months.length<2){months.unshift(MONTHS[w]);cut=i;continue;}
      if(/^(A|AL|-|–)$/i.test(w)&&months.length===1){cut=i;continue;}
      break;
    }
    var career=words.slice(0,cut).join(" ").trim(),periodoId="";
    if(year&&months.length===2){
      var start=months[0],end=months[1];
      var startYear=start>end?year-1:year;
      periodoId=startYear+"-"+pad(start)+"__"+year+"-"+pad(end);
    }
    return {titulo:text(line),carrera:career,periodoId:periodoId};
  }

  function classify(header){
    var h=norm(header);
    if(/^MEDIA DE CALIFICACIONES|^SUMA/.test(h)){return {kind:"total",label:text(header)};}
    if(!/^CUESTIONARIO/.test(h)){return {kind:"desconocida",label:text(header)};}
    var component=/TEORIC/.test(h)?"teorico":/PRACTIC/.test(h)?"practico":"";
    var supletorio=/SUPLETORIO|VERSION\s*2/.test(h);
    return {kind:component?"nota":"desconocida",component:component,oportunidad:supletorio?"supletorio":"ordinaria",label:text(header).replace(/^Cuestionario/i,"").trim()};
  }

  // Valor de una celda Moodle: null = «-» (no rindió); número en escala 0–100.
  function cell(value){
    var t=text(value);
    if(t==="-"||t==="—"){return {empty:true,value:null};}
    var m=t.match(/^\d+(?:[.,]\d+)?$/);
    if(!m){return {invalid:true,raw:t};}
    return {value:Number(t.replace(",","."))};
  }

  function parseBook(lines,index){
    var info=readTitle(lines[0]),errors=[],warnings=[];
    var headerStart=-1;
    for(var i=0;i<lines.length;i++){if(norm(lines[i])==="DIRECCION DE CORREO"){headerStart=i+1;break;}}
    if(headerStart<0){return {indice:index+1,info:info,columnas:[],filas:[],errors:["No se encontró el encabezado «Dirección de correo»."],warnings:warnings};}
    var columns=[],cursor=headerStart;
    while(cursor<lines.length){
      var line=text(lines[cursor]);
      if(!line){cursor++;continue;}
      var c=classify(line);
      if(c.kind==="desconocida"&&!/^(CUESTIONARIO|MEDIA|SUMA)/.test(norm(line))){break;}
      columns.push(c);cursor++;
    }
    var gradeCols=columns.filter(function(c){return c.kind==="nota";});
    if(!gradeCols.some(function(c){return c.component==="teorico"&&c.oportunidad==="ordinaria";})||
       !gradeCols.some(function(c){return c.component==="practico"&&c.oportunidad==="ordinaria";})){
      errors.push("El libro no tiene las columnas del teórico y práctico ordinarios.");
    }
    columns.filter(function(c){return c.kind==="desconocida";}).forEach(function(c){errors.push("Columna no reconocida: «"+c.label+"».");});

    // Filas: nombre, correo y tantas celdas como columnas. Las líneas en blanco se ignoran.
    var body=lines.slice(cursor).map(text);
    var end=body.findIndex(function(l){return /^PROMEDIO GENERAL/.test(norm(l));});
    if(end>=0){body=body.slice(0,end);}
    body=body.filter(Boolean);
    var emailAt=[];
    body.forEach(function(l,k){if(isEmail(l)){emailAt.push(k);}});
    var filas=[];
    emailAt.forEach(function(at,k){
      var stop=k+1<emailAt.length?emailAt[k+1]-1:body.length;
      var values=body.slice(at+1,stop);
      var fila={numero:k+1,nombreMoodle:text(body[at-1]),correo:text(body[at]).toLowerCase(),
        ordinaria:{teorico:null,practico:null},supletorio:{teorico:null,practico:null},errors:[],sinRendir:true};
      if(values.length!==columns.length){
        fila.errors.push("Se esperaban "+columns.length+" valores y se leyeron "+values.length+".");
      }else{
        columns.forEach(function(col,c){
          if(col.kind!=="nota"){return;}
          var v=cell(values[c]);
          if(v.invalid){fila.errors.push(col.label+": valor no reconocido «"+v.raw+"».");return;}
          if(v.empty){return;}
          if(v.value>100){fila.errors.push(col.label+": "+v.value+" supera 100.");return;}
          fila.sinRendir=false;
          var slot=fila[col.oportunidad];
          if(slot[col.component]!==null){
            fila.errors.push("Tiene dos notas de "+col.component+" "+col.oportunidad+" (por ejemplo «Versión 2» y «Supletorio»). Revise Moodle.");return;
          }
          slot[col.component]=round(v.value/10);
        });
      }
      filas.push(fila);
    });
    if(!filas.length){errors.push("No se encontraron estudiantes (filas con correo).");}
    // Escala: Moodle publica sobre 100. Si ninguna nota supera 10 no se puede confirmar.
    var max=0;filas.forEach(function(f){["ordinaria","supletorio"].forEach(function(o){["teorico","practico"].forEach(function(p){
      if(f[o][p]!==null){max=Math.max(max,f[o][p]*10);}});});});
    if(filas.length&&max>0&&max<=10){errors.push("Todas las notas son ≤ 10: no se puede confirmar que Moodle esté en escala 0–100.");}
    if(!info.periodoId){warnings.push("No se pudo leer el período del título.");}
    return {indice:index+1,info:info,columnas:columns,filas:filas,errors:errors,warnings:warnings};
  }

  function parse(raw){
    var lines=String(raw==null?"":raw).replace(/\r\n?/g,"\n").split("\n");
    var starts=[];
    lines.forEach(function(line,i){if(isTitle(line)){starts.push(i);}});
    // El título se repite dentro del mismo libro («…]Mostrando calificaciones»); solo cuenta la línea suelta.
    var books=starts.map(function(start,i){return parseBook(lines.slice(start,i+1<starts.length?starts[i+1]:lines.length),i);});
    return {version:VERSION,libros:books,total:books.length};
  }

  var api={version:VERSION,parse:parse,readTitle:readTitle,classify:classify};
  root.ComplexivoMoodle=api;
  if(typeof module!=="undefined"&&module.exports){module.exports=api;}
})(typeof window!=="undefined"?window:globalThis);

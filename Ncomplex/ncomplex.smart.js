/* Centro Ncomplex: diagnóstico de Moodle y orientación por período/carrera/núcleo.
 * Solo autoselecciona opciones inequívocas que existan en BDLocal. */
(function(w){"use strict";
 function text(v){return String(v==null?"":v).trim();}
 function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .replace(/[^A-Za-z0-9]+/g," ").replace(/\s+/g," ").toLowerCase().trim();}
 function baseCareer(v){return norm(v).replace(/\b(?:online|on line|en linea|virtual|pvc|presencial)\b/g,"")
   .replace(/\s+/g," ").trim();}
 function periodId(input){
  var s=norm(input);
  var months={enero:"01",febrero:"02",marzo:"03",abril:"04",mayo:"05",junio:"06",
    julio:"07",agosto:"08",septiembre:"09",octubre:"10",noviembre:"11",diciembre:"12"};
  var long=s.match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(20\d{2})\s+(?:a|al|hasta)\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(20\d{2})\b/);
  if(long)return long[2]+"-"+months[long[1]]+"__"+long[4]+"-"+months[long[3]];
  var short=s.match(/\b(oct|octubre)\s*(?:a|al|mar|marzo|[-– ])*\s*(?:mar|marzo)\s*(20\d{2}|\d{2})\b/);
  if(short){var y=Number(short[2]);if(y<100)y+=2000;return (y-1)+"-10__"+y+"-03";}
  var april=s.match(/\b(?:abr|abril)\s*(?:a|al|sep|septiembre|[-– ])*\s*(?:sep|sept|septiembre)\s*(20\d{2}|\d{2})\b/);
  if(april){var a=Number(april[1]);if(a<100)a+=2000;return a+"-04__"+a+"-09";}
  return "";
 }
 function kind(raw){
  var s=norm(raw.slice(0,2800));
  var nucleus=/\bt nucleo\b/.test(s)||/evaluacion parcial [1-4]/.test(s);
  var complexivo=/\bexamen complexivo\b/.test(s)&&!(/\bt nucleo\b/.test(s));
  return nucleus&&!complexivo?"nucleos":complexivo&&!nucleus?"complexivo":
    nucleus&&complexivo?"ambiguous":"";
 }
 function careerChoices(suggested,careers,selected){
  var base=baseCareer(suggested),available=(careers||[]).filter(function(x){
   return baseCareer(x.label||x.name||x.career||x.code)===base;
  });
  var same=available.find(function(x){return x.code===selected;});
  return {options:available,selected:same?same.code:available.length===1?available[0].code:""};
 }
 function identify(raw,parsed,catalog,careers,periods,context){
  context=context||{};
  var detectedKind=kind(raw),suggestions=detectedKind==="nucleos"&&w.NcomplexNucleosParser?
   w.NcomplexNucleosParser.detect(parsed&&parsed.course||raw,catalog||[]):[];
  var unique=suggestions.length===1?suggestions[0]:null;
  var pid=periodId(raw.slice(0,1200));
  var known=(periods||[]).some(function(p){return p.id===pid;});
  var matching=unique?careerChoices(unique.career,careers,context.career):
    {options:[],selected:""};
  var reason=[];
  if(!detectedKind)reason.push("No se identificó el tipo de evaluación.");
  if(detectedKind==="ambiguous")reason.push("Hay encabezados de núcleo y complexivo mezclados.");
  if(pid&&!known)reason.push("El período anunciado por Moodle no está en BDLocal.");
  if(detectedKind==="nucleos"&&!unique)reason.push(suggestions.length?
    "El nombre del núcleo coincide con varias carreras. Confirma la carrera.":
    "No se pudo identificar de forma única el núcleo. Confirma la carrera y el núcleo.");
  if(unique&&!matching.selected)reason.push(matching.options.length>1?
    "La carrera existe en más de una modalidad. Selecciona la matrícula correcta.":
    "La carrera detectada no está en las matrículas del período.");
  return {kind:detectedKind,periodId:pid,periodKnown:known,
   suggestions:suggestions,nucleus:unique&&unique.number||0,
   nucleusName:unique&&unique.name||"",careerName:unique&&unique.career||"",
   careers:matching.options,careerId:matching.selected,issues:reason};
 }
 function nextTask(careers,students,notes,careerId,nucleus){
  var entries=(careers||[]).slice().sort(function(a,b){return (a.label||"").localeCompare(b.label||"","es");});
  if(careerId){var wanted=entries.find(function(c){return c.code===careerId;});
   if(wanted)entries=[wanted].concat(entries.filter(function(c){return c.code!==careerId;}));
  }
  for(var i=0;i<entries.length;i++){
   var target=entries[i],roster=(students||[]).filter(function(s){
    return text(s.CodigoCarrera||s.codigoCarrera||s.NombreCarrera||s.nombreCarrera)===target.code;
   });
   if(!roster.length)continue;
   for(var n=1;n<=4;n++){
    var actual=(notes||[]).filter(function(r){return r.codigoCarrera===target.code&&Number(r.nucleo)===n;});
    var complete=actual.filter(function(r){return Array.isArray(r.evaluaciones)&&r.evaluaciones.length===4&&
      r.evaluaciones.every(function(v){return v!==null&&v!==undefined;})&&r.totalMoodle!==null&&r.totalMoodle!==undefined;});
    var ids=Object.create(null);complete.forEach(function(r){ids[r.cedula]=true;});
    var done=roster.filter(function(s){return ids[text(s.cedula||s.numeroIdentificacion)];}).length;
    if(done<roster.length)return {career:target.code,name:target.label,nucleus:n,done:done,total:roster.length};
   }
  }
  return null;
 }
 w.NcomplexSmart=Object.freeze({kind:kind,identify:identify,periodId:periodId,
   baseCareer:baseCareer,careerChoices:careerChoices,nextTask:nextTask});
})(window);

/* Generador institucional PVC: vista, Word y PDF comparten el mismo contenido. */
(function(w,d){
"use strict";
function t(v){return String(v==null?"":v);}
function esc(v){return t(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function num(v){return v==null?"Sin dato":Number(v).toLocaleString("es-EC",{maximumFractionDigits:2});}
function pct(v){return v==null?"Sin dato":num(v)+" %";}
function slug(v){return t(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9]/g,"_").slice(0,68);}
function markdown(src){
 var out=[],inList=false;
 function close(){if(inList){out.push("</ul>");inList=false;}}
 t(src).replace(/\r/g,"").split("\n").forEach(function(item){
  var x=item.trim();if(!x){close();return;}
  var a=x.match(/^#{2,4}\s+(.+)/);if(a){close();out.push("<h4>"+esc(a[1])+"</h4>");return;}
  a=x.match(/^[-*]\s+(.+)/);
  if(a){if(!inList){inList=true;out.push("<ul>");}out.push("<li>"+esc(a[1]).replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")+"</li>");return;}
  close();out.push("<p>"+esc(x).replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")+"</p>");
 });close();return out.join("");
}
function legal(){
 var ids=["2.1","2.2","2.3","2.4","2.5","2.6","2.7","2.8","2.9"],out=[];
 var titles=["Constitución de la República del Ecuador","Ley Orgánica de Educación Superior","Reglamento de Régimen Académico","Normativa institucional de titulación","Reglamento General a la Ley Orgánica de Educación Superior","Aseguramiento de la calidad","Protección de datos personales","Integridad académica y propiedad intelectual","Aplicación normativa y trazabilidad"];
 ids.forEach(function(id,i){var raw=w.InfRegistry&&w.InfRegistry.textFor(id);if(raw)out.push("<h3>"+id+". "+titles[i]+"</h3>"+markdown(raw));});
 out.push("<p class='infp-small'>Verificar vigencia, reformas, numeración de artículos y aplicación institucional antes de la emisión oficial.</p>");
 return out.join("");
}
function tbl(title,cols,rows){
 return "<figure class='infp-table'><figcaption>"+esc(title)+"</figcaption><table><thead><tr>"+cols.map(function(x){return "<th>"+esc(x)+"</th>";}).join("")+"</tr></thead><tbody>"+
 rows.map(function(r){return "<tr>"+r.map(function(x){return "<td>"+esc(x)+"</td>";}).join("")+"</tr>";}).join("")+"</tbody></table></figure>";
}
function bars(title,rows,opt){
 opt=opt||{};var max=opt.max||Math.max.apply(null,[1].concat(rows.map(function(x){return x.value==null?0:x.value;})));
 return "<figure class='infp-bars'><figcaption>"+esc(title)+"</figcaption>"+rows.map(function(x){
  var width=x.value==null?0:Math.min(100,Math.max(0,x.value/max*100));
  return "<div class='infp-bar'><span>"+esc(x.label)+"</span><div><i style='width:"+width.toFixed(2)+"%'></i></div><b>"+esc(x.value==null?"Sin dato":opt.percent?pct(x.value):num(x.value))+"</b></div>";
 }).join("")+"</figure>"+(opt.note?"<p class='infp-small'>"+esc(opt.note)+"</p>":"");
}
function sect(title,html){return "<section class='infp-section'><h2>"+esc(title)+"</h2>"+html+"</section>";}
function cover(r,logo){
 return "<div class='infp-cover'><table class='infp-head'><tr><td rowspan='2' style='width:26.67%'>"+(logo?"<img class='infp-logo' src='"+esc(logo)+"' alt='ITSQMET'>":"ITSQMET")+"</td><td rowspan='2' style='width:52.77%'>Unidad de Titulación y Eficiencia Terminal</td><td style='width:20.56%'>Código: "+esc(r.code)+"</td></tr><tr><td>Versión: 1.0 (borrador)</td></tr><tr><td>Fecha: "+esc(r.fecha)+"</td><td>Informe Final del Proceso de Titulación</td><td>Página X de Y (PDF)</td></tr></table>"+
 "<div class='infp-center'><h1>INFORME FINAL DEL PROCESO DE TITULACIÓN</h1><h2>"+esc(r.periodoLabel)+"</h2><p>Consolidado académico · PVC</p></div>"+
 "<table class='infp-sign'><tr><th>ELABORADO POR</th><th>REVISADO POR</th><th>APROBADO POR</th></tr><tr class='blank'><td></td><td></td><td></td></tr>"+
 "<tr><td>Mgs. Jefferson Villarreal</td><td>Ing. Martha Tomalá</td><td>Dr. Alex León</td></tr><tr><td>Coordinador de Titulación y Eficiencia Terminal</td><td>Coordinadora General de Carreras</td><td>Vicerrector</td></tr></table></div>";
}
function contents(r){
 var s=r.counts,c=r.careers,q=r.requirements,hasReq=s.conDatosRequisitos>0,hasTit=s.conTitulacion>0;
 var funnel=(r.stages||[]).map(function(x){return {label:x.label,value:x.count};});
 var parts=[];
 parts.push(sect("Síntesis ejecutiva","<div class='infp-kpis'><div><b>"+s.total+"</b><span>Activos</span></div><div><b>"+s.evaluados+"</b><span>Con nota final</span></div><div><b>"+s.aprobados+"</b><span>Aprobados</span></div><div><b>"+pct(s.tasaGlobal)+"</b><span>Aprobación/cohorte</span></div></div>"+
 "<p>Para el período "+esc(r.periodoLabel)+" se identifican "+s.total+" matrículas activas; "+s.evaluados+" estudiantes tienen nota final, "+s.aprobados+" aprobaron, "+s.reprobados+" reprobaron y "+s.sinNota+" carecen de nota final válida. La tasa de aprobación entre evaluados es "+pct(s.tasaEvaluados)+", distinta de la tasa sobre toda la cohorte ("+pct(s.tasaGlobal)+").</p>"+
 bars("Figura 1. Embudo de habilitación y aprobación",funnel,{max:Math.max(1,s.total),note:"Los requisitos sin registro se muestran Sin dato. Solo se cuentan habilitados con cumplimiento individual confirmado."})));
 parts.push("<nav class='infp-index'><h2>Índice de contenidos</h2><ol>"+
 ["Introducción","Base legal","Metodología","Resultados y análisis","Resumen ejecutivo","Conclusiones","Recomendaciones","Referencias"].map(function(x,i){return "<li>"+(i+1)+". "+x+"</li>";}).join("")+"</ol></nav>");
 parts.push(sect("1. Introducción",
 "<h3>1.1. Contextualización del proceso</h3><p>La titulación integra la verificación de requisitos académicos y administrativos, el acompañamiento del estudiante y la evaluación de competencias alcanzadas. Su seguimiento institucional permite identificar factores asociados a la culminación de estudios y oportunidades de mejora.</p>"+
 "<h3>1.2. Objetivo general</h3><p>Evaluar los resultados del proceso PVC y los requisitos de titulación del Instituto Superior Tecnológico Quito Metropolitano para el período "+esc(r.periodoLabel)+", diferenciando población matriculada, habilitación, resultados y calidad de los registros.</p>"+
 "<h3>1.3. Alcance</h3><p>Se consideran las matrículas activas del período en la base académica consultada. El informe no modifica registros y no atribuye aprobación a estudiantes sin una calificación verificable.</p>"));
 parts.push(sect("2. Base legal",legal()));
 var list=c.map(function(x){return [x.nombre,x.total];});
 var modes=r.modes.filter(function(x){return x.n>0;}).map(function(x){return (x.id==="ARTICULO"?"Artículo académico":x.id==="TRABAJO"?"Trabajo de titulación":"Modalidad no informada")+": "+x.n;}).join("; ");
 var method="<h3>3.1. Diseño del análisis</h3><p>Estudio descriptivo, cuantitativo y documental a partir de la información institucional del período. La unidad de análisis es la matrícula única identificada mediante período y cédula; se excluyen retirados y las matrículas expresamente identificadas como Examen Complexivo.</p>"+
 "<h3>3.2. Población y fuentes</h3><p>Se analizaron "+s.total+" matrículas de "+c.length+" carreras. Modalidades identificadas: "+esc(modes||"No especificadas")+". La fuente consultada es "+esc(r.source)+".</p>"+
 tbl("Tabla 1. Carreras participantes",["Carrera","Matrículas"],list)+
 "<h3>3.3. Requisitos</h3><p>Los ocho requisitos previos se verifican individualmente: académico, documentación, financiero, prácticas, vinculación, seguimiento a graduados, inglés y actualización de datos. El requisito Titulación se presenta aparte. Los estados sin registro quedan SIN DATO, nunca se transforman en incumplimiento.</p>"+
 "<h3>3.4. Etapas del proceso PVC</h3><p>El proceso comprende inducción, cronograma, orientación metodológica, propuesta y elaboración académica, tutorías, revisiones, evaluación y defensa, registro de notas y cierre documental. No se presupone ejecución de una actividad solo porque aparezca en el cronograma.</p>"+
 "<h3>3.5. Evaluación</h3><p>En el PVC se evalúa el artículo académico: escrito (70 %) y defensa (30 %). Para aprobar se requiere un mínimo de 7,00/10 en cada componente, además del resultado ponderado. Las notas oficiales prevalecen; las diferencias con el cálculo se señalan para conciliación.</p>"+
 "<h3>3.6. Metodología específica por carrera</h3>"+
 c.map(function(x,i){return "<p><strong>3.6."+(i+1)+". "+esc(x.nombre)+".</strong> Registra "+x.total+" matrículas, "+x.habilitados+" habilitados y "+x.evaluados+" con nota final. Su participación y resultados se incluyen solo porque existen matrículas de esta carrera en el período.</p>";}).join("")+
 "<h3>3.7. Análisis estadístico</h3><p>Se calculan totales, proporciones por población definida, promedios con notas disponibles y comparaciones por carrera. Se conserva la identidad individual para conciliar las fuentes, pero los resultados públicos son agregados. No se incluyen núcleos estructurantes de Complexivo dentro de la metodología PVC.</p>";
 parts.push(sect("3. Metodología",method));
 var result="<h3>4.1. Embudo institucional</h3>"+bars("Figura 2. Etapas verificadas",funnel,{max:Math.max(1,s.total),note:"No se infiere que la diferencia entre fuentes implique reprobaciones."})+
 "<h3>4.2. Cumplimiento de requisitos</h3>"+
 tbl("Tabla 2. Cumplimiento de los ocho requisitos",["Requisito","Cumplen","Pendientes/no cumplen","Sin dato","% de verificados"],q.map(function(x){return [x.label,x.cumplen,x.pendientes,x.sinDato,pct(x.tasa)];}))+
 bars("Figura 3. Porcentaje de cumplimiento entre verificados",q.map(function(x){return {label:x.label,value:x.tasa};}),{percent:true,max:100,note:"Cada requisito tiene como denominador los estudiantes con estado conocido."})+
 bars("Figura 4. Incidencias documentadas por requisito",q.map(function(x){return {label:x.label,value:x.pendientes};}),{note:"La ausencia de datos se contabiliza separadamente."})+
 "<h3>4.3. Resultados por carrera</h3>"+
 tbl("Tabla 3. Consolidado por carrera",["Carrera","Activos","Requisitos previos","Habilitados","Evaluados","Aprobados","Reprobados","Sin nota","% entre evaluados"],
 c.map(function(x){return [x.nombre,x.total,x.reqOK,x.habilitados,x.evaluados,x.aprobados,x.reprobados,x.sinNota,pct(x.tasa)];}))+
 bars("Figura 5. Tamaño de cohorte por carrera",c.map(function(x){return {label:x.nombre,value:x.total};}))+
 bars("Figura 6. Habilitados por carrera",c.map(function(x){return {label:x.nombre,value:hasReq?x.habilitados:null};}),{note:"Titulación no condiciona los requisitos previos."})+
 bars("Figura 7. Aprobación entre evaluados por carrera",c.map(function(x){return {label:x.nombre,value:x.tasa};}),{percent:true,max:100,note:"Denominador: estudiantes con nota final por carrera."})+
 "<h3>4.4. Calificaciones</h3>"+
 tbl("Tabla 4. Indicadores generales",["Indicador","Valor"],[["Matrículas activas",s.total],["Con nota final",s.evaluados],["Aprobados",s.aprobados],["Reprobados",s.reprobados],["Sin nota final",s.sinNota],["Notas oficiales",s.notasOficiales],["Notas calculadas",s.notasCalculadas],["Tasa sobre cohorte",pct(s.tasaGlobal)],["Tasa entre evaluados",pct(s.tasaEvaluados)]])+
 bars("Figura 8. Aprobación, reprobación y sin nota",[{label:"Aprobados",value:s.aprobados},{label:"Reprobados",value:s.reprobados},{label:"Sin nota final",value:s.sinNota}])+
 bars("Figura 9. Distribución de calificaciones",r.bands.map(function(x){return {label:x.label,value:x.n};}),{note:"Intervalos de notas de 0 a 10, solo sobre valores finales válidos."})+
 bars("Figura 10. Origen de calificaciones",[{label:"Oficial",value:s.notasOficiales},{label:"Calculada",value:s.notasCalculadas},{label:"Sin nota",value:s.sinNota}])+
 bars("Figura 11. Promedio final por carrera",c.map(function(x){return {label:x.nombre,value:x.promedio};}),{max:10,note:"Promedio sobre notas finales disponibles, no sobre estudiantes matriculados."})+
 bars("Figura 12. Habilitación y evaluación (fuentes a conciliar)",[{label:"Habilitados documentados",value:hasReq?s.habilitados:null},{label:"Evaluados",value:s.evaluados},{label:"Aprobados",value:s.aprobados}],{note:"Son universos que pueden diferir y no se deben restar como si fueran las mismas personas."})+
 "<h3>4.5. Conciliación y calidad</h3>"+(r.issues.length?"<ul>"+r.issues.map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+"</ul>":"<p>No se detectaron incidencias automáticas.</p>")+
 "<p class='infp-small'>"+esc(r.statisticalBasis)+" Fuente: "+esc(r.source)+". Fecha de consulta: "+esc(r.generatedAt)+".</p>";
 parts.push(sect("4. Resultados y análisis",result));
 var phases=[
  {title:"4.6. Fase I: requisitos previos",field:"req",grade:false},
  {title:"4.7. Fase II: componente escrito",field:"articulo",grade:true},
  {title:"4.8. Fase III: defensa",field:"defensa",grade:true},
  {title:"4.9. Fase IV: registro final",field:"nota",grade:true}
 ];
 var details=phases.map(function(phase){
  var out="<h3>"+phase.title+"</h3>";
  if(!phase.grade){
   q.forEach(function(req){
    var known=req.cumplen+req.pendientes;
    out+="<h4>"+esc(req.label)+"</h4><p>Se verifica el cumplimiento del requisito "+esc(req.label)+" para la cohorte de "+s.total+" estudiantes.</p>"+
    tbl("Cumplimiento: "+req.label,["Cumplen","No cumplen o pendientes","Sin dato","Total"],[[req.cumplen,req.pendientes,req.sinDato,s.total]])+
    "<p>Se registran "+req.cumplen+" cumplimientos, "+req.pendientes+" incumplimientos o pendientes y "+req.sinDato+" estados sin información. La cobertura verificable es "+known+" de "+s.total+".</p>"+
    bars("Distribución: "+req.label,[{label:"Cumple",value:req.cumplen},{label:"No cumple / pendiente",value:req.pendientes},{label:"Sin dato",value:req.sinDato}],{max:Math.max(1,s.total)});
   });
  }else{
   c.forEach(function(group){
    var rows=r.students.filter(function(x){return x.carrera===group.nombre;});
    var complete=rows.filter(function(x){return x[phase.field]!==null;}).length;
    var passed=rows.filter(function(x){return phase.field==="nota"?x.estado==="APROBADO":x[phase.field]!==null&&x[phase.field]>=7;}).length;
    out+="<h4>"+esc(group.nombre)+"</h4><p>Se presentan los resultados individuales de "+rows.length+" estudiantes de la carrera "+esc(group.nombre)+". Las calificaciones ausentes se identifican sin asignar cero.</p>"+
    tbl("Resultados de "+group.nombre+" — "+phase.title,phase.field==="nota"?["Estudiante","Escrito","Defensa","Final","Estado"]:["Estudiante","Calificación","Estado"],rows.map(function(x){
      return phase.field==="nota"?[x.nombre||x.cedula,num(x.articulo),num(x.defensa),num(x.nota),x.estado]:
      [x.nombre||x.cedula,num(x[phase.field]),x[phase.field]===null?"Sin dato":x[phase.field]>=7?"Aprueba":"No aprueba"];
    }))+
    "<p>De "+rows.length+" estudiantes, "+complete+" tienen calificación registrada y "+passed+" cumplen el criterio de aprobación de esta fase.</p>"+
    bars("Distribución de "+group.nombre,[{label:"Aprobados",value:passed},{label:"No aprobados",value:complete-passed},{label:"Sin calificación",value:rows.length-complete}],{max:Math.max(1,rows.length)});
   });
  }
  return out;
 }).join("");
 details+="<h3>4.10. Fase V: registro del título</h3><p>El registro del título se presenta después de los resultados académicos y no equivale a la aprobación de la defensa.</p>"+
 tbl("Registro de titulación",["Estado","Estudiantes"],[["Registrado",r.students.filter(function(x){return x.req.Titulacion==="CUMPLE";}).length],["Pendiente o no cumple",r.students.filter(function(x){return x.req.Titulacion==="PENDIENTE"||x.req.Titulacion==="NO CUMPLE";}).length],["Sin dato",r.students.filter(function(x){return !x.req.Titulacion;}).length]]);
 parts.push(sect("Resultados detallados por fases",details));
 var tree="<div class='infp-tree'><strong>Matrículas</strong>"+funnel.map(function(x){return "<div>↳ "+esc(x.label)+": <b>"+num(x.value)+"</b></div>";}).join("")+"</div>";
 var critical=(r.validation||[]).filter(function(x){return x.critical;});
 parts.push(sect("Árbol de seguimiento y conciliación",tree+"<p>Las ramas representan subconjuntos acumulativos de estudiantes identificados individualmente.</p>"+(critical.length?"<p><strong>Inconsistencias críticas:</strong> "+critical.map(function(x){return esc(x.message);}).join("; ")+"</p>":"<p>Los controles aritméticos no identificaron inconsistencias críticas.</p>")));
 parts.push(sect("ICAWA — matriz de análisis","<p>La estructura institucional ICAWA debe validarse antes de automatizar sus categorías. Se muestran hallazgos verificables, sin atribuir causas no demostradas.</p>"+tbl("Hallazgos y acciones",["Indicador","Hallazgo"],[["Matrículas",s.total],["Requisitos completos",s.requisitosCompletos],["Aprobados",s.aprobados],["Incidencias",r.issues.length]])));
 parts.push(sect("Ishikawa — análisis causal","<p>Problema central: casos sin cierre de titulación. Las ramas siguientes son líneas de investigación y no causas comprobadas.</p><div class='infp-tree'>Registro final pendiente<div>↳ Requisitos documentales: verificar expedientes</div><div>↳ Evaluación: verificar componentes sin nota</div><div>↳ Registro: verificar estados de titulación</div><div>↳ Datos: verificar fuentes incompletas</div></div>"));
 parts.push(sect("FODA — análisis institucional",tbl("Matriz FODA",["Fortalezas","Oportunidades"],[["Trazabilidad por estudiante","Mejoras de seguimiento"],["Debilidades","Amenazas"],["Registros pendientes: "+s.sinNota,"Demoras externas: requieren verificación"]])));
 parts.push(sect("5. Resumen ejecutivo","<p>La cohorte tiene "+s.total+" matrículas y "+s.evaluados+" notas finales. Se identifican "+s.aprobados+" aprobados, "+s.reprobados+" reprobados y "+s.sinNota+" casos sin nota. La aprobación sobre toda la cohorte es "+pct(s.tasaGlobal)+", mientras que la aprobación entre evaluados es "+pct(s.tasaEvaluados)+". Se detectaron "+r.issues.length+" observaciones de conciliación.</p>"));
 parts.push(sect("6. Conclusiones","<ol>"+
 ["Participaron "+s.total+" matrículas activas de "+c.length+" carreras del período "+r.periodoLabel+".",
 "Entre "+s.evaluados+" estudiantes con nota final, "+s.aprobados+" aprobaron y "+s.reprobados+" no alcanzaron el mínimo.",
 "Se verificaron todos los requisitos previos para "+s.conDatosRequisitos+" estudiantes; "+s.requisitosCompletos+" los cumplen integralmente.",
 "El requisito Titulación consta en "+s.conTitulacion+" de "+s.total+" registros, por lo que no pueden presumirse estados ausentes.",
 "El control de calidad identifica "+r.issues.length+" incidencias que requieren revisión antes de emisión oficial."].map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+"</ol>"));
 var main=q.slice().sort(function(a,b){return b.pendientes-a.pendientes;})[0];
 parts.push(sect("7. Recomendaciones","<ol>"+[
 "Conciliar requisitos, matrículas y notas por cédula y período, documentando las discrepancias de fuentes.",
 main&&main.pendientes?"Priorizar el requisito "+main.label+" con "+main.pendientes+" pendientes registrados.":"Mantener seguimiento preventivo por requisito.",
 s.sinNota?"Verificar "+s.sinNota+" estudiantes sin nota final, sin asignarles automáticamente calificación cero.":"Mantener la trazabilidad de las calificaciones finales.",
 s.notasCalculadas?"Revisar las "+s.notasCalculadas+" calificaciones calculadas antes de su homologación oficial.":"Conservar la comprobación de las ponderaciones por modalidad.",
 "Someter el informe a revisión, aprobación y archivo conforme al proceso UTET-PRO-95."
 ].map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+"</ol>"));
 parts.push(sect("8. Referencias","<p>Constitución de la República del Ecuador; Ley Orgánica de Educación Superior; Reglamento de Régimen Académico; normativa institucional pertinente; Ley Orgánica de Protección de Datos Personales; Manual de Procesos UTET, versión 2 (UTET-PRO-95, UTET-PRO-58, UTET-PRO-96 y UTET-PRO-164); base local académica del período seleccionado. Las referencias formales y la vigencia deben contrastarse antes de su emisión.</p>"));
 return parts.join("");
}
function style(){
 return "<style>"+
 "@page{size:A4;margin:2.54cm}body{font:12pt Georgia,serif;color:#253849;background:#fff;margin:0}*{box-sizing:border-box}p{line-height:2;text-align:left;text-indent:1.27cm}h1{font-size:18pt}h2{font-size:15pt;color:#1c456f}h3{font-size:11pt;margin:14px 0 6px}h4{font-size:10pt}.infp-paper{max-width:18cm;margin:0 auto}.infp-cover{height:26.7cm;position:relative;page-break-after:always}.infp-head{border-collapse:collapse;table-layout:fixed;width:100%;font-size:8pt}.infp-head td{height:12mm;border:1px solid #111;text-align:center;padding:4px}.infp-logo{max-width:3.8cm;max-height:1.8cm;object-fit:contain}.infp-center{position:absolute;top:35%;left:0;right:0;text-align:center}.infp-sign{position:absolute;bottom:4mm;left:0;table-layout:fixed;border-collapse:collapse;width:100%;font-size:8pt}.infp-sign td,.infp-sign th{width:33.3%;border:1px solid #111;padding:4px;text-align:center}.infp-sign .blank td{height:2.4cm}.infp-section,.infp-index{page-break-before:always}.infp-kpis{display:table;width:100%;table-layout:fixed}.infp-kpis div{display:table-cell;border:1px solid #a4b5c8;text-align:center;padding:9px}.infp-kpis b,.infp-kpis span{display:block}.infp-kpis b{font-size:17pt}.infp-kpis span{font-size:8pt}.infp-table,.infp-bars{margin:16px 0;page-break-inside:avoid;break-inside:avoid}.infp-table figcaption,.infp-bars figcaption{font-weight:bold;margin-bottom:8px;font-size:9pt}.infp-table table{border-collapse:collapse;width:100%;font-size:7.5pt}.infp-table th,.infp-table td{border:1px solid #9bb0c1;padding:4px;overflow-wrap:anywhere}.infp-table th{background:#e4edf5}.infp-table tr{page-break-inside:avoid}.infp-bar{display:table;width:100%;margin:5px 0;table-layout:fixed}.infp-bar span,.infp-bar>div,.infp-bar b{display:table-cell;vertical-align:middle;font-size:8pt}.infp-bar span{width:40%}.infp-bar>div{width:45%;background:#eef3f8;height:12px}.infp-bar i{display:block;background:#326a93;height:12px}.infp-bar b{width:15%;text-align:right}.infp-small{font-size:8pt;color:#5b6a79}.infp-section li{margin:5px 0}.infp-tree{border-left:4px solid #326a93;padding:12px 18px;margin:16px 0;background:#eef3f8}.infp-tree div{padding:7px 0 7px 16px;border-bottom:1px solid #cbd9e3}"+
 "</style>";
}
function html(r,logo){return "<!doctype html><html lang='es'><head><meta charset='utf-8'>"+style()+"</head><body><div class='infp-paper'>"+cover(r,logo)+contents(r)+"</div></body></html>";}
function logo(){return new Promise(function(resolve){var im=new Image();im.onload=function(){try{var c=d.createElement("canvas");c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext("2d").drawImage(im,0,0);resolve(c.toDataURL("image/png"));}catch(e){resolve(null);}};im.onerror=function(){resolve(null);};im.src=new URL("../Global/assets/branding/logo-instituto.png",d.baseURI).href;});}
function save(data,name){var url=URL.createObjectURL(data),a=d.createElement("a");a.href=url;a.download=name;d.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);}
async function word(r){var src=html(r,await logo()),name="INF_PVC_"+slug(r.periodoLabel)+".doc";save(new Blob(["\ufeff",src],{type:"application/msword;charset=utf-8"}),name);return {name:name};}
async function pdf(r){
 if(typeof w.html2pdf!=="function")throw Error("No se encontró la biblioteca html2pdf.js.");
 var src=html(r,await logo()),host=d.createElement("div"),match=src.match(/<body[^>]*>([\s\S]*)<\/body>/i);
 host.style.cssText="position:fixed;left:-100000px;top:0;width:794px;background:white;z-index:-1";
 host.innerHTML=match[1];var css=d.createElement("style");css.textContent=style().replace(/<\/?style>/g,"");host.prepend(css);d.body.appendChild(host);
 var name="INF_PVC_"+slug(r.periodoLabel)+".pdf";
 var opt={margin:[15,15,15,15],filename:name,image:{type:"jpeg",quality:.96},html2canvas:{scale:1.35,useCORS:true,backgroundColor:"#fff",logging:false},jsPDF:{unit:"mm",format:"a4",orientation:"portrait",compress:true},pagebreak:{mode:["css","legacy"],before:".infp-section,.infp-index"}};
 try{
  var worker=w.html2pdf().set(opt).from(host).toPdf(),result=await worker.get("pdf"),count=result.internal.getNumberOfPages();
  for(var k=1;k<=count;k++){result.setPage(k);result.setFontSize(8);result.setTextColor(100,110,120);result.text("ITSQMET · UTET · "+r.periodoLabel,15,288);result.text("Página "+k+" de "+count,195,288,{align:"right"});}
  await worker.save();return {name:name,pages:count};
 }finally{host.remove();}
}
w.InfPVCExport=Object.freeze({documentHTML:html,word:word,pdf:pdf});
})(window,document);

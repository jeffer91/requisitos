/* Maquetación institucional de complexivos: estructura basada en el modelo académico.
 * No escribe calificaciones ni toca Firebase.
 */
(function(window){
"use strict";
function str(v){return String(v===null||v===undefined?"":v).trim();}
function h(v){return str(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function fixed(v){return v===null||v===undefined||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("es-EC",{minimumFractionDigits:2,maximumFractionDigits:2});}
function hundred(v){return v===null||v===undefined?null:Math.round(Number(v)*1000)/100;}
function percent(n,total){return total?fixed(n*100/total)+" %":"0,00 %";}
function split(rows,limit){var result=[];for(var i=0;i<rows.length;i+=limit)result.push(rows.slice(i,i+limit));return result;}
function page(title,body,kind){return {title:title,body:body,kind:kind||"content"};}
function label(value){return '<div class="nr-eyebrow">'+h(value)+'</div>';}
function heading(title,subtitle){return '<h1>'+h(title)+'</h1><p class="nr-subtitle">'+h(subtitle||"")+'</p>';}
function table(headers,rows,className){
 return '<table class="nr-table '+h(className||"")+'"><thead><tr>'+
  headers.map(function(c){return '<th>'+h(c)+'</th>';}).join("")+
  '</tr></thead><tbody>'+rows.join("")+'</tbody></table>';
}
function row(cells){
 return '<tr>'+cells.map(function(c,i){
   return '<td'+(i>0?' class="nr-num"':'')+'>'+h(c)+'</td>';
 }).join("")+'</tr>';
}
function source(period,figure){
 return '<p class="nr-caption">'+(figure&&figure!=="—"?'Figura '+figure+'. ':'')+
  'Fuente: Ncomplex, calificaciones guardadas del período '+h(period)+'. Elaboración automática; notas normalizadas sobre 100.</p>';
}
function stats(rows,key){
 var values=rows.map(function(r){return r[key];}).filter(function(v){return Number.isFinite(v);}).sort(function(a,b){return a-b;});
 var n=values.length,mid=Math.floor(n/2),average=n?values.reduce(function(a,b){return a+b;},0)/n:null;
 var median=n?(n%2?values[mid]:(values[mid-1]+values[mid])/2):null;
 var above=values.filter(function(v){return v>=7;}).length;
 return {n:n,mean:average,median:median,min:n?values[0]:null,max:n?values[n-1]:null,above:above,below:n-above};
}
function indicators(statsValue){
 var s=statsValue;
 return table(["Indicador","Resultado"],[
   row(["Estudiantes evaluados",s.n]),
   row(["Promedio /100",fixed(hundred(s.mean))]),
   row(["Mediana /100",fixed(hundred(s.median))]),
   row(["Calificación máxima",fixed(hundred(s.max))]),
   row(["Calificación mínima",fixed(hundred(s.min))]),
   row(["Calificaciones ≥70",s.above+" ("+percent(s.above,s.n)+")"]),
   row(["Calificaciones inferiores a 70",s.below+" ("+percent(s.below,s.n)+")"])
 ],"nr-stats-table");
}
function bars(buckets){
 var max=buckets.reduce(function(v,b){return Math.max(v,b.count);},0);
 return '<div class="nr-hist nr-hist-document">'+buckets.map(function(b){
   return '<div class="nr-hist-row"><span>'+h(b.label)+'</span><div class="nr-hist-track">'+
    '<div class="nr-hist-fill" style="width:'+(max?Math.round(100*b.count/max):0)+'%"></div></div>'+
    '<b>'+b.count+'</b></div>';
 }).join("")+'</div>';
}
function distribution(rows,key){
 var labels=["0–39,99","40–59,99","60–69,99","70–79,99","80–89,99","90–100"];
 var buckets=labels.map(function(l){return {label:l,count:0};});
 rows.forEach(function(r){
   var v=r[key],index=v<4?0:v<6?1:v<7?2:v<8?3:v<9?4:5;
   buckets[index].count++;
 });
 return buckets;
}
function comparison(careers,key){
 return '<div class="nr-bars">'+careers.map(function(c){
   var value=c[key],pct=value===null?0:Math.max(0,Math.min(100,value*10));
   return '<div class="nr-bar-row"><div class="nr-bar-name">'+h(c.career)+'</div>'+
    '<div class="nr-bar-track"><div class="nr-bar-fill" style="width:'+pct+'%"></div></div>'+
    '<div class="nr-bar-number">'+fixed(hundred(value))+'</div>'+
    '<div class="nr-bar-count">n='+c.count+'</div></div>';
 }).join("")+'</div>';
}
function conditionGraph(c){
 var data=[{label:"Aprobados",count:c.approved},
   {label:"Supletorio pendiente",count:c.pending},
   {label:"Supletorio insuficiente",count:c.insufficient}];
 var max=Math.max(1,c.count);
 return '<div class="nr-outcomes">'+data.map(function(d,i){
   return '<div class="nr-outcome-row"><span>'+h(d.label)+'</span>'+
     '<div class="nr-outcome-track"><div class="nr-outcome-fill nr-outcome-'+i+
     '" style="width:'+(100*d.count/max)+'%"></div></div>'+
     '<strong>'+d.count+' ('+percent(d.count,c.count)+')</strong></div>';
 }).join("")+'</div>';
}
function analysisComponent(c,key,name){
 var s=stats(c.rows,key);
 if(!s.n)return 'No hay estudiantes con calificaciones '+name+' verificadas y nueve requisitos completos. No se calculan promedios.';
 return 'El componente '+name+' registra un promedio de '+fixed(hundred(s.mean))+
   ' puntos sobre 100 y una mediana de '+fixed(hundred(s.median))+
   '. De '+s.n+' estudiantes habilitados, '+s.above+' ('+percent(s.above,s.n)+
   ') obtuvieron 70 puntos o más, mientras '+s.below+' ('+percent(s.below,s.n)+
   ') se ubicaron por debajo de ese valor. La nota máxima fue '+fixed(hundred(s.max))+
   ' y la mínima '+fixed(hundred(s.min))+
   '. La distribución identifica áreas de seguimiento, sin establecer por sí sola la aprobación del examen.';
}
function analysisFinal(c){
 if(!c.count)return 'No se dispone de notas finales habilitadas para esta carrera. Las incidencias constan en la sección de control de integridad.';
 var s=stats(c.rows,"final");
 return 'La nota final ponderada presenta un promedio de '+fixed(hundred(s.mean))+
  '/100 y una mediana de '+fixed(hundred(s.median))+'/100. De '+c.count+
  ' estudiantes con expediente completo, '+c.approved+' ('+percent(c.approved,c.count)+
  ') alcanzan 70/100 o más; '+c.pending+' mantienen resultado ordinario que requiere supletorio y '+
  c.insufficient+' registran supletorio inferior al mínimo. El resultado se calcula como 40 % teórico y 60 % práctico.';
}
function covered(c){
 var x=c.excluded||{};
 return (x.requisitos||0)+(x.sinNotas||0)+(x.incidencia||0)+(x.duplicados||0);
}
function addComponentPages(pages,c,key,name,weight,ordinal,period){
 var n=c.rows.length,mode=name.toUpperCase();
 var intro='Las calificaciones individuales se expresan en escala de 0 a 100 a partir de los datos normalizados de Ncomplex.';
 var tableParts=n?split(c.rows,19):[[]];
 tableParts.forEach(function(part,index){
   var rows=part.map(function(r,j){return row([index*19+j+1,r.name,fixed(hundred(r[key]))]);});
   var textTitle='RESULTADOS DEL COMPONENTE '+mode+' ('+weight+' %)';
   pages.push(page(c.career+' · '+name+' · tabla',label(ordinal+' / '+h(c.career).toUpperCase())+
     heading(textTitle,'Tabla de calificaciones del componente '+name+' · '+(index+1)+'/'+tableParts.length)+
     '<p class="nr-intro">'+intro+'</p>'+
     (rows.length?table(["N.º","Estudiante","Calificación /100"],rows,"nr-student-component"):
       '<div class="nr-note">Sin estudiantes habilitados con notas verificadas para este componente.</div>')+
     source(period), "career-table"));
 });
 var st=stats(c.rows,key);
 pages.push(page(c.career+' · '+name+' · análisis',label(ordinal+' / '+h(c.career).toUpperCase())+
   heading('Componente '+name+' — distribución y análisis','Gráfico estadístico, indicadores y valoración del desempeño')+
   '<h2>Gráfico de distribución de calificaciones '+name+'</h2>'+bars(distribution(c.rows,key))+
   source(period,'—')+
   '<h2>Indicadores del componente '+name+'</h2>'+indicators(st)+
   '<h2>Análisis de los resultados '+name+'</h2><p class="nr-analysis">'+h(analysisComponent(c,key,name))+'</p>',
   "career-component"));
}
function addFinalPages(pages,c,period){
 var n=c.rows.length,parts=n?split(c.rows,13):[[]];
 parts.forEach(function(part,i){
   var rows=part.map(function(r,k){
     var cond=r.final>=7?"APROBADO":r.opportunity==="ORDINARIA"?"SUPLETORIO":"SUPL. INSUFICIENTE";
     return row([i*13+k+1,r.name,fixed(hundred(r.teorico)),fixed(hundred(r.practico)),
       fixed(hundred(r.final)),cond]);
   });
   pages.push(page(c.career+' · finales · tabla',label('RESULTADOS FINALES / '+h(c.career).toUpperCase())+
    heading('RESULTADOS FINALES DEL EXAMEN COMPLEXIVO',
      'Teórico 40 % + Práctico 60 % · Tabla de notas '+(i+1)+'/'+parts.length)+
    '<p class="nr-intro">Nota final = (Teórico × 0,40) + (Práctico × 0,60). '+
    'La condición de supletorio ordinario corresponde a una nota inferior a 70/100.</p>'+
    (rows.length?table(["N.º","Estudiante","Teórico /100","Práctico /100","Final /100","Condición"],rows,"nr-student-final"):
      '<div class="nr-note">Sin calificaciones finales habilitadas para este período.</div>')+
    source(period),"career-table"));
 });
 pages.push(page(c.career+' · finales · análisis',
   label('RESULTADOS FINALES / '+h(c.career).toUpperCase())+
   heading('Resultados finales del examen','Distribución por condición académica y rendimiento ponderado')+
   '<h2>Gráfico de condición académica</h2>'+conditionGraph(c)+
   source(period,'—')+
   '<h2>Indicadores de resultados finales</h2>'+indicators(stats(c.rows,"final"))+
   '<h2>Análisis de resultados finales</h2><p class="nr-analysis">'+h(analysisFinal(c))+'</p>',
   "career-component"));
}
function statisticsConsolidated(c){
 var pr=stats(c.rows,"practico"),te=stats(c.rows,"teorico"),fi=stats(c.rows,"final");
 var arr=[
  ["Estudiantes evaluados",pr.n,te.n,fi.n],
  ["Promedio /100",fixed(hundred(pr.mean)),fixed(hundred(te.mean)),fixed(hundred(fi.mean))],
  ["Mediana /100",fixed(hundred(pr.median)),fixed(hundred(te.median)),fixed(hundred(fi.median))],
  ["Calificación máxima",fixed(hundred(pr.max)),fixed(hundred(te.max)),fixed(hundred(fi.max))],
  ["Calificación mínima",fixed(hundred(pr.min)),fixed(hundred(te.min)),fixed(hundred(fi.min))],
  ["Calificaciones ≥70",pr.above,te.above,fi.above],
  ["Calificaciones inferiores a 70",pr.below,te.below,fi.below]
 ];
 return table(["Indicador","Práctico","Teórico","Final"],arr.map(row),"nr-consolidated-table");
}
function consolidatedAnalysis(c){
 if(!c.count)return "No es posible comparar los componentes porque no se registran notas habilitadas para la carrera.";
 var diff=(c.practical-c.theoretical)*10;
 var prefix=Math.abs(diff)<.005?"Los promedios teórico y práctico son equivalentes.":
  (diff>0?"El componente práctico supera al teórico por ":"El componente teórico supera al práctico por ")+fixed(Math.abs(diff))+" puntos sobre 100.";
 return prefix+" La nota final tiene mayor dependencia del desempeño práctico por su ponderación de 60 %. "+
   "La comparación describe los resultados verificados y sirve para identificar necesidades de refuerzo.";
}
function conclusion(c){
 if(!c.count)return 'La carrera tiene '+c.registered+' registros no retirados, pero ninguno cumple simultáneamente los nueve requisitos y la verificación de notas. Se recomienda regularizar las incidencias antes de presentar resultados oficiales.';
 var guidance=c.theoretical<c.practical?
  'Se recomienda revisar prioritariamente los contenidos teóricos de menor rendimiento.':
  c.practical<c.theoretical?
   'Se recomienda reforzar las competencias prácticas, cuyo componente representa el 60 % de la nota final.':
   'Se recomienda mantener actividades de fortalecimiento equilibradas en ambos componentes.';
 return 'La carrera cuenta con '+c.count+' evaluaciones habilitadas, un promedio final de '+
    fixed(hundred(c.final))+'/100 y '+c.approved+' estudiantes aprobados ('+percent(c.approved,c.count)+
    '). Se identifican '+c.pending+' resultados ordinarios pendientes de supletorio y '+c.insufficient+
    ' supletorios inferiores al mínimo. '+guidance+
    (covered(c)?' Además, '+covered(c)+' expedientes quedaron excluidos por controles de integridad o requisitos.':'');
}
function careerConsolidation(pages,c,period){
 pages.push(page(c.career+' · consolidado',
   label('CONSOLIDADO GENERAL / '+h(c.career).toUpperCase())+
   heading('CONSOLIDADO GENERAL DE LA CARRERA','Indicadores y comparación de componentes académicos')+
   '<h2>Resumen estadístico consolidado</h2>'+statisticsConsolidated(c)+
   '<h2>Indicadores de aprobación y supletorio</h2>'+
   table(["Indicador","Cantidad","Porcentaje"],[
    row(["Estudiantes registrados",c.registered,"100,00 %"]),
    row(["Estudiantes evaluados y habilitados",c.count,percent(c.count,c.registered)]),
    row(["Estudiantes aprobados",c.approved,percent(c.approved,c.count)]),
    row(["Pendientes de supletorio ordinario",c.pending,percent(c.pending,c.count)]),
    row(["Supletorios insuficientes",c.insufficient,percent(c.insufficient,c.count)]),
    row(["Expedientes excluidos",covered(c),percent(covered(c),c.registered)])
   ],"nr-stats-table")+
   '<h2>Comparación de promedios práctico, teórico y final</h2>'+
   comparison([{career:"Práctico (60 %)",count:c.count,final:c.practical},
     {career:"Teórico (40 %)",count:c.count,final:c.theoretical},
     {career:"Final ponderado",count:c.count,final:c.final}],"final")+
   source(period),"career-consolidated"));
 pages.push(page(c.career+' · conclusiones',
   label('CIERRE ANALÍTICO / '+h(c.career).toUpperCase())+
   heading('ANÁLISIS Y CONCLUSIONES DE LA CARRERA','Interpretación académica de los resultados')+
   '<h2>Análisis comparativo de los componentes</h2><p class="nr-analysis">'+h(consolidatedAnalysis(c))+'</p>'+
   '<h2>Casos especiales y control institucional</h2>'+
   '<p class="nr-analysis">'+(covered(c)?
     'Se registran '+covered(c)+' expedientes no incluidos: '+c.excluded.requisitos+' por requisitos, '+
       c.excluded.sinNotas+' sin notas completas, '+c.excluded.incidencia+' por discordancia y '+
       c.excluded.duplicados+' por identidad incompleta o duplicada.':
     'No se registran expedientes excluidos por requisitos, notas discordantes o identidad duplicada.')+'</p>'+
   '<h2>Conclusión general</h2><p class="nr-analysis">'+h(conclusion(c))+'</p>'+
   '<div class="nr-note"><b>Interpretación:</b> los indicadores provienen de estudiantes habilitados. '+
   'Las calificaciones ordinarias inferiores a 70/100 corresponden a supletorio pendiente, no a reprobación definitiva.</div>',
   "career-conclusion"));
}
function topDescription(report,key,component){
 var available=report.careers.filter(function(c){return c.count>0;})
  .sort(function(a,b){return b[key]-a[key]||a.career.localeCompare(b.career,"es");});
 if(!available.length)return "No existen calificaciones habilitadas para comparar el componente "+component+".";
 return 'El mayor promedio '+component+' se registra en '+available[0].career+
   ' ('+fixed(hundred(available[0][key]))+'/100, n='+available[0].count+
   '). Los promedios se presentan junto con el tamaño de cada cohorte.';
}
function contentPages(report,period,date){
 if(!report||!report.summary||!Array.isArray(report.careers))throw Error("Datos del informe incompletos.");
 var summary=report.summary,pages=[];
 pages.push(page("Portada",
   '<div class="nr-cover-top"><span>ITSQMET</span><span>UNIDAD DE TITULACIÓN Y EFICIENCIA TERMINAL</span></div>'+
   '<div class="nr-cover-main"><div class="nr-cover-label">INFORME INSTITUCIONAL</div>'+
   '<h1>RESULTADOS DE LOS EXÁMENES COMPLEXIVOS</h1>'+
   '<div class="nr-cover-rule"></div><p>Evaluación teórica (40 %), práctica (60 %) y resultados finales</p>'+
   '<div class="nr-cover-period"><span>PERÍODO ACADÉMICO</span><strong>'+h(period)+'</strong></div></div>'+
   '<div class="nr-cover-bottom"><span>Unidad de Titulación y Eficiencia Terminal</span>'+
   '<span>Quito, Ecuador</span><span>Fecha de emisión: '+h(date)+'</span></div>',
   "cover"));
 var findings=[
  'Se registran '+summary.registered+' estudiantes de Examen Complexivo no retirados en '+
    summary.careers+' carreras. De ellos, '+summary.qualified+
    ' integran el análisis por contar con requisitos 9/9 y notas verificadas.',
  'En la cohorte habilitada se identifican '+summary.approved+' aprobados, '+
    summary.pending+' pendientes de supletorio ordinario y '+summary.insufficient+
    ' supletorios inferiores a la nota mínima.',
  topDescription(report,"practical","práctico"),
  topDescription(report,"theoretical","teórico"),
  topDescription(report,"final","final")
 ];
 pages.push(page("Resumen ejecutivo",label("01 / RESUMEN EJECUTIVO")+
   heading("Resumen ejecutivo institucional","Resultados del período "+period)+
   '<div class="nr-kpis">'+[
    ["Registros",summary.registered],["Habilitados",summary.qualified],
    ["Aprobados",summary.approved],["A supletorio",summary.pending],
    ["Promedio práctico",fixed(hundred(summary.practical))+"/100"],
    ["Promedio teórico",fixed(hundred(summary.theoretical))+"/100"],
    ["Promedio final",fixed(hundred(summary.final))+"/100"],
    ["Excluidos",summary.registered-summary.qualified]
   ].map(function(pair){return '<div class="nr-kpi"><span>'+h(pair[0])+'</span><b>'+h(pair[1])+'</b></div>';}).join("")+'</div>'+
   '<h2>Hallazgos principales</h2><ul class="nr-findings">'+
   findings.map(function(v){return '<li>'+h(v)+'</li>';}).join("")+'</ul>'+
   '<div class="nr-note"><b>Criterio de inclusión:</b> requisito académico, documental, financiero, prácticas, '+
   'vinculación, seguimiento, inglés, actualización de datos y titulación, todos en estado CUMPLE. '+
   'Escala del informe: 0 a 100.</div>',
   "summary"));
 var groups=split(report.careers,17);
 groups.forEach(function(careers,index){
   pages.push(page("Comparativo general",label("02 / COMPARACIÓN INSTITUCIONAL")+
     heading("Resultados comparativos entre carreras","Indicadores generales "+(groups.length>1?" · "+(index+1)+"/"+groups.length:""))+
     table(["Carrera","Registr.","Habil.","Teórico /100","Práctico /100","Final /100","Aprob.","Suplet."],
       careers.map(function(c){return row([c.career,c.registered,c.count,
         fixed(hundred(c.theoretical)),fixed(hundred(c.practical)),fixed(hundred(c.final)),
         c.approved,c.pending]);}),"nr-institutional-table")+
     '<p class="nr-caption">Habil.: nueve requisitos completos y nota concordante. '+
     'Suplet.: oportunidad ordinaria con nota final inferior a 70/100.</p>',"comparison-table"));
 });
 [{key:"practical",title:"práctico",num:"03"},
  {key:"theoretical",title:"teórico",num:"04"},
  {key:"final",title:"final",num:"05"}].forEach(function(component){
   split(report.careers,19).forEach(function(group,i){
     pages.push(page("Comparativo "+component.title,
       label(component.num+" / COMPARATIVO INSTITUCIONAL")+
       heading("Comparativo del componente "+component.title,
         "Promedios por carrera · escala de 0 a 100 · "+(i+1)+"/"+Math.max(1,Math.ceil(report.careers.length/19)))+
       comparison(group,component.key)+
       '<h2>Análisis comparativo</h2><p class="nr-analysis">'+
         h(topDescription(report,component.key,component.title))+'</p>'+
       '<p class="nr-caption">Cada barra representa el promedio de estudiantes habilitados y muestra el tamaño de la cohorte.</p>',
       "comparison-chart"));
   });
 });
 report.careers.forEach(function(c){
   addComponentPages(pages,c,"practico","práctico",60,"06",period);
   addComponentPages(pages,c,"teorico","teórico",40,"07",period);
   addFinalPages(pages,c,period);
   careerConsolidation(pages,c,period);
 });
 var audit=report.careers.map(function(c){
   return row([c.career,c.excluded.requisitos,c.excluded.sinNotas,
     c.excluded.incidencia,c.excluded.duplicados]);
 });
 split(audit,20).forEach(function(piece){
   pages.push(page("Auditoría",label("09 / CONTROL DE INTEGRIDAD")+
     heading("Expedientes excluidos","No se incluyen en las tablas nominales ni en los promedios de carrera")+
     table(["Carrera","Req. pendientes","Sin notas","Discordancias","Duplicados"],piece,"nr-institutional-table")+
     '<p class="nr-caption">No se modifican ni se eliminan calificaciones al generar el informe.</p>',
     "audit"));
 });
 pages.push(page("Metodología",label("10 / METODOLOGÍA")+
   heading("Metodología y alcance de la información","Criterios académicos aplicados a todo el documento")+
   '<ol class="nr-method">'+[
     "Fuente: Base Local / Ncomplex del período seleccionado.",
     "Población: estudiantes no retirados en modalidad Examen Complexivo.",
     "Inclusión estadística: nueve requisitos institucionales en CUMPLE y evaluación guardada, completa y concordante.",
     "Normalización: teórico y práctico a 0–10; conversión a 0–100 únicamente para presentación en este informe.",
     "Ponderación: nota final = teórico × 0,40 + práctico × 0,60.",
     "Aprobación: nota final ≥70/100; el resultado ordinario inferior a 70/100 requiere supletorio.",
     "Supletorios: oportunidad identificada por separado; no se sustituyen silenciosamente resultados ni se infiere reprobación definitiva.",
     "Promedios y medianas: se calculan únicamente con estudiantes habilitados. Las carreras sin notas válidas muestran «Sin datos».",
     "El informe se genera sin modificar matrículas, requisitos, evaluaciones ni Firebase."
   ].map(function(item){return '<li>'+h(item)+'</li>';}).join("")+'</ol>'+
   '<div class="nr-note">Documento de análisis institucional. La generación de actas oficiales requiere las verificaciones documentales propias del módulo Actas.</div>',
   "methodology"));
 return pages;
}
function pageHtml(p,index,total,meta,logo){
 var n=index,totalPages=total;
 if(p.kind==="cover")return '<section class="nr-pdf-page nr-pdf-cover">'+
   '<div class="nr-cover-accent"></div>'+
   '<div class="nr-cover-logo"><img src="'+h(logo)+'" alt="Logotipo institucional ITSQMET"></div>'+
   p.body+
   '<div class="nr-cover-foot">RESULTADOS ACADÉMICOS · INFORME DE GESTIÓN</div></section>';
 return '<section class="nr-pdf-page nr-pdf-document">'+
   '<header class="nr-header"><div class="nr-logo"><img src="'+h(logo)+'" alt="Logotipo institucional"></div>'+
   '<div class="nr-head-copy"><span>ITSQMET · QUITO METROPOLITANO</span>'+
   '<strong>UNIDAD DE TITULACIÓN Y EFICIENCIA TERMINAL</strong>'+
   '<small>INFORME INSTITUCIONAL DE EXÁMENES COMPLEXIVOS</small></div></header>'+
   '<main class="nr-page-main">'+p.body+'</main>'+
   '<footer class="nr-footer"><span>'+h(meta.period)+' · '+h(meta.date)+'</span>'+
   '<span>Página '+n+' de '+totalPages+'</span></footer></section>';
}
window.NcomplexReportDocument=Object.freeze({
  contentPages:contentPages,pageHtml:pageHtml,stats:stats,distribution:distribution,
  analysisComponent:analysisComponent,analysisFinal:analysisFinal
});
})(window);

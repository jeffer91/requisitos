/* =========================================================
Nombre completo: global.pdf.runtime.js
Ruta o ubicación: /Global/global.pdf.runtime.js
Función:
- Generar el PDF institucional de Global directamente con jsPDF.
- Descargar automáticamente el archivo sin capturar el DOM.
- Incrustar el logo institucional mediante una imagen normalizada para PDF.
- Mostrar períodos, graduados, cumplimiento y fecha estimada de graduación.
- Compartir con GlobalWord el mismo modelo institucional.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="3.3.1-logo-jpeg-direct";
  var EMBEDDED_LOGO="data:image/jpeg;base64,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";
  var config=window.GlobalConfig||{};
  var pdfEngineLoading=null;
  var JSPDF_PATHS=[
    "../node_modules/jspdf/dist/jspdf.umd.min.js",
    "../node_modules/html2pdf.js/node_modules/jspdf/dist/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"
  ];

  function text(value){return String(value==null?"":value).trim();}
  function cleanInstitutionalText(value){
    return text(value)
      .replace(/\bP\.?\s*V\.?\s*C\.?\b/gi," ")
      .replace(/\bONLINE\b/gi," ")
      .replace(/\s{2,}/g," ")
      .replace(/\s+([,.;:])/g,"$1")
      .trim();
  }
  function countPhrase(value,singular,plural){
    var n=number(value);
    return n+" "+(n===1?singular:plural);
  }
  function percent(value){
    return Math.max(0,Math.min(100,Math.round(number(value))));
  }
  function number(value){var parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
  function absoluteUrl(value){try{return new URL(value,window.location.href).href;}catch(error){return text(value);}}
  function formatDate(){try{return new Intl.DateTimeFormat("es-EC",{dateStyle:"long",timeStyle:"short"}).format(new Date());}catch(error){return new Date().toLocaleString("es-EC");}}
  function todayISO(){var date=new Date();return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");}
  function slug(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80)||"Global";
  }
  function sections(){return Array.isArray(config.secciones)?config.secciones:[];}
  function sectionById(id){
    var found=sections().filter(function(item){return item.id===id;})[0];
    return found||{id:id||"resumen",label:"Informe",titulo:"Informe institucional",pdfTitulo:"Informe institucional"};
  }
  function appRows(name,data){
    try{
      var rows=window.GlobalApp&&window.GlobalApp.rows;
      return rows&&typeof rows[name]==="function"?(rows[name](data)||[]):[];
    }catch(error){return [];}
  }
  function rowSource(sectionId,data){
    var map={
      resumen:"resumen",estudiantes:"students",carreras:"carreras",requisitos:"requisitos",
      periodos:"periodos","tipo-carrera":"tipos",comparativas:"comparativas",
      graduados:"graduados",alertas:"alertas",reportes:"resumen"
    };
    var rows=appRows(map[sectionId]||"resumen",data);
    if(sectionId==="graduados"&&!rows.length){
      rows=Array.isArray(data&&data.graduados&&data.graduados.porPeriodo)?data.graduados.porPeriodo:[];
    }
    return Array.isArray(rows)?rows:[];
  }

  var LABELS={
    cedula:"Cédula",nombres:"Estudiante",estudiante:"Estudiante",carrera:"Carrera",tipo:"Tipo de carrera",
    periodo:"Período",graduacion:"Fecha de graduación",division:"División",matricula:"Matrícula",estado:"Estado",cumplimiento:"Cumplimiento",
    indicador:"Indicador",valor:"Valor",detalle:"Detalle",estudiantes:"Estudiantes",activos:"Activos",
    retirados:"Retirados",requisito:"Requisito",cumple:"Cumple",pendiente:"Pendiente",noCumple:"No cumple",
    total:"Total",carreras:"Carreras",graduados:"Graduados",cantidadGraduados:"Cantidad de graduados",
    alerta:"Alerta",nivel:"Nivel",descripcion:"Descripción"
  };
  var PREFERRED=["cedula","nombres","estudiante","carrera","tipo","periodo","graduacion","division","matricula","estado","indicador","valor","detalle","requisito","cumple","pendiente","noCumple","estudiantes","activos","retirados","carreras","graduados","cantidadGraduados","total","cumplimiento","alerta","nivel","descripcion"];

  function label(value){
    var key=text(value);
    if(LABELS[key]){return LABELS[key];}
    return key.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/_/g," ").replace(/^./,function(char){return char.toUpperCase();});
  }
  function columnsFor(rows){
    var keys=[];
    (rows||[]).forEach(function(row){
      Object.keys(row||{}).forEach(function(key){
        if(keys.indexOf(key)<0&&key.charAt(0)!=="_"){keys.push(key);}
      });
    });
    keys.sort(function(a,b){
      var ia=PREFERRED.indexOf(a),ib=PREFERRED.indexOf(b);
      ia=ia<0?999:ia;ib=ib<0?999:ib;
      return ia===ib?a.localeCompare(b):ia-ib;
    });
    return keys.map(function(key){return {key:key,label:label(key)};});
  }
  function tableForSection(sectionId,data){
    var section=sectionById(sectionId);
    var rows=rowSource(section.id,data||{});
    return {title:section.titulo||section.label||"Detalle",columns:columnsFor(rows),rows:rows};
  }
  function selectedLabel(selector,fallback){
    var node=document.querySelector(selector);
    if(node&&node.options&&node.selectedIndex>=0){return text(node.options[node.selectedIndex].text)||text(fallback);}
    return text(fallback);
  }
  function filterRows(filters){
    filters=filters||{};
    var rows=[];
    if(filters.periodoDesde){rows.push({filtro:"Período desde",valor:cleanInstitutionalText(selectedLabel("#globalFiltroDesde",filters.periodoDesde))});}
    if(filters.periodoHasta){rows.push({filtro:"Período hasta",valor:cleanInstitutionalText(selectedLabel("#globalFiltroHasta",filters.periodoHasta))});}
    if(filters.carrera){rows.push({filtro:"Carrera",valor:cleanInstitutionalText(selectedLabel("#globalFiltroCarrera",filters.carrera))});}
    if(filters.division){rows.push({filtro:"División",valor:cleanInstitutionalText(selectedLabel("#globalFiltroDivision",filters.division))});}
    if(filters.requisito){rows.push({filtro:"Requisito",valor:cleanInstitutionalText(selectedLabel("#globalFiltroRequisito",filters.requisito))});}
    if(filters.tipoCarrera){rows.push({filtro:"Tipo de carrera",valor:cleanInstitutionalText(selectedLabel("#globalFiltroTipo",filters.tipoCarrera))});}
    if(!rows.length){rows.push({filtro:"Alcance",valor:"Todos los registros disponibles"});}
    return rows;
  }
  function summaryText(section,data){
    section=section||sectionById("resumen");
    data=data||{};

    var summary=data.resumen||{};
    var totalStudents=number(summary.totalEstudiantes||data.students&&data.students.length);
    var totalGraduates=number(summary.totalGraduados||data.graduados&&data.graduados.total);
    var totalPeriods=number(summary.totalPeriodos||data.periods&&data.periods.length);
    var compliance=percent(summary.porcentajeCumplimiento);
    var active=number(summary.activos);
    var retired=number(summary.retirados);
    var pending=Math.max(0,totalStudents-totalGraduates);
    var graduateRate=totalStudents?Math.round((totalGraduates/totalStudents)*100):0;

    return [
      "El universo analizado está conformado por "+countPhrase(totalStudents,"estudiante","estudiantes")+" distribuidos en "+countPhrase(totalPeriods,"período académico","períodos académicos")+". La consolidación de estos datos permite observar de manera integral el avance del proceso de titulación y su comportamiento dentro del período de estudio.",
      "Del total de estudiantes considerados, "+countPhrase(totalGraduates,"registra","registran")+" la culminación satisfactoria del proceso de titulación, lo que representa el "+graduateRate+"% del universo analizado. En consecuencia, "+countPhrase(pending,"estudiante permanece","estudiantes permanecen")+" sin registro de graduación dentro del alcance temporal del presente informe.",
      "El nivel general de cumplimiento de requisitos alcanza el "+compliance+"%. Este indicador resume el avance conjunto de los componentes académicos y administrativos considerados para el seguimiento institucional y permite identificar el grado de consolidación del proceso.",
      "Respecto del estado de matrícula, se identifican "+countPhrase(active,"estudiante activo","estudiantes activos")+" y "+countPhrase(retired,"estudiante retirado","estudiantes retirados")+". Esta distribución aporta contexto para interpretar la evolución del grupo y diferenciar los casos que continúan vinculados al proceso de aquellos que presentan una condición de retiro."
    ];
  }
  function observations(section,data){
    data=data||{};
    var summary=data.resumen||{};
    var compliance=percent(summary.porcentajeCumplimiento);
    var totalStudents=number(summary.totalEstudiantes);
    var totalGraduates=number(summary.totalGraduados);
    var pending=Math.max(0,totalStudents-totalGraduates);
    var graduateRate=totalStudents?Math.round((totalGraduates/totalStudents)*100):0;

    return [
      "A la fecha de emisión, el proceso registra una tasa de graduación del "+graduateRate+"%, correspondiente a "+totalGraduates+" graduados de un total de "+totalStudents+" estudiantes incluidos en el alcance del informe.",
      "Se mantienen "+countPhrase(pending,"caso sin registro de graduación","casos sin registro de graduación")+". Estos casos constituyen el principal grupo de seguimiento para el cierre progresivo del proceso de titulación.",
      "El cumplimiento general del "+compliance+"% evidencia el nivel agregado de avance de los requisitos considerados. Para decisiones o certificaciones individuales, el resultado global debe complementarse con la revisión del expediente específico de cada estudiante.",
      "La información presentada corresponde al corte institucional disponible a la fecha de emisión. Una actualización posterior de los registros académicos, administrativos o de titulación puede modificar los indicadores contenidos en una nueva versión del informe."
    ];
  }

  function periodNarrative(rows){
    rows=Array.isArray(rows)?rows:[];
    return rows.map(function(item,index){
      var students=number(item.estudiantes);
      var graduates=number(item.graduados);
      var pending=Math.max(0,students-graduates);
      var rate=students?Math.round((graduates/students)*100):0;
      var compliance=percent(item.cumplimiento);
      return "En el período "+cleanInstitutionalText(item.periodo)+
        " se registran "+countPhrase(students,"estudiante","estudiantes")+
        ", de los cuales "+graduates+" constan como graduados, equivalente al "+rate+
        "% del grupo. El cumplimiento promedio del período alcanza el "+compliance+
        "% y se mantienen "+countPhrase(pending,"caso sin graduación registrada","casos sin graduación registrada")+
        ". El mes de graduación asociado al período corresponde a "+cleanInstitutionalText(item.graduacion||"sin fecha calculable")+".";
    });
  }

  function comparativeAnalysis(rows){
    rows=Array.isArray(rows)?rows:[];
    if(!rows.length){return [];}

    var strongest=rows[0];
    var weakest=rows[0];

    rows.forEach(function(item){
      var currentStudents=number(item.estudiantes);
      var currentGraduates=number(item.graduados);
      var currentRate=currentStudents?currentGraduates/currentStudents:0;

      var strongStudents=number(strongest.estudiantes);
      var strongGraduates=number(strongest.graduados);
      var strongRate=strongStudents?strongGraduates/strongStudents:0;

      var weakStudents=number(weakest.estudiantes);
      var weakGraduates=number(weakest.graduados);
      var weakRate=weakStudents?weakGraduates/weakStudents:0;

      if(currentRate>strongRate){strongest=item;}
      if(currentRate<weakRate){weakest=item;}
    });

    var strongRatePct=number(strongest.estudiantes)
      ?Math.round(number(strongest.graduados)/number(strongest.estudiantes)*100)
      :0;
    var weakRatePct=number(weakest.estudiantes)
      ?Math.round(number(weakest.graduados)/number(weakest.estudiantes)*100)
      :0;

    var output=[
      "El comportamiento por período permite observar diferencias en la proporción de estudiantes que alcanzan la graduación. El período "+cleanInstitutionalText(strongest.periodo)+" presenta la mayor proporción registrada, con un "+strongRatePct+"% de graduación dentro de su grupo."
    ];

    if(rows.length>1 && cleanInstitutionalText(weakest.periodo)!==cleanInstitutionalText(strongest.periodo)){
      output.push(
        "En contraste, el período "+cleanInstitutionalText(weakest.periodo)+
        " registra una proporción de graduación del "+weakRatePct+
        "%. Esta diferencia justifica mantener un seguimiento diferenciado de los casos pendientes y de los requisitos que aún se encuentren en proceso de cierre."
      );
    }

    return output;
  }
  function tableExplanation(title){
    var name=text(title||"Detalle");
    if(name==="Resumen general"){
      return "Los indicadores complementarios presentan de manera sintética la composición del universo analizado y los principales resultados asociados al proceso de titulación.";
    }
    return "La tabla «"+name+"» organiza los resultados correspondientes al alcance del presente informe para facilitar su revisión institucional.";
  }
  function getSignatures(){
    if(Array.isArray(config.firmas)&&config.firmas.length){return config.firmas.slice(0,1);}
    return [
      {responsabilidad:"ELABORADO POR:",nombre:"Mgtr. Jefferson Villarreal",cargo:"Coordinador de Titulación y Eficiencia Terminal"}
    ];
  }
  function graduateRows(data){return rowSource("graduados",data||{});}
  function sortPeriodRows(rows){
    var helpers=window.GlobalCore&&window.GlobalCore.helpers;
    return (rows||[]).slice().sort(function(a,b){
      if(helpers&&typeof helpers.comparePeriods==="function"){
        return helpers.comparePeriods(a.periodo,b.periodo);
      }
      return text(a.periodo).localeCompare(text(b.periodo),"es",{sensitivity:"base"});
    });
  }

  function periodRows(data){
    data=data||{};
    var rows=appRows("periodos",data);

    if(!rows.length){
      var helpers=window.GlobalCore&&window.GlobalCore.helpers;
      var map=Object.create(null);

      (Array.isArray(data.students)?data.students:[]).forEach(function(row){
        var period=text(row&&(
          row._globalPeriodoLabel||
          row._globalPeriodoId
        ))||"SIN PERÍODO";

        if(!map[period]){
          map[period]={
            periodo:period,
            graduacion:helpers&&typeof helpers.graduationLabelForPeriod==="function"
              ?helpers.graduationLabelForPeriod(period)
              :"",
            estudiantes:0,
            graduados:0,
            cumplimientoTotal:0
          };
        }

        map[period].estudiantes+=1;
        if(row&&row._globalEsGraduado===true){map[period].graduados+=1;}
        map[period].cumplimientoTotal+=number(
          row&&row._globalCumplimiento&&row._globalCumplimiento.porcentaje
        );
      });

      rows=Object.keys(map).map(function(period){
        var item=map[period];
        return {
          periodo:item.periodo,
          graduacion:item.graduacion,
          estudiantes:item.estudiantes,
          graduados:item.graduados,
          cumplimiento:item.estudiantes
            ?Math.round(item.cumplimientoTotal/item.estudiantes)
            :0
        };
      });
    }

    return sortPeriodRows(rows).map(function(item){
      return {
        periodo:text(item.periodo),
        graduacion:text(item.graduacion),
        estudiantes:number(item.estudiantes),
        graduados:number(item.graduados),
        cumplimiento:number(item.cumplimiento)
      };
    });
  }

  function displayPeriodRows(rows){
    return (rows||[]).map(function(item){
      return {
        periodo:item.periodo,
        graduacion:item.graduacion||"Sin fecha calculable",
        estudiantes:item.estudiantes,
        graduados:item.graduados,
        cumplimiento:item.cumplimiento+"%"
      };
    });
  }

  function buildModel(options){
    options=options||{};
    var section=sectionById(options.section||"resumen");
    var data=options.data||{};
    var filters=options.filters||data.filters||{};
    var table=tableForSection(section.id,data);
    table.rows=(table.rows||[]).map(function(row){
      var copy={};
      Object.keys(row||{}).forEach(function(key){
        copy[key]=typeof row[key]==="string"
          ?cleanInstitutionalText(row[key])
          :row[key];
      });
      return copy;
    });
    var periods=periodRows(data);
    var periodDisplay=displayPeriodRows(periods);
    var careerLabel=cleanInstitutionalText(
      selectedLabel("#globalFiltroCarrera","Todas las carreras")||"Todas las carreras"
    );
    var coverageLabel=periods.length
      ?periods.map(function(item){return item.periodo;}).join(" | ")
      :"Sin períodos disponibles";

    return {
      section:section,data:data,filters:filters,
      title:section.id==="resumen"
        ?"Informe consolidado de seguimiento de titulación"
        :(section.pdfTitulo||section.titulo||section.label||"Informe institucional"),
      unit:config.app&&config.app.unidad||"Unidad de Titulación y Eficiencia Terminal",
      generatedAt:formatDate(),
      careerLabel:careerLabel,
      coverageLabel:coverageLabel,
      filterRows:filterRows(filters),
      summary:summaryText(section,data),
      observations:observations(section,data),
      periodNarrative:periodNarrative(periods),
      comparativeAnalysis:comparativeAnalysis(periods),
      table:table,
      tableExplanation:tableExplanation(table.title),
      periodTable:{
        title:"Períodos incluidos",
        columns:[
          {key:"periodo",label:"Período"},
          {key:"graduacion",label:"Fecha de graduación"},
          {key:"estudiantes",label:"Estudiantes"},
          {key:"graduados",label:"Graduados"},
          {key:"cumplimiento",label:"Cumplimiento"}
        ],
        rows:periodDisplay
      },
      signatures:getSignatures(),
      graduateRows:graduateRows(data),
      label:label
    };
  }
  function tableHtml(table){
    var columns=table.columns||[],rows=table.rows||[];
    if(!rows.length){return '<div class="empty">No existen registros para el alcance definido.</div>';}
    return '<table><thead><tr>'+columns.map(function(column){return '<th>'+esc(column.label)+'</th>';}).join("")+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+columns.map(function(column){return '<td>'+esc(row&&row[column.key])+'</td>';}).join("")+'</tr>';}).join("")+'</tbody></table>';
  }
  function reportCss(){
    return '@page{size:A4;margin:10mm}*{box-sizing:border-box}.global-report-root{font-family:Arial,sans-serif;color:#172033;background:#fff;font-size:11px;width:100%}'+
      '.global-report-root .cover{min-height:265mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;page-break-after:always}'+
      '.global-report-root .logoBox{padding:0;margin-bottom:18px}.global-report-root .logoBox img{display:block;max-width:235px;max-height:92px;object-fit:contain}'+
      '.global-report-root .gold{width:120px;height:5px;background:#C9A227;margin:18px auto 24px}.global-report-root .unit{font-size:15px;font-weight:700;text-transform:uppercase}'+
      '.global-report-root .title{font-size:28px;color:#071A33;margin:18px 0}.global-report-root .date{color:#667085}'+
      '.global-report-root .header{border-bottom:3px solid #C9A227;padding-bottom:10px;margin-bottom:18px}.global-report-root .header h1{font-size:20px;margin:0;color:#071A33}.global-report-root .header p{margin:5px 0 0;color:#667085}'+
      '.global-report-root .section{margin:18px 0;page-break-inside:avoid}.global-report-root .section h2{font-size:15px;color:#071A33;border-left:5px solid #C9A227;padding-left:9px}'+
      '.global-report-root .filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.global-report-root .filter{border:1px solid #d8dee9;padding:8px;border-radius:6px}.global-report-root .filter strong{display:block;color:#071A33}'+
      '.global-report-root .summary li,.global-report-root .observations li{margin:7px 0;line-height:1.45}.global-report-root table{width:100%;border-collapse:collapse;font-size:9px}'+
      '.global-report-root th{background:#071A33;color:white;padding:7px;text-align:left}.global-report-root td{border:1px solid #d8dee9;padding:6px;vertical-align:top}.global-report-root tr:nth-child(even) td{background:#f6f8fb}'+
      '.global-report-root .empty{padding:18px;border:1px dashed #98a2b3;text-align:center}.global-report-root .signatures{max-width:340px;margin:58px auto 0;page-break-inside:avoid}'+
      '.global-report-root .signature{text-align:center;padding-top:46px;border-top:1px solid #172033}.global-report-root .signature strong,.global-report-root .signature span{display:block}.global-report-root .signature small{display:block;margin-bottom:6px;font-weight:700}'+
      '.global-report-root .footer{margin-top:25px;padding-top:8px;border-top:1px solid #d8dee9;color:#667085;font-size:9px;text-align:center}';
  }
  function reportBody(model,logo){
    var periodBlock="";
    if(model.periodTable&&model.periodTable.rows&&model.periodTable.rows.length){
      periodBlock='<section class="section"><h2>3. Resultados por período académico</h2><p>La distribución por período permite revisar estudiantes, graduados, mes de graduación y nivel de cumplimiento.</p>'+tableHtml(model.periodTable)+'</section>';
    }

    return '<div class="global-report-root">'+
      '<section class="cover"><div class="logoBox"><img src="'+esc(logo)+'" alt="ITSQMET"></div><div class="gold"></div><div class="unit">'+esc(model.unit)+'</div><h1 class="title">'+esc(model.title)+'</h1><p><strong>Carrera:</strong> '+esc(model.careerLabel)+'</p><p><strong>Períodos académicos analizados:</strong> '+esc(model.coverageLabel)+'</p><div class="date">Fecha de emisión: '+esc(model.generatedAt)+'</div></section>'+
      '<header class="header"><h1>Informe de seguimiento de titulación</h1><p>'+esc(model.unit)+'</p></header>'+
      '<section class="section"><h2>1. Alcance del informe</h2><p>El presente informe consolida la información académica y de titulación correspondiente al alcance definido en la portada.</p></section>'+
      '<section class="section"><h2>2. Resultados generales</h2>'+model.summary.map(function(item){return '<p>'+esc(item)+'</p>';}).join("")+'</section>'+
      periodBlock+
      '<section class="section"><h2>4. Consideraciones finales</h2>'+model.observations.map(function(item){return '<p>'+esc(item)+'</p>';}).join("")+'</section>'+
      '<div class="footer">ITSQMET · Unidad de Titulación y Eficiencia Terminal</div></div>';
  }
  function reportHtml(model,logo){
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>'+esc(model.title)+'</title><style>'+reportCss()+'</style></head><body>'+reportBody(model,logo||absoluteUrl((config.branding||{}).logoPath||"assets/branding/logo-instituto.png"))+'</body></html>';
  }
  function loadScript(src){
    return new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=src;
      script.async=true;
      script.onload=function(){resolve(true);};
      script.onerror=function(){reject(new Error("No se pudo cargar "+src));};
      (document.head||document.documentElement||document.body).appendChild(script);
    });
  }

  function jsPDFConstructor(){
    if(window.jspdf&&typeof window.jspdf.jsPDF==="function"){return window.jspdf.jsPDF;}
    if(typeof window.jsPDF==="function"){return window.jsPDF;}
    return null;
  }

  function ensurePdfEngine(){
    var current=jsPDFConstructor();
    if(current){return Promise.resolve(current);}
    if(pdfEngineLoading){return pdfEngineLoading;}

    pdfEngineLoading=(function tryPath(index){
      if(index>=JSPDF_PATHS.length){
        return Promise.reject(new Error("No se pudo cargar jsPDF para generar el reporte."));
      }
      return loadScript(JSPDF_PATHS[index]).then(function(){
        var ctor=jsPDFConstructor();
        if(ctor){return ctor;}
        return tryPath(index+1);
      }).catch(function(){
        return tryPath(index+1);
      });
    })(0).finally(function(){
      pdfEngineLoading=null;
    });

    return pdfEngineLoading;
  }

  function loadLogoSource(){
    return Promise.resolve(EMBEDDED_LOGO);
  }

  function filename(model){
    var career=cleanInstitutionalText(selectedLabel("#globalFiltroCarrera",""));
    if(!career||career==="Todas las carreras"){career="Todas_las_carreras";}
    return "Informe_Titulacion_"+slug(career)+"_"+todayISO()+".pdf";
  }

  function pdfColor(doc,name){
    if(name==="navy"){doc.setTextColor(7,26,51);return;}
    if(name==="muted"){doc.setTextColor(102,112,133);return;}
    if(name==="gold"){doc.setTextColor(201,162,39);return;}
    doc.setTextColor(23,32,51);
  }

  function pageMetrics(doc){
    return {
      width:doc.internal.pageSize.getWidth(),
      height:doc.internal.pageSize.getHeight(),
      margin:14,
      bottom:16
    };
  }

  function addRunningHeader(doc,model){
    var m=pageMetrics(doc);
    doc.setDrawColor(201,162,39);
    doc.setLineWidth(0.8);
    doc.line(m.margin,13,m.width-m.margin,13);
    doc.setFont("helvetica","bold");
    doc.setFontSize(8.5);
    pdfColor(doc,"navy");
    doc.text("INFORME DE SEGUIMIENTO DE TITULACIÓN",m.margin,9.5);
    doc.setFont("helvetica","normal");
    doc.setFontSize(7.3);
    pdfColor(doc,"muted");
    doc.text(text(model.unit),m.width-m.margin,9.5,{align:"right",maxWidth:82});
    return 20;
  }

  function ensureSpace(doc,model,y,needed){
    var m=pageMetrics(doc);
    if(y+needed<=m.height-m.bottom){return y;}
    doc.addPage();
    return addRunningHeader(doc,model);
  }

  function drawParagraph(doc,model,value,y,options){
    options=options||{};
    var m=pageMetrics(doc);
    var fontSize=Number(options.fontSize||9.5);
    var lineHeight=fontSize*0.43;
    var maxWidth=Number(options.maxWidth||m.width-m.margin*2);
    doc.setFont("helvetica",options.bold?"bold":"normal");
    doc.setFontSize(fontSize);
    pdfColor(doc,options.color||"body");
    var lines=doc.splitTextToSize(text(value),maxWidth);
    y=ensureSpace(doc,model,y,Math.max(6,lines.length*lineHeight+2));
    doc.text(lines,m.margin,y);
    return y+Math.max(5,lines.length*lineHeight)+2;
  }

  function drawSectionTitle(doc,model,title,y){
    var m=pageMetrics(doc);
    y=ensureSpace(doc,model,y,12);
    doc.setDrawColor(201,162,39);
    doc.setLineWidth(1.2);
    doc.line(m.margin,y-3,m.margin,y+3.5);
    doc.setFont("helvetica","bold");
    doc.setFontSize(11.5);
    pdfColor(doc,"navy");
    doc.text(text(title),m.margin+4,y);
    return y+7;
  }

  function drawFilters(doc,model,y){
    var m=pageMetrics(doc);
    var width=(m.width-m.margin*2-4)/2;
    (model.filterRows||[]).forEach(function(item,index){
      if(index%2===0){
        y=ensureSpace(doc,model,y,15);
      }
      var x=m.margin+(index%2)*(width+4);
      doc.setDrawColor(216,222,233);
      doc.setFillColor(248,250,252);
      doc.roundedRect(x,y-4,width,12,1.5,1.5,"FD");
      doc.setFont("helvetica","bold");
      doc.setFontSize(7.5);
      pdfColor(doc,"navy");
      doc.text(text(item.filtro),x+2,y);
      doc.setFont("helvetica","normal");
      doc.setFontSize(7.5);
      pdfColor(doc,"body");
      var value=doc.splitTextToSize(text(item.valor),width-4);
      doc.text(value.slice(0,2),x+2,y+4);
      if(index%2===1||index===model.filterRows.length-1){y+=15;}
    });
    return y;
  }

  function normalizeCell(value,columnKey){
    if(value==null){return "";}
    if(typeof value==="number"){return String(value);}
    if(typeof value==="boolean"){return value?"Sí":"No";}
    if(typeof value==="object"){
      try{return JSON.stringify(value);}
      catch(error){return String(value);}
    }

    return cleanInstitutionalText(String(value));
  }

  function tableFontSize(columnCount){
    if(columnCount>=9){return 5.2;}
    if(columnCount>=7){return 5.8;}
    if(columnCount>=5){return 6.5;}
    return 7.2;
  }

  function drawTable(doc,model,table,y){
    table=table||{columns:[],rows:[]};
    var columns=table.columns||[];
    var rows=table.rows||[];
    var m=pageMetrics(doc);

    if(!columns.length){
      return drawParagraph(doc,model,"Sin columnas disponibles.",y,{color:"muted"});
    }
    if(!rows.length){
      return drawParagraph(doc,model,"No existen registros para el alcance definido.",y,{color:"muted"});
    }

    var usable=m.width-m.margin*2;
    var colWidth=usable/columns.length;
    var fontSize=tableFontSize(columns.length);
    var lineHeight=fontSize*0.39;
    var headerHeight=8;

    function drawHeader(currentY){
      currentY=ensureSpace(doc,model,currentY,headerHeight+4);
      doc.setFillColor(7,26,51);
      doc.setDrawColor(7,26,51);
      doc.rect(m.margin,currentY,usable,headerHeight,"FD");
      doc.setFont("helvetica","bold");
      doc.setFontSize(fontSize);
      doc.setTextColor(255,255,255);
      columns.forEach(function(column,index){
        var x=m.margin+index*colWidth;
        var lines=doc.splitTextToSize(text(column.label),Math.max(8,colWidth-2));
        doc.text(lines.slice(0,2),x+1,currentY+3);
      });
      return currentY+headerHeight;
    }

    y=drawHeader(y);

    rows.forEach(function(row,rowIndex){
      var cells=columns.map(function(column){
        return doc.splitTextToSize(normalizeCell(row&&row[column.key],column.key),Math.max(8,colWidth-2));
      });
      var maxLines=1;
      cells.forEach(function(lines){maxLines=Math.max(maxLines,Math.min(lines.length,6));});
      var rowHeight=Math.max(6,maxLines*lineHeight+2.2);

      if(y+rowHeight>m.height-m.bottom){
        doc.addPage();
        y=addRunningHeader(doc,model);
        y=drawHeader(y);
      }

      doc.setFillColor(rowIndex%2===0?255:247,rowIndex%2===0?255:249,rowIndex%2===0?255:252);
      doc.setDrawColor(216,222,233);
      columns.forEach(function(column,index){
        var x=m.margin+index*colWidth;
        doc.rect(x,y,colWidth,rowHeight,"FD");
      });

      doc.setFont("helvetica","normal");
      doc.setFontSize(fontSize);
      pdfColor(doc,"body");
      cells.forEach(function(lines,index){
        var x=m.margin+index*colWidth+1;
        doc.text(lines.slice(0,6),x,y+3);
      });
      y+=rowHeight;
    });

    return y+3;
  }

  function drawCover(doc,model,logo){
    var m=pageMetrics(doc);
    var center=m.width/2;

    if(logo){
      try{
        var props=doc.getImageProperties(logo);
        var w=62;
        var h=w*(props.height/props.width);
        if(h>27){h=27;w=h*(props.width/props.height);}
        doc.addImage(logo,"JPEG",center-w/2,28,w,h);
      }catch(error){
        doc.setFont("helvetica","bold");
        doc.setFontSize(17);
        pdfColor(doc,"navy");
        doc.text("ITSQMET",center,48,{align:"center"});
      }
    }else{
      doc.setFont("helvetica","bold");
      doc.setFontSize(17);
      pdfColor(doc,"navy");
      doc.text("ITSQMET",center,48,{align:"center"});
    }

    doc.setDrawColor(201,162,39);
    doc.setLineWidth(1.4);
    doc.line(center-20,67,center+20,67);

    doc.setFont("helvetica","bold");
    doc.setFontSize(11.5);
    pdfColor(doc,"navy");
    doc.text(text(model.unit).toUpperCase(),center,81,{align:"center",maxWidth:m.width-34});

    doc.setFontSize(21);
    var titleLines=doc.splitTextToSize(text(model.title).toUpperCase(),m.width-42);
    doc.text(titleLines,center,104,{align:"center"});

    doc.setFont("helvetica","bold");
    doc.setFontSize(10);
    pdfColor(doc,"body");
    doc.text("Carrera",center,137,{align:"center"});
    doc.setFont("helvetica","normal");
    doc.setFontSize(10.5);
    var careerLines=doc.splitTextToSize(text(model.careerLabel||"Todas las carreras"),m.width-50);
    doc.text(careerLines,center,145,{align:"center"});

    doc.setFont("helvetica","bold");
    doc.setFontSize(9.2);
    pdfColor(doc,"body");
    doc.text("Períodos académicos analizados",center,169,{align:"center"});
    doc.setFont("helvetica","normal");
    doc.setFontSize(8.8);
    pdfColor(doc,"muted");
    var coverageLines=doc.splitTextToSize(text(model.coverageLabel||"Sin períodos disponibles").replace(/ \| /g,"\n"),m.width-52);
    doc.text(coverageLines,center,177,{align:"center"});

    doc.setFontSize(8.5);
    doc.text("Fecha de emisión: "+text(model.generatedAt),center,201,{align:"center"});

    var signature=(model.signatures||[])[0];
    if(signature){
      var y=241;
      doc.setDrawColor(23,32,51);
      doc.setLineWidth(0.4);
      doc.line(center-28,y,center+28,y);
      doc.setFont("helvetica","normal");
      doc.setFontSize(7.2);
      pdfColor(doc,"muted");
      doc.text("Responsable del informe",center,y+5,{align:"center"});
      doc.setFont("helvetica","bold");
      doc.setFontSize(9.4);
      pdfColor(doc,"body");
      doc.text(text(signature.nombre||""),center,y+10,{align:"center"});
      doc.setFont("helvetica","normal");
      doc.setFontSize(8);
      doc.text(doc.splitTextToSize(text(signature.cargo||""),82),center,y+15,{align:"center"});
    }
  }

  function drawKpis(doc,model,y){
    var summary=model.data&&model.data.resumen||{};
    var cards=[
      {label:"Estudiantes",value:number(summary.totalEstudiantes)},
      {label:"Graduados",value:number(summary.totalGraduados)},
      {label:"Períodos",value:number(summary.totalPeriodos)},
      {label:"Cumplimiento",value:number(summary.porcentajeCumplimiento)+"%"}
    ];

    var m=pageMetrics(doc);
    var gap=3;
    var width=(m.width-m.margin*2-gap*3)/4;
    var height=18;

    y=ensureSpace(doc,model,y,height+3);

    cards.forEach(function(card,index){
      var x=m.margin+index*(width+gap);
      doc.setFillColor(248,250,252);
      doc.setDrawColor(216,222,233);
      doc.roundedRect(x,y,width,height,1.8,1.8,"FD");

      doc.setFont("helvetica","bold");
      doc.setFontSize(13);
      pdfColor(doc,"navy");
      doc.text(String(card.value),x+width/2,y+8,{align:"center"});

      doc.setFont("helvetica","normal");
      doc.setFontSize(7);
      pdfColor(doc,"muted");
      doc.text(card.label,x+width/2,y+13.5,{align:"center"});
    });

    return y+height+5;
  }

  function addFooterToAllPages(doc){
    var count=doc.getNumberOfPages();
    var m=pageMetrics(doc);
    for(var page=1;page<=count;page+=1){
      doc.setPage(page);
      doc.setDrawColor(216,222,233);
      doc.setLineWidth(0.3);
      doc.line(m.margin,m.height-10,m.width-m.margin,m.height-10);
      doc.setFont("helvetica","normal");
      doc.setFontSize(7);
      pdfColor(doc,"muted");
      doc.text("ITSQMET · Unidad de Titulación y Eficiencia Terminal",m.margin,m.height-6.5);
      doc.text("Página "+page+" de "+count,m.width-m.margin,m.height-6.5,{align:"right"});
    }
  }

  function renderPdf(doc,model,logo){
    drawCover(doc,model,logo);
    doc.addPage();

    var y=addRunningHeader(doc,model);

    y=drawSectionTitle(doc,model,"1. Antecedentes y objeto del informe",y);
    y=drawParagraph(
      doc,
      model,
      "La Unidad de Titulación y Eficiencia Terminal realiza el seguimiento de los procesos de culminación académica con el propósito de disponer de información consolidada que facilite la toma de decisiones, la identificación de casos pendientes y el análisis de la eficiencia terminal. En este contexto, el presente informe organiza los principales resultados correspondientes a la carrera "+text(model.careerLabel)+".",
      y,
      {fontSize:8.8}
    );
    y=drawParagraph(
      doc,
      model,
      "El documento tiene como objeto presentar el comportamiento de los estudiantes incluidos en los períodos académicos analizados, considerando la condición de graduación, el avance general de requisitos y el estado de matrícula. La información se expone de forma agregada para facilitar su lectura institucional.",
      y,
      {fontSize:8.8}
    );

    y=drawSectionTitle(doc,model,"2. Alcance y criterios de análisis",y+2);
    y=drawParagraph(
      doc,
      model,
      "El alcance comprende la carrera "+text(model.careerLabel)+" y los períodos académicos detallados en la portada. Los indicadores corresponden al corte disponible a la fecha de emisión del informe y reflejan el estado registrado de los procesos incluidos.",
      y,
      {fontSize:8.6}
    );
    y=drawParagraph(
      doc,
      model,
      "Para la lectura del documento se consideran cuatro indicadores centrales: número de estudiantes, número de graduados, períodos académicos y porcentaje general de cumplimiento. La fecha de graduación se expresa por mes y año y se determina dos meses después del mes de finalización del período académico; por ejemplo, un período que concluye en octubre se registra con graduación en diciembre.",
      y,
      {fontSize:8.6}
    );

    y=drawSectionTitle(doc,model,"3. Resultados generales",y+2);
    y=drawKpis(doc,model,y);
    (model.summary||[]).forEach(function(item){
      y=drawParagraph(doc,model,text(item),y,{fontSize:8.5});
    });

    if(model.periodTable&&Array.isArray(model.periodTable.rows)&&model.periodTable.rows.length){
      y=drawSectionTitle(doc,model,"4. Resultados por período académico",y+2);
      y=drawParagraph(
        doc,
        model,
        "La distribución por período permite revisar la relación entre estudiantes incluidos, graduados registrados, mes de graduación y nivel promedio de cumplimiento. Esta desagregación facilita la identificación de diferencias entre cohortes y de los casos que requieren continuidad en el seguimiento.",
        y,
        {fontSize:8.3}
      );
      y=drawTable(doc,model,model.periodTable,y);

      (model.periodNarrative||[]).forEach(function(item){
        y=drawParagraph(doc,model,text(item),y,{fontSize:8.3});
      });
    }

    y=drawSectionTitle(doc,model,"5. Análisis de eficiencia terminal",y+2);
    (model.comparativeAnalysis||[]).forEach(function(item){
      y=drawParagraph(doc,model,text(item),y,{fontSize:8.4});
    });
    y=drawParagraph(
      doc,
      model,
      "El análisis conjunto de graduación y cumplimiento permite diferenciar el avance del proceso académico de su cierre efectivo. Un porcentaje elevado de cumplimiento constituye una señal favorable de avance; sin embargo, la culminación del proceso se confirma mediante el registro de graduación de cada estudiante.",
      y,
      {fontSize:8.4}
    );

    y=drawSectionTitle(doc,model,"6. Conclusiones",y+2);
    (model.observations||[]).slice(0,3).forEach(function(item){
      y=drawParagraph(doc,model,text(item),y,{fontSize:8.3});
    });

    y=drawSectionTitle(doc,model,"7. Recomendaciones de seguimiento",y+2);
    y=drawParagraph(
      doc,
      model,
      "Mantener el seguimiento periódico de los estudiantes que aún no registran graduación, priorizando la identificación del requisito o etapa pendiente que impide el cierre de su proceso.",
      y,
      {fontSize:8.3}
    );
    y=drawParagraph(
      doc,
      model,
      "Revisar de forma periódica la evolución del cumplimiento por período académico, de manera que las variaciones puedan ser identificadas oportunamente y se establezcan acciones de acompañamiento cuando corresponda.",
      y,
      {fontSize:8.3}
    );
    y=drawParagraph(
      doc,
      model,
      "Actualizar el presente informe cuando se produzcan cambios relevantes en la condición de los estudiantes, con el fin de conservar una lectura institucional vigente de la eficiencia terminal.",
      y,
      {fontSize:8.3}
    );

    addFooterToAllPages(doc);
    return doc;
  }

  function generate(options){
    var model=buildModel(options||{});
    return Promise.all([ensurePdfEngine(),loadLogoSource()]).then(function(values){
      var JsPDF=values[0];
      var logo=values[1];
      var doc=new JsPDF({
        orientation:"portrait",
        unit:"mm",
        format:"a4",
        compress:true,
        putOnlyUsedFonts:true
      });

      renderPdf(doc,model,logo);
      doc.save(filename(model));
      return true;
    });
  }
  var api={
    version:VERSION,generate:generate,buildModel:buildModel,tableForSection:tableForSection,
    summaryText:summaryText,observations:observations,filterRows:filterRows,
    tableExplanation:tableExplanation,label:label,graduateRows:graduateRows,getSignatures:getSignatures,
    periodRows:periodRows,reportHtml:reportHtml
  };
  window.GlobalPDF=api;
  window.__globalPdfReady=Promise.resolve(api);
  try{window.dispatchEvent(new CustomEvent("global:pdf-ready",{detail:{ok:true,version:VERSION,directRuntime:true,directJsPdf:true,autoDownload:true}}));}catch(error){}
})(window,document);

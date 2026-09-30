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

  var VERSION="3.2.0-formal-document";
  var EMBEDDED_LOGO="data:image/png;base64,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";
  var config=window.GlobalConfig||{};
  var pdfEngineLoading=null;
  var JSPDF_PATHS=[
    "../node_modules/jspdf/dist/jspdf.umd.min.js",
    "../node_modules/html2pdf.js/node_modules/jspdf/dist/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"
  ];

  function text(value){return String(value==null?"":value).trim();}
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
    return found||{id:id||"resumen",label:"Global",titulo:"Reporte Global",pdfTitulo:"Reporte Global"};
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
    if(filters.periodoDesde){rows.push({filtro:"Período desde",valor:selectedLabel("#globalFiltroDesde",filters.periodoDesde)});}
    if(filters.periodoHasta){rows.push({filtro:"Período hasta",valor:selectedLabel("#globalFiltroHasta",filters.periodoHasta)});}
    if(filters.carrera){rows.push({filtro:"Carrera",valor:selectedLabel("#globalFiltroCarrera",filters.carrera)});}
    if(filters.division){rows.push({filtro:"División",valor:selectedLabel("#globalFiltroDivision",filters.division)});}
    if(filters.requisito){rows.push({filtro:"Requisito",valor:selectedLabel("#globalFiltroRequisito",filters.requisito)});}
    if(filters.tipoCarrera){rows.push({filtro:"Tipo de carrera",valor:selectedLabel("#globalFiltroTipo",filters.tipoCarrera)});}
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
    var compliance=number(summary.porcentajeCumplimiento);
    var active=number(summary.activos);
    var retired=number(summary.retirados);
    var graduateRate=totalStudents?Math.round((totalGraduates/totalStudents)*100):0;

    return [
      "El análisis comprende "+totalStudents+" estudiante(s) perteneciente(s) al ámbito académico definido para el presente informe y distribuidos en "+totalPeriods+" período(s) académico(s). La información consolidada permite observar de manera conjunta el avance del proceso de titulación y el estado general de cumplimiento.",
      "Del total analizado, "+totalGraduates+" estudiante(s) registran la culminación satisfactoria del proceso de titulación, equivalente aproximadamente al "+graduateRate+"% del universo considerado. Este resultado constituye el principal indicador de eficiencia terminal dentro del alcance del informe.",
      "El cumplimiento general de requisitos alcanza el "+compliance+"%. Este porcentaje resume el nivel de avance de los requisitos académicos y administrativos que cuentan con información registrada para los estudiantes incluidos.",
      "En cuanto al estado de matrícula, se identifican "+active+" estudiante(s) activos y "+retired+" estudiante(s) retirados. Estos datos complementan el análisis de titulación y permiten contextualizar los resultados presentados por período académico."
    ];
  }

  function observations(section,data){
    data=data||{};
    var summary=data.resumen||{};
    var compliance=number(summary.porcentajeCumplimiento);
    var totalStudents=number(summary.totalEstudiantes);
    var totalGraduates=number(summary.totalGraduados);

    return [
      "Los resultados presentados corresponden al corte institucional disponible a la fecha de emisión del presente informe y reflejan el estado registrado de los procesos académicos, administrativos y de titulación de los estudiantes comprendidos en el análisis.",
      "Para efectos del seguimiento institucional, el mes de graduación se determina dos meses después del mes de finalización del período académico. De este modo, un período que concluye en octubre se registra con graduación en diciembre.",
      "El cumplimiento general del "+compliance+"% constituye un indicador agregado de seguimiento. Cuando se requiera sustento para decisiones individuales, deberá revisarse el expediente específico del estudiante y la documentación correspondiente.",
      "En términos generales, el informe registra "+totalGraduates+" estudiante(s) graduados de un total de "+totalStudents+", junto con la evolución por período académico. Esta información permite orientar el seguimiento de eficiencia terminal y priorizar los casos que aún requieren cierre o validación."
    ];
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
    var periods=periodRows(data);
    var periodDisplay=displayPeriodRows(periods);
    var careerLabel=selectedLabel("#globalFiltroCarrera","Todas las carreras")||"Todas las carreras";
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
    if(!rows.length){return '<div class="empty">Sin registros para los filtros seleccionados.</div>';}
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
    var career=selectedLabel("#globalFiltroCarrera","");
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

  function normalizeCell(value){
    if(value==null){return "";}
    if(typeof value==="number"){return String(value);}
    if(typeof value==="boolean"){return value?"Sí":"No";}
    if(typeof value==="object"){
      try{return JSON.stringify(value);}
      catch(error){return String(value);}
    }
    return String(value);
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
      return drawParagraph(doc,model,"Sin registros para los filtros seleccionados.",y,{color:"muted"});
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
        return doc.splitTextToSize(normalizeCell(row&&row[column.key]),Math.max(8,colWidth-2));
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
        doc.addImage(logo,"PNG",center-w/2,28,w,h);
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

    y=drawSectionTitle(doc,model,"1. Alcance del informe",y);
    y=drawParagraph(
      doc,
      model,
      "El presente informe consolida la información correspondiente a la carrera "+text(model.careerLabel)+", considerando los períodos académicos señalados en la portada. Su propósito es presentar, en un único documento, los principales resultados relacionados con estudiantes, graduación y cumplimiento de requisitos para apoyar el seguimiento de eficiencia terminal.",
      y,
      {fontSize:8.7}
    );

    y=drawSectionTitle(doc,model,"2. Resultados generales",y+2);
    y=drawKpis(doc,model,y);
    (model.summary||[]).forEach(function(item){
      y=drawParagraph(doc,model,text(item),y,{fontSize:8.5});
    });

    if(model.periodTable&&Array.isArray(model.periodTable.rows)&&model.periodTable.rows.length){
      y=drawSectionTitle(doc,model,"3. Resultados por período académico",y+2);
      y=drawParagraph(
        doc,
        model,
        "La distribución por período permite identificar la relación entre estudiantes incluidos, graduados registrados, mes de graduación y nivel promedio de cumplimiento.",
        y,
        {fontSize:8.2,color:"muted"}
      );
      y=drawTable(doc,model,model.periodTable,y);
    }

    if(model.section.id!=="resumen"){
      y=drawSectionTitle(doc,model,"4. Detalle del análisis",y+2);
      y=drawParagraph(doc,model,model.tableExplanation||"",y,{fontSize:8,color:"muted"});
      y=drawTable(doc,model,model.table,y);
    }

    y=drawSectionTitle(doc,model,model.section.id==="resumen"?"4. Consideraciones finales":"5. Consideraciones finales",y+2);
    (model.observations||[]).forEach(function(item){
      y=drawParagraph(doc,model,text(item),y,{fontSize:8.2});
    });

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

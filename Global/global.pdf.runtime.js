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

  var VERSION="3.1.0-executive-report";
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
    var totalCareers=number(summary.totalCarreras||data.careers&&data.careers.length);
    var totalPeriods=number(summary.totalPeriodos||data.periods&&data.periods.length);
    var compliance=number(summary.porcentajeCumplimiento);
    var active=number(summary.activos);
    var retired=number(summary.retirados);
    var graduateRate=totalStudents?Math.round((totalGraduates/totalStudents)*100):0;

    return [
      "El presente reporte consolida la información de "+totalStudents+" estudiante(s), correspondiente(s) a "+totalCareers+" carrera(s) y "+totalPeriods+" período(s) académico(s), de acuerdo con los filtros seleccionados al momento de la generación.",
      "Dentro del universo analizado, "+totalGraduates+" estudiante(s) constan como graduados, lo que representa aproximadamente el "+graduateRate+"% del total considerado en este corte institucional.",
      "El cumplimiento general de requisitos alcanza el "+compliance+"%. Este indicador se calcula a partir de los requisitos que cuentan con información registrada en la Base Local y permite observar el nivel general de avance del grupo analizado.",
      "En relación con el estado de matrícula, se registran "+active+" estudiante(s) activos y "+retired+" estudiante(s) retirados. Estos valores deben interpretarse conjuntamente con el período, la carrera y los demás filtros aplicados."
    ];
  }

  function observations(section,data){
    data=data||{};
    var summary=data.resumen||{};
    var compliance=number(summary.porcentajeCumplimiento);

    return [
      "Las cifras presentadas corresponden al estado de la Base Local en el momento exacto de generación del reporte; cualquier actualización posterior de requisitos, matrícula o titulación modificará los resultados en una nueva emisión.",
      "Para efectos de este informe, la fecha de graduación se expresa por mes y año y se calcula dos meses después del mes de finalización del período académico. Por ejemplo, un período que finaliza en octubre se reporta con graduación en diciembre.",
      "El porcentaje de cumplimiento general ("+compliance+"%) debe utilizarse como un indicador de seguimiento y no como sustituto de la validación individual de cada expediente. La revisión específica por estudiante continúa siendo necesaria cuando se requiera sustento documental.",
      "El reporte busca facilitar el seguimiento institucional de titulación, permitiendo identificar el volumen de estudiantes, graduados, períodos involucrados y nivel de cumplimiento bajo un mismo corte de información."
    ];
  }

  function tableExplanation(title){
    var name=text(title||"Detalle");
    if(name==="Resumen general"){
      return "La siguiente tabla presenta los principales indicadores cuantitativos del universo analizado y complementa el resumen ejecutivo con una descripción breve de cada resultado.";
    }
    return "La tabla «"+name+"» organiza los registros correspondientes a la sección seleccionada y permite revisar de forma estructurada los resultados obtenidos con los filtros activos.";
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
      ?(
        periods.length===1
          ?periods[0].periodo
          :"Desde "+periods[0].periodo+" hasta "+periods[periods.length-1].periodo
      )
      :"Sin períodos disponibles";

    return {
      section:section,data:data,filters:filters,
      title:section.pdfTitulo||section.titulo||section.label||"Reporte Global",
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
    if(model.section.id!=="periodos"&&model.periodTable&&model.periodTable.rows&&model.periodTable.rows.length){
      periodBlock='<section class="section"><h2>Períodos incluidos</h2><p>Períodos académicos considerados y fecha de graduación calculada.</p>'+tableHtml(model.periodTable)+'</section>';
    }
    return '<div class="global-report-root">'+
      '<section class="cover"><div class="logoBox"><img src="'+esc(logo)+'" alt="ITSQMET"></div><div class="gold"></div><div class="unit">'+esc(model.unit)+'</div><h1 class="title">'+esc(model.title)+'</h1><div class="date">Generado el '+esc(model.generatedAt)+'</div></section>'+
      '<header class="header"><h1>'+esc(model.title)+'</h1><p>'+esc(model.unit)+' · '+esc(model.generatedAt)+'</p></header>'+
      '<section class="section"><h2>Filtros aplicados</h2><div class="filters">'+model.filterRows.map(function(item){return '<div class="filter"><strong>'+esc(item.filtro)+'</strong>'+esc(item.valor)+'</div>';}).join("")+'</div></section>'+
      '<section class="section"><h2>Resumen ejecutivo</h2><ul class="summary">'+model.summary.map(function(item){return '<li>'+esc(item)+'</li>';}).join("")+'</ul></section>'+
      periodBlock+
      '<section class="section"><h2>'+esc(model.table.title)+'</h2><p>'+esc(model.tableExplanation)+'</p>'+tableHtml(model.table)+'</section>'+
      '<section class="section"><h2>Observaciones</h2><ul class="observations">'+model.observations.map(function(item){return '<li>'+esc(item)+'</li>';}).join("")+'</ul></section>'+
      '<section class="signatures">'+model.signatures.map(function(item){return '<div class="signature"><small>'+esc(item.responsabilidad||"")+'</small><strong>'+esc(item.nombre||"")+'</strong><span>'+esc(item.cargo||"")+'</span></div>';}).join("")+'</section>'+
      '<div class="footer">ITSQMET · Reporte institucional generado desde Global</div></div>';
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
    var url=absoluteUrl((config.branding||{}).logoPath||"assets/branding/logo-instituto.png");

    if(typeof window.fetch!=="function"){
      return Promise.resolve(null);
    }

    return window.fetch(url,{cache:"no-store"}).then(function(response){
      if(!response.ok){throw new Error("No se pudo cargar el logo institucional.");}
      return response.blob();
    }).then(function(blob){
      return new Promise(function(resolve,reject){
        var objectUrl=null;
        try{
          objectUrl=window.URL.createObjectURL(blob);
        }catch(error){
          reject(error);
          return;
        }

        var image=new window.Image();
        image.onload=function(){
          try{
            var canvas=document.createElement("canvas");
            var width=Math.max(1,image.naturalWidth||image.width||188);
            var height=Math.max(1,image.naturalHeight||image.height||78);
            canvas.width=width;
            canvas.height=height;

            var ctx=canvas.getContext("2d");
            ctx.fillStyle="#ffffff";
            ctx.fillRect(0,0,width,height);
            ctx.drawImage(image,0,0,width,height);

            var normalized=canvas.toDataURL("image/jpeg",0.95);
            window.URL.revokeObjectURL(objectUrl);
            resolve(normalized);
          }catch(error){
            try{window.URL.revokeObjectURL(objectUrl);}catch(innerError){}
            reject(error);
          }
        };
        image.onerror=function(){
          try{window.URL.revokeObjectURL(objectUrl);}catch(innerError){}
          reject(new Error("No se pudo normalizar el logo institucional."));
        };
        image.src=objectUrl;
      });
    }).catch(function(){
      return null;
    });
  }

  function filename(model){
    var career=selectedLabel("#globalFiltroCarrera","");
    if(!career||career==="Todas las carreras"){career="Todas_las_carreras";}
    return "Global_"+slug(model.section&&model.section.label||"Reporte")+"_"+slug(career)+"_"+todayISO()+".pdf";
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
    doc.setFontSize(9);
    pdfColor(doc,"navy");
    doc.text(text(model.title),m.margin,9.5,{maxWidth:m.width-m.margin*2});
    doc.setFont("helvetica","normal");
    doc.setFontSize(7.5);
    pdfColor(doc,"muted");
    doc.text(text(model.unit),m.width-m.margin,9.5,{align:"right",maxWidth:80});
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
        var w=60;
        var h=w*(props.height/props.width);
        if(h>30){h=30;w=h*(props.width/props.height);}
        doc.addImage(logo,"JPEG",center-w/2,42,w,h);
      }catch(error){
        logo=null;
      }
    }

    if(!logo){
      doc.setFont("helvetica","bold");
      doc.setFontSize(18);
      pdfColor(doc,"navy");
      doc.text(text((config.branding||{}).logoFallbackText||"ITSQMET"),center,58,{align:"center"});
    }

    doc.setDrawColor(201,162,39);
    doc.setLineWidth(1.6);
    doc.line(center-18,84,center+18,84);

    doc.setFont("helvetica","bold");
    doc.setFontSize(12);
    pdfColor(doc,"navy");
    doc.text(text(model.unit).toUpperCase(),center,99,{align:"center",maxWidth:m.width-36});

    doc.setFontSize(23);
    var titleLines=doc.splitTextToSize(text(model.title),m.width-42);
    doc.text(titleLines,center,121,{align:"center"});

    doc.setFont("helvetica","bold");
    doc.setFontSize(10);
    pdfColor(doc,"body");
    var careerLines=doc.splitTextToSize(text(model.careerLabel||"Todas las carreras"),m.width-50);
    doc.text(careerLines,center,145,{align:"center"});

    doc.setFont("helvetica","normal");
    doc.setFontSize(8.8);
    pdfColor(doc,"muted");
    var coverageLines=doc.splitTextToSize("Cobertura académica: "+text(model.coverageLabel||"Sin períodos disponibles"),m.width-52);
    doc.text(coverageLines,center,158,{align:"center"});

    doc.setFontSize(8.5);
    doc.text("Documento de seguimiento institucional generado desde Global.",center,177,{align:"center"});
    doc.text("Generado el "+text(model.generatedAt),center,184,{align:"center"});
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
      doc.text("ITSQMET · Reporte institucional Global",m.margin,m.height-6.5);
      doc.text("Página "+page+" de "+count,m.width-m.margin,m.height-6.5,{align:"right"});
    }
  }

  function renderPdf(doc,model,logo){
    drawCover(doc,model,logo);
    doc.addPage();

    var y=addRunningHeader(doc,model);

    y=drawSectionTitle(doc,model,"Filtros aplicados",y);
    y=drawFilters(doc,model,y);

    y=drawSectionTitle(doc,model,"Resumen ejecutivo",y+2);
    y=drawKpis(doc,model,y);
    (model.summary||[]).forEach(function(item){
      y=drawParagraph(doc,model,text(item),y,{fontSize:8.8});
    });

    if(
      model.section.id!=="periodos" &&
      model.periodTable &&
      Array.isArray(model.periodTable.rows) &&
      model.periodTable.rows.length
    ){
      y=drawSectionTitle(doc,model,"Períodos incluidos",y+2);
      y=drawParagraph(
        doc,
        model,
        "La tabla resume cada período académico considerado en el corte, el mes estimado de graduación, el número de estudiantes incluidos, los graduados registrados y el promedio de cumplimiento del período.",
        y,
        {fontSize:8.2,color:"muted"}
      );
      y=drawTable(doc,model,model.periodTable,y);
    }

    y=drawSectionTitle(doc,model,model.table.title||"Detalle",y+2);
    y=drawParagraph(doc,model,model.tableExplanation||"",y,{fontSize:8,color:"muted"});
    y=drawTable(doc,model,model.table,y);

    y=drawSectionTitle(doc,model,"Observaciones",y+2);
    (model.observations||[]).forEach(function(item){
      y=drawParagraph(doc,model,"• "+text(item),y,{fontSize:8.5});
    });

    y=ensureSpace(doc,model,y+10,28);
    var signature=(model.signatures||[])[0];
    if(signature){
      var m=pageMetrics(doc);
      var center=m.width/2;
      doc.setDrawColor(23,32,51);
      doc.setLineWidth(0.4);
      doc.line(center-28,y,center+28,y);
      doc.setFont("helvetica","normal");
      doc.setFontSize(7.2);
      pdfColor(doc,"muted");
      doc.text("Responsable del reporte",center,y+4.5,{align:"center"});
      doc.setFont("helvetica","bold");
      doc.setFontSize(9.5);
      pdfColor(doc,"body");
      doc.text(text(signature.nombre||""),center,y+9.5,{align:"center"});
      doc.setFont("helvetica","normal");
      doc.setFontSize(8);
      doc.text(doc.splitTextToSize(text(signature.cargo||""),80),center,y+14.5,{align:"center"});
    }

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

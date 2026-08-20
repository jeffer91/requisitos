/* =========================================================
Nombre completo: stats.closure.pdf.js
Ruta o ubicación: /Stats/stats.closure.pdf.js
Función:
- Generar un informe PDF formal de cierre, no una captura de la pantalla.
- Incluir resumen ejecutivo, causas, requisitos, carreras, aprobación final y detalle.
- Renderizar una plantilla dedicada en una zona visible para evitar páginas blancas en Electron/html2canvas.
- Usar html2pdf.js local y mantener respaldo de carga.
========================================================= */
(function(window,document){
  "use strict";

  var exporting=false;
  var enginePromise=null;

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function num(value){value=Number(value);return Number.isFinite(value)?value:0;}
  function pct(value,total){var d=num(total);return d>0?Math.round((num(value)*10000)/d)/100:0;}
  function esc(value){
    return text(value)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }
  function slug(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .replace(/[^0-9A-Za-z_-]+/g,"_")
      .replace(/_+/g,"_")
      .replace(/^_+|_+$/g,"");
  }
  function state(){
    return window.StatsApp&&typeof window.StatsApp.getState==="function"
      ? window.StatsApp.getState()||{}
      : {};
  }
  function currentReport(){
    if(!window.StatsClosure||typeof window.StatsClosure.build!=="function"){return null;}
    try{return window.StatsClosure.build()||null;}catch(error){return null;}
  }
  function selectedText(id,fallback){
    var node=el(id);
    if(node&&node.options&&node.selectedIndex>=0){
      var value=text(node.options[node.selectedIndex].textContent);
      if(value){return value;}
    }
    return text(fallback);
  }
  function isRetired(row){
    var value=text(row&&(row._estadoMatricula||row.estadoMatricula||row.EstadoMatricula||"ACTIVO")).toUpperCase();
    return value==="RETIRADO"||!!(row&&row.retirado===true);
  }
  function approvalOf(row){
    if(row&&row._approval){return row._approval;}
    if(window.StatsRules&&typeof window.StatsRules.studentApproval==="function"){
      try{return window.StatsRules.studentApproval(row||{})||{};}catch(error){}
    }
    return {approved:false,missingRequirements:[]};
  }
  function nameOf(row){return text(row&&(row._nombres||row.nombres||row.Nombres||row.nombre||row.Nombre))||"Sin nombre";}
  function idOf(row){return text(row&&(row._cedula||row.cedula||row.Cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.identificacion));}
  function careerOf(row){return text(row&&(row._carrera||row.nombreCarrera||row.NombreCarrera||row.carrera||row.Carrera))||"SIN CARRERA";}

  function rowsForReport(report){
    if(!report||!report.periodId||!window.StatsCore||typeof window.StatsCore.resumen!=="function"){return [];}
    var s=state();
    try{
      var data=window.StatsCore.resumen({
        periodId:report.periodId,
        sede:text(s.sede),
        division:text(s.division),
        matricula:"",
        career:text(s.career),
        status:"",
        requirementKey:"",
        force:false
      })||{};
      return Array.isArray(data.rows)?data.rows:[];
    }catch(error){
      console.warn("[StatsClosurePDF] No se pudo reconstruir la cohorte.",error);
      return [];
    }
  }

  function requirementSummary(rows){
    var rules=window.StatsRules||{};
    var catalog=(Array.isArray(rules.BASE_REQUIREMENTS)?rules.BASE_REQUIREMENTS:[])
      .concat(Array.isArray(rules.REGULAR_EXTRA_REQUIREMENTS)?rules.REGULAR_EXTRA_REQUIREMENTS:[]);
    var active=(rows||[]).filter(function(row){return !isRetired(row);});

    return catalog.map(function(item){
      var result={key:item.key,label:item.label||item.key,total:0,cumple:0,noCumple:0,avance:0};
      active.forEach(function(row){
        var status=null;
        try{
          status=typeof rules.requirementStatus==="function"
            ? rules.requirementStatus(row,item.key)
            : null;
        }catch(error){}
        if(status&&status.applies===false){return;}
        result.total+=1;
        if(status&&status.cumple===true){result.cumple+=1;}else{result.noCumple+=1;}
      });
      result.avance=pct(result.cumple,result.total);
      return result;
    }).filter(function(item){return item.total>0;});
  }

  function careerSummary(rows){
    var map=Object.create(null);
    (rows||[]).forEach(function(row){
      var career=careerOf(row);
      if(!map[career]){
        map[career]={career:career,total:0,active:0,retired:0,reached:0,notReached:0,rate:0};
      }
      var item=map[career];
      item.total+=1;
      if(isRetired(row)){
        item.retired+=1;
        item.notReached+=1;
        return;
      }
      item.active+=1;
      if(approvalOf(row).approved===true){item.reached+=1;}
      else{item.notReached+=1;}
    });
    return Object.keys(map).map(function(key){
      var item=map[key];
      item.rate=pct(item.reached,item.total);
      return item;
    }).sort(function(a,b){
      return b.notReached-a.notReached||b.total-a.total||a.career.localeCompare(b.career,"es");
    });
  }

  function metadata(report){
    var s=state();
    return {
      period:selectedText("stats-periodo",report.periodId)||report.periodId,
      sede:selectedText("stats-sede",s.sede||"Todas")||"Todas",
      division:selectedText("stats-division",s.division||"Todas")||"Todas",
      career:selectedText("stats-carrera",s.career||"Todas")||"Todas",
      generated:new Date().toLocaleString("es-EC",{dateStyle:"short",timeStyle:"short"})
    };
  }

  function topFinding(report,requirements,careers){
    var topCause=report.causes&&report.causes.length?report.causes[0]:null;
    var topCareer=careers&&careers.length?careers[0]:null;
    var topReq=(requirements||[]).slice().sort(function(a,b){return b.noCumple-a.noCumple;})[0]||null;
    var lines=[
      "De "+report.total+" estudiantes registrados, "+report.reached+" llegaron a la fase final con requisitos completos ("+report.arrivalRate+"%).",
      report.notReached+" estudiantes no llegaron a la fase final; "+report.retired+" corresponden a retiros."
    ];
    if(topCause){lines.push("La causa con mayor incidencia fue "+topCause.label+", con "+topCause.total+" estudiante"+(topCause.total===1?"":"s")+".");}
    if(topReq){lines.push("El requisito con mayor número de pendientes entre estudiantes activos fue "+topReq.label+", con "+topReq.noCumple+".");}
    if(topCareer&&topCareer.notReached>0){lines.push("La carrera con mayor número de estudiantes que no llegaron fue "+topCareer.career+", con "+topCareer.notReached+".");}
    return lines;
  }

  function table(headers,rows,classes){
    return '<table class="'+esc(classes||"")+'"><thead><tr>'
      +headers.map(function(h){return "<th>"+esc(h)+"</th>";}).join("")
      +'</tr></thead><tbody>'
      +rows.join("")
      +'</tbody></table>';
  }

  function section(title,subtitle,body,extraClass){
    return '<section class="pdf-section '+esc(extraClass||"")+'">'
      +'<div class="pdf-section-head"><h2>'+esc(title)+'</h2>'
      +(subtitle?'<p>'+esc(subtitle)+'</p>':"")
      +'</div>'+body+'</section>';
  }

  function buildDocument(report){
    var rows=rowsForReport(report);
    var requirements=requirementSummary(rows);
    var careers=careerSummary(rows);
    var meta=metadata(report);
    var findings=topFinding(report,requirements,careers);

    var summaryCards=[
      ["Registrados",report.total,"Cohorte del período"],
      ["Activos al cierre",report.active,"Sin retirados"],
      ["Retirados",report.retired,"Salieron del proceso"],
      ["Llegaron a fase final",report.reached,"Requisitos completos"],
      ["No llegaron",report.notReached,"Retirados + pendientes"],
      ["Tasa de llegada",report.arrivalRate+"%","Sobre toda la cohorte"]
    ].map(function(item){
      return '<div class="pdf-kpi"><span>'+esc(item[0])+'</span><strong>'+esc(item[1])+'</strong><small>'+esc(item[2])+'</small></div>';
    }).join("");

    var executive='<div class="pdf-kpis">'+summaryCards+'</div>'
      +'<p class="pdf-lead">De los <strong>'+report.total+'</strong> estudiantes registrados en el período, <strong>'+report.reached+'</strong> llegaron a la fase final con todos los requisitos aplicables completos, equivalente al <strong>'+report.arrivalRate+'%</strong>. Un total de <strong>'+report.notReached+'</strong> estudiantes no llegó a esta fase.</p>';

    var causeRows=(report.causes||[]).map(function(item){
      return '<tr><td>'+esc(item.label)+'</td><td class="n">'+item.total+'</td><td class="n">'+item.percent+'%</td></tr>';
    });
    if(!causeRows.length){causeRows.push('<tr><td colspan="3">No se registran causas de no llegada.</td></tr>');}
    var causes=table(["Causa","Estudiantes","% de quienes no llegaron"],causeRows,"pdf-table")
      +'<p class="pdf-note">Un estudiante puede presentar más de una causa. Por ello, la suma de incidencias y porcentajes puede superar el total de estudiantes que no llegaron.</p>';

    var reqRows=requirements.map(function(item){
      return '<tr><td>'+esc(item.label)+'</td><td class="n">'+item.total+'</td><td class="n ok">'+item.cumple+'</td><td class="n bad">'+item.noCumple+'</td><td class="n">'+item.avance+'%</td></tr>';
    });
    if(!reqRows.length){reqRows.push('<tr><td colspan="5">No se encontraron requisitos aplicables.</td></tr>');}
    var reqs=table(["Requisito","Aplican","Cumplen","Pendientes","Cumplimiento"],reqRows,"pdf-table");

    var careerRows=careers.map(function(item){
      return '<tr><td>'+esc(item.career)+'</td><td class="n">'+item.total+'</td><td class="n">'+item.reached+'</td><td class="n">'+item.notReached+'</td><td class="n">'+item.retired+'</td><td class="n">'+item.rate+'%</td></tr>';
    });
    if(!careerRows.length){careerRows.push('<tr><td colspan="6">No se encontraron datos por carrera.</td></tr>');}
    var careersHtml=table(["Carrera","Registrados","Llegaron","No llegaron","Retirados","% llegada"],careerRows,"pdf-table");

    var finalRows=(report.final||[]).map(function(item){
      return '<tr><td>'+esc(item.label)+'</td><td class="n">'+item.total+'</td><td class="n ok">'+item.cumple+'</td><td class="n bad">'+item.no_cumple+'</td><td class="n">'+item.avance+'%</td></tr>';
    });
    if(!finalRows.length){finalRows.push('<tr><td colspan="5">No se encontraron campos de aprobación final.</td></tr>');}
    var finals=table(["Evaluación final","Evaluados","Aprobados","No aprobados / pendientes","Aprobación"],finalRows,"pdf-table");

    var detailRows=(report.detail||[]).map(function(item,index){
      var row=item.row||{};
      var status=item.type==="retirado"?"Retirado":"No llegó";
      return '<tr><td class="n">'+(index+1)+'</td><td>'+esc(nameOf(row))+'</td><td>'+esc(idOf(row))+'</td><td>'+esc(careerOf(row))+'</td><td>'+esc(status)+'</td><td>'+esc((item.causes||[]).join(", "))+'</td></tr>';
    });
    if(!detailRows.length){detailRows.push('<tr><td colspan="6">Todos los estudiantes llegaron con requisitos completos.</td></tr>');}
    var details=table(["#","Estudiante","Cédula","Carrera","Estado","Motivo(s)"],detailRows,"pdf-table pdf-detail");

    var findingHtml='<ul class="pdf-findings">'+findings.map(function(item){return "<li>"+esc(item)+"</li>";}).join("")+"</ul>";

    var host=document.createElement("article");
    host.id="stats-pdf-render-host";
    host.setAttribute("aria-hidden","true");
    host.style.cssText="position:absolute;left:0;top:0;width:760px;box-sizing:border-box;padding:28px 30px;background:#fff;color:#172033;z-index:2147483647;font-family:Arial,Helvetica,sans-serif;opacity:1;visibility:visible;pointer-events:none;";

    host.innerHTML='<style>'
      +'#stats-pdf-render-host,*{box-sizing:border-box}'
      +'#stats-pdf-render-host{font-size:11px;line-height:1.42}'
      +'#stats-pdf-render-host h1,#stats-pdf-render-host h2,#stats-pdf-render-host p{margin-top:0}'
      +'.pdf-header{border-bottom:3px solid #1d4ed8;padding-bottom:14px;margin-bottom:16px}'
      +'.pdf-header .eyebrow{color:#1d4ed8;font-size:10px;font-weight:800;letter-spacing:.08em;margin:0 0 5px}'
      +'.pdf-header h1{font-size:25px;line-height:1.08;margin:0 0 8px;color:#0f172a}'
      +'.pdf-meta{width:100%;border-collapse:collapse;margin-top:10px}'
      +'.pdf-meta td{border:1px solid #dbe3ef;padding:6px 8px}.pdf-meta b{color:#334155}'
      +'.pdf-section{margin:0 0 18px;break-inside:auto;page-break-inside:auto}'
      +'.pdf-section-head{border-left:4px solid #2563eb;padding-left:9px;margin:0 0 9px}'
      +'.pdf-section-head h2{font-size:16px;margin:0;color:#0f172a}.pdf-section-head p{font-size:9px;color:#64748b;margin:2px 0 0}'
      +'.pdf-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}'
      +'.pdf-kpi{border:1px solid #dbe3ef;border-radius:7px;padding:9px;background:#f8fafc;break-inside:avoid;page-break-inside:avoid}'
      +'.pdf-kpi span{display:block;font-size:8px;text-transform:uppercase;font-weight:800;color:#64748b}'
      +'.pdf-kpi strong{display:block;font-size:20px;line-height:1.1;color:#0f172a;margin:3px 0}'
      +'.pdf-kpi small{font-size:8px;color:#64748b}'
      +'.pdf-lead{background:#eff6ff;border:1px solid #bfdbfe;padding:9px 11px;border-radius:7px;margin:0}'
      +'.pdf-table{width:100%;border-collapse:collapse;font-size:9px;table-layout:auto}'
      +'.pdf-table thead{display:table-header-group}.pdf-table tr{break-inside:avoid;page-break-inside:avoid}'
      +'.pdf-table th{background:#eaf1fb;color:#1e3a5f;text-align:left;font-weight:800;border:1px solid #cbd5e1;padding:6px}'
      +'.pdf-table td{border:1px solid #dbe3ef;padding:5px 6px;vertical-align:top;word-break:break-word}'
      +'.pdf-table .n{text-align:right;white-space:nowrap}.pdf-table .ok{color:#166534;font-weight:700}.pdf-table .bad{color:#991b1b;font-weight:700}'
      +'.pdf-detail{font-size:8px}.pdf-detail td{padding:4px 5px}'
      +'.pdf-note{font-size:8px;color:#64748b;margin:6px 0 0}'
      +'.pdf-findings{margin:0;padding-left:18px}.pdf-findings li{margin-bottom:5px}'
      +'.pdf-footer{margin-top:18px;padding-top:9px;border-top:1px solid #cbd5e1;color:#64748b;font-size:8px;text-align:center}'
      +'</style>'
      +'<header class="pdf-header"><p class="eyebrow">UNIDAD DE TITULACIÓN Y EFICIENCIA TERMINAL</p><h1>Reporte de cierre del período</h1>'
      +'<table class="pdf-meta"><tr><td><b>Período:</b> '+esc(meta.period)+'</td><td><b>Fecha:</b> '+esc(meta.generated)+'</td></tr>'
      +'<tr><td><b>Sede:</b> '+esc(meta.sede)+'</td><td><b>División:</b> '+esc(meta.division)+'</td></tr>'
      +'<tr><td colspan="2"><b>Carrera:</b> '+esc(meta.career)+'</td></tr></table></header>'
      +section("1. Resumen ejecutivo","Cohorte completa del período: activos + retirados.",executive)
      +section("2. ¿Por qué no llegaron?","Causas detectadas entre estudiantes que no alcanzaron la fase final.",causes)
      +section("3. Cumplimiento de requisitos","Cumplimiento sobre estudiantes activos y según aplicabilidad del período.",reqs,"pdf-page-before")
      +section("4. Resultados por carrera","Comparación de llegada a fase final por carrera.",careersHtml)
      +section("5. Aprobación final","Resultados de los estudiantes que llegaron con requisitos completos.",finals)
      +section("6. Principales hallazgos","Síntesis automática basada exclusivamente en los datos del período.",findingHtml)
      +section("7. Detalle de quienes no llegaron","Listado individual de retiros y requisitos pendientes.",details,"pdf-page-before")
      +'<footer class="pdf-footer">Reporte generado automáticamente desde Stats · Requisitos</footer>';

    document.body.appendChild(host);
    return host;
  }

  function filename(report){
    var s=state();
    var base="Reporte_Cierre_"+slug(report.periodId||"periodo");
    if(text(s.division)){base+="_"+slug(s.division);}
    if(text(s.career)){base+="_"+slug(s.career);}
    return base+".pdf";
  }

  function loadScript(src,timeoutMs){
    return new Promise(function(resolve,reject){
      var script=document.createElement("script");
      var settled=false;
      var timer=window.setTimeout(function(){
        if(settled){return;}
        settled=true;
        try{script.remove();}catch(error){}
        reject(new Error("Tiempo agotado al cargar "+src));
      },Math.max(2500,Number(timeoutMs||6500)));
      function done(ok,error){
        if(settled){return;}
        settled=true;
        window.clearTimeout(timer);
        if(ok){resolve(window.html2pdf);}
        else{
          try{script.remove();}catch(innerError){}
          reject(error||new Error("No se pudo cargar "+src));
        }
      }
      script.src=src;
      script.async=true;
      script.onload=function(){done(typeof window.html2pdf==="function",new Error("La librería cargó sin exponer html2pdf."));};
      script.onerror=function(){done(false,new Error("No se pudo cargar "+src));};
      (document.head||document.documentElement).appendChild(script);
    });
  }

  function ensureEngine(){
    if(typeof window.html2pdf==="function"){return Promise.resolve(window.html2pdf);}
    if(enginePromise){return enginePromise;}
    var sources=[
      "../node_modules/html2pdf.js/dist/html2pdf.bundle.min.js",
      "../node_modules/html2pdf.js/dist/html2pdf.bundle.js",
      "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.12.1/html2pdf.bundle.min.js"
    ];
    enginePromise=new Promise(function(resolve,reject){
      var i=0;
      function next(lastError){
        if(typeof window.html2pdf==="function"){resolve(window.html2pdf);return;}
        if(i>=sources.length){reject(lastError||new Error("La biblioteca PDF no está disponible."));return;}
        loadScript(sources[i++],6500).then(resolve).catch(next);
      }
      next();
    }).catch(function(error){enginePromise=null;throw error;});
    return enginePromise;
  }

  function waitForPaint(){
    return new Promise(function(resolve){
      window.requestAnimationFrame(function(){
        window.requestAnimationFrame(function(){
          window.setTimeout(resolve,80);
        });
      });
    });
  }

  function save(engine,report,host){
    return waitForPaint().then(function(){
      var height=Math.max(1123,host.scrollHeight||1123);
      var options={
        margin:[8,8,8,8],
        filename:filename(report),
        image:{type:"jpeg",quality:.98},
        html2canvas:{
          scale:1.35,
          useCORS:true,
          allowTaint:false,
          backgroundColor:"#ffffff",
          logging:false,
          scrollX:0,
          scrollY:0,
          windowWidth:800,
          windowHeight:height
        },
        jsPDF:{unit:"mm",format:"a4",orientation:"portrait",compress:true},
        pagebreak:{mode:["css","legacy"],before:[".pdf-page-before"],avoid:["tr",".pdf-kpi",".pdf-section-head"]}
      };
      return Promise.resolve(engine().set(options).from(host).save());
    });
  }

  function syncButton(){
    var button=el("stats-closure-pdf");
    if(!button){return;}
    var report=currentReport();
    button.disabled=exporting||!report||report.requiresPeriod===true||!text(report.periodId);
    button.textContent="PDF";
  }

  function injectUiStyle(){
    if(el("stats-closure-pdf-ui-style")){return;}
    var style=document.createElement("style");
    style.id="stats-closure-pdf-ui-style";
    style.textContent=[
      ".stats-closure-head-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}",
      "#stats-closure-pdf{min-width:58px;background:#1d4ed8;color:#fff;border-color:#1d4ed8}",
      "#stats-closure-pdf:hover:not(:disabled){background:#1e40af}",
      "#stats-closure-pdf:disabled{opacity:.45;cursor:not-allowed}",
      "@media(max-width:760px){.stats-section-head{align-items:flex-start}.stats-closure-head-actions{justify-content:flex-start}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function download(){
    if(exporting){return;}
    var button=el("stats-closure-pdf");
    var report=currentReport();

    if(!report||report.requiresPeriod===true||!text(report.periodId)){
      window.alert("Selecciona un período para generar el PDF.");
      syncButton();
      return;
    }

    exporting=true;
    if(button){button.disabled=true;button.textContent="...";}
    var host=null;

    ensureEngine()
      .then(function(engine){
        host=buildDocument(report);
        return save(engine,report,host);
      })
      .catch(function(error){
        console.error("[StatsClosurePDF]",error);
        window.alert("No se pudo generar el PDF del cierre. Revisa la consola para ver el detalle.");
      })
      .finally(function(){
        if(host&&host.parentNode){host.parentNode.removeChild(host);}
        exporting=false;
        syncButton();
      });
  }

  function bind(){
    injectUiStyle();
    var button=el("stats-closure-pdf");
    if(button){button.addEventListener("click",download);}
    ["stats-periodo","stats-sede","stats-division","stats-carrera"].forEach(function(id){
      var node=el(id);
      if(node){node.addEventListener("change",function(){window.setTimeout(syncButton,0);});}
    });
    [
      "stats:bootstrap-ready",
      "stats:cache-invalidated",
      "bdlocal:conexiones-cache-updated",
      "requisitos:bdlocal-cambio-disponible"
    ].forEach(function(name){window.addEventListener(name,function(){window.setTimeout(syncButton,0);});});
    syncButton();
  }

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind);}else{bind();}

  window.StatsClosurePDF={
    version:"2.0.0-formal-report",
    download:download,
    syncButton:syncButton,
    ensureEngine:ensureEngine,
    buildDocument:buildDocument
  };
})(window,document);

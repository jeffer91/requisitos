/* =========================================================
Nombre completo: stats.closure.pdf.js
Ruta o ubicación: /Stats/stats.closure.pdf.js
Función:
- Descargar en PDF el reporte visible de cierre del período.
- Intentar primero html2pdf.js local y usar una copia CDN estable como respaldo.
- Incluir encabezado, alcance, KPIs, causas, aprobación final y detalle.
- Expandir tablas para que no se corte el contenido por el scroll de pantalla.
========================================================= */
(function(window,document){
  "use strict";

  var exporting=false;
  var enginePromise=null;

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}

  function slug(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .replace(/[^0-9A-Za-z_-]+/g,"_")
      .replace(/_+/g,"_")
      .replace(/^_+|_+$/g,"");
  }

  function currentReport(){
    if(!window.StatsClosure||typeof window.StatsClosure.build!=="function"){
      return null;
    }
    try{return window.StatsClosure.build()||null;}catch(error){return null;}
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

  function loadScript(src,timeoutMs){
    return new Promise(function(resolve,reject){
      var script=document.createElement("script");
      var settled=false;
      var timer=window.setTimeout(function(){
        if(settled){return;}
        settled=true;
        try{script.remove();}catch(error){}
        reject(new Error("Tiempo agotado al cargar "+src));
      },Math.max(2500,Number(timeoutMs||6000)));

      function finish(ok,error){
        if(settled){return;}
        settled=true;
        window.clearTimeout(timer);
        if(ok){resolve(window.html2pdf);}else{
          try{script.remove();}catch(innerError){}
          reject(error||new Error("No se pudo cargar "+src));
        }
      }

      script.src=src;
      script.async=true;
      script.onload=function(){
        finish(typeof window.html2pdf==="function",new Error("La librería cargó pero no expuso html2pdf."));
      };
      script.onerror=function(){finish(false,new Error("No se pudo cargar "+src));};
      (document.head||document.documentElement).appendChild(script);
    });
  }

  function ensureEngine(){
    if(typeof window.html2pdf==="function"){
      return Promise.resolve(window.html2pdf);
    }
    if(enginePromise){return enginePromise;}

    var sources=[
      "../node_modules/html2pdf.js/dist/html2pdf.bundle.min.js",
      "../node_modules/html2pdf.js/dist/html2pdf.bundle.js",
      "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.12.1/html2pdf.bundle.min.js"
    ];

    enginePromise=new Promise(function(resolve,reject){
      var index=0;
      function next(lastError){
        if(typeof window.html2pdf==="function"){
          resolve(window.html2pdf);
          return;
        }
        if(index>=sources.length){
          reject(lastError||new Error("La biblioteca PDF no está disponible."));
          return;
        }
        var src=sources[index++];
        loadScript(src,6500).then(resolve).catch(next);
      }
      next();
    }).catch(function(error){
      enginePromise=null;
      throw error;
    });

    return enginePromise;
  }

  function buildSource(report){
    var visible=el("stats-closure-report");
    if(!visible){throw new Error("No se encontró el reporte de cierre.");}

    var host=document.createElement("section");
    host.className="stats-pdf-host";
    host.setAttribute("aria-hidden","true");
    host.style.cssText="position:fixed;left:-100000px;top:0;width:794px;padding:28px;background:#fff;color:#0f172a;z-index:-1;font-family:Arial,sans-serif;";

    var heading=document.createElement("header");
    heading.className="stats-pdf-heading";
    heading.innerHTML="<p>UNIDAD DE TITULACIÓN Y EFICIENCIA TERMINAL</p><h1>Reporte de cierre del período</h1><div>"+text(report.scope||report.periodId)+"</div>";

    var copy=visible.cloneNode(true);
    copy.removeAttribute("id");

    var style=document.createElement("style");
    style.textContent=[
      ".stats-pdf-host{font-size:11px;line-height:1.35}",
      ".stats-pdf-heading{margin:0 0 18px;padding:0 0 14px;border-bottom:2px solid #1d4ed8}",
      ".stats-pdf-heading p{margin:0 0 5px;color:#1d4ed8;font-size:10px;font-weight:700;letter-spacing:.08em}",
      ".stats-pdf-heading h1{margin:0;color:#0f172a;font-size:24px;line-height:1.1}",
      ".stats-pdf-heading div{margin-top:7px;color:#475569;font-size:11px;font-weight:700}",
      ".stats-pdf-host .stats-closure-note{margin-bottom:12px}",
      ".stats-pdf-host .stats-closure-kpis{grid-template-columns:repeat(3,1fr)!important}",
      ".stats-pdf-host .stats-closure-grid{grid-template-columns:1fr!important}",
      ".stats-pdf-host .stats-card,.stats-pdf-host .stats-closure-kpi,.stats-pdf-host .stats-closure-final-grid article{box-shadow:none!important;break-inside:avoid;page-break-inside:avoid}",
      ".stats-pdf-host .stats-table-wrap,.stats-pdf-host .stats-closure-detail{max-height:none!important;overflow:visible!important;border-radius:8px}",
      ".stats-pdf-host table{font-size:9px!important}",
      ".stats-pdf-host th,.stats-pdf-host td{padding:6px!important;vertical-align:top}",
      ".stats-pdf-host tr{break-inside:avoid;page-break-inside:avoid}",
      ".stats-pdf-host .stats-closure-reason,.stats-pdf-host .stats-closure-state{font-size:8px;min-height:18px;padding:2px 5px}",
      ".stats-pdf-host .stats-closure-detail-card{break-before:auto;page-break-before:auto}",
      ".stats-pdf-host .stats-closure-cause{grid-template-columns:180px 1fr 55px!important}",
      ".stats-pdf-host .empty{min-height:60px}"
    ].join("\n");

    host.appendChild(style);
    host.appendChild(heading);
    host.appendChild(copy);
    document.body.appendChild(host);
    return host;
  }

  function filename(report){
    var base="Reporte_Cierre_"+slug(report.periodId||"periodo");
    var state=window.StatsApp&&typeof window.StatsApp.getState==="function"
      ? window.StatsApp.getState()||{}
      : {};
    if(text(state.division)){base+="_"+slug(state.division);}
    if(text(state.career)){base+="_"+slug(state.career);}
    return base+".pdf";
  }

  function saveWithEngine(engine,report,host){
    var options={
      margin:[8,8,8,8],
      filename:filename(report),
      image:{type:"jpeg",quality:.98},
      html2canvas:{scale:1.5,useCORS:true,backgroundColor:"#ffffff",logging:false},
      jsPDF:{unit:"mm",format:"a4",orientation:"portrait",compress:true},
      pagebreak:{mode:["css","legacy"],avoid:["tr",".stats-closure-kpi",".stats-closure-final-grid article"]}
    };
    return Promise.resolve(engine().set(options).from(host).save());
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
        host=buildSource(report);
        return saveWithEngine(engine,report,host);
      })
      .catch(function(error){
        console.error("[StatsClosurePDF]",error);
        window.alert("No se pudo cargar el generador PDF. Verifica la conexión o reinstala las dependencias de la aplicación.");
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

    ["stats-periodo","stats-division","stats-carrera"].forEach(function(id){
      var node=el(id);if(node){node.addEventListener("change",function(){setTimeout(syncButton,0);});}
    });

    [
      "stats:bootstrap-ready",
      "stats:cache-invalidated",
      "bdlocal:conexiones-cache-updated",
      "requisitos:bdlocal-cambio-disponible"
    ].forEach(function(name){window.addEventListener(name,function(){setTimeout(syncButton,0);});});

    var status=el("stats-status");
    if(status&&typeof MutationObserver==="function"){
      new MutationObserver(function(){setTimeout(syncButton,0);}).observe(status,{childList:true,characterData:true,subtree:true,attributes:true});
    }

    syncButton();
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",bind);
  }else{
    bind();
  }

  window.StatsClosurePDF={version:"1.1.0-fallback-loader",download:download,syncButton:syncButton,ensureEngine:ensureEngine};
})(window,document);

/* =========================================================
Nombre completo: cr-def.export.js
Ruta: /Cr-def/cr-def.export.js
Función:
- Exportar el cronograma global.
- Exportar PNG y PDF por carrera/fecha desde su encabezado.
- Mantener una salida limpia: Hora, Estudiante, Cédula, N-ART, N-DEF,
  Sede, Tribunal 1, Tribunal 2, Tribunal 3 y Aula.
========================================================= */
(function(window,document){
  "use strict";

  var HTML2CANVAS_PATH="../node_modules/html2canvas/dist/html2canvas.min.js";
  var HTML2PDF_PATH="../node_modules/html2pdf.js/dist/html2pdf.bundle.min.js";
  var loading=Object.create(null);

  var COLUMNS=[
    ["hora","Hora"],["nombre","Estudiante"],["cedula","Cédula"],
    ["notaArticulo","N-ART"],["notaDefensa","N-DEF"],["sede","Sede"],
    ["tribunal1","Tribunal 1"],["tribunal2","Tribunal 2"],
    ["investigador","Tribunal 3"],["aula","Aula"]
  ];

  function $(selector){return document.querySelector(selector);}
  function txt(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function norm(value){return txt(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
  function esc(value){return txt(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function app(){return window.CR_DEF_APP||null;}
  function state(){return app()&&app().state?app().state:null;}
  function note(value){if(value===null||value===undefined||txt(value)==="")return "—";var n=Number(String(value).replace(",","."));return Number.isFinite(n)?String(Math.round(n*100)/100):txt(value);}
  function value(row,key){if(key==="investigador")return txt(row&&(row.investigador||row.tribunal3))||"—";if(key==="notaArticulo"||key==="notaDefensa")return note(row&&row[key]);return txt(row&&row[key])||"—";}
  function dateISO(value){var raw=txt(value),m=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/),iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(iso)return iso[1]+"-"+String(iso[2]).padStart(2,"0")+"-"+String(iso[3]).padStart(2,"0");if(m)return m[3]+"-"+String(m[2]).padStart(2,"0")+"-"+String(m[1]).padStart(2,"0");return "";}
  function dateSortKey(value){return dateISO(value)||"9999-99-99";}
  function slug(value){return norm(value).replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")||"cronograma";}

  function loadScript(path,test){
    var current=null;
    try{current=test&&test();}catch(error){}
    if(current)return Promise.resolve(current);
    if(loading[path])return loading[path];
    loading[path]=new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=new URL(path,document.baseURI).href;
      script.onload=function(){var ready=null;try{ready=test&&test();}catch(error){}ready?resolve(ready):reject(new Error("No se cargó "+path));};
      script.onerror=function(){reject(new Error("No se pudo cargar "+path));};
      document.head.appendChild(script);
    }).finally(function(){delete loading[path];});
    return loading[path];
  }
  function ensureCanvas(){return loadScript(HTML2CANVAS_PATH,function(){return window.html2canvas;});}
  function ensurePdf(){return loadScript(HTML2PDF_PATH,function(){return window.html2pdf;});}

  function rowMatches(row,st){
    st=st||{};var filtros=st.filtros||{};
    var haystack=norm([row.aula,row.dia,row.hora,row.sede,row.cedula,row.nombre,row.carrera,row.notaArticulo,row.notaDefensa,row.tribunal1,row.tribunal2,row.investigador||row.tribunal3,row.estado,(row.alertas||[]).join(" ")].join(" "));
    if(st.busqueda&&haystack.indexOf(norm(st.busqueda))===-1)return false;
    if(filtros.carrera&&norm(row.carrera)!==norm(filtros.carrera))return false;
    if(filtros.sede&&norm(row.sede)!==norm(filtros.sede))return false;
    if(filtros.estado&&norm(row.estadoClave)!==norm(filtros.estado))return false;
    return true;
  }

  function sortedRows(rows){
    return (rows||[]).slice().sort(function(a,b){
      var da=dateSortKey(a.dia),db=dateSortKey(b.dia);
      if(da!==db)return da.localeCompare(db);
      var c=txt(a.carrera).localeCompare(txt(b.carrera),"es",{sensitivity:"base"});
      if(c!==0)return c;
      return [txt(a.hora),txt(a.nombre)].join("|").localeCompare([txt(b.hora),txt(b.nombre)].join("|"),"es",{numeric:true,sensitivity:"base"});
    });
  }

  function filteredRows(){
    var st=state();
    if(!st||!Array.isArray(st.rows))return [];
    return sortedRows(st.rows.filter(function(row){return rowMatches(row,st);}));
  }

  function careerRows(carrera,iso){
    var st=state();
    if(!st||!Array.isArray(st.rows))return [];
    return sortedRows(st.rows.filter(function(row){
      return norm(row.carrera)===norm(carrera)&&dateISO(row.dia)===txt(iso);
    }));
  }

  function grouped(rows){
    var dates=[],dateMap=Object.create(null);
    (rows||[]).forEach(function(row){
      var dateLabel=txt(row.dia)||"SIN FECHA";
      var dateKey=dateSortKey(row.dia)+"|"+norm(dateLabel);
      if(!dateMap[dateKey]){
        dateMap[dateKey]={dia:dateLabel,carreras:[],careerMap:Object.create(null)};
        dates.push(dateMap[dateKey]);
      }
      var dateGroup=dateMap[dateKey],career=txt(row.carrera)||"SIN CARRERA",careerKey=norm(career);
      if(!dateGroup.careerMap[careerKey]){
        dateGroup.careerMap[careerKey]={carrera:career,rows:[]};
        dateGroup.carreras.push(dateGroup.careerMap[careerKey]);
      }
      dateGroup.careerMap[careerKey].rows.push(row);
    });
    dates.forEach(function(group){group.carreras.sort(function(a,b){return a.carrera.localeCompare(b.carrera,"es",{sensitivity:"base"});});});
    return dates;
  }

  function periodoLabel(){
    var select=$("[data-cr-periodo]");
    return select&&select.selectedOptions&&select.selectedOptions[0]?txt(select.selectedOptions[0].textContent):txt(state()&&state().periodo);
  }

  function setAlert(kind,title,message){
    var panel=$("[data-cr-status-panel]"),box=$("[data-cr-alerta-principal]");
    if(kind==="warn"||kind==="danger"){
      if(panel)panel.hidden=false;
      if(box){box.className="cr-alert cr-alert--"+kind;box.innerHTML="<strong>"+esc(title||"Aviso")+"</strong> "+esc(message||"");}
    }else if(panel){panel.hidden=true;}
  }

  function injectPanel(){
    if($("[data-cr-export-panel]"))return;
    var actions=$(".cr-toolbar");
    if(!actions||!actions.parentNode)return;
    var panel=document.createElement("section");
    panel.className="cr-export-panel";panel.hidden=true;panel.setAttribute("data-cr-export-panel","");
    panel.innerHTML="<div class=\"cr-export-head\"><div><h2>Exportar</h2><p>Salida global del cronograma.</p></div><button type=\"button\" class=\"cr-btn\" data-cr-export-close>Cerrar</button></div>"+
      "<div class=\"cr-export-actions\"><button type=\"button\" class=\"cr-btn\" data-cr-export-csv>CSV</button><button type=\"button\" class=\"cr-btn\" data-cr-export-pdf>PDF global</button><button type=\"button\" class=\"cr-btn\" data-cr-export-whatsapp>Texto</button></div>"+
      "<textarea class=\"cr-copy-box\" data-cr-export-copy hidden readonly></textarea>";
    actions.parentNode.insertBefore(panel,actions.nextSibling);
  }

  function buildTableHtml(rows){
    return "<table><thead><tr>"+COLUMNS.map(function(c){return "<th>"+esc(c[1])+"</th>";}).join("")+"</tr></thead><tbody>"+
      rows.map(function(row){return "<tr>"+COLUMNS.map(function(c){return "<td>"+esc(value(row,c[0]))+"</td>";}).join("")+"</tr>";}).join("")+
      "</tbody></table>";
  }

  function careerHost(carrera,iso){
    var rows=careerRows(carrera,iso);
    if(!rows.length)return null;
    var host=document.createElement("div");
    host.className="cr-export-career-host";
    host.style.cssText="position:absolute;left:-10000px;top:0;width:1280px;background:#fff;color:#172033;padding:28px;font-family:Arial,sans-serif;";
    var date=txt(rows[0].dia)||iso;
    host.innerHTML="<div style=\"font-size:13px;font-weight:700;color:#64748b;margin-bottom:6px\">"+esc(date)+"</div>"+
      "<div style=\"font-size:22px;font-weight:800;margin-bottom:16px\">"+esc(carrera)+"</div>"+
      "<style>.cr-export-career-host table{width:100%;border-collapse:collapse}.cr-export-career-host th,.cr-export-career-host td{border:1px solid #dbe4ef;padding:8px 7px;text-align:left;font-size:12px}.cr-export-career-host th{background:#f8fafc;font-size:11px}.cr-export-career-host td:nth-child(4),.cr-export-career-host td:nth-child(5){text-align:center;font-weight:700}</style>"+
      buildTableHtml(rows);
    document.body.appendChild(host);
    return host;
  }

  function careerFileBase(carrera,iso){return "defensas_"+slug(carrera)+"_"+(iso||new Date().toISOString().slice(0,10));}

  function exportCareerImage(carrera,iso){
    var host=careerHost(carrera,iso);
    if(!host){setAlert("warn","Sin datos.","No hay defensas en esta carrera y fecha.");return;}
    ensureCanvas().then(function(canvasFn){
      return canvasFn(host,{scale:1.6,useCORS:true,backgroundColor:"#ffffff",logging:false});
    }).then(function(canvas){
      var a=document.createElement("a");
      a.download=careerFileBase(carrera,iso)+".png";
      a.href=canvas.toDataURL("image/png");
      document.body.appendChild(a);a.click();a.remove();
    }).catch(function(error){setAlert("danger","No se pudo exportar imagen.",error&&error.message?error.message:String(error));})
      .finally(function(){host.remove();});
  }

  function exportCareerPdf(carrera,iso){
    var host=careerHost(carrera,iso);
    if(!host){setAlert("warn","Sin datos.","No hay defensas en esta carrera y fecha.");return;}
    ensurePdf().then(function(engine){
      return engine().set({
        margin:6,
        filename:careerFileBase(carrera,iso)+".pdf",
        image:{type:"jpeg",quality:.98},
        html2canvas:{scale:1.45,useCORS:true,backgroundColor:"#ffffff",logging:false},
        jsPDF:{unit:"mm",format:"a4",orientation:"landscape"}
      }).from(host).save();
    }).catch(function(error){setAlert("danger","No se pudo exportar PDF.",error&&error.message?error.message:String(error));})
      .finally(function(){host.remove();});
  }

  function csvCell(v){return "\"" + txt(v).replace(/\"/g,"\"\"") + "\"";}
  function exportCSV(){
    var rows=filteredRows();if(!rows.length){setAlert("warn","Sin datos.","No hay filas para exportar.");return;}
    var lines=[];
    grouped(rows).forEach(function(dateGroup,dateIndex){
      lines.push(csvCell(dateGroup.dia));
      dateGroup.carreras.forEach(function(group,careerIndex){
        lines.push(csvCell(group.carrera));
        lines.push(COLUMNS.map(function(c){return csvCell(c[1]);}).join(","));
        group.rows.forEach(function(row){lines.push(COLUMNS.map(function(c){return csvCell(value(row,c[0]));}).join(","));});
        if(careerIndex<dateGroup.carreras.length-1)lines.push("");
      });
      if(dateIndex<grouped(rows).length-1)lines.push("");
    });
    var blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="cr_def_"+slug(periodoLabel())+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},500);
  }

  function buildPlainText(rows){
    var lines=["CRONOGRAMA DE DEFENSAS - "+periodoLabel(),""];
    grouped(rows).forEach(function(dateGroup){
      lines.push(dateGroup.dia);
      dateGroup.carreras.forEach(function(group){
        lines.push(group.carrera.toUpperCase());
        lines.push(COLUMNS.map(function(c){return c[1];}).join(" | "));
        group.rows.forEach(function(row){lines.push(COLUMNS.map(function(c){return value(row,c[0]);}).join(" | "));});
        lines.push("");
      });
    });
    return lines.join("\n");
  }

  function showCopyBox(valueText){
    var box=$("[data-cr-export-copy]");
    if(box){box.hidden=false;box.value=valueText;box.focus();box.select();}
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(valueText).catch(function(){});
  }

  function exportGlobalPdf(){
    var rows=filteredRows();if(!rows.length){setAlert("warn","Sin datos.","No hay filas para imprimir.");return;}
    var host=document.createElement("div");
    host.style.cssText="position:absolute;left:-10000px;top:0;width:1280px;background:#fff;padding:24px;font-family:Arial,sans-serif;";
    host.innerHTML="<h2>Cronograma de defensas</h2>"+grouped(rows).map(function(dateGroup){
      return "<h3>"+esc(dateGroup.dia)+"</h3>"+dateGroup.carreras.map(function(group){return "<h4>"+esc(group.carrera)+"</h4>"+buildTableHtml(group.rows);}).join("");
    }).join("");
    document.body.appendChild(host);
    ensurePdf().then(function(engine){
      return engine().set({margin:6,filename:"cr_def_"+slug(periodoLabel())+".pdf",image:{type:"jpeg",quality:.98},html2canvas:{scale:1.3,useCORS:true,backgroundColor:"#ffffff",logging:false},jsPDF:{unit:"mm",format:"a4",orientation:"landscape"}}).from(host).save();
    }).catch(function(error){setAlert("danger","No se pudo exportar PDF.",error&&error.message?error.message:String(error));})
      .finally(function(){host.remove();});
  }

  function togglePanel(){var panel=$("[data-cr-export-panel]");if(panel)panel.hidden=!panel.hidden;}
  function updateButton(){var btn=$("[data-cr-exportar]");if(btn)btn.disabled=!filteredRows().length;}

  function bind(){
    injectPanel();
    var btn=$("[data-cr-exportar]"),close=$("[data-cr-export-close]"),csv=$("[data-cr-export-csv]"),pdf=$("[data-cr-export-pdf]"),wa=$("[data-cr-export-whatsapp]");
    if(btn)btn.addEventListener("click",togglePanel);
    if(close)close.addEventListener("click",function(){var p=$("[data-cr-export-panel]");if(p)p.hidden=true;});
    if(csv)csv.addEventListener("click",exportCSV);
    if(pdf)pdf.addEventListener("click",exportGlobalPdf);
    if(wa)wa.addEventListener("click",function(){var rows=filteredRows();if(!rows.length)return;showCopyBox(buildPlainText(rows));});

    document.addEventListener("click",function(event){
      var imageBtn=event.target.closest("[data-cr-export-career-image]");
      if(imageBtn){exportCareerImage(imageBtn.getAttribute("data-cr-export-career-image"),imageBtn.getAttribute("data-current-date")||"");return;}
      var pdfBtn=event.target.closest("[data-cr-export-career-pdf]");
      if(pdfBtn){exportCareerPdf(pdfBtn.getAttribute("data-cr-export-career-pdf"),pdfBtn.getAttribute("data-current-date")||"");}
    });

    window.setInterval(updateButton,800);updateButton();
    window.CR_DEF_EXPORT=Object.freeze({rows:filteredRows,csv:exportCSV,pdf:exportGlobalPdf,careerImage:exportCareerImage,careerPdf:exportCareerPdf});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);
  else bind();
})(window,document);

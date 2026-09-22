/* =========================================================
Nombre completo: cr-def.export.js
Ruta: /Cr-def/cr-def.export.js
Función:
- Exportar cronograma agrupado por fecha y carrera.
- Incluir Hora, Estudiante, Cédula, Sede, Tribunal 1, Tribunal 2,
  Tribunal 3 (investigador) y Aula.
========================================================= */
(function(window,document){
  "use strict";

  var COLUMNS=[
    ["hora","Hora"],
    ["nombre","Estudiante"],
    ["cedula","Cédula"],
    ["sede","Sede"],
    ["tribunal1","Tribunal 1"],
    ["tribunal2","Tribunal 2"],
    ["investigador","Tribunal 3"],
    ["aula","Aula"]
  ];

  function $(selector){return document.querySelector(selector);}
  function txt(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function norm(value){return txt(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
  function esc(value){return txt(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function app(){return window.CR_DEF_APP||null;}
  function state(){return app()&&app().state?app().state:null;}
  function value(row,key){if(key==="investigador")return txt(row&&(row.investigador||row.tribunal3));return txt(row&&row[key]);}

  function rowMatches(row,st){
    st=st||{};var filtros=st.filtros||{};
    var haystack=norm([row.aula,row.dia,row.hora,row.sede,row.cedula,row.nombre,row.carrera,row.notaArticulo,row.tribunal1,row.tribunal2,row.investigador||row.tribunal3,row.estado,(row.alertas||[]).join(" ")].join(" "));
    if(st.busqueda&&haystack.indexOf(norm(st.busqueda))===-1)return false;
    if(filtros.carrera&&norm(row.carrera)!==norm(filtros.carrera))return false;
    if(filtros.sede&&norm(row.sede)!==norm(filtros.sede))return false;
    if(filtros.estado&&norm(row.estadoClave)!==norm(filtros.estado))return false;
    return true;
  }

  function dateSortKey(value){
    var raw=txt(value),m=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/),iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if(iso)return iso[1]+"-"+String(iso[2]).padStart(2,"0")+"-"+String(iso[3]).padStart(2,"0");
    if(m)return m[3]+"-"+String(m[2]).padStart(2,"0")+"-"+String(m[1]).padStart(2,"0");
    return "9999-99-99";
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

  function grouped(rows){
    var dates=[],dateMap=Object.create(null);
    (rows||[]).forEach(function(row){
      var dateLabel=txt(row.dia)||"SIN FECHA";
      var dateKey=dateSortKey(row.dia)+"|"+norm(dateLabel);
      if(!dateMap[dateKey]){
        dateMap[dateKey]={dia:dateLabel,carreras:[],careerMap:Object.create(null)};
        dates.push(dateMap[dateKey]);
      }
      var dateGroup=dateMap[dateKey];
      var career=txt(row.carrera)||"SIN CARRERA",careerKey=norm(career);
      if(!dateGroup.careerMap[careerKey]){
        dateGroup.careerMap[careerKey]={carrera:career,rows:[]};
        dateGroup.carreras.push(dateGroup.careerMap[careerKey]);
      }
      dateGroup.careerMap[careerKey].rows.push(row);
    });
    dates.forEach(function(dateGroup){
      dateGroup.carreras.sort(function(a,b){return a.carrera.localeCompare(b.carrera,"es",{sensitivity:"base"});});
    });
    return dates;
  }

  function periodoLabel(){
    var st=state(),select=$("[data-cr-periodo]");
    if(select&&select.selectedOptions&&select.selectedOptions[0])return txt(select.selectedOptions[0].textContent);
    return txt(st&&st.periodo);
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
    panel.className="cr-export-panel";
    panel.hidden=true;
    panel.setAttribute("data-cr-export-panel","");
    panel.innerHTML="<div class=\"cr-export-head\"><div><h2>Exportar cronograma</h2><p>La salida respeta Fecha → Carrera → estudiantes.</p></div><button type=\"button\" class=\"cr-btn\" data-cr-export-close>Cerrar</button></div>"+
      "<div class=\"cr-export-actions\"><button type=\"button\" class=\"cr-btn\" data-cr-export-csv>Excel CSV</button><button type=\"button\" class=\"cr-btn\" data-cr-export-pdf>PDF / Imprimir</button><button type=\"button\" class=\"cr-btn\" data-cr-export-whatsapp>Texto WhatsApp</button><button type=\"button\" class=\"cr-btn\" data-cr-export-mail>Tabla correo</button></div>"+
      "<p class=\"cr-export-note\" data-cr-export-note>Selecciona una opción.</p><textarea class=\"cr-copy-box\" data-cr-export-copy hidden readonly></textarea>";
    actions.parentNode.insertBefore(panel,actions.nextSibling);
  }

  function csvCell(v){return "\"" + txt(v).replace(/\"/g,"\"\"") + "\"";}
  function filename(ext){
    var period=norm(periodoLabel()).replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")||"periodo";
    return "cr_def_"+period+"_"+new Date().toISOString().slice(0,10)+"."+ext;
  }

  function exportCSV(){
    var rows=filteredRows();
    if(!rows.length){setAlert("warn","Sin datos.","No hay filas para exportar.");return;}
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
    var blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"});
    var url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename("csv");document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(url);},500);
    setAlert("info","","");
  }

  function buildPlainText(rows){
    var lines=["CRONOGRAMA DE DEFENSAS - "+periodoLabel(),""];
    grouped(rows).forEach(function(dateGroup){
      lines.push(dateGroup.dia);
      dateGroup.carreras.forEach(function(group){
        lines.push(group.carrera.toUpperCase());
        lines.push("Hora | Estudiante | Cédula | Sede | Tribunal 1 | Tribunal 2 | Tribunal 3 | Aula");
        group.rows.forEach(function(r){
          lines.push(COLUMNS.map(function(c){return value(r,c[0])||"—";}).join(" | "));
        });
        lines.push("");
      });
    });
    return lines.join("\n");
  }

  function buildHtmlTable(rows){
    var html="<h2>Cronograma de defensas - "+esc(periodoLabel())+"</h2>";
    grouped(rows).forEach(function(dateGroup){
      html+="<h3>"+esc(dateGroup.dia)+"</h3>";
      dateGroup.carreras.forEach(function(group){
        html+="<h4>"+esc(group.carrera)+"</h4><table border=\"1\" cellspacing=\"0\" cellpadding=\"6\" style=\"border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;margin-bottom:16px\"><thead><tr>";
        html+=COLUMNS.map(function(c){return "<th>"+esc(c[1])+"</th>";}).join("")+"</tr></thead><tbody>";
        group.rows.forEach(function(row){html+="<tr>"+COLUMNS.map(function(c){return "<td>"+esc(value(row,c[0])||"—")+"</td>";}).join("")+"</tr>";});
        html+="</tbody></table>";
      });
    });
    return html;
  }

  function showCopyBox(valueText,note){
    var box=$("[data-cr-export-copy]"),noteBox=$("[data-cr-export-note]");
    if(box){box.hidden=false;box.value=valueText;box.focus();box.select();}
    if(noteBox)noteBox.textContent=note||"Texto generado.";
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(valueText).catch(function(){});
  }

  function exportWhatsApp(){var rows=filteredRows();if(!rows.length){setAlert("warn","Sin datos.","No hay filas para preparar WhatsApp.");return;}showCopyBox(buildPlainText(rows),"Texto generado con fecha, carrera y cédula.");}
  function exportMail(){var rows=filteredRows();if(!rows.length){setAlert("warn","Sin datos.","No hay filas para preparar correo.");return;}showCopyBox(buildHtmlTable(rows),"Tabla HTML generada.");window.location.href="mailto:?subject="+encodeURIComponent("Cronograma de defensas - "+periodoLabel())+"&body="+encodeURIComponent(buildPlainText(rows));}
  function exportPDF(){var rows=filteredRows();if(!rows.length){setAlert("warn","Sin datos.","No hay filas para imprimir.");return;}setTimeout(function(){window.print();},150);}
  function togglePanel(){var panel=$("[data-cr-export-panel]");if(panel)panel.hidden=!panel.hidden;}
  function updateButton(){var btn=$("[data-cr-exportar]");if(btn)btn.disabled=!filteredRows().length;}

  function bind(){
    injectPanel();
    var btn=$("[data-cr-exportar]"),close=$("[data-cr-export-close]"),csv=$("[data-cr-export-csv]"),pdf=$("[data-cr-export-pdf]"),wa=$("[data-cr-export-whatsapp]"),mail=$("[data-cr-export-mail]");
    if(btn)btn.addEventListener("click",togglePanel);
    if(close)close.addEventListener("click",function(){var p=$("[data-cr-export-panel]");if(p)p.hidden=true;});
    if(csv)csv.addEventListener("click",exportCSV);
    if(pdf)pdf.addEventListener("click",exportPDF);
    if(wa)wa.addEventListener("click",exportWhatsApp);
    if(mail)mail.addEventListener("click",exportMail);
    window.setInterval(updateButton,800);updateButton();
    window.CR_DEF_EXPORT=Object.freeze({rows:filteredRows,csv:exportCSV,pdf:exportPDF,whatsapp:exportWhatsApp,mail:exportMail,grouped:grouped});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);
  else bind();
})(window,document);

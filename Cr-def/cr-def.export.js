/* =========================================================
Nombre completo: cr-def.export.js
Ruta: /Cr-def/cr-def.export.js
Función:
- Exportar el cronograma real agrupado por carrera.
- Usar Día, Hora, Sede, Nombres completos, Carrera, Tribunal 1/Coordinador,
  Tribunal 2, Investigador y Aula.
- Mantener cédula, notas y estado solo como datos internos.
========================================================= */
(function(window,document){
  "use strict";

  var COLUMNS=[
    ["dia","Día"],
    ["hora","Hora"],
    ["sede","Sede"],
    ["nombre","Nombres completos"],
    ["carrera","Carrera"],
    ["tribunal1","Tribunal 1 / Coordinador"],
    ["tribunal2","Tribunal 2"],
    ["investigador","Investigador"],
    ["aula","Aula"]
  ];

  function $(selector){return document.querySelector(selector);}
  function txt(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function norm(value){return txt(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
  function esc(value){return txt(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function app(){return window.CR_DEF_APP||null;}
  function state(){return app()&&app().state?app().state:null;}
  function value(row,key){if(key==="investigador")return txt(row&& (row.investigador||row.tribunal3));return txt(row&&row[key]);}

  function rowMatches(row,st){
    st=st||{};var filtros=st.filtros||{};
    var haystack=norm([row.aula,row.dia,row.hora,row.sede,row.cedula,row.nombre,row.carrera,row.notaArticulo,row.tribunal1,row.tribunal2,row.investigador||row.tribunal3,row.estado,(row.alertas||[]).join(" ")].join(" "));
    if(st.busqueda&&haystack.indexOf(norm(st.busqueda))===-1)return false;
    if(filtros.carrera&&norm(row.carrera)!==norm(filtros.carrera))return false;
    if(filtros.sede&&norm(row.sede)!==norm(filtros.sede))return false;
    if(filtros.estado){
      if(filtros.estado==="sin-cupo")return !txt(row.dia)||!txt(row.hora);
      return norm(row.estadoClave)===norm(filtros.estado);
    }
    return true;
  }

  function sortedRows(rows){
    return (rows||[]).slice().sort(function(a,b){
      var c=txt(a.carrera).localeCompare(txt(b.carrera),"es",{sensitivity:"base"});
      if(c!==0)return c;
      return [txt(a.dia),txt(a.hora),txt(a.nombre)].join("|").localeCompare([txt(b.dia),txt(b.hora),txt(b.nombre)].join("|"),"es",{numeric:true,sensitivity:"base"});
    });
  }

  function filteredRows(){
    var st=state();
    if(!st||!Array.isArray(st.rows))return [];
    return sortedRows(st.rows.filter(function(row){return rowMatches(row,st);}));
  }

  function grouped(rows){
    var groups=[],map=Object.create(null);
    (rows||[]).forEach(function(row){
      var name=txt(row.carrera)||"SIN CARRERA",key=norm(name);
      if(!map[key]){map[key]={carrera:name,rows:[]};groups.push(map[key]);}
      map[key].rows.push(row);
    });
    return groups;
  }

  function periodoLabel(){
    var st=state(),select=$("[data-cr-periodo]");
    if(select&&select.selectedOptions&&select.selectedOptions[0])return txt(select.selectedOptions[0].textContent);
    return txt(st&&st.periodo);
  }

  function setAlert(kind,title,message){
    var box=$("[data-cr-alerta-principal]");
    if(box){box.className="cr-alert cr-alert--"+(kind||"info");box.innerHTML="<strong>"+esc(title||"Aviso")+"</strong> "+esc(message||"");}
  }

  function injectPanel(){
    if($("[data-cr-export-panel]"))return;
    var actions=$(".cr-actions");
    if(!actions||!actions.parentNode)return;
    var panel=document.createElement("section");
    panel.className="cr-export-panel";panel.hidden=true;panel.setAttribute("data-cr-export-panel","");
    panel.innerHTML="<div class=\"cr-export-head\"><div><h2>Exportar cronograma</h2><p>La salida se agrupa por carrera con la estructura institucional.</p></div><button type=\"button\" class=\"cr-btn\" data-cr-export-close>Cerrar</button></div>"+
      "<div class=\"cr-export-actions\"><button type=\"button\" class=\"cr-btn cr-btn--primary\" data-cr-export-csv>Excel CSV</button><button type=\"button\" class=\"cr-btn\" data-cr-export-pdf>PDF / Imprimir</button><button type=\"button\" class=\"cr-btn\" data-cr-export-whatsapp>Texto WhatsApp</button><button type=\"button\" class=\"cr-btn\" data-cr-export-mail>Tabla correo</button></div>"+
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
    grouped(rows).forEach(function(group,index){
      lines.push(csvCell(group.carrera));
      lines.push(COLUMNS.map(function(c){return csvCell(c[1]);}).join(","));
      group.rows.forEach(function(row){lines.push(COLUMNS.map(function(c){return csvCell(value(row,c[0]));}).join(","));});
      if(index<grouped(rows).length-1)lines.push("");
    });
    var blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"});
    var url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename("csv");document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},500);
    setAlert("info","CSV generado.","Se exportaron "+rows.length+" defensas agrupadas por carrera.");
  }

  function buildPlainText(rows){
    var lines=["CRONOGRAMA DE DEFENSAS - "+periodoLabel(),""];
    grouped(rows).forEach(function(group){
      lines.push(group.carrera.toUpperCase());
      group.rows.forEach(function(r){
        lines.push([value(r,"dia"),value(r,"hora"),value(r,"sede"),value(r,"nombre"),value(r,"tribunal1"),value(r,"tribunal2"),value(r,"investigador"),"Aula "+(value(r,"aula")||"-")].filter(Boolean).join(" | "));
      });
      lines.push("");
    });
    return lines.join("\n");
  }

  function buildHtmlTable(rows){
    var html="<h2>Cronograma de defensas - "+esc(periodoLabel())+"</h2>";
    grouped(rows).forEach(function(group){
      html+="<h3>"+esc(group.carrera)+"</h3><table border=\"1\" cellspacing=\"0\" cellpadding=\"6\" style=\"border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;margin-bottom:16px\"><thead><tr>";
      html+=COLUMNS.map(function(c){return "<th>"+esc(c[1])+"</th>";}).join("")+"</tr></thead><tbody>";
      group.rows.forEach(function(row){html+="<tr>"+COLUMNS.map(function(c){return "<td>"+esc(value(row,c[0]))+"</td>";}).join("")+"</tr>";});
      html+="</tbody></table>";
    });
    return html;
  }

  function showCopyBox(valueText,note){
    var box=$("[data-cr-export-copy]"),noteBox=$("[data-cr-export-note]");
    if(box){box.hidden=false;box.value=valueText;box.focus();box.select();}
    if(noteBox)noteBox.textContent=note||"Texto generado.";
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(valueText).catch(function(){});
  }

  function exportWhatsApp(){var rows=filteredRows();if(!rows.length){setAlert("warn","Sin datos.","No hay filas para preparar WhatsApp.");return;}showCopyBox(buildPlainText(rows),"Texto agrupado por carrera generado.");}
  function exportMail(){var rows=filteredRows();if(!rows.length){setAlert("warn","Sin datos.","No hay filas para preparar correo.");return;}showCopyBox(buildHtmlTable(rows),"Tabla HTML agrupada por carrera generada.");window.location.href="mailto:?subject="+encodeURIComponent("Cronograma de defensas - "+periodoLabel())+"&body="+encodeURIComponent(buildPlainText(rows));}
  function exportPDF(){var rows=filteredRows();if(!rows.length){setAlert("warn","Sin datos.","No hay filas para imprimir.");return;}setAlert("info","Preparando PDF.","Se imprimirá únicamente la tabla del cronograma.");setTimeout(function(){window.print();},200);}
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

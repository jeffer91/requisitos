/* =========================================================
Nombre completo: cr-def.export.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.export.js
Función o funciones:
- Exportar cronograma filtrado a CSV compatible con Excel.
- Preparar impresión / PDF desde navegador.
- Preparar texto para WhatsApp.
- Preparar cuerpo de correo para Outlook u otro cliente.
- Trabajar siempre con los filtros activos de Cr-def.
Con qué se conecta:
- cr-def.js
- cr-def.render.css
========================================================= */
(function(window, document){
  "use strict";

  var COLUMNS = [
    ["aula", "Aula"],
    ["dia", "Día"],
    ["hora", "Hora"],
    ["sede", "Sede"],
    ["cedula", "Cédula"],
    ["nombre", "Nombre"],
    ["carrera", "Carrera"],
    ["notaArticulo", "Nota artículo"],
    ["tribunal1", "Tribunal 1"],
    ["tribunal2", "Tribunal 2"],
    ["tribunal3", "Tribunal 3"],
    ["estado", "Estado"]
  ];

  function $(selector){ return document.querySelector(selector); }
  function txt(value){ return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function norm(value){ return txt(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function esc(value){
    return txt(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function app(){ return window.CR_DEF_APP || null; }
  function state(){ return app() && app().state ? app().state : null; }

  function rowMatches(row, st){
    st = st || {};
    var filtros = st.filtros || {};
    var haystack = norm([
      row.aula,
      row.dia,
      row.hora,
      row.sede,
      row.cedula,
      row.nombre,
      row.carrera,
      row.notaArticulo,
      row.tribunal1,
      row.tribunal2,
      row.tribunal3,
      row.estado,
      (row.alertas || []).join(" ")
    ].join(" "));

    if(st.busqueda && haystack.indexOf(norm(st.busqueda)) === -1){ return false; }
    if(filtros.carrera && norm(row.carrera) !== norm(filtros.carrera)){ return false; }
    if(filtros.sede && norm(row.sede) !== norm(filtros.sede)){ return false; }
    if(filtros.estado){
      if(filtros.estado === "sin-cupo"){ return !txt(row.dia) || !txt(row.hora); }
      return norm(row.estadoClave) === norm(filtros.estado);
    }
    return true;
  }

  function filteredRows(){
    var st = state();
    if(!st || !Array.isArray(st.rows)){ return []; }
    return st.rows.filter(function(row){ return rowMatches(row, st); });
  }

  function periodoLabel(){
    var st = state();
    if(!st){ return ""; }
    var select = $("[data-cr-periodo]");
    if(select && select.selectedOptions && select.selectedOptions[0]){
      return txt(select.selectedOptions[0].textContent);
    }
    return txt(st.periodo);
  }

  function setAlert(kind, title, message){
    var box = $("[data-cr-alerta-principal]");
    if(!box){ return; }
    box.className = "cr-alert cr-alert--" + (kind || "info");
    box.innerHTML = "<strong>" + esc(title || "Aviso") + "</strong> " + esc(message || "");
  }

  function injectPanel(){
    if($("[data-cr-export-panel]")){ return; }
    var actions = $(".cr-actions");
    if(!actions || !actions.parentNode){ return; }

    var panel = document.createElement("section");
    panel.className = "cr-export-panel";
    panel.hidden = true;
    panel.setAttribute("data-cr-export-panel", "");
    panel.innerHTML = [
      "<div class=\"cr-export-head\">",
      "<div><h2>Exportar cronograma filtrado</h2><p>La exportación usa el período, buscador y filtros activos.</p></div>",
      "<button type=\"button\" class=\"cr-btn\" data-cr-export-close>Cerrar</button>",
      "</div>",
      "<div class=\"cr-export-actions\">",
      "<button type=\"button\" class=\"cr-btn cr-btn--primary\" data-cr-export-csv>Excel CSV</button>",
      "<button type=\"button\" class=\"cr-btn\" data-cr-export-pdf>PDF / Imprimir</button>",
      "<button type=\"button\" class=\"cr-btn\" data-cr-export-whatsapp>Texto WhatsApp</button>",
      "<button type=\"button\" class=\"cr-btn\" data-cr-export-mail>Tabla correo</button>",
      "</div>",
      "<p class=\"cr-export-note\" data-cr-export-note>Selecciona una opción.</p>",
      "<textarea class=\"cr-copy-box\" data-cr-export-copy hidden readonly></textarea>"
    ].join("");

    actions.parentNode.insertBefore(panel, actions.nextSibling);
  }

  function csvCell(value){
    value = txt(value).replace(/\"/g, "\"\"");
    return "\"" + value + "\"";
  }

  function filename(ext){
    var period = norm(periodoLabel()).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "periodo";
    var stamp = new Date().toISOString().slice(0, 10);
    return "cr_def_" + period + "_" + stamp + "." + ext;
  }

  function exportCSV(){
    var rows = filteredRows();
    if(!rows.length){ setAlert("warn", "Sin datos.", "No hay filas para exportar con los filtros actuales."); return; }

    var lines = [];
    lines.push(COLUMNS.map(function(c){ return csvCell(c[1]); }).join(","));
    rows.forEach(function(row){
      lines.push(COLUMNS.map(function(c){ return csvCell(row[c[0]]); }).join(","));
    });

    var blob = new Blob(["\ufeff" + lines.join("\n")], { type:"text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename("csv");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 500);
    setAlert("info", "CSV generado.", "Se exportaron " + rows.length + " filas para abrir en Excel.");
  }

  function buildPlainText(rows){
    var header = "CRONOGRAMA DE DEFENSAS - " + periodoLabel();
    var lines = [header, ""];
    rows.forEach(function(r, i){
      lines.push((i + 1) + ". " + txt(r.hora || "Sin hora") + " | " + txt(r.dia || "Sin día") + " | " + txt(r.sede) + " | Aula " + txt(r.aula || "-") + " | " + txt(r.nombre) + " | " + txt(r.carrera));
      var tribunales = [r.tribunal1, r.tribunal2, r.tribunal3].map(txt).filter(Boolean).join(" / ");
      if(tribunales){ lines.push("   Tribunal: " + tribunales); }
    });
    return lines.join("\n");
  }

  function showCopyBox(textValue, note){
    var box = $("[data-cr-export-copy]");
    var noteBox = $("[data-cr-export-note]");
    if(box){
      box.hidden = false;
      box.value = textValue;
      box.focus();
      box.select();
    }
    if(noteBox){ noteBox.textContent = note || "Texto generado para copiar."; }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(textValue).catch(function(){});
    }
  }

  function exportWhatsApp(){
    var rows = filteredRows();
    if(!rows.length){ setAlert("warn", "Sin datos.", "No hay filas para preparar WhatsApp."); return; }
    showCopyBox(buildPlainText(rows), "Texto de WhatsApp generado y copiado si el navegador lo permite.");
  }

  function buildHtmlTable(rows){
    var html = "<h2>Cronograma de defensas - " + esc(periodoLabel()) + "</h2>";
    html += "<table border=\"1\" cellspacing=\"0\" cellpadding=\"6\" style=\"border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px\">";
    html += "<thead><tr>" + COLUMNS.map(function(c){ return "<th>" + esc(c[1]) + "</th>"; }).join("") + "</tr></thead><tbody>";
    rows.forEach(function(row){
      html += "<tr>" + COLUMNS.map(function(c){ return "<td>" + esc(row[c[0]]) + "</td>"; }).join("") + "</tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function exportMail(){
    var rows = filteredRows();
    if(!rows.length){ setAlert("warn", "Sin datos.", "No hay filas para preparar correo."); return; }
    var plain = buildPlainText(rows);
    showCopyBox(buildHtmlTable(rows), "Tabla HTML generada para copiar en correo. También se abrirá el cliente de correo con resumen en texto.");
    var subject = encodeURIComponent("Cronograma de defensas - " + periodoLabel());
    var body = encodeURIComponent(plain);
    window.location.href = "mailto:?subject=" + subject + "&body=" + body;
  }

  function exportPDF(){
    var rows = filteredRows();
    if(!rows.length){ setAlert("warn", "Sin datos.", "No hay filas para imprimir."); return; }
    setAlert("info", "Preparando PDF.", "Se abrirá la impresión del navegador. Elige Guardar como PDF.");
    setTimeout(function(){ window.print(); }, 250);
  }

  function togglePanel(){
    var panel = $("[data-cr-export-panel]");
    if(!panel){ return; }
    panel.hidden = !panel.hidden;
  }

  function updateButton(){
    var btn = $("[data-cr-exportar]");
    if(!btn){ return; }
    btn.disabled = !filteredRows().length;
  }

  function bind(){
    injectPanel();
    var btn = $("[data-cr-exportar]");
    if(btn){ btn.addEventListener("click", togglePanel); }
    var close = $("[data-cr-export-close]");
    if(close){ close.addEventListener("click", function(){ var p = $("[data-cr-export-panel]"); if(p){ p.hidden = true; } }); }
    var csv = $("[data-cr-export-csv]");
    var pdf = $("[data-cr-export-pdf]");
    var wa = $("[data-cr-export-whatsapp]");
    var mail = $("[data-cr-export-mail]");
    if(csv){ csv.addEventListener("click", exportCSV); }
    if(pdf){ pdf.addEventListener("click", exportPDF); }
    if(wa){ wa.addEventListener("click", exportWhatsApp); }
    if(mail){ mail.addEventListener("click", exportMail); }

    window.setInterval(updateButton, 800);
    updateButton();

    window.CR_DEF_EXPORT = Object.freeze({
      rows: filteredRows,
      csv: exportCSV,
      pdf: exportPDF,
      whatsapp: exportWhatsApp,
      mail: exportMail
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(window, document);

/* =========================================================
Nombre completo: cr-def.render.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.render.js
Función o funciones:
- Mejorar visualmente la tabla ya renderizada por cr-def.js.
- Convertir estados en etiquetas visuales.
- Resaltar notas de artículo.
- Marcar filas programadas, sin cupo y con conflictos.
- Mantener alertas visibles mediante tooltip y marcador.
Con qué se conecta:
- cr-def.js
- cr-def.render.css
========================================================= */
(function(window, document){
  "use strict";

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

  function state(){
    return window.CR_DEF_APP && window.CR_DEF_APP.state ? window.CR_DEF_APP.state : null;
  }

  function rowKeyFromCells(cells){
    if(!cells || cells.length < 6){ return ""; }
    return [txt(cells[4].textContent), txt(cells[5].textContent)].join("__");
  }

  function buildRowMap(){
    var st = state();
    var map = Object.create(null);
    if(!st || !Array.isArray(st.rows)){ return map; }
    st.rows.forEach(function(row){
      var key = [txt(row.cedula), txt(row.nombre)].join("__");
      if(key){ map[key] = row; }
    });
    return map;
  }

  function statusClass(row, textValue){
    var clave = norm(row && row.estadoClave ? row.estadoClave : textValue);
    if(clave.indexOf("conflicto") >= 0){ return "conflicto"; }
    if(clave.indexOf("sin_cupo") >= 0 || clave.indexOf("sin defensa") >= 0 || clave.indexOf("sin_defensa") >= 0){ return "sincupo"; }
    if(clave.indexOf("supletorio") >= 0){ return "supletorio"; }
    if(clave.indexOf("programado") >= 0){ return "programado"; }
    return "apto";
  }

  function decorateRow(tr, row){
    if(!tr || !row || tr.classList.contains("cr-empty-row")){ return; }
    var cells = tr.children || [];
    if(cells.length < 12){ return; }

    tr.classList.remove("cr-row--programado", "cr-row--sin-cupo", "cr-row--conflicto");

    if(row.estadoClave === "conflicto"){
      tr.classList.add("cr-row--conflicto");
    }else if(row.estadoClave === "sin-cupo" || !txt(row.dia) || !txt(row.hora)){
      tr.classList.add("cr-row--sin-cupo");
    }else if(row.estadoClave === "programado"){
      tr.classList.add("cr-row--programado");
    }

    var notaCell = cells[7];
    if(notaCell && !notaCell.querySelector(".cr-note-pill")){
      notaCell.innerHTML = "<span class=\"cr-note-pill\">" + esc(notaCell.textContent) + "</span>";
    }

    var estadoCell = cells[11];
    if(estadoCell && !estadoCell.querySelector(".cr-status-badge")){
      var cls = statusClass(row, estadoCell.textContent);
      var label = txt(row.estado || estadoCell.textContent || "Apto");
      var html = "<span class=\"cr-status-badge cr-status-badge--" + cls + "\">" + esc(label) + "</span>";
      if(Array.isArray(row.alertas) && row.alertas.length){
        html += "<span class=\"cr-alert-marker\" title=\"" + esc(row.alertas.join("\n")) + "\">!" + row.alertas.length + "</span>";
        tr.title = row.alertas.join("\n");
      }
      estadoCell.innerHTML = html;
    }
  }

  function decorate(){
    var body = $("[data-cr-tabla-body]");
    if(!body){ return; }
    var map = buildRowMap();
    Array.prototype.slice.call(body.querySelectorAll("tr")).forEach(function(tr){
      var key = rowKeyFromCells(tr.children);
      decorateRow(tr, map[key]);
    });
  }

  function startObserver(){
    var body = $("[data-cr-tabla-body]");
    if(!body){ return; }
    var timer = null;
    var observer = new MutationObserver(function(){
      clearTimeout(timer);
      timer = setTimeout(decorate, 30);
    });
    observer.observe(body, { childList:true, subtree:true });
    decorate();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", startObserver);
  }else{
    startObserver();
  }
})(window, document);

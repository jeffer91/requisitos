/* =========================================================
Nombre completo: plani.assets.ui.js
Ruta o ubicacion: /Requisitos/Plani/frontend/plani.assets.ui.js
Funcion:
- Renderizar resumen visual de recursos por seccion.
- Preparar la interfaz para imagenes, graficos, tablas y archivos por carpeta logica.
========================================================= */
(function(window, document){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}

  function renderSummary(map){
    var box = document.getElementById("plani-assets-preview");
    var chip = document.getElementById("plani-assets-chip");
    var summary = window.PlaniSectionAssets && window.PlaniSectionAssets.summary ? window.PlaniSectionAssets.summary(map || {}) : [];
    var total = summary.reduce(function(acc,item){return acc + Number(item.total || 0);},0);
    if(chip){chip.textContent = total + " recursos"; chip.className = "plani-chip " + (total ? "ok" : "");}
    if(!box){return;}
    if(!summary.length){
      box.innerHTML = '<div class="plani-empty">Todavia no hay recursos cargados por seccion.</div>';
      return;
    }
    var html = '<div class="plani-table-wrap"><table class="plani-small-table"><thead><tr><th>Seccion</th><th>Imagenes</th><th>Graficos</th><th>Tablas</th><th>Archivos</th><th>Total</th></tr></thead><tbody>';
    html += summary.map(function(item){
      return '<tr><td>' + esc(item.sectionId) + '</td><td>' + item.images + '</td><td>' + item.charts + '</td><td>' + item.tables + '</td><td>' + item.files + '</td><td>' + item.total + '</td></tr>';
    }).join('');
    html += '</tbody></table></div>';
    box.innerHTML = html;
  }

  window.PlaniAssetsUI = {renderSummary:renderSummary};
})(window, document);

/* =========================================================
Nombre completo: ncomplex.pagination.js
Ruta o ubicación: /Ncomplex/ncomplex.pagination.js
Función o funciones:
- Paginar los estudiantes filtrados en grupos de 25.
- Dibujar controles anterior, siguiente y páginas cercanas.
- Actualizar NcomplexState al cambiar de página.
Con qué se conecta:
- ncomplex.config.js
- ncomplex.state.js
- ncomplex.table.js
- ncomplex.app.js
========================================================= */
(function(window,document){
  "use strict";

  var Config = window.NcomplexConfig || {};
  var State = window.NcomplexState || {};

  function paginate(rows, page, pageSize){
    rows = Array.isArray(rows) ? rows : [];
    pageSize = Math.max(1, Number(pageSize || Config.pageSize || 25));
    var total = rows.length;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.max(1, Math.min(Number(page || 1), totalPages));
    var start = (page - 1) * pageSize;

    return {
      rows: rows.slice(start, start + pageSize),
      page: page,
      pageSize: pageSize,
      total: total,
      totalPages: totalPages,
      start: total ? start + 1 : 0,
      end: Math.min(start + pageSize, total),
      hasPrev: page > 1,
      hasNext: page < totalPages
    };
  }

  function button(label, page, disabled, active){
    var element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.disabled = !!disabled;
    element.setAttribute("data-ncomplex-page", String(page));
    if(active){ element.className = "is-active"; }
    return element;
  }

  function render(paged, onChange){
    var id = Config.selectors && Config.selectors.paginacion || "ncomplex-pagination";
    var container = document.getElementById(id);
    if(!container){ return; }
    container.innerHTML = "";

    var info = document.createElement("span");
    info.className = "ncomplex-pagination-info";
    info.textContent = paged.total
      ? "Mostrando " + paged.start + "–" + paged.end + " de " + paged.total
      : "Sin estudiantes";
    container.appendChild(info);

    var controls = document.createElement("div");
    controls.className = "ncomplex-pagination-controls";
    controls.appendChild(button("Anterior", paged.page - 1, !paged.hasPrev, false));

    var from = Math.max(1, paged.page - 2);
    var to = Math.min(paged.totalPages, paged.page + 2);
    for(var page = from; page <= to; page += 1){
      controls.appendChild(button(String(page), page, false, page === paged.page));
    }

    controls.appendChild(button("Siguiente", paged.page + 1, !paged.hasNext, false));
    container.appendChild(controls);

    controls.onclick = function(event){
      var target = event.target.closest("[data-ncomplex-page]");
      if(!target || target.disabled){ return; }
      var nextPage = Number(target.getAttribute("data-ncomplex-page") || 1);
      if(State.patch){ State.patch({ page: nextPage }, "page"); }
      if(typeof onChange === "function"){ onChange(nextPage); }
    };
  }

  window.NcomplexPagination = {
    version: "1.0.0-bloque-2",
    paginate: paginate,
    render: render
  };
})(window,document);
/* =========================================================
Nombre completo: global.table.js
Ruta o ubicación: /Requisitos/Global/global.table.js
Función:
- Renderizar tablas inteligentes para el módulo Global.
- Permitir ordenamiento al presionar encabezados.
- Permitir búsqueda interna por tabla.
- Aplicar paginación de 25 registros por defecto.
- Mantener la lógica de tablas separada del controlador principal.
Con qué se conecta:
- global.app.js
- global.core.js
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.0.0-bloque-3";
  var tableStates = Object.create(null);

  function text(value){ return String(value == null ? "" : value).trim(); }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function esc(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function asNumber(value){
    var n = Number(String(value == null ? "" : value).replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? null : n;
  }

  function valueOf(row, col){
    row = row || {};
    if(typeof col.value === "function"){
      try{ return col.value(row); }catch(error){ return ""; }
    }
    return row[col.key];
  }

  function displayOf(row, col){
    var value = valueOf(row, col);
    if(typeof col.render === "function"){
      try{ return col.render(value, row); }catch(error){ return esc(value); }
    }
    if(col.percent){ return esc(value) + "%"; }
    return esc(value);
  }

  function compareValues(a, b, type){
    if(type === "number" || type === "percent"){
      a = asNumber(a);
      b = asNumber(b);
      a = a == null ? -Infinity : a;
      b = b == null ? -Infinity : b;
      return a - b;
    }
    return text(a).localeCompare(text(b), "es", { numeric:true, sensitivity:"base" });
  }

  function defaultState(id, options){
    return {
      id:id,
      sortKey:options.defaultSortKey || "",
      sortDir:options.defaultSortDir || "asc",
      search:"",
      page:1,
      pageSize:Number(options.pageSize || 25) || 25
    };
  }

  function getState(id, options){
    if(!tableStates[id]){ tableStates[id] = defaultState(id, options || {}); }
    return tableStates[id];
  }

  function searchableText(row, columns){
    return norm((columns || []).map(function(col){ return valueOf(row, col); }).join(" "));
  }

  function prepareRows(rows, columns, state){
    rows = Array.isArray(rows) ? rows.slice() : [];
    columns = Array.isArray(columns) ? columns : [];

    if(state.search){
      var q = norm(state.search);
      rows = rows.filter(function(row){ return searchableText(row, columns).indexOf(q) >= 0; });
    }

    if(state.sortKey){
      var sortCol = columns.filter(function(col){ return col.key === state.sortKey; })[0];
      if(sortCol){
        rows.sort(function(a, b){
          var result = compareValues(valueOf(a, sortCol), valueOf(b, sortCol), sortCol.type || "text");
          return state.sortDir === "desc" ? -result : result;
        });
      }
    }

    return rows;
  }

  function renderToolbar(id, title, rows, state, options){
    return ''
      + '<div class="global-table-toolbar">'
        + '<div>'
          + '<h3>' + esc(title || 'Tabla') + '</h3>'
          + '<p>' + esc(rows.length) + ' registros encontrados</p>'
        + '</div>'
        + '<label class="global-table-search">'
          + '<span>Buscar</span>'
          + '<input type="search" value="' + esc(state.search) + '" placeholder="Buscar en esta tabla" data-global-table-search="' + esc(id) + '">'
        + '</label>'
      + '</div>';
  }

  function renderTable(id, rows, columns, state){
    columns = Array.isArray(columns) ? columns : [];

    if(!rows.length){
      return '<div class="global-table-empty">No hay registros para los filtros aplicados.</div>';
    }

    var totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    var start = (state.page - 1) * state.pageSize;
    var pageRows = rows.slice(start, start + state.pageSize);

    return ''
      + '<div class="global-table-scroll">'
        + '<table class="global-smart-table" data-global-table="' + esc(id) + '">'
          + '<thead><tr>'
            + columns.map(function(col){
              var active = state.sortKey === col.key;
              var icon = active ? (state.sortDir === "desc" ? " ↓" : " ↑") : "";
              return '<th data-global-table-sort="' + esc(id) + '" data-sort-key="' + esc(col.key) + '">' + esc(col.label || col.key) + icon + '</th>';
            }).join("")
          + '</tr></thead>'
          + '<tbody>'
            + pageRows.map(function(row){
              return '<tr>' + columns.map(function(col){
                var cls = col.align === "right" || col.type === "number" || col.type === "percent" ? ' class="is-number"' : '';
                return '<td' + cls + '>' + displayOf(row, col) + '</td>';
              }).join("") + '</tr>';
            }).join("")
          + '</tbody>'
        + '</table>'
      + '</div>'
      + renderPagination(id, rows.length, totalPages, state);
  }

  function renderPagination(id, total, totalPages, state){
    var from = total ? ((state.page - 1) * state.pageSize) + 1 : 0;
    var to = Math.min(total, state.page * state.pageSize);
    return ''
      + '<div class="global-table-pagination">'
        + '<span>Mostrando ' + esc(from) + ' - ' + esc(to) + ' de ' + esc(total) + '</span>'
        + '<div>'
          + '<button type="button" data-global-table-page="' + esc(id) + '" data-page-action="prev"' + (state.page <= 1 ? ' disabled' : '') + '>Anterior</button>'
          + '<strong>Página ' + esc(state.page) + ' de ' + esc(totalPages) + '</strong>'
          + '<button type="button" data-global-table-page="' + esc(id) + '" data-page-action="next"' + (state.page >= totalPages ? ' disabled' : '') + '>Siguiente</button>'
        + '</div>'
      + '</div>';
  }

  function render(container, options){
    options = options || {};
    container = typeof container === "string" ? document.querySelector(container) : container;
    if(!container){ return null; }

    var id = text(options.id || container.id || "global-table");
    var rows = Array.isArray(options.rows) ? options.rows : [];
    var columns = Array.isArray(options.columns) ? options.columns : [];
    var state = getState(id, options);
    var filteredRows = prepareRows(rows, columns, state);

    container.setAttribute("data-global-table-root", id);
    container.innerHTML = ''
      + renderToolbar(id, options.title || "Tabla", filteredRows, state, options)
      + renderTable(id, filteredRows, columns, state);

    bind(container, options);
    return {
      id:id,
      total:rows.length,
      filtered:filteredRows.length,
      page:state.page,
      pageSize:state.pageSize,
      state:state
    };
  }

  function bind(container, options){
    var id = text(options.id || container.getAttribute("data-global-table-root"));
    var state = getState(id, options || {});

    Array.prototype.forEach.call(container.querySelectorAll('[data-global-table-sort="' + id + '"]'), function(th){
      th.addEventListener("click", function(){
        var sortKey = th.getAttribute("data-sort-key");
        if(state.sortKey === sortKey){ state.sortDir = state.sortDir === "asc" ? "desc" : "asc"; }
        else{ state.sortKey = sortKey; state.sortDir = "asc"; }
        state.page = 1;
        render(container, options);
      });
    });

    var search = container.querySelector('[data-global-table-search="' + id + '"]');
    if(search){
      search.addEventListener("input", function(){
        state.search = search.value || "";
        state.page = 1;
        render(container, options);
      });
    }

    Array.prototype.forEach.call(container.querySelectorAll('[data-global-table-page="' + id + '"]'), function(btn){
      btn.addEventListener("click", function(){
        var action = btn.getAttribute("data-page-action");
        if(action === "prev"){ state.page -= 1; }
        if(action === "next"){ state.page += 1; }
        render(container, options);
      });
    });
  }

  function reset(id){
    if(id){ delete tableStates[id]; return; }
    tableStates = Object.create(null);
  }

  window.GlobalTable = {
    version:VERSION,
    render:render,
    reset:reset,
    state:function(id){ return tableStates[id] || null; },
    helpers:{ text:text, norm:norm, esc:esc }
  };
})(window, document);

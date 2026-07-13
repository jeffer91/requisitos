/* =========================================================
Nombre completo: tabla.pagination.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/ui/tabla.pagination.js
Función o funciones:
- Calcular páginas y filas visibles de Tabla.
- Mantener compatibilidad con las propiedades pages y totalPages.
- Actualizar los controles de paginación existentes sin modificar su diseño.
Con qué se conecta:
- tabla.constants.js
- tabla.utils.js
- tabla.app.js
- tabla.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "2.0.0";
  var C = window.TablaConstants || {};
  var U = window.TablaUtils || {};
  var bound = false;

  function el(id){
    return document.getElementById(id);
  }

  function number(value, fallback){
    value = Number(value);

    return isFinite(value)
      ? value
      : fallback;
  }

  function clamp(
    value,
    min,
    max
  ){
    if(U.clamp){
      return U.clamp(
        value,
        min,
        max
      );
    }

    return Math.max(
      min,
      Math.min(
        max,
        value
      )
    );
  }

  function normalizePageSize(value){
    var config =
      C.pagination ||
      {};

    var min =
      number(
        config.minSize,
        25
      );

    var max =
      number(
        config.maxSize,
        300
      );

    var fallback =
      number(
        config.defaultSize,
        75
      );

    return Math.round(
      clamp(
        number(
          value,
          fallback
        ),
        min,
        max
      )
    );
  }

  function build(
    rows,
    page,
    pageSize
  ){
    rows =
      Array.isArray(rows)
        ? rows
        : [];

    pageSize =
      normalizePageSize(
        pageSize
      );

    var total =
      rows.length;

    var pages =
      Math.max(
        1,
        Math.ceil(
          total / pageSize
        )
      );

    page = Math.round(
      clamp(
        number(page, 1),
        1,
        pages
      )
    );

    var startIndex =
      (page - 1) *
      pageSize;

    var endIndex =
      Math.min(
        startIndex +
          pageSize,
        total
      );

    var visible =
      rows.slice(
        startIndex,
        endIndex
      );

    var start =
      total
        ? startIndex + 1
        : 0;

    var end =
      total
        ? endIndex
        : 0;

    return {
      rows:
        visible,

      allRows:
        rows.slice(),

      pagination: {
        page:
          page,

        pageSize:
          pageSize,

        limit:
          pageSize,

        pages:
          pages,

        totalPages:
          pages,

        total:
          total,

        start:
          start,

        end:
          end,

        hasPrev:
          page > 1,

        hasNext:
          page < pages,

        label:
          total
            ? (
                start +
                "–" +
                end +
                " de " +
                total +
                " registros"
              )
            : "0 registros"
      }
    };
  }

  function setText(id, value){
    var node = el(id);

    if(node){
      node.textContent =
        value;
    }
  }

  function render(pagination){
    pagination =
      pagination ||
      build(
        [],
        1,
        75
      ).pagination;

    var pages = number(
      pagination.pages ||
      pagination.totalPages,
      1
    );

    var page = number(
      pagination.page,
      1
    );

    var total = number(
      pagination.total,
      0
    );

    var hasPrev =
      pagination.hasPrev ===
        true ||
      page > 1;

    var hasNext =
      pagination.hasNext ===
        true ||
      page < pages;

    setText(
      "tabla-count-text",
      total +
        " registro(s) filtrados"
    );

    setText(
      "tabla-page-text",
      "Página " +
        page +
        " de " +
        pages
    );

    setText(
      "tabla-page-label",
      pagination.label ||
        (
          total +
          " registros"
        )
    );

    [
      "tabla-page-first",
      "tabla-page-prev"
    ].forEach(function(id){
      var node = el(id);

      if(node){
        node.disabled =
          !hasPrev;
      }
    });

    [
      "tabla-page-next",
      "tabla-page-last"
    ].forEach(function(id){
      var node = el(id);

      if(node){
        node.disabled =
          !hasNext;
      }
    });

    return pagination;
  }

  function bind(handler){
    if(bound){
      return;
    }

    bound = true;

    function connect(
      id,
      action
    ){
      var node = el(id);

      if(!node){
        return;
      }

      node.addEventListener(
        "click",
        function(){
          if(
            typeof handler ===
            "function"
          ){
            handler(action);
          }
        }
      );
    }

    connect(
      "tabla-page-first",
      "first"
    );

    connect(
      "tabla-page-prev",
      "prev"
    );

    connect(
      "tabla-page-next",
      "next"
    );

    connect(
      "tabla-page-last",
      "last"
    );
  }

  function targetPage(
    action,
    pagination
  ){
    pagination =
      pagination ||
      {};

    var page = number(
      pagination.page,
      1
    );

    var pages = number(
      pagination.pages ||
      pagination.totalPages,
      1
    );

    if(action === "first"){
      return 1;
    }

    if(action === "prev"){
      return Math.max(
        1,
        page - 1
      );
    }

    if(action === "next"){
      return Math.min(
        pages,
        page + 1
      );
    }

    if(action === "last"){
      return pages;
    }

    return page;
  }

  window.TablaPagination = {
    version:
      VERSION,

    normalizePageSize:
      normalizePageSize,

    build:
      build,

    paginate:
      build,

    render:
      render,

    bind:
      bind,

    targetPage:
      targetPage
  };
})(window, document);
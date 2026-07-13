/* =========================================================
Nombre completo: tabla.state.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/core/tabla.state.js
Función o funciones:
- Mantener un único estado oficial para la pantalla Tabla.
- Controlar filtros, filas, opciones, paginación y estados de carga.
- Emitir cambios sin permitir mutaciones externas accidentales.
Con qué se conecta:
- tabla.constants.js
- tabla.utils.js
- tabla.events.js
- tabla.app.js y módulos de interfaz.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0";

  var C =
    window.TablaConstants ||
    {};

  var U =
    window.TablaUtils ||
    {};

  var E =
    window.TablaEvents ||
    null;

  var defaults =
    C.defaultState ||
    {};

  var revision = 0;
  var listeners = [];

  function cloneArray(value){
    return Array.isArray(value)
      ? value.slice()
      : [];
  }

  function normalizePagination(
    value
  ){
    value =
      value &&
      typeof value === "object"
        ? value
        : {};

    var page = Math.max(
      1,
      Number(value.page) || 1
    );

    var pageSize = Math.max(
      1,
      Number(
        value.pageSize ||
        value.limit
      ) || 1
    );

    var total = Math.max(
      0,
      Number(value.total) || 0
    );

    var totalPages =
      Math.max(
        1,
        Number(
          value.totalPages
        ) ||
        Math.ceil(
          total / pageSize
        ) ||
        1
      );

    page = Math.min(
      page,
      totalPages
    );

    return {
      page: page,
      pageSize: pageSize,
      limit: pageSize,
      total: total,
      totalPages: totalPages,
      hasPrev:
        page > 1,

      hasNext:
        page < totalPages,

      start:
        total
          ? (
              (page - 1) *
              pageSize
            ) + 1
          : 0,

      end:
        total
          ? Math.min(
              page * pageSize,
              total
            )
          : 0
    };
  }

  function createInitial(){
    var initial =
      Object.assign(
        {},
        defaults
      );

    initial.requirements =
      cloneArray(
        defaults.requirements ||
        ["falta"]
      );

    initial.rows = [];
    initial.allRows = [];
    initial.filteredRows = [];
    initial.periods = [];
    initial.divisionOptions = [];
    initial.careerOptions = [];

    initial.pagination =
      normalizePagination({
        page: 1,

        pageSize:
          defaults.pageSize ||
          75,

        total: 0
      });

    return initial;
  }

  var state =
    createInitial();

  function snapshot(){
    return Object.assign(
      {},
      state,
      {
        requirements:
          cloneArray(
            state.requirements
          ),

        rows:
          cloneArray(
            state.rows
          ),

        allRows:
          cloneArray(
            state.allRows
          ),

        filteredRows:
          cloneArray(
            state.filteredRows
          ),

        periods:
          cloneArray(
            state.periods
          ),

        divisionOptions:
          cloneArray(
            state.divisionOptions
          ),

        careerOptions:
          cloneArray(
            state.careerOptions
          ),

        pagination:
          Object.assign(
            {},
            state.pagination ||
            {}
          ),

        revision:
          revision
      }
    );
  }

  function notify(
    changed,
    meta
  ){
    var current =
      snapshot();

    var payload = {
      state: current,
      changed:
        changed || [],

      meta:
        meta || {},

      revision:
        revision
    };

    listeners
      .slice()
      .forEach(
        function(listener){
          try{
            listener(
              current,
              payload
            );
          }catch(error){
            if(
              window.console &&
              console.error
            ){
              console.error(
                "[TablaState] Error en suscriptor",
                error
              );
            }
          }
        }
      );

    if(
      E &&
      typeof E.emit ===
        "function"
    ){
      E.emit(
        (
          C.events &&
          C.events.stateChanged
        ) ||
        "tabla:state-changed",

        payload
      );
    }
  }

  function sanitize(
    key,
    value
  ){
    var paginationConfig =
      C.pagination ||
      {};

    if(
      [
        "rows",
        "allRows",
        "filteredRows",
        "periods",
        "divisionOptions",
        "careerOptions",
        "requirements"
      ].indexOf(key) >= 0
    ){
      return cloneArray(
        value
      );
    }

    if(key === "page"){
      return Math.max(
        1,
        Number(value) || 1
      );
    }

    if(key === "pageSize"){
      var min =
        Number(
          paginationConfig.minSize
        ) || 25;

      var max =
        Number(
          paginationConfig.maxSize
        ) || 300;

      var fallback =
        Number(
          paginationConfig.defaultSize
        ) || 75;

      var numeric =
        Number(value) ||
        fallback;

      return U.clamp
        ? U.clamp(
            numeric,
            min,
            max
          )
        : Math.max(
            min,
            Math.min(
              max,
              numeric
            )
          );
    }

    if(key === "pagination"){
      return normalizePagination(
        value
      );
    }

    if(
      [
        "refreshing",
        "rendering",
        "booted"
      ].indexOf(key) >= 0
    ){
      return value === true;
    }

    if(
      [
        "periodId",
        "division",
        "matricula",
        "career",
        "status",
        "search",
        "source",
        "lastError",
        "updatedAt"
      ].indexOf(key) >= 0
    ){
      return U.text
        ? U.text(value)
        : String(
            value == null
              ? ""
              : value
          ).trim();
    }

    return value;
  }

  function arraysEqual(
    a,
    b
  ){
    a = Array.isArray(a)
      ? a
      : [];

    b = Array.isArray(b)
      ? b
      : [];

    if(
      a.length !== b.length
    ){
      return false;
    }

    for(
      var i = 0;
      i < a.length;
      i += 1
    ){
      if(a[i] !== b[i]){
        return false;
      }
    }

    return true;
  }

  function update(
    patch,
    meta
  ){
    patch =
      patch &&
      typeof patch === "object"
        ? patch
        : {};

    var changed = [];

    Object.keys(patch)
      .forEach(function(key){
        if(
          !Object.prototype
            .hasOwnProperty
            .call(state, key)
        ){
          return;
        }

        var next =
          sanitize(
            key,
            patch[key]
          );

        var current =
          state[key];

        var isArray =
          Array.isArray(next);

        var same =
          isArray
            ? arraysEqual(
                current,
                next
              )
            : current === next;

        if(!same){
          state[key] = next;
          changed.push(key);
        }
      });

    if(changed.length){
      revision += 1;

      notify(
        changed,
        meta
      );
    }

    return snapshot();
  }

  function resetFilters(meta){
    return update(
      {
        periodId:
          defaults.periodId ||
          "",

        division:
          defaults.division ||
          "",

        matricula:
          defaults.matricula == null
            ? "ACTIVO"
            : defaults.matricula,

        career:
          defaults.career ||
          "",

        status:
          defaults.status ||
          "",

        search:
          defaults.search ||
          "",

        requirements:
          defaults.requirements ||
          ["falta"],

        page: 1
      },

      meta || {
        reason:
          "reset-filters"
      }
    );
  }

  function setRows(
    allRows,
    filteredRows,
    visibleRows,
    pagination,
    meta
  ){
    return update(
      {
        allRows:
          allRows || [],

        filteredRows:
          filteredRows || [],

        rows:
          visibleRows || [],

        pagination:
          pagination || {},

        page:
          pagination &&
          pagination.page ||
          state.page
      },

      meta || {
        reason:
          "set-rows"
      }
    );
  }

  function subscribe(
    listener,
    immediate
  ){
    if(
      typeof listener !==
      "function"
    ){
      return function(){};
    }

    listeners.push(
      listener
    );

    if(immediate === true){
      listener(
        snapshot(),
        {
          state:
            snapshot(),

          changed:
            [],

          meta: {
            immediate:
              true
          },

          revision:
            revision
        }
      );
    }

    return function(){
      listeners =
        listeners.filter(
          function(item){
            return (
              item !== listener
            );
          }
        );
    };
  }

  function resetAll(meta){
    state =
      createInitial();

    revision += 1;

    notify(
      Object.keys(state),

      meta || {
        reason:
          "reset-all"
      }
    );

    return snapshot();
  }

  window.TablaState = {
    version: VERSION,

    get:
      snapshot,

    snapshot:
      snapshot,

    update:
      update,

    replace:
      update,

    resetFilters:
      resetFilters,

    resetAll:
      resetAll,

    setRows:
      setRows,

    subscribe:
      subscribe,

    setFilter:
      function(
        name,
        value,
        meta
      ){
        var allowed = [
          "periodId",
          "division",
          "matricula",
          "career",
          "status",
          "search",
          "requirements"
        ];

        if(
          allowed.indexOf(name) <
          0
        ){
          return snapshot();
        }

        var patch = {
          page: 1
        };

        patch[name] = value;

        return update(
          patch,

          meta || {
            reason: "filter",
            filter: name
          }
        );
      },

    setPage:
      function(page, meta){
        return update(
          {
            page: page
          },

          meta || {
            reason: "page"
          }
        );
      },

    setPageSize:
      function(size, meta){
        return update(
          {
            pageSize: size,
            page: 1
          },

          meta || {
            reason:
              "page-size"
          }
        );
      },

    setRefreshing:
      function(value, meta){
        return update(
          {
            refreshing: value
          },

          meta || {
            reason:
              "refreshing"
          }
        );
      },

    setRendering:
      function(value, meta){
        return update(
          {
            rendering: value
          },

          meta || {
            reason:
              "rendering"
          }
        );
      }
  };
})(window);
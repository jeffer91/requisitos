/* =========================================================
Nombre completo: tabla.app.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/core/tabla.app.js
Función o funciones:
- Coordinar datos, filtros, paginación y renderizado de la pantalla Tabla.
- Mantener una sola carga y un solo render a la vez.
- Abrir Telegram masivo e historial desde el menú compacto existente.
- Exponer una API compatible mediante window.TablaApp.
Con qué se conecta:
- tabla.state.js, tabla.events.js y tabla.data-source.js.
- tabla.filters.js, tabla.pagination.js y módulos tabla.render-*.
- tabla.mass.js, tabla.history.js y tabla.actions.js.
========================================================= */
(function(window, document){
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

  var Store =
    window.TablaState ||
    null;

  var Source =
    window.TablaDataSource ||
    null;

  var Filters =
    window.TablaFilters ||
    null;

  var Pagination =
    window.TablaPagination ||
    null;

  var Controls =
    window.TablaRenderControls ||
    null;

  var Summary =
    window.TablaRenderSummary ||
    null;

  var Table =
    window.TablaRenderTable ||
    null;

  var booted = false;
  var renderTimer = null;
  var rendering = false;
  var pendingRender = false;
  var refreshPromise = null;
  var renderRevision = 0;

  function el(id){
    return document
      .getElementById(id);
  }

  function text(value){
    return U.text
      ? U.text(value)
      : String(
          value == null
            ? ""
            : value
        ).trim();
  }

  function state(){
    return (
      Store &&
      Store.get
    )
      ? Store.get()
      : {
          periodId:
            "",

          division:
            "",

          matricula:
            "ACTIVO",

          career:
            "",

          status:
            "",

          search:
            "",

          requirements:
            ["falta"],

          page:
            1,

          pageSize:
            75,

          rows:
            [],

          allRows:
            [],

          filteredRows:
            [],

          periods:
            [],

          divisionOptions:
            [],

          careerOptions:
            [],

          pagination:
            null
        };
  }

  function update(patch, meta){
    if(
      Store &&
      Store.update
    ){
      return Store.update(
        patch,
        meta || {}
      );
    }

    return state();
  }

  function status(message, type){
    if(
      Summary &&
      Summary.status
    ){
      Summary.status(
        message,
        type || ""
      );

      return;
    }

    var box =
      el("tabla-status");

    if(box){
      box.textContent =
        text(message);

      box.className =
        "tabla-status" +
        (
          type
            ? " " + type
            : ""
        );
    }
  }

  function sourceName(){
    if(
      Source &&
      Source.source
    ){
      return (
        text(
          Source.source()
        ) ||
        "Base Local"
      );
    }

    return "Base Local";
  }

  function periodId(item){
    return U.periodIdOf
      ? U.periodIdOf(item)
      : text(
          item &&
          item.id ||
          item
        );
  }

  function periodLabel(item){
    return U.periodLabelOf
      ? U.periodLabelOf(item)
      : text(
          item &&
          item.label ||
          item
        );
  }

  function selectedPeriod(current){
    current =
      current ||
      state();

    var periods =
      Array.isArray(
        current.periods
      )
        ? current.periods
        : [];

    for(
      var i = 0;
      i < periods.length;
      i += 1
    ){
      if(
        U.samePeriod
          ? U.samePeriod(
              periodId(periods[i]),
              current.periodId
            )
          : periodId(periods[i]) ===
            current.periodId
      ){
        return periods[i];
      }
    }

    return null;
  }

  function selectedPeriodLabel(
    current
  ){
    current =
      current ||
      state();

    var selected =
      selectedPeriod(current);

    return selected
      ? (
          periodLabel(selected) ||
          periodId(selected)
        )
      : text(
          current.periodId
        );
  }

  function request(
    resetPage,
    delay
  ){
    if(resetPage){
      update(
        {
          page: 1
        },
        {
          reason:
            "request-reset-page"
        }
      );
    }

    if(renderTimer){
      window.clearTimeout(
        renderTimer
      );
    }

    renderTimer =
      window.setTimeout(
        function(){
          renderTimer = null;
          render();
        },
        typeof delay === "number"
          ? delay
          : (
              (
                C.delays &&
                C.delays.render
              ) ||
              90
            )
      );
  }

  function invalidateVisuals(){
    if(
      Controls &&
      Controls.invalidate
    ){
      Controls.invalidate();
    }

    if(
      Table &&
      Table.invalidate
    ){
      Table.invalidate();
    }

    if(
      Source &&
      Source.invalidate
    ){
      Source.invalidate();
    }
  }

  function readData(current){
    if(!Source){
      return Promise.reject(
        new Error(
          "TablaDataSource no está disponible."
        )
      );
    }

    var periodsTask =
      Source.readPeriods
        ? Source.readPeriods()
        : [];

    var studentsTask =
      Source.readStudents
        ? Source.readStudents({
            periodId:
              current.periodId,

            matricula:
              ""
          })
        : [];

    return Promise.all([
      Promise.resolve(
        periodsTask
      ),

      Promise.resolve(
        studentsTask
      )
    ]).then(function(result){
      return {
        periods:
          Array.isArray(result[0])
            ? result[0]
            : [],

        students:
          Array.isArray(result[1])
            ? result[1]
            : []
      };
    });
  }

  function completeRender(
    data,
    started,
    revision
  ){
    if(
      revision !==
      renderRevision
    ){
      return;
    }

    var current =
      state();

    var options =
      Filters &&
      Filters.options
        ? Filters.options(
            data.students,
            current
          )
        : {
            divisions:
              [],

            careers:
              []
          };

    var filtered =
      Filters &&
      Filters.apply
        ? Filters.apply(
            data.students,
            current
          )
        : data.students.slice();

    var pageResult =
      Pagination &&
      Pagination.build
        ? Pagination.build(
            filtered,
            current.page,
            current.pageSize
          )
        : {
            rows:
              filtered.slice(),

            allRows:
              filtered.slice(),

            pagination: {
              page:
                1,

              pages:
                1,

              totalPages:
                1,

              total:
                filtered.length,

              hasPrev:
                false,

              hasNext:
                false,

              label:
                filtered.length +
                " registros"
            }
          };

    var summary =
      Filters &&
      Filters.summary
        ? Filters.summary(
            filtered
          )
        : {
            total:
              filtered.length
          };

    var next = update(
      {
        periods:
          data.periods,

        divisionOptions:
          options.divisions ||
          [],

        careerOptions:
          options.careers ||
          [],

        allRows:
          filtered,

        filteredRows:
          filtered,

        rows:
          pageResult.rows ||
          [],

        pagination:
          pageResult.pagination,

        page:
          pageResult
            .pagination
            .page,

        source:
          sourceName(),

        rendering:
          false,

        booted:
          true,

        lastError:
          "",

        updatedAt:
          U.nowIso
            ? U.nowIso()
            : new Date()
                .toISOString()
      },
      {
        reason:
          "render-complete"
      }
    );

    next.periodLabel =
      selectedPeriodLabel(next);

    if(
      Controls &&
      Controls.render
    ){
      Controls.render(next);
    }

    if(
      Pagination &&
      Pagination.render
    ){
      Pagination.render(
        next.pagination
      );
    }

    if(
      Table &&
      Table.render
    ){
      Table.render(
        next.rows
      );
    }

    var summaryMessage =
      Summary &&
      Summary.render
        ? Summary.render(
            summary,
            next.pagination,
            next
          )
        : "";

    updateCommunicationControls(
      next
    );

    status(
      summaryMessage ||
      (
        "Tabla cargada por " +
        sourceName() +
        " · " +
        (
          Date.now() -
          started
        ) +
        " ms."
      ),
      "ok"
    );

    if(
      E &&
      E.emit
    ){
      E.emit(
        (
          C.events &&
          C.events.rendered
        ) ||
        "tabla:rendered",

        {
          source:
            sourceName(),

          total:
            summary.total ||
            0,

          visible:
            next.rows.length,

          duration:
            Date.now() -
            started
        }
      );
    }
  }

  function render(){
    if(rendering){
      pendingRender = true;

      return Promise.resolve(
        null
      );
    }

    rendering = true;
    pendingRender = false;
    renderRevision += 1;

    var revision =
      renderRevision;

    var started =
      Date.now();

    var current =
      state();

    update(
      {
        rendering:
          true
      },
      {
        reason:
          "render-start"
      }
    );

    status(
      "Cargando tabla...",
      ""
    );

    return readData(current)
      .then(function(data){
        completeRender(
          data,
          started,
          revision
        );

        return state();
      })
      .catch(function(error){
        var message =
          error &&
          error.message
            ? error.message
            : text(error);

        update(
          {
            rendering:
              false,

            lastError:
              message
          },
          {
            reason:
              "render-error"
          }
        );

        status(
          message ||
          "No se pudo cargar Tabla.",
          "warn"
        );

        if(
          E &&
          E.error
        ){
          E.error(
            error,
            {
              source:
                "TablaApp.render"
            }
          );
        }

        return null;
      })
      .finally(function(){
        rendering = false;

        update(
          {
            rendering:
              false
          },
          {
            reason:
              "render-finally"
          }
        );

        if(pendingRender){
          pendingRender = false;

          request(
            false,
            40
          );
        }
      });
  }

  function refresh(){
    if(refreshPromise){
      return refreshPromise;
    }

    update(
      {
        refreshing:
          true
      },
      {
        reason:
          "refresh-start"
      }
    );

    status(
      "Actualizando Tabla desde Base Local...",
      ""
    );

    refreshPromise =
      Promise.resolve(
        Source &&
        Source.refresh
          ? Source.refresh({
              source:
                "TablaApp.refresh",

              full:
                true,

              immediate:
                true
            })
          : null
      )
        .catch(function(error){
          status(
            error &&
            error.message
              ? error.message
              : "No se pudo actualizar Tabla.",
            "warn"
          );

          return null;
        })
        .then(function(result){
          invalidateVisuals();

          return render()
            .then(function(){
              return result;
            });
        })
        .finally(function(){
          update(
            {
              refreshing:
                false
            },
            {
              reason:
                "refresh-end"
            }
          );

          refreshPromise = null;
        });

    return refreshPromise;
  }

  function applyFilter(
    patch,
    field
  ){
    patch =
      Object.assign(
        {},
        patch || {}
      );

    patch.page = 1;

    if(field === "periodId"){
      patch.division = "";
      patch.career = "";

      closeMessageMenu();
    }

    if(field === "division"){
      patch.career = "";
    }

    if(
      field === "pageSize" &&
      Pagination &&
      Pagination
        .normalizePageSize
    ){
      patch.pageSize =
        Pagination
          .normalizePageSize(
            patch.pageSize
          );
    }

    update(
      patch,
      {
        reason:
          "filter-change",

        filter:
          field ||
          "multiple"
      }
    );

    if(
      Table &&
      Table.invalidate
    ){
      Table.invalidate();
    }

    request(
      false,
      20
    );
  }

  function changePage(action){
    var current =
      state();

    var target =
      Pagination &&
      Pagination.targetPage
        ? Pagination.targetPage(
            action,
            current.pagination
          )
        : current.page;

    if(
      target ===
      current.page
    ){
      return;
    }

    update(
      {
        page:
          target
      },
      {
        reason:
          "page-change",

        action:
          action
      }
    );

    request(
      false,
      10
    );
  }

  function closeMessageMenu(){
    var panel =
      el(
        "tabla-message-menu-panel"
      );

    var toggle =
      el(
        "tabla-message-menu-toggle"
      );

    if(panel){
      panel.hidden = true;
    }

    if(toggle){
      toggle.setAttribute(
        "aria-expanded",
        "false"
      );
    }
  }

  function toggleMessageMenu(){
    var panel =
      el(
        "tabla-message-menu-panel"
      );

    var toggle =
      el(
        "tabla-message-menu-toggle"
      );

    if(
      !panel ||
      !toggle
    ){
      return;
    }

    var open =
      panel.hidden;

    panel.hidden =
      !open;

    toggle.setAttribute(
      "aria-expanded",
      open
        ? "true"
        : "false"
    );
  }

  function openHistory(){
    closeMessageMenu();

    if(
      window.TablaHistory &&
      typeof window.TablaHistory
        .abrir === "function"
    ){
      window.TablaHistory
        .abrir();

      return true;
    }

    status(
      "No está disponible el historial de mensajes.",
      "warn"
    );

    return false;
  }

  function openMass(){
    closeMessageMenu();

    var current =
      state();

    if(!current.periodId){
      status(
        "Seleccione un período antes de preparar Telegram masivo.",
        "warn"
      );

      var period =
        el("tabla-periodo");

      if(period){
        period.focus();
      }

      return false;
    }

    if(
      !current.allRows.length
    ){
      status(
        "No hay estudiantes con los filtros actuales.",
        "warn"
      );

      return false;
    }

    if(
      !window.TablaMass ||
      typeof window.TablaMass
        .abrir !== "function"
    ){
      status(
        "No está disponible el módulo de Telegram masivo.",
        "warn"
      );

      return false;
    }

    window.TablaMass.abrir(
      current.allRows.slice(),
      {
        periodId:
          current.periodId,

        periodo:
          selectedPeriodLabel(
            current
          ),

        division:
          current.division,

        career:
          current.career,

        status:
          current.status,

        search:
          current.search,

        matricula:
          current.matricula,

        requirements:
          current
            .requirements
            .slice()
      }
    );

    return true;
  }

  function updateCommunicationControls(
    current
  ){
    current =
      current ||
      state();

    var button =
      el(
        "tabla-telegram-masivo"
      );

    if(!button){
      return;
    }

    var unavailable =
      !current.periodId ||
      !current.allRows.length;

    button.disabled =
      unavailable;

    button.setAttribute(
      "aria-disabled",
      unavailable
        ? "true"
        : "false"
    );

    button.title =
      !current.periodId
        ? "Seleccione un período antes de preparar un envío masivo."
        : !current.allRows.length
          ? "No hay estudiantes con los filtros actuales."
          : (
              "Preparar Telegram masivo para " +
              selectedPeriodLabel(
                current
              ) +
              "."
            );
  }

  function bindMessageMenu(){
    var toggle =
      el(
        "tabla-message-menu-toggle"
      );

    var mass =
      el(
        "tabla-telegram-masivo"
      );

    var history =
      el(
        "tabla-history-open"
      );

    if(toggle){
      toggle.addEventListener(
        "click",
        function(event){
          event.stopPropagation();
          toggleMessageMenu();
        }
      );
    }

    if(mass){
      mass.addEventListener(
        "click",
        openMass
      );
    }

    if(history){
      history.addEventListener(
        "click",
        openHistory
      );
    }

    document.addEventListener(
      "click",
      function(event){
        var menu =
          toggle &&
          toggle.closest
            ? toggle.closest(
                ".tabla-message-menu"
              )
            : null;

        if(
          menu &&
          menu.contains(
            event.target
          )
        ){
          return;
        }

        closeMessageMenu();
      }
    );

    document.addEventListener(
      "keydown",
      function(event){
        if(
          event.key ===
          "Escape"
        ){
          closeMessageMenu();
        }
      }
    );
  }

  function bindEvents(){
    if(
      E &&
      E.on
    ){
      E.on(
        (
          C.events &&
          C.events.dataUpdated
        ) ||
        "tabla:data-updated",

        function(){
          invalidateVisuals();

          request(
            false,
            30
          );
        }
      );
    }
  }

  function boot(){
    if(booted){
      return;
    }

    booted = true;

    if(
      !Store ||
      !Source ||
      !Filters ||
      !Pagination ||
      !Controls ||
      !Table
    ){
      status(
        "Faltan módulos internos de Tabla. Revise el orden de los scripts.",
        "warn"
      );

      return;
    }

    Controls.bind({
      onFilter:
        applyFilter,

      onRequirements:
        function(requirements){
          applyFilter(
            {
              requirements:
                requirements
            },
            "requirements"
          );
        },

      onRefresh:
        refresh
    });

    Pagination.bind(
      changePage
    );

    bindMessageMenu();
    bindEvents();

    updateCommunicationControls(
      state()
    );

    status(
      "Conectando Tabla con Base Local...",
      ""
    );

    Promise.resolve(
      Source.ready
        ? Source.ready()
        : null
    )
      .catch(function(){
        return null;
      })
      .then(function(){
        return render();
      });
  }

  if(
    document.readyState ===
    "loading"
  ){
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  }else{
    boot();
  }

  window.TablaApp = {
    version:
      VERSION,

    boot:
      boot,

    render:
      render,

    request:
      request,

    refresh:
      refresh,

    openMass:
      openMass,

    openHistory:
      openHistory,

    closeMessageMenu:
      closeMessageMenu,

    source:
      sourceName,

    getState:
      function(){
        var current =
          state();

        current.periodLabel =
          selectedPeriodLabel(
            current
          );

        return current;
      },

    setFilters:
      function(filters){
        applyFilter(
          filters || {},
          "multiple"
        );
      },

    setPageSize:
      function(size){
        applyFilter(
          {
            pageSize:
              size
          },
          "pageSize"
        );
      },

    setPage:
      function(page){
        update(
          {
            page:
              Math.max(
                1,
                Number(page) ||
                1
              )
          },
          {
            reason:
              "set-page"
          }
        );

        request(
          false,
          10
        );
      },

    status:
      function(){
        var current =
          state();

        return {
          ok:
            !current.lastError,

          version:
            VERSION,

          source:
            sourceName(),

          booted:
            booted,

          rendering:
            rendering,

          refreshing:
            !!refreshPromise,

          rows:
            current.rows.length,

          filtered:
            current
              .allRows
              .length,

          periods:
            current
              .periods
              .length,

          lastError:
            current.lastError,

          updatedAt:
            current.updatedAt
        };
      }
  };
})(window, document);
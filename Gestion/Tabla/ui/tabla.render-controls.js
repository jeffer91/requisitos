/* =========================================================
Nombre completo: tabla.render-controls.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/ui/tabla.render-controls.js
Función o funciones:
- Renderizar períodos, divisiones, carreras y chips de requisitos.
- Mantener los filtros actuales al reconstruir las opciones.
- Enlazar una sola vez los controles existentes de tabla.html.
Con qué se conecta:
- tabla.constants.js
- tabla.utils.js
- tabla.state.js
- tabla.app.js
- tabla.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "2.0.0";
  var C = window.TablaConstants || {};
  var U = window.TablaUtils || {};

  var bound = false;
  var searchTimer = null;
  var periodKey = "";
  var divisionKey = "";
  var careerKey = "";

  function el(id){
    return document.getElementById(id);
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

  function esc(value){
    return U.escapeHtml
      ? U.escapeHtml(value)
      : text(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#039;");
  }

  function periodId(item){
    return U.periodIdOf
      ? U.periodIdOf(item)
      : text(
          item &&
          (
            item.id ||
            item.periodoId ||
            item.value
          ) ||
          item
        );
  }

  function periodLabel(item){
    return U.periodLabelOf
      ? U.periodLabelOf(item)
      : text(
          item &&
          (
            item.label ||
            item.nombre ||
            item.id
          ) ||
          item
        );
  }

  function option(
    value,
    label,
    selected
  ){
    return (
      '<option value="' +
      esc(value) +
      '"' +
      (
        selected
          ? " selected"
          : ""
      ) +
      ">" +
      esc(label) +
      "</option>"
    );
  }

  function listKey(
    items,
    getter
  ){
    return (
      Array.isArray(items)
        ? items
        : []
    )
      .map(function(item){
        return getter(item);
      })
      .join("||");
  }

  function renderPeriods(
    periods,
    selected
  ){
    var select =
      el("tabla-periodo");

    if(!select){
      return;
    }

    periods =
      Array.isArray(periods)
        ? periods
        : [];

    var nextKey =
      listKey(
        periods,
        function(item){
          return (
            periodId(item) +
            "::" +
            periodLabel(item)
          );
        }
      );

    if(nextKey !== periodKey){
      select.innerHTML =
        option(
          "",
          "Seleccione un período",
          !selected
        ) +
        periods
          .map(function(item){
            var id =
              periodId(item);

            return option(
              id,
              periodLabel(item) ||
                id,
              id === selected
            );
          })
          .join("");

      periodKey = nextKey;
    }

    if(
      select.value !==
      text(selected)
    ){
      select.value =
        text(selected);
    }
  }

  function renderSimpleSelect(
    id,
    values,
    selected,
    emptyLabel,
    cacheName
  ){
    var select = el(id);

    if(!select){
      return;
    }

    values =
      Array.isArray(values)
        ? values
        : [];

    var nextKey =
      values.join("||");

    var currentKey =
      cacheName === "division"
        ? divisionKey
        : careerKey;

    if(nextKey !== currentKey){
      select.innerHTML =
        option(
          "",
          emptyLabel ||
            "Todas",
          !selected
        ) +
        values
          .map(function(value){
            return option(
              value,
              value,
              text(value) ===
                text(selected)
            );
          })
          .join("");

      if(
        cacheName ===
        "division"
      ){
        divisionKey =
          nextKey;
      }else{
        careerKey =
          nextKey;
      }
    }

    if(
      select.value !==
      text(selected)
    ){
      select.value =
        text(selected);
    }
  }

  function renderChips(
    requirements
  ){
    var wrap =
      el("tabla-req-chips");

    if(!wrap){
      return;
    }

    requirements =
      Array.isArray(
        requirements
      )
        ? requirements
        : [];

    Array.prototype
      .forEach.call(
        wrap.querySelectorAll(
          "[data-req-filter]"
        ),
        function(button){
          var reqKey =
            button.getAttribute(
              "data-req-filter"
            );

          var active =
            requirements
              .indexOf(reqKey) >= 0;

          button.classList
            .toggle(
              "is-active",
              active
            );

          button.setAttribute(
            "aria-pressed",
            active
              ? "true"
              : "false"
          );
        }
      );
  }

  function render(state){
    state = state || {};

    renderPeriods(
      state.periods || [],
      state.periodId || ""
    );

    renderSimpleSelect(
      "tabla-division",
      state.divisionOptions ||
        [],
      state.division || "",
      "Todas",
      "division"
    );

    renderSimpleSelect(
      "tabla-carrera",
      state.careerOptions ||
        [],
      state.career || "",
      "Todas",
      "career"
    );

    renderChips(
      state.requirements ||
      []
    );

    var search =
      el("tabla-search");

    if(
      search &&
      search.value !==
        text(state.search)
    ){
      search.value =
        text(state.search);
    }

    var matricula =
      el("tabla-matricula");

    if(
      matricula &&
      matricula.value !==
        text(state.matricula)
    ){
      matricula.value =
        text(state.matricula);
    }

    var status =
      el("tabla-estado");

    if(
      status &&
      status.value !==
        text(state.status)
    ){
      status.value =
        text(state.status);
    }

    var pageSize =
      el("tabla-page-size");

    if(
      pageSize &&
      pageSize.value !==
        text(state.pageSize)
    ){
      pageSize.value =
        text(state.pageSize);
    }
  }

  function nextRequirements(
    current,
    reqKey
  ){
    current =
      Array.isArray(current)
        ? current.slice()
        : [];

    var index =
      current.indexOf(reqKey);

    if(reqKey === "falta"){
      return index >= 0
        ? []
        : ["falta"];
    }

    current =
      current.filter(
        function(value){
          return (
            value !== "falta"
          );
        }
      );

    index =
      current.indexOf(reqKey);

    if(index >= 0){
      current.splice(
        index,
        1
      );
    }else{
      current.push(reqKey);
    }

    return current;
  }

  function bind(handlers){
    if(bound){
      return;
    }

    bound = true;
    handlers =
      handlers || {};

    function change(id, field){
      var node = el(id);

      if(!node){
        return;
      }

      node.addEventListener(
        "change",
        function(event){
          if(
            typeof handlers
              .onFilter ===
            "function"
          ){
            var patch = {};

            patch[field] =
              event.target.value;

            handlers.onFilter(
              patch,
              field
            );
          }
        }
      );
    }

    change(
      "tabla-periodo",
      "periodId"
    );

    change(
      "tabla-division",
      "division"
    );

    change(
      "tabla-carrera",
      "career"
    );

    change(
      "tabla-matricula",
      "matricula"
    );

    change(
      "tabla-estado",
      "status"
    );

    change(
      "tabla-page-size",
      "pageSize"
    );

    var search =
      el("tabla-search");

    if(search){
      search.addEventListener(
        "input",
        function(event){
          if(searchTimer){
            window.clearTimeout(
              searchTimer
            );
          }

          searchTimer =
            window.setTimeout(
              function(){
                searchTimer = null;

                if(
                  typeof handlers
                    .onFilter ===
                  "function"
                ){
                  handlers.onFilter(
                    {
                      search:
                        event.target
                          .value
                    },
                    "search"
                  );
                }
              },
              (
                C.delays &&
                C.delays.search
              ) ||
              300
            );
        }
      );
    }

    var refresh =
      el("tabla-refresh");

    if(refresh){
      refresh.addEventListener(
        "click",
        function(){
          if(
            typeof handlers
              .onRefresh ===
            "function"
          ){
            handlers.onRefresh();
          }
        }
      );
    }

    var chips =
      el("tabla-req-chips");

    if(chips){
      chips.addEventListener(
        "click",
        function(event){
          var button =
            event.target &&
            event.target.closest
              ? event.target.closest(
                  "[data-req-filter]"
                )
              : null;

          if(
            !button ||
            typeof handlers
              .onRequirements !==
              "function"
          ){
            return;
          }

          var current =
            window.TablaState &&
            typeof window.TablaState
              .get === "function"
              ? window.TablaState
                  .get()
                  .requirements
              : [];

          handlers.onRequirements(
            nextRequirements(
              current,
              button.getAttribute(
                "data-req-filter"
              )
            )
          );
        }
      );
    }
  }

  function invalidate(){
    periodKey = "";
    divisionKey = "";
    careerKey = "";
  }

  window.TablaRenderControls = {
    version:
      VERSION,

    render:
      render,

    renderPeriods:
      renderPeriods,

    renderChips:
      renderChips,

    bind:
      bind,

    nextRequirements:
      nextRequirements,

    invalidate:
      invalidate
  };
})(window, document);
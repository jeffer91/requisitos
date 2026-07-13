/* =========================================================
Nombre completo: tabla.history.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/history/tabla.history.js
Función o funciones:
- Exponer la API pública compatible de historial para Tabla.
- Coordinar almacenamiento, consultas y modal de historial.
- Mostrar únicamente el período seleccionado cuando existe.
- Limpiar el historial del período visible con confirmación.
Con qué se conecta:
- tabla.constants.js
- tabla.utils.js
- tabla.events.js
- tabla.history-store.js
- tabla.history-query.js
- tabla.actions.js
- tabla.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "2.0.0";
  var C = window.TablaConstants || {};
  var U = window.TablaUtils || {};
  var E = window.TablaEvents || null;

  var renderTimer = null;
  var bound = false;

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

  function esc(value){
    return U.escapeHtml
      ? U.escapeHtml(value)
      : text(value)
          .replace(
            /&/g,
            "&amp;"
          )
          .replace(
            /</g,
            "&lt;"
          )
          .replace(
            />/g,
            "&gt;"
          )
          .replace(
            /\"/g,
            "&quot;"
          )
          .replace(
            /'/g,
            "&#039;"
          );
  }

  function store(){
    return (
      window.TablaHistoryStore ||
      null
    );
  }

  function query(){
    return (
      window.TablaHistoryQuery ||
      null
    );
  }

  function status(
    message,
    type
  ){
    if(
      window.TablaRenderSummary &&
      typeof window
        .TablaRenderSummary
        .status === "function"
    ){
      window.TablaRenderSummary
        .status(
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

  function currentPeriod(){
    if(
      window.TablaApp &&
      typeof window
        .TablaApp
        .getState === "function"
    ){
      var current =
        window.TablaApp
          .getState();

      return {
        id:
          text(
            current.periodId
          ),

        label:
          text(
            current.periodLabel ||
            current.periodId
          )
      };
    }

    return {
      id: "",
      label: ""
    };
  }

  function shortDate(value){
    try{
      return value
        ? new Date(value)
            .toLocaleString(
              "es-EC"
            )
        : "—";
    }catch(error){
      return (
        text(value) ||
        "—"
      );
    }
  }

  function stateClass(item){
    var value =
      text(
        item &&
        item.estado
      ).toLowerCase();

    if(
      value === "enviado" ||
      value === "preparado"
    ){
      return "pill-ok";
    }

    if(value === "fallido"){
      return "pill-bad";
    }

    return "pill-warn";
  }

  function listForCurrentPeriod(){
    var currentQuery =
      query();

    if(!currentQuery){
      return [];
    }

    var period =
      currentPeriod();

    return period.id
      ? currentQuery
          .forPeriod(
            period.id
          )
      : currentQuery.read();
  }

  function renderSummary(list){
    var box =
      el(
        "tabla-history-summary"
      );

    var meta =
      el(
        "tabla-history-meta"
      );

    var currentQuery =
      query();

    var period =
      currentPeriod();

    if(
      !box ||
      !currentQuery
    ){
      return;
    }

    var result =
      currentQuery.summary(
        list
      );

    box.innerHTML = [
      '<span>Registros: <strong>' +
        esc(result.total) +
        "</strong></span>",

      '<span>Estudiantes: <strong>' +
        esc(
          result.estudiantes
        ) +
        "</strong></span>",

      '<span>WhatsApp: <strong>' +
        esc(
          result.whatsapp
        ) +
        "</strong></span>",

      '<span>Telegram: <strong>' +
        esc(
          result.telegram
        ) +
        "</strong></span>",

      '<span>Correo: <strong>' +
        esc(result.mail) +
        "</strong></span>",

      '<span>Confirmados: <strong>' +
        esc(
          result.countable
        ) +
        "</strong></span>",

      '<span>Fallidos: <strong>' +
        esc(
          result.fallidos
        ) +
        "</strong></span>",

      '<span>Omitidos: <strong>' +
        esc(
          result.omitidos
        ) +
        "</strong></span>"
    ].join("");

    if(meta){
      meta.textContent =
        period.id
          ? (
              "Historial del período " +
              (
                period.label ||
                period.id
              ) +
              ". Los contadores se separan por estudiante y período."
            )
          : "Historial general. Seleccione un período para limitar los registros.";
    }
  }

  function renderList(list){
    var box =
      el(
        "tabla-history-list"
      );

    if(!box){
      return;
    }

    if(!list.length){
      box.innerHTML =
        '<div class="empty">No existen mensajes registrados para el período seleccionado.</div>';

      return;
    }

    var visible =
      list.slice(
        0,
        300
      );

    var html =
      '<table class="tabla-mini-table">' +
      "<thead><tr>" +
      "<th>Fecha</th>" +
      "<th>Canal</th>" +
      "<th>Estudiante</th>" +
      "<th>Período</th>" +
      "<th>Tipo</th>" +
      "<th>Estado</th>" +
      "</tr></thead><tbody>";

    var currentQuery =
      query();

    html += visible
      .map(function(item){
        var channelLabel =
          currentQuery &&
          currentQuery.channelLabel
            ? currentQuery
                .channelLabel(
                  item.canal
                )
            : text(item.canal);

        return (
          "<tr>" +

          "<td>" +
          esc(
            shortDate(
              item.fecha
            )
          ) +
          "</td>" +

          "<td>" +
          esc(channelLabel) +
          "</td>" +

          "<td><strong>" +
          esc(
            item.nombre ||
            "Estudiante"
          ) +
          "</strong><br><small>" +
          esc(
            item.cedula ||
            "Sin cédula"
          ) +
          "</small></td>" +

          "<td>" +
          esc(
            item.periodo ||
            item.periodoId ||
            "—"
          ) +
          "</td>" +

          "<td>" +
          esc(
            item.tipoLabel ||
            item.tipoMensaje ||
            "Mensaje"
          ) +
          "</td>" +

          '<td><span class="pill ' +
          stateClass(item) +
          '">' +
          esc(
            item.estado ||
            "pendiente"
          ) +
          "</span></td>" +

          "</tr>"
        );
      })
      .join("");

    html +=
      "</tbody></table>";

    if(
      list.length >
      visible.length
    ){
      html +=
        '<div class="tabla-mass-note">Mostrando los ' +
        esc(visible.length) +
        " registros más recientes de " +
        esc(list.length) +
        ".</div>";
    }

    box.innerHTML = html;
  }

  function render(){
    var list =
      listForCurrentPeriod();

    renderSummary(list);
    renderList(list);

    var clear =
      el(
        "tabla-history-clear"
      );

    if(clear){
      clear.disabled =
        !list.length;
    }

    return list;
  }

  function scheduleRender(){
    if(renderTimer){
      window.clearTimeout(
        renderTimer
      );
    }

    renderTimer =
      window.setTimeout(
        function(){
          renderTimer = null;

          var modal =
            el(
              "tabla-history-modal"
            );

          if(
            modal &&
            !modal.hidden
          ){
            render();
          }
        },

        80
      );
  }

  function notify(detail){
    var currentQuery =
      query();

    if(
      currentQuery &&
      currentQuery.invalidate
    ){
      currentQuery.invalidate();
    }

    if(
      E &&
      E.emit
    ){
      E.emit(
        (
          C.events &&
          C.events.historyUpdated
        ) ||
        "tabla:history-updated",

        detail || {}
      );
    }else{
      try{
        window.dispatchEvent(
          new CustomEvent(
            "tabla:history-updated",
            {
              detail:
                detail || {}
            }
          )
        );
      }catch(error){}
    }

    scheduleRender();
  }

  function guardar(item){
    var currentStore =
      store();

    if(
      !currentStore ||
      !currentStore.save
    ){
      return null;
    }

    var saved =
      currentStore.save(item);

    notify({
      action:
        "save",

      item:
        saved
    });

    return saved;
  }

  function guardarVarios(items){
    var currentStore =
      store();

    if(
      !currentStore ||
      !currentStore.saveMany
    ){
      return [];
    }

    var saved =
      currentStore
        .saveMany(items);

    notify({
      action:
        "save-many",

      total:
        saved.length
    });

    return saved;
  }

  function limpiar(){
    var currentStore =
      store();

    var currentQuery =
      query();

    var period =
      currentPeriod();

    var list =
      listForCurrentPeriod();

    if(
      !currentStore ||
      !list.length
    ){
      return false;
    }

    var question =
      period.id
        ? (
            "¿Limpiar el historial del período " +
            (
              period.label ||
              period.id
            ) +
            "?"
          )
        : "¿Limpiar todo el historial de mensajes?";

    if(
      typeof window.confirm ===
        "function" &&
      !window.confirm(question)
    ){
      return false;
    }

    if(period.id){
      var ids =
        Object.create(null);

      list.forEach(
        function(item){
          ids[item.id] = true;
        }
      );

      currentStore.removeWhere(
        function(item){
          return !!ids[item.id];
        }
      );
    }else{
      currentStore.clear();
    }

    notify({
      action:
        "clear",

      periodId:
        period.id
    });

    status(
      period.id
        ? "Historial del período eliminado."
        : "Historial completo eliminado.",

      "ok"
    );

    render();
    return true;
  }

  function abrir(){
    render();

    var modal =
      el(
        "tabla-history-modal"
      );

    if(modal){
      modal.hidden = false;

      modal.setAttribute(
        "aria-hidden",
        "false"
      );
    }

    return true;
  }

  function cerrar(){
    var modal =
      el(
        "tabla-history-modal"
      );

    if(modal){
      modal.hidden = true;

      modal.setAttribute(
        "aria-hidden",
        "true"
      );
    }

    return true;
  }

  function bind(){
    if(bound){
      return;
    }

    bound = true;

    var close =
      el(
        "tabla-history-close"
      );

    var cancel =
      el(
        "tabla-history-cancel"
      );

    var clear =
      el(
        "tabla-history-clear"
      );

    var modal =
      el(
        "tabla-history-modal"
      );

    if(close){
      close.addEventListener(
        "click",
        cerrar
      );
    }

    if(cancel){
      cancel.addEventListener(
        "click",
        cerrar
      );
    }

    if(clear){
      clear.addEventListener(
        "click",
        limpiar
      );
    }

    if(modal){
      modal.addEventListener(
        "click",
        function(event){
          if(
            event.target ===
            modal
          ){
            cerrar();
          }
        }
      );
    }

    document.addEventListener(
      "keydown",
      function(event){
        if(
          event.key ===
            "Escape" &&
          modal &&
          !modal.hidden
        ){
          cerrar();
        }
      }
    );
  }

  function boot(){
    if(
      store() &&
      store().read
    ){
      store().read();
    }

    bind();
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

  window.TablaHistory = {
    version:
      VERSION,

    read:
      function(){
        return (
          query() &&
          query().read
            ? query().read()
            : []
        );
      },

    list:
      function(){
        return (
          query() &&
          query().read
            ? query().read()
            : []
        );
      },

    guardar:
      guardar,

    save:
      guardar,

    guardarVarios:
      guardarVarios,

    guardarMuchos:
      guardarVarios,

    saveMany:
      guardarVarios,

    limpiar:
      limpiar,

    clear:
      limpiar,

    forStudent:
      function(value){
        return (
          query() &&
          query().forStudent
            ? query()
                .forStudent(value)
            : []
        );
      },

    countsForStudent:
      function(value){
        return (
          query() &&
          query()
            .countsForStudent
            ? query()
                .countsForStudent(
                  value
                )
            : {
                wa: 0,
                whatsapp: 0,
                tg: 0,
                telegram: 0,
                email: 0,
                mail: 0,
                total: 0
              }
        );
      },

    lastForStudent:
      function(value){
        return (
          query() &&
          query()
            .lastForStudent
            ? query()
                .lastForStudent(
                  value
                )
            : null
        );
      },

    lastLabel:
      function(value){
        return (
          query() &&
          query().lastLabel
            ? query()
                .lastLabel(value)
            : "—"
        );
      },

    preloadForRows:
      function(rows){
        return (
          query() &&
          query()
            .preloadForRows
            ? query()
                .preloadForRows(
                  rows
                )
            : true
        );
      },

    render:
      render,

    abrir:
      abrir,

    open:
      abrir,

    cerrar:
      cerrar,

    close:
      cerrar,

    channel:
      function(value){
        return (
          query() &&
          query().channel
            ? query()
                .channel(value)
            : text(value)
        );
      },

    channelLabel:
      function(value){
        return (
          query() &&
          query().channelLabel
            ? query()
                .channelLabel(
                  value
                )
            : text(value)
        );
      },

    isCountable:
      function(item){
        return (
          query() &&
          query().isCountable
            ? query()
                .isCountable(
                  item
                )
            : false
        );
      },

    studentPeriodKey:
      function(
        cedula,
        periodId
      ){
        return (
          query() &&
          query()
            .studentPeriodKey
            ? query()
                .studentPeriodKey(
                  cedula,
                  periodId
                )
            : ""
        );
      },

    keyFromRow:
      function(row){
        return (
          query() &&
          query().keyFromRow
            ? query()
                .keyFromRow(row)
            : ""
        );
      },

    _cache:
      function(){
        var currentStore =
          store();

        var currentStatus =
          currentStore &&
          currentStore.status
            ? currentStore
                .status()
            : {};

        return {
          total:
            currentStatus.total ||
            0,

          version:
            currentStatus.revision ||
            0,

          storageKey:
            currentStatus
              .storageKey ||
            ""
        };
      }
  };
})(window, document);
/* =========================================================
Nombre completo: tabla.render-summary.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/ui/tabla.render-summary.js
Función o funciones:
- Mostrar el resumen compacto superior de Tabla.
- Mantener compatibilidad temporal con los antiguos indicadores KPI.
- Centralizar mensajes de estado, éxito, advertencia y error.
Con qué se conecta:
- tabla.utils.js
- tabla.app.js
- tabla.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "2.0.0";
  var U = window.TablaUtils || {};

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

  function setText(id, value){
    var node = el(id);

    if(node){
      node.textContent =
        value;
    }
  }

  function status(message, type){
    var box =
      el("tabla-status");

    if(!box){
      return;
    }

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

  function summaryMessage(
    summary,
    pagination,
    state
  ){
    summary =
      summary || {};

    pagination =
      pagination || {};

    state =
      state || {};

    var total =
      Number(
        summary.total ||
        pagination.total ||
        0
      );

    var shown =
      Array.isArray(state.rows)
        ? state.rows.length
        : 0;

    var periodLabel =
      text(
        state.periodLabel ||
        state.periodId
      );

    if(
      !state.periodId &&
      !total
    ){
      return "Seleccione un período o cambie los filtros para consultar estudiantes.";
    }

    if(!total){
      return "No existen estudiantes para los filtros seleccionados.";
    }

    var message =
      "Mostrando " +
      shown +
      " de " +
      total +
      " estudiante(s)";

    if(periodLabel){
      message +=
        " del período " +
        periodLabel;
    }

    message += ". ";

    message +=
      Number(
        summary.faltantes ||
        0
      ) +
      " tienen requisitos pendientes";

    message +=
      " y " +
      Number(
        summary.cumple ||
        0
      ) +
      " cumplen todo.";

    return message;
  }

  function render(
    summary,
    pagination,
    state
  ){
    summary =
      summary || {};

    setText(
      "tabla-kpi-total",
      Number(
        summary.total ||
        0
      )
    );

    setText(
      "tabla-kpi-ok",
      Number(
        summary.cumple ||
        0
      )
    );

    setText(
      "tabla-kpi-pend",
      Number(
        summary.pendiente ||
        0
      )
    );

    setText(
      "tabla-kpi-no",
      Number(
        summary.no_cumple ||
        0
      )
    );

    setText(
      "tabla-kpi-carreras",
      Number(
        summary.carreras ||
        0
      )
    );

    var compact =
      el("tabla-summary");

    var message =
      summaryMessage(
        summary,
        pagination,
        state
      );

    if(compact){
      compact.textContent =
        message;
    }

    return message;
  }

  window.TablaRenderSummary = {
    version:
      VERSION,

    render:
      render,

    message:
      summaryMessage,

    status:
      status,

    loading:
      function(message){
        status(
          message ||
          "Cargando tabla...",
          ""
        );
      },

    success:
      function(message){
        status(
          message,
          "ok"
        );
      },

    warning:
      function(message){
        status(
          message,
          "warn"
        );
      },

    error:
      function(message){
        status(
          message,
          "warn"
        );
      }
  };
})(window, document);
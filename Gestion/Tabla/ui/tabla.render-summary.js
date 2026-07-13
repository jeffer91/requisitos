/* =========================================================
Nombre completo: tabla.render-summary.js
Ruta: /Gestion/Tabla/ui/tabla.render-summary.js
Función:
- Mostrar el resumen compacto superior de Tabla.
- Diferenciar incumplimientos confirmados de datos pendientes de validación.
- Mantener compatibilidad con los antiguos indicadores KPI.
- Centralizar mensajes de estado, éxito, advertencia y error.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "3.0.0-functional-status-summary";
  var U = window.TablaUtils || {};

  function el(id){
    return document.getElementById(id);
  }

  function text(value){
    return U.text
      ? U.text(value)
      : String(value == null ? "" : value).trim();
  }

  function number(value){
    value = Number(value || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function setText(id, value){
    var node = el(id);
    if(node){
      node.textContent = value;
    }
  }

  function status(message, type){
    var box = el("tabla-status");
    if(!box){ return; }

    box.textContent = text(message);
    box.className = "tabla-status" + (type ? " " + type : "");
  }

  function studentWord(total){
    return total === 1 ? "estudiante" : "estudiantes";
  }

  function summaryMessage(summary, pagination, state){
    summary = summary || {};
    pagination = pagination || {};
    state = state || {};

    var total = number(summary.total || pagination.total);
    var shown = Array.isArray(state.rows) ? state.rows.length : 0;
    var periodLabel = text(state.periodLabel || state.periodId);
    var failed = number(summary.faltantes || summary.no_cumple);
    var noData = number(summary.sinDato || summary.pendiente);
    var complete = number(summary.cumple);

    if(!state.periodId && !total){
      return "Seleccione un período o cambie los filtros para consultar estudiantes.";
    }

    if(!total){
      return "No existen estudiantes para los filtros seleccionados.";
    }

    var message =
      "Mostrando " + shown + " de " + total + " " + studentWord(total);

    if(periodLabel){
      message += " del período " + periodLabel;
    }

    message += ". ";
    message += failed + " con incumplimientos confirmados";
    message += ", " + noData + " con información pendiente de validación";
    message += " y " + complete + " que cumplen todos los requisitos.";

    return message;
  }

  function render(summary, pagination, state){
    summary = summary || {};

    setText("tabla-kpi-total", number(summary.total));
    setText("tabla-kpi-ok", number(summary.cumple));
    setText("tabla-kpi-pend", number(summary.sinDato || summary.pendiente));
    setText("tabla-kpi-no", number(summary.faltantes || summary.no_cumple));
    setText("tabla-kpi-carreras", number(summary.carreras));

    var message = summaryMessage(summary, pagination, state);
    var compact = el("tabla-summary");

    if(compact){
      compact.textContent = message;
    }

    return message;
  }

  window.TablaRenderSummary = {
    version: VERSION,
    render: render,
    message: summaryMessage,
    status: status,
    loading: function(message){
      status(message || "Cargando tabla...", "");
    },
    success: function(message){
      status(message, "ok");
    },
    warning: function(message){
      status(message, "warn");
    },
    error: function(message){
      status(message, "warn");
    }
  };
})(window, document);

/* =========================================================
Nombre completo: ncomplex.table.js
Ruta o ubicación: /Ncomplex/ncomplex.table.js
Función o funciones:
- Dibujar la tabla editable de notas por estudiante.
- Adaptar columnas para examen complexivo o trabajo de titulación.
- Recalcular automáticamente notas finales y estado al editar.
- Marcar filas modificadas y abrir el popup de modalidad.
Con qué se conecta:
- ncomplex.config.js
- ncomplex.state.js
- ncomplex.calculator.js
- ncomplex.filters.js
- ncomplex.modal.js
- ncomplex.pagination.js
- ncomplex.app.js
========================================================= */
(function(window,document){
  "use strict";

  var Config = window.NcomplexConfig || {};
  var State = window.NcomplexState || {};
  var Calculator = window.NcomplexCalculator || {};
  var Filters = window.NcomplexFilters || {};

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function esc(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function recordId(row){
    return State.recordId ? State.recordId(row) : text(row && (row.idEstudiantePeriodo || row.id || row.cedula));
  }

  function noteValue(value){
    var parsed = Calculator.parse ? Calculator.parse(value) : value;
    return parsed == null ? "" : String(parsed).replace(".", ",");
  }

  function finalValue(value){
    return Calculator.display ? Calculator.display(value).replace(".", ",") : text(value || "—");
  }

  function noteInput(row, field, label){
    var id = recordId(row);
    return "<label class=\"ncomplex-note-cell\">" +
      "<span class=\"sr-only\">" + esc(label) + "</span>" +
      "<input type=\"text\" inputmode=\"decimal\" autocomplete=\"off\" " +
      "data-ncomplex-id=\"" + esc(id) + "\" " +
      "data-ncomplex-field=\"" + esc(field) + "\" " +
      "value=\"" + esc(noteValue(row[field])) + "\" placeholder=\"—\" />" +
      "</label>";
  }

  function statusBadge(row){
    var state = text(row.estadoEvaluacion || "SIN_NOTAS").toUpperCase();
    var label = Config.labelEstado ? Config.labelEstado(state) : state;
    var className = state === "APROBADO"
      ? "is-success"
      : state === "NO_APROBADO"
        ? "is-danger"
        : state === "INCOMPLETO"
          ? "is-warning"
          : "is-muted";
    return "<span class=\"ncomplex-status " + className + "\">" + esc(label) + "</span>";
  }

  function modalityBadge(row){
    var mode = text(row.modalidadTitulacion);
    var label = Config.labelModalidad ? Config.labelModalidad(mode) : mode;
    return "<span class=\"ncomplex-modality\">" + esc(label) + "</span>";
  }

  function identityCells(row){
    var name = Filters.nameOf ? Filters.nameOf(row) : text(row.Nombres || row.nombres);
    var career = Filters.careerOf ? Filters.careerOf(row) : text(row.NombreCarrera || row.carrera);
    var schedule = text(row.HorarioComplexivo || row.horarioOrigen || row.Horario || "—");
    var conflict = row._ncomplexConflict
      ? "<span class=\"ncomplex-row-warning\" title=\"Existe una diferencia con una nota guardada\">Conflicto</span>"
      : "";

    return "<td class=\"ncomplex-student\"><strong>" + esc(name || "Sin nombre") + "</strong>" +
      "<span>" + esc(row.cedula || row.numeroIdentificacion || "") + "</span>" + conflict + "</td>" +
      "<td><span class=\"ncomplex-career\">" + esc(career || "SIN CARRERA") + "</span></td>" +
      "<td>" + esc(schedule) + "</td>" +
      "<td>" + modalityBadge(row) + "</td>";
  }

  function complexivoCells(row){
    return "<td>" + noteInput(row, "notaTeorica", "Nota teórica") + "</td>" +
      "<td>" + noteInput(row, "notaPractica", "Nota práctica") + "</td>" +
      "<td class=\"ncomplex-final\">" + finalValue(row.notaComplexivo) + "</td>" +
      "<td>" + noteInput(row, "notaTeoricaSupletorio", "Teórico supletorio") + "</td>" +
      "<td>" + noteInput(row, "notaPracticaSupletorio", "Práctico supletorio") + "</td>" +
      "<td class=\"ncomplex-final\">" + finalValue(row.notaSupletorio) + "</td>";
  }

  function workCells(row){
    return "<td>" + noteInput(row, "notaEscrito", "Nota escrita") + "</td>" +
      "<td>" + noteInput(row, "notaDefensaTrabajo", "Nota de defensa") + "</td>" +
      "<td class=\"ncomplex-final\">" + finalValue(row.notaTrabajoTitulacion) + "</td>" +
      "<td class=\"ncomplex-na\">—</td>" +
      "<td class=\"ncomplex-na\">—</td>" +
      "<td class=\"ncomplex-na\">—</td>";
  }

  function rowHtml(row, index){
    var mode = text(row.modalidadTitulacion);
    var isWork = mode === (Config.modalidades && Config.modalidades.TRABAJO);
    var id = recordId(row);

    return "<tr data-ncomplex-row=\"" + esc(id) + "\">" +
      "<td class=\"ncomplex-index\">" + (index + 1) + "</td>" +
      identityCells(row) +
      (isWork ? workCells(row) : complexivoCells(row)) +
      "<td class=\"ncomplex-final ncomplex-official\">" + finalValue(row.notaOficial) + "</td>" +
      "<td>" + statusBadge(row) + "</td>" +
      "<td class=\"ncomplex-actions\">" +
        "<button type=\"button\" data-ncomplex-action=\"modality\" data-ncomplex-id=\"" + esc(id) + "\">Cambiar modalidad</button>" +
      "</td></tr>";
  }

  function headers(mode){
    var isWork = mode === (Config.modalidades && Config.modalidades.TRABAJO);
    var isComplex = mode === (Config.modalidades && Config.modalidades.COMPLEXIVO);
    var first = isWork ? "Escrito" : isComplex ? "Teórico" : "Nota A";
    var second = isWork ? "Defensa" : isComplex ? "Práctico" : "Nota B";
    var final = isWork ? "Final trabajo" : isComplex ? "Final complexivo" : "Final";

    return [
      "#", "Estudiante", "Carrera", "Horario", "Modalidad",
      first, second, final,
      "Teórico supl.", "Práctico supl.", "Final supl.",
      "Nota oficial", "Estado", "Acciones"
    ];
  }

  function render(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};
    var id = Config.selectors && Config.selectors.tabla || "ncomplex-table-wrap";
    var container = document.getElementById(id);
    if(!container){ return; }

    if(!rows.length){
      container.innerHTML = "<div class=\"ncomplex-empty\"><strong>No hay estudiantes para mostrar.</strong><span>Seleccione un período o cambie los filtros.</span></div>";
      return;
    }

    var mode = options.modalidad || "";
    var headerHtml = headers(mode).map(function(label){
      return "<th scope=\"col\">" + esc(label) + "</th>";
    }).join("");

    var offset = Math.max(0, Number(options.offset || 0));
    container.innerHTML = "<table class=\"ncomplex-table\"><thead><tr>" + headerHtml +
      "</tr></thead><tbody>" + rows.map(function(row,index){
        return rowHtml(row, offset + index);
      }).join("") + "</tbody></table>";
  }

  function bind(){
    var id = Config.selectors && Config.selectors.tabla || "ncomplex-table-wrap";
    var container = document.getElementById(id);
    if(!container || container.__ncomplexBound){ return; }
    container.__ncomplexBound = true;

    container.addEventListener("change", function(event){
      var input = event.target.closest("[data-ncomplex-field]");
      if(!input){ return; }
      var idValue = text(input.getAttribute("data-ncomplex-id"));
      var field = text(input.getAttribute("data-ncomplex-field"));
      var currentState = State.get ? State.get() : {};
      var row = (currentState.records || []).filter(function(item){ return recordId(item) === idValue; })[0];
      if(!row){ return; }

      var next = Object.assign({}, row);
      next[field] = Calculator.parse ? Calculator.parse(input.value) : input.value;
      next = Calculator.recalculate ? Calculator.recalculate(next) : next;
      if(State.updateRecord){ State.updateRecord(idValue, next, "note-edited"); }

      if(window.NcomplexApp && typeof window.NcomplexApp.render === "function"){
        window.NcomplexApp.render({ preserveFocus: true });
      }
    });

    container.addEventListener("keydown", function(event){
      var input = event.target.closest("[data-ncomplex-field]");
      if(!input || event.key !== "Enter"){ return; }
      event.preventDefault();
      var inputs = Array.prototype.slice.call(container.querySelectorAll("[data-ncomplex-field]"));
      var index = inputs.indexOf(input);
      if(index >= 0 && inputs[index + 1]){ inputs[index + 1].focus(); inputs[index + 1].select(); }
    });

    container.addEventListener("click", function(event){
      var button = event.target.closest("[data-ncomplex-action=\"modality\"]");
      if(!button){ return; }
      var currentState = State.get ? State.get() : {};
      var idValue = text(button.getAttribute("data-ncomplex-id"));
      var row = (currentState.records || []).filter(function(item){ return recordId(item) === idValue; })[0];
      if(row && window.NcomplexModal && typeof window.NcomplexModal.open === "function"){
        window.NcomplexModal.open(row);
      }
    });
  }

  window.NcomplexTable = {
    version: "1.0.0-bloque-2",
    render: render,
    bind: bind,
    recordId: recordId
  };
})(window,document);
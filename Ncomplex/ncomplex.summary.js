/* =========================================================
Nombre completo: ncomplex.summary.js
Ruta o ubicación: /Ncomplex/ncomplex.summary.js
Función o funciones:
- Calcular indicadores generales de estudiantes y notas.
- Agrupar resultados por carrera y modalidad.
- Mostrar resultados del cruce de texto: encontrados, no encontrados, duplicados y conflictos.
Con qué se conecta:
- ncomplex.config.js
- ncomplex.filters.js
- ncomplex.matcher.js
- ncomplex.app.js
========================================================= */
(function(window,document){
  "use strict";

  var Config = window.NcomplexConfig || {};
  var Filters = window.NcomplexFilters || {};

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function summarize(rows){
    rows = Array.isArray(rows) ? rows : [];
    var modes = Config.modalidades || {};
    var result = {
      total: rows.length,
      complexivo: 0,
      trabajo: 0,
      completos: 0,
      incompletos: 0,
      sinNotas: 0,
      aprobados: 0,
      noAprobados: 0,
      porCarrera: Object.create(null)
    };

    rows.forEach(function(row){
      var mode = text(row.modalidadTitulacion);
      var state = text(row.estadoEvaluacion).toUpperCase();
      var career = Filters.careerOf ? Filters.careerOf(row) : text(row.NombreCarrera || row.carrera || "SIN CARRERA");

      if(mode === modes.TRABAJO){ result.trabajo += 1; }
      else{ result.complexivo += 1; }

      if(state === "SIN_NOTAS"){ result.sinNotas += 1; }
      else if(state === "INCOMPLETO"){ result.incompletos += 1; }
      else{ result.completos += 1; }

      if(state === "APROBADO"){ result.aprobados += 1; }
      if(state === "NO_APROBADO"){ result.noAprobados += 1; }

      if(!result.porCarrera[career]){
        result.porCarrera[career] = {
          carrera: career,
          total: 0,
          complexivo: 0,
          trabajo: 0,
          completos: 0,
          incompletos: 0,
          sinNotas: 0
        };
      }

      var item = result.porCarrera[career];
      item.total += 1;
      if(mode === modes.TRABAJO){ item.trabajo += 1; }
      else{ item.complexivo += 1; }
      if(state === "SIN_NOTAS"){ item.sinNotas += 1; }
      else if(state === "INCOMPLETO"){ item.incompletos += 1; }
      else{ item.completos += 1; }
    });

    return result;
  }

  function card(label, value, className){
    return "<article class=\"ncomplex-kpi " + (className || "") + "\">" +
      "<span>" + label + "</span>" +
      "<strong>" + value + "</strong>" +
      "</article>";
  }

  function render(rows){
    var summary = summarize(rows);
    var id = Config.selectors && Config.selectors.resumen || "ncomplex-summary";
    var container = document.getElementById(id);
    if(container){
      container.innerHTML = [
        card("Estudiantes", summary.total, ""),
        card("Complexivo", summary.complexivo, ""),
        card("Trabajo de titulación", summary.trabajo, ""),
        card("Notas completas", summary.completos, "is-success"),
        card("Incompletos", summary.incompletos, "is-warning"),
        card("Sin notas", summary.sinNotas, "is-muted"),
        card("Aprobados", summary.aprobados, "is-success"),
        card("No aprobados", summary.noAprobados, "is-danger")
      ].join("");
    }

    renderCareers(summary);
    return summary;
  }

  function renderCareers(summary){
    var id = Config.selectors && Config.selectors.resumenCarreras || "ncomplex-career-summary";
    var container = document.getElementById(id);
    if(!container){ return; }

    var rows = Object.keys(summary.porCarrera || {})
      .map(function(key){ return summary.porCarrera[key]; })
      .sort(function(a,b){ return a.carrera.localeCompare(b.carrera); });

    if(!rows.length){
      container.innerHTML = "<div class=\"ncomplex-empty-inline\">Seleccione un período para ver carreras y modalidades.</div>";
      return;
    }

    container.innerHTML = rows.map(function(item){
      return "<article class=\"ncomplex-career-card\">" +
        "<div><strong>" + escapeHtml(item.carrera) + "</strong>" +
        "<span>" + item.total + " estudiante(s)</span></div>" +
        "<div class=\"ncomplex-career-counts\">" +
        "<button type=\"button\" data-ncomplex-career=\"" + escapeAttr(item.carrera) + "\" data-ncomplex-mode=\"EXAMEN_COMPLEXIVO\">Complexivo: " + item.complexivo + "</button>" +
        "<button type=\"button\" data-ncomplex-career=\"" + escapeAttr(item.carrera) + "\" data-ncomplex-mode=\"TRABAJO_TITULACION\">Trabajo: " + item.trabajo + "</button>" +
        "<span>Faltan: " + (item.incompletos + item.sinNotas) + "</span>" +
        "</div></article>";
    }).join("");
  }

  function renderImport(result){
    var id = Config.selectors && Config.selectors.resultadosImportacion || "ncomplex-import-results";
    var container = document.getElementById(id);
    if(!container){ return; }

    if(!result){
      container.innerHTML = "<div class=\"ncomplex-empty-inline\">Todavía no se han analizado datos pegados.</div>";
      return;
    }

    container.innerHTML = [
      card("Filas detectadas", Number(result.totalImported || 0), ""),
      card("Encontrados", Number(result.totalMatched || 0), "is-success"),
      card("No encontrados", Number(result.totalUnmatched || 0), "is-danger"),
      card("Duplicados", Number(result.totalDuplicates || 0), "is-warning"),
      card("Conflictos", Number(result.totalConflicts || 0), "is-warning")
    ].join("");

    var details = document.getElementById("ncomplex-import-details");
    if(details){
      var unmatched = (result.unmatched || []).map(function(item){
        return escapeHtml((item.imported && item.imported.cedula || "Sin cédula") + " — " + item.reason);
      });
      var duplicates = (result.duplicates || []).map(function(item){
        return escapeHtml(item.imported && item.imported.cedula || "Sin cédula");
      });
      var conflicts = (result.conflicts || []).map(function(item){
        return escapeHtml(item.cedula + " — " + item.conflicts.length + " campo(s)");
      });

      details.innerHTML = "";
      if(unmatched.length){ details.innerHTML += "<p><strong>No encontrados:</strong> " + unmatched.join("; ") + "</p>"; }
      if(duplicates.length){ details.innerHTML += "<p><strong>Duplicados:</strong> " + duplicates.join("; ") + "</p>"; }
      if(conflicts.length){ details.innerHTML += "<p><strong>Conflictos:</strong> " + conflicts.join("; ") + "</p>"; }
    }
  }

  function escapeHtml(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value){
    return escapeHtml(value);
  }

  window.NcomplexSummary = {
    version: "1.0.0-bloque-2",
    summarize: summarize,
    render: render,
    renderImport: renderImport,
    escapeHtml: escapeHtml
  };
})(window,document);
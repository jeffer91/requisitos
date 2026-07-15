/* =========================================================
Nombre completo: ncomplex.filters.js
Ruta o ubicación: /Ncomplex/ncomplex.filters.js
Función o funciones:
- Construir las opciones de carrera desde los estudiantes cargados.
- Aplicar filtros de carrera, modalidad, estado, búsqueda y notas faltantes.
- Mantener sincronizados los controles visuales con NcomplexState.
Con qué se conecta:
- ncomplex.config.js
- ncomplex.state.js
- ncomplex.pagination.js
- ncomplex.summary.js
- ncomplex.table.js
- ncomplex.app.js
========================================================= */
(function(window,document){
  "use strict";

  var Config = window.NcomplexConfig || {};
  var State = window.NcomplexState || {};

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function careerOf(row){
    row = row || {};
    return text(
      row.NombreCarrera ||
      row.nombreCarrera ||
      row.Carrera ||
      row.carrera ||
      row._carrera ||
      "SIN CARRERA"
    );
  }

  function nameOf(row){
    row = row || {};
    return text(
      row.Nombres ||
      row.nombres ||
      row.Nombre ||
      row.nombre ||
      row.nombreCompleto ||
      ""
    );
  }

  function careers(rows){
    var map = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var label = careerOf(row);
      var key = norm(label);
      if(key && !map[key]){ map[key] = label; }
    });
    return Object.keys(map)
      .map(function(key){ return map[key]; })
      .sort(function(a,b){ return norm(a).localeCompare(norm(b)); });
  }

  function apply(rows, filters){
    rows = Array.isArray(rows) ? rows : [];
    filters = filters || {};

    var career = norm(filters.carrera);
    var modality = text(filters.modalidad);
    var state = text(filters.estado).toUpperCase();
    var search = norm(filters.search);
    var enrollment = text(filters.estadoMatricula).toUpperCase();
    var missingOnly = filters.soloFaltantes === true;

    return rows.filter(function(row){
      if(career && norm(careerOf(row)) !== career){ return false; }
      if(modality && text(row.modalidadTitulacion) !== modality){ return false; }
      if(state && text(row.estadoEvaluacion).toUpperCase() !== state){ return false; }
      if(
        enrollment &&
        enrollment !== "TODOS" &&
        enrollment !== "TODO" &&
        text(row.estadoMatricula || row._estadoMatricula).toUpperCase() !== enrollment
      ){
        return false;
      }
      if(missingOnly){
        var current = text(row.estadoEvaluacion).toUpperCase();
        if(current !== "SIN_NOTAS" && current !== "INCOMPLETO"){ return false; }
      }
      if(search){
        var hay = norm([
          row.cedula,
          row.numeroIdentificacion,
          nameOf(row),
          careerOf(row),
          row.CodigoCarrera,
          row.codigoTitulacion,
          row.HorarioComplexivo,
          row.horarioOrigen
        ].join(" "));
        if(hay.indexOf(search) < 0){ return false; }
      }
      return true;
    });
  }

  function fillSelect(id, values, firstLabel){
    var select = document.getElementById(id);
    if(!select){ return; }
    var current = select.value;
    select.innerHTML = "";

    var first = document.createElement("option");
    first.value = "";
    first.textContent = firstLabel;
    select.appendChild(first);

    values.forEach(function(value){
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });

    if(values.indexOf(current) >= 0){ select.value = current; }
  }

  function renderCareers(rows){
    var list = careers(rows);
    fillSelect(
      Config.selectors && Config.selectors.carrera || "ncomplex-filter-carrera",
      list,
      "Todas las carreras"
    );
    if(State.patch){ State.patch({ careers: list }, "careers"); }
    return list;
  }

  function readControls(){
    function value(id){
      var element = document.getElementById(id);
      return element ? element.value : "";
    }

    var checkbox = document.getElementById(
      Config.selectors && Config.selectors.soloFaltantes || "ncomplex-filter-faltantes"
    );

    return {
      carrera: value(Config.selectors && Config.selectors.carrera || "ncomplex-filter-carrera"),
      modalidad: value(Config.selectors && Config.selectors.modalidad || "ncomplex-filter-modalidad"),
      estado: value(Config.selectors && Config.selectors.estado || "ncomplex-filter-estado"),
      search: value(Config.selectors && Config.selectors.busqueda || "ncomplex-filter-search"),
      soloFaltantes: !!(checkbox && checkbox.checked),
      estadoMatricula: "ACTIVO"
    };
  }

  function resetControls(){
    [
      Config.selectors && Config.selectors.carrera || "ncomplex-filter-carrera",
      Config.selectors && Config.selectors.modalidad || "ncomplex-filter-modalidad",
      Config.selectors && Config.selectors.estado || "ncomplex-filter-estado",
      Config.selectors && Config.selectors.busqueda || "ncomplex-filter-search"
    ].forEach(function(id){
      var element = document.getElementById(id);
      if(element){ element.value = ""; }
    });

    var checkbox = document.getElementById(
      Config.selectors && Config.selectors.soloFaltantes || "ncomplex-filter-faltantes"
    );
    if(checkbox){ checkbox.checked = false; }

    var values = readControls();
    if(State.setFilters){ State.setFilters(values, "filters-reset"); }
    return values;
  }

  window.NcomplexFilters = {
    version: "1.0.0-bloque-2",
    careers: careers,
    apply: apply,
    renderCareers: renderCareers,
    readControls: readControls,
    resetControls: resetControls,
    careerOf: careerOf,
    nameOf: nameOf
  };
})(window,document);
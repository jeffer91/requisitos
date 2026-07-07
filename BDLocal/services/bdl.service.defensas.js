/* =========================================================
Archivo: bdl.service.defensas.js
Ruta: /BDLocal/services/bdl.service.defensas.js
Función:
- Servicio de consulta para Defensas / DefArt.
- Entregar resultados filtrados y paginados con límite recomendado de 25.
- Preparar a Defensas para dejar de cargar toda la base y filtrar en pantalla.
Con qué se conecta:
- BDLocal/services/bdl.service.estudiantes.js
- BDLocal/repositories/bdl.repo.notas.js
- BDLocal/repositories/bdl.repo.requisitos.js
========================================================= */
(function(window){
  "use strict";

  var Services = window.BDLServices;
  if(!Services){ return; }

  function text(value){ return Services.text(value); }
  function numberOrNull(value){
    var raw = text(value).replace(",", ".");
    if(!raw){ return null; }
    var n = Number(raw);
    return isFinite(n) ? n : null;
  }

  function notaEstado(row){
    var nart = numberOrNull(row.Notart || row.Nart || row.nart || row.notart);
    var ndef = numberOrNull(row.Notdef || row.Ndef || row.ndef || row.notdef);
    var nfin = numberOrNull(row.Notafinal || row.Nfinal || row.nfin || row.notafinal);

    if(nart == null){ return "SIN_ARTICULO"; }
    if(nart < 7){ return "ARTICULO_NO_APROBADO"; }
    if(ndef == null){ return "PENDIENTE_DEFENSA"; }
    if(nfin == null){ return "PENDIENTE_FINAL"; }
    return nfin >= 7 ? "APROBADO" : "NO_APROBADO";
  }

  function hydrateWithNotas(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};

    var notasRepo = Services.repo("notas");
    if(!notasRepo || typeof notasRepo.list !== "function"){
      return Promise.resolve(rows.map(function(row){
        row = Object.assign({}, row || {});
        row._estadoDefensa = notaEstado(row);
        return row;
      }));
    }

    return notasRepo.list({ periodoId: options.periodoId }).then(function(notas){
      var map = Object.create(null);
      (notas || []).forEach(function(nota){
        map[text(nota.periodoId) + "__" + text(nota.cedula)] = nota;
      });

      return rows.map(function(row){
        row = Object.assign({}, row || {});
        var nota = map[text(row.periodoId) + "__" + text(row.cedula)] || null;
        if(nota){
          row.Notart = nota.notart != null ? nota.notart : row.Notart;
          row.Notdef = nota.notdef != null ? nota.notdef : row.Notdef;
          row.Notafinal = nota.notafinal != null ? nota.notafinal : row.Notafinal;
          row._bdlNotas = nota;
        }
        row._estadoDefensa = nota ? (nota.estadoNota || notaEstado(row)) : notaEstado(row);
        return row;
      });
    });
  }

  function filterDefensas(rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows : [];

    if(text(options.estado) && text(options.estado) !== "TODOS"){
      rows = rows.filter(function(row){ return text(row._estadoDefensa) === text(options.estado); });
    }

    return rows;
  }

  function getPage(options){
    options = Object.assign({ page: 1, limit: 25, matricula: "ACTIVO" }, options || {});

    var estudiantes = Services.get("estudiantes");
    if(!estudiantes || typeof estudiantes.list !== "function"){
      return Promise.resolve({ rows: [], page: 1, limit: options.limit, total: 0, totalPages: 1, hasPrev: false, hasNext: false });
    }

    return estudiantes.list(options)
      .then(function(rows){ return hydrateWithNotas(rows, options); })
      .then(function(rows){ return filterDefensas(rows, options); })
      .then(function(rows){ return Services.paginate(rows, options); });
  }

  function getFiltered(options){
    options = Object.assign({ matricula: "ACTIVO" }, options || {});
    var estudiantes = Services.get("estudiantes");
    if(!estudiantes || typeof estudiantes.list !== "function"){
      return Promise.resolve([]);
    }
    return estudiantes.list(options)
      .then(function(rows){ return hydrateWithNotas(rows, options); })
      .then(function(rows){ return filterDefensas(rows, options); });
  }

  function saveNota(row){
    var notasRepo = Services.repo("notas");
    if(!notasRepo || typeof notasRepo.save !== "function"){
      return Promise.reject(new Error("Repositorio de notas no disponible."));
    }
    return notasRepo.save(row || {});
  }

  var api = {
    getPage: getPage,
    getFiltered: getFiltered,
    saveNota: saveNota,
    hydrateWithNotas: hydrateWithNotas,
    notaEstado: notaEstado
  };

  Services.register("defensas", api);
  window.BDLServiceDefensas = api;
})(window);

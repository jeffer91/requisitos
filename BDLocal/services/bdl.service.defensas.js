/* =========================================================
Archivo: bdl.service.defensas.js
Ruta: /BDLocal/services/bdl.service.defensas.js
Función:
- Servicio de consulta real para Defensas / DefArt.
- Pedir páginas desde BDLServiceEstudiantes.
- Hidratar notas solo sobre la página visible cuando sea posible.
- Mantener getFiltered para exportaciones con filtros completos.
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

  function rowKey(row){ return text(row && (row.idEstudiantePeriodo || row.studentId || ((row.periodoId || "") + "__" + (row.cedula || "")))); }

  function hydrateWithNotas(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};
    var notasRepo = Services.repo("notas") || Services.repo("notas_titulacion");
    if(!notasRepo || typeof notasRepo.list !== "function" || !rows.length){
      return Promise.resolve(rows.map(function(row){ row = Object.assign({}, row || {}); row._estadoDefensa = notaEstado(row); return row; }));
    }

    var ids = Object.create(null);
    rows.forEach(function(row){ ids[rowKey(row)] = true; });

    return notasRepo.list({ periodoId: options.periodoId }).then(function(notas){
      var map = Object.create(null);
      (notas || []).forEach(function(nota){
        var key = rowKey(nota) || text(nota.idEstudiantePeriodo) || text(nota.periodoId) + "__" + text(nota.cedula);
        if(ids[key]){ map[key] = nota; }
      });
      return rows.map(function(row){
        row = Object.assign({}, row || {});
        var nota = map[rowKey(row)] || null;
        if(nota){
          row.Notart = nota.notart != null ? nota.notart : (nota.Notart != null ? nota.Notart : row.Notart);
          row.Notdef = nota.notdef != null ? nota.notdef : (nota.Notdef != null ? nota.Notdef : row.Notdef);
          row.Notafinal = nota.notafinal != null ? nota.notafinal : (nota.Notafinal != null ? nota.Notafinal : row.Notafinal);
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

  function emptyPage(options){
    options = options || {};
    return { rows: [], page: Number(options.page || 1), limit: Number(options.limit || 25), total: 0, totalPages: 1, hasPrev: false, hasNext: false, source: "defensas" };
  }

  function getPage(options){
    options = Object.assign({ page: 1, limit: 25, matricula: "ACTIVO" }, options || {});
    var estudiantes = Services.get("estudiantes");
    if(!estudiantes){ return Promise.resolve(emptyPage(options)); }

    var needsEstadoFilter = !!text(options.estado) && text(options.estado) !== "TODOS";

    if(!needsEstadoFilter && typeof estudiantes.page === "function"){
      return estudiantes.page(options).then(function(paged){
        return hydrateWithNotas(paged.rows || [], options).then(function(rows){
          paged.rows = rows;
          paged.source = "defensas_page_real";
          paged.notesHydrated = rows.length;
          return paged;
        });
      });
    }

    if(typeof estudiantes.list !== "function"){ return Promise.resolve(emptyPage(options)); }
    return estudiantes.list(options)
      .then(function(rows){ return hydrateWithNotas(rows, options); })
      .then(function(rows){ return filterDefensas(rows, options); })
      .then(function(rows){ var paged = Services.paginate(rows, options); paged.source = "defensas_filtered_full"; return paged; });
  }

  function getFiltered(options){
    options = Object.assign({ matricula: "ACTIVO" }, options || {});
    var estudiantes = Services.get("estudiantes");
    if(!estudiantes || typeof estudiantes.list !== "function"){ return Promise.resolve([]); }
    return estudiantes.list(options)
      .then(function(rows){ return hydrateWithNotas(rows, options); })
      .then(function(rows){ return filterDefensas(rows, options); });
  }

  function saveNota(row){
    var notasRepo = Services.repo("notas") || Services.repo("notas_titulacion");
    if(!notasRepo || typeof notasRepo.save !== "function"){
      return Promise.reject(new Error("Repositorio de notas no disponible."));
    }
    return notasRepo.save(row || {});
  }

  var api = { getPage:getPage, getFiltered:getFiltered, saveNota:saveNota, hydrateWithNotas:hydrateWithNotas, filterDefensas:filterDefensas, notaEstado:notaEstado };
  Services.register("defensas", api);
  window.BDLServiceDefensas = api;
})(window);

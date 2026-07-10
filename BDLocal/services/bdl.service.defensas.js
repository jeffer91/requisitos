/* =========================================================
Archivo: bdl.service.defensas.js
Ruta: /BDLocal/services/bdl.service.defensas.js
Función:
- Servicio de consulta real para Defensas / DefArt.
- Pedir estudiantes desde BDLServiceEstudiantes.
- Hidratar notas solo sobre la página visible cuando sea posible.
- Hidratar todo solo cuando se filtra por estado de defensa.
- Mantener getFiltered para exportaciones con filtros completos.
========================================================= */
(function(window){
  "use strict";

  var Services = window.BDLServices;
  if(!Services){ return; }

  var VERSION = "1.1.0-fast-defensas";

  function text(value){
    return Services.text ? Services.text(value) : String(value == null ? "" : value).trim();
  }

  function normalizeSearch(value){
    return Services.normalizeSearch ? Services.normalizeSearch(value) : text(value).toLowerCase();
  }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }

    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4] : value.replace(/_+/g, "__");
  }

  function numberOrNull(value){
    var raw = text(value).replace(",", ".");
    if(!raw){ return null; }

    var n = Number(raw);
    return isFinite(n) ? n : null;
  }

  function estudiantesService(){
    return Services.get("estudiantes");
  }

  function notasRepo(){
    return Services.repo("notas") || Services.repo("notas_titulacion");
  }

  function rowKey(row){
    row = row || {};

    var direct = text(row.idEstudiantePeriodo || row.studentId || "");
    if(direct){ return direct; }

    var periodoId = canonicalPeriodId(row.periodoId || row.periodId || row.periodoCanonicoId || "");
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || "");

    return periodoId && cedula ? periodoId + "__" + cedula : "";
  }

  function notaEstado(row){
    row = row || {};

    var nart = numberOrNull(row.Notart || row.Nart || row.nart || row.notart || row.notaArticulo || row.articulo);
    var ndef = numberOrNull(row.Notdef || row.Ndef || row.ndef || row.notdef || row.notaDefensa || row.defensa);
    var nfin = numberOrNull(row.Notafinal || row.Nfinal || row.nfin || row.notafinal || row.notaFinal || row.final);

    if(nart == null){ return "SIN_ARTICULO"; }
    if(nart < 7){ return "ARTICULO_NO_APROBADO"; }
    if(ndef == null){ return "PENDIENTE_DEFENSA"; }
    if(nfin == null){ return "PENDIENTE_FINAL"; }

    return nfin >= 7 ? "APROBADO" : "NO_APROBADO";
  }

  function estadoLabel(estado){
    estado = text(estado || "");
    var map = {
      SIN_ARTICULO: "Sin artículo",
      ARTICULO_NO_APROBADO: "Artículo no aprobado",
      PENDIENTE_DEFENSA: "Pendiente defensa",
      PENDIENTE_FINAL: "Pendiente nota final",
      APROBADO: "Aprobado",
      NO_APROBADO: "No aprobado"
    };

    return map[estado] || estado || "Sin estado";
  }

  function copyNotaFields(row, nota){
    row = Object.assign({}, row || {});
    nota = nota || null;

    if(!nota){
      row._estadoDefensa = notaEstado(row);
      row.estadoDefensa = row.estadoDefensa || row._estadoDefensa;
      row.estadoDefensaLabel = estadoLabel(row._estadoDefensa);
      return row;
    }

    row.Notart = nota.notart != null ? nota.notart : (nota.Notart != null ? nota.Notart : row.Notart);
    row.Nart = row.Notart;

    row.Notdef = nota.notdef != null ? nota.notdef : (nota.Notdef != null ? nota.Notdef : row.Notdef);
    row.Ndef = row.Notdef;

    row.Notafinal = nota.notafinal != null ? nota.notafinal : (nota.Notafinal != null ? nota.Notafinal : row.Notafinal);
    row.Nfinal = row.Notafinal;

    row.observacionDefensa = text(nota.observacion || nota.observacionDefensa || row.observacionDefensa || "");
    row.fechaDefensa = text(nota.fechaDefensa || row.fechaDefensa || "");
    row.tribunal = text(nota.tribunal || row.tribunal || "");

    row._bdlNotas = nota;
    row._estadoDefensa = text(nota.estadoDefensaKey || nota.estadoDefensa || "") || notaEstado(row);
    row.estadoDefensa = row._estadoDefensa;
    row.estadoDefensaLabel = estadoLabel(row._estadoDefensa);

    return row;
  }

  function hydrateByDirectCalls(rows, options, repo){
    var map = Object.create(null);

    return Promise.all(rows.map(function(row){
      var periodoId = canonicalPeriodId(row.periodoId || row.periodId || options.periodoId || "");
      var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || "");

      if(!periodoId || !cedula || typeof repo.getByPeriodoCedula !== "function"){
        return Promise.resolve(null);
      }

      return repo.getByPeriodoCedula(periodoId, cedula).then(function(nota){
        map[rowKey(row)] = nota || null;
      }).catch(function(){
        map[rowKey(row)] = null;
      });
    })).then(function(){
      return rows.map(function(row){
        return copyNotaFields(row, map[rowKey(row)] || null);
      });
    });
  }

  function hydrateByPeriodList(rows, options, repo){
    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var needed = Object.create(null);

    rows.forEach(function(row){
      var key = rowKey(row);
      if(key){ needed[key] = true; }
    });

    return repo.list({ periodoId: periodoId }).then(function(notas){
      var map = Object.create(null);

      (Array.isArray(notas) ? notas : []).forEach(function(nota){
        var key = rowKey(nota);
        if(key && (!Object.keys(needed).length || needed[key])){
          map[key] = nota;
        }
      });

      return rows.map(function(row){
        return copyNotaFields(row, map[rowKey(row)] || null);
      });
    }).catch(function(){
      return rows.map(function(row){
        return copyNotaFields(row, null);
      });
    });
  }

  function hydrateWithNotas(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};

    var repo = notasRepo();

    if(!repo || !rows.length){
      return Promise.resolve(rows.map(function(row){
        return copyNotaFields(row, null);
      }));
    }

    var smallLimit = Number(options.directHydrateLimit || 80);

    if(rows.length <= smallLimit && typeof repo.getByPeriodoCedula === "function"){
      return hydrateByDirectCalls(rows, options, repo);
    }

    if(typeof repo.list === "function"){
      return hydrateByPeriodList(rows, options, repo);
    }

    return Promise.resolve(rows.map(function(row){
      return copyNotaFields(row, null);
    }));
  }

  function filterDefensas(rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows : [];

    var estado = text(options.estadoDefensa || options.defensaEstado || options.statusDefensa || "");
    var search = text(options.search || options.busqueda || options.query || "");
    var soloPendientes = options.soloPendientes === true || text(options.soloPendientes).toLowerCase() === "true";
    var aprobados = options.aprobados === true || text(options.aprobados).toLowerCase() === "true";
    var noAprobados = options.noAprobados === true || text(options.noAprobados).toLowerCase() === "true";
    var minFinal = numberOrNull(options.minFinal);
    var maxFinal = numberOrNull(options.maxFinal);

    if(estado){
      rows = rows.filter(function(row){
        return normalizeSearch(row._estadoDefensa || row.estadoDefensa || notaEstado(row)) === normalizeSearch(estado);
      });
    }

    if(soloPendientes){
      rows = rows.filter(function(row){
        var current = text(row._estadoDefensa || row.estadoDefensa || notaEstado(row));
        return current === "SIN_ARTICULO" || current === "PENDIENTE_DEFENSA" || current === "PENDIENTE_FINAL";
      });
    }

    if(aprobados){
      rows = rows.filter(function(row){
        return text(row._estadoDefensa || row.estadoDefensa || notaEstado(row)) === "APROBADO";
      });
    }

    if(noAprobados){
      rows = rows.filter(function(row){
        var current = text(row._estadoDefensa || row.estadoDefensa || notaEstado(row));
        return current === "NO_APROBADO" || current === "ARTICULO_NO_APROBADO";
      });
    }

    if(minFinal != null){
      rows = rows.filter(function(row){
        var n = numberOrNull(row.Notafinal || row.Nfinal || row.notafinal);
        return n != null && n >= minFinal;
      });
    }

    if(maxFinal != null){
      rows = rows.filter(function(row){
        var n = numberOrNull(row.Notafinal || row.Nfinal || row.notafinal);
        return n != null && n <= maxFinal;
      });
    }

    if(search){
      rows = rows.filter(function(row){
        var haystack = [
          row.cedula,
          row.numeroIdentificacion,
          row.Nombres,
          row.nombres,
          row.nombreCompleto,
          row.NombreCarrera,
          row.nombreCarrera,
          row.carrera,
          row.division,
          row.Sede,
          row.sede,
          row._estadoDefensa,
          row.estadoDefensaLabel,
          row.observacionDefensa,
          row.tribunal
        ].join(" ");

        return normalizeSearch(haystack).indexOf(normalizeSearch(search)) >= 0;
      });
    }

    return sortRows(rows, options);
  }

  function sortRows(rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows.slice() : [];

    var key = text(options.sortKey || "nombres");
    var dir = text(options.sortDir || "asc").toLowerCase() === "desc" ? -1 : 1;

    return rows.sort(function(a, b){
      var av = "";
      var bv = "";

      if(key === "estadoDefensa"){
        av = normalizeSearch(a._estadoDefensa || a.estadoDefensa || "");
        bv = normalizeSearch(b._estadoDefensa || b.estadoDefensa || "");
      }else if(key === "notaFinal" || key === "Notafinal"){
        av = numberOrNull(a.Notafinal || a.Nfinal || a.notafinal);
        bv = numberOrNull(b.Notafinal || b.Nfinal || b.notafinal);
        av = av == null ? -999 : av;
        bv = bv == null ? -999 : bv;
      }else if(key === "carrera"){
        av = normalizeSearch(a.NombreCarrera || a.nombreCarrera || a.carrera);
        bv = normalizeSearch(b.NombreCarrera || b.nombreCarrera || b.carrera);
      }else{
        av = normalizeSearch(a[key] || a.nombreCompleto || a.nombres || a.Nombres);
        bv = normalizeSearch(b[key] || b.nombreCompleto || b.nombres || b.Nombres);
      }

      if(av < bv){ return -1 * dir; }
      if(av > bv){ return 1 * dir; }
      return 0;
    });
  }

  function requiresFullHydration(options){
    options = options || {};

    return !!(
      text(options.estadoDefensa || options.defensaEstado || options.statusDefensa || "") ||
      options.soloPendientes === true ||
      text(options.soloPendientes).toLowerCase() === "true" ||
      options.aprobados === true ||
      text(options.aprobados).toLowerCase() === "true" ||
      options.noAprobados === true ||
      text(options.noAprobados).toLowerCase() === "true" ||
      text(options.minFinal || "") ||
      text(options.maxFinal || "")
    );
  }

  function studentOptions(options){
    options = Object.assign({}, options || {});
    delete options.estadoDefensa;
    delete options.defensaEstado;
    delete options.statusDefensa;
    delete options.soloPendientes;
    delete options.aprobados;
    delete options.noAprobados;
    delete options.minFinal;
    delete options.maxFinal;
    return options;
  }

  function getFiltered(options){
    options = options || {};

    var service = estudiantesService();
    if(!service || typeof service.list !== "function"){
      return Promise.resolve([]);
    }

    return service.list(studentOptions(options)).then(function(rows){
      return hydrateWithNotas(rows || [], options);
    }).then(function(rows){
      return filterDefensas(rows, options);
    });
  }

  function getPage(options){
    options = Object.assign({ page: 1, limit: 25 }, options || {});

    var service = estudiantesService();
    if(!service){
      return Promise.resolve({
        rows: [],
        page: Number(options.page || 1),
        limit: Number(options.limit || 25),
        total: 0,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
        source: "defensas-empty"
      });
    }

    if(requiresFullHydration(options) || typeof service.page !== "function"){
      return getFiltered(options).then(function(rows){
        var paged = Services.paginate(rows, options);
        paged.source = "defensas-full-hydrated";
        paged.hydrated = true;
        return paged;
      });
    }

    return service.page(studentOptions(options)).then(function(paged){
      paged = paged || {};
      paged.rows = Array.isArray(paged.rows) ? paged.rows : [];

      return hydrateWithNotas(paged.rows, options).then(function(rows){
        rows = filterDefensas(rows, options);

        paged.rows = rows;
        paged.source = "defensas-page-hydrated";
        paged.hydrated = true;
        paged.totalVisible = rows.length;
        return paged;
      });
    });
  }

  function getStats(options){
    options = options || {};

    return getFiltered(options).then(function(rows){
      var stats = {
        total: rows.length,
        sinArticulo: 0,
        articuloNoAprobado: 0,
        pendienteDefensa: 0,
        pendienteFinal: 0,
        aprobado: 0,
        noAprobado: 0
      };

      rows.forEach(function(row){
        var estado = text(row._estadoDefensa || row.estadoDefensa || notaEstado(row));

        if(estado === "SIN_ARTICULO"){ stats.sinArticulo += 1; }
        else if(estado === "ARTICULO_NO_APROBADO"){ stats.articuloNoAprobado += 1; }
        else if(estado === "PENDIENTE_DEFENSA"){ stats.pendienteDefensa += 1; }
        else if(estado === "PENDIENTE_FINAL"){ stats.pendienteFinal += 1; }
        else if(estado === "APROBADO"){ stats.aprobado += 1; }
        else if(estado === "NO_APROBADO"){ stats.noAprobado += 1; }
      });

      return stats;
    });
  }

  function normalizeNota(row){
    row = Object.assign({}, row || {});

    var periodoId = canonicalPeriodId(row.periodoId || row.periodId || row.periodoCanonicoId || "");
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || "");
    var id = text(row.idEstudiantePeriodo || row.studentId || (periodoId && cedula ? periodoId + "__" + cedula : ""));

    row.idEstudiantePeriodo = id;
    row.studentId = row.studentId || id;
    row.periodoId = periodoId;
    row.cedula = cedula;
    row.notart = numberOrNull(row.notart || row.Notart || row.Nart);
    row.notdef = numberOrNull(row.notdef || row.Notdef || row.Ndef);
    row.notafinal = numberOrNull(row.notafinal || row.Notafinal || row.Nfinal);
    row.estadoDefensaKey = notaEstado(row);
    row.updatedAt = text(row.updatedAt) || new Date().toISOString();

    return row;
  }

  function saveNota(row){
    var repo = notasRepo();

    if(!repo || typeof repo.save !== "function"){
      return Promise.reject(new Error("Repositorio de notas no disponible."));
    }

    row = normalizeNota(row || {});

    if(!row.idEstudiantePeriodo){
      return Promise.reject(new Error("Nota sin idEstudiantePeriodo."));
    }

    return repo.save(row);
  }

  var api = {
    version: VERSION,
    getPage: getPage,
    page: getPage,
    getFiltered: getFiltered,
    list: getFiltered,
    getStats: getStats,
    stats: getStats,
    saveNota: saveNota,
    hydrateWithNotas: hydrateWithNotas,
    filterDefensas: filterDefensas,
    notaEstado: notaEstado,
    estadoLabel: estadoLabel
  };

  Services.register("defensas", api);
  window.BDLServiceDefensas = api;
})(window);
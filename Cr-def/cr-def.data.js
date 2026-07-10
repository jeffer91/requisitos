/* =========================================================
Nombre completo: cr-def.data.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.data.js
Función o funciones:
- Leer datos desde BDLocal BL2.
- Cargar períodos disponibles.
- Construir estudiantes aptos para defensa usando reglas Cr-def.
- Fusionar matrícula, persona, requisitos y notas.
- Calcular firma de BDLocal para detectar cache desactualizada.
Con qué se conecta:
- ../BDLocal/bl2.config.js
- ../BDLocal/bl2.config.v2.js
- ../BDLocal/bl2.db.js
- cr-def.rules.js
- cr-def.cache.js
========================================================= */
(function(window){
  "use strict";

  var rules = window.CR_DEF_RULES || {};
  var config = window.CR_DEF_CONFIG || {};
  var blConfig = window.BL2Config || {};

  function text(value){
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function norm(value){
    return text(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function db(){
    if(window.BL2DB && typeof window.BL2DB.open === "function"){
      return window.BL2DB;
    }
    return null;
  }

  function storeName(key, fallback){
    var stores = (window.BL2Config && window.BL2Config.stores) || {};
    return text(stores[key]) || text(fallback || key);
  }

  function safeGetAll(name){
    var database = db();
    if(!database || !name){ return Promise.resolve([]); }
    return database.getAll(name).catch(function(){ return []; });
  }

  function safeQueryPeriodo(name, periodoId){
    var database = db();
    periodoId = text(periodoId);
    if(!database || !name || !periodoId){ return Promise.resolve([]); }

    if(typeof database.queryByIndex === "function"){
      return database.queryByIndex(name, "periodoId", periodoId).catch(function(){
        return safeGetAll(name).then(function(rows){ return filterByPeriodo(rows, periodoId); });
      });
    }

    return safeGetAll(name).then(function(rows){ return filterByPeriodo(rows, periodoId); });
  }

  function filterByPeriodo(rows, periodoId){
    periodoId = text(periodoId);
    return (Array.isArray(rows) ? rows : []).filter(function(row){
      return samePeriodo(row, periodoId);
    });
  }

  function samePeriodo(row, periodoId){
    if(!row || !periodoId){ return false; }
    var values = [row.periodoId, row.periodId, row.ultimoPeriodoId, row.periodo, row.periodoLabel, row.labelPeriodo];
    return values.some(function(value){ return text(value) === periodoId; });
  }

  function readFirst(row, keys){
    row = row || {};
    keys = Array.isArray(keys) ? keys : [];
    var rawKeys = Object.keys(row);
    var normalized = rawKeys.map(function(key){ return { key:key, norm:norm(key) }; });

    for(var i = 0; i < keys.length; i += 1){
      var wanted = norm(keys[i]);
      var found = normalized.find(function(item){ return item.norm === wanted; });
      if(found && text(row[found.key]) !== ""){ return row[found.key]; }
    }

    for(var j = 0; j < keys.length; j += 1){
      var partial = norm(keys[j]);
      var partialFound = normalized.find(function(item){ return item.norm.indexOf(partial) !== -1; });
      if(partialFound && text(row[partialFound.key]) !== ""){ return row[partialFound.key]; }
    }

    return "";
  }

  function cedulaOf(row){
    var value = readFirst(row, ["cedula", "numeroIdentificacion", "NumeroIdentificacion", "identificacion", "Identificación", "documento"]);
    var utils = window.BL2Config && window.BL2Config.utils;
    if(utils && typeof utils.normalizeCedula === "function"){
      return utils.normalizeCedula(value);
    }
    return text(value).replace(/[^\dA-Za-z]/g, "");
  }

  function periodoIdOf(row){
    return text(readFirst(row, ["periodoId", "periodId", "ultimoPeriodoId", "periodo"]));
  }

  function idEstudiantePeriodoOf(row){
    return text(readFirst(row, ["idEstudiantePeriodo", "id", "matriculaId"]));
  }

  function nombreOf(row, persona){
    return text(readFirst(persona || {}, ["nombreCompleto", "Nombres", "nombres", "Nombre", "nombre", "Estudiante", "estudiante"])) ||
      text(readFirst(row || {}, ["nombreCompleto", "Nombres", "nombres", "Nombre", "nombre", "Estudiante", "estudiante"]));
  }

  function carreraOf(row){
    return text(readFirst(row || {}, ["carrera", "NombreCarrera", "nombreCarrera", "Carrera"]));
  }

  function sedeOf(row){
    var sede = text(readFirst(row || {}, ["Sede", "sede", "Campus", "campus"]));
    if(!sede){ return ""; }
    var n = norm(sede);
    if(n === "matriz"){ return "Matriz"; }
    if(n === "sur"){ return "Sur"; }
    if(n === "virtual" || n === "online"){ return "Virtual"; }
    return sede;
  }

  function updatedAtOf(row){
    return text(readFirst(row || {}, ["updatedAt", "actualizadoEn", "fechaActualizacion", "createdAt"]));
  }

  function makeKey(periodoId, cedula){
    return text(periodoId) + "__" + text(cedula);
  }

  function mapByCedula(rows){
    var map = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var cedula = cedulaOf(row);
      if(cedula && !map[cedula]){ map[cedula] = row; }
    });
    return map;
  }

  function groupByPeriodoCedula(rows){
    var map = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var cedula = cedulaOf(row);
      var periodoId = periodoIdOf(row);
      if(!cedula || !periodoId){ return; }
      var key = makeKey(periodoId, cedula);
      if(!map[key]){ map[key] = []; }
      map[key].push(row);
    });
    return map;
  }

  function putRequirement(record, requisitoRow){
    var label = text(readFirst(requisitoRow, [
      "requisito",
      "nombreRequisito",
      "requisitoNombre",
      "requisitoKey",
      "campo",
      "field"
    ]));
    var estado = text(readFirst(requisitoRow, ["estado", "estadoKey", "valor", "value", "cumple"]));
    if(!label || !estado){ return; }

    record[label] = estado;

    var key = norm(label);
    if(key.indexOf("academ") !== -1){ record["Académico"] = estado; }
    if(key.indexOf("document") !== -1){ record["Documentación"] = estado; }
    if(key.indexOf("financier") !== -1 || key.indexOf("pago") !== -1){ record["Financiero"] = estado; }
    if(key.indexOf("practic") !== -1){ record["Prácticas"] = estado; }
    if(key.indexOf("vincul") !== -1){ record["Vinculación"] = estado; }
    if(key.indexOf("seguimiento") !== -1){ record["Seguimiento graduados"] = estado; }
    if(key.indexOf("ingles") !== -1){ record["Inglés"] = estado; }
    if(key.indexOf("actualizacion") !== -1 && key.indexOf("dato") !== -1){ record["Actualización de datos"] = estado; }
  }

  function noteNumber(row, aliases){
    var value = readFirst(row, aliases);
    if(value === "" || value == null){ return null; }
    if(rules.helpers && typeof rules.helpers.toNumber === "function"){
      return rules.helpers.toNumber(value);
    }
    var parsed = Number(String(value).replace(",", ".").match(/-?\d+(\.\d+)?/) || NaN);
    return isFinite(parsed) ? parsed : null;
  }

  function putNotes(record, noteRows){
    var rows = Array.isArray(noteRows) ? noteRows : [];
    rows.forEach(function(row){
      Object.keys(row || {}).forEach(function(key){
        if(record[key] == null || record[key] === ""){
          record[key] = row[key];
        }
      });

      var articulo = noteNumber(row, [
        "notaArticulo",
        "nota_articulo",
        "nota articulo",
        "nota artículo",
        "articulo",
        "artículo",
        "promedioArticulo",
        "notaFinalArticulo",
        "nota final articulo",
        "nota final artículo"
      ]);

      var defensa = noteNumber(row, [
        "notaDefensa",
        "nota_defensa",
        "nota defensa",
        "defensa",
        "nota de defensa",
        "notaFinalDefensa",
        "nota final defensa",
        "calificacionDefensa",
        "calificación defensa"
      ]);

      if(articulo != null){ record["nota articulo"] = articulo; record.notaArticulo = articulo; }
      if(defensa != null){ record["nota defensa"] = defensa; record.notaDefensa = defensa; }
    });
  }

  function buildFirma(periodoId, tables){
    tables = tables || {};
    var all = [];
    Object.keys(tables).forEach(function(name){
      (Array.isArray(tables[name]) ? tables[name] : []).forEach(function(row){ all.push(row); });
    });

    var maxUpdatedAt = all.reduce(function(max, row){
      var value = updatedAtOf(row);
      return value > max ? value : max;
    }, "");

    var raw = [
      periodoId,
      (tables.matriculas || []).length,
      (tables.estudiantes || []).length,
      (tables.personas || []).length,
      (tables.requisitosV2 || []).length,
      (tables.requisitosLegacy || []).length,
      (tables.notasV2 || []).length,
      (tables.notasLegacy || []).length,
      maxUpdatedAt
    ].join("|");

    var hash = 0;
    for(var i = 0; i < raw.length; i += 1){
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }

    return {
      periodoId: periodoId,
      hash: String(hash) + "::" + raw.length,
      maxUpdatedAt: maxUpdatedAt,
      totalMatriculas: (tables.matriculas || []).length,
      totalEstudiantes: (tables.estudiantes || []).length,
      totalRequisitos: (tables.requisitosV2 || []).length + (tables.requisitosLegacy || []).length,
      totalNotas: (tables.notasV2 || []).length + (tables.notasLegacy || []).length,
      calculatedAt: new Date().toISOString()
    };
  }

  function listarPeriodos(){
    var database = db();
    if(!database){
      return Promise.resolve(basePeriods());
    }

    return database.open().then(function(){
      return safeGetAll(storeName("periodos", "periodos"));
    }).then(function(rows){
      var list = basePeriods().concat((rows || []).map(function(row){
        return {
          id: text(row.id || row.periodoId || row.value || row.label || row.nombre),
          label: text(row.label || row.nombre || row.periodoLabel || row.id || row.periodoId)
        };
      }));

      var seen = Object.create(null);
      return list.filter(function(periodo){
        periodo.id = text(periodo.id);
        periodo.label = text(periodo.label || periodo.id);
        if(!periodo.id || seen[periodo.id]){ return false; }
        seen[periodo.id] = true;
        return true;
      });
    }).catch(function(){
      return basePeriods();
    });
  }

  function basePeriods(){
    var periodos = (window.BL2Config && window.BL2Config.periodosBase) || [];
    return periodos.map(function(periodo){
      return {
        id: text(periodo.id),
        label: text(periodo.label || periodo.nombre || periodo.id)
      };
    }).filter(function(periodo){ return !!periodo.id; });
  }

  function cargarTablasPeriodo(periodoId){
    var database = db();
    if(!database){
      return Promise.reject(new Error("BDLocal no está disponible."));
    }

    return database.open().then(function(){
      return Promise.all([
        safeQueryPeriodo(storeName("matriculasPeriodo", "matriculas_periodo"), periodoId),
        safeQueryPeriodo(storeName("estudiantes", "estudiantes"), periodoId),
        safeGetAll(storeName("personas", "personas")),
        safeQueryPeriodo(storeName("requisitosEstudiante", "requisitos_estudiante"), periodoId),
        safeQueryPeriodo(storeName("requisitos", "requisitos"), periodoId),
        safeQueryPeriodo(storeName("notasTitulacion", "notas_titulacion"), periodoId),
        safeQueryPeriodo(storeName("notas", "notas"), periodoId)
      ]);
    }).then(function(result){
      return {
        matriculas: result[0] || [],
        estudiantes: result[1] || [],
        personas: result[2] || [],
        requisitosV2: result[3] || [],
        requisitosLegacy: result[4] || [],
        notasV2: result[5] || [],
        notasLegacy: result[6] || []
      };
    });
  }

  function cargarAptos(periodoId){
    periodoId = text(periodoId);
    if(!periodoId){
      return Promise.resolve({ rows: [], firma: null, resumen: { aptos:0, bloqueados:0 } });
    }

    return cargarTablasPeriodo(periodoId).then(function(tables){
      var personasByCedula = mapByCedula(tables.personas);
      var requisitosByKey = groupByPeriodoCedula(tables.requisitosV2.concat(tables.requisitosLegacy));
      var notasByKey = groupByPeriodoCedula(tables.notasV2.concat(tables.notasLegacy));
      var baseRows = tables.matriculas.length ? tables.matriculas : tables.estudiantes;
      var rows = [];
      var bloqueados = 0;
      var defensaAprobada = 0;

      baseRows.forEach(function(baseRow){
        var cedula = cedulaOf(baseRow);
        if(!cedula){ return; }
        var key = makeKey(periodoId, cedula);
        var persona = personasByCedula[cedula] || {};
        var record = Object.assign({}, clone(persona), clone(baseRow));

        record.cedula = cedula;
        record.periodoId = periodoId;
        record.nombre = nombreOf(baseRow, persona);
        record.carrera = carreraOf(baseRow);
        record.sede = sedeOf(baseRow);

        (requisitosByKey[key] || []).forEach(function(req){ putRequirement(record, req); });
        putNotes(record, notasByKey[key] || []);

        var evaluacion = rules && typeof rules.evaluarAptitud === "function"
          ? rules.evaluarAptitud(record)
          : { apto:false, estadoClave:"bloqueado", estado:"No apto", alertas:["Reglas Cr-def no disponibles."] };

        if(evaluacion.estadoClave === "defensa-aprobada"){
          defensaAprobada += 1;
          return;
        }

        if(!evaluacion.apto){
          bloqueados += 1;
          return;
        }

        rows.push({
          id: idEstudiantePeriodoOf(baseRow) || key,
          periodoId: periodoId,
          aula: "",
          dia: "",
          hora: "",
          sede: record.sede,
          cedula: cedula,
          nombre: record.nombre,
          carrera: record.carrera,
          notaArticulo: evaluacion.notaArticulo == null ? "" : evaluacion.notaArticulo,
          notaDefensa: evaluacion.notaDefensa,
          tribunal1: "",
          tribunal2: "",
          tribunal3: "",
          estadoClave: evaluacion.estadoClave,
          estado: evaluacion.estado,
          alertas: evaluacion.alertas || [],
          raw: record
        });
      });

      rows.sort(function(a, b){
        return [a.carrera, a.sede, a.nombre].join("|").localeCompare([b.carrera, b.sede, b.nombre].join("|"), "es");
      });

      return {
        rows: rows,
        firma: buildFirma(periodoId, tables),
        resumen: {
          aptos: rows.filter(function(row){ return row.estadoClave === "apto"; }).length,
          supletorios: rows.filter(function(row){ return row.estadoClave === "supletorio"; }).length,
          bloqueados: bloqueados,
          defensaAprobada: defensaAprobada,
          totalBase: baseRows.length
        }
      };
    });
  }

  function calcularFirma(periodoId){
    return cargarTablasPeriodo(periodoId).then(function(tables){
      return buildFirma(periodoId, tables);
    });
  }

  window.CR_DEF_DATA = Object.freeze({
    dbAvailable: function(){ return !!db(); },
    listarPeriodos: listarPeriodos,
    cargarAptos: cargarAptos,
    calcularFirma: calcularFirma,
    helpers: Object.freeze({
      text: text,
      norm: norm,
      cedulaOf: cedulaOf,
      readFirst: readFirst
    })
  });
})(window);

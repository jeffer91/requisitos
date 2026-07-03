/* =========================================================
Nombre completo: bdl.repo.estudiantes.js
Ruta o ubicación: /Requisitos/BDLocal/repositories/bdl.repo.estudiantes.js
Función o funciones:
- Guardar estudiantes en Base Local usando IndexedDB.
- Impedir estudiantes válidos sin período.
- Fusionar duplicados del mismo estudiante dentro del mismo período.
- Actualizar registros existentes conservando datos completos.
- Mantener historial cuando el mismo estudiante pertenece a varios períodos.
- Generar cola de sincronización para Firebase, Supabase y Google Sheets.
- Mantener snapshot legacy para Tabla, Ficha, Stats y pantallas antiguas.
Con qué se conecta:
- bdl.repo.base.js
- bdl.norm.estudiante.js
- bdl.norm.requisito.js
- bdl.norm.nota.js
- bdl.norm.division.js
- bdl.norm.error.js
- bdl.validator.estudiante.js
- bdl.sync.queue.js
- bdl.screen-compat.js
========================================================= */
(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  var E = window.BDLNormEstudiante;
  var R = window.BDLNormRequisito;
  var N = window.BDLNormNota;
  var D = window.BDLNormDivision;
  var X = window.BDLNormError;
  var V = window.BDLValidatorEstudiante || null;

  if(!B || !E || !R || !N || !D || !X){
    throw new Error("BDLRepoEstudiantes requiere normalizadores completos.");
  }

  function txt(value){
    return String(value == null ? "" : value).trim();
  }

  function key(value){
    return txt(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  function now(){
    return B && typeof B.now === "function" ? B.now() : new Date().toISOString();
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }catch(error){}
  }

  function pageOptions(options){
    options = options || {};
    var page = Math.max(1, Number(options.page || 1));
    var limit = options.limit === 0 ? 0 : Math.max(1, Number(options.limit || 100));

    return Object.assign({}, options, {
      page: page,
      limit: limit,
      offset: options.offset == null ? (page - 1) * (limit || 0) : Number(options.offset || 0)
    });
  }

  function searchKey(value){
    return txt(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function byKey(rows, field){
    var map = {};

    B.asArray(rows).forEach(function(row){
      var id = txt(row && row[field]);
      if(id){
        map[id] = row;
      }
    });

    return map;
  }

  function detailOriginal(detail){
    detail = detail || {};
    return Object.assign({}, detail.datosOriginalesFirebase || {}, detail.camposExtra || {}, detail.raw || {}, detail.datosOriginales || {});
  }

  function isUseful(value){
    var v = txt(value);
    if(!v){ return false; }

    var k = key(v);

    return !(
      k === "sin_identificacion" ||
      k === "sin_periodo" ||
      k === "sin_carrera" ||
      k === "sin_division" ||
      k === "estudiante_sin_nombre" ||
      k === "null" ||
      k === "undefined"
    );
  }

  function mergeValue(oldValue, newValue){
    if(isUseful(newValue)){ return newValue; }
    if(isUseful(oldValue)){ return oldValue; }
    return newValue != null ? newValue : oldValue;
  }

  function mergeSmart(oldRow, newRow){
    oldRow = oldRow || {};
    newRow = newRow || {};

    var out = Object.assign({}, oldRow, newRow);

    Object.keys(oldRow).forEach(function(field){
      out[field] = mergeValue(oldRow[field], newRow[field]);
    });

    Object.keys(newRow).forEach(function(field){
      out[field] = mergeValue(oldRow[field], newRow[field]);
    });

    out.createdAt = oldRow.createdAt || newRow.createdAt || now();
    out.updatedAt = now();
    out.syncStatus = "pendiente";

    return out;
  }

  function withAliases(row){
    row = Object.assign({}, row || {});

    row.cedula = row.cedula || row.numeroIdentificacion || "";
    row.Cedula = row.Cedula || row.numeroIdentificacion || "";
    row.Nombres = row.Nombres || row.nombres || "";
    row.NombreCarrera = row.NombreCarrera || row.nombreCarrera || "";
    row.Carrera = row.Carrera || row.nombreCarrera || "";
    row.CodigoCarrera = row.CodigoCarrera || row.codigoCarrera || "";
    row.Sede = row.Sede || row.sede || "";
    row.Periodo = row.Periodo || row.periodoLabel || row.periodoId || "";
    row.periodo = row.periodo || row.periodoLabel || row.periodoId || "";
    row.periodoLabel = row.periodoLabel || row.periodoId || "";
    row.division = row.division || row.divisionPrincipal || "";
    row.Division = row.Division || row.divisionPrincipal || "";
    row.divisiones = Array.isArray(row.divisiones) ? row.divisiones : (row.divisionPrincipal ? [row.divisionPrincipal] : []);

    row.correoPersonal = row.correoPersonal || row.CorreoPersonal || row.correo || row.Correo || row.email || row.Email || "";
    row.CorreoPersonal = row.CorreoPersonal || row.correoPersonal || "";
    row.correoInstitucional = row.correoInstitucional || row.CorreoInstitucional || row.correoInst || row.CorreoInst || "";
    row.CorreoInstitucional = row.CorreoInstitucional || row.correoInstitucional || "";
    row.correo = row.correo || row.correoPersonal || row.correoInstitucional || "";
    row.Correo = row.Correo || row.correo || "";

    row.celular = row.celular || row.Celular || row.telefono || row.Telefono || row["Teléfono"] || row.whatsapp || "";
    row.Celular = row.Celular || row.celular || "";
    row.telefono = row.telefono || row.celular || "";

    row.Academico = row.Academico || row.academico || "";
    row.Financiero = row.Financiero || row.financiero || "";
    row.Documentacion = row.Documentacion || row.documentacion || "";
    row.Titulacion = row.Titulacion || row.titulacion || "";
    row.Ingles = row.Ingles || row.ingles || "";
    row.ActualizacionDatos = row.ActualizacionDatos || row.actualizacionDatos || "";
    row.AprobacionTitulacion = row.AprobacionTitulacion || row.aprobacionTitulacion || "";
    row.AprobacionComplexivoProyecto = row.AprobacionComplexivoProyecto || row.aprobacionComplexivoProyecto || "";

    row.estado = row.estado || row.estadoGeneral || "";
    row.searchKey = searchKey([
      row.searchKey,
      row.numeroIdentificacion,
      row.cedula,
      row.Nombres,
      row.nombres,
      row.nombreCarrera,
      row.NombreCarrera,
      row.sede,
      row.Sede,
      row.division,
      row.Division,
      row.correoPersonal,
      row.correoInstitucional,
      row.correo,
      row.celular
    ].join(" "));

    return row;
  }

  function mergeStudents(resumenRows, personaRows, detalleRows){
    var personas = byKey(personaRows, "numeroIdentificacion");
    var detalles = byKey(detalleRows, "idEstudiantePeriodo");

    return B.asArray(resumenRows).map(function(resumen){
      var persona = personas[txt(resumen && resumen.numeroIdentificacion)] || {};
      var detalle = detalles[txt(resumen && resumen.idEstudiantePeriodo)] || {};

      return withAliases(Object.assign({}, detailOriginal(detalle), persona, resumen, {
        detalleId: detalle.idEstudiantePeriodo || "",
        datosOriginalesFirebase: detalle.datosOriginalesFirebase || {}
      }));
    });
  }

  function mirrorSnapshot(){
    return Promise.all([
      B.list(B.stores.periodos, { limit: 0 }),
      B.list(B.stores.estudiantesResumen, { limit: 0 }),
      B.list(B.stores.estudiantesPersona, { limit: 0 }),
      B.list(B.stores.estudiantesDetalle, { limit: 0 })
    ]).then(function(parts){
      var periods = (parts[0] || []).map(function(p){
        return Object.assign({}, p, {
          id: p.periodoId,
          value: p.periodoId,
          label: p.periodoLabel || p.periodoId
        });
      });

      var students = mergeStudents(parts[1] || [], parts[2] || [], parts[3] || []);

      var snapshot = {
        meta: {
          app: "Requisitos",
          module: "BDLocal",
          source: "BDLRepoEstudiantes",
          updatedAt: now(),
          totalPeriods: periods.length,
          totalStudents: students.length
        },
        periods: periods,
        students: students,
        history: [],
        diagnostics: []
      };

      try{
        window.localStorage.setItem("REQ_BDLOCAL_LEGACY_SNAPSHOT_V1", JSON.stringify(snapshot));
      }catch(error){}

      try{
        window.localStorage.setItem("REQ_EXCEL_LOCAL_V1:snapshot", JSON.stringify(snapshot));
      }catch(error){}

      emit("bdlocal:legacy-snapshot", {
        totalStudents: students.length,
        totalPeriods: periods.length,
        at: now()
      });

      return snapshot;
    });
  }

  function validateBeforeSave(row, periodoInfo){
    if(V && typeof V.validateRow === "function"){
      return V.validateRow(row, periodoInfo, { index:0 });
    }

    var prepared = V && typeof V.injectPeriod === "function" ? V.injectPeriod(row, periodoInfo) : Object.assign({}, row || {});
    var norm = E.normalize(prepared, periodoInfo);
    var valid = !(norm && norm.valid === false);
    var errors = [];

    if(!valid && norm && Array.isArray(norm.errors)){
      errors = norm.errors.map(function(error){
        return {
          tipo: error.tipo || "DATO_INVALIDO",
          mensaje: error.mensaje || "Dato inválido."
        };
      });
    }

    return {
      ok: errors.length === 0,
      preparedRow: prepared,
      errors: errors,
      warnings: []
    };
  }

  function errorRows(row, errors){
    errors = Array.isArray(errors) ? errors : [];

    return errors.map(function(error){
      if(X && typeof X.crear === "function"){
        return X.crear(
          error.tipo || "DATO_INVALIDO",
          error.tablaDestino || "estudiantes",
          row || {},
          error.mensaje || "Dato inválido.",
          error.nivel || "grave"
        );
      }

      return {
        id: "error_" + Date.now() + "_" + Math.random().toString(36).slice(2),
        tipoError: error.tipo || "DATO_INVALIDO",
        tablaDestino: "estudiantes",
        registroOriginal: row || {},
        mensaje: error.mensaje || "Dato inválido.",
        nivel: error.nivel || "grave",
        resuelto: false,
        createdAt: now()
      };
    });
  }

  function enqueueChange(tabla, accion, idRegistro, datos, options){
    options = options || {};

    var change = {
      tabla: tabla,
      accion: accion || "upsert",
      idRegistro: idRegistro,
      datos: datos || {},
      periodoId: datos && datos.periodoId ? datos.periodoId : "",
      estudianteId: datos && datos.numeroIdentificacion ? datos.numeroIdentificacion : "",
      source: options.source || "bdlocal",
      createdAt: now()
    };

    if(options.sync === false){
      return Promise.resolve(change);
    }

    if(window.BDLSyncQueue && typeof window.BDLSyncQueue.agregar === "function"){
      return window.BDLSyncQueue.agregar(tabla, accion || "upsert", idRegistro, datos).then(function(){
        return change;
      }).catch(function(error){
        console.warn("[BDLRepoEstudiantes] No se pudo agregar cambio a cola", error);
        return change;
      });
    }

    return Promise.resolve(change);
  }

  function buildCompletePayload(normalized, requisitos, notas, divisiones){
    return {
      idEstudiantePeriodo: normalized.resumen.idEstudiantePeriodo,
      periodo: normalized.periodo,
      persona: normalized.persona,
      resumen: normalized.resumen,
      detalle: normalized.detalle,
      requisitos: requisitos || [],
      notas: notas || [],
      divisiones: divisiones || [],
      updatedAt: now(),
      syncStatus: "pendiente"
    };
  }

  function guardarRegistro(row, periodoInfo, options){
    options = options || {};
    var validation = validateBeforeSave(row, periodoInfo);

    if(!validation.ok){
      var errorsToSave = errorRows(row, validation.errors || []);

      return B.putAll(B.stores.erroresDatos, errorsToSave).then(function(){
        return {
          ok: false,
          saved: 0,
          updated: 0,
          merged: 0,
          errors: errorsToSave.length,
          warnings: validation.warnings || [],
          changes: [],
          message: "Registro bloqueado por validación."
        };
      });
    }

    var preparedRow = validation.preparedRow || row || {};
    var normalized = E.normalize(preparedRow, periodoInfo);
    var id = normalized.resumen.idEstudiantePeriodo;
    var numero = normalized.resumen.numeroIdentificacion;
    var periodoId = normalized.resumen.periodoId;

    if(!periodoId || periodoId === "SIN_PERIODO"){
      var periodErrors = errorRows(preparedRow, [{
        tipo: "PERIODO_OBLIGATORIO",
        mensaje: "La Base Local bloqueó un estudiante sin período.",
        nivel: "grave"
      }]);

      return B.putAll(B.stores.erroresDatos, periodErrors).then(function(){
        return {
          ok: false,
          saved: 0,
          updated: 0,
          merged: 0,
          errors: periodErrors.length,
          warnings: [],
          changes: [],
          message: "Registro bloqueado: sin período."
        };
      });
    }

    var requisitos = R.registros(preparedRow, id, periodoId, numero);
    var notas = N.registros(preparedRow, id, periodoId, numero);
    var divisiones = D.registros(preparedRow, id, periodoId, numero);
    var errores = X.revisarBasicos(preparedRow, normalized.periodo, numero);

    return Promise.all([
      B.get(B.stores.estudiantesPersona, numero).catch(function(){ return null; }),
      B.get(B.stores.estudiantesResumen, id).catch(function(){ return null; }),
      B.get(B.stores.estudiantesDetalle, id).catch(function(){ return null; })
    ]).then(function(existing){
      var oldPersona = existing[0] || null;
      var oldResumen = existing[1] || null;
      var oldDetalle = existing[2] || null;

      var persona = mergeSmart(oldPersona, normalized.persona);
      var resumen = mergeSmart(oldResumen, normalized.resumen);
      var detalle = mergeSmart(oldDetalle, normalized.detalle);

      persona.searchKey = searchKey([
        persona.numeroIdentificacion,
        persona.cedula,
        persona.nombres,
        persona.nombreCompleto,
        persona.correoPersonal,
        persona.correoInstitucional,
        persona.celular
      ].join(" "));

      resumen.searchKey = searchKey([
        resumen.numeroIdentificacion,
        resumen.cedula,
        resumen.nombres,
        resumen.nombreCompleto,
        resumen.nombreCarrera,
        resumen.carrera,
        resumen.sede,
        resumen.divisionPrincipal,
        resumen.correoPersonal,
        resumen.correoInstitucional,
        resumen.celular
      ].join(" "));

      normalized.persona = persona;
      normalized.resumen = resumen;
      normalized.detalle = detalle;

      var completePayload = buildCompletePayload(normalized, requisitos, notas, divisiones);
      var action = oldResumen ? "update" : "insert";

      return Promise.all([
        B.put(B.stores.periodos, normalized.periodo),
        B.put(B.stores.estudiantesPersona, persona),
        B.put(B.stores.estudiantesResumen, resumen),
        B.put(B.stores.estudiantesDetalle, detalle),
        B.putAll(B.stores.estudianteRequisitos, requisitos),
        B.putAll(B.stores.estudianteNotas, notas),
        B.putAll(B.stores.estudianteDivisiones, divisiones),
        B.putAll(B.stores.erroresDatos, errores)
      ]).then(function(){
        return enqueueChange("estudiantes", "upsert", id, completePayload, options);
      }).then(function(change){
        B.cacheClear();

        return {
          ok: true,
          idEstudiantePeriodo: id,
          numeroIdentificacion: numero,
          periodoId: periodoId,
          saved: oldResumen ? 0 : 1,
          updated: oldResumen ? 1 : 0,
          merged: oldResumen ? 1 : 0,
          errors: errores.length,
          warnings: validation.warnings || [],
          changes: [change],
          action: action
        };
      });
    });
  }

  function mergeInputRows(rows, periodoInfo){
    var map = {};
    var order = [];

    rows = B.asArray(rows);

    rows.forEach(function(row){
      var validation = validateBeforeSave(row, periodoInfo);
      var preparedRow = validation.preparedRow || row || {};

      if(!validation.ok){
        var keyInvalid = "INVALIDO__" + order.length;
        map[keyInvalid] = {
          row: preparedRow,
          invalid: true,
          validation: validation
        };
        order.push(keyInvalid);
        return;
      }

      var normalized = E.normalize(preparedRow, periodoInfo);
      var id = normalized && normalized.resumen ? normalized.resumen.idEstudiantePeriodo : ("INVALIDO__" + order.length);

      if(!map[id]){
        map[id] = {
          row: preparedRow,
          invalid: false,
          validation: validation,
          duplicates: 0
        };
        order.push(id);
      }else{
        map[id].row = mergeSmart(map[id].row, preparedRow);
        map[id].duplicates += 1;
      }
    });

    return {
      rows: order.map(function(id){ return map[id].row; }),
      duplicatedInsideLoad: order.reduce(function(total, id){
        return total + Number(map[id].duplicates || 0);
      }, 0)
    };
  }

  function guardarMuchos(rows, periodoInfo, options){
    options = options || {};
    rows = B.asArray(rows);

    var mergedInput = mergeInputRows(rows, periodoInfo);
    var preparedRows = mergedInput.rows;

    var result = {
      ok: true,
      saved: 0,
      updated: 0,
      merged: mergedInput.duplicatedInsideLoad || 0,
      errors: 0,
      warnings: 0,
      total: rows.length,
      processed: 0,
      unique: preparedRows.length,
      changes: []
    };

    emit("bdlocal:students-save-start", {
      total: rows.length,
      unique: preparedRows.length,
      merged: result.merged,
      at: now()
    });

    var chain = Promise.resolve(result);

    preparedRows.forEach(function(row){
      chain = chain.then(function(){
        return guardarRegistro(row, periodoInfo, options).then(function(saved){
          result.processed += 1;
          result.saved += Number(saved.saved || 0);
          result.updated += Number(saved.updated || 0);
          result.errors += Number(saved.errors || 0);
          result.warnings += Number((saved.warnings || []).length || 0);

          if(saved.ok === false){
            result.ok = false;
          }

          if(Array.isArray(saved.changes)){
            result.changes = result.changes.concat(saved.changes);
          }

          emit("bdlocal:students-save-progress", {
            current: result.processed,
            total: preparedRows.length,
            percent: preparedRows.length ? Math.round((result.processed / preparedRows.length) * 100) : 100,
            at: now()
          });

          return result;
        });
      });
    });

    return chain.then(function(finalResult){
      return mirrorSnapshot().catch(function(error){
        console.warn("[BDLRepoEstudiantes] No se pudo crear snapshot legacy", error);
        return null;
      }).then(function(){
        emit("bdlocal:students-save-finish", {
          ok: finalResult.ok,
          total: finalResult.total,
          unique: finalResult.unique,
          saved: finalResult.saved,
          updated: finalResult.updated,
          merged: finalResult.merged,
          errors: finalResult.errors,
          changes: finalResult.changes.length,
          at: now()
        });

        return finalResult;
      });
    });
  }

  function listarResumen(periodoId, options){
    options = pageOptions(options || {});

    if(periodoId){
      return B.byIndex(B.stores.estudiantesResumen, "by_periodoId", periodoId, options);
    }

    return B.list(B.stores.estudiantesResumen, options);
  }

  function contarPorPeriodo(periodoId){
    if(!periodoId){
      return Promise.resolve(0);
    }

    return B.byIndex(B.stores.estudiantesResumen, "by_periodoId", periodoId, { limit: 0 }).then(function(rows){
      return rows.length;
    });
  }

  function obtenerResumen(idEstudiantePeriodo){
    return B.get(B.stores.estudiantesResumen, idEstudiantePeriodo);
  }

  function obtenerDetalle(idEstudiantePeriodo){
    return Promise.all([
      B.get(B.stores.estudiantesResumen, idEstudiantePeriodo),
      B.get(B.stores.estudiantesDetalle, idEstudiantePeriodo),
      B.byIndex(B.stores.estudianteRequisitos, "by_idEstudiantePeriodo", idEstudiantePeriodo, { limit: 0 }),
      B.byIndex(B.stores.estudianteNotas, "by_idEstudiantePeriodo", idEstudiantePeriodo, { limit: 0 }),
      B.byIndex(B.stores.estudianteDivisiones, "by_idEstudiantePeriodo", idEstudiantePeriodo, { limit: 0 })
    ]).then(function(parts){
      var resumen = parts[0] || null;
      var detalle = parts[1] || null;
      var numero = resumen && resumen.numeroIdentificacion;
      var personaPromise = numero ? B.get(B.stores.estudiantesPersona, numero).catch(function(){ return null; }) : Promise.resolve(null);

      return personaPromise.then(function(persona){
        return {
          resumen: resumen,
          persona: persona || null,
          detalle: detalle,
          estudiante: withAliases(Object.assign({}, detailOriginal(detalle), persona || {}, resumen || {})),
          requisitos: parts[2] || [],
          notas: parts[3] || [],
          divisiones: parts[4] || []
        };
      });
    });
  }

  window.BDLRepoEstudiantes = {
    guardarRegistro: guardarRegistro,
    guardarMuchos: guardarMuchos,
    listarResumen: listarResumen,
    contarPorPeriodo: contarPorPeriodo,
    obtenerResumen: obtenerResumen,
    obtenerDetalle: obtenerDetalle,
    mirrorSnapshot: mirrorSnapshot
  };
})(window);
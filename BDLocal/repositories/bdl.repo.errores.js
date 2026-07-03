/* =========================================================
Nombre completo: bdl.repo.errores.js
Ruta o ubicación: /Requisitos/BDLocal/repositories/bdl.repo.errores.js
Función o funciones:
- Guardar errores de datos detectados por Base Local.
- Registrar estudiantes bloqueados por falta de período, cédula o datos críticos.
- Listar errores pendientes, por nivel, por tipo y por tabla.
- Marcar errores como resueltos sin borrarlos.
- Dar resumen para diagnóstico y pantalla BL.
Con qué se conecta:
- bdl.repo.base.js
- bdl.norm.error.js
- bdl.validator.estudiante.js
- carga.validator.js
- bdl.repo.estudiantes.js
- bdl.diagnostics.js
========================================================= */
(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  var X = window.BDLNormError;

  if(!B || !X){
    throw new Error("BDLRepoErrores requiere BDLRepoBase y BDLNormError.");
  }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function now(){
    return B && typeof B.now === "function" ? B.now() : new Date().toISOString();
  }

  function clone(value){
    try{
      return JSON.parse(JSON.stringify(value == null ? null : value));
    }catch(error){
      return value;
    }
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail:detail || {} }));
    }catch(error){}
  }

  function makeId(prefix){
    prefix = text(prefix) || "error";
    return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  }

  function normalize(error){
    error = error && typeof error === "object" ? clone(error) : {};

    if(!error.id){
      error.id = makeId("bdl_error");
    }

    error.tipoError = text(error.tipoError || error.tipo || error.error || "DATO_INVALIDO");
    error.tablaDestino = text(error.tablaDestino || error.tabla || error.store || "general");
    error.mensaje = text(error.mensaje || error.message || "Error de datos.");
    error.nivel = text(error.nivel || error.severidad || "media");
    error.resuelto = error.resuelto === true;
    error.registroOriginal = error.registroOriginal || error.row || error.data || {};
    error.detalle = error.detalle || {};
    error.createdAt = text(error.createdAt) || now();
    error.updatedAt = now();

    return error;
  }

  function guardar(error){
    var row = normalize(error);

    return B.put(B.stores.erroresDatos, row).then(function(){
      emit("bdlocal:error-guardado", {
        id: row.id,
        tipoError: row.tipoError,
        tablaDestino: row.tablaDestino,
        nivel: row.nivel,
        at: now()
      });

      return row;
    });
  }

  function guardarMuchos(errors){
    errors = Array.isArray(errors) ? errors : [];
    var rows = errors.map(normalize);

    if(!rows.length){
      return Promise.resolve({
        ok: true,
        saved: 0,
        total: 0,
        rows: []
      });
    }

    return B.putAll(B.stores.erroresDatos, rows).then(function(result){
      emit("bdlocal:errores-guardados", {
        total: rows.length,
        saved: result && result.saved != null ? result.saved : rows.length,
        at: now()
      });

      return {
        ok: true,
        saved: result && result.saved != null ? result.saved : rows.length,
        total: rows.length,
        rows: rows
      };
    });
  }

  function crear(tipoError, tablaDestino, registroOriginal, mensaje, nivel, detalle){
    var error;

    if(X && typeof X.crear === "function"){
      error = X.crear(
        tipoError || "DATO_INVALIDO",
        tablaDestino || "general",
        registroOriginal || {},
        mensaje || "Error de datos.",
        nivel || "media"
      );
    }else{
      error = {
        tipoError: tipoError || "DATO_INVALIDO",
        tablaDestino: tablaDestino || "general",
        registroOriginal: registroOriginal || {},
        mensaje: mensaje || "Error de datos.",
        nivel: nivel || "media"
      };
    }

    error.detalle = Object.assign({}, error.detalle || {}, detalle || {});

    return guardar(error);
  }

  function desdeValidacion(validation, row, tablaDestino){
    validation = validation || {};
    var errors = Array.isArray(validation.errors) ? validation.errors : [];
    var warnings = Array.isArray(validation.warnings) ? validation.warnings : [];
    var rows = [];

    errors.forEach(function(item){
      rows.push({
        tipoError: item.tipo || item.tipoError || "VALIDACION_ERROR",
        tablaDestino: tablaDestino || item.tablaDestino || "estudiantes",
        registroOriginal: row || validation.preparedRow || {},
        mensaje: item.mensaje || item.message || "Error de validación.",
        nivel: item.nivel || "grave",
        detalle: item
      });
    });

    warnings.forEach(function(item){
      rows.push({
        tipoError: item.tipo || item.tipoError || "VALIDACION_ADVERTENCIA",
        tablaDestino: tablaDestino || item.tablaDestino || "estudiantes",
        registroOriginal: row || validation.preparedRow || {},
        mensaje: item.mensaje || item.message || "Advertencia de validación.",
        nivel: item.nivel || "baja",
        detalle: item
      });
    });

    return guardarMuchos(rows);
  }

  function bloquearRegistro(tipoError, tablaDestino, registroOriginal, mensaje, detalle){
    return crear(
      tipoError || "REGISTRO_BLOQUEADO",
      tablaDestino || "estudiantes",
      registroOriginal || {},
      mensaje || "Registro bloqueado por Base Local.",
      "grave",
      Object.assign({ bloqueado:true }, detalle || {})
    );
  }

  function pendientes(){
    return B.byIndex(B.stores.erroresDatos, "by_resuelto", false, { limit:0 });
  }

  function porNivel(nivel){
    return B.byIndex(B.stores.erroresDatos, "by_nivel", nivel, { limit:0 });
  }

  function porTipo(tipoError){
    return B.byIndex(B.stores.erroresDatos, "by_tipoError", tipoError, { limit:0 });
  }

  function listar(options){
    return B.list(B.stores.erroresDatos, options || { limit:0 });
  }

  function porTabla(tablaDestino){
    tablaDestino = text(tablaDestino);
    return listar({ limit:0 }).then(function(rows){
      return rows.filter(function(row){
        return text(row.tablaDestino) === tablaDestino;
      });
    });
  }

  function resolver(id, nota){
    return B.get(B.stores.erroresDatos, id).then(function(row){
      if(!row){
        return {
          ok: false,
          message: "No se encontró el error.",
          id: id
        };
      }

      row.resuelto = true;
      row.resueltoEn = now();
      row.notaResolucion = text(nota);
      row.updatedAt = now();

      return B.put(B.stores.erroresDatos, row).then(function(){
        emit("bdlocal:error-resuelto", {
          id: id,
          at: now()
        });

        return {
          ok: true,
          id: id,
          row: row
        };
      });
    });
  }

  function reabrir(id, nota){
    return B.get(B.stores.erroresDatos, id).then(function(row){
      if(!row){
        return {
          ok: false,
          message: "No se encontró el error.",
          id: id
        };
      }

      row.resuelto = false;
      row.reabiertoEn = now();
      row.notaReapertura = text(nota);
      row.updatedAt = now();

      return B.put(B.stores.erroresDatos, row).then(function(){
        emit("bdlocal:error-reabierto", {
          id: id,
          at: now()
        });

        return {
          ok: true,
          id: id,
          row: row
        };
      });
    });
  }

  function estadisticas(){
    return listar({ limit:0 }).then(function(rows){
      var resumen = {
        total: rows.length,
        pendientes: 0,
        resueltos: 0,
        graves: 0,
        medias: 0,
        bajas: 0,
        porTipo: {},
        porTabla: {},
        actualizadoEn: now()
      };

      rows.forEach(function(row){
        if(row.resuelto){
          resumen.resueltos += 1;
        }else{
          resumen.pendientes += 1;
        }

        if(row.nivel === "grave" || row.nivel === "alta"){
          resumen.graves += 1;
        }else if(row.nivel === "baja"){
          resumen.bajas += 1;
        }else{
          resumen.medias += 1;
        }

        resumen.porTipo[row.tipoError || "SIN_TIPO"] = (resumen.porTipo[row.tipoError || "SIN_TIPO"] || 0) + 1;
        resumen.porTabla[row.tablaDestino || "general"] = (resumen.porTabla[row.tablaDestino || "general"] || 0) + 1;
      });

      return resumen;
    });
  }

  window.BDLRepoErrores = {
    guardar: guardar,
    guardarMuchos: guardarMuchos,
    crear: crear,
    desdeValidacion: desdeValidacion,
    bloquearRegistro: bloquearRegistro,
    pendientes: pendientes,
    porNivel: porNivel,
    porTipo: porTipo,
    porTabla: porTabla,
    listar: listar,
    resolver: resolver,
    reabrir: reabrir,
    estadisticas: estadisticas
  };
})(window);
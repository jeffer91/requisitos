/* =========================================================
Nombre completo: sn-state.service.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-state.service.js
Modulo: Sacar N
Funcion o funciones:
- Mantener el estado general del modulo Sacar N.
- Guardar estudiantes, resultados, novedades y avance.
- Preparar pausa, continuacion, recuperacion y resumen final.
Con que se conecta:
- sn-config.js
- sn-models.js
- sn-sacar-n.js
========================================================= */
(function(window){
  "use strict";

  var cfg = window.SNConfig || {};
  var models = window.SNModels || {};
  var listeners = [];

  function estadoInicial(){
    return {
      modulo: cfg.estadosModulo ? cfg.estadosModulo.sinIniciar : "sin_iniciar",
      periodoSeleccionado: "",
      carreraSeleccionada: "",
      modalidadSeleccionada: "",
      busqueda: "",
      catalogos: {
        periodos: [],
        carreras: [],
        modalidades: []
      },
      estudiantesBase: [],
      estudiantes: [],
      resultados: [],
      novedades: [],
      resumen: {
        total: 0,
        pendientes: 0,
        procesados: 0,
        sinNotas: 0,
        noEncontrados: 0,
        errores: 0,
        revisar: 0
      },
      avance: {
        indiceActual: 0,
        procesados: 0,
        total: 0,
        porcentaje: 0
      },
      mensaje: "Modulo Sacar N listo para cargar datos desde BDLocal.",
      actualizadoEn: models.ahora ? models.ahora() : new Date().toISOString()
    };
  }

  var state = leer() || estadoInicial();

  function clonar(valor){
    return JSON.parse(JSON.stringify(valor));
  }

  function guardar(){
    state.actualizadoEn = models.ahora ? models.ahora() : new Date().toISOString();
    try{
      if(cfg.storageKeys && cfg.storageKeys.estado){
        window.localStorage.setItem(cfg.storageKeys.estado, JSON.stringify(state));
      }
    }catch(error){
      console.warn("[SN_STATE] No se pudo guardar estado local", error);
    }
    notificar();
    return get();
  }

  function leer(){
    try{
      if(!cfg.storageKeys || !cfg.storageKeys.estado){ return null; }
      var raw = window.localStorage.getItem(cfg.storageKeys.estado);
      return raw ? JSON.parse(raw) : null;
    }catch(error){
      return null;
    }
  }

  function notificar(){
    var snapshot = get();
    listeners.forEach(function(fn){
      try{ fn(snapshot); }catch(error){ console.error("[SN_STATE] Error en listener", error); }
    });
  }

  function asegurarEstructura(){
    state.catalogos = state.catalogos || { periodos: [], carreras: [], modalidades: [] };
    state.estudiantesBase = Array.isArray(state.estudiantesBase) ? state.estudiantesBase : [];
    state.estudiantes = Array.isArray(state.estudiantes) ? state.estudiantes : [];
    state.resultados = Array.isArray(state.resultados) ? state.resultados : [];
    state.novedades = Array.isArray(state.novedades) ? state.novedades : [];
    state.resumen = state.resumen || {};
    state.avance = state.avance || { indiceActual: 0, procesados: 0, total: 0, porcentaje: 0 };
  }

  function recalcularResumen(){
    asegurarEstructura();
    var estados = cfg.estadosEstudiante || {};
    var estudiantes = Array.isArray(state.estudiantes) ? state.estudiantes : [];
    var resumen = {
      total: estudiantes.length,
      pendientes: 0,
      procesados: 0,
      sinNotas: 0,
      noEncontrados: 0,
      errores: 0,
      revisar: 0
    };

    estudiantes.forEach(function(item){
      var estado = String(item.estado || "");
      if(estado === (estados.procesado || "Procesado")){ resumen.procesados += 1; return; }
      if(estado === (estados.sinNotas || "Sin notas")){ resumen.sinNotas += 1; return; }
      if(estado === (estados.noEncontrado || "No encontrado")){ resumen.noEncontrados += 1; return; }
      if(estado === (estados.errorCarga || "Error de carga")){ resumen.errores += 1; return; }
      if(estado === (estados.sesionExpirada || "Sesion expirada")){ resumen.errores += 1; return; }
      if(estado === (estados.revisarManualmente || "Revisar manualmente")){ resumen.revisar += 1; return; }
      resumen.pendientes += 1;
    });

    state.resumen = resumen;
    state.avance.total = resumen.total;
    state.avance.procesados = resumen.procesados + resumen.sinNotas + resumen.noEncontrados + resumen.errores + resumen.revisar;
    state.avance.porcentaje = resumen.total ? Math.round((state.avance.procesados / resumen.total) * 100) : 0;
  }

  function get(){
    asegurarEstructura();
    return clonar(state);
  }

  function patch(data){
    state = Object.assign({}, state, data || {});
    recalcularResumen();
    return guardar();
  }

  function setModulo(estado, mensaje){
    state.modulo = estado || state.modulo;
    if(mensaje != null){ state.mensaje = String(mensaje); }
    return guardar();
  }

  function setEstudiantes(lista){
    state.estudiantes = Array.isArray(lista) ? lista : [];
    state.avance.indiceActual = 0;
    recalcularResumen();
    return guardar();
  }

  function actualizarEstudiante(id, cambios){
    var target = String(id || "");
    state.estudiantes = (state.estudiantes || []).map(function(item){
      if(String(item.id) === target || String(item.cedula) === target){
        return Object.assign({}, item, cambios || {});
      }
      return item;
    });
    recalcularResumen();
    return guardar();
  }

  function agregarResultado(resultado){
    state.resultados = state.resultados || [];
    state.resultados.push(resultado);
    return guardar();
  }

  function agregarNovedad(novedad){
    state.novedades = state.novedades || [];
    state.novedades.push(novedad);
    return guardar();
  }

  function reset(){
    state = estadoInicial();
    return guardar();
  }

  function subscribe(fn){
    if(typeof fn === "function"){
      listeners.push(fn);
      fn(get());
    }
    return function(){
      listeners = listeners.filter(function(item){ return item !== fn; });
    };
  }

  recalcularResumen();

  window.SNState = {
    get: get,
    patch: patch,
    setModulo: setModulo,
    setEstudiantes: setEstudiantes,
    actualizarEstudiante: actualizarEstudiante,
    agregarResultado: agregarResultado,
    agregarNovedad: agregarNovedad,
    recalcularResumen: recalcularResumen,
    reset: reset,
    subscribe: subscribe
  };
})(window);

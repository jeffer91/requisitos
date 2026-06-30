/* =========================================================
Nombre completo: sn-sisacad-extractor.service.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-sisacad-extractor.service.js
Modulo: Sacar N
Funcion o funciones:
- Ejecutar la prueba visible con maximo tres estudiantes pendientes.
- Ejecutar extraccion automatica por estudiante, con pausa y continuacion.
- Enviar los estudiantes a Electron para busqueda y lectura en SISACAD.
- Guardar notas, estados y novedades en la pantalla Sacar N.
- Recuperar avance desde el estado local al reabrir el modulo.
Con que se conecta:
- electron/main.js
- electron/preload.js
- sn-config.js
- sn-state.service.js
- sn-queue.service.js
- sn-errors.service.js
- sn-sisacad-parser.service.js
========================================================= */
(function(window){
  "use strict";

  var cfg = window.SNConfig || {};
  var state = window.SNState || {};
  var queue = window.SNQueue || {};
  var errors = window.SNErrors || {};
  var parser = window.SNSisacadParser || {};
  var pausaSolicitada = false;
  var extraccionActiva = false;

  function api(){ return window.electronAPI && window.electronAPI.sacarN ? window.electronAPI.sacarN : null; }

  function setMensaje(mensaje, estado){
    if(state.setModulo && cfg.estadosModulo){
      state.setModulo(estado || (state.get ? state.get().modulo : cfg.estadosModulo.listo), mensaje);
    }
  }

  function seleccionarPrueba(){
    if(queue.primerosPendientes){ return queue.primerosPendientes(cfg.pruebaVisibleCantidad || 3); }
    var snapshot = state.get ? state.get() : {};
    return (snapshot.estudiantes || []).slice(0, cfg.pruebaVisibleCantidad || 3);
  }

  function seleccionarPendientes(){
    if(queue.pendientes){ return queue.pendientes(); }
    var snapshot = state.get ? state.get() : {};
    var pendiente = (cfg.estadosEstudiante && cfg.estadosEstudiante.pendiente) || "Pendiente";
    return (snapshot.estudiantes || []).filter(function(item){ return !item.estado || item.estado === pendiente; });
  }

  function marcarProcesando(estudiante, observacion){
    var estadoProcesando = (cfg.estadosEstudiante && cfg.estadosEstudiante.procesando) || "Procesando";
    if(estudiante && state.actualizarEstudiante){
      state.actualizarEstudiante(estudiante.id || estudiante.cedula, {
        estado: estadoProcesando,
        observacion: observacion || "Procesando en SISACAD."
      });
    }
  }

  function aplicarResultado(resultado){
    var normalizado = parser.normalizarResultado ? parser.normalizarResultado(resultado) : resultado;
    var cambios = parser.cambiosParaEstudiante ? parser.cambiosParaEstudiante(normalizado) : normalizado;
    var id = normalizado.id || normalizado.cedula;
    if(state.actualizarEstudiante){ state.actualizarEstudiante(id, cambios); }
    if(state.agregarResultado && normalizado.estado === "Procesado"){ state.agregarResultado(normalizado); }
    if(errors.desdeResultado){ errors.desdeResultado(normalizado); }
    return normalizado;
  }

  function aplicarResultados(respuesta){
    var resultados = (respuesta && respuesta.resultados) || [];
    resultados.forEach(aplicarResultado);
    return resultados;
  }

  function pruebaVisible(){
    var a = api();
    if(!a || typeof a.runPruebaVisible !== "function"){
      setMensaje("La prueba visible solo esta disponible en Electron. Abra Requisitos con npm start.", cfg.estadosModulo ? cfg.estadosModulo.errorCritico : "error_critico");
      return Promise.resolve({ ok:false, error:"Electron no disponible" });
    }
    var estudiantes = seleccionarPrueba();
    if(!estudiantes.length){
      setMensaje("No hay estudiantes pendientes para ejecutar la prueba visible.", cfg.estadosModulo ? cfg.estadosModulo.listo : "listo");
      return Promise.resolve({ ok:false, error:"Sin estudiantes" });
    }
    estudiantes.forEach(function(estudiante){ marcarProcesando(estudiante, "Incluido en prueba visible."); });
    setMensaje("Ejecutando prueba visible con " + estudiantes.length + " estudiantes. Observe la ventana de SISACAD.", cfg.estadosModulo ? cfg.estadosModulo.pruebaVisible : "prueba_visible");
    return a.runPruebaVisible(estudiantes).then(function(respuesta){
      aplicarResultados(respuesta);
      if(state.setModulo && cfg.estadosModulo){ state.setModulo(cfg.estadosModulo.listo, (respuesta && respuesta.mensaje) || "Prueba visible finalizada."); }
      return respuesta;
    }).catch(function(error){
      setMensaje("Error en prueba visible: " + error.message, cfg.estadosModulo ? cfg.estadosModulo.errorCritico : "error_critico");
      return { ok:false, error:error.message };
    });
  }

  async function extraccionAutomatica(){
    var a = api();
    if(!a || typeof a.runExtraccionAutomatica !== "function"){
      setMensaje("La extraccion automatica solo esta disponible en Electron. Abra Requisitos con npm start.", cfg.estadosModulo ? cfg.estadosModulo.errorCritico : "error_critico");
      return { ok:false, error:"Electron no disponible" };
    }
    if(extraccionActiva){
      setMensaje("Ya hay una extraccion en curso.", cfg.estadosModulo ? cfg.estadosModulo.extrayendo : "extrayendo");
      return { ok:false, error:"Extraccion en curso" };
    }

    pausaSolicitada = false;
    extraccionActiva = true;
    var procesadosEnEstaVuelta = 0;

    try{
      while(true){
        if(pausaSolicitada){
          setMensaje("Extraccion pausada. Puede continuar desde el ultimo estudiante pendiente.", cfg.estadosModulo ? cfg.estadosModulo.pausado : "pausado");
          return { ok:false, pausado:true, procesadosEnEstaVuelta:procesadosEnEstaVuelta };
        }

        var pendientes = seleccionarPendientes();
        if(!pendientes.length){
          if(state.setModulo && cfg.estadosModulo){
            state.setModulo(cfg.estadosModulo.finalizado, "Extraccion automatica finalizada. No quedan estudiantes pendientes.");
          }
          return { ok:true, finalizado:true, procesadosEnEstaVuelta:procesadosEnEstaVuelta };
        }

        var estudiante = pendientes[0];
        marcarProcesando(estudiante, "Procesando en extraccion automatica.");
        setMensaje("Procesando " + (procesadosEnEstaVuelta + 1) + " de " + (procesadosEnEstaVuelta + pendientes.length) + ": " + (estudiante.cedula || estudiante.nombres || "estudiante"), cfg.estadosModulo ? cfg.estadosModulo.extrayendo : "extrayendo");

        var respuesta = await a.runExtraccionAutomatica([estudiante]);
        aplicarResultados(respuesta);
        procesadosEnEstaVuelta += 1;

        if(respuesta && respuesta.pausado){
          setMensaje(respuesta.mensaje || "Extraccion pausada. Revise SISACAD y continue despues.", cfg.estadosModulo ? cfg.estadosModulo.pausado : "pausado");
          return respuesta;
        }
      }
    }catch(error){
      setMensaje("Error en extraccion automatica: " + error.message, cfg.estadosModulo ? cfg.estadosModulo.errorCritico : "error_critico");
      return { ok:false, error:error.message };
    }finally{
      extraccionActiva = false;
    }
  }

  function pausarExtraccion(){
    pausaSolicitada = true;
    if(extraccionActiva){
      setMensaje("Pausa solicitada. Se detendra al terminar el estudiante actual.", cfg.estadosModulo ? cfg.estadosModulo.extrayendo : "extrayendo");
    }else{
      setMensaje("Extraccion pausada. Puede continuar desde los estudiantes pendientes.", cfg.estadosModulo ? cfg.estadosModulo.pausado : "pausado");
    }
    return Promise.resolve({ ok:true, pausado:true });
  }

  function continuarExtraccion(){
    pausaSolicitada = false;
    return extraccionAutomatica();
  }

  function recuperarAvance(){
    var snapshot = state.get ? state.get() : {};
    var total = (snapshot.estudiantes || []).length;
    var pendientes = seleccionarPendientes().length;
    if(total && pendientes){
      setMensaje("Avance recuperado: " + (total - pendientes) + " procesados y " + pendientes + " pendientes.", cfg.estadosModulo ? cfg.estadosModulo.listo : "listo");
    }
    return { ok:true, total:total, pendientes:pendientes };
  }

  window.SNSisacadExtractor = {
    pruebaVisible: pruebaVisible,
    extraccionAutomatica: extraccionAutomatica,
    pausarExtraccion: pausarExtraccion,
    continuarExtraccion: continuarExtraccion,
    recuperarAvance: recuperarAvance,
    seleccionarPrueba: seleccionarPrueba,
    seleccionarPendientes: seleccionarPendientes
  };
})(window);

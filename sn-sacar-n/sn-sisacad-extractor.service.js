/* =========================================================
Nombre completo: sn-sisacad-extractor.service.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-sisacad-extractor.service.js
Modulo: Sacar N
Funcion o funciones:
- Ejecutar la prueba visible con maximo tres estudiantes pendientes.
- Enviar los estudiantes a Electron para busqueda y lectura en SISACAD.
- Guardar notas, estados y novedades en la pantalla Sacar N.
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

  function api(){
    return window.electronAPI && window.electronAPI.sacarN ? window.electronAPI.sacarN : null;
  }

  function setMensaje(mensaje, estado){
    if(state.setModulo && cfg.estadosModulo){
      state.setModulo(estado || (state.get ? state.get().modulo : cfg.estadosModulo.listo), mensaje);
    }
  }

  function seleccionarPrueba(){
    if(queue.primerosPendientes){
      return queue.primerosPendientes(cfg.pruebaVisibleCantidad || 3);
    }
    var snapshot = state.get ? state.get() : {};
    return (snapshot.estudiantes || []).slice(0, cfg.pruebaVisibleCantidad || 3);
  }

  function marcarProcesando(estudiantes){
    var estadoProcesando = (cfg.estadosEstudiante && cfg.estadosEstudiante.procesando) || "Procesando";
    estudiantes.forEach(function(estudiante){
      if(state.actualizarEstudiante){
        state.actualizarEstudiante(estudiante.id || estudiante.cedula, {
          estado: estadoProcesando,
          observacion: "Incluido en prueba visible."
        });
      }
    });
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

    marcarProcesando(estudiantes);
    setMensaje("Ejecutando prueba visible con " + estudiantes.length + " estudiantes. Observe la ventana de SISACAD.", cfg.estadosModulo ? cfg.estadosModulo.pruebaVisible : "prueba_visible");

    return a.runPruebaVisible(estudiantes).then(function(respuesta){
      var resultados = (respuesta && respuesta.resultados) || [];
      resultados.forEach(aplicarResultado);
      if(state.setModulo && cfg.estadosModulo){
        state.setModulo(cfg.estadosModulo.listo, (respuesta && respuesta.mensaje) || "Prueba visible finalizada.");
      }
      return respuesta;
    }).catch(function(error){
      setMensaje("Error en prueba visible: " + error.message, cfg.estadosModulo ? cfg.estadosModulo.errorCritico : "error_critico");
      return { ok:false, error:error.message };
    });
  }

  window.SNSisacadExtractor = {
    pruebaVisible: pruebaVisible,
    seleccionarPrueba: seleccionarPrueba
  };
})(window);

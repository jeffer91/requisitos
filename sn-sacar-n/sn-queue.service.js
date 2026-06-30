/* =========================================================
Nombre completo: sn-queue.service.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-queue.service.js
Modulo: Sacar N
Funcion o funciones:
- Preparar la cola de estudiantes para prueba visible y extraccion automatica.
- Identificar pendientes, procesados, errores y estudiantes para revision.
- Permitir continuar despues de una pausa o cierre de la app.
Con que se conecta:
- sn-config.js
- sn-state.service.js
- sn-store.service.js
========================================================= */
(function(window){
  "use strict";

  var cfg = window.SNConfig || {};
  var state = window.SNState || {};
  var store = window.SNStore || {};

  function estados(){
    return cfg.estadosEstudiante || {};
  }

  function esPendiente(estudiante){
    var e = estados();
    var estado = String(estudiante && estudiante.estado || "");
    return !estado || estado === (e.pendiente || "Pendiente");
  }

  function crearCola(estudiantes){
    estudiantes = Array.isArray(estudiantes) ? estudiantes : [];
    return estudiantes.map(function(item, index){
      return Object.assign({}, item, {
        orden: Number(item.orden || index + 1),
        estado: item.estado || (estados().pendiente || "Pendiente")
      });
    });
  }

  function pendientes(){
    var snapshot = state.get ? state.get() : {};
    return (snapshot.estudiantes || []).filter(esPendiente);
  }

  function primerosPendientes(cantidad){
    return pendientes().slice(0, Math.max(1, Number(cantidad || cfg.pruebaVisibleCantidad || 3)));
  }

  function siguientePendiente(){
    return pendientes()[0] || null;
  }

  function guardarCola(estudiantes){
    var cola = crearCola(estudiantes);
    if(store.guardarEstudiantes){ store.guardarEstudiantes(cola); }
    if(state.setEstudiantes){ state.setEstudiantes(cola); }
    return cola;
  }

  function recuperarCola(){
    var cola = store.leerEstudiantes ? store.leerEstudiantes() : [];
    if(Array.isArray(cola) && cola.length && state.setEstudiantes){
      state.setEstudiantes(cola);
    }
    return cola;
  }

  window.SNQueue = {
    crearCola: crearCola,
    guardarCola: guardarCola,
    recuperarCola: recuperarCola,
    pendientes: pendientes,
    primerosPendientes: primerosPendientes,
    siguientePendiente: siguientePendiente,
    esPendiente: esPendiente
  };
})(window);

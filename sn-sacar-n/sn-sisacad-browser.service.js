/* =========================================================
Nombre completo: sn-sisacad-browser.service.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-sisacad-browser.service.js
Modulo: Sacar N
Funcion o funciones:
- Abrir SISACAD en una ventana visible independiente desde Electron.
- Consultar estado de la ventana SISACAD.
- Mantener el flujo seguro: no guardar contrasenas visibles y no modificar SISACAD.
Con que se conecta:
- electron/main.js
- electron/preload.js
- sn-config.js
- sn-state.service.js
- sn-ui-events.service.js
========================================================= */
(function(window){
  "use strict";

  var cfg = window.SNConfig || {};
  var state = window.SNState || {};

  function api(){
    return window.electronAPI && window.electronAPI.sacarN ? window.electronAPI.sacarN : null;
  }

  function setMensaje(mensaje, estado){
    if(state.setModulo && cfg.estadosModulo){
      state.setModulo(estado || (state.get ? state.get().modulo : cfg.estadosModulo.listo), mensaje);
    }
  }

  function disponible(){
    var a = api();
    return !!(a && typeof a.openSisacad === "function");
  }

  function abrir(){
    var a = api();
    if(!a || typeof a.openSisacad !== "function"){
      setMensaje("SISACAD solo puede abrirse desde Electron. Abra Requisitos con npm start.", cfg.estadosModulo ? cfg.estadosModulo.errorCritico : "error_critico");
      return Promise.resolve({ ok:false, abierta:false, error:"Electron no disponible" });
    }

    setMensaje("Abriendo SISACAD en ventana visible...", cfg.estadosModulo ? cfg.estadosModulo.listo : "listo");
    return a.openSisacad().then(function(status){
      if(status && status.abierta){
        setMensaje("SISACAD abierto. Inicie sesion si hace falta. La app no guarda contrasenas visibles.", cfg.estadosModulo ? cfg.estadosModulo.listo : "listo");
      }else{
        setMensaje("No se pudo confirmar que SISACAD este abierto.", cfg.estadosModulo ? cfg.estadosModulo.errorCritico : "error_critico");
      }
      return status;
    }).catch(function(error){
      setMensaje("Error al abrir SISACAD: " + error.message, cfg.estadosModulo ? cfg.estadosModulo.errorCritico : "error_critico");
      return { ok:false, abierta:false, error:error.message };
    });
  }

  function estado(){
    var a = api();
    if(!a || typeof a.getSisacadStatus !== "function"){
      return Promise.resolve({ ok:false, abierta:false, error:"Electron no disponible" });
    }
    return a.getSisacadStatus();
  }

  function enfocar(){
    var a = api();
    if(!a || typeof a.focusSisacad !== "function"){
      return Promise.resolve({ ok:false, abierta:false, error:"Electron no disponible" });
    }
    return a.focusSisacad();
  }

  function cerrar(){
    var a = api();
    if(!a || typeof a.closeSisacad !== "function"){
      return Promise.resolve({ ok:false, abierta:false, error:"Electron no disponible" });
    }
    return a.closeSisacad();
  }

  window.SNSisacadBrowser = {
    disponible: disponible,
    abrir: abrir,
    estado: estado,
    enfocar: enfocar,
    cerrar: cerrar
  };
})(window);

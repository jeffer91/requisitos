/* =========================================================
Nombre completo: sn-sisacad-navigation.service.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-sisacad-navigation.service.js
Modulo: Sacar N
Funcion o funciones:
- Pedir a Electron que lleve SISACAD hasta Registro Notas Proyecto.
- Detectar si SISACAD requiere inicio de sesion manual.
- Mantener la navegacion separada de la extraccion de notas.
Con que se conecta:
- sn-config.js
- sn-selectors.config.js
- sn-state.service.js
- sn-sisacad-browser.service.js
- electron/main.js
- electron/preload.js
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
    return !!(a && typeof a.navigateRegistroNotasProyecto === "function");
  }

  function irARegistroNotasProyecto(){
    var a = api();
    if(!a || typeof a.navigateRegistroNotasProyecto !== "function"){
      setMensaje("La navegacion de SISACAD solo esta disponible en Electron. Abra Requisitos con npm start.", cfg.estadosModulo ? cfg.estadosModulo.errorCritico : "error_critico");
      return Promise.resolve({ ok:false, error:"Electron no disponible" });
    }

    setMensaje("Buscando Registro Notas Proyecto en SISACAD...", cfg.estadosModulo ? cfg.estadosModulo.listo : "listo");
    return a.navigateRegistroNotasProyecto().then(function(result){
      if(result && result.ok && result.enRegistro){
        setMensaje("SISACAD esta en Registro Notas Proyecto. Listo para la prueba visible.", cfg.estadosModulo ? cfg.estadosModulo.listo : "listo");
      }else if(result && result.necesitaLogin){
        setMensaje("SISACAD necesita inicio de sesion manual. Ingrese en la ventana visible y vuelva a presionar Ir a Registro Notas Proyecto.", cfg.estadosModulo ? cfg.estadosModulo.listo : "listo");
      }else{
        setMensaje((result && result.mensaje) || "No se pudo llegar automaticamente a Registro Notas Proyecto. Puede navegar manualmente en la ventana visible.", cfg.estadosModulo ? cfg.estadosModulo.listo : "listo");
      }
      return result;
    }).catch(function(error){
      setMensaje("Error al navegar en SISACAD: " + error.message, cfg.estadosModulo ? cfg.estadosModulo.errorCritico : "error_critico");
      return { ok:false, error:error.message };
    });
  }

  function verificarPantalla(){
    var a = api();
    if(!a || typeof a.checkRegistroNotasProyecto !== "function"){
      return Promise.resolve({ ok:false, error:"Electron no disponible" });
    }
    return a.checkRegistroNotasProyecto();
  }

  window.SNSisacadNavigation = {
    disponible: disponible,
    irARegistroNotasProyecto: irARegistroNotasProyecto,
    verificarPantalla: verificarPantalla
  };
})(window);

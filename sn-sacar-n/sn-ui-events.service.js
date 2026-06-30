/* =========================================================
Nombre completo: sn-ui-events.service.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-ui-events.service.js
Modulo: Sacar N
Funcion o funciones:
- Conectar eventos de botones, filtros y paneles de la pantalla Sacar N.
- Mantener separados los eventos de la logica principal.
- Dejar respuestas temporales claras mientras faltan BDLocal, SISACAD y Playwright.
Con que se conecta:
- sn-config.js
- sn-state.service.js
- sn-ui-render.service.js
- sn-sacar-n.js
========================================================= */
(function(window, document){
  "use strict";

  var cfg = window.SNConfig || {};
  var state = window.SNState || {};

  function $(id){ return document.getElementById(id); }

  function bindClick(id, fn){
    var el = $(id);
    if(el && typeof fn === "function"){
      el.addEventListener("click", fn);
    }
  }

  function setMensaje(texto){
    if(state.setModulo && cfg.estadosModulo){
      state.setModulo(state.get ? state.get().modulo : cfg.estadosModulo.sinIniciar, texto);
    }
  }

  function toggleNovedades(){
    var panel = $("snNovedadesPanel");
    if(!panel){ return; }
    panel.classList.toggle("sn-panel-open");
  }

  function bindFilters(){
    var buscar = $("snBuscar");
    if(buscar && state.patch){
      buscar.addEventListener("input", function(){
        state.patch({ busqueda: buscar.value || "" });
      });
    }
  }

  function bindButtons(){
    bindClick("snBtnCargarEstudiantes", function(){
      setMensaje("Bloque 4 pendiente: aqui se cargaran estudiantes desde BDLocal.");
    });

    bindClick("snBtnAbrirSisacad", function(){
      setMensaje("Bloque 5 pendiente: aqui se abrira SISACAD visible con Electron + Playwright.");
    });

    bindClick("snBtnPruebaVisible", function(){
      setMensaje("Bloque 7 pendiente: aqui se ejecutara la prueba visible con pocos estudiantes.");
    });

    bindClick("snBtnContinuarAutomatico", function(){
      setMensaje("Bloque 8 pendiente: aqui iniciara la extraccion automatica completa.");
    });

    bindClick("snBtnPausar", function(){
      if(state.setModulo && cfg.estadosModulo){
        state.setModulo(cfg.estadosModulo.pausado, "Extraccion pausada. Cuando exista automatizacion real, continuara desde el ultimo pendiente.");
      }
    });

    bindClick("snBtnContinuar", function(){
      if(state.setModulo && cfg.estadosModulo){
        state.setModulo(cfg.estadosModulo.listo, "Listo para continuar. La continuacion real se activara en los bloques de extraccion.");
      }
    });

    bindClick("snBtnExportar", function(){
      setMensaje("Bloque 11 pendiente: aqui se exportara el Excel final con hojas Notas Proyecto y Errores.");
    });

    bindClick("snBtnVerNovedades", function(){
      toggleNovedades();
    });

    bindClick("snBtnCerrarNovedades", function(){
      toggleNovedades();
    });

    bindClick("snBtnResetBase", function(){
      if(state.reset){ state.reset(); }
    });
  }

  function init(){
    bindFilters();
    bindButtons();
  }

  window.SNUIEvents = {
    init: init,
    toggleNovedades: toggleNovedades
  };
})(window, document);

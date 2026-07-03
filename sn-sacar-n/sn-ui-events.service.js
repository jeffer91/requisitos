/* =========================================================
Nombre completo: sn-ui-events.service.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-ui-events.service.js
Modulo: Sacar N
Funcion o funciones:
- Conectar eventos de botones, filtros y paneles de la pantalla Sacar N.
- Ejecutar la carga de estudiantes desde BDLocal.
- Abrir SISACAD visible desde Electron.
- Navegar hasta Registro Notas Proyecto.
- Ejecutar prueba visible con pocos estudiantes.
- Dejar respuestas temporales claras para extraccion automatica y exportacion.
Con que se conecta:
- sn-config.js
- sn-state.service.js
- sn-estudiantes.service.js
- sn-sisacad-browser.service.js
- sn-sisacad-navigation.service.js
- sn-sisacad-extractor.service.js
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

  function patchFiltro(nombre, valor){
    var data = {};
    data[nombre] = valor || "";
    if(state.patch){ state.patch(data); }
  }

  function toggleNovedades(){
    var panel = $("snNovedadesPanel");
    if(!panel){ return; }
    panel.classList.toggle("sn-panel-open");
  }

  function cargarCatalogosIniciales(){
    var svc = window.SNEstudiantes;
    if(svc && typeof svc.cargarCatalogos === "function"){
      svc.cargarCatalogos().catch(function(error){
        console.error("[SN_UI_EVENTS] Error al cargar catalogos", error);
      });
    }else{
      setMensaje("No se encontro el servicio de estudiantes. Revise sn-estudiantes.service.js.");
    }
  }

  function bindFilters(){
    var periodo = $("snPeriodo");
    var carrera = $("snCarrera");
    var modalidad = $("snModalidad");
    var buscar = $("snBuscar");

    if(periodo){ periodo.addEventListener("change", function(){ patchFiltro("periodoSeleccionado", periodo.value); }); }
    if(carrera){ carrera.addEventListener("change", function(){ patchFiltro("carreraSeleccionada", carrera.value); }); }
    if(modalidad){ modalidad.addEventListener("change", function(){ patchFiltro("modalidadSeleccionada", modalidad.value); }); }
    if(buscar){ buscar.addEventListener("input", function(){ patchFiltro("busqueda", buscar.value); }); }
  }

  function bindButtons(){
    bindClick("snBtnCargarEstudiantes", function(){
      var svc = window.SNEstudiantes;
      if(svc && typeof svc.cargarEstudiantes === "function"){
        svc.cargarEstudiantes().catch(function(error){
          console.error("[SN_UI_EVENTS] Error al cargar estudiantes", error);
        });
      }else{
        setMensaje("No se encontro el servicio para cargar estudiantes desde BDLocal.");
      }
    });

    bindClick("snBtnAbrirSisacad", function(){
      var browser = window.SNSisacadBrowser;
      if(browser && typeof browser.abrir === "function"){
        browser.abrir().catch(function(error){
          console.error("[SN_UI_EVENTS] Error al abrir SISACAD", error);
        });
      }else{
        setMensaje("No se encontro el servicio para abrir SISACAD. Revise sn-sisacad-browser.service.js.");
      }
    });

    bindClick("snBtnIrRegistro", function(){
      var nav = window.SNSisacadNavigation;
      if(nav && typeof nav.irARegistroNotasProyecto === "function"){
        nav.irARegistroNotasProyecto().catch(function(error){
          console.error("[SN_UI_EVENTS] Error al navegar a Registro Notas Proyecto", error);
        });
      }else{
        setMensaje("No se encontro el servicio para navegar a Registro Notas Proyecto. Revise sn-sisacad-navigation.service.js.");
      }
    });

    bindClick("snBtnPruebaVisible", function(){
      var extractor = window.SNSisacadExtractor;
      if(extractor && typeof extractor.pruebaVisible === "function"){
        extractor.pruebaVisible().catch(function(error){
          console.error("[SN_UI_EVENTS] Error en prueba visible", error);
        });
      }else{
        setMensaje("No se encontro el servicio de prueba visible. Revise sn-sisacad-extractor.service.js.");
      }
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

    bindClick("snBtnVerNovedades", function(){ toggleNovedades(); });
    bindClick("snBtnCerrarNovedades", function(){ toggleNovedades(); });
    bindClick("snBtnResetBase", function(){ if(state.reset){ state.reset(); cargarCatalogosIniciales(); } });
  }

  function init(){
    bindFilters();
    bindButtons();
    cargarCatalogosIniciales();
  }

  window.SNUIEvents = { init: init, toggleNovedades: toggleNovedades };
})(window, document);

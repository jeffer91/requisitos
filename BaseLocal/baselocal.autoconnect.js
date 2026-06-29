/* =========================================================
Nombre completo: baselocal.autoconnect.js
Ruta o ubicación: /Requisitos/BaseLocal/baselocal.autoconnect.js
Función o funciones:
- Detectar la pantalla actual de Requisitos.
- Conectar automáticamente cada módulo con RequisitosBL.
- Evitar tener que modificar todos los HTML manualmente.
- Limpiar colecciones espejo antiguas antes de conectar para evitar cuelgues por localStorage pesado.
========================================================= */
(function(window){
  "use strict";

  function hasBL(){
    return !!(window.RequisitosBL && typeof window.RequisitosBL.conectarModulo === "function");
  }

  function lower(value){
    return String(value || "").toLowerCase();
  }

  function cleanHeavyMirrorsOnce(){
    if(window.__REQ_BL_AUTOCLEANED__){
      return;
    }
    window.__REQ_BL_AUTOCLEANED__ = true;
    try{
      if(window.RequisitosBL && typeof window.RequisitosBL.purgeGeneratedCopies === "function"){
        window.RequisitosBL.purgeGeneratedCopies("");
      }
    }catch(error){
      console.warn("[baselocal.autoconnect] Limpieza liviana omitida", error);
    }
  }

  function connectOnce(){
    if(!hasBL()){
      return false;
    }

    if(window.__REQ_BL_AUTOCONNECTED__){
      return true;
    }

    cleanHeavyMirrorsOnce();

    var path = lower(window.location.pathname);
    var cfg = null;

    if(path.indexOf("/gestion/excel/") >= 0 || path.indexOf("excel.html") >= 0){
      cfg = {
        module:"requisito",
        collection:"requisitos",
        globalName:"RequisitoBL",
        globals:["requisitosData","listaRequisitos","datosRequisitos","requisitos","studentsRequirements"]
      };
    }else if(path.indexOf("/gestion/tabla/") >= 0 || path.indexOf("tabla.html") >= 0){
      cfg = {
        module:"tabla",
        collection:"tabla",
        globalName:"TablaBL",
        globals:["tablaData","datosTabla","listaTabla","requisitosTabla","tablaPrincipalData"]
      };
    }else if(path.indexOf("/ficha/") >= 0 || path.indexOf("ficha.html") >= 0){
      cfg = {
        module:"ficha",
        collection:"fichas",
        globalName:"FichaBL",
        globals:["fichaData","datosFicha","fichasData","listaFichas","estudianteFicha"]
      };
    }else if(path.indexOf("/stats/") >= 0 || path.indexOf("stats.html") >= 0){
      cfg = {
        module:"stats",
        collection:"stats",
        globalName:"StatsBL",
        globals:["statsData","datosStats","estadisticasData","resumenStats"]
      };
    }else if(path.indexOf("/coordi/") >= 0 || path.indexOf("coordi.html") >= 0){
      cfg = {
        module:"coordi",
        collection:"coordi",
        globalName:"CoordiBL",
        globals:["coordiData","datosCoordi","coordinacionData","listaCoordi","datosCoordinador"]
      };
    }else if(path.indexOf("/reportes/") >= 0 || path.indexOf("repo.html") >= 0){
      cfg = {
        module:"repor",
        collection:"reportes",
        globalName:"ReporBL",
        globals:["reporData","reportesData","datosReportes","listaReportes","reporteActual"]
      };
    }else if(path.indexOf("/defart/") >= 0 || path.indexOf("defart.html") >= 0){
      cfg = {
        module:"defart",
        collection:"defensas",
        globalName:"DefensasBL",
        globals:["defensasData","datosDefensas","listaDefensas","agendaDefensas","defensas"]
      };
    }

    if(!cfg){
      return true;
    }

    window.__REQ_BL_AUTOCONNECTED__ = true;
    window.RequisitosBL.conectarModulo(cfg.module, {
      collection:cfg.collection,
      globalName:cfg.globalName,
      globals:cfg.globals
    });

    try{
      window.RequisitosBL.notificar("autoconnect", {
        module:cfg.module,
        collection:cfg.collection,
        globalName:cfg.globalName,
        lazyMirror:true
      });
    }catch(error){}

    return true;
  }

  function start(){
    if(connectOnce()){
      return;
    }
    var tries = 0;
    var timer = setInterval(function(){
      tries += 1;
      if(connectOnce() || tries >= 20){
        clearInterval(timer);
      }
    }, 250);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start);
  }else{
    start();
  }
})(window);
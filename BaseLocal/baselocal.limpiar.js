/* =========================================================
Nombre completo: baselocal.limpiar.js
Ruta o ubicación: /Requisitos/BaseLocal/baselocal.limpiar.js
Función o funciones:
- Conectar el botón visible Limpiar base con el servicio de limpieza.
- Ejecutar sin confirmación previa.
- Mostrar mensaje final con fusionados, eliminados y períodos unidos.
Con qué se conecta:
- services/bl-limpiar-base.service.js
- baselocal.app.js
========================================================= */
(function(window, document){
  "use strict";

  function el(id){return document.getElementById(id);}
  function text(value){return String(value == null ? "" : value).trim();}

  async function ejecutar(){
    if(!window.BLLimpiarBaseService || typeof window.BLLimpiarBaseService.ejecutar !== "function"){
      throw new Error("BLLimpiarBaseService no está disponible.");
    }
    return window.BLLimpiarBaseService.ejecutar();
  }

  function renderLogs(){
    var box = el("bl-diagnostics-box");
    if(!box || !window.BLLimpiarBaseService || typeof window.BLLimpiarBaseService.getLogs !== "function"){return;}
    var logs = window.BLLimpiarBaseService.getLogs();
    if(!logs.length){return;}
    try{
      var current = JSON.parse(box.textContent || "{}");
      current.limpiezaBase = logs[0];
      box.textContent = JSON.stringify(current, null, 2);
    }catch(error){}
  }

  window.BaseLocalLimpiar = {ejecutar:ejecutar, renderLogs:renderLogs};

  window.addEventListener("requisitos:bl:limpieza-complete", function(){setTimeout(renderLogs, 250);});
  window.addEventListener("bl:ready", function(){setTimeout(renderLogs, 500);});
})(window, document);

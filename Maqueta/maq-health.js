/* =========================================================
Nombre completo: maq-health.js
Ruta o ubicación: /Requisitos/Maqueta/maq-health.js
Función o funciones:
- Verificar que los servicios mínimos de Maqueta estén cargados.
- Mostrar estado simple en la barra inferior.
Con qué se conecta:
- maq-index.html
========================================================= */
(function(window,document){
  "use strict";
  function boot(){var ok=!!(window.MAQ_UTILS&&window.MAQ_CORE&&window.MAQ_MENU&&window.MAQ_MODULOS_REGISTRY);var el=document.getElementById("maq-status-text");if(el)el.textContent=ok?"Maqueta lista":"Maqueta con módulos pendientes";console.info("[MAQ_HEALTH]",{ok:ok,at:new Date().toISOString()});}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})(window,document);

/* =========================================================
Nombre completo: global.index.js
Ruta o ubicación: /Requisitos/Global/global.index.js
Función:
- Arranque seguro del módulo Global.
- Delegar la pantalla real a GlobalApp cuando esté disponible.
- Mantener fallback visual mínimo si GlobalApp no carga.
Con qué se conecta:
- global.html
- global.config.js
- global.core.js
- global.table.js
- global.app.js
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.0.0-bloque-3";
  var config = window.GlobalConfig || {};

  function $(selector){ return document.querySelector(selector); }

  function text(value){ return String(value == null ? "" : value).trim(); }

  function esc(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function emit(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail:detail || {} })); }catch(error){}
  }

  function fallbackBoot(){
    var menu = $("#globalMenu");
    var body = $("#globalSectionBody");
    var state = $("#globalSectionState");
    var sections = Array.isArray(config.secciones) ? config.secciones : [];

    if(state){ state.textContent = "Modo básico"; }

    if(menu){
      menu.innerHTML = sections.map(function(section, index){
        return '<button type="button" class="' + (index === 0 ? 'is-active' : '') + '">' + esc(section.label || section.id) + '</button>';
      }).join("");
    }

    if(body){
      body.innerHTML = ''
        + '<div class="global-empty-state">'
          + '<h3>Global en modo básico</h3>'
          + '<p>No se encontró GlobalApp. Revisa que global.app.js y global.table.js estén cargando correctamente.</p>'
        + '</div>';
    }
  }

  function boot(){
    if(window.GlobalApp && typeof window.GlobalApp.boot === "function"){
      window.GlobalApp.boot();
      emit("global:ready", {
        ok:true,
        mode:"app",
        version:VERSION,
        appVersion:window.GlobalApp.version,
        at:new Date().toISOString()
      });
      return;
    }

    fallbackBoot();
    emit("global:ready", {
      ok:false,
      mode:"fallback",
      version:VERSION,
      message:"GlobalApp no disponible.",
      at:new Date().toISOString()
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.GlobalIndex = {
    version:VERSION,
    boot:boot,
    mode:function(){ return window.GlobalApp ? "app" : "fallback"; },
    getActiveSection:function(){ return window.GlobalApp && window.GlobalApp.getActiveSection ? window.GlobalApp.getActiveSection() : "resumen"; },
    getFilters:function(){ return window.GlobalApp && window.GlobalApp.getFilters ? window.GlobalApp.getFilters() : {}; }
  };
})(window, document);

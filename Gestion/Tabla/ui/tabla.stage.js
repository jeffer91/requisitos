/* =========================================================
Nombre completo: tabla.stage.js
Ruta: /Gestion/Tabla/ui/tabla.stage.js
Función:
- Aplicar el filtro simple de etapa actual sin modificar Base Local.
- Reutilizar TablaFilters y TablaStagePolicy.
- Mantener tres opciones visibles: Todos, Fuera de etapa y Cumplen etapa.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.0.0-simple-stage-filter";
  var mode = "all";
  var patched = false;

  function el(id){
    return document.getElementById(id);
  }

  function policy(){
    return window.TablaStagePolicy || null;
  }

  function filters(){
    return window.TablaFilters || null;
  }

  function normalize(value){
    var P = policy();
    return P && typeof P.normalizeMode === "function"
      ? P.normalizeMode(value)
      : (
          value === "out" || value === "ok"
            ? value
            : "all"
        );
  }

  function patchFilters(){
    var F = filters();

    if(
      patched ||
      !F ||
      typeof F.apply !== "function"
    ){
      return false;
    }

    var originalApply = F.apply.bind(F);

    F.apply = function(rows, currentFilters){
      var base = originalApply(rows, currentFilters);
      var P = policy();

      if(
        !P ||
        typeof P.filter !== "function" ||
        mode === "all"
      ){
        return base;
      }

      return P.filter(base, mode);
    };

    F.__stageFilterOriginalApply = originalApply;
    F.__stageFilterPatched = true;
    patched = true;
    return true;
  }

  function renderButtons(){
    var buttons = document.querySelectorAll("[data-stage-filter]");

    Array.prototype.forEach.call(buttons, function(button){
      var active = normalize(
        button.getAttribute("data-stage-filter")
      ) === mode;

      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function requestRender(){
    if(
      window.TablaApp &&
      typeof window.TablaApp.request === "function"
    ){
      window.TablaApp.request(true, 0);
      return;
    }

    window.setTimeout(function(){
      if(
        window.TablaApp &&
        typeof window.TablaApp.request === "function"
      ){
        window.TablaApp.request(true, 0);
      }
    }, 50);
  }

  function setMode(nextMode){
    nextMode = normalize(nextMode);

    if(nextMode === mode){
      renderButtons();
      return mode;
    }

    mode = nextMode;
    renderButtons();
    requestRender();

    try{
      window.dispatchEvent(
        new CustomEvent(
          "tabla:stage-filter-changed",
          {
            detail: {
              mode: mode
            }
          }
        )
      );
    }catch(error){}

    return mode;
  }

  function bind(){
    patchFilters();

    var buttons = document.querySelectorAll("[data-stage-filter]");

    Array.prototype.forEach.call(buttons, function(button){
      if(button.getAttribute("data-stage-bound") === "1"){
        return;
      }

      button.setAttribute("data-stage-bound", "1");
      button.addEventListener("click", function(){
        setMode(
          button.getAttribute("data-stage-filter")
        );
      });
    });

    renderButtons();
  }

  function boot(){
    bind();

    window.addEventListener("tabla:rendered", function(){
      renderButtons();
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.TablaStage = {
    version: VERSION,
    getMode: function(){ return mode; },
    setMode: setMode,
    render: renderButtons,
    patchFilters: patchFilters
  };
})(window, document);

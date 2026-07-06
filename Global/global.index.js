/* =========================================================
Nombre completo: global.index.js
Ruta o ubicación: /Requisitos/Global/global.index.js
Función:
- Inicializar la pantalla base del módulo Global.
- Construir el menú lateral desde GlobalConfig.
- Mostrar una sola sección activa.
- Capturar filtros superiores y emitir cambios para los siguientes bloques.
Con qué se conecta:
- global.html
- global.config.js
- global.app.js en el bloque de tablas inteligentes
========================================================= */
(function(window, document){
  "use strict";

  var config = window.GlobalConfig || {};
  var activeSection = "resumen";
  var filters = {
    periodoDesde:"",
    periodoHasta:"",
    carrera:"",
    requisito:"",
    tipoCarrera:""
  };

  function $(selector){ return document.querySelector(selector); }

  function text(value){ return String(value == null ? "" : value).trim(); }

  function emit(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail:detail || {} })); }catch(error){}
  }

  function sectionList(){
    return Array.isArray(config.secciones) ? config.secciones : [];
  }

  function sectionById(id){
    var found = null;
    sectionList().some(function(section){
      if(section.id === id){ found = section; return true; }
      return false;
    });
    return found || sectionList()[0] || { id:"resumen", label:"Resumen", titulo:"Resumen general", descripcion:"Vista base del módulo Global." };
  }

  function currentFilters(){
    Array.prototype.forEach.call(document.querySelectorAll("[data-global-filter]"), function(input){
      filters[input.getAttribute("data-global-filter")] = text(input.value);
    });
    return Object.assign({}, filters);
  }

  function renderMenu(){
    var menu = $("#globalMenu");
    if(!menu){ return; }

    menu.innerHTML = sectionList().map(function(section){
      return '<button type="button" data-global-section="' + section.id + '" class="' + (section.id === activeSection ? 'is-active' : '') + '">' + section.label + '</button>';
    }).join("");
  }

  function renderBody(section){
    var body = $("#globalSectionBody");
    if(!body){ return; }

    body.innerHTML = ''
      + '<div class="global-empty-state">'
        + '<h3>' + section.titulo + '</h3>'
        + '<p>Sección preparada. En los siguientes bloques se conectará con BDLocal y se renderizarán tablas inteligentes filtradas.</p>'
      + '</div>'
      + '<table class="global-placeholder-table" aria-label="Vista base de sección">'
        + '<thead><tr><th>Elemento</th><th>Estado</th><th>Detalle</th></tr></thead>'
        + '<tbody>'
          + '<tr><td>Filtros superiores</td><td>Activo</td><td>Periodo desde/hasta, carrera, requisito y tipo de carrera.</td></tr>'
          + '<tr><td>Panel lateral</td><td>Activo</td><td>Menú de sección única visible.</td></tr>'
          + '<tr><td>Datos BDLocal</td><td>Pendiente</td><td>Se conectará en el Bloque 2.</td></tr>'
          + '<tr><td>Tablas inteligentes</td><td>Pendiente</td><td>Se activarán en el Bloque 3.</td></tr>'
          + '<tr><td>PDF institucional</td><td>Pendiente</td><td>Se creará en el Bloque 4.</td></tr>'
        + '</tbody>'
      + '</table>';
  }

  function renderSection(id){
    activeSection = id || activeSection || "resumen";
    var section = sectionById(activeSection);
    var title = $("#globalSectionTitle");
    var desc = $("#globalSectionDescription");
    var state = $("#globalSectionState");

    if(title){ title.textContent = section.titulo || section.label || "Global"; }
    if(desc){ desc.textContent = section.descripcion || "Sección Global."; }
    if(state){ state.textContent = "Bloque 1 listo"; }

    renderMenu();
    renderBody(section);

    emit("global:section-changed", {
      section:section,
      filters:currentFilters(),
      at:new Date().toISOString()
    });
  }

  function clearFilters(){
    Array.prototype.forEach.call(document.querySelectorAll("[data-global-filter]"), function(input){
      input.value = "";
    });
    filters = currentFilters();
    emit("global:filters-changed", { filters:filters, section:activeSection, at:new Date().toISOString() });
    renderSection(activeSection);
  }

  function bindEvents(){
    var menu = $("#globalMenu");
    var btnLimpiar = $("#globalBtnLimpiar");
    var btnActualizar = $("#globalBtnActualizar");
    var btnPdf = $("#globalBtnPdf");

    if(menu){
      menu.addEventListener("click", function(event){
        var button = event.target.closest("button[data-global-section]");
        if(!button){ return; }
        renderSection(button.getAttribute("data-global-section"));
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-global-filter]"), function(input){
      input.addEventListener("change", function(){
        filters = currentFilters();
        emit("global:filters-changed", { filters:filters, section:activeSection, at:new Date().toISOString() });
        renderSection(activeSection);
      });
    });

    if(btnLimpiar){ btnLimpiar.addEventListener("click", clearFilters); }

    if(btnActualizar){
      btnActualizar.addEventListener("click", function(){
        emit("global:refresh-requested", { filters:currentFilters(), section:activeSection, at:new Date().toISOString() });
        renderSection(activeSection);
      });
    }

    if(btnPdf){
      btnPdf.addEventListener("click", function(){
        emit("global:pdf-requested", { filters:currentFilters(), section:activeSection, at:new Date().toISOString() });
        window.alert("El PDF institucional se activará en el Bloque 4. La sección y filtros ya quedan preparados.");
      });
    }
  }

  function boot(){
    renderMenu();
    bindEvents();
    renderSection(activeSection);
    emit("global:ready", {
      ok:true,
      version:config.app && config.app.version,
      section:activeSection,
      filters:currentFilters(),
      at:new Date().toISOString()
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.GlobalIndex = {
    version:"1.0.0-bloque-1",
    getActiveSection:function(){ return activeSection; },
    getFilters:currentFilters,
    renderSection:renderSection,
    clearFilters:clearFilters
  };
})(window, document);

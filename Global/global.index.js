/* =========================================================
Nombre completo: global.index.js
Ruta o ubicación: /Requisitos/Global/global.index.js
Función:
- Inicializar la pantalla base del módulo Global.
- Construir el menú lateral desde GlobalConfig.
- Mostrar una sola sección activa.
- Capturar filtros superiores y emitir cambios.
- Hidratar opciones de filtros desde GlobalCore/BDLocal.
Con qué se conecta:
- global.html
- global.config.js
- global.core.js
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

  function setState(message){
    var state = $("#globalSectionState");
    if(state){ state.textContent = message; }
  }

  function optionHtml(value, label, selected){
    return '<option value="' + esc(value) + '"' + (selected ? ' selected' : '') + '>' + esc(label) + '</option>';
  }

  function fillSelect(selectId, baseOption, items, mapper){
    var select = $(selectId);
    if(!select){ return; }

    var current = text(select.value);
    var html = optionHtml(baseOption.value || "", baseOption.label || "Todos", current === text(baseOption.value || ""));

    (items || []).forEach(function(item){
      var mapped = mapper(item) || {};
      var value = text(mapped.value);
      var label = text(mapped.label || value);
      if(!value && !label){ return; }
      html += optionHtml(value, label, current === value);
    });

    select.innerHTML = html;
  }

  function hydrateFiltersFromCore(){
    if(!window.GlobalCore || typeof window.GlobalCore.ready !== "function"){
      setState("Base visual lista");
      return Promise.resolve(null);
    }

    setState("Conectando BDLocal");

    return window.GlobalCore.ready().then(function(){
      var options = typeof window.GlobalCore.getFilterOptions === "function" ? window.GlobalCore.getFilterOptions() : {};

      fillSelect("#globalFiltroDesde", { value:"", label:"Todos" }, options.periods || [], function(item){
        return { value:item.id || item.periodoId || item.value || item.label, label:item.label || item.periodoLabel || item.id || item.value };
      });

      fillSelect("#globalFiltroHasta", { value:"", label:"Todos" }, options.periods || [], function(item){
        return { value:item.id || item.periodoId || item.value || item.label, label:item.label || item.periodoLabel || item.id || item.value };
      });

      fillSelect("#globalFiltroCarrera", { value:"", label:"Todas las carreras" }, options.careers || [], function(item){
        return { value:item.codigo || item.id || item.nombre, label:item.nombre || item.label || item.id };
      });

      fillSelect("#globalFiltroRequisito", { value:"", label:"Todos los requisitos" }, options.requirements || [], function(item){
        return { value:item.id || item.key || item.label, label:item.label || item.nombre || item.id || item.key };
      });

      setState("BDLocal conectado");
      emit("global:filters-hydrated", { options:options, filters:currentFilters(), at:new Date().toISOString() });
      renderSection(activeSection);
      return options;
    }).catch(function(error){
      setState("BDLocal no disponible");
      emit("global:core-error", { error:error && error.message ? error.message : String(error), at:new Date().toISOString() });
      return null;
    });
  }

  function renderMenu(){
    var menu = $("#globalMenu");
    if(!menu){ return; }

    menu.innerHTML = sectionList().map(function(section){
      return '<button type="button" data-global-section="' + esc(section.id) + '" class="' + (section.id === activeSection ? 'is-active' : '') + '">' + esc(section.label) + '</button>';
    }).join("");
  }

  function coreSummary(){
    if(!window.GlobalCore || typeof window.GlobalCore.applyFilters !== "function"){
      return null;
    }
    try{ return window.GlobalCore.applyFilters(currentFilters()); }
    catch(error){ return null; }
  }

  function renderBody(section){
    var body = $("#globalSectionBody");
    if(!body){ return; }

    var data = coreSummary();
    var resumen = data && data.resumen ? data.resumen : null;
    var resumenHtml = resumen ? ''
      + '<table class="global-placeholder-table" aria-label="Resumen de datos Global">'
        + '<thead><tr><th>Indicador</th><th>Valor</th><th>Detalle</th></tr></thead>'
        + '<tbody>'
          + '<tr><td>Total estudiantes</td><td>' + esc(resumen.totalEstudiantes) + '</td><td>Según filtros superiores.</td></tr>'
          + '<tr><td>Total carreras</td><td>' + esc(resumen.totalCarreras) + '</td><td>Carreras únicas detectadas.</td></tr>'
          + '<tr><td>Total períodos</td><td>' + esc(resumen.totalPeriodos) + '</td><td>Períodos incluidos en el análisis.</td></tr>'
          + '<tr><td>% cumplimiento</td><td>' + esc(resumen.porcentajeCumplimiento) + '%</td><td>Cálculo preliminar para Bloque 2.</td></tr>'
        + '</tbody>'
      + '</table>' : '';

    body.innerHTML = ''
      + '<div class="global-empty-state">'
        + '<h3>' + esc(section.titulo) + '</h3>'
        + '<p>Sección preparada con conexión de datos. En el Bloque 3 se reemplazará esta vista por tablas inteligentes con ordenamiento, búsqueda y paginación.</p>'
      + '</div>'
      + (resumenHtml || '<table class="global-placeholder-table" aria-label="Vista base de sección"><thead><tr><th>Elemento</th><th>Estado</th><th>Detalle</th></tr></thead><tbody><tr><td>BDLocal</td><td>Esperando datos</td><td>GlobalCore está preparado para recibir snapshot.</td></tr></tbody></table>');
  }

  function renderSection(id){
    activeSection = id || activeSection || "resumen";
    var section = sectionById(activeSection);
    var title = $("#globalSectionTitle");
    var desc = $("#globalSectionDescription");

    if(title){ title.textContent = section.titulo || section.label || "Global"; }
    if(desc){ desc.textContent = section.descripcion || "Sección Global."; }

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
        if(window.GlobalCore && typeof window.GlobalCore.refresh === "function"){
          setState("Actualizando datos");
          window.GlobalCore.refresh({ force:true }).then(function(){
            return hydrateFiltersFromCore();
          }).then(function(){
            renderSection(activeSection);
          });
        }else{
          renderSection(activeSection);
        }
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
    hydrateFiltersFromCore();
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
    version:"1.0.0-bloque-2",
    getActiveSection:function(){ return activeSection; },
    getFilters:currentFilters,
    renderSection:renderSection,
    clearFilters:clearFilters,
    hydrateFilters:hydrateFiltersFromCore
  };
})(window, document);

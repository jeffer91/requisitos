/* =========================================================
Nombre completo: global.app.js
Ruta o ubicación: /Requisitos/Global/global.app.js
Función:
- Controlar la pantalla Global real.
- Manejar filtros superiores y menú lateral.
- Mostrar una sola sección visible.
- Renderizar tablas inteligentes por sección.
- Enviar la sección actual al PDF institucional.
Con qué se conecta:
- global.config.js
- global.core.js
- global.table.js
- global.pdf.js
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.0.0-bloque-4";
  var config = window.GlobalConfig || {};
  var activeSection = "resumen";
  var booted = false;
  var lastData = null;

  function $(selector){ return document.querySelector(selector); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function esc(value){ return window.GlobalTable && window.GlobalTable.helpers ? window.GlobalTable.helpers.esc(value) : text(value); }
  function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name, { detail:detail || {} })); }catch(error){} }
  function sections(){ return Array.isArray(config.secciones) ? config.secciones : []; }

  function sectionById(id){
    var found = null;
    sections().some(function(section){ if(section.id === id){ found = section; return true; } return false; });
    return found || sections()[0] || { id:"resumen", label:"Resumen", titulo:"Resumen general", descripcion:"Vista ejecutiva." };
  }

  function currentFilters(){
    var filters = {};
    Array.prototype.forEach.call(document.querySelectorAll("[data-global-filter]"), function(input){
      filters[input.getAttribute("data-global-filter")] = text(input.value);
    });
    return filters;
  }

  function setState(message){ var node = $("#globalSectionState"); if(node){ node.textContent = message; } }

  function renderMenu(){
    var menu = $("#globalMenu");
    if(!menu){ return; }
    menu.innerHTML = sections().map(function(section){
      return '<button type="button" data-global-section="' + esc(section.id) + '" class="' + (section.id === activeSection ? 'is-active' : '') + '">' + esc(section.label) + '</button>';
    }).join("");
  }

  function optionHtml(value, label, selected){ return '<option value="' + esc(value) + '"' + (selected ? ' selected' : '') + '>' + esc(label) + '</option>'; }

  function fillSelect(selector, base, list, mapper){
    var select = $(selector);
    if(!select){ return; }
    var current = text(select.value);
    var html = optionHtml(base.value || "", base.label || "Todos", current === text(base.value || ""));
    (list || []).forEach(function(item){
      var mapped = mapper(item) || {};
      var value = text(mapped.value);
      var label = text(mapped.label || value);
      if(!value && !label){ return; }
      html += optionHtml(value, label, current === value);
    });
    select.innerHTML = html;
  }

  function hydrateFilters(){
    if(!window.GlobalCore || typeof window.GlobalCore.getFilterOptions !== "function"){ return; }
    var options = window.GlobalCore.getFilterOptions();

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
  }

  function loadData(){
    if(!window.GlobalCore || typeof window.GlobalCore.applyFilters !== "function"){ return Promise.resolve(null); }
    return window.GlobalCore.ready().then(function(){
      hydrateFilters();
      lastData = window.GlobalCore.applyFilters(currentFilters());
      return lastData;
    });
  }

  function renderSectionHeader(section){
    var title = $("#globalSectionTitle");
    var desc = $("#globalSectionDescription");
    if(title){ title.textContent = section.titulo || section.label || "Global"; }
    if(desc){ desc.textContent = section.descripcion || "Sección Global."; }
    renderMenu();
  }

  function tableMount(id){ return '<div id="' + esc(id) + '" class="global-table-mount"></div>'; }

  function renderBodyShell(title, intro, mounts){
    var body = $("#globalSectionBody");
    if(!body){ return; }
    body.innerHTML = ''
      + '<div class="global-section-intro"><h3>' + esc(title) + '</h3><p>' + esc(intro) + '</p></div>'
      + mounts.join("");
  }

  function renderSmartTable(id, title, rows, columns, sortKey, sortDir){
    if(!window.GlobalTable || typeof window.GlobalTable.render !== "function"){ return; }
    window.GlobalTable.render("#" + id, {
      id:id,
      title:title,
      rows:rows || [],
      columns:columns || [],
      pageSize:(config.filtros && config.filtros.pageSize) || 25,
      defaultSortKey:sortKey || "",
      defaultSortDir:sortDir || "asc"
    });
  }

  function pct(value){ return Number(value || 0); }

  function studentRows(data){
    return (data.students || []).map(function(row){
      var c = row._globalCumplimiento || {};
      return {
        cedula:row._globalCedula,
        nombres:row._globalNombres,
        carrera:row._globalCarrera,
        tipo:row._globalTipoCarrera,
        periodo:row._globalPeriodoLabel || row._globalPeriodoId,
        division:row._globalDivision,
        matricula:row._globalEstadoMatricula,
        cumplimiento:pct(c.porcentaje)
      };
    });
  }

  function resumenRows(data){
    var r = data.resumen || {};
    return [
      { indicador:"Total estudiantes", valor:r.totalEstudiantes || 0, detalle:"Estudiantes incluidos según filtros." },
      { indicador:"Total carreras", valor:r.totalCarreras || 0, detalle:"Carreras únicas detectadas." },
      { indicador:"Total períodos", valor:r.totalPeriodos || 0, detalle:"Períodos académicos incluidos." },
      { indicador:"Total requisitos", valor:r.totalRequisitos || 0, detalle:"Requisitos detectados o filtrados." },
      { indicador:"Cumplimiento general", valor:(r.porcentajeCumplimiento || 0) + "%", detalle:"Promedio de cumplimiento sobre requisitos detectados." },
      { indicador:"Activos", valor:r.activos || 0, detalle:"Estudiantes activos." },
      { indicador:"Retirados", valor:r.retirados || 0, detalle:"Estudiantes marcados como retirados." }
    ];
  }

  function carreraRows(data){
    var map = Object.create(null);
    (data.students || []).forEach(function(row){
      var k = row._globalCarrera || "SIN CARRERA";
      var c = row._globalCumplimiento || {};
      if(!map[k]){ map[k] = { carrera:k, tipo:row._globalTipoCarrera, estudiantes:0, activos:0, retirados:0, suma:0 }; }
      map[k].estudiantes += 1;
      map[k].suma += pct(c.porcentaje);
      if(row._globalEstadoMatricula === "RETIRADO"){ map[k].retirados += 1; } else { map[k].activos += 1; }
    });
    return Object.keys(map).map(function(k){ var item = map[k]; item.cumplimiento = item.estudiantes ? Math.round(item.suma / item.estudiantes) : 0; return item; });
  }

  function periodoRows(data){
    var map = Object.create(null);
    (data.students || []).forEach(function(row){
      var k = row._globalPeriodoLabel || row._globalPeriodoId || "SIN PERÍODO";
      var c = row._globalCumplimiento || {};
      if(!map[k]){ map[k] = { periodo:k, estudiantes:0, carreras:Object.create(null), suma:0 }; }
      map[k].estudiantes += 1;
      map[k].carreras[row._globalCarrera || "SIN CARRERA"] = true;
      map[k].suma += pct(c.porcentaje);
    });
    return Object.keys(map).map(function(k){ var item = map[k]; return { periodo:item.periodo, estudiantes:item.estudiantes, carreras:Object.keys(item.carreras).length, cumplimiento:item.estudiantes ? Math.round(item.suma / item.estudiantes) : 0 }; });
  }

  function tipoRows(data){
    var map = Object.create(null);
    (data.students || []).forEach(function(row){
      var k = row._globalTipoCarrera || "SIN TIPO";
      var c = row._globalCumplimiento || {};
      if(!map[k]){ map[k] = { tipo:k, estudiantes:0, carreras:Object.create(null), suma:0 }; }
      map[k].estudiantes += 1;
      map[k].carreras[row._globalCarrera || "SIN CARRERA"] = true;
      map[k].suma += pct(c.porcentaje);
    });
    return Object.keys(map).map(function(k){ var item = map[k]; return { tipo:item.tipo, estudiantes:item.estudiantes, carreras:Object.keys(item.carreras).length, cumplimiento:item.estudiantes ? Math.round(item.suma / item.estudiantes) : 0 }; });
  }

  function requisitoRows(data){
    var out = [];
    (data.requirements || []).forEach(function(req){
      var cumple = 0, pendiente = 0, noCumple = 0;
      (data.students || []).forEach(function(row){
        var status = window.GlobalCore.helpers.cellStatus(window.GlobalCore.helpers.requirementValue(row, req.id || req.key));
        if(status === "CUMPLE"){ cumple += 1; }
        else if(status === "PENDIENTE"){ pendiente += 1; }
        else{ noCumple += 1; }
      });
      var total = cumple + pendiente + noCumple;
      out.push({ requisito:req.label || req.id, cumple:cumple, pendiente:pendiente, noCumple:noCumple, total:total, cumplimiento:total ? Math.round((cumple / total) * 100) : 0 });
    });
    return out;
  }

  function comparativaRows(data){
    var map = Object.create(null);
    (data.students || []).forEach(function(row){
      var k = (row._globalPeriodoLabel || row._globalPeriodoId || "SIN PERÍODO") + "__" + (row._globalTipoCarrera || "SIN TIPO");
      if(!map[k]){ map[k] = { periodo:row._globalPeriodoLabel || row._globalPeriodoId, tipo:row._globalTipoCarrera, estudiantes:0, carreras:Object.create(null) }; }
      map[k].estudiantes += 1;
      map[k].carreras[row._globalCarrera || "SIN CARRERA"] = true;
    });
    return Object.keys(map).map(function(k){ var item = map[k]; return { periodo:item.periodo, tipo:item.tipo, estudiantes:item.estudiantes, carreras:Object.keys(item.carreras).length }; });
  }

  function alertaRows(data){
    var reqs = requisitoRows(data).map(function(row){ return { alerta:"Requisito crítico", detalle:row.requisito, cantidad:row.noCumple + row.pendiente, prioridad:(row.noCumple + row.pendiente) > 0 ? "Revisar" : "Controlado" }; });
    var carreras = carreraRows(data).map(function(row){ return { alerta:"Carrera con pendientes", detalle:row.carrera, cantidad:100 - row.cumplimiento, prioridad:row.cumplimiento < 70 ? "Alta" : "Media" }; });
    return reqs.concat(carreras).filter(function(row){ return Number(row.cantidad || 0) > 0; });
  }

  function reportRows(data){
    return sections().map(function(section){
      return { seccion:section.label, reporte:section.pdfTitulo || section.titulo, estado:section.id === activeSection ? "Actual" : "Disponible", registros:(data.students || []).length, filtros:"Aplica filtros superiores" };
    });
  }

  function renderResumen(data){
    renderBodyShell("Resumen general", "Resumen ejecutivo calculado con los filtros superiores activos.", [tableMount("globalTablaResumen"), tableMount("globalTablaResumenPeriodos")]);
    renderSmartTable("globalTablaResumen", "Indicadores generales", resumenRows(data), [
      { key:"indicador", label:"Indicador" },
      { key:"valor", label:"Valor", type:"number" },
      { key:"detalle", label:"Detalle" }
    ], "indicador", "asc");
    renderSmartTable("globalTablaResumenPeriodos", "Estudiantes por período", periodoRows(data), periodColumns(), "periodo", "asc");
  }

  function studentColumns(){
    return [
      { key:"cedula", label:"Cédula" },
      { key:"nombres", label:"Estudiante" },
      { key:"carrera", label:"Carrera" },
      { key:"tipo", label:"Tipo" },
      { key:"periodo", label:"Período" },
      { key:"division", label:"División" },
      { key:"matricula", label:"Matrícula" },
      { key:"cumplimiento", label:"Cumplimiento", type:"percent", percent:true }
    ];
  }

  function periodColumns(){
    return [
      { key:"periodo", label:"Período" },
      { key:"estudiantes", label:"Estudiantes", type:"number" },
      { key:"carreras", label:"Carreras", type:"number" },
      { key:"cumplimiento", label:"Cumplimiento", type:"percent", percent:true }
    ];
  }

  function renderSectionContent(section, data){
    if(section.id === "resumen"){ renderResumen(data); return; }
    if(section.id === "estudiantes"){
      renderBodyShell("Estudiantes", "Listado filtrado de estudiantes. Puedes ordenar por encabezados y buscar dentro de la tabla.", [tableMount("globalTablaEstudiantes")]);
      renderSmartTable("globalTablaEstudiantes", "Estudiantes filtrados", studentRows(data), studentColumns(), "nombres", "asc"); return;
    }
    if(section.id === "carreras"){
      renderBodyShell("Carreras", "Comparativa de carreras incluidas en los filtros actuales.", [tableMount("globalTablaCarreras")]);
      renderSmartTable("globalTablaCarreras", "Carreras", carreraRows(data), [
        { key:"carrera", label:"Carrera" }, { key:"tipo", label:"Tipo" }, { key:"estudiantes", label:"Estudiantes", type:"number" },
        { key:"activos", label:"Activos", type:"number" }, { key:"retirados", label:"Retirados", type:"number" }, { key:"cumplimiento", label:"Cumplimiento", type:"percent", percent:true }
      ], "estudiantes", "desc"); return;
    }
    if(section.id === "requisitos"){
      renderBodyShell("Requisitos", "Cumplimiento por requisito detectado en la base filtrada.", [tableMount("globalTablaRequisitos")]);
      renderSmartTable("globalTablaRequisitos", "Requisitos", requisitoRows(data), [
        { key:"requisito", label:"Requisito" }, { key:"cumple", label:"Cumple", type:"number" }, { key:"pendiente", label:"Pendiente", type:"number" },
        { key:"noCumple", label:"No cumple", type:"number" }, { key:"total", label:"Total", type:"number" }, { key:"cumplimiento", label:"Cumplimiento", type:"percent", percent:true }
      ], "noCumple", "desc"); return;
    }
    if(section.id === "periodos"){
      renderBodyShell("Períodos académicos", "Comparativa de estudiantes, carreras y cumplimiento por período.", [tableMount("globalTablaPeriodos")]);
      renderSmartTable("globalTablaPeriodos", "Períodos", periodoRows(data), periodColumns(), "periodo", "asc"); return;
    }
    if(section.id === "tipo-carrera"){
      renderBodyShell("Tipo de carrera", "Comparativa entre carreras Universitarias y Superiores.", [tableMount("globalTablaTipoCarrera")]);
      renderSmartTable("globalTablaTipoCarrera", "Universitaria vs Superior", tipoRows(data), [
        { key:"tipo", label:"Tipo" }, { key:"estudiantes", label:"Estudiantes", type:"number" }, { key:"carreras", label:"Carreras", type:"number" }, { key:"cumplimiento", label:"Cumplimiento", type:"percent", percent:true }
      ], "tipo", "asc"); return;
    }
    if(section.id === "comparativas"){
      renderBodyShell("Comparativas", "Cruce inicial entre período y tipo de carrera.", [tableMount("globalTablaComparativas")]);
      renderSmartTable("globalTablaComparativas", "Período por tipo de carrera", comparativaRows(data), [
        { key:"periodo", label:"Período" }, { key:"tipo", label:"Tipo" }, { key:"estudiantes", label:"Estudiantes", type:"number" }, { key:"carreras", label:"Carreras", type:"number" }
      ], "periodo", "asc"); return;
    }
    if(section.id === "alertas"){
      renderBodyShell("Alertas", "Datos que requieren revisión institucional según los filtros actuales.", [tableMount("globalTablaAlertas")]);
      renderSmartTable("globalTablaAlertas", "Alertas detectadas", alertaRows(data), [
        { key:"alerta", label:"Tipo de alerta" }, { key:"detalle", label:"Detalle" }, { key:"cantidad", label:"Cantidad / indicador", type:"number" }, { key:"prioridad", label:"Prioridad" }
      ], "cantidad", "desc"); return;
    }
    renderBodyShell("Reportes", "Reportes disponibles para la sección y filtros actuales.", [tableMount("globalTablaReportes")]);
    renderSmartTable("globalTablaReportes", "Reportes disponibles", reportRows(data), [
      { key:"seccion", label:"Sección" }, { key:"reporte", label:"Reporte" }, { key:"estado", label:"Estado" }, { key:"registros", label:"Registros", type:"number" }, { key:"filtros", label:"Filtros" }
    ], "seccion", "asc");
  }

  function render(){
    var section = sectionById(activeSection);
    renderSectionHeader(section);
    setState("Actualizando");
    loadData().then(function(data){
      if(!data){ setState("Sin datos"); renderBodyShell(section.titulo, "No se pudo leer GlobalCore todavía.", [tableMount("globalTablaSinDatos")]); return; }
      renderSectionContent(section, data);
      setState("Datos listos");
      emit("global:rendered", { section:section, filters:currentFilters(), summary:data.resumen, at:new Date().toISOString() });
    }).catch(function(error){
      setState("Error");
      renderBodyShell("Error", error && error.message ? error.message : "No se pudo renderizar la sección.", []);
    });
  }

  function clearFilters(){
    Array.prototype.forEach.call(document.querySelectorAll("[data-global-filter]"), function(input){ input.value = ""; });
    render();
  }

  function generatePdf(){
    var filters = currentFilters();
    var data = lastData;
    if(!data && window.GlobalCore && typeof window.GlobalCore.applyFilters === "function"){
      data = window.GlobalCore.applyFilters(filters);
      lastData = data;
    }
    emit("global:pdf-requested", { section:activeSection, filters:filters, data:data, at:new Date().toISOString() });
    if(window.GlobalPDF && typeof window.GlobalPDF.generate === "function"){
      window.GlobalPDF.generate({ section:activeSection, filters:filters, data:data });
      return;
    }
    window.alert("GlobalPDF no está disponible. Revisa que global.pdf.js esté cargado.");
  }

  function bind(){
    var menu = $("#globalMenu");
    var btnLimpiar = $("#globalBtnLimpiar");
    var btnActualizar = $("#globalBtnActualizar");
    var btnPdf = $("#globalBtnPdf");

    if(menu){
      menu.addEventListener("click", function(event){
        var btn = event.target.closest("button[data-global-section]");
        if(!btn){ return; }
        activeSection = btn.getAttribute("data-global-section") || "resumen";
        render();
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-global-filter]"), function(input){ input.addEventListener("change", render); });
    if(btnLimpiar){ btnLimpiar.addEventListener("click", clearFilters); }
    if(btnActualizar){
      btnActualizar.addEventListener("click", function(){
        if(window.GlobalCore && typeof window.GlobalCore.refresh === "function"){
          setState("Actualizando BDLocal");
          window.GlobalCore.refresh({ force:true }).then(function(){ render(); });
        }else{ render(); }
      });
    }
    if(btnPdf){ btnPdf.addEventListener("click", generatePdf); }
  }

  function boot(){
    if(booted){ return; }
    booted = true;
    renderMenu();
    bind();
    render();
  }

  window.GlobalApp = {
    version:VERSION,
    boot:boot,
    render:render,
    generatePdf:generatePdf,
    getActiveSection:function(){ return activeSection; },
    setActiveSection:function(id){ activeSection = id || "resumen"; render(); },
    getFilters:currentFilters,
    getLastData:function(){ return lastData; },
    hydrateFilters:hydrateFilters
  };
})(window, document);

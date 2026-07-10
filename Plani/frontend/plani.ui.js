/* =========================================================
Nombre completo: plani.ui.js
Ruta o ubicación: /Requisitos/Plani/frontend/plani.ui.js
Función o funciones:
- Centralizar renderizados visuales de la pantalla Plani.
- Actualizar estado, chips, flujo, resumen, vista previa y diagnóstico.
- Evitar que plani.app.js manipule HTML directamente en exceso.
Con qué se conecta:
- plani.html
- plani.css
- ../core/plani.constants.js
- plani.app.js
- plani.events.js
========================================================= */
(function(window, document){
  "use strict";

  function constants(){return window.PlaniConstants || null;}
  function el(id){return document.getElementById(id);}
  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}

  function status(message, cls){
    var box = el("plani-status");
    if(!box){return;}
    box.textContent = message || "";
    box.className = "plani-status " + (cls || "");
  }

  function setChip(id, label, cls){
    var node = el(id);
    if(!node){return;}
    node.textContent = label || "—";
    node.className = "plani-chip " + (cls || "");
  }

  function option(value, label, selected){
    return '<option value="' + esc(value) + '" ' + (selected ? 'selected' : '') + '>' + esc(label) + '</option>';
  }

  function fillDocumentTypes(current){
    var select = el("plani-document-type");
    var cfg = constants();
    if(!select || !cfg){return;}
    var list = cfg.DOCUMENT_TYPES || [];
    select.innerHTML = option("", "Selecciona un tipo", !current) + list.map(function(item){
      return option(item.id, item.label, current === item.id);
    }).join("");
  }

  function renderFlow(state){
    var box = el("plani-flow");
    var cfg = constants();
    if(!box || !cfg){return;}
    state = state || {};
    var hasPeriod = !!text(state.periodId || state.periodLabel);
    var hasInsumos = !!text(state.cronogramaRaw);
    var hasDocument = !!text(state.documentType);
    var map = {
      periodo:{done:hasPeriod, active:!hasPeriod},
      insumos:{done:hasInsumos, active:hasPeriod && !hasInsumos},
      documento:{done:state.previewReady, active:hasDocument && hasInsumos}
    };
    box.innerHTML = (cfg.FLOW_STEPS || []).map(function(step, index){
      var item = map[step.id] || {};
      var cls = item.done ? " is-done" : (item.active ? " is-active" : "");
      return '<article class="plani-step' + cls + '"><span>' + (index + 1) + '</span><div><strong>' + esc(step.label) + '</strong><small>' + esc(step.help) + '</small></div></article>';
    }).join("");
  }

  function renderSummary(state){
    state = state || {};
    var cfg = constants();
    var doc = cfg && cfg.documentTypeById ? cfg.documentTypeById(state.documentType) : null;
    setChip("plani-period-chip", text(state.periodLabel || state.periodId) ? "Período seleccionado" : "Sin período", text(state.periodLabel || state.periodId) ? "ok" : "warn");
    setChip("plani-cronograma-chip", text(state.cronogramaRaw) ? "Cronograma cargado" : "Sin cronograma", text(state.cronogramaRaw) ? "ok" : "warn");
    setChip("plani-preview-chip", state.previewReady ? "Vista base lista" : "Sin vista previa", state.previewReady ? "ok" : "warn");
    if(el("plani-period-type-label")){el("plani-period-type-label").textContent = state.periodType && state.periodType.label ? state.periodType.label : "—";}
    if(el("plani-document-label")){el("plani-document-label").textContent = doc ? doc.label : "—";}
    if(el("plani-document-code")){el("plani-document-code").textContent = doc ? doc.codePrefix : "—";}
  }

  function previewRows(raw){
    var cfg = constants();
    var max = cfg && cfg.LIMITS ? cfg.LIMITS.cronogramaPreviewRows : 12;
    return text(raw).split(/\r?\n/).map(text).filter(Boolean).slice(0, max);
  }

  function renderCronogramaPreview(state){
    var box = el("plani-preview");
    if(!box){return;}
    state = state || {};
    var cfg = constants();
    var doc = cfg && cfg.documentTypeById ? cfg.documentTypeById(state.documentType) : null;
    var rows = previewRows(state.cronogramaRaw);
    if(!doc && !rows.length){
      box.innerHTML = '<div class="plani-empty">Selecciona un tipo de planificación y agrega un cronograma.</div>';
      return;
    }
    var html = '<div class="plani-table-wrap"><table class="plani-small-table"><thead><tr><th>Elemento</th><th>Valor</th></tr></thead><tbody>';
    html += '<tr><td>Documento</td><td>' + esc(doc ? doc.title : 'Pendiente') + '</td></tr>';
    html += '<tr><td>Período</td><td>' + esc(state.periodLabel || state.periodId || 'Pendiente') + '</td></tr>';
    html += '<tr><td>Archivo cronograma</td><td>' + esc(state.cronogramaFileName || 'Pegado manual / pendiente') + '</td></tr>';
    html += '<tr><td>Líneas detectadas</td><td>' + esc(rows.length) + '</td></tr>';
    html += '</tbody></table></div>';
    if(rows.length){
      html += '<div class="plani-table-wrap" style="margin-top:12px"><table class="plani-small-table"><thead><tr><th>#</th><th>Vista previa del cronograma</th></tr></thead><tbody>';
      html += rows.map(function(row, index){return '<tr><td>' + (index + 1) + '</td><td>' + esc(row) + '</td></tr>';}).join("");
      html += '</tbody></table></div>';
    }
    box.innerHTML = html;
  }

  function renderDiagnostics(state){
    var node = el("plani-diagnostics");
    var cfg = constants();
    if(!node){return;}
    node.textContent = JSON.stringify({
      module: cfg ? cfg.MODULE : null,
      generatedAt: new Date().toISOString(),
      state: state || {}
    }, null, 2);
  }

  function setExportButtons(enabled){
    var w = el("plani-export-word");
    var p = el("plani-export-pdf");
    if(w){w.disabled = !enabled;}
    if(p){p.disabled = !enabled;}
  }

  function renderAll(state, message, cls){
    renderFlow(state);
    renderSummary(state);
    renderCronogramaPreview(state);
    renderDiagnostics(state);
    setExportButtons(!!(state && state.exportReady));
    if(message){status(message, cls || "ok");}
  }

  window.PlaniUI = {
    el: el,
    text: text,
    esc: esc,
    status: status,
    setChip: setChip,
    fillDocumentTypes: fillDocumentTypes,
    renderFlow: renderFlow,
    renderSummary: renderSummary,
    renderCronogramaPreview: renderCronogramaPreview,
    renderDiagnostics: renderDiagnostics,
    setExportButtons: setExportButtons,
    renderAll: renderAll
  };
})(window, document);

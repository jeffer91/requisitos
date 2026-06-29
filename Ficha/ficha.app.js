/* =========================================================
Nombre completo: ficha.app.js
Ruta o ubicación: /Requisitos/Ficha/ficha.app.js
Función o funciones:
- Renderizar lista y ficha individual de estudiantes.
- Manejar búsqueda, selección y copia de datos.
- Filtrar por período, división y matrícula.
- Mostrar ACTIVO por defecto.
- Pintar aprobaciones especiales y abrir Telegram con mensaje copiado.
- Renderizar notas finales Nart, Ndef y Nfin.
- Mostrar encabezado en filas: cédula, carrera y período normalizado.
- Renderizar y guardar modalidadTitulacion para Infor.
- Evitar construcción pesada duplicada al abrir la pantalla.
Con qué se conecta:
- ficha.core.js
- ficha.export.js
- ficha.modalidad.js
========================================================= */
(function(window, document){
  "use strict";

  var state = {periodId:"", division:"", matricula:"ACTIVO", search:"", rows:[], selectedId:"", renderTimer:null, divisionKey:"", divisionOptions:[], listBound:false};

  function el(id){return document.getElementById(id);}
  function text(v){return String(v == null ? "" : v).trim();}
  function esc(v){return text(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function setText(id, value){var node = el(id);if(node){node.textContent = value || "—";}}
  function status(msg, cls){var s = el("ficha-status");if(s){s.textContent = msg;s.className = "ficha-status " + (cls || "");}}
  function option(value, label, selected){return '<option value="' + esc(value) + '" ' + (selected ? 'selected' : '') + '>' + esc(label) + '</option>';}
  function bindIf(id, eventName, handler){var node = el(id);if(node){node.addEventListener(eventName, handler);}}
  function copyText(value, successMessage){return window.FichaExport.copyText(value || "").then(function(){status(successMessage || "Copiado.", "ok");});}
  function selectedFromRows(){var wanted = text(state.selectedId);return state.rows.find(function(row){return text(row._id) === wanted;}) || null;}
  function scheduleRender(reason){if(state.renderTimer){clearTimeout(state.renderTimer);}state.renderTimer = setTimeout(function(){state.renderTimer = null;render(reason || "programado");}, 260);}
  function sourceLabel(){return window.FichaCore && typeof window.FichaCore.source === "function" ? window.FichaCore.source() : "Base Local";}

  function periodDisplay(row){
    row = row || {};
    var raw = text(row._periodoNormalizado || row._periodo || row.periodoLabel || row.periodoId || row.ultimoPeriodoId || row.periodo || row.Periodo);
    if(!raw){return "Sin período";}
    try{if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.normalizePeriod === "function"){var normalized = window.BLPeriodosCanon.normalizePeriod({id:raw, periodoId:raw, label:raw, periodoLabel:raw});return text(normalized.label || normalized.periodoLabel || raw) || raw;}}catch(error){}
    return raw;
  }

  function fillPeriodAndMatricula(){
    var sel = el("ficha-periodo"), mat = el("ficha-matricula");
    if(sel){var list = window.FichaCore.periods();sel.innerHTML = option("", "Todos", !state.periodId) + list.map(function(p){return option(p.id, p.label || p.periodoLabel || p.id, state.periodId === p.id);}).join("");}
    if(mat){mat.value = state.matricula;}
  }

  function getDivisionOptions(){var key = [state.periodId, state.matricula, sourceLabel()].join("|");if(state.divisionKey === key && Array.isArray(state.divisionOptions)){return state.divisionOptions;}state.divisionOptions = window.FichaCore.divisions(null, {periodId:state.periodId, matricula:state.matricula});state.divisionKey = key;return state.divisionOptions;}
  function fillDivisionFilter(){var div = el("ficha-division");if(!div){return;}var divisions = getDivisionOptions();div.innerHTML = option("", "Todas", !state.division) + divisions.map(function(x){return option(x, x, state.division === x);}).join("");if(state.division && !divisions.some(function(x){return x === state.division;})){state.division = "";div.value = "";}else{div.value = state.division;}}
  function fillFilters(){fillPeriodAndMatricula();fillDivisionFilter();}
  function invalidateDivisionOptions(){state.divisionKey = "";state.divisionOptions = [];}
  function estadoClass(e){return e && e.id === "cumple" ? "ficha-pill-ok" : e && e.id === "no_cumple" ? "ficha-pill-bad" : "ficha-pill-warn";}

  function bindListOnce(){var box = el("ficha-list");if(!box || state.listBound){return;}box.addEventListener("click", function(event){var btn = event.target.closest ? event.target.closest("[data-id]") : null;if(btn){select(btn.getAttribute("data-id"));}});state.listBound = true;}
  function renderList(){var box = el("ficha-list");if(el("ficha-count")){el("ficha-count").textContent = String(state.rows.length);}if(!box){return;}bindListOnce();if(!state.rows.length){box.innerHTML = '<div class="empty-list">Sin estudiantes. Primero carga un Excel en Carga o cambia los filtros.</div>';return;}box.innerHTML = state.rows.slice(0, 400).map(function(s){var active = s._id === state.selectedId ? ' is-active' : '';return '<button type="button" class="ficha-item' + active + '" data-id="' + esc(s._id) + '"><strong>' + esc(s._nombres || 'Sin nombre') + '</strong><span>' + esc(s._cedula) + ' · ' + esc(s._carrera) + ' · ' + esc(s._division || 'Sin división') + ' · ' + esc(s._estadoMatricula) + '</span></button>';}).join('');}

  function reqClass(r){return r.estado === "cumple" ? "ficha-pill-ok" : "ficha-pill-bad";}
  function renderReqs(row){var box = el("ficha-requisitos");if(!box){return;}var reqs = window.FichaCore.requisitos(row);box.innerHTML = reqs.map(function(r){return '<div class="ficha-req"><span class="ficha-req-name">' + esc(r.label) + '</span><span class="ficha-req-value ' + reqClass(r) + '">' + esc(r.estado === "cumple" ? "CUMPLE" : "NO CUMPLE") + '</span></div>';}).join('');}
  function renderNotas(row){var box = el("ficha-notas");if(!box){return;}var notas = window.FichaCore.notas ? window.FichaCore.notas(row) : [];box.innerHTML = notas.map(function(n){var ok = n.estado === "cumple";return '<article class="ficha-note ' + (ok ? 'ficha-note-ok' : 'ficha-note-bad') + '"><span>' + esc(n.label) + '</span><strong>' + esc(n.value) + '</strong></article>';}).join('');}
  function applySpecialBadge(id, item){var node = el(id);if(!node || !item){return;}var ok = item.estado === "cumple";node.className = "ficha-mini-badge " + (ok ? "ficha-badge-ok" : "ficha-badge-bad");node.title = item.label + ": " + (ok ? "CUMPLE" : "NO CUMPLE");node.setAttribute("aria-label", node.title);}
  function renderSpecials(row){var list = window.FichaCore.especiales ? window.FichaCore.especiales(row) : [];var titulacion = list.find(function(x){return x.key === "aprobaciontitulacion";});var complexivo = list.find(function(x){return x.key === "aprobacioncomplexivoproyecto";});applySpecialBadge("ficha-special-titulacion", titulacion);applySpecialBadge("ficha-special-complexivo", complexivo);}

  function headerLine(label, value){return '<div class="ficha-identity-row"><span>' + esc(label) + '</span><strong>' + esc(value || '—') + '</strong></div>';}
  function renderHeaderIdentity(row){var box = el("ficha-identidad");if(!box){return;}box.innerHTML = [headerLine("Cédula", row._cedula || "—"),headerLine("Carrera", row._carrera || "Sin carrera"),headerLine("Período", periodDisplay(row))].join("");}

  function renderModalidad(row){
    var select = el("ficha-modalidad-select"), infoBox = el("ficha-modalidad-info"), btn = el("ficha-modalidad-save");
    if(!select || !window.FichaModalidad){return;}
    var info = window.FichaModalidad.current(row || {});
    var opts = window.FichaModalidad.options(row || {});
    select.innerHTML = opts.map(function(o){return option(o.value, o.label, o.value === info.value);}).join("");
    select.value = info.value;
    select.disabled = !!info.locked;
    if(btn){btn.disabled = !!info.locked;btn.textContent = info.locked ? "Modalidad fija" : "Guardar modalidad";}
    if(infoBox){infoBox.textContent = (info.periodType.label || "—") + " · " + info.label + " · " + (info.source === "guardado" ? "guardado" : "automático");infoBox.className = "ficha-modalidad-info " + (info.locked ? "locked" : "");}
  }

  function renderDetail(row){
    if(!row){if(el("ficha-empty")){el("ficha-empty").classList.remove("is-hidden");}if(el("ficha-detail")){el("ficha-detail").classList.add("is-hidden");}return;}
    if(el("ficha-empty")){el("ficha-empty").classList.add("is-hidden");}if(el("ficha-detail")){el("ficha-detail").classList.remove("is-hidden");}
    setText("ficha-nombre", row._nombres || "Sin nombre");renderHeaderIdentity(row);
    var estado = el("ficha-estado");if(estado){estado.textContent = row._estado && row._estado.label ? row._estado.label : "Pendiente";estado.className = "ficha-pill " + estadoClass(row._estado);}
    setText("ficha-division-label", row._division || "Sin división");setText("ficha-matricula-label", row._estadoMatricula || "ACTIVO");setText("ficha-sede", row._sede || "—");setText("ficha-horario", row._horario || "—");setText("ficha-correo", row._correo || "—");setText("ficha-celular", row._celular || "—");
    var w = window.FichaCore.whatsappUrl(row);var wa = el("ficha-whatsapp");if(wa){wa.href = w || "#";wa.classList.toggle("is-disabled", !w);wa.title = w ? "Enviar mensaje por WhatsApp" : "Celular no registrado";}
    var tg = el("ficha-telegram");var tgUrl = window.FichaCore.telegramUrl ? window.FichaCore.telegramUrl(row) : "";if(tg){tg.href = tgUrl || "#";tg.classList.toggle("is-disabled", !tgUrl);tg.title = tgUrl ? "Copiar mensaje y abrir Telegram" : "Telegram no registrado";}
    renderModalidad(row);renderSpecials(row);renderReqs(row);renderNotas(row);
  }

  function select(id){state.selectedId = id || "";renderList();renderDetail(selectedFromRows());}
  function render(reason){try{fillFilters();state.rows = window.FichaCore.filter({periodId:state.periodId, division:state.division, matricula:state.matricula, search:state.search, limit:400});if(!state.rows.some(function(x){return x._id === state.selectedId;})){state.selectedId = state.rows[0] ? state.rows[0]._id : "";}renderList();renderDetail(selectedFromRows());status("Ficha cargada por " + sourceLabel() + ". Matrícula: " + (state.matricula || "Todos") + ". División: " + (state.division || "Todas") + ". Resultados: " + state.rows.length + ".", "ok");}catch(e){console.error("[Ficha]", e);status(e.message || String(e), "warn");}}

  function saveModalidad(){
    var row = selectedFromRows();var select = el("ficha-modalidad-select");
    if(!row || !select || !window.FichaModalidad){return;}
    try{var saved = window.FichaModalidad.save(row, select.value);status("Modalidad guardada: " + saved.label + ".", "ok");invalidateDivisionOptions();render("modalidad");}
    catch(error){console.error("[Ficha modalidad]", error);status(error.message || String(error), "warn");}
  }

  function bind(){
    bindIf("ficha-periodo", "change", function(e){state.periodId = e.target.value;state.division = "";state.selectedId = "";invalidateDivisionOptions();render("periodo");});
    bindIf("ficha-division", "change", function(e){state.division = e.target.value;state.selectedId = "";render("division");});
    bindIf("ficha-matricula", "change", function(e){state.matricula = e.target.value;state.division = "";state.selectedId = "";invalidateDivisionOptions();if(window.FichaCore && typeof window.FichaCore.invalidate === "function"){window.FichaCore.invalidate();}render("matricula");});
    bindIf("ficha-search", "input", function(e){state.search = e.target.value;scheduleRender("search");});
    bindIf("ficha-btn-refresh", "click", function(){invalidateDivisionOptions();if(window.FichaCore && typeof window.FichaCore.invalidate === "function"){window.FichaCore.invalidate();}render("refresh");});
    bindIf("ficha-btn-copy", "click", function(){var row = selectedFromRows();if(!row){return;}copyText(window.FichaCore.toText(row), "Ficha copiada.");});
    bindIf("ficha-copy-detail", "click", function(){var row = selectedFromRows();if(!row){return;}copyText(window.FichaCore.toText(row), "Ficha copiada.");});
    bindIf("ficha-modalidad-save", "click", saveModalidad);
    bindIf("ficha-telegram", "click", function(e){var row = selectedFromRows();if(!row){return;}var url = window.FichaCore.telegramUrl ? window.FichaCore.telegramUrl(row) : "";if(!url){e.preventDefault();status("Telegram no registrado.", "warn");return;}e.preventDefault();copyText(window.FichaCore.studentMessage(row), "Mensaje copiado para Telegram.").then(function(){window.open(url, "_blank", "noopener");});});
    bindIf("ficha-copy-cedula", "click", function(){var row = selectedFromRows();if(row){copyText(row._cedula, "Cédula copiada.");}});
    bindIf("ficha-copy-correo", "click", function(){var row = selectedFromRows();if(row){copyText(row._correo, "Correo copiado.");}});
  }

  function boot(){if(window.BL2 && typeof window.BL2.status === "function"){window.BL2.status({deep:false});}bind();render("boot");}
  if(document.readyState === "loading"){document.addEventListener("DOMContentLoaded", boot);}else{boot();}
  window.FichaApp = {render:render, scheduleRender:scheduleRender, getState:function(){return Object.assign({}, state);}};
})(window, document);

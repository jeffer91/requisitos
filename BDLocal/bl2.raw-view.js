/* =========================================================
Archivo: bl2.raw-view.js
Ruta: /BDLocal/bl2.raw-view.js
Función:
- Visualizador bruto de BDLocal / IndexedDB.
- Permite revisar tablas reales sin modificar datos.
- Muestra conteo, muestra limitada, búsqueda simple y JSON técnico.
- Sirve para verificar DB_VERSION 2: personas, matriculas_periodo, notas_titulacion, cambios_pendientes, etc.
Con qué se conecta:
- BL2DB
- BL2Config.stores
- BDLocal/bl2.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.1.0-block26";
  var state = { rows:[], store:"", limit:50, search:"" };

  function byId(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function db(){ return window.BL2DB || null; }
  function stores(){ return window.BL2Config && window.BL2Config.stores ? window.BL2Config.stores : {}; }

  function unique(list){
    var map = Object.create(null);
    (list || []).forEach(function(item){ item = text(item); if(item){ map[item] = true; } });
    return Object.keys(map).sort(function(a,b){ return a.localeCompare(b, "es"); });
  }

  function storeNames(){
    var s = stores();
    var configured = Object.keys(s || {}).map(function(key){ return s[key]; });
    var expected = [
      "periodos",
      "estudiantes",
      "personas",
      "matriculas_periodo",
      "requisitos",
      "requisitos_estudiante",
      "notas",
      "notas_titulacion",
      "contactos",
      "contactos_estudiante",
      "divisiones_estudiante",
      "periodos_carreras",
      "periodos_divisiones",
      "cambios",
      "cambios_pendientes",
      "sync_estado",
      "errores_validacion",
      "logs",
      "backups",
      "importaciones"
    ];
    return unique(configured.concat(expected));
  }

  function ensurePanel(){
    if(byId("bl2-raw-view-card")){ return byId("bl2-raw-view-card"); }
    var main = document.querySelector(".bl2-main") || document.body;
    var section = document.createElement("section");
    section.id = "bl2-raw-view-card";
    section.className = "bl2-card";
    section.innerHTML = [
      '<div class="bl2-card-head bl2-card-head-row">',
      '  <div><h2>Visualizador bruto BDLocal</h2><p>Consulta tablas reales de IndexedDB sin editar ni borrar datos.</p></div>',
      '  <button id="bl2-raw-refresh" class="bl2-btn bl2-btn-light" type="button">Refrescar tabla</button>',
      '</div>',
      '<div class="bl2-grid bl2-grid-controls">',
      '  <label class="bl2-field"><span>Tabla</span><select id="bl2-raw-store"></select></label>',
      '  <label class="bl2-field"><span>Límite</span><select id="bl2-raw-limit"><option value="25">25</option><option value="50" selected>50</option><option value="100">100</option><option value="250">250</option></select></label>',
      '  <label class="bl2-field"><span>Buscar</span><input id="bl2-raw-search" type="search" placeholder="Texto dentro del JSON..." /></label>',
      '</div>',
      '<div class="bl2-actions">',
      '  <button id="bl2-raw-copy" class="bl2-btn bl2-btn-light" type="button">Copiar JSON visible</button>',
      '  <button id="bl2-raw-download" class="bl2-btn bl2-btn-light" type="button">Descargar JSON visible</button>',
      '</div>',
      '<div id="bl2-raw-summary" class="bl2-summary"><div class="bl2-empty">Selecciona una tabla para revisar.</div></div>',
      '<pre id="bl2-raw-json" style="max-height:420px;overflow:auto;background:#0f172a;color:#e5e7eb;border-radius:14px;padding:14px;font-size:12px;line-height:1.45;">[]</pre>'
    ].join("");
    main.appendChild(section);
    return section;
  }

  function paintStores(){
    var select = byId("bl2-raw-store");
    if(!select){ return; }
    var previous = select.value || state.store;
    var names = storeNames();
    select.innerHTML = names.map(function(name){ return '<option value="'+esc(name)+'">'+esc(name)+'</option>'; }).join("");
    if(previous && names.indexOf(previous) >= 0){ select.value = previous; }
    else if(names.indexOf("cambios_pendientes") >= 0){ select.value = "cambios_pendientes"; }
    else if(names.length){ select.value = names[0]; }
    state.store = select.value;
  }

  function readStore(name){
    var current = db();
    name = text(name);
    if(!current){ return Promise.reject(new Error("BL2DB no disponible.")); }
    if(!name){ return Promise.reject(new Error("Seleccione una tabla.")); }
    if(typeof current.getAll === "function"){
      return current.getAll(name).then(function(rows){ return Array.isArray(rows) ? rows : []; });
    }
    return Promise.reject(new Error("BL2DB.getAll no disponible."));
  }

  function filterRows(rows){
    var q = text(state.search).toLowerCase();
    rows = Array.isArray(rows) ? rows : [];
    if(!q){ return rows; }
    return rows.filter(function(row){
      try{ return JSON.stringify(row).toLowerCase().indexOf(q) >= 0; }catch(error){ return false; }
    });
  }

  function previewRows(rows){
    var limit = Number(state.limit || 50);
    if(!Number.isFinite(limit) || limit <= 0){ limit = 50; }
    return rows.slice(0, limit);
  }

  function keysSummary(rows){
    var map = Object.create(null);
    rows.slice(0, 50).forEach(function(row){ Object.keys(row || {}).forEach(function(key){ map[key] = true; }); });
    return Object.keys(map).sort();
  }

  function render(storeName, allRows){
    allRows = Array.isArray(allRows) ? allRows : [];
    var filtered = filterRows(allRows);
    var visible = previewRows(filtered);
    state.rows = visible;

    var summary = byId("bl2-raw-summary");
    var json = byId("bl2-raw-json");
    var keys = keysSummary(filtered);
    if(summary){
      summary.innerHTML = [
        '<div class="bl2-log-item"><strong>Tabla</strong><span>'+esc(storeName)+'</span></div>',
        '<div class="bl2-log-item"><strong>Total</strong><span>'+esc(allRows.length)+' registro(s)</span></div>',
        '<div class="bl2-log-item"><strong>Filtrados</strong><span>'+esc(filtered.length)+' registro(s)</span></div>',
        '<div class="bl2-log-item"><strong>Visible</strong><span>'+esc(visible.length)+' registro(s)</span></div>',
        '<div class="bl2-log-item"><strong>Campos detectados</strong><span>'+esc(keys.join(", ") || "—")+'</span></div>'
      ].join("");
    }
    if(json){ json.textContent = JSON.stringify(visible, null, 2); }
  }

  function refresh(){
    ensurePanel();
    paintStores();
    state.store = byId("bl2-raw-store") ? byId("bl2-raw-store").value : state.store;
    state.limit = byId("bl2-raw-limit") ? Number(byId("bl2-raw-limit").value || 50) : state.limit;
    state.search = byId("bl2-raw-search") ? byId("bl2-raw-search").value : state.search;
    var summary = byId("bl2-raw-summary");
    if(summary){ summary.innerHTML = '<div class="bl2-empty">Leyendo '+esc(state.store)+'...</div>'; }
    return readStore(state.store).then(function(rows){ render(state.store, rows); return rows; }).catch(function(error){
      render(state.store, []);
      if(summary){ summary.innerHTML = '<div class="bl2-empty">No se pudo leer '+esc(state.store)+': '+esc(error.message || String(error))+'</div>'; }
      return [];
    });
  }

  function copyVisible(){
    var raw = JSON.stringify(state.rows || [], null, 2);
    if(navigator.clipboard && navigator.clipboard.writeText){ return navigator.clipboard.writeText(raw); }
    var tmp = document.createElement("textarea");
    tmp.value = raw;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand("copy");
    tmp.remove();
    return Promise.resolve();
  }

  function downloadVisible(){
    var raw = JSON.stringify(state.rows || [], null, 2);
    var blob = new Blob([raw], { type:"application/json;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bdlocal_" + text(state.store || "tabla") + "_visible.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function bind(){
    ensurePanel();
    paintStores();
    var refreshBtn = byId("bl2-raw-refresh");
    var copyBtn = byId("bl2-raw-copy");
    var downloadBtn = byId("bl2-raw-download");
    var storeSelect = byId("bl2-raw-store");
    var limitSelect = byId("bl2-raw-limit");
    var searchInput = byId("bl2-raw-search");

    if(refreshBtn && !refreshBtn.__rawBound){ refreshBtn.__rawBound = true; refreshBtn.addEventListener("click", refresh); }
    if(copyBtn && !copyBtn.__rawBound){ copyBtn.__rawBound = true; copyBtn.addEventListener("click", function(){ copyVisible(); }); }
    if(downloadBtn && !downloadBtn.__rawBound){ downloadBtn.__rawBound = true; downloadBtn.addEventListener("click", downloadVisible); }
    if(storeSelect && !storeSelect.__rawBound){ storeSelect.__rawBound = true; storeSelect.addEventListener("change", refresh); }
    if(limitSelect && !limitSelect.__rawBound){ limitSelect.__rawBound = true; limitSelect.addEventListener("change", refresh); }
    if(searchInput && !searchInput.__rawBound){ searchInput.__rawBound = true; searchInput.addEventListener("input", function(){ clearTimeout(searchInput.__rawTimer); searchInput.__rawTimer = setTimeout(refresh, 300); }); }

    setTimeout(refresh, 800);
  }

  window.BL2RawView = { version:VERSION, bind:bind, refresh:refresh, readStore:readStore, getState:function(){ return Object.assign({}, state); } };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(window, document);

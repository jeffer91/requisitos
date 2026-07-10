/* =========================================================
Nombre completo: bl2.raw-view.js
Ruta o ubicación: /BDLocal/bl2.raw-view.js
Función o funciones:
- Visualizar las tablas físicas de IndexedDB en modo solo lectura.
- Montarse dentro de la sección Tablas.
- Buscar, filtrar, paginar y exportar los registros visibles.
- Respetar el período activo cuando el registro contiene periodoId.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.2.0-control-center";
  var GROUPS = [
    { label:"V2 principales", stores:["periodos_carreras","periodos_divisiones","personas","matriculas_periodo","requisitos_estudiante","notas_titulacion","contactos_estudiante","divisiones_estudiante","importaciones"] },
    { label:"Operativas", stores:["cambios_pendientes","sync_estado","errores_validacion","cache_views"] },
    { label:"General y sistema", stores:["settings","periodos","logs","backups"] },
    { label:"Legacy", stores:["estudiantes","requisitos","contactos","notas","cambios"] }
  ];

  var state = {
    container:null,
    mounted:false,
    store:"",
    rows:[],
    filtered:[],
    visible:[],
    page:1,
    pageSize:25,
    periodId:"",
    metadata:null,
    catalog:[]
  };

  function byId(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value, fallback){ value = Number(value); return Number.isFinite(value) ? value : (fallback || 0); }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function db(){ return window.BL2DB || null; }

  function unique(list){
    var seen = Object.create(null);
    return (list || []).filter(function(item){ item = text(item); if(!item || seen[item]){ return false; } seen[item] = true; return true; });
  }

  function physicalStores(){
    var current = db();
    var meta = current && typeof current.meta === "function" ? current.meta() : {};
    var actual = Array.isArray(meta.stores) ? meta.stores : [];
    var configured = window.BL2Config && window.BL2Config.stores
      ? Object.keys(window.BL2Config.stores).map(function(key){ return window.BL2Config.stores[key]; })
      : [];
    return unique(actual.length ? actual : configured);
  }

  function groupedStores(){
    var actual = physicalStores();
    var used = Object.create(null);
    var groups = GROUPS.map(function(group){
      var stores = group.stores.filter(function(name){ return actual.indexOf(name) >= 0; });
      stores.forEach(function(name){ used[name] = true; });
      return { label:group.label, stores:stores };
    }).filter(function(group){ return group.stores.length; });
    var other = actual.filter(function(name){ return !used[name]; }).sort();
    if(other.length){ groups.push({ label:"Otras detectadas", stores:other }); }
    return groups;
  }

  function groupLabel(name){
    var label = "Otras detectadas";
    GROUPS.some(function(group){ if(group.stores.indexOf(name) >= 0){ label = group.label; return true; } return false; });
    return label;
  }

  function activePeriod(){
    if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
      var period = window.BL2App.getSelectedPeriod();
      if(period && text(period.id)){ return text(period.id); }
    }
    return text((byId("bl2-period-select") || {}).value);
  }

  function template(){
    return ''
      + '<div class="bdlc-card"><div class="bdlc-header"><div><h3>Explorador de IndexedDB</h3><p>Consulta de solo lectura. No edita ni elimina datos.</p></div><span class="bdlc-status ok">Solo lectura</span></div>'
      + '<div class="bdlc-form">'
      + '<div class="bdlc-field"><label class="bdlc-label">Tabla</label><select id="bl2-raw-store" class="bdlc-select"></select></div>'
      + '<div class="bdlc-field"><label class="bdlc-label">Registros por página</label><select id="bl2-raw-limit" class="bdlc-select"><option>25</option><option>50</option><option>100</option></select></div>'
      + '<div class="bdlc-field"><label class="bdlc-label">Identificación o clave</label><input id="bl2-raw-id" class="bdlc-input" type="search" placeholder="ID o cédula"></div>'
      + '<div class="bdlc-field"><label class="bdlc-label">Estado</label><input id="bl2-raw-status" class="bdlc-input" type="search" placeholder="ACTIVO, PENDIENTE..."></div>'
      + '<div class="bdlc-field full"><label class="bdlc-label">Búsqueda general</label><input id="bl2-raw-search" class="bdlc-input" type="search" placeholder="Texto dentro del registro"></div>'
      + '</div><div class="bdlc-actions">'
      + '<button id="bl2-raw-refresh" class="bdlc-button" type="button">Refrescar</button>'
      + '<button id="bl2-raw-copy" class="bdlc-button secondary" type="button">Copiar JSON visible</button>'
      + '<button id="bl2-raw-json-export" class="bdlc-button secondary" type="button">Exportar JSON</button>'
      + '<button id="bl2-raw-csv-export" class="bdlc-button secondary" type="button">Exportar para Excel</button>'
      + '</div></div>'
      + '<div class="bdlc-card-grid two">'
      + '<article class="bdlc-card"><h3>Metadatos</h3><div id="bl2-raw-summary" class="bdlc-placeholder"><strong>Sin tabla</strong><span>Seleccione una tabla.</span></div></article>'
      + '<article class="bdlc-card"><h3>Catálogo físico</h3><div id="bl2-raw-catalog" class="bdlc-placeholder"><strong>Leyendo tablas</strong><span>Consultando conteos.</span></div></article>'
      + '</div>'
      + '<div class="bdlc-card"><div class="bdlc-header"><div><h3>Registros</h3><p id="bl2-raw-page-label">Página 1</p></div><div class="bdlc-actions"><button id="bl2-raw-prev" class="bdlc-button secondary" type="button">Anterior</button><button id="bl2-raw-next" class="bdlc-button secondary" type="button">Siguiente</button></div></div><div id="bl2-raw-table" class="bdlc-empty">Sin datos cargados.</div></div>'
      + '<div class="bdlc-card"><div class="bdlc-header"><div><h3>Detalle del registro</h3><p>Seleccione una fila.</p></div><button id="bl2-raw-detail-copy" class="bdlc-button secondary" type="button">Copiar detalle</button></div><pre id="bl2-raw-detail" class="bdlc-raw-output">{}</pre></div>';
  }

  function mount(container, options){
    options = options || {};
    if(typeof container === "string"){ container = document.querySelector(container); }
    container = container || byId("bl2-tables-slot");
    if(!container){ return Promise.resolve(null); }
    state.container = container;
    state.periodId = text(options.periodoId || activePeriod());
    if(!state.mounted || container.getAttribute("data-raw-mounted") !== "true"){
      container.className = "";
      container.innerHTML = template();
      container.setAttribute("data-raw-mounted","true");
      state.mounted = true;
      paintStores();
      bindControls();
    }
    return refreshCatalog().then(refresh);
  }

  function paintStores(){
    var select = byId("bl2-raw-store");
    if(!select){ return; }
    var previous = text(select.value || state.store);
    var groups = groupedStores();
    select.innerHTML = groups.map(function(group){
      return '<optgroup label="' + esc(group.label) + '">' + group.stores.map(function(name){ return '<option value="' + esc(name) + '">' + esc(name) + '</option>'; }).join("") + '</optgroup>';
    }).join("");
    var all = groups.reduce(function(result, group){ return result.concat(group.stores); },[]);
    select.value = previous && all.indexOf(previous) >= 0 ? previous : (all.indexOf("personas") >= 0 ? "personas" : all[0] || "");
    state.store = select.value;
  }

  function inspect(name){
    var current = db();
    if(!current || typeof current.open !== "function"){ return Promise.resolve({ keyPath:"—", indexes:[] }); }
    return current.open().then(function(nativeDb){
      var tx = nativeDb.transaction([name],"readonly");
      var store = tx.objectStore(name);
      var key = Array.isArray(store.keyPath) ? store.keyPath.join(" + ") : text(store.keyPath || "Sin clave declarada");
      return { keyPath:key, indexes:Array.prototype.slice.call(store.indexNames || []) };
    }).catch(function(){ return { keyPath:"—", indexes:[] }; });
  }

  function read(name){
    var current = db();
    if(!current || typeof current.getAll !== "function"){ return Promise.reject(new Error("BL2DB no está disponible.")); }
    return current.getAll(name).then(function(rows){ return Array.isArray(rows) ? rows : []; });
  }

  function refreshCatalog(){
    var current = db();
    var names = physicalStores();
    if(!current){ return Promise.resolve([]); }
    return Promise.all(names.map(function(name){
      var count = typeof current.count === "function" ? current.count(name).catch(function(){ return 0; }) : Promise.resolve(0);
      return count.then(function(total){ return { name:name, group:groupLabel(name), total:num(total) }; });
    })).then(function(rows){
      state.catalog = rows;
      var target = byId("bl2-raw-catalog");
      if(target){
        target.className = "bdlc-table-wrap";
        target.innerHTML = '<table class="bdlc-table"><thead><tr><th>Grupo</th><th>Tabla</th><th>Registros</th></tr></thead><tbody>' + rows.map(function(row){ return '<tr><td>' + esc(row.group) + '</td><td>' + esc(row.name) + '</td><td>' + row.total + '</td></tr>'; }).join("") + '</tbody></table>';
      }
      return rows;
    });
  }

  function rowPeriod(row){ return text(row && (row.periodoId || row.periodId || row._periodoId || row.periodoCanonicoId)); }
  function rowId(row){ return text(row && (row.cedula || row.numeroIdentificacion || row.idEstudiantePeriodo || row.studentId || row.id || row.key)); }
  function rowStatus(row){ return text(row && (row.estadoMatricula || row.status || row.estado || row.estadoKey || row.statusGoogle || row.statusFirebase)); }

  function applyFilters(rows){
    var search = text((byId("bl2-raw-search") || {}).value).toLowerCase();
    var idFilter = text((byId("bl2-raw-id") || {}).value).toLowerCase();
    var statusFilter = text((byId("bl2-raw-status") || {}).value).toLowerCase();
    var periodId = state.periodId;
    return rows.filter(function(row){
      var period = rowPeriod(row);
      if(periodId && period && period !== periodId){ return false; }
      if(idFilter && rowId(row).toLowerCase().indexOf(idFilter) < 0){ return false; }
      if(statusFilter && rowStatus(row).toLowerCase().indexOf(statusFilter) < 0){ return false; }
      if(search){ try{ return JSON.stringify(row).toLowerCase().indexOf(search) >= 0; }catch(error){ return false; } }
      return true;
    });
  }

  function fields(rows){
    var map = Object.create(null);
    rows.slice(0,100).forEach(function(row){ Object.keys(row || {}).forEach(function(key){ map[key] = true; }); });
    return Object.keys(map).sort();
  }

  function latest(rows){
    var last = 0;
    rows.forEach(function(row){ var time = new Date(row.updatedAt || row.createdAt || row.importedAt || 0).getTime(); if(Number.isFinite(time) && time > last){ last = time; } });
    return last ? new Date(last).toLocaleString("es-EC") : "Sin registro";
  }

  function refresh(){
    if(!state.mounted){ return mount(); }
    state.store = text((byId("bl2-raw-store") || {}).value || state.store);
    state.pageSize = num((byId("bl2-raw-limit") || {}).value,25) || 25;
    state.periodId = activePeriod();
    state.page = 1;
    return Promise.all([read(state.store),inspect(state.store)]).then(function(values){
      state.rows = values[0];
      state.metadata = values[1];
      state.filtered = applyFilters(state.rows);
      render();
      return state.filtered;
    }).catch(function(error){
      state.rows = [];
      state.filtered = [];
      render();
      var summary = byId("bl2-raw-summary");
      if(summary){ summary.className = "bdlc-alert error"; summary.textContent = error.message || String(error); }
      return [];
    });
  }

  function displayValue(value){
    if(value == null){ return ""; }
    if(typeof value === "object"){ try{ value = JSON.stringify(value); }catch(error){ value = "[objeto]"; } }
    value = text(value);
    return value.length > 90 ? value.slice(0,87) + "..." : value;
  }

  function columns(rows){
    var all = fields(rows);
    var priority = ["id","idEstudiantePeriodo","cedula","periodoId","nombreCompleto","Nombres","NombreCarrera","estadoMatricula","status","target","tabla","updatedAt"];
    var out = [];
    priority.concat(all).forEach(function(key){ if(all.indexOf(key) >= 0 && out.indexOf(key) < 0 && out.length < 8){ out.push(key); } });
    return out;
  }

  function render(){
    var pages = Math.max(1,Math.ceil(state.filtered.length/state.pageSize));
    state.page = Math.max(1,Math.min(state.page,pages));
    var start = (state.page - 1) * state.pageSize;
    state.visible = state.filtered.slice(start,start + state.pageSize);
    var meta = state.metadata || {};
    var summary = byId("bl2-raw-summary");
    if(summary){
      summary.className = "bdlc-table-wrap";
      summary.innerHTML = '<table class="bdlc-table"><tbody>'
        + '<tr><th>Tabla</th><td>' + esc(state.store) + '</td></tr>'
        + '<tr><th>Grupo</th><td>' + esc(groupLabel(state.store)) + '</td></tr>'
        + '<tr><th>Clave</th><td>' + esc(meta.keyPath || "—") + '</td></tr>'
        + '<tr><th>Índices</th><td>' + esc((meta.indexes || []).join(", ") || "Sin índices") + '</td></tr>'
        + '<tr><th>Total físico</th><td>' + state.rows.length + '</td></tr>'
        + '<tr><th>Filtrados</th><td>' + state.filtered.length + '</td></tr>'
        + '<tr><th>Período aplicado</th><td>' + esc(state.periodId || "No aplicable") + '</td></tr>'
        + '<tr><th>Última actualización</th><td>' + esc(latest(state.rows)) + '</td></tr>'
        + '<tr><th>Campos</th><td>' + esc(fields(state.rows).join(", ") || "—") + '</td></tr>'
        + '</tbody></table>';
    }

    var target = byId("bl2-raw-table");
    if(target){
      if(!state.visible.length){ target.className = "bdlc-empty"; target.textContent = "No existen registros para los filtros actuales."; }
      else{
        var cols = columns(state.visible);
        target.className = "bdlc-table-wrap";
        target.innerHTML = '<table class="bdlc-table"><thead><tr><th>Detalle</th>' + cols.map(function(key){ return '<th>' + esc(key) + '</th>'; }).join("") + '</tr></thead><tbody>'
          + state.visible.map(function(row,index){ return '<tr><td><button class="bdlc-button subtle" type="button" data-raw-row="' + index + '">Ver</button></td>' + cols.map(function(key){ return '<td>' + esc(displayValue(row[key])) + '</td>'; }).join("") + '</tr>'; }).join("")
          + '</tbody></table>';
      }
    }

    var detail = byId("bl2-raw-detail");
    if(detail){ detail.textContent = JSON.stringify(state.visible[0] || {},null,2); }
    setText("bl2-raw-page-label","Página " + state.page + " de " + pages + " · " + state.filtered.length + " registro(s)");
    var prev = byId("bl2-raw-prev");
    var next = byId("bl2-raw-next");
    if(prev){ prev.disabled = state.page <= 1; }
    if(next){ next.disabled = state.page >= pages; }
  }

  function setText(id,value){ var el = byId(id); if(el){ el.textContent = value; } }

  function copy(value){
    value = String(value || "");
    if(navigator.clipboard && navigator.clipboard.writeText){ return navigator.clipboard.writeText(value); }
    return Promise.reject(new Error("El portapapeles no está disponible."));
  }

  function download(content,fileName,type){
    var blob = new Blob([content],{ type:type });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    window.setTimeout(function(){ URL.revokeObjectURL(link.href); link.remove(); },1000);
  }

  function csvValue(value){
    if(value == null){ return '""'; }
    if(typeof value === "object"){ try{ value = JSON.stringify(value); }catch(error){ value = "[objeto]"; } }
    return '"' + String(value).replace(/"/g,'""') + '"';
  }

  function exportJson(){ download(JSON.stringify(state.visible,null,2),"bdlocal_" + (state.store || "tabla") + "_pagina_" + state.page + ".json","application/json;charset=utf-8"); }
  function exportCsv(){
    var cols = fields(state.visible);
    var rows = [cols.map(csvValue).join(";")].concat(state.visible.map(function(row){ return cols.map(function(key){ return csvValue(row[key]); }).join(";"); }));
    download("\ufeff" + rows.join("\r\n"),"bdlocal_" + (state.store || "tabla") + "_pagina_" + state.page + ".csv","text/csv;charset=utf-8");
  }

  function bindControls(){
    var store = byId("bl2-raw-store");
    var limit = byId("bl2-raw-limit");
    var inputs = [byId("bl2-raw-id"),byId("bl2-raw-status"),byId("bl2-raw-search")];
    if(store){ store.addEventListener("change",refresh); }
    if(limit){ limit.value = String(state.pageSize); limit.addEventListener("change",refresh); }
    inputs.forEach(function(input){ if(input){ input.addEventListener("input",function(){ window.clearTimeout(input.__timer); input.__timer = window.setTimeout(refresh,300); }); } });
    byId("bl2-raw-refresh").addEventListener("click",refresh);
    byId("bl2-raw-prev").addEventListener("click",function(){ if(state.page > 1){ state.page -= 1; render(); } });
    byId("bl2-raw-next").addEventListener("click",function(){ var pages = Math.max(1,Math.ceil(state.filtered.length/state.pageSize)); if(state.page < pages){ state.page += 1; render(); } });
    byId("bl2-raw-copy").addEventListener("click",function(){ copy(JSON.stringify(state.visible,null,2)).catch(function(){}); });
    byId("bl2-raw-detail-copy").addEventListener("click",function(){ copy((byId("bl2-raw-detail") || {}).textContent || "{}").catch(function(){}); });
    byId("bl2-raw-json-export").addEventListener("click",exportJson);
    byId("bl2-raw-csv-export").addEventListener("click",exportCsv);
    state.container.addEventListener("click",function(event){
      var button = event.target && event.target.closest ? event.target.closest("[data-raw-row]") : null;
      if(!button){ return; }
      var row = state.visible[num(button.getAttribute("data-raw-row"),-1)];
      if(row && byId("bl2-raw-detail")){ byId("bl2-raw-detail").textContent = JSON.stringify(row,null,2); }
    });
  }

  function setPeriod(periodoId){ state.periodId = text(periodoId); return state.mounted ? refresh() : Promise.resolve(null); }
  function bind(options){ options = options || {}; return mount(options.container || byId("bl2-tables-slot"),options); }

  window.BL2RawView = {
    version:VERSION,
    mount:mount,
    bind:bind,
    refresh:refresh,
    refreshCatalog:refreshCatalog,
    readStore:read,
    inspectStore:inspect,
    setPeriod:setPeriod,
    getState:function(){ return { store:state.store, page:state.page, pageSize:state.pageSize, periodId:state.periodId, total:state.rows.length, filtered:state.filtered.length, visible:state.visible.length, metadata:state.metadata, catalog:state.catalog.slice() }; }
  };

  try{ window.dispatchEvent(new CustomEvent("bdlocal:raw-view-ready",{ detail:{ version:VERSION } })); }catch(error){}
})(window, document);

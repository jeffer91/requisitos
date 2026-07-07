/* =========================================================
Nombre completo: carga.divisiones.popup.js
Ruta o ubicación: /Requisitos/Carga/carga.divisiones.popup.js
Función o funciones:
- Agregar botón visible Divisiones junto al selector de período.
- Abrir un popup independiente para crear divisiones por período.
- Permitir asignar carreras a divisiones con arrastrar y soltar.
- Mantener botón alternativo de asignación para seguridad.
- Mover automáticamente una carrera si ya estaba en otra división.
- Guardar estructura de divisiones por período.
- Actualizar estudiantes del período según carrera asignada.
- Crear cambios pendientes mediante BL2Core.updateStudent para sincronización.
Con qué se conecta:
- carga.html
- carga.css
- carga.ui.js
- BL2Core
- localStorage carga.periodos.local
- localStorage carga.periodos.divisiones
========================================================= */
(function(window, document){
  "use strict";

  var LS_PERIODO = "carga.periodoSeleccionado";
  var LS_PERIODO_LABEL = "carga.periodoSeleccionadoLabel";
  var LS_PERIODOS = "carga.periodos.local";
  var LS_DIVISIONES = "carga.periodos.divisiones";

  var state = {
    ready:false,
    period:null,
    careers:[],
    divisions:[],
    originalAssigned:{},
    draggedCareerId:""
  };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function nowISO(){ return new Date().toISOString(); }
  function $(selector){ return document.querySelector(selector); }

  function esc(value){
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeText(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function key(value){
    return normalizeText(value).replace(/[^a-z0-9]+/g, "");
  }

  function safeParse(value, fallback){
    try{
      var parsed = JSON.parse(value || "");
      return parsed == null ? fallback : parsed;
    }catch(error){
      return fallback;
    }
  }

  function storageGet(name, fallback){ return safeParse(window.localStorage.getItem(name), fallback); }
  function storageSet(name, value){ window.localStorage.setItem(name, JSON.stringify(value)); }

  function parentValue(name){
    try{
      if(window.parent && window.parent !== window){ return window.parent[name]; }
    }catch(error){}
    return null;
  }

  function api(name){ return window[name] || parentValue(name) || null; }
  function core(){ return api("BL2Core"); }

  function showMessage(type, message){
    var box = document.getElementById("cargaMessageBox");
    if(box){
      box.className = "carga-message is-" + (type || "success");
      box.textContent = message || "";
      box.classList.remove("carga-hidden");
      return;
    }
    try{ console[type === "error" ? "error" : "log"](message); }catch(error){}
  }

  function dispatch(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail:detail || {} })); }catch(error){}
  }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    if(match){ return match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]; }
    return value.replace(/_+/g, "__");
  }

  function selectedPeriodFromDom(){
    var select = document.getElementById("cargaPeriodoSelect");
    var id = text(select ? select.value : "") || text(window.localStorage.getItem(LS_PERIODO));
    id = canonicalPeriodId(id);
    if(!id){ return null; }

    var label = "";
    if(select && select.value === id && select.selectedOptions && select.selectedOptions[0]){
      label = text(select.selectedOptions[0].textContent);
    }

    label = label || text(window.localStorage.getItem(LS_PERIODO_LABEL)) || id;

    return {
      id:id,
      periodoId:id,
      periodoCanonicoId:id,
      label:label,
      periodoLabel:label,
      periodoCanonicoLabel:label,
      divisiones:[],
      carrerasDetectadas:[]
    };
  }

  function normalizeCareer(item){
    if(!item){ return null; }
    if(typeof item === "string"){
      return { id:key(item), codigo:"", nombre:text(item) };
    }

    var nombre = text(item.nombre || item.NombreCarrera || item.label || item.carrera || item.Carrera || "");
    var codigo = text(item.codigo || item.CodigoCarrera || item.id || item.codigoCarrera || "");
    var id = text(item.id || codigo || key(nombre));

    if(!id && !nombre){ return null; }

    return {
      id:id || key(nombre),
      codigo:codigo,
      nombre:nombre || codigo || id
    };
  }

  function uniqueCareers(list){
    var map = {};
    (Array.isArray(list) ? list : []).forEach(function(item){
      var career = normalizeCareer(item);
      if(!career || !career.id){ return; }
      map[career.id] = career;
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity:"base" });
    });
  }

  function localPeriods(){
    var rows = storageGet(LS_PERIODOS, []);
    return Array.isArray(rows) ? rows : [];
  }

  function updateLocalPeriod(period){
    if(!period || !period.id){ return; }
    var periods = localPeriods();
    var found = false;
    periods = periods.map(function(item){
      var itemId = canonicalPeriodId(item.periodoCanonicoId || item.periodoId || item.id || "");
      if(itemId === period.id){
        found = true;
        return Object.assign({}, item, period, { updatedAt:nowISO() });
      }
      return item;
    });
    if(!found){ periods.unshift(Object.assign({}, period, { updatedAt:nowISO() })); }
    storageSet(LS_PERIODOS, periods);
  }

  function divisionsStore(){ return storageGet(LS_DIVISIONES, {}); }

  function saveDivisionsStore(periodId, divisions){
    var store = divisionsStore();
    store[periodId] = Object.assign({}, store[periodId] || {}, {
      divisiones:divisions,
      updatedAt:nowISO()
    });
    storageSet(LS_DIVISIONES, store);
  }

  function storedDivisions(period){
    var store = divisionsStore();
    var list = (store[period.id] && store[period.id].divisiones) || period.divisiones || [];
    list = Array.isArray(list) ? list : [];
    return list.map(function(div){
      var name = text(div.nombre || div.label || div.id || "");
      var id = text(div.id || key(name));
      return {
        id:id || ("division_" + Date.now()),
        nombre:name || id,
        carreras:uniqueCareers(div.carreras || []),
        createdAt:div.createdAt || nowISO(),
        updatedAt:div.updatedAt || nowISO()
      };
    });
  }

  function assignedMap(divisions){
    var map = {};
    (divisions || []).forEach(function(div){
      (div.carreras || []).forEach(function(career){
        if(career && career.id){ map[career.id] = div.id; }
      });
    });
    return map;
  }

  function assignedNameMap(divisions){
    var map = {};
    (divisions || []).forEach(function(div){
      (div.carreras || []).forEach(function(career){
        if(career && career.id){ map[career.id] = div.nombre; }
      });
    });
    return map;
  }

  function careerIdFromStudent(row){
    row = row || {};
    return text(row.CodigoCarrera || row.codigoCarrera || row.codigo || "") || key(row.NombreCarrera || row.nombreCarrera || row.Carrera || row.carrera || "");
  }

  function careerFromStudent(row){
    row = row || {};
    var nombre = text(row.NombreCarrera || row.nombreCarrera || row.Carrera || row.carrera || "");
    var codigo = text(row.CodigoCarrera || row.codigoCarrera || "");
    var id = codigo || key(nombre);
    if(!id && !nombre){ return null; }
    return { id:id, codigo:codigo, nombre:nombre || codigo || id };
  }

  function studentsForPeriod(periodId){
    var c = core();
    if(!c || typeof c.getStudents !== "function"){
      return Promise.resolve([]);
    }
    return c.getStudents({ periodoId:periodId, matricula:"" }).then(function(rows){
      return Array.isArray(rows) ? rows : [];
    }).catch(function(){ return []; });
  }

  function loadPeriodWithData(){
    var selected = selectedPeriodFromDom();
    if(!selected){ return Promise.reject(new Error("Selecciona un período antes de administrar divisiones.")); }

    var c = core();
    var periodPromise = c && typeof c.getPeriods === "function"
      ? c.getPeriods().then(function(periods){
          var found = (periods || []).filter(function(item){
            return canonicalPeriodId(item.periodoCanonicoId || item.periodoId || item.id || "") === selected.id;
          })[0];
          return Object.assign({}, selected, found || {});
        }).catch(function(){ return selected; })
      : Promise.resolve(selected);

    return periodPromise.then(function(period){
      period.id = canonicalPeriodId(period.periodoCanonicoId || period.periodoId || period.id || selected.id);
      period.periodoId = period.id;
      period.periodoCanonicoId = period.id;
      period.label = text(period.periodoCanonicoLabel || period.periodoLabel || period.label || selected.label || period.id);
      period.periodoLabel = period.label;
      period.periodoCanonicoLabel = period.label;

      return studentsForPeriod(period.id).then(function(students){
        var fromStudents = students.map(careerFromStudent).filter(Boolean);
        period.carrerasDetectadas = uniqueCareers([].concat(period.carrerasDetectadas || [], fromStudents));
        period.estudiantes = students.length || period.estudiantes || 0;
        period.totalEstudiantes = period.estudiantes;
        return period;
      });
    });
  }

  function ensureButton(){
    if(document.getElementById("cargaBtnDivisionesPeriodo")){ return; }

    var select = document.getElementById("cargaPeriodoSelect");
    if(!select){ return; }

    var field = select.closest ? select.closest(".carga-field") : select.parentNode;
    if(!field || !field.parentNode){ return; }

    var row = document.createElement("div");
    row.className = "carga-period-select-actions";
    row.innerHTML = ''
      + '<button type="button" class="carga-btn carga-btn-secondary" id="cargaBtnDivisionesPeriodo">Divisiones</button>'
      + '<small>Crear divisiones y asignar carreras del período seleccionado.</small>';

    field.parentNode.insertBefore(row, field.nextSibling);

    document.getElementById("cargaBtnDivisionesPeriodo").addEventListener("click", openPopup);
  }

  function injectStyles(){
    if(document.getElementById("carga-divisiones-popup-styles")){ return; }

    var style = document.createElement("style");
    style.id = "carga-divisiones-popup-styles";
    style.textContent = [
      ".carga-period-select-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid #edf2f7}",
      ".carga-period-select-actions small{color:#64748b;font-size:11px;font-weight:800}",
      ".cdp-overlay{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.46);backdrop-filter:blur(2px)}",
      ".cdp-overlay.is-open{display:flex}",
      ".cdp-modal{width:min(1120px,96vw);max-height:92vh;overflow:hidden;background:#fff;border:1px solid #dbe3ef;border-radius:22px;box-shadow:0 30px 90px rgba(15,23,42,.30);display:grid;grid-template-rows:auto 1fr auto}",
      ".cdp-head{display:flex;justify-content:space-between;gap:14px;padding:16px 18px;border-bottom:1px solid #e2e8f0;background:#f8fbff}",
      ".cdp-head p{margin:0 0 4px;color:#1d4ed8;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.10em}",
      ".cdp-head h2{margin:0;font-size:21px;letter-spacing:-.03em;color:#172033}",
      ".cdp-head small{display:block;margin-top:3px;color:#64748b;font-weight:800}",
      ".cdp-close{width:38px;height:38px;border:1px solid #dbe3ef;border-radius:999px;background:#fff;color:#172033;font-size:24px;line-height:1;cursor:pointer}",
      ".cdp-body{overflow:auto;padding:16px 18px;display:grid;gap:14px;background:#fff}",
      ".cdp-create{border:1px solid #dbe3ef;border-radius:16px;background:#f8fafc;padding:12px;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end}",
      ".cdp-field{display:grid;gap:5px}.cdp-field label{font-size:11px;font-weight:950;color:#334155}.cdp-field input,.cdp-field select{min-height:38px;border:1px solid #dbe3ef;border-radius:12px;padding:8px 11px;outline:none;background:#fff}",
      ".cdp-title{font-size:13px;font-weight:950;color:#172033;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;align-items:center}",
      ".cdp-title span{color:#64748b;font-size:11px;font-weight:850}",
      ".cdp-assign{display:grid;grid-template-columns:minmax(280px,.9fr) minmax(360px,1.3fr);gap:14px;align-items:start}",
      ".cdp-panel{border:1px solid #dbe3ef;border-radius:17px;background:#fff;padding:12px;min-width:0}",
      ".cdp-careers{display:grid;gap:8px;max-height:440px;overflow:auto;padding-right:3px}",
      ".cdp-career{display:flex;align-items:flex-start;gap:8px;border:1px solid #dbe3ef;border-radius:13px;background:#f8fafc;padding:9px;cursor:grab;user-select:none}",
      ".cdp-career:active{cursor:grabbing}.cdp-career input{margin-top:2px}.cdp-career strong{display:block;font-size:12px;color:#172033;line-height:1.25}.cdp-career small{display:block;color:#64748b;font-weight:800;font-size:10px;margin-top:2px}",
      ".cdp-fallback{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #edf2f7}",
      ".cdp-divisions{display:grid;gap:10px}",
      ".cdp-division{border:1px dashed #b9c7da;border-radius:16px;background:#f8fbff;padding:10px;min-height:92px;transition:.15s ease}",
      ".cdp-division.is-over{background:#eff6ff;border-color:#1d4ed8;box-shadow:0 0 0 3px rgba(147,197,253,.28)}",
      ".cdp-division-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}",
      ".cdp-division-head strong{font-size:13px}.cdp-division-head button{border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:999px;min-height:27px;padding:0 9px;font-weight:900;font-size:10px}",
      ".cdp-division-careers{display:flex;gap:6px;flex-wrap:wrap}",
      ".cdp-tag{display:inline-flex;align-items:center;gap:5px;border:1px solid #dbe3ef;border-radius:999px;background:#fff;padding:5px 8px;font-size:11px;font-weight:900;color:#334155;max-width:100%}",
      ".cdp-tag button{border:0;background:#fee2e2;color:#b91c1c;border-radius:999px;width:18px;height:18px;line-height:1;font-weight:900;cursor:pointer}",
      ".cdp-empty{border:1px dashed #cbd5e1;border-radius:13px;padding:12px;text-align:center;color:#64748b;background:#f8fafc;font-weight:850;font-size:12px}",
      ".cdp-foot{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:13px 18px;border-top:1px solid #e2e8f0;background:#fff}",
      ".cdp-note{color:#64748b;font-size:11px;font-weight:850;line-height:1.35}",
      "@media(max-width:860px){.cdp-create,.cdp-assign,.cdp-fallback{grid-template-columns:1fr}.cdp-modal{width:98vw}.cdp-foot{display:grid}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function ensurePopup(){
    if(document.getElementById("cargaDivisionesPopupV2")){ return; }

    var node = document.createElement("div");
    node.id = "cargaDivisionesPopupV2";
    node.className = "cdp-overlay";
    node.innerHTML = ''
      + '<section class="cdp-modal" role="dialog" aria-modal="true" aria-labelledby="cdpTitle">'
        + '<header class="cdp-head">'
          + '<div><p>Divisiones por período</p><h2 id="cdpTitle">Administrar divisiones</h2><small id="cdpPeriod">—</small></div>'
          + '<button type="button" class="cdp-close" data-cdp-close aria-label="Cerrar">×</button>'
        + '</header>'
        + '<div class="cdp-body">'
          + '<section class="cdp-create">'
            + '<div class="cdp-field"><label for="cdpDivisionName">Crear división</label><input id="cdpDivisionName" type="text" placeholder="Superior, Online, Norte, Intensivo..." autocomplete="off"></div>'
            + '<button type="button" class="carga-btn carga-btn-primary" id="cdpCreateDivision">Crear división</button>'
          + '</section>'
          + '<section class="cdp-assign">'
            + '<article class="cdp-panel">'
              + '<div class="cdp-title">Carreras del período <span id="cdpCareerCount">0</span></div>'
              + '<div id="cdpCareers" class="cdp-careers"></div>'
              + '<div class="cdp-fallback">'
                + '<div class="cdp-field"><label for="cdpFallbackDivision">Asignar seleccionadas a</label><select id="cdpFallbackDivision"></select></div>'
                + '<button type="button" class="carga-btn carga-btn-secondary" id="cdpAssignSelected">Asignar</button>'
              + '</div>'
            + '</article>'
            + '<article class="cdp-panel">'
              + '<div class="cdp-title">Divisiones creadas <span>arrastra carreras aquí</span></div>'
              + '<div id="cdpDivisions" class="cdp-divisions"></div>'
            + '</article>'
          + '</section>'
        + '</div>'
        + '<footer class="cdp-foot">'
          + '<div class="cdp-note">Una carrera solo queda en una división por período. Si la mueves, se actualiza automáticamente.</div>'
          + '<div class="carga-actions"><button type="button" class="carga-btn carga-btn-light" data-cdp-close>Cerrar</button><button type="button" class="carga-btn carga-btn-primary" id="cdpSave">Guardar cambios</button></div>'
        + '</footer>'
      + '</section>';

    document.body.appendChild(node);

    node.addEventListener("click", function(event){
      if(event.target === node || event.target.closest("[data-cdp-close]")){ closePopup(); }
    });

    document.getElementById("cdpCreateDivision").addEventListener("click", createDivision);
    document.getElementById("cdpAssignSelected").addEventListener("click", assignSelected);
    document.getElementById("cdpSave").addEventListener("click", saveAll);

    var input = document.getElementById("cdpDivisionName");
    if(input){
      input.addEventListener("keydown", function(event){
        if(event.key === "Enter"){
          event.preventDefault();
          createDivision();
        }
      });
    }

    document.getElementById("cdpCareers").addEventListener("dragstart", function(event){
      var item = event.target.closest(".cdp-career");
      if(!item){ return; }
      state.draggedCareerId = item.getAttribute("data-career-id") || "";
      try{ event.dataTransfer.setData("text/plain", state.draggedCareerId); }catch(error){}
    });

    document.getElementById("cdpDivisions").addEventListener("dragover", function(event){
      var zone = event.target.closest(".cdp-division");
      if(!zone){ return; }
      event.preventDefault();
      zone.classList.add("is-over");
    });

    document.getElementById("cdpDivisions").addEventListener("dragleave", function(event){
      var zone = event.target.closest(".cdp-division");
      if(zone){ zone.classList.remove("is-over"); }
    });

    document.getElementById("cdpDivisions").addEventListener("drop", function(event){
      var zone = event.target.closest(".cdp-division");
      if(!zone){ return; }
      event.preventDefault();
      zone.classList.remove("is-over");
      var careerId = "";
      try{ careerId = event.dataTransfer.getData("text/plain"); }catch(error){}
      careerId = careerId || state.draggedCareerId;
      assignCareerToDivision(careerId, zone.getAttribute("data-division-id"));
    });

    document.getElementById("cdpDivisions").addEventListener("click", function(event){
      var removeCareer = event.target.closest("button[data-cdp-remove-career]");
      if(removeCareer){
        removeCareerFromDivisions(removeCareer.getAttribute("data-cdp-remove-career"));
        return;
      }

      var deleteDivisionButton = event.target.closest("button[data-cdp-delete-division]");
      if(deleteDivisionButton){
        deleteDivision(deleteDivisionButton.getAttribute("data-cdp-delete-division"));
      }
    });
  }

  function openPopup(){
    loadPeriodWithData().then(function(period){
      state.period = period;
      state.careers = uniqueCareers(period.carrerasDetectadas || []);
      state.divisions = storedDivisions(period);
      state.originalAssigned = assignedMap(state.divisions);
      renderPopup();
      document.getElementById("cargaDivisionesPopupV2").classList.add("is-open");
    }).catch(function(error){
      showMessage("warning", error.message || "No se pudo abrir divisiones.");
    });
  }

  function closePopup(){
    var node = document.getElementById("cargaDivisionesPopupV2");
    if(node){ node.classList.remove("is-open"); }
  }

  function createDivision(){
    var input = document.getElementById("cdpDivisionName");
    var name = text(input ? input.value : "");
    if(!name){
      showMessage("warning", "Escribe el nombre de la división.");
      return;
    }

    var id = key(name);
    if(!id){ return; }

    if(state.divisions.some(function(div){ return div.id === id || key(div.nombre) === id; })){
      showMessage("warning", "Esa división ya existe en este período.");
      return;
    }

    state.divisions.push({ id:id, nombre:name, carreras:[], createdAt:nowISO(), updatedAt:nowISO() });
    if(input){ input.value = ""; input.focus(); }
    renderPopup();
  }

  function careerById(careerId){
    return state.careers.filter(function(career){ return career.id === careerId; })[0] || null;
  }

  function assignCareerToDivision(careerId, divisionId){
    careerId = text(careerId);
    divisionId = text(divisionId);
    if(!careerId || !divisionId){ return; }

    var career = careerById(careerId);
    if(!career){ return; }

    state.divisions = state.divisions.map(function(div){
      var current = Array.isArray(div.carreras) ? div.carreras : [];
      current = current.filter(function(item){ return item.id !== careerId; });
      if(div.id === divisionId){ current = uniqueCareers(current.concat([career])); }
      return Object.assign({}, div, { carreras:current, updatedAt:nowISO() });
    });

    renderPopup();
  }

  function removeCareerFromDivisions(careerId){
    careerId = text(careerId);
    state.divisions = state.divisions.map(function(div){
      return Object.assign({}, div, {
        carreras:(div.carreras || []).filter(function(career){ return career.id !== careerId; }),
        updatedAt:nowISO()
      });
    });
    renderPopup();
  }

  function deleteDivision(divisionId){
    divisionId = text(divisionId);
    if(!divisionId){ return; }
    if(!window.confirm("¿Eliminar esta división? Las carreras quedarán sin división hasta asignarlas nuevamente.")){ return; }
    state.divisions = state.divisions.filter(function(div){ return div.id !== divisionId; });
    renderPopup();
  }

  function selectedCareerIds(){
    return Array.prototype.map.call(document.querySelectorAll("#cdpCareers input[type='checkbox']:checked"), function(input){
      return input.value;
    }).filter(Boolean);
  }

  function assignSelected(){
    var target = text(document.getElementById("cdpFallbackDivision") ? document.getElementById("cdpFallbackDivision").value : "");
    var ids = selectedCareerIds();

    if(!target){
      showMessage("warning", "Crea o selecciona una división de destino.");
      return;
    }
    if(!ids.length){
      showMessage("warning", "Selecciona una o más carreras.");
      return;
    }

    ids.forEach(function(id){ assignCareerToDivision(id, target); });
  }

  function renderPopup(){
    ensurePopup();
    var period = state.period || {};
    var currentAssigned = assignedMap(state.divisions);
    var divNameById = {};

    state.divisions.forEach(function(div){ divNameById[div.id] = div.nombre; });

    document.getElementById("cdpPeriod").textContent = (period.periodoCanonicoLabel || period.periodoLabel || period.label || period.id || "—") + " · " + (period.id || "");
    document.getElementById("cdpCareerCount").textContent = state.careers.length + " carrera" + (state.careers.length === 1 ? "" : "s");

    var careersBox = document.getElementById("cdpCareers");
    if(!state.careers.length){
      careersBox.innerHTML = '<div class="cdp-empty">Todavía no hay carreras detectadas en este período. Sube primero el Excel del período.</div>';
    }else{
      careersBox.innerHTML = state.careers.map(function(career){
        var owner = currentAssigned[career.id];
        return ''
          + '<label class="cdp-career" draggable="true" data-career-id="' + esc(career.id) + '">'
            + '<input type="checkbox" value="' + esc(career.id) + '">'
            + '<span><strong>' + esc(career.nombre) + '</strong><small>' + esc(career.codigo || career.id) + (owner ? ' · En ' + esc(divNameById[owner] || owner) : ' · Sin división') + '</small></span>'
          + '</label>';
      }).join("");
    }

    var fallback = document.getElementById("cdpFallbackDivision");
    fallback.innerHTML = state.divisions.length
      ? state.divisions.map(function(div){ return '<option value="' + esc(div.id) + '">' + esc(div.nombre) + '</option>'; }).join("")
      : '<option value="">Crea una división primero</option>';

    var divisionsBox = document.getElementById("cdpDivisions");
    if(!state.divisions.length){
      divisionsBox.innerHTML = '<div class="cdp-empty">Sin divisiones creadas. Crea una división arriba y luego arrastra carreras.</div>';
    }else{
      divisionsBox.innerHTML = state.divisions.map(function(div){
        var careers = div.carreras || [];
        var careersHtml = careers.length ? careers.map(function(career){
          return '<span class="cdp-tag">' + esc(career.nombre || career.id) + '<button type="button" data-cdp-remove-career="' + esc(career.id) + '" title="Quitar">×</button></span>';
        }).join("") : '<div class="cdp-empty">Suelta carreras aquí.</div>';

        return ''
          + '<section class="cdp-division" data-division-id="' + esc(div.id) + '">'
            + '<div class="cdp-division-head"><strong>' + esc(div.nombre) + '</strong><button type="button" data-cdp-delete-division="' + esc(div.id) + '">Eliminar</button></div>'
            + '<div class="cdp-division-careers">' + careersHtml + '</div>'
          + '</section>';
      }).join("");
    }
  }

  function savePeriodToCore(period){
    updateLocalPeriod(period);
    var c = core();
    if(c && typeof c.savePeriod === "function"){
      return c.savePeriod(period).catch(function(){ return period; });
    }
    return Promise.resolve(period);
  }

  function updateStudentsByDivisions(period){
    var c = core();
    if(!c || typeof c.getStudents !== "function" || typeof c.updateStudent !== "function"){
      return Promise.resolve({ updated:0, skipped:true, message:"BL2Core no disponible para actualizar estudiantes." });
    }

    var currentByCareer = assignedNameMap(state.divisions);
    var originalByCareer = state.originalAssigned || {};

    return c.getStudents({ periodoId:period.id, matricula:"" }).then(function(students){
      students = Array.isArray(students) ? students : [];
      var updated = 0;
      var chain = Promise.resolve();

      students.forEach(function(student){
        var careerId = careerIdFromStudent(student);
        if(!careerId){ return; }

        var hasCurrent = Object.prototype.hasOwnProperty.call(currentByCareer, careerId);
        var hadOriginal = Object.prototype.hasOwnProperty.call(originalByCareer, careerId);
        var desired = hasCurrent ? currentByCareer[careerId] : (hadOriginal ? "" : null);

        if(desired === null){ return; }

        var currentDivision = text(student.division || student.Division || "");
        if(currentDivision === desired){ return; }

        var changes = {
          division:desired,
          divisiones:desired ? [desired] : [],
          divisionActualizadaEn:nowISO(),
          ultimaEdicionLocal:nowISO(),
          updatedAt:nowISO()
        };

        chain = chain.then(function(){
          return c.updateStudent(student.id, changes, { action:"division_period_career_update" }).then(function(){
            updated += 1;
          });
        });
      });

      return chain.then(function(){
        return { updated:updated, total:students.length };
      });
    });
  }

  function saveAll(){
    if(!state.period || !state.period.id){ return; }

    var period = Object.assign({}, state.period, {
      divisiones:state.divisions,
      carrerasDetectadas:state.careers,
      updatedAt:nowISO()
    });

    showMessage("warning", "Guardando divisiones y actualizando estudiantes del período...");

    saveDivisionsStore(period.id, state.divisions);

    savePeriodToCore(period)
      .then(function(){ return updateStudentsByDivisions(period); })
      .then(function(result){
        dispatch("bdlocal:changes-created", {
          source:"CargaDivisionesPopup",
          periodoId:period.id,
          periodoLabel:period.periodoCanonicoLabel || period.periodoLabel || period.label,
          total:result.updated || 0
        });
        dispatch("bdlocal:sync-requested", {
          source:"CargaDivisionesPopup",
          reason:"period_divisions_saved",
          periodoId:period.id,
          periodoLabel:period.periodoCanonicoLabel || period.periodoLabel || period.label,
          pending:result.updated || 0,
          lowCost:true,
          idleOnly:true,
          batchSize:50
        });
        closePopup();
        showMessage("success", "Divisiones guardadas. Estudiantes actualizados: " + (result.updated || 0) + ". Se creó cola pendiente para sincronización.");
      })
      .catch(function(error){
        showMessage("error", "No se pudo guardar divisiones: " + (error.message || String(error)));
      });
  }

  function updateButtonState(){
    var button = document.getElementById("cargaBtnDivisionesPeriodo");
    if(!button){ return; }
    button.disabled = !selectedPeriodFromDom();
  }

  function boot(){
    injectStyles();
    ensureButton();
    ensurePopup();
    updateButtonState();

    var select = document.getElementById("cargaPeriodoSelect");
    if(select){ select.addEventListener("change", updateButtonState); }

    window.addEventListener("storage", updateButtonState);
    window.addEventListener("bl2:period-change", updateButtonState);
    window.CargaDivisionesPopup = {
      open:openPopup,
      close:closePopup,
      save:saveAll,
      reload:function(){ if(state.period){ loadPeriodWithData().then(function(period){ state.period = period; state.careers = uniqueCareers(period.carrerasDetectadas || []); state.divisions = storedDivisions(period); renderPopup(); }); } }
    };
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})(window, document);

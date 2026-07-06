/* =========================================================
Nombre completo: carga.ui.js
Ruta o ubicación: /Requisitos/Carga/carga.ui.js
Función o funciones:
- Reorganizar la pantalla Carga en tres tarjetas compactas.
- Administrar períodos canónicos desde la pantalla de Carga.
- Exigir período antes de subir Excel.
- Abrir popup de divisiones por período.
- Procesar archivo y guardar en BDLocal sin vista previa.
- Mostrar resumen corto, advertencias, errores y barra de sincronización.
Con qué se conecta:
- carga.html
- carga.css
- carga.app.js
- carga.state.js
- CargaSave
- BL2Core / BDLocal cuando están disponibles
========================================================= */
(function(window, document){
  "use strict";

  var LS_PERIODO = "carga.periodoSeleccionado";
  var LS_PERIODO_LABEL = "carga.periodoSeleccionadoLabel";
  var LS_PERIODOS = "carga.periodos.local";
  var LS_DIVISIONES = "carga.periodos.divisiones";
  var LS_SYNC = "carga.sync.estado";

  var MONTHS = [
    { value:"01", label:"Enero" },
    { value:"02", label:"Febrero" },
    { value:"03", label:"Marzo" },
    { value:"04", label:"Abril" },
    { value:"05", label:"Mayo" },
    { value:"06", label:"Junio" },
    { value:"07", label:"Julio" },
    { value:"08", label:"Agosto" },
    { value:"09", label:"Septiembre" },
    { value:"10", label:"Octubre" },
    { value:"11", label:"Noviembre" },
    { value:"12", label:"Diciembre" }
  ];

  var REQUIRED_HEADERS = [
    "numeroIdentificacion",
    "Nombres",
    "CodigoCarrera",
    "NombreCarrera",
    "HorarioComplexivo",
    "Academico",
    "Documentacion",
    "Financiero",
    "Titulacion",
    "PrácticasVinculacion",
    "Vinculacion",
    "SeguimientoGraduados",
    "Ingles",
    "ActualizaciónDatos",
    "CorreoPersonal",
    "CorreoInstitucional",
    "Celular",
    "Sede",
    "AprobacionTitulacion",
    "AprobacionComplexivoProyecto"
  ];

  var els = {};
  var uiReady = false;
  var busy = false;
  var selectedFile = null;
  var selectedPeriodId = "";
  var modalPeriodId = "";

  function $(selector){ return document.querySelector(selector); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value){ value = Number(value || 0); return isFinite(value) ? value : 0; }
  function nowISO(){ return new Date().toISOString(); }

  function esc(value){
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function show(el){ if(el){ el.classList.remove("carga-hidden"); } }
  function hide(el){ if(el){ el.classList.add("carga-hidden"); } }
  function setText(id, value){ var el = document.getElementById(id); if(el){ el.textContent = value; } }
  function setHtml(id, value){ var el = document.getElementById(id); if(el){ el.innerHTML = value; } }

  function safeParse(value, fallback){
    try{
      var parsed = JSON.parse(value || "");
      return parsed == null ? fallback : parsed;
    }catch(error){
      return fallback;
    }
  }

  function storageGet(key, fallback){ return safeParse(localStorage.getItem(key), fallback); }
  function storageSet(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

  function parentValue(name){
    try{
      if(window.parent && window.parent !== window){ return window.parent[name]; }
    }catch(error){}
    return null;
  }

  function api(name){
    return window[name] || parentValue(name) || null;
  }

  function bl2(){ return api("BL2Core"); }

  function normalizeText(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function key(value){
    return normalizeText(value).replace(/[^a-z0-9]/g, "");
  }

  function monthLabel(value){
    value = text(value);
    var found = MONTHS.filter(function(item){ return item.value === value || item.label === value; })[0];
    return found ? found.label : value;
  }

  function makePeriodId(startMonth, startYear, endMonth, endYear){
    startMonth = String(startMonth || "").padStart(2, "0");
    endMonth = String(endMonth || "").padStart(2, "0");
    return text(startYear) + "-" + startMonth + "__" + text(endYear) + "-" + endMonth;
  }

  function makePeriodLabel(startMonth, startYear, endMonth, endYear){
    return monthLabel(startMonth) + " " + text(startYear) + " a " + monthLabel(endMonth) + " " + text(endYear);
  }

  function canonicalId(period){
    period = period || {};
    var raw = text(period.periodoCanonicoId || period.periodoId || period.id || period.value || "");
    if(!raw){ return ""; }

    var match = raw.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    if(match){ return match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]; }

    return raw.replace(/_+/g, "__");
  }

  function periodLabel(period){
    period = period || {};
    return text(period.periodoCanonicoLabel || period.periodoLabel || period.label || period.nombre || canonicalId(period));
  }

  function normalizePeriod(period){
    var id = canonicalId(period);
    if(!id){ return null; }

    return Object.assign({}, period || {}, {
      id: id,
      periodoId: id,
      periodoCanonicoId: id,
      label: periodLabel(period),
      periodoLabel: periodLabel(period),
      periodoCanonicoLabel: periodLabel(period),
      estadoDepuracion: text(period.estadoDepuracion || "OK"),
      requiereRevision: !!period.requiereRevision,
      estudiantes: num(period.estudiantes || period.totalEstudiantes || period.count || 0),
      carrerasDetectadas: Array.isArray(period.carrerasDetectadas) ? period.carrerasDetectadas : [],
      divisiones: Array.isArray(period.divisiones) ? period.divisiones : []
    });
  }

  function defaultPeriods(){
    return [
      normalizePeriod({ id:"2025-11__2026-05", label:"Noviembre 2025 a Mayo 2026" }),
      normalizePeriod({ id:"2026-02__2026-08", label:"Febrero 2026 a Agosto 2026" }),
      normalizePeriod({ id:"2026-04__2026-09", label:"Abril 2026 a Septiembre 2026" })
    ];
  }

  function localPeriods(){
    var list = storageGet(LS_PERIODOS, []);
    if(!Array.isArray(list) || !list.length){ return defaultPeriods(); }
    return list.map(normalizePeriod).filter(Boolean);
  }

  function saveLocalPeriods(periods){
    periods = Array.isArray(periods) ? periods.map(normalizePeriod).filter(Boolean) : [];
    storageSet(LS_PERIODOS, periods);
  }

  function mergePeriods(list){
    var map = {};

    (Array.isArray(list) ? list : []).forEach(function(period){
      period = normalizePeriod(period);
      if(!period){ return; }
      var id = canonicalId(period);
      if(!map[id]){ map[id] = period; }
      else{
        map[id] = Object.assign({}, map[id], period, {
          carrerasDetectadas: uniqueCareers([].concat(map[id].carrerasDetectadas || [], period.carrerasDetectadas || [])),
          divisiones: period.divisiones && period.divisiones.length ? period.divisiones : (map[id].divisiones || [])
        });
      }
    });

    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return text(b.id).localeCompare(text(a.id));
    });
  }

  function getPeriodsFromSelect(){
    if(!els.periodoSelect){ return []; }
    return Array.prototype.map.call(els.periodoSelect.options, function(option){
      if(!option.value){ return null; }
      return normalizePeriod({ id: option.value, label: option.textContent });
    }).filter(Boolean);
  }

  function getPeriods(){
    return mergePeriods(getPeriodsFromSelect().concat(localPeriods()));
  }

  function loadPeriods(){
    var core = bl2();
    if(core && typeof core.getPeriods === "function"){
      return core.getPeriods().then(function(rows){
        var merged = mergePeriods((rows || []).concat(localPeriods()));
        saveLocalPeriods(merged);
        return merged;
      }).catch(function(){
        return getPeriods();
      });
    }
    return Promise.resolve(getPeriods());
  }

  function setActivePeriod(period){
    period = normalizePeriod(period);
    if(!period){ return Promise.reject(new Error("Seleccione un período válido.")); }

    selectedPeriodId = period.id;
    localStorage.setItem(LS_PERIODO, period.id);
    localStorage.setItem(LS_PERIODO_LABEL, period.periodoCanonicoLabel);

    var core = bl2();
    if(core && typeof core.setActivePeriod === "function"){
      return core.setActivePeriod(period.id, period.periodoCanonicoLabel).catch(function(){
        return period;
      }).then(function(){ return period; });
    }

    return Promise.resolve(period);
  }

  function updateLocalPeriod(period){
    period = normalizePeriod(period);
    if(!period){ return []; }

    var periods = getPeriods().filter(function(item){ return canonicalId(item) !== period.id; });
    periods.unshift(period);
    periods = mergePeriods(periods);
    saveLocalPeriods(periods);
    return periods;
  }

  function selectedPeriod(){
    var id = text(selectedPeriodId || (els.periodoSelect ? els.periodoSelect.value : "") || localStorage.getItem(LS_PERIODO));
    if(!id){ return null; }
    var found = getPeriods().filter(function(item){ return item.id === id; })[0];
    if(found){ return found; }
    return normalizePeriod({ id: id, label: localStorage.getItem(LS_PERIODO_LABEL) || id });
  }

  function getSelectedPeriod(){
    var period = selectedPeriod();
    if(!period){ return { periodoId:"", periodoLabel:"" }; }
    return {
      periodoId: period.id,
      periodoLabel: period.periodoCanonicoLabel,
      id: period.id,
      label: period.periodoCanonicoLabel,
      periodoCanonicoId: period.id,
      periodoCanonicoLabel: period.periodoCanonicoLabel
    };
  }

  function requirePeriod(){
    var period = selectedPeriod();
    if(!period){
      showMessage("warning", "Primero crea o selecciona un período.");
      if(els.periodoSelect){ els.periodoSelect.focus(); }
      return null;
    }
    return getSelectedPeriod();
  }

  function periodFromForm(){
    var sm = text(els.periodoMesInicio ? els.periodoMesInicio.value : "");
    var sy = text(els.periodoAnioInicio ? els.periodoAnioInicio.value : "");
    var em = text(els.periodoMesFin ? els.periodoMesFin.value : "");
    var ey = text(els.periodoAnioFin ? els.periodoAnioFin.value : "");

    if(!sm || !sy || !em || !ey){
      throw new Error("Complete mes y año de inicio y fin.");
    }

    var id = makePeriodId(sm, sy, em, ey);
    var label = makePeriodLabel(sm, sy, em, ey);

    return normalizePeriod({
      id: id,
      label: label,
      periodoCanonicoId: id,
      periodoCanonicoLabel: label,
      creadoEn: nowISO(),
      updatedAt: nowISO(),
      estadoDepuracion: "OK",
      requiereRevision: false,
      carrerasDetectadas: [],
      divisiones: []
    });
  }

  function fillPeriodForm(period){
    period = normalizePeriod(period);
    if(!period){ return; }

    var match = period.id.match(/^(\d{4})-(\d{2})__(\d{4})-(\d{2})$/);
    if(!match){ return; }

    if(els.periodoAnioInicio){ els.periodoAnioInicio.value = match[1]; }
    if(els.periodoMesInicio){ els.periodoMesInicio.value = match[2]; }
    if(els.periodoAnioFin){ els.periodoAnioFin.value = match[3]; }
    if(els.periodoMesFin){ els.periodoMesFin.value = match[4]; }
  }

  function renderPeriodSelect(periods){
    if(!els.periodoSelect){ return; }

    periods = mergePeriods(periods || getPeriods());
    var current = selectedPeriodId || localStorage.getItem(LS_PERIODO) || "";

    els.periodoSelect.innerHTML = '<option value="">Selecciona un período</option>' + periods.map(function(period){
      return '<option value="' + esc(period.id) + '">' + esc(period.periodoCanonicoLabel) + '</option>';
    }).join("");

    if(current && periods.some(function(item){ return item.id === current; })){
      els.periodoSelect.value = current;
      selectedPeriodId = current;
    }
  }

  function renderPeriodCards(periods){
    periods = mergePeriods(periods || getPeriods());
    setText("cargaPeriodosCount", periods.length + " período" + (periods.length === 1 ? "" : "s"));

    if(!els.periodosCards){ return; }
    if(!periods.length){
      els.periodosCards.innerHTML = '<div class="carga-empty compact">No hay períodos creados.</div>';
      return;
    }

    els.periodosCards.innerHTML = periods.map(function(period){
      var active = period.id === selectedPeriodId;
      var duplicate = text(period.estadoDepuracion).toUpperCase() === "DUPLICADO_PERIODO" || period.requiereRevision;
      var careers = Array.isArray(period.carrerasDetectadas) ? period.carrerasDetectadas.length : 0;
      var divisions = Array.isArray(period.divisiones) ? period.divisiones.length : 0;
      var students = num(period.estudiantes || period.totalEstudiantes || 0);

      return ''
        + '<article class="carga-period-card ' + (active ? 'is-active ' : '') + (duplicate ? 'is-warning' : '') + '" data-period-id="' + esc(period.id) + '">'
          + '<div>'
            + '<h3>' + esc(period.periodoCanonicoLabel) + '</h3>'
            + '<small>' + esc(period.id) + '</small>'
          + '</div>'
          + '<div class="carga-period-meta">'
            + '<span class="carga-mini-pill">' + (duplicate ? 'Revisar' : 'OK') + '</span>'
            + '<span class="carga-mini-pill">' + students + ' est.</span>'
            + '<span class="carga-mini-pill">' + careers + ' carreras</span>'
            + '<span class="carga-mini-pill">' + divisions + ' divisiones</span>'
          + '</div>'
          + '<div class="carga-period-actions">'
            + '<button type="button" class="carga-btn carga-btn-secondary" data-action="use">Usar</button>'
            + '<button type="button" class="carga-btn carga-btn-light" data-action="edit">Editar</button>'
            + '<button type="button" class="carga-btn carga-btn-light" data-action="delete">Borrar</button>'
            + '<button type="button" class="carga-btn carga-btn-light" data-action="divisions">Divisiones</button>'
          + '</div>'
        + '</article>';
    }).join("");
  }

  function renderPeriodUI(periods){
    periods = mergePeriods(periods || getPeriods());
    renderPeriodSelect(periods);
    renderPeriodCards(periods);
    renderSelectedPeriodState();
  }

  function createPeriod(){
    var period;
    try{
      period = periodFromForm();
    }catch(error){
      showMessage("warning", error.message || "No se pudo crear el período.");
      return;
    }

    var periods = updateLocalPeriod(period);
    renderPeriodUI(periods);

    setActivePeriod(period).then(function(){
      renderPeriodUI(periods);
      showMessage("success", "Período creado y seleccionado: " + period.periodoCanonicoLabel + ".");
      setStatus("ok", "Período listo", period.periodoCanonicoLabel);
    });
  }

  function editPeriod(){
    var current = selectedPeriod();
    if(!current){
      showMessage("warning", "Selecciona un período para editar.");
      return;
    }

    var updated;
    try{
      updated = periodFromForm();
    }catch(error){
      showMessage("warning", error.message || "No se pudo editar el período.");
      return;
    }

    updated.carrerasDetectadas = current.carrerasDetectadas || [];
    updated.divisiones = current.divisiones || [];
    updated.estudiantes = current.estudiantes || 0;
    updated.createdAt = current.createdAt || current.creadoEn || nowISO();
    updated.updatedAt = nowISO();

    var periods = getPeriods().filter(function(item){ return item.id !== current.id; });
    periods.unshift(updated);
    periods = mergePeriods(periods);
    saveLocalPeriods(periods);

    setActivePeriod(updated).then(function(){
      renderPeriodUI(periods);
      showMessage("success", "Período editado: " + updated.periodoCanonicoLabel + ".");
    });
  }

  function deletePeriod(periodId){
    periodId = periodId || (selectedPeriod() && selectedPeriod().id);
    if(!periodId){
      showMessage("warning", "Selecciona un período para borrar.");
      return;
    }

    var period = getPeriods().filter(function(item){ return item.id === periodId; })[0];
    if(!period){ return; }

    var message = "¿Borrar el período " + period.periodoCanonicoLabel + "?";
    if(num(period.estudiantes) > 0){
      message += " Tiene estudiantes registrados. Lo recomendable es corregirlo desde BDLocal si ya fue sincronizado.";
    }

    if(!window.confirm(message)){ return; }

    var periods = getPeriods().filter(function(item){ return item.id !== periodId; });
    saveLocalPeriods(periods);

    if(selectedPeriodId === periodId){
      selectedPeriodId = "";
      localStorage.removeItem(LS_PERIODO);
      localStorage.removeItem(LS_PERIODO_LABEL);
    }

    renderPeriodUI(periods);
    showMessage("success", "Período eliminado de la lista local. Si existía en BDLocal/Firebase, corrígelo desde Base Local.");
  }

  function correctDuplicatePeriods(){
    var periods = getPeriods();
    var groups = {};

    periods.forEach(function(period){
      var id = canonicalId(period);
      if(!groups[id]){ groups[id] = []; }
      groups[id].push(period);
    });

    var corrected = [];
    var removed = 0;

    Object.keys(groups).forEach(function(id){
      var group = groups[id];
      var canonical = group.filter(function(item){ return text(item.id).indexOf("__") >= 0; })[0] || group[0];
      group.forEach(function(item){ if(item !== canonical){ removed += 1; } });
      canonical.id = id;
      canonical.periodoId = id;
      canonical.periodoCanonicoId = id;
      canonical.estadoDepuracion = "OK";
      canonical.requiereRevision = false;
      corrected.push(canonical);
    });

    corrected = mergePeriods(corrected);
    saveLocalPeriods(corrected);
    renderPeriodUI(corrected);

    showMessage(
      removed ? "success" : "warning",
      removed
        ? "Duplicados corregidos en la lista local: " + removed + ". La migración completa de estudiantes se hará desde BDLocal."
        : "No se encontraron períodos duplicados en la lista local."
    );
  }

  function renderSelectedPeriodState(){
    var period = selectedPeriod();
    var hasPeriod = !!period;

    if(els.periodoActivoChip){
      els.periodoActivoChip.textContent = hasPeriod ? period.periodoCanonicoLabel : "Sin período";
      els.periodoActivoChip.className = "carga-chip " + (hasPeriod ? "ok" : "warn");
    }

    if(els.subirBloqueado){
      if(hasPeriod){ hide(els.subirBloqueado); }
      else{ show(els.subirBloqueado); }
    }

    if(els.subirContenido){
      els.subirContenido.classList.toggle("is-disabled", !hasPeriod);
    }

    setText("cargaResumenPeriodo", hasPeriod ? period.periodoCanonicoLabel : "—");

    if(els.btnGuardar){
      els.btnGuardar.disabled = busy || !hasPeriod || !selectedFile;
    }
  }

  function state(){
    if(window.CargaState && typeof window.CargaState.get === "function"){
      return window.CargaState.get();
    }
    if(window.CargaApp && typeof window.CargaApp.state === "function"){
      return window.CargaApp.state();
    }
    return {};
  }

  function appAvailable(){
    return !!(
      window.CargaApp &&
      typeof window.CargaApp.readFile === "function" &&
      typeof window.CargaApp.readClipboard === "function" &&
      typeof window.CargaApp.save === "function"
    );
  }

  function setBusy(value, message){
    busy = !!value;

    [els.btnGuardar, els.btnLimpiar, els.archivoInput, els.btnPeriodoCrear, els.btnPeriodoEditar, els.btnPeriodoBorrar].forEach(function(el){
      if(el){ el.disabled = busy; }
    });

    if(els.btnGuardar){
      els.btnGuardar.disabled = busy || !selectedFile || !selectedPeriod();
    }

    if(message){ setStatus("working", "Procesando", message); }
  }

  function setStatus(type, title, message){
    if(els.statusDot){
      els.statusDot.className = "carga-status-dot";
      if(type === "ok"){ els.statusDot.classList.add("is-ok"); }
      else if(type === "warning"){ els.statusDot.classList.add("is-warning"); }
      else if(type === "error"){ els.statusDot.classList.add("is-error"); }
      else if(type === "working"){ els.statusDot.classList.add("is-working"); }
    }

    if(els.statusText){ els.statusText.textContent = title || "Listo"; }
    if(els.statusMessage){ els.statusMessage.textContent = message || "Esperando archivo"; }
  }

  function showMessage(type, message){
    if(!els.messageBox){ return; }
    els.messageBox.className = "carga-message is-" + (type || "success");
    els.messageBox.textContent = message || "";
    show(els.messageBox);
  }

  function hideMessage(){
    if(!els.messageBox){ return; }
    els.messageBox.className = "carga-message carga-hidden";
    els.messageBox.textContent = "";
  }

  function validationStatus(st){
    st = st || {};
    var errors = Array.isArray(st.errors) ? st.errors.length : 0;
    var warnings = Array.isArray(st.warnings) ? st.warnings.length : 0;
    var total = Array.isArray(st.rows) ? st.rows.length : 0;

    if(!total){ return { type:"idle", label:"Sin carga" }; }
    if(errors){ return { type:"error", label:"Con errores" }; }
    if(warnings){ return { type:"warning", label:"Con advertencias" }; }
    return { type:"ok", label:"Lista" };
  }

  function renderSummary(){
    var st = state();
    var validation = validationStatus(st);
    var period = selectedPeriod();

    setText("cargaResumenArchivo", selectedFile ? selectedFile.name : (st.fileName || "—"));
    setText("cargaResumenPeriodo", period ? period.periodoCanonicoLabel : "—");
    setText("cargaResumenTotal", String(Array.isArray(st.rows) ? st.rows.length : 0));
    setText("cargaResumenEstado", validation.label);

    if(validation.type === "ok"){ setStatus("ok", "Carga lista", "Archivo leído y listo para guardar."); }
    else if(validation.type === "warning"){ setStatus("warning", "Con advertencias", "Se podrá guardar, pero quedará reportado."); }
    else if(validation.type === "error"){ setStatus("error", "Con errores", "Corrige el archivo antes de guardar."); }
  }

  function problemTitle(item, index){
    item = item || {};
    return "Fila " + (item.row || item.fila || item.index || index + 1) + " · " + text(item.tipo || item.type || "Revisión");
  }

  function problemMessage(item){
    item = item || {};
    return text(item.mensaje || item.message || item.campo || item.field || "Revisar registro.");
  }

  function renderProblemList(items, type){
    items = Array.isArray(items) ? items : [];
    if(!items.length){ return '<div class="carga-empty compact">Sin ' + (type === "error" ? "errores" : "advertencias") + '.</div>'; }

    return items.slice(0, 40).map(function(item, index){
      return ''
        + '<div class="carga-list-item">'
          + '<strong>' + esc(problemTitle(item, index)) + '</strong>'
          + '<small>' + esc(problemMessage(item)) + '</small>'
        + '</div>';
    }).join("") + (items.length > 40 ? '<div class="carga-empty compact">Se muestran 40 de ' + items.length + '.</div>' : '');
  }

  function renderProblems(){
    var st = state();
    var errors = Array.isArray(st.errors) ? st.errors : [];
    var warnings = Array.isArray(st.warnings) ? st.warnings : [];

    if(errors.length){ show(els.erroresBox); setHtml("cargaErroresList", renderProblemList(errors, "error")); }
    else{ hide(els.erroresBox); setHtml("cargaErroresList", ""); }

    if(warnings.length){ show(els.warningsBox); setHtml("cargaWarningsList", renderProblemList(warnings, "warning")); }
    else{ hide(els.warningsBox); setHtml("cargaWarningsList", ""); }
  }

  function renderResult(report){
    report = report || {};
    if(!els.resultadoBox){ return; }

    var total = report.total || report.totalEntrada || report.rows || 0;
    var saved = report.saved || report.guardados || report.nuevos || 0;
    var updated = report.updated || report.actualizados || 0;
    var merged = report.merged || report.duplicados || report.duplicadosCorregidos || 0;
    var warnings = report.warnings || report.advertencias || 0;

    if(Array.isArray(warnings)){ warnings = warnings.length; }

    setText("cargaResultTotal", total);
    setText("cargaResultGuardados", saved);
    setText("cargaResultActualizados", updated);
    setText("cargaResultDuplicados", merged);
    setText("cargaResultAdvertencias", warnings);
    show(els.resultadoBox);
  }

  function renderAll(report){
    renderSummary();
    renderProblems();
    renderSelectedPeriodState();
    if(report){ renderResult(report); }
  }

  function fileName(file){
    if(!file){ return "Ningún archivo seleccionado."; }
    var kb = file.size ? Math.max(1, Math.round(file.size / 1024)) : 0;
    return file.name + (kb ? " · " + kb + " KB" : "");
  }

  function detectHeaderWarnings(){
    var st = state();
    var rows = Array.isArray(st.rows) ? st.rows : [];
    if(!rows.length){ return []; }

    var keys = Object.keys(rows[0] || {});
    var current = keys.map(key);
    return REQUIRED_HEADERS.filter(function(header){
      return current.indexOf(key(header)) < 0;
    });
  }

  function extractCareersFromState(){
    var st = state();
    var rows = Array.isArray(st.rows) ? st.rows : [];
    var map = {};

    rows.forEach(function(row){
      row = row || {};
      var name = text(row.NombreCarrera || row.nombreCarrera || row.carrera || row.Carrera);
      var code = text(row.CodigoCarrera || row.codigoCarrera || row.codCarrera || row.CodCarrera);
      if(!name){ return; }
      var id = code || key(name);
      map[id] = { id:id, codigo:code, nombre:name };
    });

    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity:"base" });
    });
  }

  function uniqueCareers(careers){
    var map = {};
    (Array.isArray(careers) ? careers : []).forEach(function(item){
      if(!item){ return; }
      if(typeof item === "string"){
        item = { id:key(item), nombre:item, codigo:"" };
      }
      var id = text(item.id || item.codigo || key(item.nombre));
      if(!id){ return; }
      map[id] = {
        id:id,
        codigo:text(item.codigo || item.CodigoCarrera || ""),
        nombre:text(item.nombre || item.NombreCarrera || item.label || id)
      };
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity:"base" });
    });
  }

  function updatePeriodCareers(periodId, careers, totalStudents){
    var periods = getPeriods();
    var period = periods.filter(function(item){ return item.id === periodId; })[0];
    if(!period){ return; }

    period.carrerasDetectadas = uniqueCareers([].concat(period.carrerasDetectadas || [], careers || []));
    period.estudiantes = totalStudents || period.estudiantes || 0;
    period.updatedAt = nowISO();

    updateLocalPeriod(period);
    renderPeriodUI(getPeriods());
  }

  function processFile(file){
    if(!file){ return Promise.resolve(null); }

    if(!appAvailable()){
      showMessage("error", "CargaApp no está disponible. Revisa el orden de scripts en carga.html.");
      return Promise.reject(new Error("CargaApp no está disponible."));
    }

    var periodo = requirePeriod();
    if(!periodo){ return Promise.reject(new Error("Sin período seleccionado.")); }

    hideMessage();
    hide(els.resultadoBox);
    setBusy(true, "Leyendo archivo");

    return window.CargaApp.readFile(file, {
      periodoId: periodo.periodoId,
      periodoLabel: periodo.periodoLabel,
      periodoCanonicoId: periodo.periodoId,
      periodoCanonicoLabel: periodo.periodoLabel,
      fileName: file.name
    }).then(function(payload){
      var missing = detectHeaderWarnings();
      var st = state();
      var errors = Array.isArray(st.errors) ? st.errors.length : 0;
      var warnings = Array.isArray(st.warnings) ? st.warnings.length : 0;

      if(missing.length){
        showMessage("error", "El Excel no tiene todos los encabezados esperados. Faltan: " + missing.join(", ") + ".");
        setStatus("error", "Encabezados incompletos", "No se guardará hasta corregir el archivo.");
      }else if(errors){
        showMessage("error", "El archivo fue leído, pero tiene errores que bloquean el guardado.");
      }else if(warnings){
        showMessage("warning", "Archivo leído con advertencias. Se guardará solo si no hay errores.");
      }else{
        showMessage("success", "Archivo leído correctamente. Guardando en BDLocal...");
      }

      updatePeriodCareers(periodo.periodoId, extractCareersFromState(), Array.isArray(st.rows) ? st.rows.length : 0);
      renderAll();
      return payload;
    }).finally(function(){
      setBusy(false);
      renderAll();
    });
  }

  function saveCarga(){
    if(!appAvailable()){
      showMessage("error", "CargaApp no está disponible. No se puede guardar.");
      return Promise.reject(new Error("CargaApp no disponible."));
    }

    var st = state();
    if(!st.normalized || !Array.isArray(st.rows) || !st.rows.length){
      showMessage("warning", "Primero selecciona un archivo.");
      return Promise.resolve(null);
    }

    if(Array.isArray(st.errors) && st.errors.length){
      showMessage("error", "No se puede guardar porque existen errores en la carga.");
      return Promise.resolve(null);
    }

    var missing = detectHeaderWarnings();
    if(missing.length){
      showMessage("error", "No se puede guardar. Faltan encabezados: " + missing.join(", ") + ".");
      return Promise.resolve(null);
    }

    setBusy(true, "Guardando en BDLocal");
    hideMessage();
    updateSyncState({ base:"BDLocal", percent:5, pending:0, message:"Guardando carga" });

    return window.CargaApp.save({ sync:true }).then(function(report){
      renderAll(report);

      if(report && report.ok){
        showMessage("success", "Carga guardada correctamente en BDLocal. Se creó cola inteligente para sincronización.");
        setStatus("ok", "Carga guardada", "BDLocal actualizado.");
        updateSyncState({ base:"Firebase", percent:15, pending:report.changes || report.pendientes || 0, message:"Cola pendiente" });
      }else{
        showMessage("warning", report && report.message ? report.message : "La carga terminó con observaciones.");
        setStatus("warning", "Revisar resultado", "La carga terminó con observaciones.");
      }

      return report;
    }).catch(function(error){
      var message = error && error.message ? error.message : "No se pudo guardar la carga.";
      if(message.indexOf("BDLRepoEstudiantes") >= 0){
        message = "Carga ya leyó el archivo, pero falta conectar el guardado final con BL2Core/BDLocal. En el siguiente bloque se corrige carga.save.js.";
      }
      renderAll();
      setStatus("error", "Error al guardar", message);
      showMessage("error", message);
      throw error;
    }).finally(function(){
      setBusy(false);
      renderAll();
    });
  }

  function uploadAndSave(){
    if(!selectedFile){
      showMessage("warning", "Selecciona un archivo antes de subir.");
      return;
    }

    processFile(selectedFile).then(function(){
      return saveCarga();
    }).catch(function(error){
      if(error && error.message === "Sin período seleccionado."){ return; }
    });
  }

  function clearScreen(){
    try{
      if(window.CargaState && typeof window.CargaState.reset === "function"){
        window.CargaState.reset();
      }
    }catch(error){}

    selectedFile = null;
    if(els.archivoInput){ els.archivoInput.value = ""; }
    if(els.fileInfo){ els.fileInfo.textContent = "Ningún archivo seleccionado."; }

    hideMessage();
    hide(els.resultadoBox);
    hide(els.erroresBox);
    hide(els.warningsBox);

    setText("cargaResumenArchivo", "—");
    setText("cargaResumenTotal", "0");
    setText("cargaResumenEstado", "Sin carga");
    setHtml("cargaErroresList", "");
    setHtml("cargaWarningsList", "");

    setStatus("ok", "Listo", "Selecciona un período y un archivo.");
    renderSelectedPeriodState();
  }

  function processClipboard(){
    showMessage("warning", "La pantalla comprimida ya no usa pegado rápido. Usa el Excel oficial.");
    return Promise.resolve(null);
  }

  function onFileChange(event){
    selectedFile = event && event.target && event.target.files ? event.target.files[0] : null;
    if(els.fileInfo){ els.fileInfo.textContent = fileName(selectedFile); }
    renderSelectedPeriodState();
    if(selectedFile){
      setStatus("ok", "Archivo seleccionado", selectedFile.name);
      hideMessage();
    }
  }

  function bindDragAndDrop(){
    if(!els.dropzone){ return; }

    ["dragenter", "dragover"].forEach(function(name){
      els.dropzone.addEventListener(name, function(event){
        event.preventDefault();
        event.stopPropagation();
        els.dropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach(function(name){
      els.dropzone.addEventListener(name, function(event){
        event.preventDefault();
        event.stopPropagation();
        els.dropzone.classList.remove("is-dragover");
      });
    });

    els.dropzone.addEventListener("drop", function(event){
      var files = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files : [];
      if(files.length){
        selectedFile = files[0];
        if(els.fileInfo){ els.fileInfo.textContent = fileName(selectedFile); }
        if(els.archivoInput){ els.archivoInput.value = ""; }
        renderSelectedPeriodState();
        setStatus("ok", "Archivo seleccionado", selectedFile.name);
      }
    });
  }

  function divisionsStore(){
    return storageGet(LS_DIVISIONES, {});
  }

  function saveDivisionsStore(store){
    storageSet(LS_DIVISIONES, store || {});
  }

  function periodDivisions(periodId){
    var period = getPeriods().filter(function(item){ return item.id === periodId; })[0];
    var store = divisionsStore();
    var list = (store[periodId] && store[periodId].divisiones) || (period && period.divisiones) || [];
    return Array.isArray(list) ? list : [];
  }

  function updatePeriodDivisions(periodId, divisions){
    var store = divisionsStore();
    store[periodId] = store[periodId] || {};
    store[periodId].divisiones = divisions;
    store[periodId].updatedAt = nowISO();
    saveDivisionsStore(store);

    var period = getPeriods().filter(function(item){ return item.id === periodId; })[0];
    if(period){
      period.divisiones = divisions;
      period.updatedAt = nowISO();
      updateLocalPeriod(period);
      renderPeriodUI(getPeriods());
    }
  }

  function divisionId(name){
    return key(name) || ("division_" + Date.now());
  }

  function allAssignedCareerIds(divisions, exceptId){
    var map = {};
    (divisions || []).forEach(function(div){
      if(exceptId && div.id === exceptId){ return; }
      (div.carreras || []).forEach(function(career){
        map[text(career.id || career.codigo || key(career.nombre))] = div.id;
      });
    });
    return map;
  }

  function renderDivisionsModal(){
    var period = getPeriods().filter(function(item){ return item.id === modalPeriodId; })[0];
    if(!period){ return; }

    var careers = uniqueCareers(period.carrerasDetectadas || []);
    var divisions = periodDivisions(period.id);
    var assigned = allAssignedCareerIds(divisions);

    setText("cargaDivisionesPeriodo", period.periodoCanonicoLabel + " · " + period.id);

    if(els.divisionDestino){
      els.divisionDestino.innerHTML = divisions.length ? divisions.map(function(div){
        return '<option value="' + esc(div.id) + '">' + esc(div.nombre) + '</option>';
      }).join("") : '<option value="">Crea una división primero</option>';
    }

    if(els.carrerasDetectadas){
      if(!careers.length){
        els.carrerasDetectadas.innerHTML = '<div class="carga-empty compact">Todavía no hay carreras detectadas en este período.</div>';
      }else{
        els.carrerasDetectadas.innerHTML = careers.map(function(career){
          var id = text(career.id || career.codigo || key(career.nombre));
          var owner = assigned[id];
          var ownerName = "";
          if(owner){
            divisions.some(function(div){ if(div.id === owner){ ownerName = div.nombre; return true; } return false; });
          }
          return ''
            + '<label class="carga-check-item">'
              + '<input type="checkbox" value="' + esc(id) + '" data-career-name="' + esc(career.nombre) + '" data-career-code="' + esc(career.codigo || '') + '">'
              + '<span>' + esc(career.nombre) + '<small>' + esc(career.codigo || id) + (ownerName ? ' · En ' + ownerName : ' · Sin división') + '</small></span>'
            + '</label>';
        }).join("");
      }
    }

    if(els.divisionesLista){
      if(!divisions.length){
        els.divisionesLista.innerHTML = '<div class="carga-empty compact">Sin divisiones creadas.</div>';
      }else{
        els.divisionesLista.innerHTML = divisions.map(function(div){
          var careersHtml = (div.carreras || []).length ? (div.carreras || []).map(function(career){
            return '<span>' + esc(career.nombre || career.id) + '</span>';
          }).join("") : '<span>Sin carreras</span>';

          return ''
            + '<article class="carga-division-item" data-division-id="' + esc(div.id) + '">'
              + '<h3>' + esc(div.nombre) + '</h3>'
              + '<div class="carga-division-careers">' + careersHtml + '</div>'
              + '<div class="carga-period-actions"><button type="button" class="carga-btn carga-btn-light" data-action="delete-division">Eliminar división</button></div>'
            + '</article>';
        }).join("");
      }
    }
  }

  function openDivisions(periodId){
    modalPeriodId = periodId || (selectedPeriod() && selectedPeriod().id) || "";
    if(!modalPeriodId){
      showMessage("warning", "Selecciona un período para administrar divisiones.");
      return;
    }
    renderDivisionsModal();
    show(els.divisionesModal);
  }

  function closeDivisions(){
    modalPeriodId = "";
    hide(els.divisionesModal);
  }

  function createDivision(){
    if(!modalPeriodId){ return; }
    var name = text(els.divisionNombre ? els.divisionNombre.value : "");
    if(!name){
      showMessage("warning", "Escribe el nombre de la división.");
      return;
    }

    var divisions = periodDivisions(modalPeriodId);
    var id = divisionId(name);
    if(divisions.some(function(div){ return div.id === id; })){
      showMessage("warning", "Esa división ya existe.");
      return;
    }

    divisions.push({ id:id, nombre:name, carreras:[], createdAt:nowISO(), updatedAt:nowISO() });
    updatePeriodDivisions(modalPeriodId, divisions);
    if(els.divisionNombre){ els.divisionNombre.value = ""; }
    renderDivisionsModal();
  }

  function selectedCareersInModal(){
    if(!els.carrerasDetectadas){ return []; }
    return Array.prototype.map.call(els.carrerasDetectadas.querySelectorAll('input[type="checkbox"]:checked'), function(input){
      return {
        id: text(input.value),
        codigo: text(input.getAttribute("data-career-code")),
        nombre: text(input.getAttribute("data-career-name"))
      };
    }).filter(function(item){ return item.id && item.nombre; });
  }

  function annexCareers(){
    if(!modalPeriodId){ return; }
    var divisionTarget = text(els.divisionDestino ? els.divisionDestino.value : "");
    var careers = selectedCareersInModal();

    if(!divisionTarget){
      showMessage("warning", "Selecciona una división de destino.");
      return;
    }
    if(!careers.length){
      showMessage("warning", "Selecciona una o más carreras.");
      return;
    }

    var divisions = periodDivisions(modalPeriodId);
    var careerIds = careers.map(function(item){ return item.id; });

    divisions = divisions.map(function(div){
      var current = Array.isArray(div.carreras) ? div.carreras : [];
      current = current.filter(function(career){
        return careerIds.indexOf(text(career.id || career.codigo || key(career.nombre))) < 0;
      });

      if(div.id === divisionTarget){ current = uniqueCareers(current.concat(careers)); }

      return Object.assign({}, div, { carreras:current, updatedAt:nowISO() });
    });

    updatePeriodDivisions(modalPeriodId, divisions);
    renderDivisionsModal();
    showMessage("success", "Carreras anexadas. Una carrera solo queda en una división por período.");
  }

  function deleteDivision(divisionIdToDelete){
    if(!modalPeriodId || !divisionIdToDelete){ return; }
    if(!window.confirm("¿Eliminar esta división? Las carreras quedarán sin división hasta anexarlas a otra.")){ return; }
    var divisions = periodDivisions(modalPeriodId).filter(function(div){ return div.id !== divisionIdToDelete; });
    updatePeriodDivisions(modalPeriodId, divisions);
    renderDivisionsModal();
  }

  function saveDivisions(){
    if(!modalPeriodId){ return; }
    var divisions = periodDivisions(modalPeriodId);
    updatePeriodDivisions(modalPeriodId, divisions);
    closeDivisions();
    showMessage("success", "Divisiones guardadas para el período. La actualización masiva de estudiantes se completa desde BDLocal.");
  }

  function updateSyncState(data){
    data = Object.assign({ base:"Firebase", percent:0, pending:0, message:"En espera", ultimo:"sin actividad" }, data || {});
    storageSet(LS_SYNC, data);
    renderSync(data);
  }

  function renderSync(data){
    data = data || storageGet(LS_SYNC, { base:"Firebase", percent:0, pending:0, message:"En espera", ultimo:"sin actividad" });
    var percent = Math.max(0, Math.min(100, num(data.percent)));

    setText("cargaSyncBase", data.base || "Firebase");
    setText("cargaSyncTexto", percent + "% · Pendientes " + num(data.pending) + " · " + text(data.message || "En espera"));
    setText("cargaSyncUltimo", "Último resultado: " + text(data.ultimo || data.message || "sin actividad"));

    if(els.syncBar){ els.syncBar.style.width = percent + "%"; }
    if(els.syncChip){
      els.syncChip.textContent = num(data.pending) ? "Pendiente" : "BDLocal OK";
      els.syncChip.className = "carga-chip " + (num(data.pending) ? "warn" : "ok");
    }
  }

  function manualSync(){
    updateSyncState({ base:"Firebase", percent:10, pending:0, message:"Solicitud manual", ultimo:"preparando" });

    var engine = api("BDLSyncEngine");
    if(engine && typeof engine.syncBackground === "function"){
      try{
        engine.syncBackground();
        updateSyncState({ base:"Firebase", percent:35, pending:0, message:"Sincronización solicitada", ultimo:"solicitud enviada" });
        return;
      }catch(error){
        showMessage("warning", "No se pudo iniciar sincronización automática: " + error.message);
      }
    }

    window.dispatchEvent(new CustomEvent("bdlocal:sync-requested", { detail:{ source:"CargaUI", reason:"manual", at:nowISO() } }));
    showMessage("success", "Sincronización solicitada. Se ejecutará cuando la app esté libre y sin gastar créditos innecesarios.");
  }

  function bindEvents(){
    if(els.periodoSelect){
      els.periodoSelect.addEventListener("change", function(){
        var id = text(els.periodoSelect.value);
        var period = getPeriods().filter(function(item){ return item.id === id; })[0];
        selectedPeriodId = id;
        if(period){
          fillPeriodForm(period);
          setActivePeriod(period).then(function(){ renderPeriodUI(getPeriods()); });
        }else{
          localStorage.removeItem(LS_PERIODO);
          localStorage.removeItem(LS_PERIODO_LABEL);
          renderSelectedPeriodState();
        }
      });
    }

    if(els.btnPeriodoCrear){ els.btnPeriodoCrear.addEventListener("click", createPeriod); }
    if(els.btnPeriodoEditar){ els.btnPeriodoEditar.addEventListener("click", editPeriod); }
    if(els.btnPeriodoBorrar){ els.btnPeriodoBorrar.addEventListener("click", function(){ deletePeriod(); }); }
    if(els.btnCorregirDuplicados){ els.btnCorregirDuplicados.addEventListener("click", correctDuplicatePeriods); }
    if(els.archivoInput){ els.archivoInput.addEventListener("change", onFileChange); }
    if(els.btnGuardar){ els.btnGuardar.addEventListener("click", uploadAndSave); }
    if(els.btnLimpiar){ els.btnLimpiar.addEventListener("click", clearScreen); }
    if(els.btnSyncManual){ els.btnSyncManual.addEventListener("click", manualSync); }

    if(els.periodosCards){
      els.periodosCards.addEventListener("click", function(event){
        var button = event.target.closest("button[data-action]");
        var card = event.target.closest(".carga-period-card");
        if(!button || !card){ return; }
        var action = button.getAttribute("data-action");
        var periodId = card.getAttribute("data-period-id");
        var period = getPeriods().filter(function(item){ return item.id === periodId; })[0];

        if(action === "use" && period){ setActivePeriod(period).then(function(){ fillPeriodForm(period); renderPeriodUI(getPeriods()); }); }
        if(action === "edit" && period){ setActivePeriod(period).then(function(){ fillPeriodForm(period); renderPeriodUI(getPeriods()); }); }
        if(action === "delete"){ deletePeriod(periodId); }
        if(action === "divisions"){ openDivisions(periodId); }
      });
    }

    if(els.btnCerrarDivisiones){ els.btnCerrarDivisiones.addEventListener("click", closeDivisions); }
    if(els.btnCrearDivision){ els.btnCrearDivision.addEventListener("click", createDivision); }
    if(els.btnAnexarCarreras){ els.btnAnexarCarreras.addEventListener("click", annexCareers); }
    if(els.btnGuardarDivisiones){ els.btnGuardarDivisiones.addEventListener("click", saveDivisions); }

    Array.prototype.forEach.call(document.querySelectorAll("[data-carga-modal-close]"), function(node){
      node.addEventListener("click", closeDivisions);
    });

    if(els.divisionesLista){
      els.divisionesLista.addEventListener("click", function(event){
        var button = event.target.closest('button[data-action="delete-division"]');
        var item = event.target.closest(".carga-division-item");
        if(button && item){ deleteDivision(item.getAttribute("data-division-id")); }
      });
    }

    window.addEventListener("carga:status", function(event){
      var detail = event.detail || {};
      var status = text(detail.status || "");
      var message = text(detail.message || "");
      if(status === "error"){ setStatus("error", "Error", message); }
      else if(status === "done"){ setStatus("ok", "Finalizado", message); }
      else if(status === "ready"){ setStatus("ok", "Carga lista", message); }
      else if(status === "idle"){ setStatus("ok", "Listo", message || "Esperando archivo"); }
      else{ setStatus("working", "Procesando", message || status); }
    });

    window.addEventListener("carga:progress", function(event){
      var detail = event.detail || {};
      if(detail.message){ setStatus("working", "Procesando", detail.message); }
    });

    window.addEventListener("bdlocal:sync-progress", function(event){
      var detail = event.detail || {};
      updateSyncState({
        base: detail.base || detail.target || "Firebase",
        percent: detail.percent || detail.porcentaje || 0,
        pending: detail.pending || detail.pendientes || 0,
        message: detail.message || detail.estado || "Sincronizando",
        ultimo: detail.ultimo || detail.last || detail.message || "en proceso"
      });
    });

    window.addEventListener("bdlocal:changes-created", function(event){
      var detail = event.detail || {};
      updateSyncState({ base:"Firebase", percent:0, pending:detail.total || 0, message:"Cambios pendientes", ultimo:"cola creada" });
    });

    bindDragAndDrop();
  }

  function cacheElements(){
    els.periodoSelect = $("#cargaPeriodoSelect");
    els.periodoPersonalizadoWrap = $("#cargaPeriodoPersonalizadoWrap");
    els.periodoPersonalizado = $("#cargaPeriodoPersonalizado");
    els.periodoMesInicio = $("#cargaPeriodoMesInicio");
    els.periodoAnioInicio = $("#cargaPeriodoAnioInicio");
    els.periodoMesFin = $("#cargaPeriodoMesFin");
    els.periodoAnioFin = $("#cargaPeriodoAnioFin");
    els.periodosCards = $("#cargaPeriodosCards");
    els.btnPeriodoCrear = $("#cargaBtnPeriodoCrear");
    els.btnPeriodoEditar = $("#cargaBtnPeriodoEditar");
    els.btnPeriodoBorrar = $("#cargaBtnPeriodoBorrar");
    els.btnCorregirDuplicados = $("#cargaBtnCorregirDuplicados");

    els.periodoActivoChip = $("#cargaPeriodoActivoChip");
    els.subirBloqueado = $("#cargaSubirBloqueado");
    els.subirContenido = $("#cargaSubirContenido");
    els.archivoInput = $("#cargaArchivoInput");
    els.dropzone = $("#cargaDropzone");
    els.fileInfo = $("#cargaFileInfo");
    els.btnGuardar = $("#cargaBtnGuardar");
    els.btnLimpiar = $("#cargaBtnLimpiar");
    els.btnProcesarPegado = $("#cargaBtnProcesarPegado");
    els.pegadoTextarea = $("#cargaPegadoTextarea");

    els.messageBox = $("#cargaMessageBox");
    els.resultadoBox = $("#cargaResultadoBox");
    els.erroresBox = $("#cargaErroresBox");
    els.warningsBox = $("#cargaWarningsBox");
    els.previewTable = $("#cargaPreviewTable");

    els.statusDot = $("#cargaStatusDot");
    els.statusText = $("#cargaStatusText");
    els.statusMessage = $("#cargaStatusMessage");

    els.syncChip = $("#cargaSyncChip");
    els.syncBase = $("#cargaSyncBase");
    els.syncTexto = $("#cargaSyncTexto");
    els.syncUltimo = $("#cargaSyncUltimo");
    els.syncBar = $("#cargaSyncBar");
    els.btnSyncManual = $("#cargaBtnSyncManual");

    els.divisionesModal = $("#cargaDivisionesModal");
    els.btnCerrarDivisiones = $("#cargaBtnCerrarDivisiones");
    els.divisionNombre = $("#cargaDivisionNombre");
    els.btnCrearDivision = $("#cargaBtnCrearDivision");
    els.carrerasDetectadas = $("#cargaCarrerasDetectadas");
    els.divisionDestino = $("#cargaDivisionDestino");
    els.btnAnexarCarreras = $("#cargaBtnAnexarCarreras");
    els.divisionesLista = $("#cargaDivisionesLista");
    els.btnGuardarDivisiones = $("#cargaBtnGuardarDivisiones");
  }

  function boot(){
    if(uiReady){ return; }
    uiReady = true;

    cacheElements();
    selectedPeriodId = localStorage.getItem(LS_PERIODO) || "";
    bindEvents();
    renderSync();

    loadPeriods().then(function(periods){
      renderPeriodUI(periods);
      var selected = selectedPeriod();
      if(selected){ fillPeriodForm(selected); }
      clearScreen();
      renderPeriodUI(getPeriods());

      if(!appAvailable()){
        setStatus("error", "Carga incompleta", "No se encontró CargaApp.");
        showMessage("error", "La interfaz cargó, pero CargaApp no está disponible. Revisa rutas y orden de scripts en carga.html.");
        return;
      }

      setStatus("ok", "Listo", "Selecciona un período y sube el Excel oficial.");
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.CargaUI = {
    boot: boot,
    renderAll: renderAll,
    clearScreen: clearScreen,
    getSelectedPeriod: getSelectedPeriod,
    processFile: processFile,
    processClipboard: processClipboard,
    saveCarga: saveCarga,
    openDivisions: openDivisions,
    renderSync: renderSync
  };
})(window, document);
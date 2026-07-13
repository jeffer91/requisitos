/* =========================================================
Nombre completo: carga.ui.js
Ruta o ubicación: /Requisitos/Carga/carga.ui.js
Función o funciones:
- Controlar la pantalla Carga de estudiantes.
- Crear períodos y llenar los selectores sin mostrar tarjetas grandes.
- Analizar un archivo antes de permitir su guardado.
- Mostrar la comparación de cédulas y las tarjetas pequeñas del período.
- Abrir divisiones y ejecutar borrados con confirmación explícita.
Con qué se conecta:
- carga.html
- carga.app.js
- carga.state.js
- carga.divisiones.popup.js
- BDLocal / BL2Core
========================================================= */
(function(window, document){
  "use strict";

  var LS_PERIODOS = "carga.periodos.local";
  var LS_PERIODO = "carga.periodoSeleccionado";
  var LS_PERIODO_LABEL = "carga.periodoSeleccionadoLabel";
  var LS_DIVISIONES_PERIODO = "carga.divisiones.periodoSeleccionado";
  var LS_DIVISIONES = "carga.periodos.divisiones";

  var MONTHS = [
    ["01","Enero"],["02","Febrero"],["03","Marzo"],["04","Abril"],
    ["05","Mayo"],["06","Junio"],["07","Julio"],["08","Agosto"],
    ["09","Septiembre"],["10","Octubre"],["11","Noviembre"],["12","Diciembre"]
  ];

  var els = {};
  var selectedFile = null;
  var analyzedPeriodId = "";
  var busy = false;
  var ready = false;

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function byId(id){
    return document.getElementById(id);
  }

  function nowISO(){
    return new Date().toISOString();
  }

  function num(value){
    value = Number(value || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function show(node){
    if(node){
      node.classList.remove("carga-hidden");
    }
  }

  function hide(node){
    if(node){
      node.classList.add("carga-hidden");
    }
  }

  function setText(id, value){
    var node = byId(id);

    if(node){
      node.textContent = value;
    }
  }

  function api(name){
    try{
      if(window[name]){
        return window[name];
      }
    }catch(error){}

    try{
      if(
        window.parent &&
        window.parent !== window &&
        window.parent[name]
      ){
        return window.parent[name];
      }
    }catch(error2){}

    try{
      if(
        window.top &&
        window.top !== window &&
        window.top[name]
      ){
        return window.top[name];
      }
    }catch(error3){}

    return null;
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(
        new CustomEvent(name, {
          detail:detail || {}
        })
      );
    }catch(error){}
  }

  function storageGet(key, fallback){
    try{
      var raw = window.localStorage.getItem(key);

      if(raw == null || raw === ""){
        return fallback;
      }

      try{
        return JSON.parse(raw);
      }catch(error){
        return raw;
      }
    }catch(error2){
      return fallback;
    }
  }

  function storageSet(key, value){
    try{
      window.localStorage.setItem(
        key,
        typeof value === "string"
          ? value
          : JSON.stringify(value)
      );

      return true;
    }catch(error){
      return false;
    }
  }

  function canonicalPeriodId(value){
    value = text(value);

    var match = value.match(
      /^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/
    );

    return match
      ? match[1] + "-" + match[2] + "__" +
        match[3] + "-" + match[4]
      : value.replace(/_+/g, "__");
  }

  function normalizePeriod(period){
    period = period || {};

    var id = canonicalPeriodId(
      period.periodoCanonicoId ||
      period.periodoId ||
      period.id ||
      period.value ||
      ""
    );

    if(!id){
      return null;
    }

    var label = text(
      period.periodoCanonicoLabel ||
      period.periodoLabel ||
      period.label ||
      period.nombre ||
      id
    );

    return Object.assign({}, period, {
      id:id,
      value:id,
      periodoId:id,
      periodoCanonicoId:id,
      label:label,
      nombre:label,
      periodoLabel:label,
      periodoCanonicoLabel:label,

      divisiones:Array.isArray(period.divisiones)
        ? period.divisiones
        : [],

      carrerasDetectadas:Array.isArray(period.carrerasDetectadas)
        ? period.carrerasDetectadas
        : []
    });
  }

  function getPeriods(){
    var source = storageGet(LS_PERIODOS, []);
    var map = {};

    (Array.isArray(source) ? source : [])
      .map(normalizePeriod)
      .filter(Boolean)
      .forEach(function(period){
        map[period.id] = period;
      });

    return Object.keys(map)
      .map(function(id){
        return map[id];
      })
      .sort(function(a, b){
        return b.id.localeCompare(a.id);
      });
  }

  function savePeriods(periods){
    var map = {};

    (Array.isArray(periods) ? periods : [])
      .map(normalizePeriod)
      .filter(Boolean)
      .forEach(function(period){
        map[period.id] = Object.assign(
          {},
          map[period.id] || {},
          period
        );
      });

    var result = Object.keys(map)
      .map(function(id){
        return map[id];
      })
      .sort(function(a, b){
        return b.id.localeCompare(a.id);
      });

    storageSet(LS_PERIODOS, result);
    return result;
  }

  function mergePeriods(periods){
    var map = {};

    getPeriods()
      .concat(Array.isArray(periods) ? periods : [])
      .map(normalizePeriod)
      .filter(Boolean)
      .forEach(function(period){
        map[period.id] = Object.assign(
          {},
          map[period.id] || {},
          period
        );
      });

    return savePeriods(
      Object.keys(map).map(function(id){
        return map[id];
      })
    );
  }

  function periodById(id){
    id = canonicalPeriodId(id);

    return getPeriods().filter(function(period){
      return period.id === id;
    })[0] || null;
  }

  function selectedLoadPeriod(){
    return periodById(
      els.periodoSelect &&
      els.periodoSelect.value
    );
  }

  function selectedDivisionPeriod(){
    return periodById(
      els.divisionesPeriodoSelect &&
      els.divisionesPeriodoSelect.value
    );
  }

  function selectedDeletePeriod(){
    return periodById(
      els.borrarPeriodoSelect &&
      els.borrarPeriodoSelect.value
    );
  }

  function escapeHtml(value){
    return String(value == null ? "" : value)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function showMessage(type, message){
    var node = els.toast || els.messageBox;

    if(!node){
      return;
    }

    node.className =
      (node === els.toast
        ? "carga-toast "
        : "carga-message "
      ) +
      "is-" +
      (type || "success");

    node.textContent = message || "";

    show(node);

    window.clearTimeout(node.__timer);

    node.__timer = window.setTimeout(function(){
      hide(node);
    }, 5200);
  }

  function fillMonth(select, selected){
    if(!select){
      return;
    }

    select.innerHTML = MONTHS.map(function(item){
      return (
        '<option value="' +
        item[0] +
        '">' +
        item[1] +
        "</option>"
      );
    }).join("");

    select.value = selected;
  }

  function monthName(value){
    var found = MONTHS.filter(function(item){
      return item[0] === text(value);
    })[0];

    return found ? found[1] : text(value);
  }

  function renderPeriodSelectors(periods){
    periods = Array.isArray(periods)
      ? periods
      : getPeriods();

    var currentLoad = canonicalPeriodId(
      (els.periodoSelect && els.periodoSelect.value) ||
      storageGet(LS_PERIODO, "")
    );

    var currentDivision = canonicalPeriodId(
      (
        els.divisionesPeriodoSelect &&
        els.divisionesPeriodoSelect.value
      ) ||
      storageGet(LS_DIVISIONES_PERIODO, "")
    );

    var currentDelete = canonicalPeriodId(
      els.borrarPeriodoSelect &&
      els.borrarPeriodoSelect.value
    );

    var options =
      '<option value="">Seleccione un período...</option>' +
      periods.map(function(period){
        return (
          '<option value="' +
          escapeHtml(period.id) +
          '">' +
          escapeHtml(period.label) +
          "</option>"
        );
      }).join("");

    [
      els.periodoSelect,
      els.divisionesPeriodoSelect,
      els.borrarPeriodoSelect
    ].forEach(function(select){
      if(select){
        select.innerHTML = options;
      }
    });

    if(
      els.periodoSelect &&
      periodById(currentLoad)
    ){
      els.periodoSelect.value = currentLoad;
    }

    if(
      els.divisionesPeriodoSelect &&
      periodById(currentDivision)
    ){
      els.divisionesPeriodoSelect.value = currentDivision;
    }

    if(
      els.borrarPeriodoSelect &&
      periodById(currentDelete)
    ){
      els.borrarPeriodoSelect.value = currentDelete;
    }

    setText(
      "cargaPeriodosCount",
      periods.length +
      " período" +
      (periods.length === 1 ? "" : "s")
    );

    updateControls();
  }

  function createPeriod(){
    var fromMonth = text(els.periodoDesdeMes.value);
    var fromYear = Number(els.periodoDesdeAnio.value);
    var toMonth = text(els.periodoHastaMes.value);
    var toYear = Number(els.periodoHastaAnio.value);

    if(
      !/^\d{4}$/.test(String(fromYear)) ||
      !/^\d{4}$/.test(String(toYear))
    ){
      showMessage(
        "warning",
        "Escribe años válidos de cuatro dígitos."
      );

      return;
    }

    if(
      (toYear * 12 + Number(toMonth)) <
      (fromYear * 12 + Number(fromMonth))
    ){
      showMessage(
        "warning",
        "La fecha final no puede ser anterior a la inicial."
      );

      return;
    }

    var id =
      fromYear +
      "-" +
      fromMonth +
      "__" +
      toYear +
      "-" +
      toMonth;

    var label =
      monthName(fromMonth) +
      " " +
      fromYear +
      " a " +
      monthName(toMonth) +
      " " +
      toYear;

    if(periodById(id)){
      showMessage(
        "warning",
        "Ese período ya existe."
      );

      return;
    }

    var period = normalizePeriod({
      id:id,
      label:label,
      createdAt:nowISO(),
      updatedAt:nowISO(),
      divisiones:[],
      carrerasDetectadas:[]
    });

    savePeriods(
      getPeriods().concat([period])
    );

    renderPeriodSelectors();

    els.periodoSelect.value = id;
    onLoadPeriodChange();

    var core = api("BL2Core");

    if(
      core &&
      typeof core.savePeriod === "function"
    ){
      core.savePeriod(period).catch(function(){
        return null;
      });
    }

    showMessage(
      "success",
      "Período creado: " + label + "."
    );

    emit("carga:periods-local-updated", {
      total:getPeriods().length,
      period:period
    });
  }

  function formatDate(value){
    if(!value){
      return "—";
    }

    var date = new Date(value);

    if(Number.isNaN(date.getTime())){
      return text(value);
    }

    return date.toLocaleDateString("es-EC", {
      day:"2-digit",
      month:"2-digit",
      year:"numeric"
    });
  }

  function divisionCount(period){
    var count = Array.isArray(
      period && period.divisiones
    )
      ? period.divisiones.length
      : 0;

    var store = storageGet(LS_DIVISIONES, {});
    var saved = store && store[period && period.id];

    var list = Array.isArray(saved)
      ? saved
      : saved && Array.isArray(saved.divisiones)
        ? saved.divisiones
        : [];

    return Math.max(count, list.length);
  }

  function loadPeriodSummary(period){
    if(!period){
      setText("cargaStatStudents", "0");
      setText("cargaStatCareers", "0");
      setText("cargaStatDivisions", "0");
      setText("cargaStatLastLoad", "—");

      return Promise.resolve(null);
    }

    setText(
      "cargaResumenPeriodo",
      period.label
    );

    setText(
      "cargaStatDivisions",
      String(divisionCount(period))
    );

    setText(
      "cargaStatLastLoad",
      formatDate(
        period.lastLoadAt ||
        period.ultimaCarga ||
        period.updatedAt
      )
    );

    var core = api("BL2Core");

    if(
      !core ||
      typeof core.getStudents !== "function"
    ){
      setText(
        "cargaStatStudents",
        String(
          num(
            period.estudiantes ||
            period.totalEstudiantes
          )
        )
      );

      setText(
        "cargaStatCareers",
        String(
          (period.carrerasDetectadas || []).length
        )
      );

      return Promise.resolve(null);
    }

    return core.getStudents({
      periodoId:period.id,
      matricula:""
    }).then(function(students){
      students = Array.isArray(students)
        ? students
        : [];

      var careers = {};

      students.forEach(function(student){
        var name = text(
          student.nombreCarrera ||
          student.NombreCarrera ||
          student.carrera ||
          student.Carrera ||
          student.programa
        );

        if(name){
          careers[name.toLowerCase()] = true;
        }
      });

      setText(
        "cargaStatStudents",
        String(students.length)
      );

      setText(
        "cargaStatCareers",
        String(
          Object.keys(careers).length ||
          (period.carrerasDetectadas || []).length
        )
      );

      return students;
    }).catch(function(){
      return null;
    });
  }

  function loadDeleteSummary(period){
    if(!period){
      setText(
        "cargaBorrarResumen",
        "Seleccione un período para revisar lo que se borrará."
      );

      return Promise.resolve(null);
    }

    var core = api("BL2Core");

    if(
      !core ||
      typeof core.getStudents !== "function"
    ){
      setText(
        "cargaBorrarResumen",
        period.label +
        ": " +
        num(
          period.estudiantes ||
          period.totalEstudiantes
        ) +
        " estudiantes registrados."
      );

      return Promise.resolve(null);
    }

    return core.getStudents({
      periodoId:period.id,
      matricula:""
    }).then(function(students){
      students = Array.isArray(students)
        ? students
        : [];

      setText(
        "cargaBorrarResumen",
        period.label +
        ": " +
        students.length +
        " estudiantes registrados."
      );

      return students;
    }).catch(function(){
      setText(
        "cargaBorrarResumen",
        period.label +
        ": no se pudo consultar la cantidad de estudiantes."
      );

      return null;
    });
  }

  function renderList(node, items, empty, kind){
    if(!node){
      return;
    }

    items = Array.isArray(items)
      ? items
      : [];

    if(!items.length){
      node.innerHTML =
        '<div class="carga-empty">' +
        escapeHtml(empty) +
        "</div>";

      return;
    }

    node.innerHTML = items
      .slice(0, 60)
      .map(function(item){
        var message = text(
          item.mensaje ||
          item.message ||
          item.tipo ||
          item
        );

        return (
          '<div class="carga-list-item ' +
          kind +
          '">' +
          escapeHtml(message) +
          "</div>"
        );
      })
      .join("");
  }

  function renderValidation(){
    var current = (
      window.CargaState &&
      window.CargaState.get
    )
      ? window.CargaState.get()
      : {};

    renderList(
      els.warnings,
      current.warnings || [],
      "Sin alertas.",
      "warning"
    );

    renderList(
      els.errors,
      current.errors || [],
      "Sin errores.",
      "error"
    );
  }

  function renderGuard(guard){
    if(!guard){
      hide(els.guardBox);
      return;
    }

    show(els.guardBox);

    els.guardBox.className =
      "carga-guard " +
      (guard.ok ? "is-ok" : "is-blocked");

    setText(
      "cargaGuardTitle",
      guard.ok
        ? "Archivo aprobado"
        : "Carga bloqueada"
    );

    setText(
      "cargaGuardMessage",
      guard.message || ""
    );

    setText(
      "cargaGuardChip",
      guard.ok
        ? "Permitido"
        : "Bloqueado"
    );

    els.guardChip.className =
      "carga-chip " +
      (guard.ok ? "is-ok" : "is-danger");

    setText(
      "cargaGuardExisting",
      String(num(guard.existing))
    );

    setText(
      "cargaGuardFile",
      String(num(guard.inFile))
    );

    setText(
      "cargaGuardCommon",
      String(num(guard.common))
    );

    setText(
      "cargaGuardDifferent",
      String(num(guard.different))
    );

    setText(
      "cargaGuardPercent",
      num(guard.percent).toFixed(2) + "%"
    );

    analyzedPeriodId = guard.periodoId || "";

    els.btnGuardar.disabled =
      busy ||
      !guard.ok;
  }

  function setBusy(value, message){
    busy = !!value;

    [
      els.btnPeriodoCrear,
      els.btnAnalizar,
      els.btnGuardar,
      els.btnLimpiar,
      els.btnDivisiones,
      els.btnBorrarEstudiantes,
      els.btnBorrarPeriodo
    ].forEach(function(button){
      if(button){
        button.disabled = busy;
      }
    });

    if(message){
      setText(
        "cargaEstadoPill",
        message
      );
    }

    updateControls();
  }

  function updateControls(){
    var loadPeriod = selectedLoadPeriod();
    var divisionPeriod = selectedDivisionPeriod();
    var deletePeriod = selectedDeletePeriod();

    if(els.btnAnalizar){
      els.btnAnalizar.disabled =
        busy ||
        !loadPeriod ||
        !selectedFile;
    }

    if(els.btnGuardar){
      els.btnGuardar.disabled =
        busy ||
        !loadPeriod ||
        analyzedPeriodId !== loadPeriod.id ||
        !(
          window.CargaApp &&
          window.CargaApp.canSave &&
          window.CargaApp.canSave(loadPeriod)
        );
    }

    if(els.btnDivisiones){
      els.btnDivisiones.disabled =
        busy ||
        !divisionPeriod;
    }

    if(els.btnBorrarEstudiantes){
      els.btnBorrarEstudiantes.disabled =
        busy ||
        !deletePeriod;
    }

    if(els.btnBorrarPeriodo){
      els.btnBorrarPeriodo.disabled =
        busy ||
        !deletePeriod;
    }
  }

  function invalidateAnalysis(preserveStatus){
    analyzedPeriodId = "";

    hide(els.guardBox);

    if(
      window.CargaApp &&
      typeof window.CargaApp.invalidateAnalysis === "function"
    ){
      window.CargaApp.invalidateAnalysis();
    }

    if(!preserveStatus){
      setText(
        "cargaEstadoPill",
        "Sin analizar"
      );

      els.estadoPill.className =
        "carga-chip is-warn";
    }

    updateControls();
  }

  function onLoadPeriodChange(){
    var period = selectedLoadPeriod();

    if(period){
      storageSet(
        LS_PERIODO,
        period.id
      );

      storageSet(
        LS_PERIODO_LABEL,
        period.label
      );
    }else{
      try{
        localStorage.removeItem(LS_PERIODO);
        localStorage.removeItem(LS_PERIODO_LABEL);
      }catch(error){}
    }

    invalidateAnalysis();
    loadPeriodSummary(period);

    emit(
      "bl2:period-change",
      period
        ? {
            periodoId:period.id,
            periodoLabel:period.label,
            source:"CargaUI"
          }
        : {}
    );
  }

  function handleFile(file){
    selectedFile = file || null;

    setText(
      "cargaFileInfo",
      file
        ? file.name +
          " · " +
          Math.max(
            1,
            Math.round((file.size || 0) / 1024)
          ) +
          " KB"
        : "Ninguno seleccionado"
    );

    invalidateAnalysis();
  }

  function analyzeFile(){
    var period = selectedLoadPeriod();

    if(!period || !selectedFile){
      showMessage(
        "warning",
        "Selecciona un período y un archivo."
      );

      return;
    }

    if(
      !window.CargaApp ||
      typeof window.CargaApp.readFile !== "function"
    ){
      showMessage(
        "error",
        "CargaApp no está disponible."
      );

      return;
    }

    setBusy(true, "Analizando");

    window.CargaApp.readFile(
      selectedFile,
      {
        periodoId:period.id,
        periodoLabel:period.label,
        periodoCanonicoId:period.id,
        periodoCanonicoLabel:period.label,
        localOnly:true,
        sync:false
      }
    ).then(function(){
      renderValidation();

      return window.CargaApp.compareWithPeriod(
        period
      );
    }).then(function(guard){
      renderGuard(guard);

      els.estadoPill.className =
        "carga-chip " +
        (guard.ok ? "is-ok" : "is-danger");

      setText(
        "cargaEstadoPill",
        guard.ok
          ? "Aprobado"
          : "Bloqueado"
      );

      if(!guard.ok){
        showMessage(
          "error",
          guard.message
        );
      }
    }).catch(function(error){
      renderValidation();

      showMessage(
        "error",
        error.message || String(error)
      );
    }).finally(function(){
      setBusy(false);
      updateControls();
    });
  }

  function saveCarga(){
    var period = selectedLoadPeriod();

    if(
      !period ||
      analyzedPeriodId !== period.id
    ){
      showMessage(
        "warning",
        "Analiza nuevamente el archivo."
      );

      return;
    }

    setBusy(true, "Guardando");

    window.CargaApp.save({
      periodoId:period.id,
      periodoLabel:period.label,
      localOnly:true,
      sync:false,
      cloudSync:false,
      manualCloudSync:true
    }).then(function(report){
      if(report && report.ok !== false){
        period.lastLoadAt = nowISO();
        period.updatedAt = period.lastLoadAt;

        savePeriods(
          getPeriods().map(function(item){
            return item.id === period.id
              ? Object.assign({}, item, period)
              : item;
          })
        );

        showMessage(
          "success",
          "Carga guardada correctamente en BDLocal."
        );

        setText(
          "cargaEstadoPill",
          "Guardado"
        );

        els.estadoPill.className =
          "carga-chip is-ok";

        loadPeriodSummary(period);
        invalidateAnalysis(true);
      }else{
        showMessage(
          "error",
          report && report.message
            ? report.message
            : "No se pudo guardar."
        );
      }

      return report;
    }).catch(function(error){
      showMessage(
        "error",
        error.message || String(error)
      );
    }).finally(function(){
      setBusy(false);
      updateControls();
    });
  }

  function clearScreen(){
    selectedFile = null;
    analyzedPeriodId = "";

    if(els.archivoInput){
      els.archivoInput.value = "";
    }

    if(
      window.CargaState &&
      window.CargaState.reset
    ){
      window.CargaState.reset();
    }

    setText(
      "cargaFileInfo",
      "Ninguno seleccionado"
    );

    renderList(
      els.warnings,
      [],
      "Sin alertas.",
      "warning"
    );

    renderList(
      els.errors,
      [],
      "Sin errores.",
      "error"
    );

    invalidateAnalysis();
  }

  function openDivisions(){
    var period = selectedDivisionPeriod();

    if(!period){
      showMessage(
        "warning",
        "Selecciona un período."
      );

      return;
    }

    storageSet(
      LS_DIVISIONES_PERIODO,
      period.id
    );

    if(
      window.CargaDivisionesPopup &&
      typeof window.CargaDivisionesPopup.open === "function"
    ){
      window.CargaDivisionesPopup.open(period);
    }else{
      showMessage(
        "error",
        "El administrador de divisiones no está disponible."
      );
    }
  }

  function confirmDelete(period, full){
    var action = full
      ? "borrar completamente el período"
      : "borrar sus estudiantes";

    if(
      !window.confirm(
        "Vas a " +
        action +
        ":\n\n" +
        period.label +
        "\n\nEsta acción no se puede deshacer."
      )
    ){
      return false;
    }

    return text(
      window.prompt(
        "Para confirmar, escribe ELIMINAR:",
        ""
      )
    ) === "ELIMINAR";
  }

  function removeLocalPeriod(periodId){
    savePeriods(
      getPeriods().filter(function(period){
        return period.id !== periodId;
      })
    );

    var stores = storageGet(
      LS_DIVISIONES,
      {}
    );

    if(stores && stores[periodId]){
      delete stores[periodId];

      storageSet(
        LS_DIVISIONES,
        stores
      );
    }

    if(
      canonicalPeriodId(
        storageGet(LS_PERIODO, "")
      ) === periodId
    ){
      try{
        localStorage.removeItem(LS_PERIODO);
        localStorage.removeItem(LS_PERIODO_LABEL);
      }catch(error){}
    }
  }

  function deleteData(full){
    var period = selectedDeletePeriod();

    if(
      !period ||
      !confirmDelete(period, full)
    ){
      return;
    }

    if(!window.CargaApp){
      showMessage(
        "error",
        "CargaApp no está disponible."
      );

      return;
    }

    var method = full
      ? "deletePeriod"
      : "deleteStudentsByPeriod";

    if(
      typeof window.CargaApp[method] !== "function"
    ){
      showMessage(
        "error",
        "BDLocal todavía no expone esta función de borrado."
      );

      return;
    }

    setBusy(true, "Borrando");

    window.CargaApp[method](period)
      .then(function(result){
        if(full){
          removeLocalPeriod(period.id);
        }

        renderPeriodSelectors();

        loadDeleteSummary(
          full ? null : period
        );

        showMessage(
          "success",
          result && result.message
            ? result.message
            : "Borrado completado."
        );

        emit("carga:data-deleted", {
          full:full,
          periodoId:period.id,
          result:result || {}
        });
      })
      .catch(function(error){
        showMessage(
          "error",
          error.message || String(error)
        );
      })
      .finally(function(){
        setBusy(false);
        updateControls();
      });
  }

  function loadPeriods(){
    var connection =
      api("ConCarga") ||
      api("BDLocalCarga");

    var core = api("BL2Core");

    var promise =
      connection &&
      typeof connection.getPeriods === "function"
        ? connection.getPeriods()
        : core &&
          typeof core.getPeriods === "function"
            ? core.getPeriods()
            : Promise.resolve([]);

    return Promise.resolve(promise)
      .then(function(periods){
        return mergePeriods(periods || []);
      })
      .catch(function(){
        return getPeriods();
      });
  }

  function cacheElements(){
    els.periodoDesdeMes =
      byId("cargaPeriodoDesdeMes");

    els.periodoDesdeAnio =
      byId("cargaPeriodoDesdeAnio");

    els.periodoHastaMes =
      byId("cargaPeriodoHastaMes");

    els.periodoHastaAnio =
      byId("cargaPeriodoHastaAnio");

    els.btnPeriodoCrear =
      byId("cargaBtnPeriodoCrear");

    els.periodoSelect =
      byId("cargaPeriodoSelect");

    els.archivoInput =
      byId("cargaArchivoInput");

    els.dropzone =
      byId("cargaDropzone");

    els.btnAnalizar =
      byId("cargaBtnAnalizar");

    els.btnGuardar =
      byId("cargaBtnGuardar");

    els.btnLimpiar =
      byId("cargaBtnLimpiar");

    els.estadoPill =
      byId("cargaEstadoPill");

    els.guardBox =
      byId("cargaGuardBox");

    els.guardChip =
      byId("cargaGuardChip");

    els.warnings =
      byId("cargaWarnings");

    els.errors =
      byId("cargaErrors");

    els.divisionesPeriodoSelect =
      byId("cargaDivisionesPeriodoSelect");

    els.btnDivisiones =
      byId("cargaBtnDivisionesPeriodo");

    els.borrarPeriodoSelect =
      byId("cargaBorrarPeriodoSelect");

    els.btnBorrarEstudiantes =
      byId("cargaBtnBorrarEstudiantes");

    els.btnBorrarPeriodo =
      byId("cargaBtnBorrarPeriodoCompleto");

    els.messageBox =
      byId("cargaMessageBox");

    els.toast =
      byId("cargaToast");
  }

  function bindEvents(){
    els.btnPeriodoCrear.addEventListener(
      "click",
      createPeriod
    );

    els.periodoSelect.addEventListener(
      "change",
      onLoadPeriodChange
    );

    els.divisionesPeriodoSelect.addEventListener(
      "change",
      function(){
        var period = selectedDivisionPeriod();

        if(period){
          storageSet(
            LS_DIVISIONES_PERIODO,
            period.id
          );
        }

        updateControls();
      }
    );

    els.borrarPeriodoSelect.addEventListener(
      "change",
      function(){
        loadDeleteSummary(
          selectedDeletePeriod()
        );

        updateControls();
      }
    );

    els.archivoInput.addEventListener(
      "change",
      function(){
        handleFile(
          this.files &&
          this.files[0]
        );
      }
    );

    els.btnAnalizar.addEventListener(
      "click",
      analyzeFile
    );

    els.btnGuardar.addEventListener(
      "click",
      saveCarga
    );

    els.btnLimpiar.addEventListener(
      "click",
      clearScreen
    );

    els.btnDivisiones.addEventListener(
      "click",
      openDivisions
    );

    els.btnBorrarEstudiantes.addEventListener(
      "click",
      function(){
        deleteData(false);
      }
    );

    els.btnBorrarPeriodo.addEventListener(
      "click",
      function(){
        deleteData(true);
      }
    );

    ["dragenter", "dragover"].forEach(function(name){
      els.dropzone.addEventListener(
        name,
        function(event){
          event.preventDefault();
          els.dropzone.classList.add("is-over");
        }
      );
    });

    ["dragleave", "drop"].forEach(function(name){
      els.dropzone.addEventListener(
        name,
        function(event){
          event.preventDefault();
          els.dropzone.classList.remove("is-over");
        }
      );
    });

    els.dropzone.addEventListener(
      "drop",
      function(event){
        handleFile(
          event.dataTransfer &&
          event.dataTransfer.files &&
          event.dataTransfer.files[0]
        );
      }
    );

    window.addEventListener(
      "carga:divisions-saved",
      function(event){
        var id =
          event.detail &&
          event.detail.periodoId;

        var period = periodById(id);

        if(period){
          loadPeriodSummary(period);
        }
      }
    );

    window.addEventListener(
      "carga:periods-refreshed",
      function(){
        renderPeriodSelectors();
      }
    );

    window.addEventListener(
      "storage",
      function(event){
        if(
          event.key === LS_PERIODOS ||
          event.key === LS_DIVISIONES
        ){
          renderPeriodSelectors();
          loadPeriodSummary(
            selectedLoadPeriod()
          );
        }
      }
    );
  }

  function boot(){
    if(ready){
      return;
    }

    ready = true;

    cacheElements();
    bindEvents();

    fillMonth(
      els.periodoDesdeMes,
      "04"
    );

    fillMonth(
      els.periodoHastaMes,
      "09"
    );

    var year = new Date().getFullYear();

    els.periodoDesdeAnio.value = year;
    els.periodoHastaAnio.value = year;

    loadPeriods().then(function(periods){
      renderPeriodSelectors(periods);

      var stored = canonicalPeriodId(
        storageGet(LS_PERIODO, "")
      );

      if(
        stored &&
        periodById(stored)
      ){
        els.periodoSelect.value = stored;
      }

      onLoadPeriodChange();
      clearScreen();
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  }else{
    boot();
  }

  window.CargaUI = {
    boot:boot,
    renderPeriodSelectors:renderPeriodSelectors,
    loadPeriodSummary:loadPeriodSummary,
    analyzeFile:analyzeFile,
    saveCarga:saveCarga,
    clearScreen:clearScreen,
    openDivisions:openDivisions,
    getSelectedPeriod:selectedLoadPeriod
  };
})(window, document);
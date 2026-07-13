/* =========================================================
Nombre completo: ficha.app.js
Ruta o ubicación: /Requisitos/Ficha/ficha.app.js
Función:
- Control visual rápido de Ficha.
- No reconstruye toda la pantalla al seleccionar.
- En búsqueda solo filtra y pinta lista; no carga detalle automático.
- El detalle se llena únicamente al hacer clic en un estudiante.
- Abre WhatsApp bajo demanda.
- Abre Outlook/correo predeterminado con correo personal + institucional.
========================================================= */
(function(window, document){
  "use strict";

  var state = {
    periodId:"",
    division:"",
    matricula:"ACTIVO",
    search:"",
    rows:[],
    selectedId:"",
    selectedDetail:null,
    renderTimer:null,
    detailTimer:null,
    refreshTimer:null,
    modalidadTimer:null,
    divisionKey:"",
    divisionOptions:[],
    filtersReady:false,
    listBound:false,
    bdlocalBound:false,
    loading:{},
    loaded:{}
  };

  function el(id){ return document.getElementById(id); }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function esc(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setText(id, value){
    var node = el(id);
    if(node){ node.textContent = text(value) || "—"; }
  }

  function setHtml(id, value){
    var node = el(id);
    if(node){ node.innerHTML = value; }
  }

  function status(message, cls){
    var node = el("ficha-status");
    if(node){
      node.textContent = message;
      node.className = "ficha-status " + (cls || "");
    }
  }

  function option(value, label, selected){
    return '<option value="' + esc(value) + '" ' + (selected ? "selected" : "") + ">" + esc(label) + "</option>";
  }

  function bindIf(id, eventName, handler){
    var node = el(id);
    if(node){ node.addEventListener(eventName, handler); }
  }

  function rowId(row){
    return text(row && (row._id || row._cedula));
  }

  function selectedMatches(row){
    return rowId(row) === text(state.selectedId);
  }

  function sourceLabel(){
    return window.FichaCore && typeof window.FichaCore.source === "function"
      ? window.FichaCore.source()
      : "Base Local";
  }

  function selectedFromRows(){
    var wanted = text(state.selectedId);
    return state.rows.find(function(row){
      return text(row._id) === wanted || text(row._cedula) === wanted;
    }) || null;
  }

  function selectedFull(){
    return state.selectedDetail || selectedFromRows();
  }

  function loadScript(src){
    if(state.loaded[src] || document.querySelector('script[data-ficha-lazy="' + src + '"]')){
      state.loaded[src] = true;
      return Promise.resolve();
    }

    if(state.loading[src]){
      return state.loading[src];
    }

    state.loading[src] = new Promise(function(resolve, reject){
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.setAttribute("data-ficha-lazy", src);

      script.onload = function(){
        state.loaded[src] = true;
        resolve();
      };

      script.onerror = function(){
        delete state.loading[src];
        reject(new Error("No se pudo cargar " + src));
      };

      document.body.appendChild(script);
    });

    return state.loading[src];
  }

  function ensureExport(){
    if(window.FichaExport && typeof window.FichaExport.copyText === "function"){
      return Promise.resolve();
    }
    return loadScript("ficha.export.js");
  }

  function ensureModalidad(){
    if(window.FichaModalidad && typeof window.FichaModalidad.current === "function"){
      return Promise.resolve();
    }
    return loadScript("ficha.modalidad.js");
  }

  function copyText(value, successMessage){
    return ensureExport().then(function(){
      if(window.FichaExport && typeof window.FichaExport.copyText === "function"){
        return window.FichaExport.copyText(value || "");
      }

      if(navigator.clipboard && navigator.clipboard.writeText){
        return navigator.clipboard.writeText(value || "");
      }

      throw new Error("No se pudo copiar al portapapeles.");
    }).then(function(){
      status(successMessage || "Copiado.", "ok");
    }).catch(function(error){
      console.error("[Ficha copiar]", error);
      status(error.message || String(error), "warn");
    });
  }

  function scheduleRender(reason){
    if(state.renderTimer){
      clearTimeout(state.renderTimer);
    }

    state.renderTimer = setTimeout(function(){
      state.renderTimer = null;
      render(reason || "programado");
    }, 260);
  }

  function periodId(item){
    return text(item && typeof item === "object" ? (item.id || item.periodoId || item.value || item.key || item.label || item.periodoLabel) : item);
  }

  function periodLabel(item){
    return text(item && typeof item === "object" ? (item.label || item.periodoLabel || item.nombre || item.name || item.id || item.periodoId) : item);
  }

  function fillPeriodAndMatricula(){
    var periodSelect = el("ficha-periodo");
    var matriculaSelect = el("ficha-matricula");

    if(periodSelect){
      var list = window.FichaCore.periods() || [];

      periodSelect.innerHTML = option("", "Todos", !state.periodId) + list.map(function(item){
        var id = periodId(item);
        return option(id, periodLabel(item) || id, state.periodId === id);
      }).join("");

      periodSelect.value = state.periodId;
    }

    if(matriculaSelect){
      matriculaSelect.value = state.matricula;
    }
  }

  function getDivisionOptions(){
    var key = [state.periodId, state.matricula, sourceLabel()].join("|");

    if(state.divisionKey === key && Array.isArray(state.divisionOptions)){
      return state.divisionOptions;
    }

    state.divisionOptions = window.FichaCore.divisions(null, {
      periodId:state.periodId,
      matricula:state.matricula
    }) || [];

    state.divisionKey = key;

    return state.divisionOptions;
  }

  function fillDivisionFilter(){
    var div = el("ficha-division");
    if(!div){ return; }

    var divisions = getDivisionOptions();

    div.innerHTML = option("", "Todas", !state.division) + divisions.map(function(value){
      return option(value, value, state.division === value);
    }).join("");

    if(state.division && divisions.indexOf(state.division) < 0){
      state.division = "";
      div.value = "";
    }else{
      div.value = state.division;
    }
  }

  function fillFilters(){
    fillPeriodAndMatricula();
    fillDivisionFilter();
    state.filtersReady = true;
  }

  function shouldFillFilters(reason){
    if(!state.filtersReady){ return true; }

    return [
      "boot",
      "periodo",
      "matricula",
      "refresh",
      "bdlocal-refresh",
      "modalidad"
    ].indexOf(reason || "") >= 0;
  }

  function invalidateDivisionOptions(){
    state.divisionKey = "";
    state.divisionOptions = [];
    state.filtersReady = false;
  }

  function estadoClass(estado){
    if(estado && estado.id === "cumple"){ return "ficha-pill-ok"; }
    if(estado && estado.id === "no_cumple"){ return "ficha-pill-bad"; }
    return "ficha-pill-warn";
  }

  function bindListOnce(){
    var box = el("ficha-list");

    if(!box || state.listBound){ return; }

    box.addEventListener("click", function(event){
      var btn = event.target.closest ? event.target.closest("[data-id]") : null;
      if(btn){ select(btn.getAttribute("data-id")); }
    });

    state.listBound = true;
  }

  function setListActive(id){
    var box = el("ficha-list");
    if(!box){ return; }

    var wanted = text(id);
    var items = box.querySelectorAll("[data-id]");
    var i;

    for(i = 0; i < items.length; i += 1){
      items[i].classList.toggle("is-active", text(items[i].getAttribute("data-id")) === wanted);
    }
  }

  function renderList(){
    var box = el("ficha-list");
    var count = el("ficha-count");

    if(count){ count.textContent = String(state.rows.length); }
    if(!box){ return; }

    bindListOnce();

    if(!state.rows.length){
      box.innerHTML = '<div class="empty-list">Sin estudiantes. Primero carga un Excel en Carga o cambia los filtros.</div>';
      return;
    }

    box.innerHTML = state.rows.slice(0, 400).map(function(row){
      var id = rowId(row);

      return '' +
        '<button type="button" class="ficha-item' + (id === state.selectedId ? " is-active" : "") + '" data-id="' + esc(id) + '">' +
          '<strong>' + esc(row._nombres || "Sin nombre") + '</strong>' +
          '<span>' +
            esc(row._cedula) + ' · ' +
            esc(row._carrera) + ' · ' +
            esc(row._division || "Sin división") + ' · ' +
            esc(row._estadoMatricula || "ACTIVO") +
          '</span>' +
        '</button>';
    }).join("");
  }

  function reqClass(item){
    return item.estado === "cumple" ? "ficha-pill-ok" : "ficha-pill-bad";
  }

  function renderReqs(row){
    var box = el("ficha-requisitos");
    var expectedId = rowId(row);

    if(!box){ return; }
    if(!row){ box.innerHTML = ""; return; }

    box.innerHTML = '<div class="empty-list">Cargando requisitos...</div>';

    setTimeout(function(){
      if(expectedId && expectedId !== text(state.selectedId)){ return; }

      try{
        var reqs = window.FichaCore.requisitos(row);

        if(expectedId && expectedId !== text(state.selectedId)){ return; }

        box.innerHTML = reqs.map(function(item){
          return '' +
            '<div class="ficha-req">' +
              '<span class="ficha-req-name">' + esc(item.label) + '</span>' +
              '<span class="ficha-req-value ' + reqClass(item) + '">' +
                esc(item.estado === "cumple" ? "CUMPLE" : "NO CUMPLE") +
              '</span>' +
            '</div>';
        }).join("");
      }catch(error){
        console.error("[Ficha requisitos]", error);
        box.innerHTML = '<div class="empty-list">No se pudieron cargar los requisitos.</div>';
      }
    }, 0);
  }

  function renderNotas(row){
    var box = el("ficha-notas");

    if(!box){ return; }
    if(!row){ box.innerHTML = ""; return; }

    try{
      var notas = window.FichaCore.notas ? window.FichaCore.notas(row) : [];

      box.innerHTML = notas.map(function(note){
        var ok = note.estado === "cumple";

        return '' +
          '<article class="ficha-note ' + (ok ? "ficha-note-ok" : "ficha-note-bad") + '">' +
            '<span>' + esc(note.label) + '</span>' +
            '<strong>' + esc(note.value) + '</strong>' +
          '</article>';
      }).join("");
    }catch(error){
      console.error("[Ficha notas]", error);
      box.innerHTML = '<div class="empty-list">No se pudieron cargar las notas.</div>';
    }
  }

  function applySpecialBadge(id, item){
    var node = el(id);

    if(!node){ return; }

    if(!item){
      node.className = "ficha-mini-badge ficha-badge-bad";
      node.title = "Sin información";
      node.setAttribute("aria-label", "Sin información");
      return;
    }

    var ok = item.estado === "cumple";

    node.className = "ficha-mini-badge " + (ok ? "ficha-badge-ok" : "ficha-badge-bad");
    node.title = item.label + ": " + (ok ? "CUMPLE" : "NO CUMPLE");
    node.setAttribute("aria-label", node.title);
  }

  function renderSpecials(row){
    try{
      var list = window.FichaCore.especiales ? window.FichaCore.especiales(row) : [];

      applySpecialBadge("ficha-special-titulacion", list.find(function(item){
        return item.key === "aprobaciontitulacion";
      }));

      applySpecialBadge("ficha-special-complexivo", list.find(function(item){
        return item.key === "aprobacioncomplexivoproyecto";
      }));
    }catch(error){
      console.error("[Ficha especiales]", error);
      applySpecialBadge("ficha-special-titulacion", null);
      applySpecialBadge("ficha-special-complexivo", null);
    }
  }

  function headerLine(label, value){
    return '' +
      '<div class="ficha-identity-row">' +
        '<span>' + esc(label) + '</span>' +
        '<strong>' + esc(value || "—") + '</strong>' +
      '</div>';
  }

  function periodDisplay(row){
    if(window.FichaCore && typeof window.FichaCore.periodDisplay === "function"){
      return window.FichaCore.periodDisplay(row);
    }

    return text(row && (row._periodoNormalizado || row._periodo || row.periodoLabel || row.periodoId || row.ultimoPeriodoId || row.periodo)) || "Sin período";
  }

  function renderHeaderIdentity(row){
    var box = el("ficha-identidad");

    if(!box){ return; }

    box.innerHTML = [
      headerLine("Cédula", row._cedula || "—"),
      headerLine("Carrera", row._carrera || "Sin carrera"),
      headerLine("Período", periodDisplay(row))
    ].join("");
  }

  function setModalidadLoading(message){
    var select = el("ficha-modalidad-select");
    var info = el("ficha-modalidad-info");
    var btn = el("ficha-modalidad-save");

    if(select){
      select.innerHTML = option("", "Cargando...", true);
      select.disabled = true;
    }

    if(btn){
      btn.disabled = true;
      btn.textContent = "Guardar modalidad";
    }

    if(info){
      info.textContent = message || "Cargando modalidad...";
      info.className = "ficha-modalidad-info";
    }
  }

  function renderModalidad(row){
    var select = el("ficha-modalidad-select");
    var infoBox = el("ficha-modalidad-info");
    var btn = el("ficha-modalidad-save");

    if(!select){ return; }

    if(!row){
      select.innerHTML = "";
      if(infoBox){ infoBox.textContent = "—"; }
      return;
    }

    if(!selectedMatches(row)){ return; }

    ensureModalidad().then(function(){
      if(!selectedMatches(row)){ return; }

      if(!window.FichaModalidad){
        throw new Error("FichaModalidad no disponible.");
      }

      var info = window.FichaModalidad.current(row || {});
      var opts = window.FichaModalidad.options(row || {});

      if(!selectedMatches(row)){ return; }

      select.innerHTML = opts.map(function(item){
        return option(item.value, item.label, item.value === info.value);
      }).join("");

      select.value = info.value;
      select.disabled = !!info.locked;

      if(btn){
        btn.disabled = !!info.locked;
        btn.textContent = info.locked ? "Modalidad fija" : "Guardar modalidad";
      }

      if(infoBox){
        infoBox.textContent = (info.periodType.label || "—") + " · " + info.label + " · " + (info.source === "guardado" ? "guardado" : "automático");
        infoBox.className = "ficha-modalidad-info " + (info.locked ? "locked" : "");
      }
    }).catch(function(error){
      console.error("[Ficha modalidad]", error);

      if(infoBox){
        infoBox.textContent = error.message || "No se pudo cargar modalidad.";
        infoBox.className = "ficha-modalidad-info locked";
      }
    });
  }

  function scheduleModalidad(row){
    if(state.modalidadTimer){
      clearTimeout(state.modalidadTimer);
    }

    if(!row){
      renderModalidad(null);
      return;
    }

    setModalidadLoading("Preparando modalidad...");

    state.modalidadTimer = setTimeout(function(){
      state.modalidadTimer = null;

      if(selectedMatches(row)){
        renderModalidad(row);
      }
    }, 120);
  }

  function correoPrincipal(row){
    row = row || {};
    return text(row._correoPersonal || row._correoInstitucional || row._correo || row.correoPersonal || row.correoInstitucional || row.correo);
  }

  function emailList(row){
    if(window.FichaCore && typeof window.FichaCore.emailList === "function"){
      return window.FichaCore.emailList(row || {});
    }

    row = row || {};

    var list = [
      row._correoPersonal,
      row._correoInstitucional,
      row._correo,
      row.correoPersonal,
      row.correoInstitucional,
      row.correo
    ].map(text).filter(Boolean);

    var seen = {};
    return list.filter(function(email){
      var key = email.toLowerCase();
      if(seen[key]){ return false; }
      seen[key] = true;
      return email.indexOf("@") > 0;
    });
  }

  function phoneFromRow(row){
    row = row || {};
    return text(row._celular || row.celular || row.Celular || row.telefono || row.Telefono || row.whatsapp || row.WhatsApp).replace(/[^0-9]/g, "");
  }

  function updateCommunicationButtons(row){
    var email = el("ficha-email");
    var whatsapp = el("ficha-whatsapp");
    var telegram = el("ficha-telegram");
    var emails = emailList(row);
    var hasPhone = !!phoneFromRow(row);
    var telegramUrl = "";

    if(email){
      email.href = "#";
      email.classList.toggle("is-disabled", !emails.length);
      email.title = emails.length
        ? "Abrir correo para: " + emails.join("; ")
        : "Correo no registrado";
    }

    if(whatsapp){
      whatsapp.href = "#";
      whatsapp.classList.toggle("is-disabled", !hasPhone);
      whatsapp.title = hasPhone ? "Enviar mensaje por WhatsApp" : "Celular no registrado";
    }

    try{
      telegramUrl = window.FichaCore && typeof window.FichaCore.telegramUrl === "function"
        ? window.FichaCore.telegramUrl(row || {})
        : "";
    }catch(error){
      telegramUrl = "";
    }

    if(telegram){
      telegram.href = telegramUrl || "#";
      telegram.classList.toggle("is-disabled", !telegramUrl);
      telegram.title = telegramUrl ? "Copiar mensaje y abrir Telegram" : "Telegram no registrado";
    }
  }

  function showEmpty(){
    if(el("ficha-empty")){ el("ficha-empty").classList.remove("is-hidden"); }
    if(el("ficha-detail")){ el("ficha-detail").classList.add("is-hidden"); }
    state.selectedDetail = null;
  }

  function showDetail(){
    if(el("ficha-empty")){ el("ficha-empty").classList.add("is-hidden"); }
    if(el("ficha-detail")){ el("ficha-detail").classList.remove("is-hidden"); }
  }

  function renderBasicDetail(row){
    if(!row){
      showEmpty();
      return;
    }

    showDetail();

    setText("ficha-nombre", row._nombres || "Sin nombre");
    renderHeaderIdentity(row);

    var estado = el("ficha-estado");

    if(estado){
      estado.textContent = "Cargando...";
      estado.className = "ficha-pill ficha-pill-warn";
    }

    setText("ficha-division-label", row._division || "Sin división");
    setText("ficha-matricula-label", row._estadoMatricula || "ACTIVO");
    setText("ficha-sede", row._sede || "—");
    setText("ficha-horario", row._horario || "—");
    setText("ficha-correo-personal", row._correoPersonal || "—");
    setText("ficha-correo-institucional", row._correoInstitucional || "—");
    setText("ficha-celular", row._celular || "—");

    updateCommunicationButtons(row);
    setHtml("ficha-requisitos", '<div class="empty-list">Seleccionado. Cargando detalle...</div>');
    setHtml("ficha-notas", '<div class="empty-list">Cargando notas...</div>');
    setModalidadLoading("Esperando detalle del estudiante...");
  }

  function renderFullDetail(row){
    if(!row){
      showEmpty();
      return;
    }

    state.selectedDetail = row;
    showDetail();

    setText("ficha-nombre", row._nombres || "Sin nombre");
    renderHeaderIdentity(row);

    var estado = el("ficha-estado");

    if(estado){
      estado.textContent = row._estado && row._estado.label ? row._estado.label : "Pendiente";
      estado.className = "ficha-pill " + estadoClass(row._estado);
    }

    setText("ficha-division-label", row._division || "Sin división");
    setText("ficha-matricula-label", row._estadoMatricula || "ACTIVO");
    setText("ficha-sede", row._sede || "—");
    setText("ficha-horario", row._horario || "—");
    setText("ficha-correo-personal", row._correoPersonal || "—");
    setText("ficha-correo-institucional", row._correoInstitucional || "—");
    setText("ficha-celular", row._celular || "—");

    updateCommunicationButtons(row);
    renderSpecials(row);
    renderReqs(row);
    renderNotas(row);
    scheduleModalidad(row);
  }

  function loadSelectedDetail(){
    var lightRow = selectedFromRows();

    if(!lightRow){
      showEmpty();
      return;
    }

    renderBasicDetail(lightRow);

    if(state.detailTimer){
      clearTimeout(state.detailTimer);
    }

    state.detailTimer = setTimeout(function(){
      state.detailTimer = null;

      var selectedId = text(state.selectedId);
      var id = rowId(lightRow);

      var cedula = text(
        lightRow._cedula ||
        lightRow.cedula ||
        lightRow.numeroIdentificacion ||
        id
      );

      var periodoId = text(
        lightRow._periodoId ||
        lightRow.periodoId ||
        lightRow.periodId ||
        lightRow.periodoCanonicoId ||
        state.periodId
      );

      function legacyDetail(){
        return (
          window.FichaCore.getById(id, {
            periodId:periodoId,
            division:state.division,
            matricula:state.matricula
          }) ||
          window.FichaCore.normalizeFull(
            lightRow._raw ||
            lightRow
          )
        );
      }

      function detailFromService(result){
        if(
          !result ||
          result.ok === false
        ){
          return legacyDetail();
        }

        var raw = Object.assign(
          {},
          lightRow._raw || lightRow,
          result.estudiante || {},
          result.matricula || {},
          result.persona || {},
          result.contacto || {},
          result.notas || {}
        );

        var requirements =
          Array.isArray(result.requisitos)
            ? result.requisitos
            : [];

        requirements.forEach(function(item){
          item = item || {};

          var originalKey = text(
            item.key ||
            item.nombre ||
            item.field ||
            ""
          );

          var normalizedKey = text(
            item.requisitoKey ||
            ""
          );

          var requirementValue = text(
            item.valor != null
              ? item.valor
              : item.estado != null
                ? item.estado
                : item.value
          );

          if(originalKey){
            raw[originalKey] = requirementValue;
          }

          if(normalizedKey){
            raw[normalizedKey] = requirementValue;
          }
        });

        raw.requisitos = requirements.slice();
        raw._bdlDetalle = result;

        raw.periodoId =
          raw.periodoId ||
          periodoId;

        raw.periodId =
          raw.periodId ||
          periodoId;

        raw.periodoCanonicoId =
          raw.periodoCanonicoId ||
          periodoId;

        return window.FichaCore.normalizeFull(raw);
      }

      var service = window.BDLServiceFicha;

      var detailTask =
        service &&
        typeof service.getDetalle === "function"
          ? Promise.resolve(
              service.getDetalle({
                periodoId:periodoId,
                cedula:cedula
              })
            )
          : Promise.resolve(null);

      detailTask
        .then(function(result){
          if(
            selectedId !==
            text(state.selectedId)
          ){
            return;
          }

          var detail =
            result
              ? detailFromService(result)
              : legacyDetail();

          if(!detail){
            detail = window.FichaCore.normalizeFull(
              lightRow._raw ||
              lightRow
            );
          }

          if(
            text(
              detail._id ||
              detail._cedula
            ) !== text(state.selectedId)
          ){
            return;
          }

          renderFullDetail(detail);
        })
        .catch(function(error){
          console.error(
            "[Ficha detalle]",
            error
          );

          if(
            selectedId !==
            text(state.selectedId)
          ){
            return;
          }

          try{
            renderFullDetail(
              legacyDetail() ||
              lightRow
            );
          }catch(fallbackError){
            console.error(
              "[Ficha detalle respaldo]",
              fallbackError
            );

            status(
              fallbackError.message ||
              String(fallbackError),
              "warn"
            );

            renderFullDetail(lightRow);
          }
        });
    }, 0);
  }

  function select(id){
    var nextId = text(id || "");

    if(!nextId){ return; }

    if(nextId === state.selectedId && state.selectedDetail){
      setListActive(nextId);
      return;
    }

    state.selectedId = nextId;
    state.selectedDetail = null;

    setListActive(nextId);
    loadSelectedDetail();
  }

  function render(reason){
    reason = reason || "";

    try{
      if(shouldFillFilters(reason)){
        fillFilters();
      }

      var previousSelectedId = state.selectedId;

      state.rows = window.FichaCore.filter({
        periodId:state.periodId,
        division:state.division,
        matricula:state.matricula,
        search:state.search,
        limit:400,
        force:reason === "bdlocal-refresh" || reason === "refresh"
      });

      var selectedStillVisible = previousSelectedId && state.rows.some(function(row){
        return text(row._id) === previousSelectedId || text(row._cedula) === previousSelectedId;
      });

      if(selectedStillVisible){
        state.selectedId = previousSelectedId;
      }else{
        state.selectedId = reason === "search" ? "" : (state.rows[0] ? rowId(state.rows[0]) : "");
        state.selectedDetail = null;
      }

      renderList();

      if(reason === "search"){
        if(!state.selectedId){
          showEmpty();
        }else{
          setListActive(state.selectedId);
        }
      }else{
        state.selectedDetail = null;
        loadSelectedDetail();
      }

      status(
        "Ficha cargada por " + sourceLabel() +
        ". Matrícula: " + (state.matricula || "Todos") +
        ". División: " + (state.division || "Todas") +
        ". Resultados: " + state.rows.length + ".",
        "ok"
      );
    }catch(error){
      console.error("[Ficha]", error);
      status(error.message || String(error), "warn");
    }
  }

  function refreshFromBDLocal(){
    if(state.refreshTimer){
      clearTimeout(state.refreshTimer);
    }

    state.refreshTimer = setTimeout(function(){
      state.refreshTimer = null;
      invalidateDivisionOptions();

      if(window.FichaCore && typeof window.FichaCore.invalidate === "function"){
        window.FichaCore.invalidate();
      }

      render("bdlocal-refresh");
    }, 900);
  }

  function saveModalidad(){
    var row = selectedFull();
    var select = el("ficha-modalidad-select");

    if(!row || !select){ return; }

    ensureModalidad().then(function(){
      if(!window.FichaModalidad){
        throw new Error("FichaModalidad no disponible.");
      }

      var saved = window.FichaModalidad.save(row, select.value);
      status("Modalidad guardada: " + saved.label + ".", "ok");

      invalidateDivisionOptions();

      if(window.FichaCore && typeof window.FichaCore.invalidate === "function"){
        window.FichaCore.invalidate();
      }

      render("modalidad");
    }).catch(function(error){
      console.error("[Ficha modalidad]", error);
      status(error.message || String(error), "warn");
    });
  }

  function openWhatsapp(row){
    if(!row){ return; }

    var url = "";

    try{
      url = window.FichaCore && typeof window.FichaCore.whatsappUrl === "function"
        ? window.FichaCore.whatsappUrl(row)
        : "";
    }catch(error){
      console.error("[Ficha WhatsApp]", error);
      url = "";
    }

    if(!url){
      status("Celular no registrado.", "warn");
      return;
    }

    window.open(url, "_blank", "noopener");
  }

  function openEmail(row){
    if(!row){ return; }

    var url = "";
    var emails = emailList(row);

    if(!emails.length){
      status("El estudiante no tiene correos registrados.", "warn");
      return;
    }

    try{
      url = window.FichaCore && typeof window.FichaCore.emailUrl === "function"
        ? window.FichaCore.emailUrl(row)
        : "";
    }catch(error){
      console.error("[Ficha correo]", error);
      url = "";
    }

    if(!url){
      status("No se pudo preparar el correo.", "warn");
      return;
    }

    try{
      var a = document.createElement("a");
      a.href = url;
      a.target = "_self";
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();

      status("Correo preparado para: " + emails.join("; "), "ok");
    }catch(error2){
      console.error("[Ficha abrir correo]", error2);
      status("No se pudo abrir Outlook. Se copiará el correo.", "warn");
      copyText(window.FichaCore && window.FichaCore.emailMessage ? window.FichaCore.emailMessage(row) : "", "Mensaje de correo copiado.");
    }
  }

  function bindBDLocalEvents(){
    if(state.bdlocalBound){ return; }

    window.addEventListener("bdlocal:legacy-ready", refreshFromBDLocal);
    window.addEventListener("bdlocal:legacy-snapshot", refreshFromBDLocal);
    window.addEventListener("requisitos:bl:snapshot-changed", refreshFromBDLocal);

    window.addEventListener("storage", function(event){
      if(event && (
        event.key === "REQ_BDLOCAL_LEGACY_SNAPSHOT_V1" ||
        event.key === "REQ_EXCEL_LOCAL_V1:snapshot" ||
        event.key === "REQ_BL_SIGNAL_V1"
      )){
        refreshFromBDLocal();
      }
    });

    state.bdlocalBound = true;
  }

  function bind(){
    bindIf("ficha-periodo", "change", function(event){
      state.periodId = event.target.value;
      state.division = "";
      state.selectedId = "";
      state.selectedDetail = null;
      invalidateDivisionOptions();
      render("periodo");
    });

    bindIf("ficha-division", "change", function(event){
      state.division = event.target.value;
      state.selectedId = "";
      state.selectedDetail = null;
      render("division");
    });

    bindIf("ficha-matricula", "change", function(event){
      state.matricula = event.target.value;
      state.division = "";
      state.selectedId = "";
      state.selectedDetail = null;
      invalidateDivisionOptions();

      if(window.FichaCore && typeof window.FichaCore.invalidate === "function"){
        window.FichaCore.invalidate();
      }

      render("matricula");
    });

    bindIf("ficha-search", "input", function(event){
      state.search = event.target.value;
      scheduleRender("search");
    });

    bindIf("ficha-btn-refresh", "click", function(){
      invalidateDivisionOptions();

      if(window.FichaCore && typeof window.FichaCore.invalidate === "function"){
        window.FichaCore.invalidate();
      }

      render("refresh");
    });

    bindIf("ficha-copy-detail", "click", function(){
      var row = selectedFull();
      if(row){
        copyText(window.FichaCore.toText(row), "Ficha copiada.");
      }
    });

    bindIf("ficha-modalidad-save", "click", saveModalidad);

    bindIf("ficha-email", "click", function(event){
      event.preventDefault();
      openEmail(selectedFull());
    });

    bindIf("ficha-whatsapp", "click", function(event){
      event.preventDefault();
      openWhatsapp(selectedFull());
    });

    bindIf("ficha-telegram", "click", function(event){
      var row = selectedFull();

      if(!row){ return; }

      var url = window.FichaCore.telegramUrl ? window.FichaCore.telegramUrl(row) : "";

      if(!url){
        event.preventDefault();
        status("Telegram no registrado.", "warn");
        return;
      }

      event.preventDefault();

      copyText(window.FichaCore.studentMessage(row), "Mensaje copiado para Telegram.").then(function(){
        window.open(url, "_blank", "noopener");
      });
    });

    bindIf("ficha-copy-cedula", "click", function(){
      var row = selectedFull();
      if(row){
        copyText(row._cedula, "Cédula copiada.");
      }
    });

    bindIf("ficha-copy-correo", "click", function(){
      var row = selectedFull();
      if(row){
        var emails = emailList(row);
        if(emails.length){
          copyText(emails.join("; "), "Correos copiados.");
        }else{
          copyText(correoPrincipal(row), "Correo copiado.");
        }
      }
    });

    bindBDLocalEvents();
  }

  function boot(){
    if(window.BL2 && typeof window.BL2.status === "function"){
      try{
        window.BL2.status({deep:false});
      }catch(error){}
    }

    bind();
    render("boot");
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.FichaApp = {
    render:render,
    scheduleRender:scheduleRender,
    refreshFromBDLocal:refreshFromBDLocal,
    select:select,
    getState:function(){
      return Object.assign({}, state);
    },
    loadScript:loadScript
  };
})(window, document);
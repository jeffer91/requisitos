/* =========================================================
Nombre completo: carga.divisiones.popup.js
Ruta o ubicación: /Requisitos/Carga/carga.divisiones.popup.js
Función o funciones:
- Administrar divisiones mediante un popup.
- Seleccionar el período y la división que se desea editar.
- Crear, renombrar y borrar divisiones.
- Mostrar únicamente carreras que todavía no tienen división.
- Arrastrar carreras, retirarlas o moverlas directamente.
- Guardar las divisiones y actualizar los estudiantes.
Con qué se conecta:
- carga.html
- carga.css
- carga.ui.js
- BLDivisionesService
- BL2Core
========================================================= */
(function(window, document){
  "use strict";

  var LS_PERIODOS = "carga.periodos.local";
  var LS_DIVISIONES = "carga.periodos.divisiones";

  var state = {
    period:null,
    periods:[],
    careers:[],
    divisions:[],
    selectedDivisionId:"",
    originalAssigned:{},
    draggedCareerId:"",
    dirty:false,
    busy:false
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function nowISO(){
    return new Date().toISOString();
  }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function key(value){
    return norm(value).replace(/[^a-z0-9]+/g, "");
  }

  function esc(value){
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

    return null;
  }

  function core(){
    return api("BL2Core");
  }

  function service(){
    return api("BLDivisionesService");
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

  function storageGet(name, fallback){
    try{
      var raw = localStorage.getItem(name);

      return raw
        ? JSON.parse(raw)
        : fallback;
    }catch(error){
      return fallback;
    }
  }

  function storageSet(name, value){
    try{
      localStorage.setItem(
        name,
        JSON.stringify(value)
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
      periodoId:id,
      periodoCanonicoId:id,
      label:label,
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

  function localPeriods(){
    var periods = storageGet(LS_PERIODOS, []);

    return (
      Array.isArray(periods)
        ? periods
        : []
    ).map(normalizePeriod).filter(Boolean);
  }

  function normalizeCareer(item){
    if(!item){
      return null;
    }

    if(typeof item === "string"){
      return {
        id:key(item),
        codigo:"",
        nombre:text(item),
        total:0
      };
    }

    var nombre = text(
      item.nombre ||
      item.nombreCarrera ||
      item.NombreCarrera ||
      item.carrera ||
      item.Carrera ||
      item.label ||
      ""
    );

    var codigo = text(
      item.codigo ||
      item.codigoCarrera ||
      item.CodigoCarrera ||
      ""
    );

    var id = text(
      item.id ||
      codigo ||
      key(nombre)
    );

    if(!id && !nombre){
      return null;
    }

    return {
      id:id || key(nombre),
      codigo:codigo,
      nombre:nombre || codigo || id,
      total:Number(
        item.total ||
        item.estudiantes ||
        0
      ) || 0
    };
  }

  function uniqueCareers(list){
    var map = {};

    (Array.isArray(list) ? list : [])
      .forEach(function(item){
        var career = normalizeCareer(item);

        if(!career || !career.id){
          return;
        }

        map[career.id] = Object.assign(
          {},
          map[career.id] || {},
          career,
          {
            total:Math.max(
              Number(
                map[career.id] &&
                map[career.id].total ||
                0
              ),
              career.total || 0
            )
          }
        );
      });

    return Object.keys(map)
      .map(function(id){
        return map[id];
      })
      .sort(function(a, b){
        return a.nombre.localeCompare(
          b.nombre,
          "es",
          { sensitivity:"base" }
        );
      });
  }

  function normalizeDivision(item){
    item = item || {};

    if(typeof item === "string"){
      item = {
        nombre:item
      };
    }

    var nombre = text(
      item.nombre ||
      item.label ||
      item.name ||
      item.id ||
      ""
    );

    var id = text(
      item.id ||
      key(nombre)
    );

    if(!id && !nombre){
      return null;
    }

    return {
      id:id || key(nombre),
      nombre:nombre || id,
      carreras:uniqueCareers(
        item.carreras || []
      ),
      createdAt:item.createdAt || nowISO(),
      updatedAt:item.updatedAt || nowISO()
    };
  }

  function mergeDivisions(){
    var map = {};

    Array.prototype.slice.call(arguments)
      .forEach(function(list){
        (Array.isArray(list) ? list : [])
          .forEach(function(item){
            var division = normalizeDivision(item);

            if(!division){
              return;
            }

            map[division.id] = Object.assign(
              {},
              map[division.id] || {},
              division,
              {
                carreras:uniqueCareers(
                  [].concat(
                    map[division.id] &&
                    map[division.id].carreras ||
                    [],
                    division.carreras ||
                    []
                  )
                )
              }
            );
          });
      });

    return Object.keys(map)
      .map(function(id){
        return map[id];
      })
      .sort(function(a, b){
        return a.nombre.localeCompare(
          b.nombre,
          "es",
          { sensitivity:"base" }
        );
      });
  }

  function selectedDivision(){
    return state.divisions.filter(function(division){
      return division.id === state.selectedDivisionId;
    })[0] || null;
  }

  function assignedMap(){
    var map = {};

    state.divisions.forEach(function(division){
      (division.carreras || []).forEach(function(career){
        map[career.id] = division.id;
      });
    });

    return map;
  }

  function assignedNameMap(){
    var map = {};

    state.divisions.forEach(function(division){
      (division.carreras || []).forEach(function(career){
        map[career.id] = division.nombre;
      });
    });

    return map;
  }

  function divisionsFromStore(periodId){
    var store = storageGet(LS_DIVISIONES, {});
    var item = store[periodId] || {};

    if(Array.isArray(item)){
      return item;
    }

    return Array.isArray(item.divisiones)
      ? item.divisiones
      : [];
  }

  function divisionsFromService(periodId){
    var currentService = service();

    if(
      currentService &&
      typeof currentService.divisionsForPeriod === "function"
    ){
      try{
        return currentService.divisionsForPeriod(periodId) || [];
      }catch(error){}
    }

    return [];
  }

  function careersFromService(periodId){
    var currentService = service();

    if(
      currentService &&
      typeof currentService.careersForPeriod === "function"
    ){
      try{
        return currentService.careersForPeriod(periodId) || [];
      }catch(error){}
    }

    return [];
  }

  function careerFromStudent(student){
    return normalizeCareer(student || {});
  }

  function studentCareerId(student){
    var career = careerFromStudent(student);

    return career
      ? career.id
      : "";
  }

  function ensurePopup(){
    var node = document.getElementById(
      "cargaDivisionesPopupV3"
    );

    if(node){
      return node;
    }

    node = document.createElement("div");
    node.id = "cargaDivisionesPopupV3";
    node.className = "cdp-overlay";

    node.innerHTML =
      '<section class="cdp-dialog" role="dialog" aria-modal="true" aria-labelledby="cdpTitle">' +
        '<header class="cdp-head">' +
          '<div>' +
            '<h2 id="cdpTitle">Divisiones</h2>' +
            '<small id="cdpSubtitle">Selecciona un período.</small>' +
          '</div>' +
          '<button type="button" class="cdp-close" data-cdp-exit>×</button>' +
        '</header>' +

        '<div class="cdp-body">' +
          '<div class="cdp-toolbar">' +
            '<label>' +
              '<span>Período</span>' +
              '<select id="cdpPeriod"></select>' +
            '</label>' +

            '<label>' +
              '<span>División seleccionada</span>' +
              '<select id="cdpDivision"></select>' +
            '</label>' +

            '<label>' +
              '<span>Nombre</span>' +
              '<input id="cdpDivisionName" maxlength="80" placeholder="Nombre de división">' +
            '</label>' +

            '<button type="button" class="carga-btn carga-btn-primary" id="cdpCreate">Crear</button>' +
            '<button type="button" class="carga-btn" id="cdpRename">Editar</button>' +
            '<button type="button" class="carga-btn carga-btn-danger-soft" id="cdpDelete">Borrar</button>' +
          '</div>' +

          '<div class="cdp-grid">' +
            '<section class="cdp-panel" id="cdpAvailablePanel">' +
              '<h3>Carreras disponibles</h3>' +
              '<small>Solo aparecen carreras que todavía no tienen división.</small>' +
              '<div class="cdp-list" id="cdpAvailable"></div>' +
            '</section>' +

            '<section class="cdp-panel" id="cdpAssignedPanel">' +
              '<h3 id="cdpAssignedTitle">Carreras de la división</h3>' +
              '<small>Arrastra aquí, retira o mueve una carrera directamente.</small>' +
              '<div class="cdp-list" id="cdpAssigned"></div>' +
            '</section>' +
          '</div>' +
        '</div>' +

        '<footer class="cdp-foot">' +
          '<button type="button" class="carga-btn" data-cdp-exit>Salir</button>' +
          '<button type="button" class="carga-btn carga-btn-primary" id="cdpSave">Guardar cambios</button>' +
        '</footer>' +
      '</section>';

    document.body.appendChild(node);
    bindEvents(node);

    return node;
  }

  function showMessage(type, message){
    var box = document.getElementById("cargaMessageBox");

    if(!box){
      return;
    }

    box.className =
      "carga-message is-" +
      (type || "success");

    box.textContent = message || "";
    box.classList.remove("carga-hidden");

    clearTimeout(box.__timer);

    box.__timer = setTimeout(function(){
      box.classList.add("carga-hidden");
    }, 5000);
  }

  function renderPeriodSelect(){
    var select = document.getElementById("cdpPeriod");

    if(!select){
      return;
    }

    select.innerHTML =
      '<option value="">Seleccione...</option>' +
      state.periods.map(function(period){
        return (
          '<option value="' +
          esc(period.id) +
          '">' +
          esc(period.label) +
          "</option>"
        );
      }).join("");

    select.value = state.period
      ? state.period.id
      : "";
  }

  function renderDivisionSelect(){
    var select = document.getElementById("cdpDivision");

    select.innerHTML =
      '<option value="">Seleccione...</option>' +
      state.divisions.map(function(division){
        return (
          '<option value="' +
          esc(division.id) +
          '">' +
          esc(division.nombre) +
          "</option>"
        );
      }).join("");

    select.value = state.selectedDivisionId;

    var selected = selectedDivision();

    document.getElementById("cdpDivisionName").value =
      selected
        ? selected.nombre
        : "";

    document.getElementById("cdpAssignedTitle").textContent =
      selected
        ? "Carreras de " + selected.nombre
        : "Carreras de la división";
  }

  function careerHtml(career, assigned){
    var moveOptions =
      '<option value="">Mover a...</option>' +
      state.divisions
        .filter(function(division){
          return division.id !== state.selectedDivisionId;
        })
        .map(function(division){
          return (
            '<option value="' +
            esc(division.id) +
            '">' +
            esc(division.nombre) +
            "</option>"
          );
        })
        .join("");

    return (
      '<article class="cdp-career" draggable="true" data-career-id="' +
      esc(career.id) +
      '">' +
        "<div>" +
          "<strong>" +
            esc(career.nombre) +
          "</strong>" +
          "<small>" +
            (
              career.total
                ? career.total + " estudiantes"
                : esc(career.codigo || "")
            ) +
          "</small>" +
        "</div>" +
        (
          assigned
            ? '<div class="cdp-career-actions">' +
                '<select data-move-career="' +
                esc(career.id) +
                '">' +
                  moveOptions +
                "</select>" +
                '<button type="button" data-remove-career="' +
                esc(career.id) +
                '">Retirar</button>' +
              "</div>"
            : '<span class="carga-chip">Arrastrar</span>'
        ) +
      "</article>"
    );
  }

  function renderCareers(){
    var assigned = assignedMap();
    var selected = selectedDivision();

    var available = state.careers.filter(function(career){
      return !assigned[career.id];
    });

    var availableBox = document.getElementById("cdpAvailable");
    var assignedBox = document.getElementById("cdpAssigned");

    availableBox.innerHTML = available.length
      ? available.map(function(career){
          return careerHtml(career, false);
        }).join("")
      : '<div class="cdp-empty">Todas las carreras ya tienen división.</div>';

    assignedBox.innerHTML =
      selected && selected.carreras.length
        ? selected.carreras.map(function(career){
            return careerHtml(career, true);
          }).join("")
        : '<div class="cdp-empty">Selecciona una división o arrastra carreras aquí.</div>';
  }

  function render(){
    renderPeriodSelect();
    renderDivisionSelect();
    renderCareers();

    document.getElementById("cdpSubtitle").textContent =
      state.period
        ? state.period.label
        : "Selecciona un período.";
  }

  function loadPeriod(period){
    period = normalizePeriod(period);

    if(!period){
      return Promise.reject(
        new Error("Selecciona un período.")
      );
    }

    state.busy = true;
    state.period = period;
    state.selectedDivisionId = "";

    var currentCore = core();

    var studentsPromise =
      currentCore &&
      typeof currentCore.getStudents === "function"
        ? currentCore.getStudents({
            periodoId:period.id,
            matricula:""
          }).catch(function(){
            return [];
          })
        : Promise.resolve([]);

    return studentsPromise.then(function(students){
      students = Array.isArray(students)
        ? students
        : [];

      var counts = {};
      var fromStudents = [];

      students.forEach(function(student){
        var career = careerFromStudent(student);

        if(!career){
          return;
        }

        counts[career.id] =
          (counts[career.id] || 0) + 1;

        fromStudents.push(career);
      });

      fromStudents = uniqueCareers(fromStudents)
        .map(function(career){
          career.total = counts[career.id] || 0;
          return career;
        });

      var local = localPeriods()
        .filter(function(item){
          return item.id === period.id;
        })[0] || {};

      state.divisions = mergeDivisions(
        divisionsFromStore(period.id),
        period.divisiones || [],
        local.divisiones || [],
        divisionsFromService(period.id)
      );

      state.careers = uniqueCareers(
        [].concat(
          period.carrerasDetectadas || [],
          local.carrerasDetectadas || [],
          careersFromService(period.id),
          fromStudents,
          state.divisions.reduce(function(output, division){
            return output.concat(division.carreras || []);
          }, [])
        )
      );

      state.originalAssigned = assignedNameMap();

      state.selectedDivisionId =
        state.divisions[0]
          ? state.divisions[0].id
          : "";

      state.dirty = false;
      state.busy = false;

      render();

      return period;
    });
  }

  function uniqueDivisionId(name){
    var base = key(name) || "division";
    var id = base;
    var index = 2;

    while(
      state.divisions.some(function(division){
        return division.id === id;
      })
    ){
      id = base + "_" + index;
      index += 1;
    }

    return id;
  }

  function createDivision(){
    var input = document.getElementById("cdpDivisionName");
    var name = text(input.value);

    if(!name){
      showMessage(
        "warning",
        "Escribe el nombre de la división."
      );

      return;
    }

    var division = {
      id:uniqueDivisionId(name),
      nombre:name,
      carreras:[],
      createdAt:nowISO(),
      updatedAt:nowISO()
    };

    state.divisions.push(division);
    state.selectedDivisionId = division.id;
    state.dirty = true;

    render();
    input.focus();
  }

  function renameDivision(){
    var division = selectedDivision();
    var name = text(
      document.getElementById("cdpDivisionName").value
    );

    if(!division){
      showMessage(
        "warning",
        "Selecciona una división."
      );

      return;
    }

    if(!name){
      showMessage(
        "warning",
        "Escribe un nombre."
      );

      return;
    }

    division.nombre = name;
    division.updatedAt = nowISO();
    state.dirty = true;

    render();
  }

  function deleteDivision(){
    var division = selectedDivision();

    if(!division){
      showMessage(
        "warning",
        "Selecciona una división."
      );

      return;
    }

    if(
      !confirm(
        "¿Borrar la división " +
        division.nombre +
        "? Sus carreras volverán a Disponibles."
      )
    ){
      return;
    }

    state.divisions = state.divisions.filter(function(item){
      return item.id !== division.id;
    });

    state.selectedDivisionId =
      state.divisions[0]
        ? state.divisions[0].id
        : "";

    state.dirty = true;

    render();
  }

  function careerById(id){
    return state.careers.filter(function(career){
      return career.id === id;
    })[0] || null;
  }

  function removeEverywhere(careerId){
    state.divisions.forEach(function(division){
      division.carreras = (division.carreras || [])
        .filter(function(career){
          return career.id !== careerId;
        });
    });
  }

  function assign(careerId, divisionId){
    var career = careerById(careerId);

    var division = state.divisions.filter(function(item){
      return item.id === divisionId;
    })[0];

    if(!career || !division){
      return;
    }

    removeEverywhere(careerId);

    division.carreras = uniqueCareers(
      [].concat(
        division.carreras || [],
        [career]
      )
    );

    division.updatedAt = nowISO();
    state.dirty = true;

    render();
  }

  function remove(careerId){
    removeEverywhere(careerId);
    state.dirty = true;

    render();
  }

  function saveLocal(period){
    var store = storageGet(LS_DIVISIONES, {});

    store[period.id] = {
      periodoId:period.id,
      divisiones:state.divisions,
      updatedAt:nowISO()
    };

    storageSet(LS_DIVISIONES, store);

    var periods = localPeriods();
    var found = false;

    periods = periods.map(function(item){
      if(item.id !== period.id){
        return item;
      }

      found = true;

      return Object.assign({}, item, period, {
        divisiones:state.divisions,
        carrerasDetectadas:state.careers,
        updatedAt:nowISO()
      });
    });

    if(!found){
      periods.push(
        Object.assign({}, period, {
          divisiones:state.divisions,
          carrerasDetectadas:state.careers,
          updatedAt:nowISO()
        })
      );
    }

    storageSet(LS_PERIODOS, periods);
  }

  function updateStudents(period){
    var currentCore = core();

    if(
      !currentCore ||
      typeof currentCore.getStudents !== "function" ||
      typeof currentCore.updateStudent !== "function"
    ){
      return Promise.resolve({
        updated:0,
        skipped:true
      });
    }

    var current = assignedNameMap();
    var original = state.originalAssigned;

    return currentCore.getStudents({
      periodoId:period.id,
      matricula:""
    }).then(function(students){
      students = Array.isArray(students)
        ? students
        : [];

      var changes = [];

      students.forEach(function(student){
        var careerId = studentCareerId(student);

        if(!careerId){
          return;
        }

        var hasCurrent =
          Object.prototype.hasOwnProperty.call(
            current,
            careerId
          );

        var hadOriginal =
          Object.prototype.hasOwnProperty.call(
            original,
            careerId
          );

        var desired = hasCurrent
          ? current[careerId]
          : hadOriginal
            ? ""
            : null;

        if(
          desired === null ||
          text(
            student.division ||
            student.Division
          ) === desired
        ){
          return;
        }

        changes.push({
          student:student,
          division:desired
        });
      });

      var index = 0;
      var updated = 0;

      function next(){
        if(index >= changes.length){
          return Promise.resolve({
            updated:updated,
            total:students.length
          });
        }

        var batch = changes.slice(
          index,
          index + 25
        );

        index += 25;

        return Promise.all(
          batch.map(function(change){
            return currentCore.updateStudent(
              change.student.id ||
              change.student.idEstudiantePeriodo,
              {
                division:change.division,
                divisiones:change.division
                  ? [change.division]
                  : [],
                divisionActualizadaEn:nowISO(),
                ultimaEdicionLocal:nowISO(),
                updatedAt:nowISO()
              },
              {
                action:"division_period_career_update"
              }
            ).then(function(){
              updated += 1;
            });
          })
        ).then(next);
      }

      return next();
    });
  }

  function saveAll(){
    if(!state.period || state.busy){
      return;
    }

    state.busy = true;

    var period = Object.assign({}, state.period, {
      divisiones:state.divisions,
      carrerasDetectadas:state.careers,
      updatedAt:nowISO()
    });

    saveLocal(period);

    var currentCore = core();

    var savePeriodPromise =
      currentCore &&
      typeof currentCore.savePeriod === "function"
        ? currentCore.savePeriod(period).catch(function(){
            return period;
          })
        : Promise.resolve(period);

    savePeriodPromise
      .then(function(){
        return updateStudents(period);
      })
      .then(function(result){
        state.originalAssigned = assignedNameMap();
        state.dirty = false;

        showMessage(
          "success",
          "Divisiones guardadas. Estudiantes actualizados: " +
          (result.updated || 0) +
          "."
        );

        emit("carga:divisions-saved", {
          periodoId:period.id,
          divisiones:state.divisions.length,
          updated:result.updated || 0
        });

        close(true);
      })
      .catch(function(error){
        showMessage(
          "error",
          error.message || String(error)
        );
      })
      .finally(function(){
        state.busy = false;
      });
  }

  function open(period){
    var node = ensurePopup();

    state.periods = localPeriods();

    period =
      normalizePeriod(period) ||
      state.periods[0] ||
      null;

    node.classList.add("is-open");

    if(!period){
      render();

      showMessage(
        "warning",
        "Primero crea un período."
      );

      return;
    }

    loadPeriod(period).catch(function(error){
      showMessage(
        "error",
        error.message || String(error)
      );
    });
  }

  function close(force){
    if(
      state.dirty &&
      !force &&
      !confirm(
        "Hay cambios sin guardar. ¿Salir de todos modos?"
      )
    ){
      return;
    }

    var node = document.getElementById(
      "cargaDivisionesPopupV3"
    );

    if(node){
      node.classList.remove("is-open");
    }

    state.dirty = false;
  }

  function bindDrop(panel, onDrop){
    panel.addEventListener(
      "dragover",
      function(event){
        event.preventDefault();
        panel.classList.add("is-over");
      }
    );

    panel.addEventListener(
      "dragleave",
      function(){
        panel.classList.remove("is-over");
      }
    );

    panel.addEventListener(
      "drop",
      function(event){
        event.preventDefault();
        panel.classList.remove("is-over");

        var id = "";

        try{
          id = event.dataTransfer.getData("text/plain");
        }catch(error){}

        onDrop(
          id ||
          state.draggedCareerId
        );
      }
    );
  }

  function bindEvents(node){
    node.addEventListener(
      "click",
      function(event){
        if(
          event.target === node ||
          event.target.closest("[data-cdp-exit]")
        ){
          close(false);
          return;
        }

        var removeButton =
          event.target.closest("[data-remove-career]");

        if(removeButton){
          remove(
            removeButton.getAttribute(
              "data-remove-career"
            )
          );
        }
      }
    );

    node.addEventListener(
      "dragstart",
      function(event){
        var item =
          event.target.closest("[data-career-id]");

        if(!item){
          return;
        }

        state.draggedCareerId =
          item.getAttribute("data-career-id");

        try{
          event.dataTransfer.setData(
            "text/plain",
            state.draggedCareerId
          );
        }catch(error){}
      }
    );

    document.getElementById("cdpPeriod")
      .addEventListener("change", function(){
        var selectedId = this.value;

        var period = state.periods.filter(function(item){
          return item.id === selectedId;
        })[0];

        if(period){
          loadPeriod(period);
        }
      });

    document.getElementById("cdpDivision")
      .addEventListener("change", function(){
        state.selectedDivisionId = this.value;

        renderDivisionSelect();
        renderCareers();
      });

    document.getElementById("cdpCreate")
      .addEventListener("click", createDivision);

    document.getElementById("cdpRename")
      .addEventListener("click", renameDivision);

    document.getElementById("cdpDelete")
      .addEventListener("click", deleteDivision);

    document.getElementById("cdpSave")
      .addEventListener("click", saveAll);

    document.getElementById("cdpAssigned")
      .addEventListener("change", function(event){
        var select =
          event.target.closest("[data-move-career]");

        if(select && select.value){
          assign(
            select.getAttribute("data-move-career"),
            select.value
          );
        }
      });

    bindDrop(
      document.getElementById("cdpAssignedPanel"),
      function(id){
        if(!state.selectedDivisionId){
          showMessage(
            "warning",
            "Selecciona una división."
          );

          return;
        }

        assign(
          id,
          state.selectedDivisionId
        );
      }
    );

    bindDrop(
      document.getElementById("cdpAvailablePanel"),
      function(id){
        remove(id);
      }
    );

    document.addEventListener(
      "keydown",
      function(event){
        if(
          event.key === "Escape" &&
          node.classList.contains("is-open")
        ){
          close(false);
        }
      }
    );
  }

  window.CargaDivisionesPopup = {
    open:open,
    close:close,
    save:saveAll,

    reload:function(){
      if(state.period){
        return loadPeriod(state.period);
      }
    }
  };
})(window, document);
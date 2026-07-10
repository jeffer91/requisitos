/* =========================================================
Nombre completo: ficha.contact-hydration.js
Ruta o ubicación: /Requisitos/Ficha/ficha.contact-hydration.js
Función o funciones:
- Hidratar la ficha con contactos_estudiante V2, contactos legacy y personas.
- Unir por cédula normalizada y período canónico, sin depender del orden del ID.
- Corregir idEstudiantePeriodo al formato cédula__periodoId dentro de Ficha.
- Invalidar y volver a pintar el estudiante seleccionado cuando llegan contactos.
- Mantener búsquedas por correo y celular dentro de la pantalla Ficha.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.0.0-contact-period-join";
  var state = {
    loading: null,
    ready: false,
    patched: false,
    contacts: Object.create(null),
    persons: Object.create(null),
    reloadTimer: null,
    lastLoadedAt: "",
    error: ""
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function clone(value){
    try{ return structuredClone(value); }
    catch(error){
      try{ return JSON.parse(JSON.stringify(value)); }
      catch(innerError){ return value; }
    }
  }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }

    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    if(match){
      return match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4];
    }

    return value.replace(/_+/g, "__");
  }

  function first(){
    for(var index = 0; index < arguments.length; index += 1){
      if(arguments[index] !== undefined && arguments[index] !== null && text(arguments[index]) !== ""){
        return arguments[index];
      }
    }
    return "";
  }

  function cedulaOf(row){
    row = row || {};
    return normalizeCedula(first(
      row.cedula,
      row.numeroIdentificacion,
      row.NumeroIdentificacion,
      row.Cedula,
      row["Cédula"],
      row._cedula
    ));
  }

  function periodOf(row){
    row = row || {};
    return canonicalPeriodId(first(
      row.periodoId,
      row.periodId,
      row.ultimoPeriodoId,
      row.periodoCanonicoId,
      row.idPeriodo,
      row._periodoId,
      row._bl2PeriodoId
    ));
  }

  function joinKey(row){
    var cedula = cedulaOf(row);
    var periodoId = periodOf(row);
    return cedula && periodoId ? cedula + "|" + periodoId : "";
  }

  function canonicalStudentPeriodId(row){
    var cedula = cedulaOf(row);
    var periodoId = periodOf(row);
    return cedula && periodoId ? cedula + "__" + periodoId : "";
  }

  function nonEmptyMerge(base, incoming){
    var output = Object.assign({}, base || {});

    Object.keys(incoming || {}).forEach(function(key){
      var value = incoming[key];
      if(value !== undefined && value !== null && text(value) !== ""){
        output[key] = value;
      }else if(output[key] === undefined){
        output[key] = value;
      }
    });

    return output;
  }

  function normalizeContact(row){
    row = Object.assign({}, row || {});

    var personal = text(first(
      row.CorreoPersonal,
      row.correoPersonal,
      row.correopersonal,
      row.correo_personal,
      row.emailPersonal
    ));

    var institucional = text(first(
      row.CorreoInstitucional,
      row.correoInstitucional,
      row.correoinstitucional,
      row.correo_institucional,
      row.emailInstitucional
    ));

    var celular = text(first(
      row.Celular,
      row.celular,
      row.Telefono,
      row.telefono,
      row["Teléfono"],
      row.whatsapp,
      row.WhatsApp
    ));

    return Object.assign({}, row, {
      cedula: cedulaOf(row),
      periodoId: periodOf(row),
      CorreoPersonal: personal,
      correoPersonal: personal,
      CorreoInstitucional: institucional,
      correoInstitucional: institucional,
      Celular: celular,
      celular: celular,
      telegramUser: text(first(row.telegramUser, row._telegramUser, row.telegramUsername, row.usuarioTelegram)).replace(/^@+/, ""),
      telegramChatId: text(first(row.telegramChatId, row._telegramChatId, row.chatIdTelegram, row.chatId))
    });
  }

  function normalizePerson(row){
    row = Object.assign({}, row || {});
    return {
      cedula: cedulaOf(row),
      correoPersonal: text(first(row.correoPersonal, row.CorreoPersonal)),
      correoInstitucional: text(first(row.correoInstitucional, row.CorreoInstitucional)),
      celular: text(first(row.celular, row.Celular, row.telefono, row.Telefono)),
      telegramUser: text(first(row.telegramUser, row._telegramUser)).replace(/^@+/, ""),
      telegramChatId: text(first(row.telegramChatId, row._telegramChatId))
    };
  }

  function applyContactFields(target, contact, person){
    target = Object.assign({}, target || {});
    contact = contact || {};
    person = person || {};

    var personal = text(first(
      contact.CorreoPersonal,
      contact.correoPersonal,
      target.CorreoPersonal,
      target.correoPersonal,
      target._correoPersonal,
      target._bl2CorreoPersonal,
      person.correoPersonal,
      person.CorreoPersonal
    ));

    var institucional = text(first(
      contact.CorreoInstitucional,
      contact.correoInstitucional,
      target.CorreoInstitucional,
      target.correoInstitucional,
      target._correoInstitucional,
      target._bl2CorreoInstitucional,
      person.correoInstitucional,
      person.CorreoInstitucional
    ));

    var celular = text(first(
      contact.Celular,
      contact.celular,
      target.Celular,
      target.celular,
      target._celular,
      target._bl2Celular,
      target.Telefono,
      target.telefono,
      person.celular,
      person.Celular
    ));

    var telegramUser = text(first(
      contact.telegramUser,
      contact._telegramUser,
      target.telegramUser,
      target._telegramUser,
      person.telegramUser,
      person._telegramUser
    )).replace(/^@+/, "");

    var telegramChatId = text(first(
      contact.telegramChatId,
      contact._telegramChatId,
      target.telegramChatId,
      target._telegramChatId,
      person.telegramChatId,
      person._telegramChatId
    ));

    var canonicalId = canonicalStudentPeriodId(target);

    target.CorreoPersonal = personal;
    target.correoPersonal = personal;
    target._correoPersonal = personal;
    target._bl2CorreoPersonal = personal;

    target.CorreoInstitucional = institucional;
    target.correoInstitucional = institucional;
    target._correoInstitucional = institucional;
    target._bl2CorreoInstitucional = institucional;

    target.Celular = celular;
    target.celular = celular;
    target._celular = celular;
    target._bl2Celular = celular;

    target.telegramUser = telegramUser;
    target._telegramUser = telegramUser;
    target.telegramChatId = telegramChatId;
    target._telegramChatId = telegramChatId;

    if(canonicalId){
      target.idEstudiantePeriodo = canonicalId;
      if(!text(target.studentId) || text(target.studentId) === periodOf(target) + "__" + cedulaOf(target)){
        target.studentId = canonicalId;
      }
    }

    target._contact = clone(contact);
    target.__fichaContactHydrationVersion = VERSION;
    return target;
  }

  function hydrate(row){
    if(!row || typeof row !== "object"){ return row; }

    var key = joinKey(row);
    var cedula = cedulaOf(row);
    var contact = key ? state.contacts[key] : null;
    var person = cedula ? state.persons[cedula] : null;
    var output = applyContactFields(row, contact, person);

    if(output._raw && typeof output._raw === "object"){
      output._raw = applyContactFields(output._raw, contact, person);
    }

    return output;
  }

  function hydrateRows(rows){
    return Array.isArray(rows) ? rows.map(hydrate) : [];
  }

  function readStore(name){
    if(!window.BL2DB || typeof window.BL2DB.getAll !== "function"){
      return Promise.resolve([]);
    }

    return window.BL2DB.getAll(name).catch(function(error){
      try{ console.warn("[FichaContactHydration] No se pudo leer " + name, error); }catch(innerError){}
      return [];
    });
  }

  function ensureCoreReady(){
    if(window.BDLocalConexiones && typeof window.BDLocalConexiones.ensureCoreReady === "function"){
      return window.BDLocalConexiones.ensureCoreReady();
    }

    if(window.BDLScreenDepsReady && typeof window.BDLScreenDepsReady.then === "function"){
      return window.BDLScreenDepsReady;
    }

    return Promise.resolve(null);
  }

  function buildMaps(legacyRows, v2Rows, personRows){
    var contacts = Object.create(null);
    var persons = Object.create(null);

    (legacyRows || []).forEach(function(input){
      var row = normalizeContact(input);
      var key = joinKey(row);
      if(key){ contacts[key] = nonEmptyMerge(contacts[key], row); }
    });

    (v2Rows || []).forEach(function(input){
      var row = normalizeContact(input);
      var key = joinKey(row);
      if(key){ contacts[key] = nonEmptyMerge(contacts[key], row); }
    });

    (personRows || []).forEach(function(input){
      var row = normalizePerson(input);
      if(row.cedula){ persons[row.cedula] = nonEmptyMerge(persons[row.cedula], row); }
    });

    state.contacts = contacts;
    state.persons = persons;
  }

  function hydrateResponse(response){
    if(Array.isArray(response)){ return hydrateRows(response); }
    if(response && Array.isArray(response.rows)){
      return Object.assign({}, response, { rows: hydrateRows(response.rows) });
    }
    return response;
  }

  function patchObjectMethod(object, name, mode){
    if(!object || typeof object[name] !== "function"){ return; }

    var original = object[name];
    if(original.__fichaContactHydrationWrapped){ return; }

    var wrapped = function(){
      var result = original.apply(this, arguments);

      if(result && typeof result.then === "function"){
        return result.then(function(value){
          return mode === "one" ? hydrate(value) : hydrateResponse(value);
        });
      }

      return mode === "one" ? hydrate(result) : hydrateResponse(result);
    };

    wrapped.__fichaContactHydrationWrapped = true;
    wrapped.__original = original;
    object[name] = wrapped;
  }

  function searchMatches(row, query){
    var normalized = text(query)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if(!normalized){ return true; }

    var tokens = normalized.split(/\s+/).filter(Boolean);
    var haystack = [
      row._cedula,
      row.cedula,
      row.numeroIdentificacion,
      row._nombres,
      row.Nombres,
      row.nombres,
      row._carrera,
      row.NombreCarrera,
      row._correoPersonal,
      row._correoInstitucional,
      row.CorreoPersonal,
      row.CorreoInstitucional,
      row._celular,
      row.Celular,
      row.celular
    ].join(" ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    return tokens.every(function(token){ return haystack.indexOf(token) >= 0; });
  }

  function patchFichaCore(){
    var core = window.FichaCore;
    if(!core || core.__contactHydrationPatch === VERSION){ return; }

    var originalFilter = typeof core.filter === "function" ? core.filter : null;
    if(originalFilter){
      core.filter = function(options){
        options = Object.assign({}, options || {});
        var query = options.search || options.busqueda || options.query || "";
        var limit = Math.max(1, Number(options.limit || 400) || 400);
        var baseOptions = Object.assign({}, options, { search:"", busqueda:"", query:"", limit:50000 });
        var rows = hydrateRows(originalFilter.call(core, baseOptions) || []);
        return rows.filter(function(row){ return searchMatches(row, query); }).slice(0, limit);
      };
      core.filter.__fichaContactHydrationWrapped = true;
    }

    patchObjectMethod(core, "students", "many");
    patchObjectMethod(core, "getById", "one");
    patchObjectMethod(core, "normalizeStudent", "one");
    patchObjectMethod(core, "normalizeLight", "one");
    patchObjectMethod(core, "normalizeFull", "one");

    core.__contactHydrationPatch = VERSION;
  }

  function patchDataSources(){
    [window.BL2DataEngine, window.BL2EstudiantesRepo, window.ExcelLocalRepo, window.BL2ScreenAdapter].forEach(function(source){
      if(!source){ return; }

      [
        "listStudents", "getStudents", "getRows", "rows", "all", "listar",
        "listAllStudents", "filterStudents", "buscar", "search"
      ].forEach(function(name){ patchObjectMethod(source, name, "many"); });

      [
        "getStudentById", "getStudentByCedula", "obtenerPorCedula", "byCedula", "forFicha"
      ].forEach(function(name){
        if(name === "forFicha" && typeof source[name] === "function"){
          var original = source[name];
          if(!original.__fichaContactHydrationWrapped){
            var wrapped = function(){
              var response = original.apply(this, arguments);
              if(response && response.student){
                return Object.assign({}, response, { student:hydrate(response.student), contactHydrated:true });
              }
              return response;
            };
            wrapped.__fichaContactHydrationWrapped = true;
            source[name] = wrapped;
          }
        }else{
          patchObjectMethod(source, name, "one");
        }
      });
    });
  }

  function patchAll(){
    patchDataSources();
    patchFichaCore();
    state.patched = true;
  }

  function refreshView(){
    try{
      if(window.FichaCore && typeof window.FichaCore.invalidate === "function"){
        window.FichaCore.invalidate();
      }
    }catch(error){}

    window.setTimeout(function(){
      try{
        patchAll();
        if(window.FichaApp && typeof window.FichaApp.render === "function"){
          window.FichaApp.render("bdlocal-refresh");
        }else if(window.FichaApp && typeof window.FichaApp.refreshFromBDLocal === "function"){
          window.FichaApp.refreshFromBDLocal();
        }
      }catch(error){
        try{ console.error("[FichaContactHydration] No se pudo refrescar la vista", error); }catch(innerError){}
      }
    }, 0);
  }

  function load(options){
    options = options || {};
    if(state.loading && options.force !== true){ return state.loading; }

    state.loading = ensureCoreReady()
      .then(function(){
        var stores = window.BL2Config && window.BL2Config.stores || {};
        return Promise.all([
          readStore(stores.contactos || "contactos"),
          readStore(stores.contactosEstudiante || "contactos_estudiante"),
          readStore(stores.personas || "personas")
        ]);
      })
      .then(function(result){
        buildMaps(result[0] || [], result[1] || [], result[2] || []);
        state.ready = true;
        state.lastLoadedAt = new Date().toISOString();
        state.error = "";
        patchAll();
        refreshView();

        try{
          window.dispatchEvent(new CustomEvent("ficha:contacts-hydrated", {
            detail:{
              version:VERSION,
              contacts:Object.keys(state.contacts).length,
              persons:Object.keys(state.persons).length,
              loadedAt:state.lastLoadedAt
            }
          }));
        }catch(error){}

        return status();
      })
      .catch(function(error){
        state.error = error && error.message ? error.message : String(error);
        try{ console.error("[FichaContactHydration]", error); }catch(innerError){}
        return status();
      })
      .then(function(result){
        state.loading = null;
        return result;
      });

    return state.loading;
  }

  function scheduleReload(){
    if(state.reloadTimer){ window.clearTimeout(state.reloadTimer); }
    state.reloadTimer = window.setTimeout(function(){
      state.reloadTimer = null;
      load({ force:true });
    }, 180);
  }

  function status(){
    return {
      ok:!state.error,
      ready:state.ready,
      patched:state.patched,
      version:VERSION,
      contacts:Object.keys(state.contacts).length,
      persons:Object.keys(state.persons).length,
      lastLoadedAt:state.lastLoadedAt,
      error:state.error
    };
  }

  window.FichaContactHydration = {
    version:VERSION,
    load:load,
    hydrate:hydrate,
    hydrateRows:hydrateRows,
    patch:patchAll,
    status:status,
    canonicalStudentPeriodId:canonicalStudentPeriodId
  };

  document.addEventListener("click", function(event){
    var target = event && event.target;
    if(target && target.id === "ficha-btn-refresh"){ scheduleReload(); }
  }, true);

  window.addEventListener("ficha:student-saved", scheduleReload);
  window.addEventListener("bdlocal:screen-data-updated", scheduleReload);
  window.addEventListener("bdlocal:legacy-snapshot", scheduleReload);
  window.addEventListener("requisitos:bl:snapshot-changed", scheduleReload);

  patchAll();
  load({ force:true });
})(window, document);

/* =========================================================
Nombre completo: tabla.data-guard.js
Ruta: /Gestion/Tabla/data/tabla.data-guard.js
Función:
- Conservar únicamente envelopes completos y coherentes de Tabla.
- Evitar mezclar períodos, estudiantes y requisitos de revisiones distintas.
- Marcar como stale la última revisión válida cuando una lectura nueva falla.
- Escuchar cambios de Base Local y solicitar una nueva lectura oficial.
- No instalar adaptadores globales ni reemplazar conectores existentes.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "3.0.0-atomic-envelope";
  var SOURCE = "TablaDataGuard";
  var EMPTY_CONFIRM_TTL = 10000;

  var C = window.TablaConstants || {};
  var U = window.TablaUtils || {};
  var E = window.TablaEvents || null;
  var S = window.TablaDataSource || null;

  var state = {
    installed: false,
    ready: false,
    captures: 0,
    accepted: 0,
    preserved: 0,
    refreshes: 0,
    failures: 0,
    revision: 0,
    lastEvent: "",
    lastError: "",
    lastAcceptedAt: "",
    lastPreserved: false,
    staleReason: "",
    allowEmptyUntil: 0,
    captureTimer: null,
    requestTimer: null,
    task: null,
    stopBase: null
  };

  function text(value){
    return U.text
      ? U.text(value)
      : String(value == null ? "" : value).trim();
  }

  function array(value){
    return Array.isArray(value) ? value : [];
  }

  function object(value){
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  }

  function now(){
    return U.nowIso ? U.nowIso() : new Date().toISOString();
  }

  function clone(value){
    if(Array.isArray(value)){
      return value.map(clone);
    }

    if(value && typeof value === "object"){
      var output = {};
      Object.keys(value).forEach(function(key){
        output[key] = clone(value[key]);
      });
      return output;
    }

    return value;
  }

  function emptyEnvelope(){
    return {
      meta: {
        source: SOURCE,
        revision: 0,
        stale: false,
        fallbackUsed: false,
        updatedAt: ""
      },
      periods: [],
      students: [],
      requirements: [],
      summaries: {},
      diagnostics: [],
      revision: 0,
      source: SOURCE
    };
  }

  var lastGood = emptyEnvelope();

  function normalizeEnvelope(value){
    value = object(value);

    var meta = object(value.meta);
    var revision = Number(
      value.revision ||
      meta.revision ||
      meta.cacheRevision ||
      0
    );

    return {
      meta: Object.assign({}, meta, {
        revision: revision,
        stale: meta.stale === true,
        fallbackUsed: meta.fallbackUsed === true
      }),
      periods: array(value.periods).slice(),
      students: array(value.students || value.rows).slice(),
      requirements: array(value.requirements || value.requisitos).slice(),
      summaries: Object.assign({}, object(value.summaries)),
      diagnostics: array(value.diagnostics).slice(),
      revision: revision,
      source: text(value.source || meta.source || "")
    };
  }

  function envelopeRevision(envelope){
    envelope = object(envelope);
    return Number(
      envelope.revision ||
      envelope.meta && envelope.meta.revision ||
      0
    );
  }

  function isConfirmedEmpty(){
    return state.allowEmptyUntil > Date.now();
  }

  function trustedSource(envelope){
    envelope = object(envelope);
    var source = text(envelope.source || envelope.meta && envelope.meta.source);

    return !source || [
      "ConTabla",
      "BDLocalConnectionClient"
    ].indexOf(source) >= 0;
  }

  function rowRevisions(rows){
    var found = Object.create(null);

    array(rows).forEach(function(row){
      row = object(row);
      var revision = Number(
        row._revision ||
        row.revision ||
        row.cacheRevision ||
        0
      );

      if(revision){
        found[revision] = true;
      }
    });

    return Object.keys(found).map(Number);
  }

  function validateEnvelope(envelope, options){
    envelope = normalizeEnvelope(envelope);
    options = object(options);

    var allowEmpty = options.allowEmpty === true || isConfirmedEmpty();
    var revision = envelopeRevision(envelope);
    var errors = [];
    var studentRevisions = rowRevisions(envelope.students);
    var requirementRevisions = rowRevisions(envelope.requirements);

    if(envelope.meta.fallbackUsed){
      errors.push("fuente de respaldo no autorizada");
    }

    if(envelope.meta.stale && options.acceptStale !== true){
      errors.push("el envelope recibido ya está marcado como stale");
    }

    if(!trustedSource(envelope)){
      errors.push("fuente distinta de ConTabla");
    }

    if(!allowEmpty){
      if(!envelope.periods.length){ errors.push("sin períodos"); }
      if(!envelope.students.length){ errors.push("sin estudiantes"); }
      if(!envelope.requirements.length){ errors.push("sin requisitos"); }
      if(!revision){ errors.push("sin revisión identificable"); }
    }

    if(
      state.revision > 0 &&
      revision > 0 &&
      revision < state.revision
    ){
      errors.push("revisión anterior a la última aceptada");
    }

    if(studentRevisions.length > 1){
      errors.push("estudiantes de varias revisiones");
    }

    if(requirementRevisions.length > 1){
      errors.push("requisitos de varias revisiones");
    }

    if(
      revision &&
      studentRevisions.length === 1 &&
      studentRevisions[0] !== revision
    ){
      errors.push("revisión de estudiantes distinta del envelope");
    }

    if(
      revision &&
      requirementRevisions.length === 1 &&
      requirementRevisions[0] !== revision
    ){
      errors.push("revisión de requisitos distinta del envelope");
    }

    return {
      ok: errors.length === 0,
      errors: errors,
      envelope: envelope,
      revision: revision,
      allowEmpty: allowEmpty
    };
  }

  function markFresh(envelope){
    envelope = normalizeEnvelope(envelope);

    envelope.meta = Object.assign({}, envelope.meta, {
      source: text(envelope.meta.source || envelope.source) || "ConTabla",
      revision: envelopeRevision(envelope),
      stale: false,
      fallbackUsed: false,
      guardedBy: SOURCE,
      guardedAt: now()
    });

    envelope.revision = envelope.meta.revision;
    envelope.source = envelope.meta.source;
    envelope.stale = false;
    envelope.staleReason = "";

    return envelope;
  }

  function markStale(envelope, reason){
    envelope = clone(envelope || emptyEnvelope());

    envelope.meta = Object.assign({}, object(envelope.meta), {
      stale: true,
      staleReason: text(reason) || "La lectura más reciente no fue aceptada.",
      guardedBy: SOURCE,
      guardedAt: now(),
      preservedRevision: envelopeRevision(envelope)
    });

    envelope.stale = true;
    envelope.staleReason = envelope.meta.staleReason;

    return envelope;
  }

  function hasLastGood(){
    return !!(
      lastGood.periods.length ||
      lastGood.students.length ||
      lastGood.requirements.length
    );
  }

  function acceptEnvelope(value, options){
    var validation = validateEnvelope(value, options || {});
    state.captures += 1;

    if(validation.ok){
      lastGood = markFresh(validation.envelope);
      state.accepted += 1;
      state.revision = validation.revision;
      state.lastAcceptedAt = now();
      state.lastError = "";
      state.lastPreserved = false;
      state.staleReason = "";
      state.ready = true;

      if(validation.allowEmpty){
        state.allowEmptyUntil = 0;
      }

      return clone(lastGood);
    }

    state.failures += 1;
    state.lastError = validation.errors.join("; ");
    state.staleReason = state.lastError;
    state.lastPreserved = hasLastGood();

    if(hasLastGood()){
      state.preserved += 1;
      return markStale(lastGood, state.lastError);
    }

    return markStale(emptyEnvelope(), state.lastError);
  }

  function sourceEnvelope(){
    if(!S || typeof S.readEnvelope !== "function"){
      return emptyEnvelope();
    }

    return S.readEnvelope();
  }

  function readCache(options){
    options = object(options);

    var current = sourceEnvelope();

    if(current && current.meta && current.meta.loading === true){
      return hasLastGood()
        ? markStale(lastGood, "Tabla está actualizando el envelope oficial.")
        : markStale(emptyEnvelope(), "Tabla todavía no termina de cargar el envelope oficial.");
    }

    return acceptEnvelope(current, options);
  }

  function requestTabla(reason, envelope){
    if(state.requestTimer){
      window.clearTimeout(state.requestTimer);
    }

    state.requestTimer = window.setTimeout(function(){
      state.requestTimer = null;

      var detail = {
        reason: reason || "data-guard",
        revision: envelopeRevision(envelope || lastGood),
        stale: !!(envelope && envelope.meta && envelope.meta.stale),
        source: SOURCE
      };

      if(E && typeof E.dataUpdated === "function"){
        E.dataUpdated(detail);
      }

      if(E && typeof E.requestRender === "function"){
        E.requestRender(detail);
      }

      if(
        window.TablaApp &&
        typeof window.TablaApp.request === "function"
      ){
        window.TablaApp.request(false, 30);
      }
    }, Math.max(0, Number(C.delays && C.delays.guardRequest || 40)));
  }

  function resolveResultEnvelope(result){
    result = object(result);

    if(result.envelope){
      return result.envelope;
    }

    if(result.data && result.data.envelope){
      return result.data.envelope;
    }

    return sourceEnvelope();
  }

  function loadOfficial(reason, options){
    options = object(options);
    state.lastEvent = text(reason || "load-official");

    if(state.task){
      return state.task;
    }

    var operation;

    if(options.refresh === true){
      state.refreshes += 1;

      if(!S || typeof S.refresh !== "function"){
        operation = Promise.reject(
          new Error("TablaDataSource.refresh no está disponible.")
        );
      }else{
        operation = S.refresh({
          full: true,
          immediate: true,
          force: true,
          source: options.source || "TablaDataGuard.refresh"
        });
      }
    }else if(S && typeof S.ready === "function"){
      operation = S.ready();
    }else{
      operation = Promise.resolve(sourceEnvelope());
    }

    state.task = Promise.resolve(operation)
      .then(function(result){
        var envelope = resolveResultEnvelope(result);
        var accepted = acceptEnvelope(envelope, {
          allowEmpty: options.allowEmpty === true
        });

        requestTabla(state.lastEvent, accepted);
        return accepted;
      })
      .catch(function(error){
        state.failures += 1;
        state.lastError = text(error && error.message || error);
        state.staleReason = state.lastError;
        state.lastPreserved = hasLastGood();

        var preserved = hasLastGood()
          ? markStale(lastGood, state.lastError)
          : markStale(emptyEnvelope(), state.lastError);

        if(hasLastGood()){
          state.preserved += 1;
        }

        requestTabla(state.lastEvent, preserved);
        return preserved;
      })
      .finally(function(){
        state.task = null;
      });

    return state.task;
  }

  function capture(reason, force, allowed){
    state.lastEvent = text(reason || "capture");

    if(force === true){
      loadOfficial(state.lastEvent, {
        refresh: true,
        allowEmpty: allowed === true
      });

      return hasLastGood()
        ? markStale(lastGood, "Actualización de Base Local en curso.")
        : readCache({allowEmpty: allowed === true});
    }

    var envelope = readCache({allowEmpty: allowed === true});
    requestTabla(state.lastEvent, envelope);
    return envelope;
  }

  function scheduleCapture(reason, force, allowed){
    if(state.captureTimer){
      window.clearTimeout(state.captureTimer);
    }

    state.captureTimer = window.setTimeout(function(){
      state.captureTimer = null;

      if(force === true){
        loadOfficial(reason || "base-event", {
          refresh: true,
          allowEmpty: allowed === true
        });
      }else{
        capture(reason || "base-event", false, allowed);
      }
    }, Math.max(0, Number(C.delays && C.delays.guardCapture || 120)));
  }

  function refresh(options){
    options = object(options);

    return loadOfficial("manual-refresh", {
      refresh: true,
      allowEmpty:
        options.allowEmpty === true ||
        options.confirmedEmpty === true,
      source: options.source || "TablaDataGuard.refresh"
    });
  }

  function confirmEmpty(scopes, ttl){
    state.allowEmptyUntil = Date.now() + Math.max(
      1000,
      Number(ttl) || EMPTY_CONFIRM_TTL
    );

    return {
      confirmed: true,
      scopes: scopes == null ? "all" : scopes,
      expiresAt: state.allowEmptyUntil
    };
  }

  function install(){
    state.installed = true;
    return window.TablaDataGuard;
  }

  function handleBaseEvent(info){
    info = object(info);
    var detail = object(info.detail);

    var allowEmpty =
      detail.allowEmpty === true ||
      detail.confirmedEmpty === true ||
      detail.deletionConfirmed === true;

    scheduleCapture(
      info.name || "base-event",
      true,
      allowEmpty
    );
  }

  function clear(){
    lastGood = emptyEnvelope();
    state.ready = false;
    state.revision = 0;
    state.lastError = "";
    state.staleReason = "";
    state.lastPreserved = false;
    state.allowEmptyUntil = 0;

    if(S && typeof S.invalidate === "function"){
      S.invalidate();
    }
  }

  function status(){
    return {
      ok: state.ready && !state.lastError,
      version: VERSION,
      installed: state.installed,
      ready: state.ready,
      source: SOURCE,
      revision: state.revision,
      periods: lastGood.periods.length,
      students: lastGood.students.length,
      requirements: lastGood.requirements.length,
      captures: state.captures,
      accepted: state.accepted,
      refreshes: state.refreshes,
      failures: state.failures,
      preserved: state.preserved,
      lastEvent: state.lastEvent,
      lastError: state.lastError,
      lastAcceptedAt: state.lastAcceptedAt,
      lastPreserved: state.lastPreserved,
      staleReason: state.staleReason,
      confirmedEmpty: isConfirmedEmpty(),
      taskActive: !!state.task,
      globalAdaptersInstalled: false
    };
  }

  function boot(){
    install();

    if(E && typeof E.listenBase === "function"){
      state.stopBase = E.listenBase(handleBaseEvent);
    }else{
      array(C.baseEvents).forEach(function(name){
        window.addEventListener(name, function(event){
          handleBaseEvent({
            name: name,
            detail: event && event.detail || {}
          });
        });
      });
    }

    loadOfficial("initial", {
      refresh: false
    });
  }

  window.TablaDataGuard = {
    version: VERSION,
    source: SOURCE,
    install: install,
    refresh: refresh,
    readCache: readCache,
    capture: capture,
    confirmEmpty: confirmEmpty,
    confirmDeletion: confirmEmpty,
    allowEmptyOnce: confirmEmpty,
    clear: clear,
    status: status
  };

  boot();
})(window);

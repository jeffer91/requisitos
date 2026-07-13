/* =========================================================
Nombre completo: tabla.data-source.js
Ruta: /Gestion/Tabla/data/tabla.data-source.js
Función:
- Ser la única puerta de entrada de Tabla hacia Base Local.
- Cargar BDLocalConnectionClient para la pantalla tabla.
- Leer períodos, estudiantes y requisitos desde un solo envelope.
- Mantener las interfaces usadas por tabla.app.js y tabla.data-guard.js.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "3.0.0-official-client";
  var SCREEN = "tabla";
  var SOURCE = "ConTabla";
  var U = window.TablaUtils || {};
  var N = window.TablaDataNormalizer || {};

  var state = {
    clientPromise: null,
    envelopePromise: null,
    envelope: null,
    reads: 0,
    refreshes: 0,
    failures: 0,
    lastError: "",
    updatedAt: "",
    revision: 0
  };

  function text(value){
    return U.text ? U.text(value) : String(value == null ? "" : value).trim();
  }

  function object(value){
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function array(value){
    return Array.isArray(value) ? value : [];
  }

  function now(){
    return U.nowIso ? U.nowIso() : new Date().toISOString();
  }

  function waitFor(test, label, timeout){
    timeout = Math.max(500, Number(timeout || 15000));
    var started = Date.now();

    return new Promise(function(resolve, reject){
      function check(){
        var value = null;
        try{ value = test(); }catch(error){ value = null; }
        if(value){ resolve(value); return; }
        if(Date.now() - started >= timeout){
          reject(new Error("No se pudo preparar " + label + "."));
          return;
        }
        window.setTimeout(check, 40);
      }
      check();
    });
  }

  function clientScriptUrl(){
    try{
      return new URL("../../BDLocal/conexiones/cone.client.js", document.baseURI).href;
    }catch(error){
      return "../../BDLocal/conexiones/cone.client.js";
    }
  }

  function existingClientScript(url){
    return Array.prototype.slice.call(document.scripts || []).some(function(script){
      try{ return new URL(script.src, document.baseURI).href === url; }
      catch(error){ return script.src === url; }
    });
  }

  function loadClient(){
    if(window.BDLocalConnectionClient){
      return Promise.resolve(window.BDLocalConnectionClient);
    }
    if(state.clientPromise){ return state.clientPromise; }

    var url = clientScriptUrl();
    if(existingClientScript(url)){
      state.clientPromise = waitFor(function(){
        return window.BDLocalConnectionClient;
      }, "BDLocalConnectionClient", 15000);
      return state.clientPromise;
    }

    state.clientPromise = new Promise(function(resolve, reject){
      var script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.defer = false;
      script.setAttribute("data-bdl-screen", SCREEN);
      script.setAttribute("data-tabla-owned-client", "true");
      script.onload = function(){
        waitFor(function(){
          return window.BDLocalConnectionClient;
        }, "BDLocalConnectionClient", 15000).then(resolve, reject);
      };
      script.onerror = function(){
        reject(new Error("No se pudo cargar el cliente oficial de Base Local."));
      };
      (document.head || document.documentElement).appendChild(script);
    }).catch(function(error){
      state.clientPromise = null;
      throw error;
    });

    return state.clientPromise;
  }

  function normalizeResponse(response){
    response = object(response);
    if(response.ok === false){
      throw new Error(
        text(response.error && response.error.message || response.message) ||
        "Base Local rechazó la lectura de Tabla."
      );
    }

    var data = object(response.data);
    var responseMeta = object(response.meta);
    var dataMeta = object(data.meta);
    var revision = Number(
      response.revision || responseMeta.revision || dataMeta.revision || 0
    );

    var raw = {
      meta: Object.assign({}, responseMeta, dataMeta, {
        source: text(responseMeta.source || dataMeta.source || response.source) || SOURCE,
        revision: revision,
        fallbackUsed: responseMeta.fallbackUsed === true || dataMeta.fallbackUsed === true,
        stale: responseMeta.stale === true || dataMeta.stale === true
      }),
      periods: array(data.periods || data.periodList || response.periods),
      students: array(data.students || data.rows || response.students || response.rows),
      requirements: array(
        data.requirements || data.requisitos || response.requirements || response.requisitos
      ),
      summaries: object(data.summaries || response.summaries),
      diagnostics: array(data.diagnostics || response.diagnostics)
    };

    if(raw.meta.fallbackUsed){
      throw new Error("Tabla recibió una fuente de respaldo no autorizada.");
    }
    if(raw.meta.stale){
      throw new Error("Tabla recibió información marcada como desactualizada.");
    }
    if(text(raw.meta.source) !== SOURCE && text(response.source) !== SOURCE){
      throw new Error("Tabla recibió datos desde una fuente distinta de ConTabla.");
    }
    if(!raw.periods.length){ throw new Error("ConTabla no entregó períodos."); }
    if(!raw.students.length){ throw new Error("ConTabla no entregó estudiantes."); }
    if(!raw.requirements.length){ throw new Error("ConTabla no entregó requisitos."); }

    var normalized = N.normalizeEnvelope ? N.normalizeEnvelope(raw) : raw;
    normalized = object(normalized);
    normalized.meta = Object.assign({}, raw.meta, object(normalized.meta), {
      source: SOURCE,
      revision: revision,
      fallbackUsed: false,
      stale: false
    });
    normalized.periods = array(normalized.periods);
    normalized.students = array(normalized.students);
    normalized.requirements = array(normalized.requirements);
    normalized.summaries = object(normalized.summaries);
    normalized.diagnostics = array(normalized.diagnostics);
    normalized.revision = revision;
    normalized.source = SOURCE;
    return normalized;
  }

  function fetchEnvelope(options){
    options = object(options);
    if(state.envelopePromise && options.force !== true){ return state.envelopePromise; }
    if(state.envelope && options.force !== true){ return Promise.resolve(state.envelope); }

    state.envelopePromise = loadClient()
      .then(function(client){
        if(!client || typeof client.read !== "function"){
          throw new Error("BDLocalConnectionClient.read no está disponible.");
        }
        return client.read(SCREEN, {
          matricula: "",
          force: options.force === true,
          source: options.source || "TablaDataSource.read"
        });
      })
      .then(normalizeResponse)
      .then(function(envelope){
        state.envelope = envelope;
        state.revision = Number(envelope.revision || envelope.meta.revision || 0);
        state.updatedAt = now();
        state.lastError = "";
        state.reads += 1;
        return state.envelope;
      })
      .catch(function(error){
        state.failures += 1;
        state.lastError = text(error && error.message || error);
        throw error;
      })
      .finally(function(){ state.envelopePromise = null; });

    return state.envelopePromise;
  }

  function periodIdOf(row){
    row = object(row);
    return U.canonicalPeriodId
      ? U.canonicalPeriodId(
          row._periodoId || row.periodoId || row.periodId ||
          row.periodoCanonicoId || row.ultimoPeriodoId || ""
        )
      : text(row._periodoId || row.periodoId || row.periodId || "");
  }

  function samePeriod(a, b){
    return U.samePeriod ? U.samePeriod(a, b) : (!text(b) || text(a) === text(b));
  }

  function filterRows(rows, options){
    rows = array(rows);
    options = object(options);
    var periodId = text(options.periodId || options.periodoId);
    var matricula = text(options.matricula).toUpperCase();
    var search = text(options.search || options.query).toLowerCase();

    var output = rows.filter(function(row){
      row = object(row);
      if(periodId && !samePeriod(periodIdOf(row), periodId)){ return false; }
      if(matricula && text(
        row._matricula || row._estadoMatricula || row.estadoMatricula || row.matricula
      ).toUpperCase() !== matricula){ return false; }
      if(search && text(
        row._search || [
          row._cedula, row._nombres, row._carrera, row._correo,
          row._celular, row._telegramUser, row._telegramChatId
        ].join(" ")
      ).toLowerCase().indexOf(search) < 0){ return false; }
      return true;
    });

    var limit = Math.max(0, Number(options.limit || 0));
    return limit > 0 ? output.slice(0, limit) : output;
  }

  function readPeriods(){
    return fetchEnvelope().then(function(envelope){ return envelope.periods.slice(); });
  }

  function readStudents(options){
    return fetchEnvelope().then(function(envelope){
      return filterRows(envelope.students, options || {});
    });
  }

  function ready(){
    return loadClient()
      .then(function(client){
        return typeof client.ready === "function" ? client.ready(SCREEN) : client;
      })
      .then(function(){ return fetchEnvelope(); })
      .then(status);
  }

  function refresh(options){
    options = Object.assign({
      full: true,
      immediate: true,
      force: true,
      source: "TablaDataSource.refresh"
    }, options || {});

    state.refreshes += 1;
    return loadClient()
      .then(function(client){
        if(!client || typeof client.refresh !== "function"){
          throw new Error("BDLocalConnectionClient.refresh no está disponible.");
        }
        return client.refresh(SCREEN, options);
      })
      .then(function(response){
        if(response && response.ok === false){
          throw new Error(
            text(response.error && response.error.message) ||
            "No se pudo actualizar Tabla desde Base Local."
          );
        }
        invalidate();
        return fetchEnvelope({force: true, source: "TablaDataSource.after-refresh"});
      })
      .then(function(envelope){
        return {ok: true, envelope: envelope, revision: envelope.revision, source: SOURCE};
      })
      .catch(function(error){
        state.failures += 1;
        state.lastError = text(error && error.message || error);
        throw error;
      });
  }

  function invalidate(){
    state.envelope = null;
    state.envelopePromise = null;
  }

  function readEnvelope(){
    return state.envelope || {
      meta: {source: SOURCE, revision: 0, fallbackUsed: false, stale: false, loading: true},
      periods: [],
      students: [],
      requirements: [],
      summaries: {},
      diagnostics: [],
      revision: 0,
      source: SOURCE
    };
  }

  function status(){
    var envelope = readEnvelope();
    return {
      ok: !state.lastError && !!state.envelope,
      version: VERSION,
      connector: "BDLocalConnectionClient",
      source: SOURCE,
      revision: state.revision,
      periods: array(envelope.periods).length,
      students: array(envelope.students).length,
      requirements: array(envelope.requirements).length,
      reads: state.reads,
      refreshes: state.refreshes,
      failures: state.failures,
      lastError: state.lastError,
      updatedAt: state.updatedAt
    };
  }

  window.TablaDataSource = {
    version: VERSION,
    ready: ready,
    source: function(){ return SOURCE; },
    readEnvelope: readEnvelope,
    readCache: readEnvelope,
    readPeriods: readPeriods,
    listPeriods: readPeriods,
    readStudents: readStudents,
    listStudents: readStudents,
    refresh: refresh,
    invalidate: invalidate,
    status: status
  };
})(window, document);

/* =========================================================
Nombre completo: cone.carga.js
Ruta o ubicación: /Requisitos/BDLocal/conexiones/cone.carga.js
Función o funciones:
- Conectar la pantalla Carga con BDLocal/BL2.
- Exponer métodos de guardado compatibles con CargaSave.
- Guardar estudiantes en IndexedDB mediante BL2Core.
- Actualizar cache de conexiones en modo liviano después de cargas reales.
- Evitar reconstrucciones completas innecesarias que vuelven lenta la app.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.2-light-cache";
  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;

  if(!HUB || !U){ return; }

  function core(){
    return window.BL2Core || null;
  }

  function ready(){
    return HUB.ensureCoreReady();
  }

  function safeRefreshCache(options){
    options = Object.assign({ source: "cone.carga", light: true }, options || {});

    if(!HUB || typeof HUB.refreshCache !== "function"){
      return Promise.resolve(null);
    }

    return HUB.refreshCache(options).catch(function(error){
      U.emit("bdlocal:con-carga-cache-warning", {
        ok: false,
        message: error && error.message ? error.message : String(error),
        source: options.source || "cone.carga"
      });
      return null;
    });
  }

  function getPeriods(){
    return ready().then(function(){
      if(core() && typeof core().getPeriods === "function"){
        return core().getPeriods();
      }
      return U.readCache().periods;
    });
  }

  function savePeriod(period){
    period = U.normalizePeriod(period);
    if(!period){ return Promise.reject(new Error("Periodo invalido.")); }

    return ready().then(function(){
      if(core() && typeof core().savePeriod === "function"){
        return core().savePeriod(period).then(function(saved){
          return safeRefreshCache({
            source: "cone.carga.savePeriod",
            light: true,
            immediate: true
          }).then(function(){
            return saved || period;
          });
        });
      }
      return period;
    });
  }

  function setActivePeriod(periodoId, periodoLabel){
    periodoId = U.canonicalPeriodId(periodoId);
    periodoLabel = U.text(periodoLabel || periodoId);

    if(!periodoId){
      return Promise.reject(new Error("Seleccione un periodo valido."));
    }

    try{ window.localStorage.setItem("carga.periodoSeleccionado", periodoId); }catch(error){}
    try{ window.localStorage.setItem("carga.periodoSeleccionadoLabel", periodoLabel); }catch(error2){}

    return ready().then(function(){
      if(core() && typeof core().setActivePeriod === "function"){
        return core().setActivePeriod(periodoId, periodoLabel);
      }
      return {
        id: periodoId,
        label: periodoLabel,
        periodoId: periodoId,
        periodoLabel: periodoLabel,
        periodoCanonicoId: periodoId,
        periodoCanonicoLabel: periodoLabel
      };
    });
  }

  function normalizeOptions(options){
    options = Object.assign({}, options || {});
    options.periodoId = U.canonicalPeriodId(options.periodoCanonicoId || options.periodoId || options.id || "");
    options.periodoLabel = U.text(options.periodoCanonicoLabel || options.periodoLabel || options.label || options.periodoId);
    options.periodoCanonicoId = options.periodoId;
    options.periodoCanonicoLabel = options.periodoLabel;
    options.normalized = options.normalized !== false;
    options.source = options.source || "carga_excel";
    return options;
  }

  function saveStudents(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = normalizeOptions(options || {});

    if(!options.periodoId){
      return Promise.reject(new Error("No hay periodo seleccionado para guardar."));
    }

    return ready().then(function(){
      if(!core() || typeof core().saveStudents !== "function"){
        throw new Error("BL2Core.saveStudents no esta disponible para Carga.");
      }

      U.emit("bdlocal:con-carga-saving", {
        ok: true,
        periodoId: options.periodoId,
        total: rows.length,
        source: options.source
      });

      return core().saveStudents(rows, options).then(function(result){
        return safeRefreshCache({
          source: "cone.carga.saveStudents",
          light: true,
          periodoId: options.periodoId,
          delay: 120
        }).then(function(){
          U.emit("bdlocal:con-carga-saved", {
            ok: result && result.ok !== false,
            periodoId: options.periodoId,
            periodoLabel: options.periodoLabel,
            total: rows.length,
            saved: result && typeof result.total === "number" ? result.total : rows.length,
            source: options.source
          });
          return result;
        });
      });
    });
  }

  function guardarEstudiantes(rows, periodoInfo, options){
    periodoInfo = periodoInfo || {};
    options = Object.assign({}, options || {}, periodoInfo || {});
    return saveStudents(rows, options);
  }

  function getSummary(periodoId){
    periodoId = U.canonicalPeriodId(periodoId || "");

    return ready().then(function(){
      if(core() && typeof core().getSummary === "function"){
        return core().getSummary(periodoId);
      }
      return { periodoId: periodoId, totalEstudiantes: 0 };
    });
  }

  var api = {
    version: VERSION,
    source: "BDLocal/conexiones/cone.carga.js",
    ready: ready,
    getPeriods: getPeriods,
    listarPeriodos: getPeriods,
    savePeriod: savePeriod,
    guardarPeriodo: savePeriod,
    setActivePeriod: setActivePeriod,
    saveStudents: saveStudents,
    guardarEstudiantes: guardarEstudiantes,
    getSummary: getSummary,
    resumen: getSummary
  };

  HUB.register("carga", api);
  window.BDLocalCarga = api;
  window.ConCarga = api;

  if(!window.BDLRepoEstudiantes){
    window.BDLRepoEstudiantes = {
      guardarMuchos: function(rows, periodoInfo, options){
        return guardarEstudiantes(rows, periodoInfo, options);
      }
    };
  }
})(window);
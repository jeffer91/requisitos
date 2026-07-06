/* =========================================================
Nombre completo: con.carga.js
Ruta o ubicacion: /Requisitos/BDLocal/conexiones/con.carga.js
Funcion:
- Conectar la pantalla Carga con BDLocal/BL2.
- Exponer metodos de guardado compatibles con CargaSave.
========================================================= */
(function(window){
  "use strict";

  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;

  if(!HUB || !U){ return; }

  function core(){ return window.BL2Core || null; }

  function ready(){
    return HUB.ensureCoreReady();
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
          return HUB.refreshCache({ source:"con.carga.savePeriod" }).then(function(){ return saved || period; });
        });
      }
      return period;
    });
  }

  function setActivePeriod(periodoId, periodoLabel){
    periodoId = U.canonicalPeriodId(periodoId);
    periodoLabel = U.text(periodoLabel || periodoId);
    if(!periodoId){ return Promise.reject(new Error("Seleccione un periodo valido.")); }

    try{ localStorage.setItem("carga.periodoSeleccionado", periodoId); }catch(error){}
    try{ localStorage.setItem("carga.periodoSeleccionadoLabel", periodoLabel); }catch(error2){}

    return ready().then(function(){
      if(core() && typeof core().setActivePeriod === "function"){
        return core().setActivePeriod(periodoId, periodoLabel);
      }
      return { id:periodoId, label:periodoLabel, periodoId:periodoId, periodoLabel:periodoLabel };
    });
  }

  function saveStudents(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = Object.assign({}, options || {});
    options.periodoId = U.canonicalPeriodId(options.periodoCanonicoId || options.periodoId || options.id || "");
    options.periodoLabel = U.text(options.periodoCanonicoLabel || options.periodoLabel || options.label || options.periodoId);
    options.periodoCanonicoId = options.periodoId;
    options.periodoCanonicoLabel = options.periodoLabel;
    options.normalized = options.normalized !== false;
    options.source = options.source || "carga_excel";

    if(!options.periodoId){
      return Promise.reject(new Error("No hay periodo seleccionado para guardar."));
    }

    return ready().then(function(){
      if(!core() || typeof core().saveStudents !== "function"){
        throw new Error("BL2Core.saveStudents no esta disponible para Carga.");
      }

      return core().saveStudents(rows, options).then(function(result){
        return HUB.refreshCache({ source:"con.carga.saveStudents" }).then(function(){
          U.emit("bdlocal:con-carga-saved", {
            ok:result && result.ok !== false,
            periodoId:options.periodoId,
            total:rows.length
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
      return { periodoId:periodoId, totalEstudiantes:0 };
    });
  }

  var api = {
    version:"1.0.0",
    source:"BDLocal/conexiones/con.carga.js",
    ready:ready,
    getPeriods:getPeriods,
    listarPeriodos:getPeriods,
    savePeriod:savePeriod,
    guardarPeriodo:savePeriod,
    setActivePeriod:setActivePeriod,
    saveStudents:saveStudents,
    guardarEstudiantes:guardarEstudiantes,
    getSummary:getSummary,
    resumen:getSummary
  };

  HUB.register("carga", api);
  window.BDLocalCarga = api;
  window.ConCarga = api;

  if(!window.BDLRepoEstudiantes){
    window.BDLRepoEstudiantes = {
      guardarMuchos:function(rows, periodoInfo, options){
        return guardarEstudiantes(rows, periodoInfo, options);
      }
    };
  }
})(window);

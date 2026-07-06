/* =========================================================
Nombre completo: con.index.js
Ruta o ubicacion: /Requisitos/BDLocal/conexiones/con.index.js
Funcion:
- Inicializar el nucleo BDLocal/BL2 desde cualquier pantalla.
- Cargar conectores por pantalla.
- Mantener una cache liviana para pantallas sincronas antiguas.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.0.0";
  var U = window.BDLocalConUtils;

  if(!U){
    throw new Error("BDLocalConUtils debe cargarse antes de con.index.js");
  }

  var currentScript = document.currentScript;
  var state = {
    ready:false,
    loading:null,
    coreReady:false,
    cacheReady:false,
    connectors:{},
    errors:[]
  };

  function log(message, payload){
    try{ console.log("[BDLocalConexiones] " + message, payload || ""); }catch(error){}
  }

  function warn(message, payload){
    state.errors.push({ message:message, payload:U.clone(payload || null), at:U.nowISO() });
    try{ console.warn("[BDLocalConexiones] " + message, payload || ""); }catch(error){}
  }

  function url(relative){
    try{ return new URL(relative, currentScript && currentScript.src ? currentScript.src : window.location.href).href; }
    catch(error){ return relative; }
  }

  function scriptAlreadyLoaded(src){
    var list = Array.prototype.slice.call(document.scripts || []);
    return list.some(function(script){
      return script.src === src || script.getAttribute("data-bdl-con-src") === src;
    });
  }

  function loadScript(relative){
    var src = url(relative);
    if(scriptAlreadyLoaded(src)){ return Promise.resolve(src); }

    return new Promise(function(resolve, reject){
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.defer = false;
      script.setAttribute("data-bdl-con-src", src);
      script.onload = function(){ resolve(src); };
      script.onerror = function(){ reject(new Error("No se pudo cargar " + src)); };
      document.head.appendChild(script);
    });
  }

  function loadSequential(files){
    var chain = Promise.resolve();
    files.forEach(function(file){
      chain = chain.then(function(){ return loadScript(file); });
    });
    return chain;
  }

  function core(){ return window.BL2Core || window.BDLocal || null; }

  function ensureCoreScripts(){
    var files = [];

    if(!window.BL2Config){ files.push("../bl2.config.js"); }
    if(!window.BL2DB){ files.push("../bl2.db.js"); }
    if(!window.BL2Backup){ files.push("../bl2.backup.js"); }
    if(!window.BL2Import){ files.push("../bl2.import.js"); }
    if(!window.BL2Sync){ files.push("../bl2.sync.js"); }
    if(!window.BL2Core){ files.push("../bl2.core.js"); }
    if(!window.BDLocal || !window.BL2DataEngine || !window.ExcelLocalRepo){ files.push("../bl2.compat.js"); }

    return loadSequential(files).catch(function(error){
      warn("No se pudieron cargar todos los scripts de BL2", error);
      return null;
    });
  }

  function ensureCoreReady(){
    return ensureCoreScripts().then(function(){
      var c = window.BL2Core;
      var bd = window.BDLocal;

      if(bd && typeof bd.ready === "function"){
        return bd.ready().then(function(){ state.coreReady = true; return c || bd; });
      }

      if(c && typeof c.getState === "function"){
        try{
          var st = c.getState() || {};
          if(st.initialized){ state.coreReady = true; return c; }
        }catch(error){}
      }

      if(c && typeof c.init === "function"){
        return c.init().catch(function(error){
          warn("BL2Core.init no pudo completarse", error);
          return null;
        }).then(function(){
          state.coreReady = true;
          return c;
        });
      }

      state.coreReady = !!(c || bd);
      return c || bd || null;
    });
  }

  function refreshCache(options){
    options = options || {};
    return ensureCoreReady().then(function(c){
      c = window.BL2Core || c;
      if(!c){
        return U.readCache();
      }

      var periodsPromise = typeof c.getPeriods === "function" ? c.getPeriods().catch(function(){ return []; }) : Promise.resolve([]);
      var studentsPromise = typeof c.getStudents === "function" ? c.getStudents({}).catch(function(){ return []; }) : Promise.resolve([]);
      var reqsPromise = typeof c.getRequirements === "function" ? c.getRequirements({}).catch(function(){ return []; }) : Promise.resolve([]);

      return Promise.all([periodsPromise, studentsPromise, reqsPromise]).then(function(values){
        var periods = values[0] || [];
        var students = values[1] || [];
        var requirements = values[2] || [];
        var cache = U.normalizeCache({
          meta:{
            app:"Requisitos",
            module:"BDLocalConexiones",
            version:VERSION,
            source:options.source || "BL2Core",
            updatedAt:U.nowISO()
          },
          periods:periods,
          students:students,
          requirements:requirements,
          summaries:{},
          diagnostics:state.errors.slice(-20)
        });
        state.cacheReady = true;
        return U.writeCache(cache);
      });
    });
  }

  function register(name, api){
    name = U.text(name);
    if(!name || !api){ return false; }
    state.connectors[name] = api;
    window.BDLocalConexiones[name] = api;
    U.emit("bdlocal:conexion-registrada", { name:name });
    return true;
  }

  function get(name){
    return state.connectors[U.text(name)] || null;
  }

  function loadConnectors(){
    return loadSequential([
      "con.carga.js",
      "con.tabla.js",
      "con.ficha.js",
      "con.stats.js",
      "con.coordi.js",
      "con.reportes.js"
    ]).catch(function(error){
      warn("No se pudieron cargar todos los conectores", error);
      return null;
    });
  }

  function ready(options){
    options = options || {};
    if(state.ready && !options.force){ return Promise.resolve(status()); }
    if(state.loading && !options.force){ return state.loading; }

    state.loading = ensureCoreReady()
      .then(function(){ return refreshCache({ source:"BDLocalConexiones.ready" }); })
      .then(function(){ return loadConnectors(); })
      .then(function(){
        state.ready = true;
        U.emit("bdlocal:conexiones-ready", status());
        return status();
      })
      .catch(function(error){
        warn("Error inicializando conexiones", error);
        state.ready = true;
        return status();
      })
      .finally(function(){
        state.loading = null;
      });

    return state.loading;
  }

  function status(){
    var cache = U.readCache();
    return {
      ok:state.errors.length === 0,
      version:VERSION,
      ready:state.ready,
      coreReady:state.coreReady,
      cacheReady:state.cacheReady,
      connectors:Object.keys(state.connectors),
      periods:cache.periods.length,
      students:cache.students.length,
      errors:state.errors.slice(-10),
      updatedAt:U.nowISO()
    };
  }

  window.BDLocalConexiones = window.BDLocalConexiones || {};
  Object.assign(window.BDLocalConexiones, {
    version:VERSION,
    ready:ready,
    ensureCoreReady:ensureCoreReady,
    refreshCache:refreshCache,
    register:register,
    get:get,
    status:status,
    utils:U
  });

  ready({ force:false }).then(function(){
    log("Conexiones listas", status());
  });
})(window, document);

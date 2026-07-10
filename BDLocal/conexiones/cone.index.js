(function(window,document){
  "use strict";

  var VERSION="1.3.0-shared-cache-safe-refresh";
  var U=window.BDLocalConUtils;
  if(!U){return;}

  var base=document.currentScript&&document.currentScript.src?document.currentScript.src:window.location.href;
  var state={
    connectors:{},
    errors:[],
    ready:false,
    loading:null,
    refreshTimer:null,
    refreshPromise:null,
    refreshResolver:null,
    refreshSerial:Promise.resolve(),
    lastRefreshMode:""
  };

  function src(file){try{return new URL(file,base).href;}catch(error){return file;}}

  function add(file){
    return new Promise(function(resolve){
      var url=src(file);
      var exists=Array.prototype.slice.call(document.scripts||[]).some(function(script){
        return script.src===url||script.getAttribute("data-bdl-con-src")===url;
      });
      if(exists){resolve(url);return;}

      var script=document.createElement("script");
      script.src=url;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-bdl-con-src",url);
      script.onload=function(){resolve(url);};
      script.onerror=function(){
        state.errors.push({file:file,message:"No se pudo cargar el script.",at:U.nowISO()});
        resolve(url);
      };
      document.head.appendChild(script);
    });
  }

  function seq(files){
    var chain=Promise.resolve();
    files.forEach(function(file){chain=chain.then(function(){return add(file);});});
    return chain;
  }

  function register(name,api){
    name=U.text(name);
    if(!name||!api){return false;}
    state.connectors[name]=api;
    window.BDLocalConexiones[name]=api;
    return true;
  }

  function get(name){return state.connectors[U.text(name)]||null;}

  function needsConfigV2(){
    var cfg=window.BL2Config||{};
    var stores=cfg.stores||{};
    return !window.BL2Config||Number(cfg.dbVersion||1)<2||!stores.matriculasPeriodo||!stores.requisitosEstudiante||!stores.cambiosPendientes;
  }

  function ensureCoreScripts(){
    var files=[];
    if(!window.BL2Config){files.push("../bl2.config.js");}
    if(!window.BL2DB&&needsConfigV2()){files.push("../bl2.config.v2.js");}
    if(!window.BL2DB){files.push("../bl2.db.js");}
    if(!window.BDLOutboxBridge){files.push("../patches/bdl.changes.outbox-bridge.js");}
    if(!window.BDLV2Mirror){files.push("../patches/bdl.v2.mirror.js");}
    if(!window.BL2Backup){files.push("../bl2.backup.js");}
    if(!window.BL2Import){files.push("../bl2.import.js");}
    if(!window.BL2Sync){files.push("../bl2.sync.js");}
    if(!window.BL2Core){files.push("../bl2.core.js");}
    if(!window.BDLocal||!window.BL2DataEngine||!window.ExcelLocalRepo){files.push("../bl2.compat.js");}
    return seq(files);
  }

  function ensureCoreReady(){
    return ensureCoreScripts().then(function(){
      var core=window.BL2Core||null;
      var bdlocal=window.BDLocal||null;

      if(window.BL2DB&&window.BL2Config&&Number(window.BL2Config.dbVersion||1)<2){
        state.errors.push({
          file:"../bl2.config.v2.js",
          message:"BL2DB ya estaba cargado antes de aplicar configuración V2.",
          at:U.nowISO()
        });
      }

      if(window.BDLOutboxBridge&&typeof window.BDLOutboxBridge.install==="function"){
        try{window.BDLOutboxBridge.install();}catch(error){}
      }
      if(window.BDLV2Mirror&&typeof window.BDLV2Mirror.install==="function"){
        try{window.BDLV2Mirror.install();}catch(error2){}
      }

      if(bdlocal&&typeof bdlocal.ready==="function"){
        return bdlocal.ready().then(function(){return core||bdlocal;}).catch(function(error3){
          state.errors.push({file:"bl2.compat.js",message:error3&&error3.message?error3.message:String(error3),at:U.nowISO()});
          return core||bdlocal;
        });
      }

      if(core&&typeof core.getState==="function"){
        try{
          var coreState=core.getState()||{};
          if(coreState.initialized){return core;}
        }catch(error4){}
      }

      if(core&&typeof core.init==="function"){
        return core.init().then(function(){return core;}).catch(function(error5){
          state.errors.push({file:"bl2.core.js",message:error5&&error5.message?error5.message:String(error5),at:U.nowISO()});
          return core;
        });
      }

      return core||bdlocal||null;
    });
  }

  function hasRows(value){return Array.isArray(value)&&value.length>0;}

  function refreshMode(options,existing){
    options=options||{};
    existing=existing||U.readCache();
    if(options.full===true||options.mode==="full"){return "full";}
    if(options.periodsOnly===true||options.light===true||options.mode==="light"){return "light";}
    if(hasRows(existing.students)){return "light";}
    return "full";
  }

  function preferFresh(fresh,existing,allowEmpty){
    fresh=Array.isArray(fresh)?fresh:[];
    existing=Array.isArray(existing)?existing:[];
    if(fresh.length||allowEmpty===true||!existing.length){return fresh;}
    return existing;
  }

  function writeCachePayload(mode,existing,periods,students,requirements,source,options){
    existing=existing||U.emptyCache();
    options=options||{};

    var finalPeriods=preferFresh(periods,existing.periods,options.allowEmpty===true);
    var finalStudents=preferFresh(students,existing.students,options.allowEmpty===true);
    var finalRequirements=preferFresh(requirements,existing.requirements,options.allowEmpty===true);

    var payload={
      meta:{
        app:"Requisitos",
        module:"BDLocalConexiones",
        version:VERSION,
        source:source||"cone.index",
        refreshMode:mode,
        updatedAt:U.nowISO(),
        schemaVersion:(window.BL2Config&&window.BL2Config.schemaVersion)||"",
        preservedStudents:!hasRows(students)&&hasRows(existing.students),
        preservedPeriods:!hasRows(periods)&&hasRows(existing.periods),
        storageMode:"shared-frame-cache"
      },
      periods:finalPeriods,
      students:finalStudents,
      requirements:finalRequirements,
      summaries:existing.summaries||{},
      diagnostics:state.errors.slice()
    };

    state.lastRefreshMode=mode;
    return U.writeCache(payload,{
      source:source||"cone.index",
      allowEmpty:options.allowEmpty===true
    });
  }

  function performRefresh(options){
    options=options||{};
    var existing=U.readCache(true);

    return ensureCoreReady().then(function(core){
      core=window.BL2Core||core;
      if(!core){return existing;}

      var mode=refreshMode(options,existing);
      var periodPromise=typeof core.getPeriods==="function"
        ?core.getPeriods().catch(function(){return existing.periods||[];})
        :Promise.resolve(existing.periods||[]);

      if(mode==="light"){
        return periodPromise.then(function(periods){
          return writeCachePayload(
            "light",
            existing,
            periods,
            existing.students||[],
            existing.requirements||[],
            options.source||"cone.index.light",
            options
          );
        });
      }

      var studentPromise=typeof core.getStudents==="function"
        ?core.getStudents({matricula:""}).catch(function(error){
          state.errors.push({file:"BL2Core.getStudents",message:error&&error.message?error.message:String(error),at:U.nowISO()});
          return existing.students||[];
        })
        :Promise.resolve(existing.students||[]);

      var requirementPromise=typeof core.getRequirements==="function"
        ?core.getRequirements({}).catch(function(error2){
          state.errors.push({file:"BL2Core.getRequirements",message:error2&&error2.message?error2.message:String(error2),at:U.nowISO()});
          return existing.requirements||[];
        })
        :Promise.resolve(existing.requirements||[]);

      return Promise.all([periodPromise,studentPromise,requirementPromise]).then(function(result){
        return writeCachePayload(
          "full",
          existing,
          result[0]||[],
          result[1]||[],
          result[2]||[],
          options.source||"cone.index.full",
          options
        );
      });
    }).catch(function(error){
      state.errors.push({file:"cone.index.js",message:error&&error.message?error.message:String(error),at:U.nowISO()});
      return existing;
    });
  }

  function enqueueRefresh(options){
    options=Object.assign({},options||{});
    state.refreshSerial=state.refreshSerial.catch(function(){return null;}).then(function(){
      return performRefresh(options);
    });
    return state.refreshSerial;
  }

  function refreshCache(options){
    options=options||{};

    if(options.full===true||options.mode==="full"||options.immediate===true||options.force===true){
      return enqueueRefresh(options);
    }

    if(state.refreshTimer){
      window.clearTimeout(state.refreshTimer);
      state.refreshTimer=null;
    }

    if(!state.refreshPromise){
      state.refreshPromise=new Promise(function(resolve){state.refreshResolver=resolve;});
    }

    state.refreshTimer=window.setTimeout(function(){
      var resolver=state.refreshResolver;
      state.refreshTimer=null;
      state.refreshResolver=null;

      enqueueRefresh(Object.assign({},options,{light:true})).then(function(result){
        var output=result||U.readCache();
        state.refreshPromise=null;
        if(typeof resolver==="function"){resolver(output);}
      });
    },Number(options.delay||90));

    return state.refreshPromise;
  }

  function loadConnectors(){
    return seq([
      "cone.carga.js",
      "cone.tabla.js",
      "cone.ficha.js",
      "cone.stats.js",
      "cone.coordi.js",
      "cone.reportes.js",
      "cone.defensas.js",
      "cone.global.js"
    ]);
  }

  function status(){
    var cache=U.readCache();
    return {
      ok:state.errors.length===0,
      ready:state.ready,
      connectors:Object.keys(state.connectors),
      periods:cache.periods.length,
      students:cache.students.length,
      requirements:cache.requirements.length,
      refreshMode:state.lastRefreshMode||((cache.meta&&cache.meta.refreshMode)||""),
      outboxBridge:!!window.BDLOutboxBridge,
      v2Mirror:!!window.BDLV2Mirror,
      sharedCache:true,
      errors:state.errors.slice()
    };
  }

  function ready(options){
    options=options||{};
    if(state.ready&&!options.force){return Promise.resolve(status());}
    if(state.loading&&!options.force){return state.loading;}

    var shared=typeof U.requestSharedCache==="function"
      ?U.requestSharedCache({timeout:Number(options.sharedTimeout||1800)}).catch(function(){return U.readCache();})
      :Promise.resolve(U.readCache());

    state.loading=shared
      .then(function(){
        return refreshCache({source:"BDLocalConexiones.ready",immediate:true});
      })
      .then(function(){return loadConnectors();})
      .then(function(){
        state.ready=true;
        return status();
      })
      .catch(function(error){
        state.errors.push({file:"cone.index.js",message:error&&error.message?error.message:String(error),at:U.nowISO()});
        return status();
      })
      .then(function(result){
        state.loading=null;
        return result;
      });

    return state.loading;
  }

  window.BDLocalConexiones=window.BDLocalConexiones||{};
  Object.assign(window.BDLocalConexiones,{
    version:VERSION,
    ready:ready,
    ensureCoreReady:ensureCoreReady,
    refreshCache:refreshCache,
    register:register,
    get:get,
    status:status,
    utils:U
  });

  ready({force:false});
})(window,document);

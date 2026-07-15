/* =========================================================
Archivo: bdl.diagnostics.index.js
Ruta: /BDLocal/diagnostics/bdl.diagnostics.index.js
Función:
- Crear el punto de entrada de diagnóstico de BDLocal.
- Cargar ConBaseLocal y el mapa uno-a-uno de pantallas.
- Preparar de forma no destructiva Ncomplex.
- Mantener el sincronizador automático seguro de Google Sheets.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="0.4.0-screen-connectors";
  var KEY="REQ_BDL_DIAGNOSTICS_V1";
  var currentScript=document.currentScript;
  var scriptBase=currentScript&&currentScript.src?currentScript.src:window.location.href;
  var autoLoader=null;
  var ncomplexLoader=null;
  var screenLoader=null;

  function text(value){return String(value==null?"":value).trim();}
  function read(){
    try{var raw=window.localStorage.getItem(KEY);return raw?JSON.parse(raw):[];}
    catch(error){return [];}
  }
  function write(rows){try{window.localStorage.setItem(KEY,JSON.stringify((rows||[]).slice(-300)));}catch(error){}}
  function add(scope,level,message,data){
    var rows=read();
    rows.push({
      id:"diag_"+Date.now()+"_"+Math.random().toString(16).slice(2),
      scope:text(scope||"BDLocal"),level:text(level||"INFO").toUpperCase(),
      message:text(message),data:data||null,createdAt:new Date().toISOString()
    });
    write(rows);
    return rows[rows.length-1];
  }
  function clear(){write([]);return true;}

  function source(relativePath){
    try{return new URL(relativePath,scriptBase).href;}
    catch(error){return relativePath;}
  }

  function existingScript(url){
    return Array.prototype.slice.call(document.scripts||[]).some(function(item){
      try{return new URL(item.src,window.location.href).href===url;}
      catch(error){return item.src===url;}
    });
  }

  function waitFor(test,label,timeout){
    timeout=Math.max(500,Number(timeout||15000));
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        var value=null;
        try{value=test();}catch(error){value=null;}
        if(value){resolve(value);return;}
        if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}
        window.setTimeout(check,40);
      })();
    });
  }

  function loadScript(relativePath,test,attribute){
    var url=source(relativePath);
    var current=null;
    try{current=test();}catch(error){current=null;}
    if(current){return Promise.resolve(current);}
    if(existingScript(url)){return waitFor(test,relativePath,15000);}

    return new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=url;
      script.async=false;
      script.defer=false;
      script.setAttribute(attribute||"data-bdl-diagnostics-bootstrap",relativePath);
      script.onload=function(){
        var value=null;
        try{value=test();}catch(error){value=null;}
        value?resolve(value):reject(new Error("El archivo no expuso la API esperada: "+relativePath));
      };
      script.onerror=function(){reject(new Error("No se pudo cargar: "+relativePath));};
      (document.head||document.documentElement).appendChild(script);
    });
  }

  function startScreenConnections(){
    if(screenLoader){return screenLoader;}
    screenLoader=Promise.resolve()
      .then(function(){
        return loadScript("../conexiones/cone.screen-map.js",function(){return window.BDLocalConeScreenMap;},"data-bdl-screen-map");
      })
      .then(function(map){
        if(map&&typeof map.apply==="function"){map.apply();}
        return loadScript("../conexiones/cone.baselocal.js",function(){return window.ConBaseLocal;},"data-bdl-baselocal");
      })
      .then(function(connector){
        var result={
          ok:!!connector,
          baselocal:!!window.ConBaseLocal,
          screenMap:window.BDLocalConeScreenMap&&typeof window.BDLocalConeScreenMap.status==="function"
            ?window.BDLocalConeScreenMap.status()
            :null
        };
        add("connections","INFO","Conectores exclusivos de pantalla registrados.",result);
        try{window.dispatchEvent(new CustomEvent("bdlocal:screen-connections-ready",{detail:result}));}catch(error){}
        return result;
      })
      .catch(function(error){
        var result={ok:false,error:error&&error.message?error.message:String(error)};
        add("connections","ERROR","No se pudieron preparar los conectores de pantalla.",result);
        screenLoader=null;
        return result;
      });
    return screenLoader;
  }

  function registerNcomplex(){
    var registry=window.BDLocalConeRegistry;
    if(!registry||typeof registry.register!=="function"){
      throw new Error("BDLocalConeRegistry no está disponible para registrar Ncomplex.");
    }
    var existing=typeof registry.get==="function"?registry.get("ncomplex"):null;
    if(existing){return existing;}
    return registry.register("ncomplex",{
      label:"Ncomplex",global:"ConNcomplex",file:"cone.ncomplex.js",
      pathHints:["/ncomplex/","ncomplex.html"],
      aliases:["complexivo","notas_complexivo","evaluaciones_titulacion"],
      canRead:true,canWrite:true,
      operations:["ready","read","save","refresh","status"],
      tables:[
        "periodos","personas","matriculas_periodo","requisitos_estudiante",
        "evaluaciones_titulacion","importaciones","cambios_pendientes"
      ],
      description:"Gestiona notas de examen complexivo y trabajo de titulación."
    });
  }

  function ncomplexStatus(){
    var config=window.BL2Config||{};
    var stores=config.stores||{};
    var registry=window.BDLocalConeRegistry;
    var registered=false;
    try{registered=!!(registry&&typeof registry.get==="function"&&registry.get("ncomplex"));}catch(error){}
    return {
      ok:!!(
        Number(config.dbVersion||0)>=3&&stores.evaluacionesTitulacion&&
        window.BDLRulesEvaluacionesTitulacion&&window.BDLRepoEvaluacionesTitulacion&&
        window.BDLRepoImportaciones&&window.BDLServiceNcomplex&&
        window.BDLMigrationV3Ncomplex&&window.ConNcomplex
      ),
      dbVersion:Number(config.dbVersion||0),store:stores.evaluacionesTitulacion||"",
      rules:!!window.BDLRulesEvaluacionesTitulacion,
      repository:!!window.BDLRepoEvaluacionesTitulacion,
      importsRepository:!!window.BDLRepoImportaciones,
      service:!!window.BDLServiceNcomplex,migration:!!window.BDLMigrationV3Ncomplex,
      connector:!!window.ConNcomplex,registered:registered
    };
  }

  function startNcomplexIntegration(){
    if(ncomplexLoader){return ncomplexLoader;}
    ncomplexLoader=Promise.resolve()
      .then(function(){
        return loadScript("../bl2.config.v3.js",function(){
          var config=window.BL2Config||{};
          return Number(config.dbVersion||0)>=3&&config.stores&&config.stores.evaluacionesTitulacion?config:null;
        });
      })
      .then(function(){return loadScript("../rules/bdl.rules.evaluaciones-titulacion.js",function(){return window.BDLRulesEvaluacionesTitulacion;});})
      .then(function(){return loadScript("../repositories/bdl.repo.evaluaciones-titulacion.js",function(){return window.BDLRepoEvaluacionesTitulacion;});})
      .then(function(){return loadScript("../repositories/bdl.repo.importaciones.js",function(){return window.BDLRepoImportaciones;});})
      .then(function(){return loadScript("../services/bdl.service.ncomplex.js",function(){return window.BDLServiceNcomplex;});})
      .then(function(){return loadScript("../migrations/bdl.migration.v3.ncomplex.js",function(){return window.BDLMigrationV3Ncomplex;});})
      .then(function(){
        registerNcomplex();
        return loadScript("../conexiones/cone.ncomplex.js",function(){return window.ConNcomplex;});
      })
      .then(function(connector){
        return connector&&typeof connector.ready==="function"
          ?Promise.resolve(connector.ready()).then(function(){return connector;})
          :connector;
      })
      .then(function(){
        var result=ncomplexStatus();
        if(!result.ok){throw new Error("Ncomplex no terminó de preparar sus componentes locales.");}
        add("ncomplex","INFO","Ncomplex quedó integrado con BDLocal.",result);
        try{window.dispatchEvent(new CustomEvent("bdlocal:ncomplex-integration-ready",{detail:result}));}catch(error){}
        return result;
      })
      .catch(function(error){
        var result=ncomplexStatus();
        result.error=error&&error.message?error.message:String(error);
        add("ncomplex","ERROR","No se pudo completar la integración de Ncomplex.",result);
        ncomplexLoader=null;
        throw error;
      });
    return ncomplexLoader;
  }

  function startGoogleAutoSync(){
    if(window.BDLGoogleAutoSync){
      if(typeof window.BDLGoogleAutoSync.start==="function"){window.BDLGoogleAutoSync.start();}
      return Promise.resolve(window.BDLGoogleAutoSync);
    }
    if(autoLoader){return autoLoader;}
    autoLoader=new Promise(function(resolve){
      var existing=document.querySelector('script[data-bdl-google-auto-sync="true"]');
      if(existing){
        existing.addEventListener("load",function(){
          if(window.BDLGoogleAutoSync&&typeof window.BDLGoogleAutoSync.start==="function"){window.BDLGoogleAutoSync.start();}
          resolve(window.BDLGoogleAutoSync||null);
        },{once:true});
        existing.addEventListener("error",function(){resolve(null);},{once:true});
        return;
      }
      var script=document.createElement("script");
      script.src="sync/bdl.sync.google-auto.js";
      script.async=false;
      script.setAttribute("data-bdl-google-auto-sync","true");
      script.onload=function(){
        if(window.BDLGoogleAutoSync&&typeof window.BDLGoogleAutoSync.start==="function"){window.BDLGoogleAutoSync.start();}
        add("google_auto_sync","INFO","Automatización segura de Google Sheets cargada.",window.BDLGoogleAutoSync&&window.BDLGoogleAutoSync.status?window.BDLGoogleAutoSync.status():null);
        resolve(window.BDLGoogleAutoSync||null);
      };
      script.onerror=function(){
        add("google_auto_sync","ERROR","No se pudo cargar la automatización de Google Sheets.",null);
        autoLoader=null;
        resolve(null);
      };
      document.body.appendChild(script);
    });
    return autoLoader;
  }

  window.BDLDiagnostics={
    version:VERSION,key:KEY,add:add,read:read,clear:clear,
    startGoogleAutoSync:startGoogleAutoSync,
    startNcomplexIntegration:startNcomplexIntegration,ncomplexStatus:ncomplexStatus,
    startScreenConnections:startScreenConnections
  };

  window.setTimeout(function(){
    startScreenConnections();
    startNcomplexIntegration().catch(function(){});
  },0);

  window.addEventListener("bdlocal:bl2-html-scripts-loaded",function(){
    startGoogleAutoSync();
    startScreenConnections();
    startNcomplexIntegration().catch(function(){});
  },{once:true});
})(window,document);
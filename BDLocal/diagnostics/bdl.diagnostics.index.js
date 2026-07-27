/* =========================================================
Archivo: bdl.diagnostics.index.js
Ruta: /BDLocal/diagnostics/bdl.diagnostics.index.js
Función:
- Crear el punto de entrada de diagnóstico de BDLocal.
- Preparar BDLocalPantallas y ConexionesExternas con compatibilidad temporal.
- Cargar la interfaz final del Centro de datos únicamente en bl2.html.
- Preparar Ncomplex sin iniciar operaciones externas automáticas.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="0.8.0-manual-external-only";
  var KEY="REQ_BDL_DIAGNOSTICS_V1";
  var currentScript=document.currentScript;
  var scriptBase=currentScript&&currentScript.src?currentScript.src:window.location.href;
  var ncomplexLoader=null;
  var screenLoader=null;
  var pantallasLoader=null;
  var externalLoader=null;
  var centerUiLoader=null;

  function text(value){return String(value==null?"":value).trim();}
  function read(){try{var raw=window.localStorage.getItem(KEY);return raw?JSON.parse(raw):[];}catch(error){return [];}}
  function write(rows){try{window.localStorage.setItem(KEY,JSON.stringify((rows||[]).slice(-300)));}catch(error){}}
  function add(scope,level,message,data){
    var rows=read();
    rows.push({
      id:"diag_"+Date.now()+"_"+Math.random().toString(16).slice(2),
      scope:text(scope||"BDLocal"),
      level:text(level||"INFO").toUpperCase(),
      message:text(message),
      data:data||null,
      createdAt:new Date().toISOString()
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

  function startPantallasFacade(){
    if(pantallasLoader){return pantallasLoader;}
    pantallasLoader=Promise.resolve()
      .then(function(){return loadScript("../pantallas/bdl.pantallas.contract.js",function(){return window.BDLocalPantallasContract;},"data-bdl-pantallas");})
      .then(function(){return loadScript("../pantallas/bdl.pantallas.registry.js",function(){return window.BDLocalPantallasRegistry;},"data-bdl-pantallas");})
      .then(function(){return loadScript("../pantallas/bdl.pantallas.client.js",function(){return window.BDLocalPantallasClient;},"data-bdl-pantallas");})
      .then(function(){return loadScript("../pantallas/bdl.pantallas.monitor.js",function(){return window.BDLocalPantallasMonitor;},"data-bdl-pantallas");})
      .then(function(){return loadScript("../pantallas/bdl.pantallas.index.js",function(){return window.BDLocalPantallas;},"data-bdl-pantallas");})
      .then(function(api){
        var result=api&&typeof api.status==="function"?api.status():{ok:!!api};
        add("pantallas","INFO","API interna de Base Local para pantallas preparada.",result);
        try{window.dispatchEvent(new CustomEvent("bdlocal:pantallas-facade-ready",{detail:result}));}catch(error){}
        return api;
      })
      .catch(function(error){
        var result={ok:false,error:error&&error.message?error.message:String(error)};
        add("pantallas","ERROR","No se pudo preparar la API interna de pantallas.",result);
        pantallasLoader=null;
        throw error;
      });
    return pantallasLoader;
  }

  function startExternalConnectionsFacade(){
    if(externalLoader){return externalLoader;}
    externalLoader=Promise.resolve()
      .then(function(){return loadScript("../../ConexionesExternas/core/conexiones.externas.contract.js",function(){return window.ConexionesExternasContract;},"data-conexiones-externas");})
      .then(function(){return loadScript("../../ConexionesExternas/core/conexiones.externas.providers.js",function(){return window.ConexionesExternasProviders;},"data-conexiones-externas");})
      .then(function(){return loadScript("../../ConexionesExternas/usage/conexiones.externas.usage.js",function(){return window.ConexionesExternasUsage;},"data-conexiones-externas");})
      .then(function(){return loadScript("../../ConexionesExternas/providers/firebase/conexiones.externas.firebase.js",function(){return window.ConexionesExternasFirebase;},"data-conexiones-externas");})
      .then(function(){return loadScript("../../ConexionesExternas/providers/supabase/conexiones.externas.supabase.js",function(){return window.ConexionesExternasSupabase;},"data-conexiones-externas");})
      .then(function(){return loadScript("../../ConexionesExternas/providers/google-sheets/conexiones.externas.google-sheets.js",function(){return window.ConexionesExternasGoogleSheets;},"data-conexiones-externas");})
      .then(function(){return loadScript("../../ConexionesExternas/core/conexiones.externas.index.js",function(){return window.ConexionesExternas;},"data-conexiones-externas");})
      .then(function(api){
        return Promise.resolve(api&&typeof api.status==="function"?api.status():{ok:!!api}).then(function(result){
          add("external_connections","INFO","API de conexiones externas preparada.",result);
          try{window.dispatchEvent(new CustomEvent("conexiones-externas:facade-ready",{detail:result}));}catch(error){}
          return api;
        });
      })
      .catch(function(error){
        var result={ok:false,error:error&&error.message?error.message:String(error)};
        add("external_connections","ERROR","No se pudo preparar la API de conexiones externas.",result);
        externalLoader=null;
        throw error;
      });
    return externalLoader;
  }

  function startCentroDatosUI(){
    if(!document.getElementById("bdlocal-control-center-root")){return Promise.resolve(null);}
    if(centerUiLoader){return centerUiLoader;}
    centerUiLoader=loadScript("../centro-datos/centro-datos.ui.js",function(){return window.CentroDatosUI;},"data-centro-datos-ui")
      .then(function(api){
        return Promise.resolve(api&&typeof api.mount==="function"?api.mount():api).then(function(){
          var result=api&&typeof api.getState==="function"?api.getState():{mounted:!!api};
          add("centro_datos_ui","INFO","Interfaz final del Centro de datos preparada.",result);
          return api;
        });
      })
      .catch(function(error){
        add("centro_datos_ui","ERROR","No se pudo preparar la interfaz final del Centro de datos.",{error:error&&error.message?error.message:String(error)});
        centerUiLoader=null;
        throw error;
      });
    return centerUiLoader;
  }

  function startScreenConnections(){
    if(screenLoader){return screenLoader;}
    screenLoader=Promise.resolve()
      .then(function(){return loadScript("../conexiones/cone.screen-map.js",function(){return window.BDLocalConeScreenMap;},"data-bdl-screen-map");})
      .then(function(map){
        if(map&&typeof map.apply==="function"){map.apply();}
        return loadScript("../conexiones/cone.baselocal.js",function(){return window.ConBaseLocal;},"data-bdl-baselocal");
      })
      .then(function(connector){
        return startPantallasFacade().then(function(pantallas){
          var result={
            ok:!!connector&&!!pantallas,
            baselocal:!!window.ConBaseLocal,
            pantallas:window.BDLocalPantallas&&typeof window.BDLocalPantallas.status==="function"?window.BDLocalPantallas.status():null,
            screenMap:window.BDLocalConeScreenMap&&typeof window.BDLocalConeScreenMap.status==="function"?window.BDLocalConeScreenMap.status():null
          };
          add("connections","INFO","Conectores exclusivos de pantalla registrados.",result);
          try{window.dispatchEvent(new CustomEvent("bdlocal:screen-connections-ready",{detail:result}));}catch(error){}
          return result;
        });
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
    if(!registry||typeof registry.register!=="function"){throw new Error("BDLocalConeRegistry no está disponible para registrar Ncomplex.");}
    var existing=typeof registry.get==="function"?registry.get("ncomplex"):null;
    if(existing){return existing;}
    return registry.register("ncomplex",{
      label:"Ncomplex",global:"ConNcomplex",file:"cone.ncomplex.js",
      pathHints:["/ncomplex/","ncomplex.html"],
      aliases:["complexivo","notas_complexivo","evaluaciones_titulacion"],
      canRead:true,canWrite:true,
      operations:["ready","read","save","refresh","status"],
      tables:["periodos","personas","matriculas_periodo","requisitos_estudiante","evaluaciones_titulacion","importaciones","cambios_pendientes"],
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
      dbVersion:Number(config.dbVersion||0),
      store:stores.evaluacionesTitulacion||"",
      rules:!!window.BDLRulesEvaluacionesTitulacion,
      repository:!!window.BDLRepoEvaluacionesTitulacion,
      importsRepository:!!window.BDLRepoImportaciones,
      service:!!window.BDLServiceNcomplex,
      migration:!!window.BDLMigrationV3Ncomplex,
      connector:!!window.ConNcomplex,
      registered:registered
    };
  }

  function startNcomplexIntegration(){
    if(ncomplexLoader){return ncomplexLoader;}
    ncomplexLoader=Promise.resolve()
      .then(function(){return loadScript("../bl2.config.v3.js",function(){var config=window.BL2Config||{};return Number(config.dbVersion||0)>=3&&config.stores&&config.stores.evaluacionesTitulacion?config:null;});})
      .then(function(){return loadScript("../rules/bdl.rules.evaluaciones-titulacion.js",function(){return window.BDLRulesEvaluacionesTitulacion;});})
      .then(function(){return loadScript("../repositories/bdl.repo.evaluaciones-titulacion.js",function(){return window.BDLRepoEvaluacionesTitulacion;});})
      .then(function(){return loadScript("../repositories/bdl.repo.importaciones.js",function(){return window.BDLRepoImportaciones;});})
      .then(function(){return loadScript("../services/bdl.service.ncomplex.js",function(){return window.BDLServiceNcomplex;});})
      .then(function(){return loadScript("../migrations/bdl.migration.v3.ncomplex.js",function(){return window.BDLMigrationV3Ncomplex;});})
      .then(function(){registerNcomplex();return loadScript("../conexiones/cone.ncomplex.js",function(){return window.ConNcomplex;});})
      .then(function(connector){return connector&&typeof connector.ready==="function"?Promise.resolve(connector.ready()).then(function(){return connector;}):connector;})
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

  function disableLegacyGoogleAutoSync(){
    var current=window.BDLGoogleAutoSync||null;
    if(current&&typeof current.disable==="function"){
      try{return current.disable("Política manual de Conexiones Externas.");}
      catch(error){return {ok:false,error:error.message||String(error)};}
    }
    return {ok:true,loaded:false,manualOnly:true,automatic:false};
  }

  window.BDLDiagnostics={
    version:VERSION,
    key:KEY,
    add:add,
    read:read,
    clear:clear,
    disableLegacyGoogleAutoSync:disableLegacyGoogleAutoSync,
    startPantallasFacade:startPantallasFacade,
    startExternalConnectionsFacade:startExternalConnectionsFacade,
    startCentroDatosUI:startCentroDatosUI,
    startNcomplexIntegration:startNcomplexIntegration,
    ncomplexStatus:ncomplexStatus,
    startScreenConnections:startScreenConnections
  };

  window.setTimeout(function(){
    disableLegacyGoogleAutoSync();
    startScreenConnections();
    startNcomplexIntegration().catch(function(){});
  },0);

  window.addEventListener("bdlocal:bl2-html-scripts-loaded",function(){
    disableLegacyGoogleAutoSync();
    startScreenConnections();
    startExternalConnectionsFacade()
      .then(function(){return startCentroDatosUI();})
      .catch(function(){});
    startNcomplexIntegration().catch(function(){});
  },{once:true});
})(window,document);

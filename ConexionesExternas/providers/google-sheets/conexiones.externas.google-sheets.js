/* =========================================================
Nombre completo: conexiones.externas.google-sheets.js
Ruta: /ConexionesExternas/providers/google-sheets/conexiones.externas.google-sheets.js
Función:
- Encapsular estado, prueba, subida, descarga y consumo de Google Sheets.
- Delegar temporalmente en Apps Script y el motor seguro existentes.
- Mantener todas las operaciones como manuales.
- Diferenciar módulos disponibles de conexión remota verificada.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.1.0-live-manual-test";

  function C(){return window.ConexionesExternasContract||null;}
  function registry(){return window.ConexionesExternasProviders||null;}
  function sync(){return window.BDLSyncOrchestrator||null;}
  function puller(){return window.BL2CloudPullSafe||null;}
  function store(){return window.BDLocalConfigStore||null;}
  function manager(){return window.BDLocalSyncManager||null;}
  function usage(){return window.ConexionesExternasUsage||null;}

  function config(){
    try{return store()&&typeof store().getSheetsConfig==="function"?store().getSheetsConfig({includeSecret:false})||{}:{};}
    catch(error){return {error:error.message||String(error)};}
  }

  function state(){
    var current=config();
    var target=window.BDLSyncTargets&&typeof window.BDLSyncTargets.get==="function"
      ?window.BDLSyncTargets.get("google")
      :null;
    var available=!!target&&!!puller();
    var configured=!!current.enabled&&!!current.appsScriptUrl&&!!current.spreadsheetId;
    var connected=!!current.connected&&String(current.status||"").toLowerCase()==="ok";
    var message=connected
      ?"Conexión verificada manualmente."
      :configured
        ?"Configurada; ejecute Probar para verificar Apps Script."
        :"Google Sheets no está completamente configurado.";

    return Promise.resolve({
      ok:available,
      target:"google",
      label:"Google Sheets",
      manualOnly:true,
      automatic:false,
      configured:configured,
      connected:connected,
      verified:connected,
      available:available,
      pulling:!!(puller()&&typeof puller().isPulling==="function"&&puller().isPulling()),
      message:message,
      detail:current
    });
  }

  function test(){
    var current=manager();
    if(!current||typeof current.testSheets!=="function"){
      return Promise.resolve(C().failure({
        target:"google",
        operation:"test",
        blocked:true,
        message:"La prueba manual de Google Sheets no está disponible."
      }));
    }

    return Promise.resolve(current.testSheets()).then(function(result){
      return result&&result.ok===true
        ?C().success({target:"google",operation:"test",data:result,message:result.message||"Google Sheets respondió correctamente."})
        :C().failure({target:"google",operation:"test",data:result,message:result&&result.message||"Google Sheets no respondió correctamente."});
    }).catch(function(error){
      return C().failure({target:"google",operation:"test",error:error});
    });
  }

  function push(options){
    var current=sync();
    if(!current||typeof current.syncTarget!=="function"){
      return Promise.resolve(C().failure({target:"google",operation:"push",blocked:true,message:"El orquestador externo no está disponible."}));
    }
    return Promise.resolve(current.syncTarget("google",C().manualOptions(options))).then(function(result){
      return result&&result.ok===false
        ?C().failure({target:"google",operation:"push",data:result,message:result.message||"Google Sheets no completó la subida."})
        :C().success({target:"google",operation:"push",data:result,message:"Subida a Google Sheets finalizada."});
    }).catch(function(error){return C().failure({target:"google",operation:"push",error:error});});
  }

  function periodOf(options){
    options=options||{};
    if(options.period&&options.period.id){return options.period;}
    if(options.periodoId){return {id:options.periodoId,label:options.periodoLabel||options.periodoId};}
    return null;
  }

  function pull(options){
    options=options||{};
    var current=puller();
    if(!current){return Promise.resolve(C().failure({target:"google",operation:"pull",blocked:true,message:"El importador seguro de Google Sheets no está disponible."}));}
    var operation;
    var args=[];
    if(options.allPeriods===true){
      operation=current.pullAllSheetsToLocal;
      args=[options];
    }else{
      operation=current.pullSheetsToLocal;
      args=[periodOf(options),options];
    }
    if(typeof operation!=="function"){return Promise.resolve(C().unsupported("google","pull"));}
    return Promise.resolve(operation.apply(current,args)).then(function(result){
      return result&&result.ok===false
        ?C().failure({target:"google",operation:"pull",data:result,message:result.message||"Google Sheets no completó la descarga."})
        :C().success({target:"google",operation:"pull",data:result,message:"Descarga de Google Sheets finalizada."});
    }).catch(function(error){return C().failure({target:"google",operation:"pull",error:error});});
  }

  var provider={
    version:VERSION,
    label:"Google Sheets",
    manualOnly:true,
    capabilities:{test:true,pull:true,push:true,usage:true},
    status:state,
    test:test,
    pull:pull,
    push:push,
    usage:function(){return usage()&&usage().get?usage().get("google"):null;}
  };

  if(registry()&&typeof registry().register==="function"){
    registry().register("google",provider);
  }
  window.ConexionesExternasGoogleSheets=provider;
})(window);

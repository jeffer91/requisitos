/* =========================================================
Nombre completo: conexiones.externas.firebase.js
Ruta: /ConexionesExternas/providers/firebase/conexiones.externas.firebase.js
Función:
- Encapsular estado, prueba, subida, descarga y consumo de Firebase.
- Delegar temporalmente en los motores Firebase V2 existentes.
- Mantener todas las operaciones como manuales.
- Verificar Firebase con una consulta remota mínima y de solo lectura.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.1.0-live-manual-test";

  function C(){return window.ConexionesExternasContract||null;}
  function registry(){return window.ConexionesExternasProviders||null;}
  function sync(){return window.BDLSyncOrchestrator||null;}
  function control(){return window.RequisitosFirebaseControlCenter||null;}
  function store(){return window.BDLocalConfigStore||null;}
  function legacySync(){return window.BL2Sync||null;}
  function usage(){return window.ConexionesExternasUsage||null;}

  function localConfig(){
    try{
      var current=store();
      var cfg=current&&typeof current.loadConfig==="function"?current.loadConfig()||{}:{};
      return cfg.firebase||{};
    }catch(error){return {error:error.message||String(error)};}
  }

  function firebaseRuntimeConfig(){
    var cfg=window.BL2Config&&window.BL2Config.firebase||{};
    return cfg.config||{};
  }

  function state(){
    var current=control();
    var cfg=localConfig();
    var runtimeCfg=firebaseRuntimeConfig();
    var value=current&&typeof current.status==="function"?current.status():{};
    var available=!!current&&!!sync()&&!!legacySync();
    var configured=!!window.RequisitosFirebaseRepository&&!!runtimeCfg.projectId&&!!runtimeCfg.apiKey;
    var connected=!!cfg.connected&&String(cfg.status||"").toLowerCase()==="ok";
    var message=connected
      ?"Conexión verificada manualmente."
      :configured
        ?"Configurada; ejecute Probar para verificar Firestore."
        :"Firebase no está completamente configurado.";

    return Promise.resolve(value).then(function(detail){
      return {
        ok:connected,
        target:"firebase",
        label:"Firebase",
        manualOnly:true,
        automatic:false,
        configured:configured,
        connected:connected,
        verified:connected,
        available:available,
        message:message,
        detail:detail||{}
      };
    });
  }

  function updateConnection(connected,status,error){
    var current=store();
    if(current&&typeof current.updateConnectionStatus==="function"){
      current.updateConnectionStatus("firebase",{
        connected:!!connected,
        status:status||(connected?"ok":"error"),
        lastError:error||""
      });
    }
  }

  function test(){
    var current=legacySync();
    if(!current||typeof current.ensureFirebase!=="function"){
      return Promise.resolve(C().failure({
        target:"firebase",
        operation:"test",
        blocked:true,
        message:"La inicialización manual de Firebase no está disponible."
      }));
    }

    return Promise.resolve(current.ensureFirebase()).then(function(firestore){
      if(!firestore||typeof firestore.collection!=="function"){
        throw new Error("Firestore no expuso una conexión utilizable.");
      }
      var schema=window.RequisitosFirebaseSchema||{};
      var collection=schema.collections&&schema.collections.periodos||"periodos";
      var query=firestore.collection(collection);
      if(query&&typeof query.limit==="function"){query=query.limit(1);}
      if(!query||typeof query.get!=="function"){
        throw new Error("Firestore no permite ejecutar la prueba de lectura.");
      }
      return query.get().then(function(snapshot){
        var reads=Math.max(1,Number(snapshot&&snapshot.size||0));
        updateConnection(true,"ok","");
        if(store()&&typeof store().registerFirebaseUsage==="function"){
          store().registerFirebaseUsage({reads:reads,label:"Prueba manual de conexión Firebase."});
        }
        return C().success({
          target:"firebase",
          operation:"test",
          data:{collection:collection,documents:Number(snapshot&&snapshot.size||0),readsEstimated:reads},
          message:"Firebase respondió correctamente a una lectura manual."
        });
      });
    }).catch(function(error){
      updateConnection(false,"error",error&&error.message?error.message:String(error));
      return C().failure({target:"firebase",operation:"test",error:error});
    });
  }

  function push(options){
    var current=sync();
    if(!current||typeof current.syncTarget!=="function"){
      return Promise.resolve(C().failure({target:"firebase",operation:"push",blocked:true,message:"El orquestador externo no está disponible."}));
    }
    return Promise.resolve(current.syncTarget("firebase",C().manualOptions(options))).then(function(result){
      return result&&result.ok===false
        ?C().failure({target:"firebase",operation:"push",data:result,message:result.message||"Firebase no completó la subida."})
        :C().success({target:"firebase",operation:"push",data:result,message:"Subida Firebase finalizada."});
    }).catch(function(error){return C().failure({target:"firebase",operation:"push",error:error});});
  }

  function pull(options){
    options=options||{};
    var current=control();
    if(!current){return Promise.resolve(C().failure({target:"firebase",operation:"pull",blocked:true,message:"El centro Firebase no está disponible."}));}
    var operation=options.allPeriods===true
      ?current.pullAllPeriods
      :current.pullPeriod;
    if(typeof operation!=="function"){
      return Promise.resolve(C().unsupported("firebase","pull"));
    }
    return Promise.resolve(operation.call(current,options)).then(function(result){
      return result&&result.ok===false
        ?C().failure({target:"firebase",operation:"pull",data:result,message:result.message||"Firebase no completó la descarga."})
        :C().success({target:"firebase",operation:"pull",data:result,message:"Descarga Firebase finalizada."});
    }).catch(function(error){return C().failure({target:"firebase",operation:"pull",error:error});});
  }

  var provider={
    version:VERSION,
    label:"Firebase",
    manualOnly:true,
    capabilities:{test:true,pull:true,push:true,usage:true},
    status:state,
    test:test,
    pull:pull,
    push:push,
    usage:function(){return usage()&&usage().get?usage().get("firebase"):null;}
  };

  if(registry()&&typeof registry().register==="function"){
    registry().register("firebase",provider);
  }
  window.ConexionesExternasFirebase=provider;
})(window);

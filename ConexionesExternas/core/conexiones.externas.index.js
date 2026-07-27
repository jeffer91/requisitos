/* =========================================================
Nombre completo: conexiones.externas.index.js
Ruta: /ConexionesExternas/core/conexiones.externas.index.js
Función:
- Exponer la puerta oficial de sincronización externa.
- Unificar Firebase, Supabase y Google Sheets.
- Mantener operaciones manuales, independientes y con lotes limitados.
- Delegar temporalmente en los motores existentes sin romper compatibilidad.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-conexiones-externas";

  function C(){return window.ConexionesExternasContract||null;}
  function registry(){return window.ConexionesExternasProviders||null;}
  function sync(){return window.BDLSyncV2||null;}
  function target(value){return C().normalizeTarget(value);}

  function provider(name){
    var current=registry();
    return current&&typeof current.get==="function"?current.get(target(name)):null;
  }

  function requireProvider(name){
    var current=provider(name);
    if(!current){throw new Error("Proveedor externo no disponible: "+target(name));}
    return current;
  }

  function execute(name,operation,options){
    name=target(name);
    options=options||{};
    var current;
    try{current=requireProvider(name);}catch(error){return Promise.resolve(C().failure({target:name,operation:operation,error:error,blocked:true}));}
    if(typeof current[operation]!=="function"){
      return Promise.resolve(C().unsupported(name,operation));
    }

    var started={target:name,operation:operation,manualOnly:true,at:C().now()};
    C().dispatch(C().EVENTS.STARTED,started);

    return Promise.resolve().then(function(){return current[operation](options);}).then(function(result){
      C().dispatch(C().EVENTS.FINISHED,{target:name,operation:operation,result:result,at:C().now()});
      return result;
    }).catch(function(error){
      var result=C().failure({target:name,operation:operation,error:error});
      C().dispatch(C().EVENTS.ERROR,{target:name,operation:operation,result:result,at:C().now()});
      return result;
    });
  }

  function status(){
    var list=registry()&&registry().list?registry().list():[];
    var operations=list.map(function(item){
      var current=provider(item.id);
      return Promise.resolve(current&&typeof current.status==="function"?current.status():{ok:false,target:item.id});
    });
    var syncStatus=sync()&&typeof sync().status==="function"
      ?Promise.resolve(sync().status()).catch(function(error){return {ok:false,error:error.message||String(error)};})
      :Promise.resolve({ok:false,available:false});

    return Promise.all([Promise.all(operations),syncStatus]).then(function(values){
      var providers=values[0];
      var engine=values[1];
      var report={
        ok:list.length===3,
        version:VERSION,
        namespace:"ConexionesExternas",
        manualOnly:true,
        automatic:false,
        maxBatchSize:C().MAX_BATCH_SIZE,
        paused:!!(sync()&&typeof sync().isPaused==="function"&&sync().isPaused()),
        providers:providers,
        providerRegistry:registry()&&registry().status?registry().status():{},
        engine:engine,
        usage:window.ConexionesExternasUsage&&window.ConexionesExternasUsage.all?window.ConexionesExternasUsage.all():[],
        compatibilityGlobals:[
          "BDLSyncV2",
          "BDLSyncOrchestrator",
          "BDLSyncTargets",
          "RequisitosFirebaseControlCenter",
          "BL2CloudPullSafe",
          "BDLocalConfigStore"
        ],
        updatedAt:C().now()
      };
      C().dispatch(C().EVENTS.STATUS_UPDATED,report);
      return report;
    });
  }

  function syncQueue(options){
    var current=sync();
    if(!current||typeof current.syncQueue!=="function"){
      return Promise.resolve(C().failure({operation:"syncQueue",blocked:true,message:"El motor de sincronización externa no está disponible."}));
    }
    options=C().manualOptions(options);
    C().dispatch(C().EVENTS.STARTED,{operation:"syncQueue",targets:options.targets||[],at:C().now()});
    return Promise.resolve(current.syncQueue(options)).then(function(result){
      var normalized=result&&result.ok===false
        ?C().failure({operation:"syncQueue",data:result,message:result.message||"La cola no se completó."})
        :C().success({operation:"syncQueue",data:result,message:"Cola externa procesada."});
      C().dispatch(C().EVENTS.FINISHED,{operation:"syncQueue",result:normalized,at:C().now()});
      return normalized;
    }).catch(function(error){
      var failed=C().failure({operation:"syncQueue",error:error});
      C().dispatch(C().EVENTS.ERROR,{operation:"syncQueue",result:failed,at:C().now()});
      return failed;
    });
  }

  function pause(reason){
    var current=sync();
    var value=current&&typeof current.pause==="function"?current.pause(reason||"Pausa manual"):"";
    var result={paused:true,reason:reason||"Pausa manual",value:value,at:C().now()};
    C().dispatch(C().EVENTS.PAUSE_CHANGED,result);
    return result;
  }

  function resume(){
    var current=sync();
    var value=current&&typeof current.resume==="function"?current.resume():"";
    var result={paused:false,reason:"",value:value,at:C().now()};
    C().dispatch(C().EVENTS.PAUSE_CHANGED,result);
    return result;
  }

  function usage(name){
    if(name){
      var current=provider(name);
      return current&&typeof current.usage==="function"?current.usage():null;
    }
    return window.ConexionesExternasUsage&&window.ConexionesExternasUsage.all
      ?window.ConexionesExternasUsage.all()
      :[];
  }

  var api={
    version:VERSION,
    namespace:"ConexionesExternas",
    manualOnly:true,
    automatic:false,
    maxBatchSize:25,
    status:status,
    listProviders:function(){return registry()&&registry().list?registry().list():[];},
    provider:function(name){return provider(name);},
    test:function(name,options){return execute(name,"test",options||{});},
    pull:function(name,options){return execute(name,"pull",options||{});},
    push:function(name,options){return execute(name,"push",C().manualOptions(options));},
    syncQueue:syncQueue,
    retry:function(name,options){return execute(name,"push",C().manualOptions(Object.assign({},options||{},{retry:true})));},
    pause:pause,
    resume:resume,
    isPaused:function(){return !!(sync()&&typeof sync().isPaused==="function"&&sync().isPaused());},
    isRunning:function(){return !!(sync()&&typeof sync().isRunning==="function"&&sync().isRunning());},
    usage:usage
  };

  window.ConexionesExternas=api;
  C().dispatch(C().EVENTS.READY,{ok:true,version:VERSION,providers:api.listProviders(),manualOnly:true,automatic:false,at:C().now()});
})(window);

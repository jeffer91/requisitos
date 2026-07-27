/* =========================================================
Nombre completo: conexiones.externas.firebase.js
Ruta: /ConexionesExternas/providers/firebase/conexiones.externas.firebase.js
Función:
- Encapsular estado, prueba, subida, descarga y consumo de Firebase.
- Delegar temporalmente en los motores Firebase V2 existentes.
- Mantener todas las operaciones como manuales.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-provider-firebase";

  function C(){return window.ConexionesExternasContract||null;}
  function registry(){return window.ConexionesExternasProviders||null;}
  function sync(){return window.BDLSyncOrchestrator||null;}
  function control(){return window.RequisitosFirebaseControlCenter||null;}
  function usage(){return window.ConexionesExternasUsage||null;}

  function state(){
    var current=control();
    var value=current&&typeof current.status==="function"?current.status():{};
    return Promise.resolve(value).then(function(detail){
      return {
        ok:!!current,
        target:"firebase",
        label:"Firebase",
        manualOnly:true,
        automatic:false,
        configured:!!window.RequisitosFirebaseRepository,
        available:!!current&&!!sync(),
        detail:detail||{}
      };
    });
  }

  function test(){
    var current=control();
    if(current&&typeof current.refreshStatus==="function"){
      return Promise.resolve(current.refreshStatus()).then(function(detail){
        return C().success({target:"firebase",operation:"test",data:detail,message:"Estado Firebase actualizado."});
      }).catch(function(error){return C().failure({target:"firebase",operation:"test",error:error});});
    }
    return state().then(function(detail){
      return detail.ok
        ?C().success({target:"firebase",operation:"test",data:detail,message:"Firebase disponible."})
        :C().failure({target:"firebase",operation:"test",message:"Firebase todavía no está disponible."});
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

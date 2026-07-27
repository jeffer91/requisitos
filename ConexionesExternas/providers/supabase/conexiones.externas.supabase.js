/* =========================================================
Nombre completo: conexiones.externas.supabase.js
Ruta: /ConexionesExternas/providers/supabase/conexiones.externas.supabase.js
Función:
- Encapsular estado, prueba, subida y consumo de Supabase.
- Delegar temporalmente en el adaptador seguro existente.
- Declarar explícitamente que la descarga todavía no está disponible.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-provider-supabase";

  function C(){return window.ConexionesExternasContract||null;}
  function registry(){return window.ConexionesExternasProviders||null;}
  function sync(){return window.BDLSyncOrchestrator||null;}
  function store(){return window.BDLocalConfigStore||null;}
  function usage(){return window.ConexionesExternasUsage||null;}

  function config(){
    try{return store()&&typeof store().getSupabaseConfig==="function"?store().getSupabaseConfig({includeSecret:false})||{}:{};}
    catch(error){return {error:error.message||String(error)};}
  }

  function state(){
    var current=config();
    var target=window.BDLSyncTargets&&typeof window.BDLSyncTargets.get==="function"
      ?window.BDLSyncTargets.get("supabase")
      :null;
    return Promise.resolve({
      ok:!!target,
      target:"supabase",
      label:"Supabase",
      manualOnly:true,
      automatic:false,
      configured:!!current.enabled&&!!current.url,
      available:!!target,
      detail:current
    });
  }

  function test(){
    return state().then(function(detail){
      if(detail.configured&&detail.available){
        return C().success({target:"supabase",operation:"test",data:detail,message:"Supabase está configurado."});
      }
      return C().failure({target:"supabase",operation:"test",blocked:true,data:detail,message:"Supabase no está completamente configurado."});
    });
  }

  function push(options){
    var current=sync();
    if(!current||typeof current.syncTarget!=="function"){
      return Promise.resolve(C().failure({target:"supabase",operation:"push",blocked:true,message:"El orquestador externo no está disponible."}));
    }
    return Promise.resolve(current.syncTarget("supabase",C().manualOptions(options))).then(function(result){
      return result&&result.ok===false
        ?C().failure({target:"supabase",operation:"push",data:result,message:result.message||"Supabase no completó la subida."})
        :C().success({target:"supabase",operation:"push",data:result,message:"Subida a Supabase finalizada."});
    }).catch(function(error){return C().failure({target:"supabase",operation:"push",error:error});});
  }

  var provider={
    version:VERSION,
    label:"Supabase",
    manualOnly:true,
    capabilities:{test:true,pull:false,push:true,usage:true},
    status:state,
    test:test,
    pull:function(){return Promise.resolve(C().unsupported("supabase","pull"));},
    push:push,
    usage:function(){return usage()&&usage().get?usage().get("supabase"):null;}
  };

  if(registry()&&typeof registry().register==="function"){
    registry().register("supabase",provider);
  }
  window.ConexionesExternasSupabase=provider;
})(window);

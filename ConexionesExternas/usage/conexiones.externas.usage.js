/* =========================================================
Nombre completo: conexiones.externas.usage.js
Ruta: /ConexionesExternas/usage/conexiones.externas.usage.js
Función:
- Presentar consumo y cuotas por proveedor.
- Diferenciar medición local de cuota oficial confirmada.
- No consultar servicios remotos automáticamente.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-local-measurement";

  function C(){return window.ConexionesExternasContract||null;}
  function store(){return window.BDLocalConfigStore||null;}
  function target(value){return C()&&C().normalizeTarget?C().normalizeTarget(value):String(value||"").trim().toLowerCase();}
  function clone(value){return C()&&C().clone?C().clone(value):value;}

  function firebase(){
    var quota=null;
    var runtime=null;
    try{
      if(store()&&typeof store().getFirebaseQuotaStatus==="function"){
        quota=store().getFirebaseQuotaStatus(0);
      }
    }catch(error){quota={allowed:false,error:error.message||String(error)};}
    try{
      if(window.RequisitosFirebaseRepository&&typeof window.RequisitosFirebaseRepository.status==="function"){
        runtime=window.RequisitosFirebaseRepository.status();
      }
    }catch(error2){runtime={error:error2.message||String(error2)};}

    return {
      target:"firebase",
      official:false,
      source:"local_estimate",
      label:"Consumo medido localmente",
      quota:clone(quota),
      runtime:clone(runtime),
      warning:"Los valores corresponden al contador local y no sustituyen la cuota oficial del proveedor."
    };
  }

  function google(){
    var config={};
    try{
      if(store()&&typeof store().getSheetsConfig==="function"){
        config=store().getSheetsConfig({includeSecret:false})||{};
      }
    }catch(error){config={error:error.message||String(error)};}
    return {
      target:"google",
      official:false,
      source:"local_status",
      label:"Estado local de Google Sheets",
      quota:null,
      runtime:{
        enabled:!!config.enabled,
        connected:!!config.connected,
        pendingCount:Number(config.pendingCount||0),
        batchSize:Number(config.batchSize||25),
        lastSyncAt:config.lastSyncAt||"",
        status:config.status||"sin_configurar"
      },
      warning:"No existe una lectura automática de cuota oficial de Google Sheets."
    };
  }

  function supabase(){
    var config={};
    try{
      if(store()&&typeof store().getSupabaseConfig==="function"){
        config=store().getSupabaseConfig({includeSecret:false})||{};
      }
    }catch(error){config={error:error.message||String(error)};}
    return {
      target:"supabase",
      official:false,
      source:"local_status",
      label:"Estado local de Supabase",
      quota:null,
      runtime:{
        enabled:!!config.enabled,
        connected:!!config.connected,
        tableName:config.tableName||"app_records",
        lastSyncAt:config.lastSyncAt||"",
        status:config.status||"sin_configurar"
      },
      warning:"La aplicación todavía no consulta una cuota oficial de Supabase."
    };
  }

  function get(name){
    name=target(name);
    if(name==="firebase"){return firebase();}
    if(name==="google"){return google();}
    if(name==="supabase"){return supabase();}
    return {target:name,official:false,source:"unsupported",quota:null,runtime:null,warning:"Proveedor no soportado."};
  }

  function all(){return [firebase(),supabase(),google()];}

  window.ConexionesExternasUsage={
    version:VERSION,
    get:get,
    all:all,
    firebase:firebase,
    supabase:supabase,
    google:google
  };
})(window);

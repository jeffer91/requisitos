/* =========================================================
Nombre completo: conexiones.externas.providers.js
Ruta: /ConexionesExternas/core/conexiones.externas.providers.js
Función:
- Mantener el registro oficial de proveedores externos.
- Resolver Firebase, Supabase y Google Sheets de forma independiente.
- Exponer estado y capacidades sin ejecutar operaciones automáticas.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-conexiones-externas";
  var providers=Object.create(null);

  function C(){return window.ConexionesExternasContract||null;}
  function target(value){return C()&&C().normalizeTarget?C().normalizeTarget(value):String(value||"").trim().toLowerCase();}
  function clone(value){return C()&&C().clone?C().clone(value):value;}

  function register(name,provider){
    name=target(name);
    if(!name||!provider){return false;}
    providers[name]=provider;
    return true;
  }

  function get(name){return providers[target(name)]||null;}
  function unregister(name){name=target(name);if(!providers[name]){return false;}delete providers[name];return true;}

  function list(){
    return Object.keys(providers).sort().map(function(name){
      var provider=providers[name]||{};
      var capabilities=provider.capabilities||{};
      return {
        id:name,
        label:provider.label||name,
        version:provider.version||"",
        manualOnly:provider.manualOnly!==false,
        capabilities:{
          test:typeof provider.test==="function"||capabilities.test===true,
          pull:typeof provider.pull==="function"||capabilities.pull===true,
          push:typeof provider.push==="function"||capabilities.push===true,
          usage:typeof provider.usage==="function"||capabilities.usage===true
        }
      };
    });
  }

  function status(){
    var rows=list();
    return {
      ok:rows.length===3,
      version:VERSION,
      manualOnly:true,
      automatic:false,
      total:rows.length,
      providers:clone(rows)
    };
  }

  window.ConexionesExternasProviders={
    version:VERSION,
    register:register,
    unregister:unregister,
    get:get,
    list:list,
    status:status
  };
})(window);

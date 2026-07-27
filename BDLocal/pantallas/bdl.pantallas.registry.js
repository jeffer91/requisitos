/* =========================================================
Nombre completo: bdl.pantallas.registry.js
Ruta: /BDLocal/pantallas/bdl.pantallas.registry.js
Función:
- Exponer el inventario oficial de pantallas desde Base Local.
- Delegar temporalmente en BDLocalConeRegistry.
- Mantener una sola definición por pantalla.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-base-local-pantallas";

  function legacy(){return window.BDLocalConeRegistry||null;}
  function requireRegistry(){
    var value=legacy();
    if(!value){throw new Error("BDLocalConeRegistry no está disponible.");}
    return value;
  }

  function status(){
    var source=legacy();
    var report=source&&typeof source.status==="function"?source.status():{ok:false,total:0,loaded:0,missing:[]};
    return Object.assign({},report,{
      version:VERSION,
      namespace:"BaseLocal.Pantallas",
      source:"BDLocal/pantallas/bdl.pantallas.registry.js",
      compatibilityGlobal:"BDLocalConeRegistry",
      legacyPathActive:true
    });
  }

  window.BDLocalPantallasRegistry={
    version:VERSION,
    source:"BDLocal/pantallas/bdl.pantallas.registry.js",
    namespace:"BaseLocal.Pantallas",
    compatibilityGlobal:"BDLocalConeRegistry",
    register:function(name,definition){return requireRegistry().register(name,definition);},
    get:function(name){return requireRegistry().get(name);},
    list:function(options){return requireRegistry().list(options||{});},
    resolve:function(name){return requireRegistry().resolve(name);},
    detect:function(fallback){return requireRegistry().detect(fallback);},
    status:status
  };
})(window);

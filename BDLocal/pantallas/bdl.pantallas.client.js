/* =========================================================
Nombre completo: bdl.pantallas.client.js
Ruta: /BDLocal/pantallas/bdl.pantallas.client.js
Función:
- Ser la API oficial de lectura y escritura para pantallas.
- Delegar temporalmente en BDLocalConnectionClient.
- Evitar acceso directo de las pantallas a IndexedDB.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-base-local-pantallas";

  function legacy(){return window.BDLocalConnectionClient||null;}
  function requireClient(){
    var value=legacy();
    if(!value){throw new Error("BDLocalConnectionClient no está disponible.");}
    return value;
  }
  function invoke(method,args){
    var client=requireClient();
    if(typeof client[method]!=="function"){
      return Promise.reject(new Error("La operación de pantalla no está disponible: "+method));
    }
    try{return Promise.resolve(client[method].apply(client,args||[]));}
    catch(error){return Promise.reject(error);}
  }

  window.BDLocalPantallasClient={
    version:VERSION,
    source:"BDLocal/pantallas/bdl.pantallas.client.js",
    namespace:"BaseLocal.Pantallas",
    compatibilityGlobal:"BDLocalConnectionClient",
    ready:function(screen){return invoke("ready",[screen]);},
    read:function(screen,filters){return invoke("read",[screen,filters||{}]);},
    refresh:function(screen,options){return invoke("refresh",[screen,options||{}]);},
    invoke:function(screen,operation,payload){return invoke("invoke",[screen,operation,payload]);},
    save:function(screen,payload){return invoke("save",[screen,payload]);},
    update:function(screen,payload){return invoke("update",[screen,payload]);},
    remove:function(screen,payload){return invoke("remove",[screen,payload]);},
    diagnose:function(screen,options){return invoke("diagnose",[screen,options||{}]);},
    status:function(screen){return requireClient().status(screen);},
    connector:function(screen){return requireClient().connector(screen);},
    screen:function(){return requireClient().screen();},
    setScreen:function(screen){return requireClient().setScreen(screen);},
    listScreens:function(){return requireClient().listScreens();},
    onUpdated:function(callback){return requireClient().onUpdated(callback);}
  };
})(window);

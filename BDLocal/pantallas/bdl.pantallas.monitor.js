/* =========================================================
Nombre completo: bdl.pantallas.monitor.js
Ruta: /BDLocal/pantallas/bdl.pantallas.monitor.js
Función:
- Exponer el diagnóstico interno de comunicación con pantallas.
- Delegar temporalmente en BDLocalConnectionMonitor.
- Mantener separado el diagnóstico local del diagnóstico remoto.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-base-local-pantallas";

  function legacy(){return window.BDLocalConnectionMonitor||null;}
  function requireMonitor(){
    var value=legacy();
    if(!value){throw new Error("BDLocalConnectionMonitor no está disponible.");}
    return value;
  }
  function invoke(method,args){
    var monitor=requireMonitor();
    if(typeof monitor[method]!=="function"){
      return Promise.reject(new Error("La operación del monitor no está disponible: "+method));
    }
    try{return Promise.resolve(monitor[method].apply(monitor,args||[]));}
    catch(error){return Promise.reject(error);}
  }

  window.BDLocalPantallasMonitor={
    version:VERSION,
    source:"BDLocal/pantallas/bdl.pantallas.monitor.js",
    namespace:"BaseLocal.Pantallas",
    compatibilityGlobal:"BDLocalConnectionMonitor",
    mount:function(target,options){return requireMonitor().mount(target,options||{});},
    run:function(options){return invoke("run",[options||{}]);},
    diagnoseScreen:function(screen,options){return invoke("diagnoseScreen",[screen,options||{}]);},
    render:function(report){return requireMonitor().render(report);},
    copyReport:function(){return invoke("copyReport",[]);},
    downloadReport:function(){return requireMonitor().downloadReport();},
    getReport:function(){return requireMonitor().getReport();},
    status:function(){
      var report=requireMonitor().status();
      return Object.assign({},report,{
        version:VERSION,
        namespace:"BaseLocal.Pantallas",
        legacyPathActive:true
      });
    }
  };
})(window);

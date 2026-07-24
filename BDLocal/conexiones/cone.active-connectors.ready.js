/* =========================================================
Nombre completo: cone.active-connectors.ready.js
Ruta: /BDLocal/conexiones/cone.active-connectors.ready.js
Función:
- Completar los doce conectores activos antes de certificar BDLocal.
- Corregir la carrera entre cone.index.js y los conectores nuevos.
- Exponer una promesa única de preparación.
- Hacer que BDLocalConexiones.ready y BL2Test esperen el inventario completo.
- No leer ni escribir fuentes externas durante el arranque.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-complete-active-connectors";
  var PATCH_FLAG="__activeConnectorsReadyPatched";
  var EXPECTED=[
    "carga","tabla","ficha","stats","coordi","reportes",
    "global","defart","ncomplex","cr_def","inpvc"
  ];
  var FILES={
    carga:"cone.carga.js",
    tabla:"cone.tabla.js",
    ficha:"cone.ficha.js",
    stats:"cone.stats.js",
    coordi:"cone.coordi.js",
    reportes:"cone.reportes.js",
    global:"cone.global.js",
    defart:"cone.defart.js",
    ncomplex:"cone.ncomplex.js",
    cr_def:"cone.crdef.js",
    inpvc:"cone.inpvc.js"
  };
  var base=document.currentScript&&document.currentScript.src?document.currentScript.src:document.baseURI;
  var loading=Object.create(null);
  var readyPromise=null;
  var lastError="";

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function url(file){try{return new URL(file,base).href;}catch(error){return file;}}
  function hub(){return window.BDLocalConexiones||null;}
  function connectorNames(){
    try{
      var status=hub()&&typeof hub().status==="function"?hub().status():{};
      return Array.isArray(status.connectors)?status.connectors.slice():[];
    }catch(error){return [];}
  }
  function missing(){
    var current=connectorNames();
    return EXPECTED.filter(function(name){return current.indexOf(name)<0;});
  }
  function existing(src){
    return Array.prototype.slice.call(document.scripts||[]).some(function(script){
      return script.src===src||script.getAttribute("data-bdl-active-connector-src")===src||script.getAttribute("data-bdl-con-src")===src;
    });
  }
  function waitForHub(timeoutMs){
    timeoutMs=Math.max(500,Number(timeoutMs||15000));
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        var current=hub();
        if(current&&typeof current.register==="function"&&typeof current.status==="function"){resolve(current);return;}
        if(Date.now()-started>=timeoutMs){reject(new Error("BDLocalConexiones no estuvo disponible a tiempo."));return;}
        window.setTimeout(check,40);
      })();
    });
  }
  function waitForConnector(name,timeoutMs){
    timeoutMs=Math.max(500,Number(timeoutMs||15000));
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        if(connectorNames().indexOf(name)>=0){resolve(name);return;}
        if(Date.now()-started>=timeoutMs){reject(new Error("El conector "+name+" no se registró."));return;}
        window.setTimeout(check,40);
      })();
    });
  }
  function load(name){
    if(connectorNames().indexOf(name)>=0){return Promise.resolve(name);}
    var file=FILES[name];
    if(!file){return Promise.reject(new Error("No existe archivo definido para "+name+"."));}
    var src=url(file);
    if(loading[src]){return loading[src];}
    if(existing(src)){return waitForConnector(name,15000);}
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=src;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-bdl-active-connector-src",src);
      script.onload=function(){
        waitForConnector(name,15000).then(resolve).catch(reject);
      };
      script.onerror=function(){reject(new Error("No se pudo cargar "+file+"."));};
      (document.head||document.documentElement).appendChild(script);
    }).finally(function(){delete loading[src];});
    return loading[src];
  }
  function loadMissing(){
    var chain=Promise.resolve();
    missing().forEach(function(name){chain=chain.then(function(){return load(name);});});
    return chain.then(function(){
      var absent=missing();
      if(absent.length){throw new Error("Faltan conectores activos: "+absent.join(", ")+".");}
      return {
        ok:true,
        version:VERSION,
        expected:EXPECTED.slice(),
        connectors:connectorNames(),
        loadedAt:now(),
        externalReads:0,
        externalWrites:0
      };
    });
  }
  function ensure(options){
    options=options||{};
    if(readyPromise&&!options.force){return readyPromise;}
    lastError="";
    readyPromise=waitForHub(options.timeout||15000)
      .then(loadMissing)
      .then(function(result){
        try{window.dispatchEvent(new CustomEvent("bdlocal:active-connectors-ready",{detail:result}));}catch(error){}
        return result;
      })
      .catch(function(error){lastError=error&&error.message?error.message:String(error);throw error;})
      .finally(function(){readyPromise=null;});
    return readyPromise;
  }
  function patchHub(){
    var current=hub();
    if(!current||current[PATCH_FLAG]||typeof current.ready!=="function"){return false;}
    var original=current.ready.bind(current);
    current.ready=function(options){
      return Promise.resolve(original(options||{})).then(function(){return ensure(options||{});}).then(function(){return current.status();});
    };
    current[PATCH_FLAG]=true;
    current.activeConnectorsVersion=VERSION;
    return true;
  }
  function patchTest(){
    var test=window.BL2Test;
    if(!test||test[PATCH_FLAG]||typeof test.run!=="function"){return false;}
    var original=test.run.bind(test);
    test.run=function(options){return ensure().then(function(){return original(options||{});});};
    test[PATCH_FLAG]=true;
    test.activeConnectorsVersion=VERSION;
    return true;
  }
  function patch(){patchHub();patchTest();return !!hub();}

  window.BDLActiveConnectors={
    version:VERSION,
    expected:EXPECTED.slice(),
    files:Object.assign({},FILES),
    ensure:ensure,
    missing:missing,
    patch:patch,
    status:function(){return {ok:missing().length===0,version:VERSION,missing:missing(),connectors:connectorNames(),loading:!!readyPromise,lastError:lastError,externalReads:0,externalWrites:0};}
  };

  window.BDLActiveConnectorsReady=ensure().then(function(result){patch();return result;});
  ["bdlocal:bl2-html-scripts-loaded","bl2:core-ready","requisitos:arquitectura-compartida-lista"].forEach(function(name){
    window.addEventListener(name,function(){patch();ensure().catch(function(){});});
  });
  patch();
})(window,document);

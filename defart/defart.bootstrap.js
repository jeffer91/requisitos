/* =========================================================
Nombre completo: defart.bootstrap.js
Ruta: /defart/defart.bootstrap.js
Función:
- Preparar dependencias internas de Defart en orden.
- Confirmar ConDefart antes de cargar los módulos de pantalla.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-connector-first";
  var base=document.currentScript&&document.currentScript.src||document.baseURI;
  var loading=Object.create(null);

  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(item){return item.src===src||item.getAttribute("data-defart-bootstrap-src")===src;});}
  function waitFor(test,label,timeout){
    timeout=Math.max(500,Number(timeout||15000));
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        var value=null;
        try{value=test();}catch(error){}
        if(value){resolve(value);return;}
        if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}
        setTimeout(check,40);
      })();
    });
  }
  function load(relative,test){
    var src=url(relative),current=null;
    try{current=test&&test();}catch(error){}
    if(current){return Promise.resolve(current);}
    if(loading[src]){return loading[src];}
    if(existing(src)){return test?waitFor(test,relative,15000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=src;script.async=false;script.defer=false;
      script.setAttribute("data-defart-bootstrap-src",src);
      script.onload=function(){var value=src;try{value=test?test():src;}catch(error){value=null;}value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));};
      script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};
      (document.head||document.documentElement).appendChild(script);
    }).finally(function(){delete loading[src];});
    return loading[src];
  }
  function sequence(files){return files.reduce(function(chain,item){return chain.then(function(){return load(item.path,item.test);});},Promise.resolve());}
  function status(message,type){var box=document.getElementById("def-status");if(box){box.style.display="block";box.textContent=message;box.className="def-status "+(type||"");}}
  function connector(){return window.ConDefart||window.BDLocalConeDefart||null;}

  function infrastructure(){
    return sequence([
      {path:"../BDLocal/adapters/bdl.screen-deps.js",test:function(){return window.BDLocalScreenDeps;}},
      {path:"../BDLocal/rules/bdl.rules.index.js",test:function(){return window.BDLRules;}},
      {path:"../BDLocal/rules/bdl.rules.notas.js"},
      {path:"../BDLocal/rules/bdl.rules.sync.js"},
      {path:"../BDLocal/repositories/bdl.repo.periodos.js"},
      {path:"../BDLocal/repositories/bdl.repo.notas.js",test:function(){return window.BDLRepoNotas;}},
      {path:"../BDLocal/repositories/bdl.repo.cambios.js",test:function(){return window.BDLRepoCambios;}},
      {path:"../BDLocal/services/bdl.service.periodos.js"},
      {path:"../BDLocal/services/bdl.service.defensas.js",test:function(){return window.BDLServiceDefensas;}},
      {path:"../BDLocal/conexiones/cone.defart.js",test:connector},
      {path:"../BDLocal/diagnostics/bdl.diagnostics.defensas.js"}
    ]).then(function(){
      var con=connector();
      return Promise.resolve(con&&typeof con.ready==="function"?con.ready():true).then(function(result){
        if(result&&result.ok===false){throw new Error(result.error||"ConDefart no está listo.");}
        return con;
      });
    });
  }

  function screenModules(){
    return sequence([
      {path:"defart.core.js",test:function(){return window.DefartCore;}},
      {path:"defart.persistence.js"},
      {path:"defart.continuity.js"},
      {path:"defart.export.js"},
      {path:"defart.table.js"},
      {path:"defart.performance.js"},
      {path:"defart.service-bridge.js",test:function(){return window.DefartServiceBridge;}},
      {path:"defart.save-service-bridge.js",test:function(){return window.DefartSaveServiceBridge;}},
      {path:"defart.requirements-guard.js"},
      {path:"defart.periodo-normalizer.js"},
      {path:"defart.app.js",test:function(){return window.DefartApp;}}
    ]);
  }

  function boot(){
    status("Conectando Defart con BDLocal...","is-info");
    infrastructure().then(screenModules).then(function(){
      if(window.DefartServiceBridge&&typeof window.DefartServiceBridge.refresh==="function"){window.DefartServiceBridge.refresh();}
      try{window.dispatchEvent(new CustomEvent("defart:bootstrap-ready",{detail:{ok:true,source:"ConDefart",version:VERSION}}));}catch(error){}
    }).catch(function(error){status(error&&error.message?error.message:String(error),"is-error");});
  }

  window.DefartBootstrap={version:VERSION,boot:boot,infrastructure:infrastructure};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);

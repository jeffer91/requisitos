/* =========================================================
Nombre completo: global.word.js
Ruta o ubicación: /Requisitos/Global/global.word.js
Función:
- Cargar la implementación institucional corregida del reporte Word.
- Mantener compatibilidad con GlobalApp durante la inicialización.
========================================================= */
(function(window){
  "use strict";

  var proxy;
  var ready = (async function(){
    if(typeof DecompressionStream === "undefined"){
      throw new Error("El navegador no admite la descompresión requerida por GlobalWord.");
    }

    var response = await fetch("global.word.impl.gz", { cache: "no-store" });
    if(!response.ok){
      throw new Error("No se pudo cargar la implementación de GlobalWord.");
    }

    var stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    var source = await new Response(stream).text();
    (0, eval)(source);

    if(!window.GlobalWord || window.GlobalWord === proxy){
      throw new Error("GlobalWord no pudo inicializarse.");
    }

    return window.GlobalWord;
  })();

  window.__globalWordReady = ready;

  proxy = {
    version: "loading",
    generate: function(options){
      if(
        window.GlobalWord !== proxy &&
        window.GlobalWord &&
        typeof window.GlobalWord.generate === "function"
      ){
        return window.GlobalWord.generate(options);
      }

      return ready.then(function(api){
        return api.generate(options);
      });
    }
  };

  window.GlobalWord = proxy;

  ready.catch(function(error){
    try{
      console.error("[GlobalWord]", error);
    }catch(consoleError){}
  });
})(window);

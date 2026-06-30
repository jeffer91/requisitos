/* =========================================================
Nombre completo: sn-sacar-n.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-sacar-n.js
Modulo: Sacar N
Funcion o funciones:
- Inicializar la pantalla Sacar N.
- Conectar estado, renderizado, eventos y carga inicial de BDLocal.
- Recuperar avance guardado al reabrir el modulo.
- Mantener lista la pantalla para cargar estudiantes desde Requisitos.
Con que se conecta:
- sn-config.js
- sn-models.js
- sn-state.service.js
- sn-store.service.js
- sn-queue.service.js
- sn-estudiantes.service.js
- sn-sisacad-extractor.service.js
- sn-ui-render.service.js
- sn-ui-events.service.js
- sn-sacar-n.html
========================================================= */
(function(window, document){
  "use strict";

  var state = window.SNState || {};
  var render = window.SNUIRender || {};
  var events = window.SNUIEvents || {};
  var models = window.SNModels || {};

  function recuperarAvanceGuardado(){
    var extractor = window.SNSisacadExtractor;
    if(extractor && typeof extractor.recuperarAvance === "function"){
      extractor.recuperarAvance();
    }
  }

  function boot(){
    if(render.initStatic){ render.initStatic(); }

    if(state.subscribe && render.render){
      state.subscribe(function(snapshot){
        render.render(snapshot);
      });
    }else if(render.render){
      render.render({});
    }

    if(events.init){ events.init(); }
    recuperarAvanceGuardado();

    try{
      window.dispatchEvent(new CustomEvent("sn:boot", {
        detail: {
          bloque: 9,
          at: models.ahora ? models.ahora() : new Date().toISOString()
        }
      }));
    }catch(error){}
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})(window, document);

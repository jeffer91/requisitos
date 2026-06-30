/* =========================================================
Nombre completo: cont.event.create.js
Ruta: /BDLocal/continuity/events/cont.event.create.js
Función:
- Crear y guardar eventos de continuidad desde cambios manuales.
========================================================= */
(function(window){
  "use strict";

  function create(input){
    input = input || {};
    if(window.BDLContEventClassify && !input.prioridad){
      input.prioridad = window.BDLContEventClassify.classify(input);
    }
    var event = window.BDLContEventModel.create(input);
    if(window.BDLContEventRepo){ window.BDLContEventRepo.add(event); }
    try{ window.dispatchEvent(new CustomEvent("bdlocal:continuity-event", { detail:event })); }catch(error){}
    return event;
  }

  window.BDLContEventCreate = { create: create };
})(window);

/* =========================================================
Nombre completo: bl.toast.js
Ruta: /BDLocal/ui/bl.toast.js
Función:
- Mostrar avisos visuales de continuidad.
- Escuchar alertas emitidas por el motor.
========================================================= */
(function(window, document){
  "use strict";

  function host(){
    var node = document.getElementById("blToastHost");
    if(node){ return node; }
    node = document.createElement("div");
    node.id = "blToastHost";
    node.className = "bl-toast-host";
    document.body.appendChild(node);
    return node;
  }

  function show(title, message){
    var box = document.createElement("div");
    box.className = "bl-toast";
    box.innerHTML = "<strong>" + escapeHtml(title || "Aviso") + "</strong><div>" + escapeHtml(message || "") + "</div>";
    host().appendChild(box);
    setTimeout(function(){
      try{ box.remove(); }catch(error){ if(box.parentNode){ box.parentNode.removeChild(box); } }
    }, 6000);
    return box;
  }

  function escapeHtml(value){
    return String(value == null ? "" : value).replace(/[&<>\"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];});
  }

  window.addEventListener("bdlocal:continuity-alert", function(event){
    var detail = event.detail || {};
    show("Continuidad BL", detail.message || "Cambio de estado.");
  });

  window.BLToast = { show: show };
})(window, document);

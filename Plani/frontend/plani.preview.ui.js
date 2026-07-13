/* =========================================================
Nombre completo: plani.preview.ui.js
Ruta o ubicacion: /Requisitos/Plani/frontend/plani.preview.ui.js
Funcion:
- Renderizar en pantalla la vista previa del modelo documental.
- Mantener separada la vista previa del motor constructor.
========================================================= */
(function(window, document){
  "use strict";

  function render(model){
    var box = document.getElementById("plani-preview");
    var chip = document.getElementById("plani-preview-chip");
    if(!box){return;}
    if(!model || !model.ok){
      box.innerHTML = '<div class="plani-empty">Todavia no hay documento interno construido.</div>';
      if(chip){chip.textContent = "Sin vista previa"; chip.className = "plani-chip warn";}
      return;
    }
    box.innerHTML = window.PlaniPreview && window.PlaniPreview.render ? window.PlaniPreview.render(model) : '<div class="plani-empty">Vista previa no disponible.</div>';
    if(chip){chip.textContent = "Documento interno listo"; chip.className = "plani-chip ok";}
  }

  window.PlaniPreviewUI = {render:render};
})(window, document);

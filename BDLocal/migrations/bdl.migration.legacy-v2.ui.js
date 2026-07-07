/* =========================================================
Archivo: bdl.migration.legacy-v2.ui.js
Ruta: /BDLocal/migrations/bdl.migration.legacy-v2.ui.js
Función:
- Panel mínimo para migración manual legacy → DB_VERSION 2.
- Ejecutar vista previa y luego migración confirmada.
Con qué se conecta:
- BDLocal/migrations/bdl.migration.legacy-v2.js
- BDLocal/bl2.html
========================================================= */
(function(window, document){
  "use strict";

  function byId(id){ return document.getElementById(id); }

  function ensurePanel(){
    if(byId("bdl-legacy-v2-card")){ return; }
    var main = document.querySelector(".bl2-main") || document.body;
    var card = document.createElement("section");
    card.id = "bdl-legacy-v2-card";
    card.className = "bl2-card";
    card.innerHTML = [
      '<div class="bl2-card-head bl2-card-head-row">',
      '<div><h2>Migración DB_VERSION 2</h2><p>Convierte datos legacy hacia el modelo nuevo. Primero ejecuta vista previa.</p></div>',
      '<div>',
      '<button id="bdl-btn-legacy-v2-preview" class="bl2-btn bl2-btn-light" type="button">Vista previa</button> ',
      '<button id="bdl-btn-legacy-v2-run" class="bl2-btn bl2-btn-light" type="button" disabled>Migrar</button>',
      '</div>',
      '</div>',
      '<pre id="bdl-legacy-v2-json">Pendiente.</pre>'
    ].join("");
    main.appendChild(card);
  }

  function paint(result){
    var box = byId("bdl-legacy-v2-json");
    if(box){ box.textContent = JSON.stringify(result || {}, null, 2); }
  }

  function preview(){
    var runBtn = byId("bdl-btn-legacy-v2-run");
    paint({ message:"Preparando vista previa..." });
    if(!window.BDLMigrationLegacyV2 || typeof window.BDLMigrationLegacyV2.preview !== "function"){
      paint({ ok:false, message:"BDLMigrationLegacyV2 no disponible." });
      return;
    }
    window.BDLMigrationLegacyV2.preview().then(function(result){
      paint(result);
      if(runBtn){ runBtn.disabled = !result.ok; }
    }).catch(function(error){
      paint({ ok:false, message:error.message || String(error) });
    });
  }

  function run(){
    if(!window.confirm("Ejecutar migración manual DB_VERSION 2?")){ return; }
    paint({ message:"Migrando..." });
    window.BDLMigrationLegacyV2.run({ confirm:true }).then(function(result){
      paint(result);
      try{
        if(window.BDLDiagnosticsUIBridge && typeof window.BDLDiagnosticsUIBridge.run === "function"){
          window.BDLDiagnosticsUIBridge.run();
        }
      }catch(error){}
    }).catch(function(error){
      paint({ ok:false, message:error.message || String(error) });
    });
  }

  function bind(){
    ensurePanel();
    var prev = byId("bdl-btn-legacy-v2-preview");
    var runBtn = byId("bdl-btn-legacy-v2-run");
    if(prev && !prev.__boundLegacyV2){ prev.__boundLegacyV2 = true; prev.addEventListener("click", preview); }
    if(runBtn && !runBtn.__boundLegacyV2){ runBtn.__boundLegacyV2 = true; runBtn.addEventListener("click", run); }
  }

  window.BDLMigrationLegacyV2UI = { bind:bind, preview:preview, run:run };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(window, document);

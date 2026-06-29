/* =========================================================
Nombre completo: plani.qa.js
Ruta o ubicación: /Requisitos/Plani/core/plani.qa.js
Función o funciones:
- Ejecutar revisión rápida del módulo Plani.
- Mostrar errores y advertencias de dependencias y estado mínimo.
- Preparar base para pruebas de bloques posteriores.
Con qué se conecta:
- plani.diagnostics.js
- plani.state.js
- ../frontend/plani.html
========================================================= */
(function(window, document){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}

  function currentState(){
    if(window.PlaniState && typeof window.PlaniState.getState === "function"){
      return window.PlaniState.getState();
    }
    if(window.PlaniApp && typeof window.PlaniApp.getState === "function"){
      return window.PlaniApp.getState();
    }
    return {};
  }

  function run(){
    var state = currentState();
    if(window.PlaniDiagnostics && typeof window.PlaniDiagnostics.run === "function"){
      return window.PlaniDiagnostics.run(state);
    }
    return {ok:false, errors:1, warnings:0, checks:[{type:"error", label:"Diagnostics", message:"PlaniDiagnostics no está disponible."}], generatedAt:new Date().toISOString()};
  }

  function badge(type){
    if(type === "ok"){return "<span class='plani-chip ok'>OK</span>";}
    if(type === "error"){return "<span class='plani-chip bad'>ERROR</span>";}
    return "<span class='plani-chip warn'>REVISAR</span>";
  }

  function render(result){
    var node = document.getElementById("plani-diagnostics");
    if(!node){return;}
    result = result || run();
    node.textContent = JSON.stringify(result, null, 2);
  }

  function renderHtml(result, targetId){
    var node = document.getElementById(targetId || "plani-qa-results");
    if(!node){return;}
    result = result || run();
    var html = "<div class='plani-table-wrap'><table class='plani-small-table'><thead><tr><th>Estado</th><th>Elemento</th><th>Detalle</th></tr></thead><tbody>";
    html += (result.checks || []).map(function(item){return "<tr><td>" + badge(item.type) + "</td><td>" + esc(item.label) + "</td><td>" + esc(item.message) + "</td></tr>";}).join("");
    html += "</tbody></table></div>";
    node.innerHTML = html;
  }

  window.PlaniQA = {
    run:run,
    render:render,
    renderHtml:renderHtml
  };
})(window, document);

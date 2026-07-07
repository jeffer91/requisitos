/* =========================================================
Archivo: bdl.diagnostics.ui-bridge.js
Ruta: /BDLocal/diagnostics/bdl.diagnostics.ui-bridge.js
Función:
- Inyectar un panel de diagnóstico general en BL2 sin modificar bl2.app.js.
- Ejecutar BDLDiagnosticsGeneral.run() desde botón.
- Mostrar salud, módulos, recomendaciones y JSON técnico.
Con qué se conecta:
- BDLocal/diagnostics/bdl.diagnostics.general.js
- BDLocal/bl2.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.1.0-block10";

  function byId(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function esc(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function ensurePanel(){
    if(byId("bdl-general-diagnostics-card")){ return byId("bdl-general-diagnostics-card"); }

    var main = document.querySelector(".bl2-main") || document.body;
    var section = document.createElement("section");
    section.id = "bdl-general-diagnostics-card";
    section.className = "bl2-card bdl-general-diagnostics-card";
    section.innerHTML = [
      '<div class="bl2-card-head bl2-card-head-row">',
      '  <div>',
      '    <h2>Diagnóstico general BDLocal</h2>',
      '    <p>Revisa reglas, repositorios, servicios, notas, cambios y sincronización.</p>',
      '  </div>',
      '  <button id="bdl-btn-general-diagnostics" class="bl2-btn bl2-btn-light" type="button">Ejecutar diagnóstico</button>',
      '</div>',
      '<div id="bdl-general-diagnostics-summary" class="bdl-general-diagnostics-summary">Pendiente de ejecutar.</div>',
      '<details class="bdl-general-diagnostics-details">',
      '  <summary>Ver JSON técnico</summary>',
      '  <pre id="bdl-general-diagnostics-json">{}</pre>',
      '</details>'
    ].join("");

    main.appendChild(section);
    return section;
  }

  function statusClass(percent){
    percent = Number(percent || 0);
    if(percent >= 85){ return "ok"; }
    if(percent >= 65){ return "warn"; }
    return "bad";
  }

  function render(result){
    var summary = byId("bdl-general-diagnostics-summary");
    var json = byId("bdl-general-diagnostics-json");
    if(!summary || !json){ return; }

    var score = result && result.score ? result.score : { percent:0, passed:0, total:0 };
    var cls = statusClass(score.percent);
    var recs = Array.isArray(result && result.recommendations) ? result.recommendations : [];
    var counts = Array.isArray(result && result.counts) ? result.counts : [];

    summary.innerHTML = [
      '<div class="bdl-diag-score bdl-diag-score-'+esc(cls)+'">',
      '  <strong>'+esc(score.percent)+'%</strong>',
      '  <span>'+esc(score.passed)+' / '+esc(score.total)+' controles OK</span>',
      '</div>',
      '<div class="bdl-diag-counts">',
      counts.map(function(item){
        return '<span><b>'+esc(item.name)+'</b>: '+esc(item.total || 0)+(item.ok ? '' : ' · error')+'</span>';
      }).join(""),
      '</div>',
      '<div class="bdl-diag-recommendations">',
      recs.map(function(item){ return '<p>'+esc(item)+'</p>'; }).join(""),
      '</div>'
    ].join("");

    json.textContent = JSON.stringify(result || {}, null, 2);
  }

  function run(){
    ensurePanel();
    var summary = byId("bdl-general-diagnostics-summary");
    if(summary){ summary.textContent = "Diagnosticando BDLocal..."; }

    if(!window.BDLDiagnosticsGeneral || typeof window.BDLDiagnosticsGeneral.run !== "function"){
      render({ ok:false, score:{ percent:0, passed:0, total:1 }, recommendations:["BDLDiagnosticsGeneral no está disponible."], counts:[] });
      return;
    }

    window.BDLDiagnosticsGeneral.run({ source:"ui" }).then(render).catch(function(error){
      render({
        ok:false,
        score:{ percent:0, passed:0, total:1 },
        recommendations:[error.message || String(error)],
        counts:[],
        error:error.message || String(error),
        checkedAt:new Date().toISOString()
      });
    });
  }

  function bind(){
    ensurePanel();
    var button = byId("bdl-btn-general-diagnostics");
    if(button && !button.__bdlGeneralDiagnosticsBound){
      button.__bdlGeneralDiagnosticsBound = true;
      button.addEventListener("click", run);
    }
  }

  window.BDLDiagnosticsUIBridge = {
    version: VERSION,
    bind: bind,
    run: run,
    render: render
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(window, document);

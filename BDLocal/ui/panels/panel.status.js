/* =========================================================
Nombre completo: panel.status.js
Ruta: /BDLocal/ui/panels/panel.status.js
Función:
- Renderizar el panel superior de continuidad.
- Leer estado desde BDLContinuity.
========================================================= */
(function(window, document){
  "use strict";

  var IDS = ["bdlocal", "firebase", "supabase", "excel", "googleSheets"];
  var NAMES = { bdlocal:"BL", firebase:"Firebase", supabase:"Supabase", excel:"Excel", googleSheets:"Google Sheets" };

  function esc(value){ return String(value == null ? "" : value).replace(/[&<>\"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];}); }
  function find(rows, id){ return (rows || []).find(function(row){ return row && row.id === id; }) || null; }
  function modeClass(mode){ if(mode === "normal"){ return ""; } if(mode === "respaldo_local" || mode === "sin_conexion"){ return "bad"; } return "warn"; }
  function modeLabel(mode){ return window.BDLContModes ? window.BDLContModes.label(mode) : (mode || "Preparado"); }

  function headline(row){
    row = row || {};
    if(row.status === "pausado"){ return "Pausado"; }
    if(row.status === "no_configurado"){ return "Configurar"; }
    if(row.status === "no_disponible"){ return "No disponible"; }
    return row.ok ? "Disponible" : "Pendiente";
  }

  function card(row, id){
    row = row || { id:id, ok:false, status:"sin_estado", message:"Sin revisar" };
    var status = row.status || (row.ok ? "ok" : "error");
    return '<article class="bl-health-card"><small>'+esc(NAMES[id]||id)+'</small><strong>'+esc(headline(row))+'</strong><i class="bl-health-status '+esc(status)+'">'+esc(status)+'</i><span title="'+esc(row.message||"")+'">'+esc(row.message||"Sin mensaje")+'</span></article>';
  }

  function render(){
    var box = document.getElementById("blHealthGrid");
    var mode = document.getElementById("blModePill");
    var status = window.BDLContinuity && typeof window.BDLContinuity.status === "function" ? window.BDLContinuity.status() : { guardian:{ mode:"preparado", activeTarget:"firebase" }, health:[] };
    var guardian = status.guardian || {};
    var health = status.health || [];
    if(mode){
      mode.className = "bl-mode-pill " + modeClass(guardian.mode);
      mode.textContent = "Modo: " + modeLabel(guardian.mode || "preparado") + " · Ruta: " + (guardian.activeTarget || "firebase");
    }
    if(box){ box.innerHTML = IDS.map(function(id){ return card(find(health, id), id); }).join(""); }
    var count = document.getElementById("blContinuityEventsCount");
    if(count){ count.textContent = String(status.eventsCount || 0); }
  }

  function check(){
    if(window.BDLContinuity && typeof window.BDLContinuity.checkNow === "function"){
      return window.BDLContinuity.checkNow().then(function(){ render(); });
    }
    render();
    return Promise.resolve();
  }

  window.addEventListener("bdlocal:continuity-status", render);
  window.BLPanelStatus = { render: render, check: check };
})(window, document);
(function(window){
  "use strict";

  var H = window.BDLUIH;
  if(!H){ throw new Error("BDLUIH debe cargarse antes de BDLUIDashboard."); }

  function renderStats(data){
    data = data || {};
    H.html(H.one("#bdlDashboardStats"), [
      '<div class="bdl-stat"><strong>'+H.esc(data.total || 0)+'</strong><span>Total estudiantes</span></div>',
      '<div class="bdl-stat"><strong>'+H.esc(data.cumple || 0)+'</strong><span>Cumplen</span></div>',
      '<div class="bdl-stat"><strong>'+H.esc(data.noCumple || 0)+'</strong><span>No cumplen</span></div>',
      '<div class="bdl-stat"><strong>'+H.esc(data.incompleto || 0)+'</strong><span>Incompletos</span></div>'
    ].join(""));
  }

  function loadPeriodos(){
    if(!window.BDLRepoPeriodos){ return Promise.resolve([]); }
    return window.BDLRepoPeriodos.listar().then(function(rows){
      var select = H.one("#bdlPeriodoSelect");
      var active = window.BDLState && window.BDLState.getPeriodoActivo ? window.BDLState.getPeriodoActivo() : "";
      if(!active && rows[0]){ active = rows[0].periodoId || ""; }
      if(select){
        select.innerHTML = '<option value="">Seleccione período</option>' + rows.map(function(p){ return '<option value="'+H.esc(p.periodoId)+'">'+H.esc(p.periodoLabel || p.periodoId)+'</option>'; }).join("");
        select.value = active || "";
      }
      if(active && window.BDLState && window.BDLState.setPeriodoActivo){ window.BDLState.setPeriodoActivo(active); }
      return rows;
    });
  }

  function loadDashboard(periodoId){
    if(!periodoId){ renderStats({}); return Promise.resolve(null); }
    if(!window.BDLRepoDashboard){ return Promise.resolve(null); }
    return window.BDLRepoDashboard.recalcularBasico(periodoId).then(function(row){
      renderStats(row && row.data ? row.data : {});
      return row;
    });
  }

  window.BDLUIDashboard = { loadPeriodos:loadPeriodos, loadDashboard:loadDashboard, renderStats:renderStats };
})(window);

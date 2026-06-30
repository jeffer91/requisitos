(function(window){
  "use strict";

  var H = window.BDLUIH;
  var page = 1;
  var limit = 100;
  var lastRows = [];

  if(!H){ throw new Error("BDLUIH debe cargarse antes de BDLUIEstudiantes."); }

  function currentPeriodo(){ return H.val("#bdlPeriodoSelect"); }
  function currentSearch(){ return String(H.val("#bdlSearch") || "").toLowerCase().trim(); }
  function division(row){ return row.divisionPrincipal || row.division || row.Division || (Array.isArray(row.divisiones) ? row.divisiones[0] : "") || "—"; }

  function filterRows(rows){
    var q = currentSearch();
    if(!q){ return rows; }
    return rows.filter(function(row){
      return String(row.searchKey || "").toLowerCase().indexOf(q) >= 0 ||
        String(row.nombres || "").toLowerCase().indexOf(q) >= 0 ||
        String(row.numeroIdentificacion || "").indexOf(q) >= 0 ||
        String(row.nombreCarrera || "").toLowerCase().indexOf(q) >= 0 ||
        String(division(row)).toLowerCase().indexOf(q) >= 0;
    });
  }

  function render(rows){
    rows = filterRows(rows || []);
    var body = H.one("#bdlStudentsBody");
    if(!body){ return; }
    if(!rows.length){ body.innerHTML = '<tr><td colspan="10" class="bdl-muted">No hay estudiantes para mostrar.</td></tr>'; return; }
    body.innerHTML = rows.map(function(row){
      return '<tr>'+
        '<td>'+H.esc(row.numeroIdentificacion)+'</td>'+
        '<td>'+H.esc(row.nombres)+'</td>'+
        '<td>'+H.esc(row.nombreCarrera)+'</td>'+
        '<td>'+H.esc(division(row))+'</td>'+
        '<td>'+H.esc(row.sede)+'</td>'+
        '<td>'+H.badge(row.estadoMatricula)+'</td>'+
        '<td>'+H.badge(row.academico)+'</td>'+
        '<td>'+H.badge(row.financiero)+'</td>'+
        '<td>'+H.badge(row.estadoGeneral)+'</td>'+
        '<td><button class="bdl-btn secondary" data-ver="'+H.esc(row.idEstudiantePeriodo)+'">Ver más</button></td>'+
      '</tr>';
    }).join("");
    Array.prototype.slice.call(body.querySelectorAll("[data-ver]")).forEach(function(btn){
      btn.addEventListener("click", function(){ window.BDLUIDetalle.open(btn.getAttribute("data-ver")); });
    });
  }

  function load(options){
    options = options || {};
    var periodoId = options.periodoId || currentPeriodo();
    page = options.page || page;
    H.notify("Cargando estudiantes...");
    if(!window.BDLRepoEstudiantes){ H.notify("Repositorio de estudiantes no disponible", "error"); return Promise.resolve([]); }
    return window.BDLRepoEstudiantes.listarResumen(periodoId, { page: page, limit: limit }).then(function(rows){
      lastRows = rows || [];
      render(lastRows);
      var info = H.one("#bdlPageInfo");
      if(info){ info.textContent = "Página " + page + " | " + lastRows.length + " registros"; }
      H.notify("Estudiantes cargados");
      return lastRows;
    }).catch(function(error){
      H.notify(error && error.message ? error.message : String(error), "error");
      return [];
    });
  }

  function next(){ page += 1; return load({ page: page }); }
  function prev(){ page = Math.max(1, page - 1); return load({ page: page }); }
  function refresh(){ return load({ page: page }); }
  function search(){ render(lastRows); }

  window.BDLUIEstudiantes = { load:load, next:next, prev:prev, refresh:refresh, search:search };
})(window);

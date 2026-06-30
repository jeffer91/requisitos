(function(window){
  "use strict";
  var H = window.BDLUIH;
  var listo = false;
  if(!H){ throw new Error("BDLUIH debe cargarse antes de BDLUICarga."); }
  function botones(modo){
    var a = H.one('#bdlBtnAnalizarExcel');
    var g = H.one('#bdlBtnGuardarCarga');
    if(a){ a.disabled = modo === 'listo'; }
    if(g){ g.disabled = modo !== 'listo'; }
  }
  function periodo(){ return H.val('#bdlPeriodoSelect'); }
  function renderPreview(result){
    result = result || {};
    var preview = result.preview || {};
    var rows = preview.rows || [];
    var box = H.one('#bdlCargaPreview');
    if(!box){ return; }
    if(!rows.length){ H.html(box, '<p class="bdl-muted">No hay vista previa.</p>'); return; }
    var headers = Object.keys(rows[0] || {}).slice(0, 12);
    var html = '<div class="bdl-table-wrap"><table class="bdl-table"><thead><tr>' + headers.map(function(h){ return '<th>'+H.esc(h)+'</th>'; }).join('') + '</tr></thead><tbody>';
    html += rows.slice(0, 20).map(function(row){ return '<tr>'+headers.map(function(h){ return '<td>'+H.esc(row[h])+'</td>'; }).join('')+'</tr>'; }).join('');
    html += '</tbody></table></div><p class="bdl-muted">Total detectado: '+H.esc(preview.total || 0)+'</p>';
    H.html(box, html);
  }
  function analizar(){
    var periodoId = periodo();
    var input = H.one('#bdlCargaFile');
    var file = input && input.files ? input.files[0] : null;
    if(!periodoId){ H.notify('Seleccione un período antes de analizar.', 'error'); return; }
    if(!file){ H.notify('Seleccione un archivo Excel.', 'error'); return; }
    if(!window.CargaApp){ H.notify('CargaApp no disponible.', 'error'); return; }
    botones('ocupado');
    return window.CargaApp.readFile(file, { periodoId:periodoId }).then(function(result){
      listo = true;
      renderPreview(result);
      botones('listo');
      H.notify('Archivo analizado. Ahora puede guardar.');
      return result;
    }).catch(function(error){
      listo = false;
      botones('inicio');
      H.notify(error && error.message ? error.message : String(error), 'error');
    });
  }
  function recargar(){
    var reload = window.BDLUIPeriodos ? window.BDLUIPeriodos.load() : Promise.resolve([]);
    return reload.then(function(){
      var periodoId = periodo();
      var tasks = [];
      if(periodoId && window.BDLUIDashboard){ tasks.push(window.BDLUIDashboard.loadDashboard(periodoId)); }
      if(window.BDLUIEstudiantes){ tasks.push(window.BDLUIEstudiantes.load({ periodoId:periodoId, page:1 })); }
      return Promise.all(tasks);
    });
  }
  function guardar(){
    if(!listo){ H.notify('Primero analice el Excel.', 'error'); return; }
    if(!window.CargaApp){ H.notify('CargaApp no disponible.', 'error'); return; }
    return window.CargaApp.save({ allowErrors:false }).then(function(report){
      H.notify(report.ok ? 'Carga guardada en BDLocal.' : 'La carga no se guardó.', report.ok ? '' : 'error');
      listo = false;
      botones('inicio');
      return recargar().then(function(){ return report; });
    }).catch(function(error){ H.notify(error && error.message ? error.message : String(error), 'error'); });
  }
  function reiniciar(){ listo = false; botones('inicio'); }
  window.BDLUICarga = { analizar:analizar, analyze:analizar, guardar:guardar, save:guardar, reiniciar:reiniciar, renderPreview:renderPreview, botones:botones };
})(window);

(function(window){
  "use strict";

  var H = window.BDLUIH;
  if(!H){ throw new Error("BDLUIH debe cargarse antes de BDLUICarga."); }

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
    html += '</tbody></table></div>';
    html += '<p class="bdl-muted">Total detectado: '+H.esc(preview.total || 0)+' | Mostrando: '+H.esc(preview.showing || rows.length)+'</p>';
    H.html(box, html);
  }

  function loadFile(){
    var input = H.one('#bdlCargaFile');
    var file = input && input.files ? input.files[0] : null;
    if(!file){ H.notify('Seleccione un archivo para cargar.', 'error'); return; }
    if(!window.CargaApp){ H.notify('CargaApp no disponible.', 'error'); return; }
    window.CargaApp.readFile(file).then(function(result){
      renderPreview(result);
      H.notify('Archivo leído. Revise la vista previa antes de guardar.');
    }).catch(function(error){ H.notify(error && error.message ? error.message : String(error), 'error'); });
  }

  function loadText(){
    var text = H.val('#bdlCargaTexto');
    if(!text){ H.notify('Pegue datos antes de procesar.', 'error'); return; }
    if(!window.CargaApp){ H.notify('CargaApp no disponible.', 'error'); return; }
    window.CargaApp.readClipboard(text).then(function(result){
      renderPreview(result);
      H.notify('Datos procesados. Revise la vista previa antes de guardar.');
    }).catch(function(error){ H.notify(error && error.message ? error.message : String(error), 'error'); });
  }

  function reloadAfterSave(){
    var reload = window.BDLUIDashboard ? window.BDLUIDashboard.loadPeriodos() : Promise.resolve([]);
    return reload.then(function(){
      var periodoId = H.val('#bdlPeriodoSelect') || (window.BDLState && window.BDLState.getPeriodoActivo ? window.BDLState.getPeriodoActivo() : "");
      var tasks = [];
      if(periodoId && window.BDLUIDashboard){ tasks.push(window.BDLUIDashboard.loadDashboard(periodoId)); }
      if(window.BDLUIEstudiantes){ tasks.push(window.BDLUIEstudiantes.load({ periodoId:periodoId, page:1 })); }
      return Promise.all(tasks);
    });
  }

  function save(){
    if(!window.CargaApp){ H.notify('CargaApp no disponible.', 'error'); return; }
    window.CargaApp.save({ allowErrors:false }).then(function(report){
      H.notify(report.ok ? 'Carga guardada en BDLocal.' : 'La carga no se guardó.', report.ok ? '' : 'error');
      return reloadAfterSave().then(function(){ return report; });
    }).catch(function(error){ H.notify(error && error.message ? error.message : String(error), 'error'); });
  }

  window.BDLUICarga = { loadFile:loadFile, loadText:loadText, save:save, renderPreview:renderPreview };
})(window);

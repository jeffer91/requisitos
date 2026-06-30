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
  function periodoLabel(){ var s = H.one('#bdlPeriodoSelect'); return s && s.selectedOptions && s.selectedOptions[0] ? s.selectedOptions[0].textContent : periodo(); }
  function asList(value){ return Array.isArray(value) ? value : []; }
  function asText(value){ return String(value == null ? '' : value); }
  function safeNumber(value){ value = Number(value || 0); return isFinite(value) ? value : 0; }

  function unique(values){
    var map = {};
    var out = [];
    asList(values).forEach(function(value){
      var clean = asText(value).trim();
      var key = clean.toLowerCase();
      if(clean && !map[key]){ map[key] = true; out.push(clean); }
    });
    return out;
  }

  function stateRows(appState){
    appState = appState || {};
    return appState.normalized && Array.isArray(appState.normalized.rowsMapeadas) ? appState.normalized.rowsMapeadas : [];
  }

  function fallbackFields(rows){
    var fields = [];
    asList(rows).slice(0, 100).forEach(function(row){ Object.keys(row || {}).forEach(function(key){ fields.push(key); }); });
    return unique(fields).sort(function(a, b){ return a.localeCompare(b); });
  }

  function fallbackCareers(rows){
    return unique(asList(rows).map(function(row){ return row.nombreCarrera || row.NombreCarrera || row.Carrera || row.carrera || row.programa || ''; })).sort(function(a, b){ return a.localeCompare(b); });
  }

  function summaryFrom(report, appState){
    report = report || {};
    appState = appState || {};
    var rows = stateRows(appState);
    var normalized = appState.normalized || {};
    var periodoDetectado = normalized.periodoDetectado || {};
    var campos = report.campos && Array.isArray(report.campos.nombres) ? report.campos.nombres : fallbackFields(rows);
    var carreras = report.carreras && Array.isArray(report.carreras.nombres) ? report.carreras.nombres : fallbackCareers(rows);
    var requisitos = report.requisitos && Array.isArray(report.requisitos.nombres) ? report.requisitos.nombres : [];
    return {
      ok: !!report.ok,
      archivo: report.archivo || normalized.fileName || appState.fileName || 'Archivo cargado',
      periodo: (report.periodo && (report.periodo.label || report.periodo.id)) || periodoDetectado.periodoLabel || periodoDetectado.periodoId || periodoLabel(),
      total: safeNumber(report.total || normalized.total || rows.length),
      guardados: safeNumber(report.guardados),
      errores: safeNumber(report.errores),
      advertencias: safeNumber(report.advertencias),
      campos: campos,
      carreras: carreras,
      requisitos: requisitos,
      errorsList: asList(appState.errors),
      warningsList: asList(appState.warnings)
    };
  }

  function pillList(list, emptyText, max){
    list = asList(list);
    max = Number(max || 18);
    if(!list.length){ return '<span class="bdl-summary-empty">'+H.esc(emptyText || 'Sin datos')+'</span>'; }
    var shown = list.slice(0, max).map(function(item){ return '<span class="bdl-summary-pill">'+H.esc(item)+'</span>'; }).join('');
    if(list.length > max){ shown += '<span class="bdl-summary-pill more">+'+H.esc(list.length - max)+' más</span>'; }
    return shown;
  }

  function stat(label, value, extraClass){ return '<article class="bdl-summary-stat '+H.esc(extraClass || '')+'"><strong>'+H.esc(value)+'</strong><span>'+H.esc(label)+'</span></article>'; }
  function detailLine(label, value){ return '<div class="bdl-summary-line"><span>'+H.esc(label)+'</span><strong>'+H.esc(value || '—')+'</strong></div>'; }

  function listIssues(title, rows){
    rows = asList(rows).slice(0, 6);
    if(!rows.length){ return ''; }
    return '<section class="bdl-summary-issues"><h4>'+H.esc(title)+'</h4><ul>'+rows.map(function(item){ return '<li>Fila '+H.esc(item.row || '—')+': '+H.esc(item.mensaje || item.tipo || 'Revisar dato')+'</li>'; }).join('')+'</ul></section>';
  }

  function buildSummaryHtml(s){
    var estado = s.ok ? 'Carga guardada correctamente' : 'Carga revisada, pero no se guardó completa';
    var estadoClass = s.ok ? 'ok' : 'warn';
    return ''+
      '<div class="bdl-summary-status '+estadoClass+'"><strong>'+H.esc(estado)+'</strong><span>'+H.esc(new Date().toLocaleString())+'</span></div>'+ 
      '<div class="bdl-summary-stats">'+
        stat('Estudiantes detectados', s.total, '')+
        stat('Guardados en BDLocal', s.guardados, 'ok')+
        stat('Campos detectados', s.campos.length, '')+
        stat('Carreras detectadas', s.carreras.length, '')+
        stat('Requisitos detectados', s.requisitos.length, '')+
        stat('Advertencias', s.advertencias, s.advertencias ? 'warn' : '')+
        stat('Errores', s.errores, s.errores ? 'bad' : '')+
      '</div>'+
      '<div class="bdl-summary-details">'+detailLine('Archivo', s.archivo)+detailLine('Período', s.periodo)+'</div>'+
      '<section class="bdl-summary-block"><h4>Campos cargados</h4><div class="bdl-summary-pills">'+pillList(s.campos, 'No se detectaron campos', 22)+'</div></section>'+
      '<section class="bdl-summary-block"><h4>Carreras detectadas</h4><div class="bdl-summary-pills">'+pillList(s.carreras, 'No se detectaron carreras', 14)+'</div></section>'+
      '<section class="bdl-summary-block"><h4>Requisitos detectados</h4><div class="bdl-summary-pills">'+pillList(s.requisitos, 'No se detectaron requisitos específicos', 14)+'</div></section>'+
      listIssues('Errores principales', s.errorsList)+listIssues('Advertencias principales', s.warningsList);
  }

  function mostrarResumen(report, appState){
    var s = summaryFrom(report, appState);
    var html = buildSummaryHtml(s);
    var modal = H.one('#bdlCargaSummaryModal');
    var body = H.one('#bdlCargaSummaryBody');

    if(modal && body){
      H.html(body, html);
      modal.classList.add('open');
      return;
    }

    var panel = H.one('#bdlDetailPanel');
    var panelTitle = H.one('#bdlDetailPanel .bdl-panel-head strong');
    var panelBody = H.one('#bdlPanelBody');
    if(panel && panelBody){
      if(panelTitle){ panelTitle.textContent = 'Resumen de carga'; }
      H.html(panelBody, html);
      panel.classList.add('open');
      return;
    }

    H.notify('Resumen: '+s.guardados+' guardados, '+s.campos.length+' campos, '+s.carreras.length+' carreras.', s.ok ? '' : 'error');
  }

  function cerrarResumen(){
    var modal = H.one('#bdlCargaSummaryModal');
    if(modal){ modal.classList.remove('open'); }
    var panel = H.one('#bdlDetailPanel');
    if(panel){ panel.classList.remove('open'); }
  }

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
    html += '</tbody></table></div><p class="bdl-muted">Vista previa: '+H.esc(rows.length)+' filas. Total detectado: '+H.esc(preview.total || 0)+'</p>';
    H.html(box, html);
  }

  function analizar(){
    var periodoId = periodo();
    var input = H.one('#bdlCargaFile');
    var file = input && input.files ? input.files[0] : null;
    if(!periodoId){ H.notify('Seleccione un período antes de analizar.', 'error'); return; }
    if(!file){ H.notify('Seleccione un archivo Excel.', 'error'); return; }
    if(!window.CargaApp){ H.notify('CargaApp no disponible.', 'error'); return; }
    cerrarResumen();
    botones('ocupado');
    return window.CargaApp.readFile(file, { periodoId:periodoId, periodoLabel:periodoLabel() }).then(function(result){
      listo = true;
      renderPreview(result);
      botones('listo');
      H.notify('Archivo analizado. Ahora puede guardar.');
      return result;
    }).catch(function(error){ listo = false; botones('inicio'); H.notify(error && error.message ? error.message : String(error), 'error'); });
  }

  function recargar(){
    var reload = window.BDLUIPeriodos ? window.BDLUIPeriodos.load() : Promise.resolve([]);
    return reload.then(function(){
      var periodoId = periodo();
      if(periodoId && window.BDLUIDashboard){ return window.BDLUIDashboard.loadDashboard(periodoId); }
      return null;
    });
  }

  function guardar(){
    if(!listo){ H.notify('Primero analice el Excel.', 'error'); return; }
    if(!window.CargaApp){ H.notify('CargaApp no disponible.', 'error'); return; }
    H.notify('Guardando carga...');
    return window.CargaApp.save({ allowErrors:false }).then(function(report){
      var appState = window.CargaApp && typeof window.CargaApp.state === 'function' ? window.CargaApp.state() : {};
      H.notify(report.ok ? 'Carga guardada en BDLocal.' : 'La carga necesita revisión.', report.ok ? '' : 'error');
      listo = false;
      botones('inicio');
      return recargar().then(function(){ mostrarResumen(report, appState); return report; });
    }).catch(function(error){ H.notify(error && error.message ? error.message : String(error), 'error'); });
  }

  function reiniciar(){ listo = false; botones('inicio'); cerrarResumen(); }

  window.BDLUICarga = { analizar:analizar, analyze:analizar, guardar:guardar, save:guardar, reiniciar:reiniciar, renderPreview:renderPreview, botones:botones, mostrarResumen:mostrarResumen, cerrarResumen:cerrarResumen };
})(window);

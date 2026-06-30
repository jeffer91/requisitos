(function(window){
  "use strict";

  var H = window.BDLUIH;
  if(!H){ throw new Error("BDLUIH debe cargarse antes de BDLUIDetalle."); }

  function row(label, value){ return '<p><strong>'+H.esc(label)+':</strong> '+H.esc(value || '')+'</p>'; }

  function render(data){
    data = data || {};
    var resumen = data.resumen || {};
    var requisitos = data.requisitos || [];
    var notas = data.notas || [];
    var divisiones = data.divisiones || [];
    var html = '';
    html += row('Cédula', resumen.numeroIdentificacion);
    html += row('Nombres', resumen.nombres);
    html += row('Carrera', resumen.nombreCarrera);
    html += row('Sede', resumen.sede);
    html += row('Estado general', resumen.estadoGeneral);
    html += '<h3>Requisitos</h3>' + (requisitos.length ? requisitos.map(function(r){ return '<p>'+H.esc(r.requisitoId)+' '+H.badge(r.estado)+'</p>'; }).join('') : '<p class="bdl-muted">Sin requisitos.</p>');
    html += '<h3>Notas</h3>' + (notas.length ? notas.map(function(n){ return '<p>'+H.esc(n.tipoNota)+': '+H.esc(n.valorOriginal || n.valor)+'</p>'; }).join('') : '<p class="bdl-muted">Sin notas.</p>');
    html += '<h3>Divisiones</h3>' + (divisiones.length ? divisiones.map(function(d){ return '<p>'+H.esc(d.division)+'</p>'; }).join('') : '<p class="bdl-muted">Sin divisiones.</p>');
    H.html(H.one('#bdlPanelBody'), html);
  }

  function open(idEstudiantePeriodo){
    var panel = H.one('#bdlDetailPanel');
    if(panel){ panel.classList.add('open'); }
    H.html(H.one('#bdlPanelBody'), '<p class="bdl-muted">Cargando detalle...</p>');
    if(!window.BDLRepoEstudiantes){ H.html(H.one('#bdlPanelBody'), '<p class="bdl-error">Repositorio no disponible.</p>'); return; }
    window.BDLRepoEstudiantes.obtenerDetalle(idEstudiantePeriodo).then(render).catch(function(error){
      H.html(H.one('#bdlPanelBody'), '<p class="bdl-error">'+H.esc(error && error.message ? error.message : String(error))+'</p>');
    });
  }

  function close(){ var panel = H.one('#bdlDetailPanel'); if(panel){ panel.classList.remove('open'); } }

  window.BDLUIDetalle = { open:open, close:close };
})(window);

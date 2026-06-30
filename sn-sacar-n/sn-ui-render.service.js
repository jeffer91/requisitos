/* =========================================================
Nombre completo: sn-ui-render.service.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-ui-render.service.js
Modulo: Sacar N
Funcion o funciones:
- Renderizar resumen, avance, tabla, filtros y panel de novedades.
- Mantener separada la visualizacion de la logica principal.
- Preparar la interfaz para BDLocal, SISACAD, prueba visible y extraccion automatica.
Con que se conecta:
- sn-config.js
- sn-state.service.js
- sn-sacar-n.js
========================================================= */
(function(window, document){
  "use strict";

  var cfg = window.SNConfig || {};

  function $(id){ return document.getElementById(id); }

  function texto(valor){ return String(valor == null ? "" : valor); }

  function escapeHtml(value){
    return texto(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setText(id, value){
    var el = $(id);
    if(el){ el.textContent = texto(value); }
  }

  function setValue(id, value){
    var el = $(id);
    if(el){ el.value = texto(value); }
  }

  function setDisabled(id, disabled){
    var el = $(id);
    if(el){ el.disabled = !!disabled; }
  }

  function setProgress(value){
    var bar = $("snProgressBar");
    if(bar){ bar.style.width = Math.max(0, Math.min(100, Number(value || 0))) + "%"; }
  }

  function badgeClass(estado){
    estado = texto(estado).toLowerCase();
    if(estado.indexOf("procesado") >= 0){ return "ok"; }
    if(estado.indexOf("sin notas") >= 0){ return "warning"; }
    if(estado.indexOf("no encontrado") >= 0){ return "warning"; }
    if(estado.indexOf("error") >= 0 || estado.indexOf("expirada") >= 0){ return "danger"; }
    if(estado.indexOf("revisar") >= 0){ return "warning"; }
    if(estado.indexOf("procesando") >= 0){ return "info"; }
    return "neutral";
  }

  function renderResumen(snapshot){
    snapshot = snapshot || {};
    var resumen = snapshot.resumen || {};
    var avance = snapshot.avance || {};

    setText("snTotal", resumen.total || 0);
    setText("snPendientes", resumen.pendientes || 0);
    setText("snProcesados", resumen.procesados || 0);
    setText("snSinNotas", resumen.sinNotas || 0);
    setText("snNoEncontrados", resumen.noEncontrados || 0);
    setText("snErrores", (resumen.errores || 0) + (resumen.revisar || 0));
    setText("snModuloEstado", snapshot.modulo || "sin_iniciar");
    setText("snMensaje", snapshot.mensaje || "Listo");
    setText("snAvanceTexto", (avance.procesados || 0) + " / " + (avance.total || 0) + " procesados");
    setText("snPorcentajeTexto", (avance.porcentaje || 0) + "%");
    setProgress(avance.porcentaje || 0);
  }

  function renderFiltros(snapshot){
    snapshot = snapshot || {};
    setValue("snBuscar", snapshot.busqueda || "");
  }

  function renderTabla(snapshot){
    snapshot = snapshot || {};
    var tbody = $("snTablaBody");
    if(!tbody){ return; }

    var estudiantes = Array.isArray(snapshot.estudiantes) ? snapshot.estudiantes : [];
    if(!estudiantes.length){
      tbody.innerHTML = '<tr><td class="sn-empty" colspan="10">Pantalla lista. En el siguiente bloque se cargaran estudiantes desde BDLocal.</td></tr>';
      return;
    }

    tbody.innerHTML = estudiantes.map(function(item, index){
      var estado = item.estado || (cfg.estadosEstudiante && cfg.estadosEstudiante.pendiente) || "Pendiente";
      return '<tr>' +
        '<td>' + (index + 1) + '</td>' +
        '<td><strong>' + escapeHtml(item.cedula || '') + '</strong></td>' +
        '<td>' + escapeHtml(item.nombres || '') + '</td>' +
        '<td>' + escapeHtml(item.carrera || '') + '</td>' +
        '<td>' + escapeHtml(item.periodo || '') + '</td>' +
        '<td>' + escapeHtml(item.promedioTrabajoEscrito || '') + '</td>' +
        '<td>' + escapeHtml(item.promedioDefensaOral || '') + '</td>' +
        '<td>' + escapeHtml(item.calificacionFinalProyecto || '') + '</td>' +
        '<td><span class="sn-status ' + badgeClass(estado) + '">' + escapeHtml(estado) + '</span></td>' +
        '<td>' + escapeHtml(item.observacion || '') + '</td>' +
      '</tr>';
    }).join('');
  }

  function renderNovedades(snapshot){
    snapshot = snapshot || {};
    var box = $("snNovedadesBody");
    if(!box){ return; }

    var novedades = Array.isArray(snapshot.novedades) ? snapshot.novedades : [];
    if(!novedades.length){
      box.innerHTML = '<div class="sn-empty-box">Sin novedades registradas.</div>';
      return;
    }

    box.innerHTML = novedades.slice().reverse().map(function(item){
      return '<article class="sn-novedad">' +
        '<div><strong>' + escapeHtml(item.tipo || 'Novedad') + '</strong><span>' + escapeHtml(item.fecha || '') + '</span></div>' +
        '<p>' + escapeHtml(item.cedula || '') + ' · ' + escapeHtml(item.nombres || '') + '</p>' +
        '<p>' + escapeHtml(item.detalle || '') + '</p>' +
      '</article>';
    }).join('');
  }

  function renderEstadoBotones(snapshot){
    snapshot = snapshot || {};
    var tieneEstudiantes = Array.isArray(snapshot.estudiantes) && snapshot.estudiantes.length > 0;
    var modulo = texto(snapshot.modulo);
    var estaExtrayendo = modulo === ((cfg.estadosModulo && cfg.estadosModulo.extrayendo) || "extrayendo");
    var estaPausado = modulo === ((cfg.estadosModulo && cfg.estadosModulo.pausado) || "pausado");

    setDisabled("snBtnCargarEstudiantes", false);
    setDisabled("snBtnAbrirSisacad", false);
    setDisabled("snBtnPruebaVisible", !tieneEstudiantes);
    setDisabled("snBtnContinuarAutomatico", !tieneEstudiantes);
    setDisabled("snBtnPausar", !estaExtrayendo);
    setDisabled("snBtnContinuar", !estaPausado);
    setDisabled("snBtnExportar", !tieneEstudiantes);
    setDisabled("snBtnVerNovedades", false);
  }

  function render(snapshot){
    renderResumen(snapshot);
    renderFiltros(snapshot);
    renderTabla(snapshot);
    renderNovedades(snapshot);
    renderEstadoBotones(snapshot);
  }

  function initStatic(){
    setText("snTitle", cfg.moduloTitulo || "Sacar N");
    setText("snVersion", "v" + (cfg.version || "0.1.0"));
    setText("snSisacadUrl", cfg.sisacadUrl || "https://sisacad.itsqmet.edu.ec/");
  }

  window.SNUIRender = {
    render: render,
    initStatic: initStatic,
    setText: setText,
    setDisabled: setDisabled,
    escapeHtml: escapeHtml
  };
})(window, document);

/* =========================================================
Nombre completo: sn-sacar-n.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-sacar-n.js
Modulo: Sacar N
Funcion o funciones:
- Inicializar la pantalla base Sacar N.
- Mostrar estado, resumen y mensajes iniciales.
- Dejar preparados los botones para los siguientes bloques sin ejecutar automatizacion todavia.
Con que se conecta:
- sn-config.js
- sn-models.js
- sn-state.service.js
- sn-sacar-n.html
========================================================= */
(function(window, document){
  "use strict";

  var cfg = window.SNConfig || {};
  var state = window.SNState || {};
  var models = window.SNModels || {};

  function $(id){
    return document.getElementById(id);
  }

  function setText(id, value){
    var el = $(id);
    if(el){ el.textContent = String(value == null ? "" : value); }
  }

  function setProgress(value){
    var bar = $("snProgressBar");
    if(bar){ bar.style.width = Math.max(0, Math.min(100, Number(value || 0))) + "%"; }
  }

  function renderResumen(snapshot){
    snapshot = snapshot || (state.get ? state.get() : {});
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
    setProgress(avance.porcentaje || 0);
  }

  function renderTabla(snapshot){
    snapshot = snapshot || (state.get ? state.get() : {});
    var tbody = $("snTablaBody");
    if(!tbody){ return; }

    var estudiantes = Array.isArray(snapshot.estudiantes) ? snapshot.estudiantes : [];
    if(!estudiantes.length){
      tbody.innerHTML = '<tr><td class="sn-empty" colspan="9">Bloque 1 listo: pantalla base creada. En el siguiente bloque se conectara al menu de Requisitos.</td></tr>';
      return;
    }

    tbody.innerHTML = estudiantes.map(function(item, index){
      return '<tr>' +
        '<td>' + (index + 1) + '</td>' +
        '<td>' + escapeHtml(item.cedula || '') + '</td>' +
        '<td>' + escapeHtml(item.nombres || '') + '</td>' +
        '<td>' + escapeHtml(item.carrera || '') + '</td>' +
        '<td>' + escapeHtml(item.promedioTrabajoEscrito || '') + '</td>' +
        '<td>' + escapeHtml(item.promedioDefensaOral || '') + '</td>' +
        '<td>' + escapeHtml(item.calificacionFinalProyecto || '') + '</td>' +
        '<td>' + escapeHtml(item.estado || '') + '</td>' +
        '<td>' + escapeHtml(item.observacion || '') + '</td>' +
      '</tr>';
    }).join('');
  }

  function escapeHtml(value){
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function bloquearBotonesPendientes(){
    [
      "snBtnCargarEstudiantes",
      "snBtnAbrirSisacad",
      "snBtnPruebaVisible",
      "snBtnContinuarAutomatico",
      "snBtnPausar",
      "snBtnContinuar",
      "snBtnExportar",
      "snBtnVerNovedades"
    ].forEach(function(id){
      var btn = $(id);
      if(btn){ btn.disabled = true; }
    });
  }

  function bindBaseEvents(){
    var btnReset = $("snBtnResetBase");
    if(btnReset && state.reset){
      btnReset.addEventListener("click", function(){
        state.reset();
      });
    }
  }

  function boot(){
    setText("snTitle", cfg.moduloTitulo || "Sacar N");
    setText("snVersion", "v" + (cfg.version || "0.1.0"));
    setText("snSisacadUrl", cfg.sisacadUrl || "https://sisacad.itsqmet.edu.ec/");
    bloquearBotonesPendientes();
    bindBaseEvents();

    if(state.subscribe){
      state.subscribe(function(snapshot){
        renderResumen(snapshot);
        renderTabla(snapshot);
      });
    }else{
      renderResumen({});
      renderTabla({});
    }

    if(state.setModulo && cfg.estadosModulo){
      state.setModulo(cfg.estadosModulo.sinIniciar, "Bloque 1 listo: estructura base creada. Falta conectar al menu.");
    }

    try{
      window.dispatchEvent(new CustomEvent("sn:boot", { detail: { at: models.ahora ? models.ahora() : new Date().toISOString() } }));
    }catch(error){}
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})(window, document);

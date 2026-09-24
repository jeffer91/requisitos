/* =========================================================
Nombre completo: tabla.message-counter.js
Ruta: /Gestion/Tabla/ui/tabla.message-counter.js
Función:
- Mostrar contactos válidos del período seleccionado.
- Separar WhatsApp, Telegram, correo y estudiantes contactados.
- Actualizarse después de renderizar, cambiar filtros o registrar mensajes.
- Abrir el historial al hacer clic en el contador.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.1.0-channel-breakdown";
  var timer = null;
  var bound = false;

  function el(id){
    return document.getElementById(id);
  }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function currentPeriod(){
    try{
      if(window.TablaApp && typeof window.TablaApp.getState === "function"){
        var state = window.TablaApp.getState() || {};
        return text(state.periodId || "");
      }
    }catch(error){}
    return "";
  }

  function readSummary(){
    var query = window.TablaHistoryQuery;
    if(!query || typeof query.summary !== "function"){
      return {
        countable: 0,
        whatsapp: 0,
        telegram: 0,
        mail: 0,
        estudiantes: 0
      };
    }

    var periodId = currentPeriod();
    var rows;

    if(periodId && typeof query.forPeriod === "function"){
      rows = query.forPeriod(periodId);
    }else if(typeof query.read === "function"){
      rows = query.read();
    }else{
      rows = [];
    }

    return query.summary(rows || []);
  }

  function write(id, value){
    var node = el(id);
    if(node){
      node.textContent = Number(value || 0).toLocaleString("es-EC");
    }
  }

  function render(){
    var box = el("tabla-message-counter");
    var value = el("tabla-message-counter-value");
    if(!box || !value){ return false; }

    var summary = readSummary();
    var total = Number(summary.countable || 0);
    var periodId = currentPeriod();

    value.textContent = total.toLocaleString("es-EC");
    write("tabla-message-counter-wa", summary.whatsapp);
    write("tabla-message-counter-tg", summary.telegram);
    write("tabla-message-counter-mail", summary.mail);
    write("tabla-message-counter-students", summary.estudiantes || summary.contactados);

    box.hidden = false;
    box.title =
      (periodId ? "Período actual" : "Historial general") +
      " · WhatsApp: " + Number(summary.whatsapp || 0) +
      " · Telegram confirmados: " + Number(summary.telegram || 0) +
      " · Correos preparados: " + Number(summary.mail || 0) +
      " · Estudiantes contactados: " + Number(summary.estudiantes || summary.contactados || 0) +
      ". Telegram solo cuenta cuando el bot confirma el envío.";

    return true;
  }

  function schedule(delay){
    if(timer){ window.clearTimeout(timer); }
    timer = window.setTimeout(function(){
      timer = null;
      render();
    }, typeof delay === "number" ? delay : 30);
  }

  function bind(){
    if(bound){ return; }
    bound = true;

    var box = el("tabla-message-counter");
    if(box){
      box.setAttribute("role", "button");
      box.setAttribute("tabindex", "0");

      function openHistory(){
        if(
          window.TablaHistory &&
          typeof window.TablaHistory.abrir === "function"
        ){
          window.TablaHistory.abrir();
        }
      }

      box.addEventListener("click", openHistory);
      box.addEventListener("keydown", function(event){
        if(event.key === "Enter" || event.key === " "){
          event.preventDefault();
          openHistory();
        }
      });
    }
  }

  [
    "tabla:rendered",
    "tabla:history-updated",
    "tabla:filters-changed",
    "tabla:data-updated",
    "tabla:state-changed",
    "tabla:stage-filter-changed"
  ].forEach(function(name){
    window.addEventListener(name, function(){ schedule(20); });
  });

  function boot(){
    bind();
    schedule(0);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.TablaMessageCounter = {
    version: VERSION,
    render: render,
    schedule: schedule,
    readSummary: readSummary
  };
})(window, document);

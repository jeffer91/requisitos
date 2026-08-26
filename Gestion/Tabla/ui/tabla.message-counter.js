/* =========================================================
Nombre completo: tabla.message-counter.js
Ruta: /Gestion/Tabla/ui/tabla.message-counter.js
Función:
- Mostrar un contador visible de contactos/mensajes del período seleccionado.
- Reutilizar TablaHistoryQuery sin realizar nuevas lecturas de BDLocal.
- Actualizar el contador después de renderizar o registrar mensajes.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.0.0-period-message-counter";
  var timer = null;

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
        mail: 0
      };
    }

    var periodId = currentPeriod();
    var rows = periodId && typeof query.forPeriod === "function"
      ? query.forPeriod(periodId)
      : [];

    return query.summary(rows || []);
  }

  function render(){
    var box = el("tabla-message-counter");
    var value = el("tabla-message-counter-value");
    if(!box || !value){ return false; }

    var summary = readSummary();
    var total = Number(summary.countable || 0);

    value.textContent = total.toLocaleString("es-EC");
    box.hidden = false;
    box.title =
      "Período actual · WhatsApp preparados: " + Number(summary.whatsapp || 0) +
      " · Telegram registrados: " + Number(summary.telegram || 0) +
      " · Correos preparados: " + Number(summary.mail || 0) +
      ". Telegram solo cuenta como envío cuando el bot lo confirma.";

    return true;
  }

  function schedule(delay){
    if(timer){ window.clearTimeout(timer); }
    timer = window.setTimeout(function(){
      timer = null;
      render();
    }, typeof delay === "number" ? delay : 30);
  }

  [
    "tabla:rendered",
    "tabla:history-updated",
    "tabla:filters-changed",
    "tabla:data-updated"
  ].forEach(function(name){
    window.addEventListener(name, function(){ schedule(20); });
  });

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ schedule(0); });
  }else{
    schedule(0);
  }

  window.TablaMessageCounter = {
    version: VERSION,
    render: render,
    schedule: schedule
  };
})(window, document);

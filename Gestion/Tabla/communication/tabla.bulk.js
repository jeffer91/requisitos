/* =========================================================
Nombre completo: tabla.bulk.js
Ruta: /Gestion/Tabla/communication/tabla.bulk.js
Función:
- Centralizar acciones simples sobre todos los estudiantes filtrados.
- Aplicar un tipo de mensaje global a las filas visibles.
- Abrir WhatsApp para todos los filtrados con número válido.
- Abrir una pestaña de Outlook Web por cada estudiante filtrado con correo válido.
- Reutilizar Telegram masivo e historial existentes y mantener el tipo global seleccionado.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.1.0-reviewed-bulk-communications";
  var U = window.TablaUtils || {};
  var globalType = "requisitos";
  var rowOverrides = Object.create(null);
  var bound = false;

  function el(id){
    return document.getElementById(id);
  }

  function text(value){
    return U.text
      ? U.text(value)
      : String(value == null ? "" : value).trim();
  }

  function key(value){
    return U.normalizeKey
      ? U.normalizeKey(value)
      : text(value)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "");
  }

  function status(message, type){
    if(
      window.TablaRenderSummary &&
      typeof window.TablaRenderSummary.status === "function"
    ){
      window.TablaRenderSummary.status(message, type || "");
      return;
    }

    var box = el("tabla-status");
    if(box){
      box.textContent = text(message);
      box.className = "tabla-status" + (type ? " " + type : "");
    }
  }

  function appState(){
    try{
      if(window.TablaApp && typeof window.TablaApp.getState === "function"){
        return window.TablaApp.getState() || {};
      }
    }catch(error){}
    return {};
  }

  function rows(){
    var current = appState();
    return Array.isArray(current.filteredRows)
      ? current.filteredRows.slice()
      : [];
  }

  function rowId(row){
    row = row || {};
    return [
      text(row._cedula || row.cedula || row.numeroIdentificacion),
      text(row._periodoId || row.periodoId || row.periodId || row._periodo)
    ].join("::");
  }

  function typeForRow(row){
    return rowOverrides[rowId(row)] || globalType || "requisitos";
  }

  function studentData(row){
    if(
      window.TablaMessage &&
      typeof window.TablaMessage.datosEstudiante === "function"
    ){
      return window.TablaMessage.datosEstudiante(row || {}) || {};
    }

    row = row || {};
    return {
      nombre: text(row._nombres),
      cedula: text(row._cedula),
      carrera: text(row._carrera),
      periodo: text(row._periodo),
      periodoId: text(row._periodoId),
      correo: text(row._correo),
      celular: text(row._celular)
    };
  }

  function typeLabel(type){
    if(
      window.TablaMessage &&
      typeof window.TablaMessage.tipoLabel === "function"
    ){
      return window.TablaMessage.tipoLabel(type);
    }
    return text(type || "Mensaje");
  }

  function messageFor(row, type, channel){
    var Message = window.TablaMessage || {};

    if(
      channel === "whatsapp" &&
      typeof Message.generarMensajeWhatsApp === "function"
    ){
      return Message.generarMensajeWhatsApp(row, type, {texto:""});
    }

    if(typeof Message.generarMensaje === "function"){
      return Message.generarMensaje(row, type, {texto:""});
    }

    return "Saludos. Desde el área de Titulación se informa que existen novedades en su proceso.";
  }

  function whatsappAvailable(row){
    return !!(
      window.TablaWhatsApp &&
      typeof window.TablaWhatsApp.available === "function" &&
      window.TablaWhatsApp.available(row)
    );
  }

  function preferredEmail(row){
    row = row || {};
    var candidates = [
      row._correoInstitucional,
      row.CorreoInstitucional,
      row.correoInstitucional,
      row.emailInstitucional,
      row.EmailInstitucional,
      row._correoPersonal,
      row.CorreoPersonal,
      row.correoPersonal,
      row._correo,
      row.correo,
      row.email,
      row.Email
    ];

    for(var i = 0; i < candidates.length; i += 1){
      var address = text(candidates[i]).toLowerCase();

      if(!address){ continue; }

      var valid = window.TablaEmail && typeof window.TablaEmail.isValid === "function"
        ? window.TablaEmail.isValid(address)
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);

      if(valid){ return address; }
    }

    return "";
  }

  function telegramAvailable(row){
    row = row || {};

    if(
      window.TablaTelegram &&
      typeof window.TablaTelegram.info === "function"
    ){
      var info = window.TablaTelegram.info(row) || {};
      return !!(info.chatId || info.user || info.hasTelegram);
    }

    return !!text(
      row._telegramChatId ||
      row.telegramChatId ||
      row._telegramUser ||
      row.telegramUser
    );
  }

  function metrics(){
    var list = rows();
    var wa = 0;
    var mail = 0;
    var tg = 0;

    list.forEach(function(row){
      if(whatsappAvailable(row)){ wa += 1; }
      if(preferredEmail(row)){ mail += 1; }
      if(telegramAvailable(row)){ tg += 1; }
    });

    return {
      total: list.length,
      whatsapp: wa,
      mail: mail,
      telegram: tg
    };
  }

  function renderMetrics(){
    var data = metrics();
    var total = el("tabla-bulk-total");
    var wa = el("tabla-bulk-wa");
    var mail = el("tabla-bulk-mail");
    var tg = el("tabla-bulk-tg");

    if(total){ total.textContent = String(data.total); }
    if(wa){ wa.textContent = String(data.whatsapp); }
    if(mail){ mail.textContent = String(data.mail); }
    if(tg){ tg.textContent = String(data.telegram); }

    var disabled = data.total === 0;
    ["tabla-global-apply","tabla-bulk-whatsapp","tabla-bulk-outlook","tabla-bulk-telegram"]
      .forEach(function(id){
        var button = el(id);
        if(button){ button.disabled = disabled; }
      });

    return data;
  }

  function syncVisibleSelects(){
    var wrap = el("tabla-table-wrap");
    if(!wrap){ return; }

    var currentRows = appState().rows || [];
    var selects = wrap.querySelectorAll(".tabla-message-select");

    Array.prototype.forEach.call(selects, function(select, index){
      var row = currentRows[index];
      if(!row){ return; }

      var wanted = typeForRow(row);
      select.value = wanted;

      if(select.value !== wanted){
        select.value = "requisitos";
      }
    });
  }

  function applyGlobal(){
    var select = el("tabla-global-message-type");
    globalType = text(select && select.value) || "requisitos";
    rowOverrides = Object.create(null);
    syncVisibleSelects();

    status(
      "Mensaje «" + typeLabel(globalType) + "» aplicado a " + rows().length + " estudiantes filtrados.",
      "ok"
    );

    return globalType;
  }

  function recordPrepared(row, channel, type, message, destination){
    if(
      !window.TablaHistory ||
      typeof window.TablaHistory.guardar !== "function"
    ){
      return null;
    }

    var data = studentData(row);

    return window.TablaHistory.guardar({
      canal: channel,
      modo: "masivo",
      accion: "abierto",
      tipoMensaje: type,
      tipoLabel: typeLabel(type),
      cedula: data.cedula || row._cedula || "",
      nombre: data.nombre || row._nombres || "",
      carrera: data.carrera || row._carrera || "",
      periodo: data.periodo || row._periodo || "",
      periodoId: data.periodoId || row._periodoId || "",
      correo: channel === "mail" ? preferredEmail(row) : "",
      telefono: channel === "whatsapp"
        ? (
            window.TablaWhatsApp &&
            typeof window.TablaWhatsApp.phoneOf === "function"
              ? window.TablaWhatsApp.phoneOf(row)
              : text(row._celular)
          )
        : "",
      destino: text(destination),
      mensaje: message || "",
      estado: "preparado"
    });
  }

  function openAllWhatsApp(){
    var list = rows().filter(whatsappAvailable);

    if(!list.length){
      status("No hay estudiantes filtrados con WhatsApp válido.", "warn");
      return false;
    }

    if(
      typeof window.confirm === "function" &&
      !window.confirm(
        "Se intentarán abrir " + list.length +
        " pestañas de WhatsApp. Si el navegador las bloquea, habilite las ventanas emergentes para esta aplicación. ¿Continuar?"
      )
    ){
      return false;
    }

    var openedRows = [];
    var blocked = 0;

    list.forEach(function(row){
      try{
        var type = typeForRow(row);
        var message = messageFor(row, type, "whatsapp");
        var result = window.TablaWhatsApp.open(row, message);

        if(result && result.ok){
          openedRows.push(row);
          recordPrepared(
            row,
            "whatsapp",
            type,
            message,
            result.phone || ""
          );
        }else{
          blocked += 1;
        }
      }catch(error){
        blocked += 1;
      }
    });

    if(
      window.TablaMessageCounter &&
      typeof window.TablaMessageCounter.render === "function"
    ){
      window.TablaMessageCounter.render();
    }

    status(
      openedRows.length + " WhatsApp preparados" +
      (blocked ? " · " + blocked + " bloqueados/no disponibles." : "."),
      blocked ? "warn" : "ok"
    );

    return openedRows.length > 0;
  }

  function subjectFor(row, type){
    if(
      window.TablaEmail &&
      typeof window.TablaEmail.subjectFor === "function"
    ){
      return window.TablaEmail.subjectFor(row, type);
    }

    if(
      window.TablaMessage &&
      typeof window.TablaMessage.asunto === "function"
    ){
      return window.TablaMessage.asunto(row, type);
    }

    return typeLabel(type) + " - Proceso de titulación";
  }

  function outlookUrlFor(row, type, message){
    var address = preferredEmail(row);

    if(!address){
      return "";
    }

    return (
      "https://outlook.office.com/mail/deeplink/compose?to=" +
      encodeURIComponent(address) +
      "&subject=" +
      encodeURIComponent(subjectFor(row, type)) +
      "&body=" +
      encodeURIComponent(text(message))
    );
  }

  function openExternal(url){
    try{
      if(
        window.top &&
        window.top.electronAPI &&
        typeof window.top.electronAPI.openExternal === "function"
      ){
        return Promise.resolve(
          window.top.electronAPI.openExternal(url)
        )
          .then(function(result){
            if(result === true){
              return true;
            }

            return !!(
              result &&
              result.ok === true &&
              result.opened !== false
            );
          })
          .catch(function(){
            return false;
          });
      }
    }catch(error){}

    try{
      var anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();

      window.setTimeout(function(){
        try{ anchor.remove(); }catch(error){}
      }, 0);

      return Promise.resolve(true);
    }catch(error){
      return Promise.resolve(false);
    }
  }

  function openAllOutlook(){
    var list = rows().filter(function(row){
      return !!preferredEmail(row);
    });

    if(!list.length){
      status(
        "No hay estudiantes filtrados con correo válido.",
        "warn"
      );

      return Promise.resolve(false);
    }

    if(
      typeof window.confirm === "function" &&
      !window.confirm(
        "Se abrirán " + list.length +
        " pestañas de Outlook, una por estudiante, con el mensaje preparado. ¿Continuar?"
      )
    ){
      return Promise.resolve(false);
    }

    var openedCount = 0;
    var blockedCount = 0;

    var tasks = list.map(function(row){
      var type = typeForRow(row);
      var message = messageFor(row, type, "mail");
      var url = outlookUrlFor(row, type, message);

      if(!url || url.length > 120000){
        blockedCount += 1;
        return Promise.resolve(false);
      }

      return openExternal(url).then(function(opened){
        if(opened){
          openedCount += 1;

          recordPrepared(
            row,
            "mail",
            type,
            message,
            preferredEmail(row)
          );

          return true;
        }

        blockedCount += 1;
        return false;
      });
    });

    return Promise.all(tasks).then(function(){
      if(
        window.TablaMessageCounter &&
        typeof window.TablaMessageCounter.render === "function"
      ){
        window.TablaMessageCounter.render();
      }

      status(
        openedCount + " correos preparados en Outlook" +
        (
          blockedCount
            ? " · " + blockedCount + " no disponibles/bloqueados."
            : "."
        ),
        blockedCount ? "warn" : "ok"
      );

      return openedCount > 0;
    });
  }

  function syncTelegramMassType(){
    var field = el("tabla-mass-tipo");
    if(!field){ return false; }

    var wanted = globalType || "requisitos";
    field.value = wanted;

    if(field.value !== wanted){
      field.value = "requisitos";
    }

    try{
      field.dispatchEvent(
        new Event(
          "change",
          {bubbles:true}
        )
      );
    }catch(error){
      try{
        var legacyEvent = document.createEvent("Event");
        legacyEvent.initEvent("change", true, true);
        field.dispatchEvent(legacyEvent);
      }catch(legacyError){}
    }

    return true;
  }

  function openTelegramMass(){
    if(
      window.TablaApp &&
      typeof window.TablaApp.openMass === "function"
    ){
      var opened = window.TablaApp.openMass();

      if(opened){
        syncTelegramMassType();
      }

      return opened;
    }

    status("No está disponible Telegram masivo.", "warn");
    return false;
  }

  function bindVisibleOverrides(){
    var wrap = el("tabla-table-wrap");

    if(!wrap || wrap.getAttribute("data-bulk-message-bound") === "1"){
      return;
    }

    wrap.setAttribute("data-bulk-message-bound", "1");

    wrap.addEventListener("change", function(event){
      if(
        !event.target ||
        !event.target.classList ||
        !event.target.classList.contains("tabla-message-select")
      ){
        return;
      }

      var tableRow = event.target.closest("tr");
      if(!tableRow){ return; }

      var index = Number(tableRow.getAttribute("data-row-index"));
      var row = (appState().rows || [])[index];

      if(row){
        rowOverrides[rowId(row)] = event.target.value;
      }
    });
  }

  function bind(){
    if(bound){ return; }
    bound = true;

    var typeSelect = el("tabla-global-message-type");
    var wa = el("tabla-bulk-whatsapp");
    var mail = el("tabla-bulk-outlook");
    var tg = el("tabla-bulk-telegram");

    if(typeSelect){
      globalType = text(typeSelect.value) || "requisitos";
      typeSelect.addEventListener("change", function(){
        applyGlobal();
      });
    }

    if(wa){ wa.addEventListener("click", openAllWhatsApp); }
    if(mail){ mail.addEventListener("click", openAllOutlook); }
    if(tg){ tg.addEventListener("click", openTelegramMass); }

    bindVisibleOverrides();

    window.addEventListener("tabla:rendered", function(){
      bindVisibleOverrides();
      syncVisibleSelects();
      renderMetrics();
    });

    window.addEventListener("tabla:stage-filter-changed", function(){
      window.setTimeout(renderMetrics, 30);
    });

    renderMetrics();
  }

  function boot(){
    bind();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.TablaBulk = {
    version: VERSION,
    metrics: metrics,
    render: renderMetrics,
    rows: rows,
    applyGlobal: applyGlobal,
    openAllWhatsApp: openAllWhatsApp,
    openAllOutlook: openAllOutlook,
    openOutlookGlobal: openAllOutlook,
    openTelegramMass: openTelegramMass,
    syncTelegramMassType: syncTelegramMassType,
    getGlobalType: function(){ return globalType; },
    setGlobalType: function(type){
      globalType = text(type) || "requisitos";
      var select = el("tabla-global-message-type");
      if(select){ select.value = globalType; }
      return globalType;
    }
  };
})(window, document);

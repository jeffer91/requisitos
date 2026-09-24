/* =========================================================
Nombre completo: tabla.bulk.js
Ruta: /Gestion/Tabla/communication/tabla.bulk.js
Función:
- Centralizar acciones simples sobre todos los estudiantes filtrados.
- Aplicar un tipo de mensaje global a las filas visibles.
- Abrir WhatsApp para todos los filtrados con número válido.
- Abrir un único correo global en Outlook Web usando CCO.
- Reutilizar Telegram masivo e historial existentes.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.0.0-simple-bulk-communications";
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

  function recordMany(list, channel, type, message, destinationFor){
    if(
      !window.TablaHistory ||
      typeof window.TablaHistory.guardarVarios !== "function"
    ){
      return [];
    }

    var records = list.map(function(row){
      var data = studentData(row);
      return {
        canal: channel,
        modo: "global",
        accion: "abierto",
        tipoMensaje: typeForRow(row) || type,
        tipoLabel: typeLabel(typeForRow(row) || type),
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
        mensaje: message || "",
        estado: "preparado",
        destino: typeof destinationFor === "function" ? destinationFor(row) : ""
      };
    });

    return window.TablaHistory.guardarVarios(records);
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

          if(
            window.TablaHistory &&
            typeof window.TablaHistory.guardar === "function"
          ){
            var data = studentData(row);
            window.TablaHistory.guardar({
              canal:"whatsapp",
              modo:"masivo",
              accion:"abierto",
              tipoMensaje:type,
              tipoLabel:typeLabel(type),
              cedula:data.cedula || row._cedula || "",
              nombre:data.nombre || row._nombres || "",
              carrera:data.carrera || row._carrera || "",
              periodo:data.periodo || row._periodo || "",
              periodoId:data.periodoId || row._periodoId || "",
              telefono:result.phone || "",
              destino:result.phone || "",
              mensaje:message,
              estado:"preparado"
            });
          }
        }else{
          blocked += 1;
        }
      }catch(error){
        blocked += 1;
      }
    });

    if(window.TablaMessageCounter && typeof window.TablaMessageCounter.render === "function"){
      window.TablaMessageCounter.render();
    }

    status(
      openedRows.length + " WhatsApp preparados" +
      (blocked ? " · " + blocked + " bloqueados/no disponibles." : "."),
      blocked ? "warn" : "ok"
    );

    return openedRows.length > 0;
  }

  function unique(values){
    var seen = Object.create(null);
    var out = [];

    (Array.isArray(values) ? values : []).forEach(function(value){
      value = text(value).toLowerCase();
      if(!value || seen[value]){ return; }
      seen[value] = true;
      out.push(value);
    });

    return out;
  }

  function globalSubject(type, current){
    var label = typeLabel(type);
    var period = text(current.periodLabel || current.periodId);

    if(type === "perdio"){
      return "Proceso de titulación perdido" + (period ? " - " + period : "");
    }

    if(type === "ultimo"){
      return "Último aviso - proceso de titulación" + (period ? " - " + period : "");
    }

    if(type === "urgente"){
      return "Aviso urgente - proceso de titulación" + (period ? " - " + period : "");
    }

    return label + " - proceso de titulación" + (period ? " - " + period : "");
  }

  function globalBody(type, current){
    var period = text(current.periodLabel || current.periodId) || "el período seleccionado";
    var career = text(current.career);
    var intro;

    if(type === "perdio"){
      intro = "Se informa que, según la revisión registrada, su proceso de titulación consta como no aprobado o perdido en el período indicado. Debe comunicarse para recibir orientación sobre los siguientes pasos.";
    }else if(type === "ultimo"){
      intro = "Este mensaje corresponde a un último aviso de regularización. Revise de manera inmediata los requisitos pendientes registrados en su proceso.";
    }else if(type === "urgente"){
      intro = "Su proceso requiere atención urgente. Revise y regularice los requisitos pendientes para evitar afectar la continuidad del proceso de titulación.";
    }else if(type === "regularizar" || type === "requisitos"){
      intro = "En la etapa actual deben encontrarse completos Documentación académica, Prácticas preprofesionales, Vinculación con la sociedad, Segunda lengua/Inglés, Seguimiento a graduados y Actualización de datos. Académico, Financiero y Titulación corresponden a etapas posteriores.";
    }else if(type === "no_aprueba" || type === "noaprueba"){
      intro = "Se registra que actualmente no cumple con las condiciones mínimas de aprobación del proceso de titulación. Revise su situación de forma inmediata.";
    }else{
      intro = "Desde el área de Titulación se informa que existen novedades que requieren su revisión dentro del proceso.";
    }

    return [
      "Estimado/a estudiante:",
      "",
      intro,
      "",
      "Período: " + period,
      career ? "Carrera: " + career : "",
      "",
      "Por favor, revise su información y atienda las indicaciones correspondientes.",
      "",
      "Saludos cordiales,",
      "Mgs. Jefferson Villarreal",
      "Coordinador de Titulación"
    ].filter(function(line, index, all){
      return line !== "" || all[index - 1] !== "";
    }).join("\n");
  }

  function outlookUrl(addresses, subject, body){
    var query = [
      "bcc=" + encodeURIComponent(addresses.join(";")),
      "subject=" + encodeURIComponent(subject),
      "body=" + encodeURIComponent(body)
    ];

    return "https://outlook.office.com/mail/deeplink/compose?" + query.join("&");
  }

  function openExternal(url){
    try{
      if(
        window.top &&
        window.top.electronAPI &&
        typeof window.top.electronAPI.openExternal === "function"
      ){
        return Promise.resolve(window.top.electronAPI.openExternal(url))
          .then(function(){ return true; })
          .catch(function(){ return false; });
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

  function openOutlookGlobal(){
    var list = rows();
    var validRows = list.filter(function(row){
      return !!preferredEmail(row);
    });

    var addresses = unique(validRows.map(preferredEmail));

    if(!addresses.length){
      status("No hay correos válidos en los estudiantes filtrados.", "warn");
      return Promise.resolve(false);
    }

    var current = appState();
    var type = globalType || "requisitos";
    var subject = globalSubject(type, current);
    var body = globalBody(type, current);
    var url = outlookUrl(addresses, subject, body);

    if(url.length > 120000){
      status(
        "El correo global es demasiado grande para Outlook Web. Reduzca los filtros.",
        "warn"
      );
      return Promise.resolve(false);
    }

    return openExternal(url).then(function(opened){
      if(!opened){
        status("No se pudo abrir Outlook Web.", "warn");
        return false;
      }

      recordMany(validRows, "mail", type, body, preferredEmail);

      if(window.TablaMessageCounter && typeof window.TablaMessageCounter.render === "function"){
        window.TablaMessageCounter.render();
      }

      status(
        "Outlook abierto con " + addresses.length + " destinatarios en CCO.",
        "ok"
      );

      return true;
    });
  }

  function openTelegramMass(){
    if(window.TablaApp && typeof window.TablaApp.openMass === "function"){
      return window.TablaApp.openMass();
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
    var apply = el("tabla-global-apply");
    var wa = el("tabla-bulk-whatsapp");
    var mail = el("tabla-bulk-outlook");
    var tg = el("tabla-bulk-telegram");

    if(typeSelect){
      globalType = text(typeSelect.value) || "requisitos";
      typeSelect.addEventListener("change", function(){
        applyGlobal();
      });
    }

    if(apply){ apply.addEventListener("click", applyGlobal); }
    if(wa){ wa.addEventListener("click", openAllWhatsApp); }
    if(mail){ mail.addEventListener("click", openOutlookGlobal); }
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
    openOutlookGlobal: openOutlookGlobal,
    openTelegramMass: openTelegramMass,
    getGlobalType: function(){ return globalType; },
    setGlobalType: function(type){
      globalType = text(type) || "requisitos";
      var select = el("tabla-global-message-type");
      if(select){ select.value = globalType; }
      return globalType;
    }
  };
})(window, document);

/* =========================================================
Nombre completo: tabla.actions.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/communication/tabla.actions.js
Función o funciones:
- Completar las acciones de cada fila sin reconstruir toda la tabla.
- Coordinar WhatsApp, correo y Telegram individual.
- Mostrar contadores y último contacto desde el historial.
- Mantener los botones funcionales después de cada render.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION =
    "2.1.0-stable-actions";

  var C =
    window.TablaConstants ||
    {};

  var U =
    window.TablaUtils ||
    {};

  var booted = false;
  var enhancing = false;
  var enhanceTimer = null;

  function el(id){
    return document
      .getElementById(id);
  }

  function text(value){
    return U.text
      ? U.text(value)
      : String(
          value == null
            ? ""
            : value
        ).trim();
  }

  function esc(value){
    return U.escapeHtml
      ? U.escapeHtml(value)
      : text(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#039;");
  }

  function status(message, type){
    if(
      window.TablaRenderSummary &&
      typeof window
        .TablaRenderSummary
        .status === "function"
    ){
      window.TablaRenderSummary
        .status(
          message,
          type || ""
        );

      return;
    }

    var box =
      el("tabla-status");

    if(box){
      box.textContent =
        text(message);

      box.className =
        "tabla-status" +
        (
          type
            ? " " + type
            : ""
        );
    }
  }

  function messageTypes(){
    var configured =
      Array.isArray(
        C.messageTypes
      )
        ? C.messageTypes
        : [];

    if(configured.length){
      return configured.map(
        function(item){
          return {
            value:
              text(item.value),

            label:
              text(item.label)
          };
        }
      );
    }

    return [
      {
        value:
          "requisitos",

        label:
          "Falta req."
      },
      {
        value:
          "urgente",

        label:
          "Urgente"
      },
      {
        value:
          "ultimo",

        label:
          "Último aviso"
      },
      {
        value:
          "regularizar",

        label:
          "Regularizar"
      },
      {
        value:
          "nota_articulo",

        label:
          "Falta N-Art"
      },
      {
        value:
          "nota_defensa",

        label:
          "Falta N-Def"
      },
      {
        value:
          "sin_articulo",

        label:
          "Sin artículo"
      },
      {
        value:
          "no_aprueba",

        label:
          "No aprueba"
      },
      {
        value:
          "perdio",

        label:
          "Perdió"
      },
      {
        value:
          "alerta",

        label:
          "Alerta"
      },
      {
        value:
          "cronograma",

        label:
          "Cronograma"
      },
      {
        value:
          "libre",

        label:
          "Personal"
      }
    ];
  }

  function appState(){
    return (
      window.TablaApp &&
      typeof window
        .TablaApp
        .getState === "function"
    )
      ? window.TablaApp
          .getState()
      : {
          rows: []
        };
  }

  function rowIndexFromNode(node){
    var row =
      node &&
      node.closest
        ? node.closest("tr")
        : null;

    if(!row){
      return -1;
    }

    var raw =
      row.getAttribute(
        "data-row-index"
      );

    var parsed =
      Number(raw);

    if(
      raw !== null &&
      !isNaN(parsed)
    ){
      return parsed;
    }

    if(!row.parentNode){
      return -1;
    }

    return Array.prototype
      .indexOf
      .call(
        row.parentNode.children,
        row
      );
  }

  function rowFor(node){
    var index =
      rowIndexFromNode(node);

    return (
      appState().rows ||
      []
    )[index] || null;
  }

  function typeFor(node){
    var row =
      node &&
      node.closest
        ? node.closest("tr")
        : null;

    var select =
      row
        ? row.querySelector(
            ".tabla-message-select"
          )
        : null;

    return select
      ? select.value
      : "requisitos";
  }

  function option(
    value,
    label,
    selected
  ){
    return (
      '<option value="' +
      esc(value) +
      '"' +
      (
        selected
          ? " selected"
          : ""
      ) +
      ">" +
      esc(label) +
      "</option>"
    );
  }

  function fillSelect(select){
    if(
      !select ||
      select.getAttribute(
        "data-actions-ready"
      ) === "1"
    ){
      return;
    }

    select.innerHTML =
      messageTypes()
        .map(function(item){
          return option(
            item.value,
            item.label,
            item.value ===
              "requisitos"
          );
        })
        .join("");

    select.setAttribute(
      "data-actions-ready",
      "1"
    );
  }

  function emptyCounts(){
    return {
      wa: 0,
      whatsapp: 0,
      tg: 0,
      telegram: 0,
      email: 0,
      mail: 0,
      total: 0
    };
  }

  function counts(row){
    if(
      window.TablaHistory &&
      typeof window
        .TablaHistory
        .countsForStudent ===
        "function"
    ){
      return (
        window.TablaHistory
          .countsForStudent(row) ||
        emptyCounts()
      );
    }

    return emptyCounts();
  }

  function lastLabel(row){
    if(
      window.TablaHistory &&
      typeof window
        .TablaHistory
        .lastLabel ===
        "function"
    ){
      return (
        window.TablaHistory
          .lastLabel(row) ||
        "—"
      );
    }

    return "—";
  }

  function safeCounts(row){
    try{
      return (
        counts(row) ||
        emptyCounts()
      );
    }catch(error){
      return emptyCounts();
    }
  }

  function safeLastLabel(row){
    try{
      return (
        lastLabel(row) ||
        "—"
      );
    }catch(error){
      return "—";
    }
  }

  function channelButton(
    channel,
    count,
    disabled,
    title
  ){
    var className =
      channel === "WA"
        ? "action-whats"
        : channel === "TG"
          ? "action-telegram"
          : "action-mail";

    return (
      '<button class="tabla-channel ' +
      className +
      '" type="button"' +
      (
        disabled
          ? " disabled"
          : ""
      ) +
      ' data-action-channel="' +
      esc(channel) +
      '" title="' +
      esc(title || channel) +
      '">' +
      esc(channel) +
      " <small>" +
      esc(count || 0) +
      "</small></button>"
    );
  }

  function setCellHtml(
    cell,
    html
  ){
    if(
      cell &&
      cell.innerHTML !== html
    ){
      cell.innerHTML = html;
    }
  }

  function whatsappAvailable(row){
    try{
      if(
        window.TablaWhatsApp &&
        typeof window
          .TablaWhatsApp
          .available === "function"
      ){
        return !!window.TablaWhatsApp
          .available(row);
      }
    }catch(error){}

    return !!text(
      row &&
      row._celular
    );
  }

  function emailAvailable(row){
    try{
      if(
        window.TablaEmail &&
        typeof window
          .TablaEmail
          .available === "function"
      ){
        return !!window.TablaEmail
          .available(row);
      }
    }catch(error){}

    return !!text(
      row &&
      row._correo
    );
  }

  function enhanceRow(
    tableRow,
    row
  ){
    if(
      !row ||
      !tableRow ||
      !tableRow.children ||
      tableRow.children.length < 8
    ){
      return false;
    }

    fillSelect(
      tableRow.querySelector(
        ".tabla-message-select"
      )
    );

    var currentCounts =
      safeCounts(row);

    var last =
      safeLastLabel(row);

    setCellHtml(
      tableRow.children[4],
      '<span class="tabla-last-message" title="' +
      esc(last) +
      '">' +
      esc(last) +
      "</span>"
    );

    setCellHtml(
      tableRow.children[5],
      channelButton(
        "WA",
        currentCounts.wa ||
        currentCounts.whatsapp ||
        0,
        !whatsappAvailable(row),
        "Abrir WhatsApp"
      )
    );

    setCellHtml(
      tableRow.children[6],
      channelButton(
        "TG",
        currentCounts.tg ||
        currentCounts.telegram ||
        0,
        false,
        "Abrir Telegram"
      )
    );

    setCellHtml(
      tableRow.children[7],
      channelButton(
        "Mail",
        currentCounts.email ||
        currentCounts.mail ||
        0,
        !emailAvailable(row),
        "Preparar correo"
      )
    );

    tableRow.setAttribute(
      "data-actions-ready",
      "1"
    );

    return true;
  }

  function enhanceNow(){
    bindTable();

    var wrap =
      el("tabla-table-wrap");

    var rows =
      appState().rows ||
      [];

    if(
      !wrap ||
      enhancing
    ){
      return false;
    }

    enhancing = true;

    try{
      try{
        if(
          window.TablaHistory &&
          typeof window
            .TablaHistory
            .preloadForRows ===
            "function"
        ){
          var preload =
            window.TablaHistory
              .preloadForRows(rows);

          if(
            preload &&
            typeof preload.catch ===
              "function"
          ){
            preload.catch(function(){
              return null;
            });
          }
        }
      }catch(preloadError){}

      var tableRows =
        wrap.querySelectorAll(
          "tbody tr"
        );

      Array.prototype
        .forEach
        .call(
          tableRows,
          function(
            tableRow,
            index
          ){
            try{
              enhanceRow(
                tableRow,
                rows[index]
              );
            }catch(rowError){
              tableRow.setAttribute(
                "data-actions-ready",
                "0"
              );

              if(
                window.console &&
                console.warn
              ){
                console.warn(
                  "[TablaActions] No se pudo completar una fila.",
                  rowError
                );
              }
            }
          }
        );

      return true;
    }catch(error){
      if(
        window.console &&
        console.warn
      ){
        console.warn(
          "[TablaActions] No se pudieron completar las filas.",
          error
        );
      }

      return false;
    }finally{
      enhancing = false;
    }
  }

  function enhance(delay){
    if(enhanceTimer){
      window.clearTimeout(
        enhanceTimer
      );
    }

    enhanceTimer =
      window.setTimeout(
        function(){
          enhanceTimer = null;
          enhanceNow();
        },
        typeof delay === "number"
          ? delay
          : 40
      );
  }

  function messageFor(row, type){
    if(
      window.TablaMessage &&
      typeof window
        .TablaMessage
        .generarMensaje ===
        "function"
    ){
      return window.TablaMessage
        .generarMensaje(
          row,
          type,
          {
            texto: ""
          }
        );
    }

    return (
      "Saludos, " +
      (
        row &&
        row._nombres
          ? row._nombres
          : "estudiante"
      ) +
      ". Desde el área de Titulación se informa que existen novedades en su proceso."
    );
  }

  function typeLabel(type){
    if(
      window.TablaMessage &&
      typeof window
        .TablaMessage
        .tipoLabel ===
        "function"
    ){
      return window.TablaMessage
        .tipoLabel(type);
    }

    var found =
      messageTypes()
        .filter(function(item){
          return (
            item.value === type
          );
        })[0];

    return found
      ? found.label
      : text(type);
  }

  function studentData(row){
    if(
      window.TablaMessage &&
      typeof window
        .TablaMessage
        .datosEstudiante ===
        "function"
    ){
      return (
        window.TablaMessage
          .datosEstudiante(row) ||
        {}
      );
    }

    return {
      cedula:
        row &&
        row._cedula,

      nombre:
        row &&
        row._nombres,

      carrera:
        row &&
        row._carrera,

      periodo:
        row &&
        row._periodo,

      periodoId:
        row &&
        row._periodoId,

      correo:
        row &&
        row._correo,

      celular:
        row &&
        row._celular
    };
  }

  function recordExternal(
    row,
    channel,
    type,
    message,
    result
  ){
    if(
      !window.TablaHistory ||
      typeof window
        .TablaHistory
        .guardar !== "function"
    ){
      return null;
    }

    var data =
      studentData(row);

    return window.TablaHistory
      .guardar({
        canal:
          channel,

        modo:
          "individual",

        accion:
          "abierto",

        tipoMensaje:
          type,

        tipoLabel:
          typeLabel(type),

        cedula:
          data.cedula ||
          row._cedula ||
          "",

        nombre:
          data.nombre ||
          row._nombres ||
          "",

        carrera:
          data.carrera ||
          row._carrera ||
          "",

        periodo:
          data.periodo ||
          row._periodo ||
          "",

        periodoId:
          data.periodoId ||
          row._periodoId ||
          "",

        correo:
          data.correo ||
          row._correo ||
          "",

        telefono:
          data.celular ||
          row._celular ||
          "",

        telegramUser:
          row._telegramUser ||
          "",

        telegramChatId:
          row._telegramChatId ||
          "",

        mensaje:
          message,

        estado:
          "preparado",

        destino:
          result &&
          (
            result.address ||
            result.phone ||
            ""
          )
      });
  }

  function markBusy(
    button,
    busy
  ){
    if(!button){
      return;
    }

    button.setAttribute(
      "data-action-busy",
      busy
        ? "1"
        : "0"
    );

    button.disabled =
      !!busy;
  }

  function isBusy(button){
    return !!(
      button &&
      button.getAttribute(
        "data-action-busy"
      ) === "1"
    );
  }

  function handleClick(event){
    var button =
      event.target &&
      event.target.closest
        ? event.target.closest(
            "[data-action-channel]"
          )
        : null;

    if(
      !button ||
      button.disabled ||
      isBusy(button)
    ){
      return;
    }

    var row =
      rowFor(button);

    if(!row){
      status(
        "No se pudo identificar al estudiante.",
        "warn"
      );

      return;
    }

    var channel =
      button.getAttribute(
        "data-action-channel"
      );

    var type =
      typeFor(button);

    var message =
      messageFor(
        row,
        type
      );

    markBusy(
      button,
      true
    );

    try{
      if(channel === "WA"){
        if(
          !window.TablaWhatsApp ||
          typeof window
            .TablaWhatsApp
            .open !== "function"
        ){
          throw new Error(
            "No está disponible el módulo de WhatsApp."
          );
        }

        var whatsappResult =
          window.TablaWhatsApp
            .open(
              row,
              message
            );

        if(
          whatsappResult &&
          whatsappResult.ok
        ){
          recordExternal(
            row,
            "whatsapp",
            type,
            message,
            whatsappResult
          );
        }

        status(
          whatsappResult &&
          whatsappResult.message
            ? whatsappResult.message
            : "No se pudo abrir WhatsApp.",

          whatsappResult &&
          whatsappResult.ok
            ? "ok"
            : "warn"
        );
      }else if(
        channel === "Mail"
      ){
        if(
          !window.TablaEmail ||
          typeof window
            .TablaEmail
            .open !== "function"
        ){
          throw new Error(
            "No está disponible el módulo de correo."
          );
        }

        var emailResult =
          window.TablaEmail
            .open(
              row,
              type,
              message
            );

        if(
          emailResult &&
          emailResult.ok
        ){
          recordExternal(
            row,
            "mail",
            type,
            message,
            emailResult
          );
        }

        status(
          emailResult &&
          emailResult.message
            ? emailResult.message
            : "No se pudo abrir el correo.",

          emailResult &&
          emailResult.ok
            ? "ok"
            : "warn"
        );
      }else if(
        channel === "TG"
      ){
        if(
          !window.TablaTelegram ||
          typeof window
            .TablaTelegram
            .abrir !== "function"
        ){
          throw new Error(
            "No está disponible Telegram individual."
          );
        }

        window.TablaTelegram
          .abrir(
            row,
            type
          );

        status(
          "Telegram preparado para revisión.",
          "ok"
        );
      }
    }catch(error){
      if(
        window.console &&
        console.error
      ){
        console.error(
          "[TablaActions]",
          error
        );
      }

      status(
        error &&
        error.message
          ? error.message
          : "No se pudo preparar la acción.",
        "warn"
      );
    }finally{
      markBusy(
        button,
        false
      );

      enhance(120);
    }
  }

  function bindTable(){
    var wrap =
      el("tabla-table-wrap");

    if(!wrap){
      return false;
    }

    if(
      wrap.getAttribute(
        "data-tabla-actions-bound"
      ) === "1"
    ){
      return true;
    }

    wrap.setAttribute(
      "data-tabla-actions-bound",
      "1"
    );

    wrap.addEventListener(
      "click",
      handleClick
    );

    wrap.addEventListener(
      "change",
      function(event){
        if(
          event.target &&
          event.target.classList &&
          event.target.classList
            .contains(
              "tabla-message-select"
            )
        ){
          enhance(50);
        }
      }
    );

    return true;
  }

  function boot(){
    bindTable();

    if(booted){
      enhance(0);
      return;
    }

    booted = true;

    window.addEventListener(
      (
        C.events &&
        C.events.rendered
      ) ||
      "tabla:rendered",
      function(){
        bindTable();
        enhance(0);
      }
    );

    window.addEventListener(
      (
        C.events &&
        C.events.historyUpdated
      ) ||
      "tabla:history-updated",
      function(){
        enhance(50);
      }
    );

    window.addEventListener(
      "requisitos:bl:snapshot-changed",
      function(){
        enhance(100);
      }
    );

    window.addEventListener(
      "bdlocal:conexiones-cache-updated",
      function(){
        enhance(100);
      }
    );

    enhance(0);
  }

  if(
    document.readyState ===
    "loading"
  ){
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  }else{
    boot();
  }

  window.TablaActions = {
    version:
      VERSION,

    boot:
      boot,

    enhance:
      enhance,

    enhanceNow:
      enhanceNow,

    types:
      messageTypes,

    rowFor:
      rowFor,

    typeFor:
      typeFor
  };
})(window, document);
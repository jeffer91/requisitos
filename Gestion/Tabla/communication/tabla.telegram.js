/* =========================================================
Nombre completo: tabla.telegram.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/communication/tabla.telegram.js
Función o funciones:
- Controlar el modal de Telegram individual.
- Generar, copiar y abrir mensajes sin crear falsos envíos.
- Enviar por bot una sola vez y registrar únicamente el resultado real.
Con qué se conecta:
- tabla.utils.js
- tabla.data-normalizer.js
- tabla.message.js
- tabla.telegram-api.js
- tabla.history.js
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "2.0.0";
  var U = window.TablaUtils || {};
  var N =
    window.TablaDataNormalizer ||
    {};

  var state = {
    row:
      null,

    type:
      "requisitos",

    sending:
      false,

    bound:
      false,

    lastMessageId:
      null
  };

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
          .replace(
            /&/g,
            "&amp;"
          )
          .replace(
            /</g,
            "&lt;"
          )
          .replace(
            />/g,
            "&gt;"
          )
          .replace(
            /\"/g,
            "&quot;"
          )
          .replace(
            /'/g,
            "&#039;"
          );
  }

  function status(
    message,
    type
  ){
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

  function info(row){
    row = row || {};

    if(N.telegramInfo){
      var normalized =
        N.telegramInfo(row);

      return {
        user:
          text(
            normalized.user ||
            normalized.username
          ),

        chatId:
          text(
            normalized.chatId
          ),

        hasTelegram:
          !!normalized
            .hasTelegram,

        canSendByBot:
          !!(
            normalized.canBot ||
            normalized
              .canSendByBot ||
            normalized.hasChatId
          )
      };
    }

    var user =
      text(
        row._telegramUser ||
        row.telegramUser ||
        row.usuarioTelegram ||
        row.telegram
      ).replace(
        /^@+/,
        ""
      );

    var chatId =
      text(
        row._telegramChatId ||
        row.telegramChatId ||
        row.chatIdTelegram ||
        row.chatId
      );

    return {
      user:
        user,

      chatId:
        chatId,

      hasTelegram:
        !!(
          user ||
          chatId
        ),

      canSendByBot:
        !!chatId
    };
  }

  function telegramUrl(row){
    var current =
      info(row);

    if(current.user){
      return (
        "https://t.me/" +
        encodeURIComponent(
          current.user
        )
      );
    }

    if(current.chatId){
      return (
        "tg://user?id=" +
        encodeURIComponent(
          current.chatId
        )
      );
    }

    return "";
  }

  function studentData(row){
    row = row || {};

    if(
      window.TablaMessage &&
      typeof window
        .TablaMessage
        .datosEstudiante ===
        "function"
    ){
      return window.TablaMessage
        .datosEstudiante(row);
    }

    return {
      nombre:
        text(row._nombres) ||
        "estudiante",

      cedula:
        text(row._cedula),

      carrera:
        text(row._carrera),

      periodo:
        text(row._periodo),

      periodoId:
        text(row._periodoId)
    };
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

    return (
      text(type) ||
      "requisitos"
    );
  }

  function currentType(){
    var select =
      el("tabla-tg-tipo");

    state.type =
      select
        ? select.value
        : state.type;

    return state.type;
  }

  function customText(){
    var field =
      el("tabla-tg-texto");

    return field
      ? field.value
      : "";
  }

  function generateMessage(){
    if(!state.row){
      return "";
    }

    if(
      window.TablaMessage &&
      typeof window
        .TablaMessage
        .generarMensaje ===
        "function"
    ){
      return window.TablaMessage
        .generarMensaje(
          state.row,
          currentType(),
          {
            texto:
              customText()
          }
        );
    }

    return (
      customText() ||
      "Saludos. Desde el área de Titulación se informa que existen novedades en su proceso."
    );
  }

  function recordHistory(
    statusValue,
    error,
    messageId,
    message
  ){
    if(
      !state.row ||
      !window.TablaHistory ||
      typeof window
        .TablaHistory
        .guardar !==
        "function"
    ){
      return null;
    }

    var data =
      studentData(
        state.row
      );

    var telegram =
      info(state.row);

    return window.TablaHistory
      .guardar({
        canal:
          "telegram",

        modo:
          "individual",

        accion:
          "bot",

        tipoMensaje:
          state.type,

        tipoLabel:
          typeLabel(
            state.type
          ),

        cedula:
          data.cedula ||
          state.row._cedula ||
          "",

        nombre:
          data.nombre ||
          state.row._nombres ||
          "",

        carrera:
          data.carrera ||
          state.row._carrera ||
          "",

        periodo:
          data.periodo ||
          state.row._periodo ||
          "",

        periodoId:
          data.periodoId ||
          state.row._periodoId ||
          "",

        telegramUser:
          telegram.user,

        telegramChatId:
          telegram.chatId,

        mensaje:
          message ||
          generateMessage(),

        estado:
          statusValue,

        error:
          error || "",

        telegramMessageId:
          messageId || null
      });
  }

  function updateInfo(){
    if(!state.row){
      return;
    }

    var data =
      studentData(
        state.row
      );

    var telegram =
      info(state.row);

    var title =
      el("tabla-tg-title");

    var meta =
      el("tabla-tg-meta");

    var dataBox =
      el("tabla-tg-dato");

    var warning =
      el("tabla-tg-warning");

    var send =
      el("tabla-tg-send");

    var close =
      el("tabla-tg-close");

    var cancel =
      el("tabla-tg-cancel");

    var open =
      el("tabla-tg-open");

    if(title){
      title.textContent =
        "Telegram individual";
    }

    if(meta){
      meta.innerHTML =
        "<strong>" +
        esc(data.nombre) +
        "</strong> · " +
        esc(
          data.cedula ||
          "Sin cédula"
        ) +
        " · " +
        esc(
          data.carrera ||
          "Sin carrera"
        ) +
        " · " +
        esc(
          data.periodo ||
          "Sin período"
        );
    }

    if(dataBox){
      dataBox.textContent =
        telegram.chatId
          ? (
              "Chat ID: " +
              telegram.chatId
            )
          : telegram.user
            ? (
                "Usuario: @" +
                telegram.user
              )
            : "Sin Telegram registrado";
    }

    if(warning){
      if(state.sending){
        warning.textContent =
          "El mensaje se está enviando. No cierre esta ventana.";
      }else if(
        telegram.canSendByBot
      ){
        warning.textContent =
          "Listo para envío por bot. El contador aumentará solo cuando Telegram confirme el envío.";
      }else if(telegram.user){
        warning.textContent =
          "Tiene usuario, pero no chatId. Puede copiar y abrir el perfil; esto no se contará como envío confirmado.";
      }else{
        warning.textContent =
          "Este estudiante no tiene Telegram registrado. Puede copiar la vista previa para utilizarla en otro canal.";
      }
    }

    if(send){
      send.disabled =
        !telegram.canSendByBot ||
        state.sending;

      send.textContent =
        state.sending
          ? "Enviando..."
          : "Enviar por bot";
    }

    if(open){
      open.disabled =
        state.sending;
    }

    if(close){
      close.disabled =
        state.sending;
    }

    if(cancel){
      cancel.disabled =
        state.sending;
    }
  }

  function updatePreview(){
    var preview =
      el("tabla-tg-preview");

    if(preview){
      preview.value =
        generateMessage();
    }
  }

  async function copyMessage(){
    var message =
      generateMessage();

    if(!message){
      status(
        "El mensaje está vacío.",
        "warn"
      );

      return "";
    }

    try{
      if(U.copyText){
        await U.copyText(
          message
        );
      }else if(
        window.navigator &&
        window.navigator.clipboard &&
        window.navigator.clipboard
          .writeText
      ){
        await window.navigator
          .clipboard
          .writeText(message);
      }else{
        throw new Error(
          "No está disponible el portapapeles."
        );
      }

      status(
        "Mensaje de Telegram copiado. No se registró como enviado.",
        "ok"
      );

      return message;
    }catch(error){
      status(
        error &&
        error.message
          ? error.message
          : "No se pudo copiar el mensaje.",
        "warn"
      );

      return "";
    }
  }

  async function openTelegram(){
    if(!state.row){
      return false;
    }

    var link =
      telegramUrl(
        state.row
      );

    var copied =
      await copyMessage();

    if(!link){
      status(
        copied
          ? "El estudiante no tiene Telegram registrado. El mensaje quedó copiado."
          : "El estudiante no tiene Telegram registrado.",
        "warn"
      );

      return false;
    }

    var opened =
      U.openWindow
        ? U.openWindow(link)
        : !!window.open(
            link,
            "_blank",
            "noopener,noreferrer"
          );

    status(
      opened
        ? "Telegram abierto y mensaje copiado. No se contará hasta que el bot confirme un envío."
        : "El navegador bloqueó la apertura de Telegram.",
      opened
        ? "ok"
        : "warn"
    );

    return opened;
  }

  async function sendByBot(){
    if(
      !state.row ||
      state.sending
    ){
      return null;
    }

    var telegram =
      info(state.row);

    var message =
      generateMessage();

    var data =
      studentData(
        state.row
      );

    if(!telegram.chatId){
      status(
        "No se puede enviar por bot: falta chatId de Telegram.",
        "warn"
      );

      return null;
    }

    if(!text(message)){
      status(
        "El mensaje está vacío.",
        "warn"
      );

      return null;
    }

    if(
      !window.TablaTelegramApi ||
      typeof window
        .TablaTelegramApi
        .enviarMensajeTelegram !==
        "function"
    ){
      status(
        "No está disponible la API segura de Telegram.",
        "warn"
      );

      return null;
    }

    if(
      typeof window.confirm ===
        "function" &&
      !window.confirm(
        "¿Enviar este mensaje por Telegram a " +
        (
          data.nombre ||
          "estudiante"
        ) +
        "?"
      )
    ){
      return null;
    }

    state.sending = true;
    updateInfo();

    status(
      "Enviando Telegram a " +
      (
        data.nombre ||
        "estudiante"
      ) +
      "...",
      ""
    );

    try{
      var result =
        await window
          .TablaTelegramApi
          .enviarMensajeTelegram(
            telegram.chatId,
            message,
            {
              retries:
                2,

              onRetry:
                function(retry){
                  status(
                    "Telegram solicitó una pausa. Reintento automático en " +
                    Math.ceil(
                      retry.delayMs /
                      1000
                    ) +
                    " segundo(s).",
                    "warn"
                  );
                }
            }
          );

      var messageId =
        result &&
        (
          result.telegramMessageId ||
          result.messageId ||
          (
            result.result &&
            result.result
              .message_id
          )
        );

      state.lastMessageId =
        messageId || null;

      recordHistory(
        "enviado",
        "",
        messageId,
        message
      );

      status(
        "Mensaje enviado por Telegram a " +
        (
          data.nombre ||
          "estudiante"
        ) +
        ".",
        "ok"
      );

      return result;
    }catch(error){
      recordHistory(
        "fallido",
        error &&
        error.message
          ? error.message
          : String(error),
        null,
        message
      );

      status(
        error &&
        error.message
          ? error.message
          : String(error),
        "warn"
      );

      return null;
    }finally{
      state.sending = false;
      updateInfo();

      if(
        window.TablaActions &&
        typeof window
          .TablaActions
          .enhance ===
          "function"
      ){
        window.TablaActions
          .enhance(80);
      }
    }
  }

  function toggleCustomText(){
    var type =
      currentType();

    var wrapper =
      el(
        "tabla-tg-texto-wrap"
      );

    var label =
      el(
        "tabla-tg-texto-label"
      );

    var visible =
      type === "libre" ||
      type === "cronograma";

    if(wrapper){
      wrapper.hidden =
        !visible;
    }

    if(label){
      label.textContent =
        type === "cronograma"
          ? "Cronograma o información manual"
          : "Mensaje personal";
    }
  }

  function open(row, type){
    if(state.sending){
      return false;
    }

    state.row =
      row || null;

    state.type =
      type ||
      "requisitos";

    state.lastMessageId =
      null;

    if(!state.row){
      status(
        "No se pudo identificar al estudiante.",
        "warn"
      );

      return false;
    }

    var typeSelect =
      el("tabla-tg-tipo");

    var custom =
      el("tabla-tg-texto");

    var modal =
      el(
        "tabla-telegram-modal"
      );

    if(typeSelect){
      typeSelect.value =
        state.type;

      if(
        typeSelect.value !==
        state.type
      ){
        typeSelect.value =
          "requisitos";

        state.type =
          "requisitos";
      }
    }

    if(custom){
      custom.value = "";
    }

    toggleCustomText();
    updateInfo();
    updatePreview();

    if(modal){
      modal.hidden = false;

      modal.setAttribute(
        "aria-hidden",
        "false"
      );
    }

    return true;
  }

  function close(){
    if(state.sending){
      status(
        "El mensaje se está enviando. Espere a que finalice antes de cerrar.",
        "warn"
      );

      return false;
    }

    var modal =
      el(
        "tabla-telegram-modal"
      );

    if(modal){
      modal.hidden = true;

      modal.setAttribute(
        "aria-hidden",
        "true"
      );
    }

    state.row = null;
    state.type = "requisitos";

    return true;
  }

  function bind(){
    if(state.bound){
      return;
    }

    state.bound = true;

    var typeSelect =
      el("tabla-tg-tipo");

    var custom =
      el("tabla-tg-texto");

    var closeButton =
      el("tabla-tg-close");

    var cancel =
      el("tabla-tg-cancel");

    var copy =
      el("tabla-tg-copy");

    var openButton =
      el("tabla-tg-open");

    var send =
      el("tabla-tg-send");

    var modal =
      el(
        "tabla-telegram-modal"
      );

    if(typeSelect){
      typeSelect.addEventListener(
        "change",
        function(){
          state.type =
            typeSelect.value;

          toggleCustomText();
          updatePreview();
          updateInfo();
        }
      );
    }

    if(custom){
      custom.addEventListener(
        "input",
        updatePreview
      );
    }

    if(closeButton){
      closeButton.addEventListener(
        "click",
        close
      );
    }

    if(cancel){
      cancel.addEventListener(
        "click",
        close
      );
    }

    if(copy){
      copy.addEventListener(
        "click",
        copyMessage
      );
    }

    if(openButton){
      openButton.addEventListener(
        "click",
        openTelegram
      );
    }

    if(send){
      send.addEventListener(
        "click",
        sendByBot
      );
    }

    if(modal){
      modal.addEventListener(
        "click",
        function(event){
          if(
            event.target ===
            modal
          ){
            close();
          }
        }
      );
    }

    document.addEventListener(
      "keydown",
      function(event){
        if(
          event.key ===
            "Escape" &&
          modal &&
          !modal.hidden
        ){
          close();
        }
      }
    );
  }

  function boot(){
    bind();
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

  window.TablaTelegram = {
    version:
      VERSION,

    abrir:
      open,

    open:
      open,

    cerrar:
      close,

    close:
      close,

    generarMensaje:
      generateMessage,

    generateMessage:
      generateMessage,

    copiarMensaje:
      copyMessage,

    copyMessage:
      copyMessage,

    abrirTelegram:
      openTelegram,

    openTelegram:
      openTelegram,

    enviarPorBot:
      sendByBot,

    sendByBot:
      sendByBot,

    info:
      info,

    url:
      telegramUrl,

    getState:
      function(){
        return {
          row:
            state.row,

          type:
            state.type,

          sending:
            state.sending,

          lastMessageId:
            state.lastMessageId
        };
      }
  };
})(window, document);
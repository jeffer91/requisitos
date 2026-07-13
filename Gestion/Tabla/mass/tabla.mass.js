/* =========================================================
Nombre completo: tabla.mass.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/mass/tabla.mass.js
Función o funciones:
- Controlar únicamente la interfaz del modal de Telegram masivo.
- Trabajar con todos los estudiantes filtrados del período seleccionado.
- Delegar selección a TablaSelection y ejecución a TablaMassSender.
- Invalidar el lote cuando cambian el mensaje, la confirmación o la selección.
Con qué se conecta:
- tabla.utils.js
- tabla.message.js
- tabla.selection.js
- tabla.mass-sender.js
- tabla.actions.js
- tabla.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "2.0.0";
  var U = window.TablaUtils || {};

  var state = {
    rows: [],
    rejectedRows: [],
    filters: {},
    type: "requisitos",
    prepared: null,
    sending: false,
    opened: false,
    bound: false,
    lastResult: null
  };

  function el(id){
    return document.getElementById(id);
  }

  function text(value){
    return U.text
      ? U.text(value)
      : String(value == null ? "" : value).trim();
  }

  function norm(value){
    return U.normalizeKey
      ? U.normalizeKey(value)
      : text(value)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/gi, "")
          .toLowerCase();
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
      typeof window.TablaRenderSummary.status === "function"
    ){
      window.TablaRenderSummary.status(
        message,
        type || ""
      );

      return;
    }

    var box = el("tabla-status");

    if(box){
      box.textContent = text(message);

      box.className =
        "tabla-status" +
        (
          type
            ? " " + type
            : ""
        );
    }
  }

  function modal(){
    return el("tabla-mass-modal");
  }

  function selection(){
    return window.TablaSelection || null;
  }

  function sender(){
    return window.TablaMassSender || null;
  }

  function messageModule(){
    return window.TablaMessage || null;
  }

  function periodId(){
    return text(
      state.filters &&
      (
        state.filters.periodId ||
        state.filters.periodoId
      )
    );
  }

  function periodLabel(){
    return text(
      state.filters &&
      (
        state.filters.periodo ||
        state.filters.periodLabel ||
        state.filters.periodoLabel ||
        state.filters.periodId
      )
    );
  }

  function rowPeriodTokens(row){
    row = row || {};

    return [
      row._periodoId,
      row._periodo,
      row.periodoId,
      row.periodId,
      row.idPeriodo,
      row.periodoLabel,
      row.periodo,
      row.Periodo,
      row._bl2PeriodoId,
      row._bl2Periodo,
      row.periodoCanonicoId,
      row.periodoCanonicoLabel
    ].filter(function(value){
      return !!text(value);
    });
  }

  function samePeriod(row){
    var wanted = [
      periodId(),
      periodLabel()
    ].filter(Boolean);

    if(!wanted.length){
      return false;
    }

    return rowPeriodTokens(row)
      .some(function(value){
        return wanted.some(
          function(expected){
            if(U.samePeriod){
              return U.samePeriod(
                value,
                expected
              );
            }

            return (
              text(value) ===
                text(expected) ||
              norm(value) ===
                norm(expected)
            );
          }
        );
      });
  }

  function validatePeriodRows(rows){
    var accepted = [];
    var rejected = [];

    (
      Array.isArray(rows)
        ? rows
        : []
    ).forEach(function(row){
      if(samePeriod(row)){
        accepted.push(row);
      }else{
        rejected.push(row);
      }
    });

    return {
      accepted: accepted,
      rejected: rejected
    };
  }

  function typeLabel(type){
    return (
      messageModule() &&
      typeof messageModule()
        .tipoLabel === "function"
    )
      ? messageModule()
          .tipoLabel(type)
      : text(type || "requisitos");
  }

  function currentType(){
    var field =
      el("tabla-mass-tipo");

    state.type = field
      ? field.value
      : state.type;

    return (
      state.type ||
      "requisitos"
    );
  }

  function customText(){
    var field =
      el("tabla-mass-texto");

    return field
      ? field.value
      : "";
  }

  function payload(){
    return {
      texto: customText()
    };
  }

  function generateMessage(row){
    if(
      messageModule() &&
      typeof messageModule()
        .generarMensaje ===
        "function"
    ){
      return messageModule()
        .generarMensaje(
          row || {},
          currentType(),
          payload()
        );
    }

    return (
      customText() ||
      "Saludos. Desde el área de Titulación se informa que existen novedades en su proceso."
    );
  }

  function toggleCustomText(){
    var type =
      currentType();

    var wrap =
      el(
        "tabla-mass-texto-wrap"
      );

    var label =
      el(
        "tabla-mass-texto-label"
      );

    var visible =
      type === "libre" ||
      type === "cronograma";

    if(wrap){
      wrap.hidden =
        !visible;
    }

    if(label){
      label.textContent =
        type === "cronograma"
          ? "Cronograma o información general"
          : "Mensaje personal";
    }
  }

  function telegramInfo(row){
    if(
      selection() &&
      typeof selection()
        .telegramInfo ===
        "function"
    ){
      return selection()
        .telegramInfo(row);
    }

    row = row || {};

    var user =
      text(
        row._telegramUser
      ).replace(
        /^@+/,
        ""
      );

    var chatId =
      text(
        row._telegramChatId
      );

    return {
      user: user,
      chatId: chatId,

      hasTelegram:
        !!(
          user ||
          chatId
        ),

      canSendByBot:
        !!chatId
    };
  }

  function telegramLabel(row){
    var info =
      telegramInfo(row);

    if(info.chatId){
      return "Chat ID";
    }

    if(info.user){
      return (
        "@" +
        info.user +
        " · sin chatId"
      );
    }

    return "Sin Telegram";
  }

  function telegramClass(row){
    var info =
      telegramInfo(row);

    if(info.chatId){
      return "pill-ok";
    }

    if(info.user){
      return "pill-warn";
    }

    return "pill-bad";
  }

  function rowStatus(row){
    row = row || {};

    var current =
      row._estadoGeneral;

    if(
      current &&
      typeof current === "object"
    ){
      return (
        text(
          current.label ||
          current.estado ||
          current.value
        ) ||
        "—"
      );
    }

    if(text(current)){
      if(current === "cumple"){
        return "Cumple";
      }

      if(
        current ===
        "no_cumple"
      ){
        return "No cumple";
      }

      return "Pendiente";
    }

    return "—";
  }

  function renderSummary(){
    if(!selection()){
      return;
    }

    var summary =
      selection().summary();

    var box =
      el(
        "tabla-mass-summary"
      );

    var meta =
      el(
        "tabla-mass-meta"
      );

    if(box){
      box.innerHTML = [
        '<span>Período: <strong>' +
          esc(
            periodLabel() ||
            "—"
          ) +
          "</strong></span>",

        '<span>Total filtrado: <strong>' +
          esc(summary.total) +
          "</strong></span>",

        '<span>Con Telegram: <strong>' +
          esc(
            summary.conTelegram
          ) +
          "</strong></span>",

        '<span>Con chatId: <strong>' +
          esc(
            summary.conChatId ||
            0
          ) +
          "</strong></span>",

        '<span>Seleccionados: <strong>' +
          esc(
            summary.seleccionados
          ) +
          "</strong></span>",

        '<span>Listos para bot: <strong>' +
          esc(
            summary
              .seleccionadosConChatId ||
            0
          ) +
          "</strong></span>"
      ].join("");
    }

    if(meta){
      meta.textContent =
        "Se enviará únicamente a estudiantes del período " +
        (
          periodLabel() ||
          "seleccionado"
        ) +
        ". Solo los registros con chatId pueden enviarse por bot." +
        (
          state.rejectedRows.length
            ? (
                " Se excluyeron " +
                state.rejectedRows.length +
                " registro(s) de otros períodos."
              )
            : ""
        );
    }
  }

  function renderList(){
    if(!selection()){
      return;
    }

    var data =
      selection().getState();

    var rows =
      data.rows || [];

    var selected =
      data.selected || {};

    var box =
      el(
        "tabla-mass-list"
      );

    var limit = 300;

    if(!box){
      return;
    }

    if(!rows.length){
      box.innerHTML =
        '<div class="empty">No hay estudiantes del período seleccionado con los filtros actuales.</div>';

      return;
    }

    var html =
      '<table class="tabla-mini-table">' +
      "<thead><tr>" +
      "<th></th>" +
      "<th>Estudiante</th>" +
      "<th>Carrera</th>" +
      "<th>Estado</th>" +
      "<th>Telegram</th>" +
      "</tr></thead><tbody>";

    html += rows
      .slice(
        0,
        limit
      )
      .map(function(row){
        var rowKey =
          row._tablaSelectionKey;

        var checked =
          selected[rowKey]
            ? " checked"
            : "";

        return (
          "<tr>" +

          '<td><input class="tabla-mass-check" type="checkbox" data-mass-key="' +
          esc(rowKey) +
          '"' +
          checked +
          "></td>" +

          "<td><strong>" +
          esc(
            row._nombres ||
            "Estudiante"
          ) +
          "</strong><br><small>" +
          esc(
            row._cedula ||
            "Sin cédula"
          ) +
          " · " +
          esc(
            row._periodo ||
            periodLabel() ||
            "Sin período"
          ) +
          "</small></td>" +

          "<td>" +
          esc(
            row._carrera ||
            "—"
          ) +
          "</td>" +

          "<td>" +
          esc(
            rowStatus(row)
          ) +
          "</td>" +

          '<td><span class="pill ' +
          telegramClass(row) +
          '">' +
          esc(
            telegramLabel(row)
          ) +
          "</span></td>" +

          "</tr>"
        );
      })
      .join("");

    html +=
      "</tbody></table>";

    if(rows.length > limit){
      html +=
        '<div class="tabla-mass-note">Mostrando ' +
        limit +
        " de " +
        rows.length +
        " estudiantes. La selección completa se conserva.</div>";
    }

    box.innerHTML = html;
  }

  function renderPreview(){
    var preview =
      el(
        "tabla-mass-preview"
      );

    if(
      !preview ||
      !selection()
    ){
      return;
    }

    var rows =
      selection()
        .selectedRows();

    preview.value =
      rows.length
        ? generateMessage(
            rows[0]
          )
        : "Seleccione al menos un estudiante para generar la vista previa.";
  }

  function invalidatePrepared(){
    if(!state.sending){
      state.prepared = null;
      state.lastResult = null;

      if(
        sender() &&
        sender().clear
      ){
        sender().clear();
      }
    }

    updateButtons();
  }

  function updateButtons(){
    var prepare =
      el(
        "tabla-mass-prepare"
      );

    var sendButton =
      el(
        "tabla-mass-send"
      );

    var close =
      el(
        "tabla-mass-close"
      );

    var cancel =
      el(
        "tabla-mass-cancel"
      );

    var copy =
      el(
        "tabla-mass-copy"
      );

    var selectionSummary =
      selection()
        ? selection().summary()
        : {
            seleccionados: 0,
            seleccionadosConChatId: 0
          };

    var ready =
      !!(
        state.prepared &&
        !state.prepared.consumed &&
        state.prepared.totalReady > 0
      );

    if(prepare){
      prepare.disabled =
        state.sending ||
        !selectionSummary
          .seleccionados;
    }

    if(sendButton){
      sendButton.disabled =
        state.sending ||
        !ready;

      sendButton.textContent =
        state.sending
          ? "Enviando..."
          : (
              state.prepared &&
              state.prepared.consumed
                ? "Lote finalizado"
                : "Enviar lote"
            );
    }

    if(close){
      close.disabled =
        state.sending;
    }

    if(cancel){
      cancel.disabled =
        state.sending;
    }

    if(copy){
      copy.disabled =
        state.sending;
    }
  }

  function refresh(options){
    options = options || {};

    renderSummary();
    renderList();
    renderPreview();

    if(
      options.keepPrepared !==
      true
    ){
      invalidatePrepared();
    }

    updateButtons();
  }

  function open(rows, filters){
    state.filters =
      filters || {};

    state.type =
      "requisitos";

    state.prepared = null;
    state.sending = false;
    state.opened = false;
    state.lastResult = null;

    if(
      !periodId() &&
      !periodLabel()
    ){
      status(
        "Seleccione un período antes de abrir Telegram masivo.",
        "warn"
      );

      return false;
    }

    var checked =
      validatePeriodRows(rows);

    state.rows =
      checked.accepted;

    state.rejectedRows =
      checked.rejected;

    if(!selection()){
      status(
        "No está disponible el selector de estudiantes.",
        "warn"
      );

      return false;
    }

    selection().create(
      state.rows,
      {
        selectWithBot: true,
        periodId: periodId(),
        periodLabel: periodLabel()
      }
    );

    var type =
      el(
        "tabla-mass-tipo"
      );

    var custom =
      el(
        "tabla-mass-texto"
      );

    var confirmation =
      el(
        "tabla-mass-confirm"
      );

    if(type){
      type.value =
        "requisitos";
    }

    if(custom){
      custom.value = "";
    }

    if(confirmation){
      confirmation.checked =
        false;
    }

    if(
      sender() &&
      sender().clear
    ){
      sender().clear();
    }

    toggleCustomText();
    refresh();

    var currentModal =
      modal();

    if(currentModal){
      currentModal.hidden =
        false;

      currentModal.setAttribute(
        "aria-hidden",
        "false"
      );

      state.opened =
        true;
    }

    status(
      state.rejectedRows.length
        ? (
            "Telegram masivo abierto. Se excluyeron " +
            state.rejectedRows.length +
            " registro(s) de otros períodos."
          )
        : "Telegram masivo abierto para revisión.",

      state.rejectedRows.length
        ? "warn"
        : "ok"
    );

    return true;
  }

  function close(){
    if(state.sending){
      status(
        "El lote se está enviando. Espere a que finalice antes de cerrar.",
        "warn"
      );

      return false;
    }

    var currentModal =
      modal();

    if(currentModal){
      currentModal.hidden =
        true;

      currentModal.setAttribute(
        "aria-hidden",
        "true"
      );
    }

    state.opened =
      false;

    return true;
  }

  async function copyPreview(){
    var preview =
      el(
        "tabla-mass-preview"
      );

    var value =
      preview
        ? preview.value
        : "";

    if(!text(value)){
      status(
        "No existe una vista previa para copiar.",
        "warn"
      );

      return false;
    }

    try{
      if(U.copyText){
        await U.copyText(
          value
        );
      }else if(
        window.navigator &&
        window.navigator.clipboard &&
        window.navigator
          .clipboard
          .writeText
      ){
        await window.navigator
          .clipboard
          .writeText(value);
      }else{
        throw new Error(
          "No está disponible el portapapeles."
        );
      }

      status(
        "Vista previa masiva copiada.",
        "ok"
      );

      return true;
    }catch(error){
      status(
        error &&
        error.message
          ? error.message
          : "No se pudo copiar la vista previa.",

        "warn"
      );

      return false;
    }
  }

  function prepareBatch(){
    if(
      !selection() ||
      !sender()
    ){
      status(
        "No están disponibles los módulos de selección o envío masivo.",
        "warn"
      );

      return null;
    }

    var confirmation =
      el(
        "tabla-mass-confirm"
      );

    if(
      !periodId() &&
      !periodLabel()
    ){
      status(
        "No existe un período seleccionado para el lote.",
        "warn"
      );

      return null;
    }

    if(
      confirmation &&
      !confirmation.checked
    ){
      status(
        "Confirme la revisión del período, el mensaje y la selección antes de preparar el lote.",
        "warn"
      );

      return null;
    }

    var selectedRows =
      selection()
        .selectedRows();

    if(!selectedRows.length){
      status(
        "Seleccione al menos un estudiante.",
        "warn"
      );

      return null;
    }

    if(
      selectedRows.some(
        function(row){
          return !samePeriod(row);
        }
      )
    ){
      status(
        "El lote contiene registros de otro período y fue bloqueado.",
        "warn"
      );

      return null;
    }

    state.prepared =
      sender().prepare(
        selectedRows,
        {
          type: currentType(),
          payload: payload(),
          periodId: periodId(),
          periodLabel: periodLabel(),

          signature:
            selection().signature
              ? selection()
                  .signature()
              : ""
        }
      );

    updateButtons();

    if(
      !state.prepared
        .totalReady
    ){
      status(
        "No hay estudiantes seleccionados con chatId y mensaje válido para envío por bot.",
        "warn"
      );

      return state.prepared;
    }

    status(
      "Lote preparado: " +
      state.prepared.totalReady +
      " mensaje(s) listos. Omitidos: " +
      state.prepared.totalRejected +
      ".",

      "ok"
    );

    return state.prepared;
  }

  function showProgress(data){
    data = data || {};

    status(
      "Enviando Telegram: " +
      Number(
        data.processed ||
        0
      ) +
      " de " +
      Number(
        data.total ||
        0
      ) +
      " · enviados " +
      Number(
        data.enviados ||
        0
      ) +
      " · fallidos " +
      Number(
        data.fallidos ||
        0
      ) +
      " · omitidos " +
      Number(
        data.omitidos ||
        0
      ) +
      ".",

      Number(
        data.fallidos ||
        0
      )
        ? "warn"
        : ""
    );
  }

  async function sendBatch(){
    if(state.sending){
      return null;
    }

    var prepared =
      state.prepared ||
      prepareBatch();

    if(
      !prepared ||
      !prepared.totalReady
    ){
      return null;
    }

    if(prepared.consumed){
      status(
        "Este lote ya fue enviado. Prepare uno nuevo para evitar duplicados.",
        "warn"
      );

      return null;
    }

    if(
      typeof window.confirm ===
        "function" &&
      !window.confirm(
        "¿Enviar " +
        prepared.totalReady +
        " mensaje(s) por Telegram al período " +
        (
          prepared.periodLabel ||
          periodLabel() ||
          "seleccionado"
        ) +
        "?"
      )
    ){
      return null;
    }

    state.sending = true;
    updateButtons();

    status(
      "Iniciando el envío de " +
      prepared.totalReady +
      " mensaje(s) por Telegram...",

      ""
    );

    try{
      var result =
        await sender().send(
          prepared,
          {
            maxPerSecond: 25,
            retries: 2,

            onProgress:
              showProgress,

            onRetry:
              function(retry){
                status(
                  "Telegram solicitó una pausa. Reintento automático en " +
                  Math.ceil(
                    Number(
                      retry.delayMs ||
                      0
                    ) /
                    1000
                  ) +
                  " segundo(s).",

                  "warn"
                );
              }
          }
        );

      state.lastResult =
        result;

      status(
        "Telegram masivo finalizado. Enviados: " +
        result.resumen.enviados +
        ", fallidos: " +
        result.resumen.fallidos +
        ", omitidos: " +
        result.resumen.omitidos +
        ".",

        result.resumen.fallidos
          ? "warn"
          : "ok"
      );

      return result;
    }catch(error){
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
      updateButtons();

      if(
        window.TablaActions &&
        typeof window
          .TablaActions
          .enhance ===
          "function"
      ){
        window.TablaActions
          .enhance(100);
      }
    }
  }

  function bind(){
    if(state.bound){
      return;
    }

    state.bound = true;

    var currentModal =
      modal();

    var type =
      el(
        "tabla-mass-tipo"
      );

    var custom =
      el(
        "tabla-mass-texto"
      );

    var confirmation =
      el(
        "tabla-mass-confirm"
      );

    var closeButton =
      el(
        "tabla-mass-close"
      );

    var cancel =
      el(
        "tabla-mass-cancel"
      );

    var selectAll =
      el(
        "tabla-mass-select-all"
      );

    var selectBot =
      el(
        "tabla-mass-select-tg"
      );

    var clear =
      el(
        "tabla-mass-clear"
      );

    var copy =
      el(
        "tabla-mass-copy"
      );

    var prepare =
      el(
        "tabla-mass-prepare"
      );

    var sendButton =
      el(
        "tabla-mass-send"
      );

    var list =
      el(
        "tabla-mass-list"
      );

    if(type){
      type.addEventListener(
        "change",
        function(){
          state.type =
            type.value;

          toggleCustomText();
          renderPreview();
          invalidatePrepared();
        }
      );
    }

    if(custom){
      custom.addEventListener(
        "input",
        function(){
          renderPreview();
          invalidatePrepared();
        }
      );
    }

    if(confirmation){
      confirmation.addEventListener(
        "change",
        invalidatePrepared
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

    if(selectAll){
      selectAll.addEventListener(
        "click",
        function(){
          if(selection()){
            selection()
              .selectAll();

            refresh();
          }
        }
      );
    }

    if(selectBot){
      selectBot.addEventListener(
        "click",
        function(){
          if(selection()){
            selection()
              .selectWithBot();

            refresh();
          }
        }
      );
    }

    if(clear){
      clear.addEventListener(
        "click",
        function(){
          if(selection()){
            selection().clear();
            refresh();
          }
        }
      );
    }

    if(copy){
      copy.addEventListener(
        "click",
        copyPreview
      );
    }

    if(prepare){
      prepare.addEventListener(
        "click",
        prepareBatch
      );
    }

    if(sendButton){
      sendButton.addEventListener(
        "click",
        sendBatch
      );
    }

    if(list){
      list.addEventListener(
        "change",
        function(event){
          var checkbox =
            event.target &&
            event.target.closest
              ? event.target.closest(
                  "[data-mass-key]"
                )
              : null;

          if(
            !checkbox ||
            !selection()
          ){
            return;
          }

          selection().toggle(
            checkbox.getAttribute(
              "data-mass-key"
            ),
            checkbox.checked
          );

          invalidatePrepared();
          renderSummary();
          renderPreview();
        }
      );
    }

    if(currentModal){
      currentModal.addEventListener(
        "click",
        function(event){
          if(
            event.target ===
            currentModal
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
          event.key === "Escape" &&
          currentModal &&
          !currentModal.hidden
        ){
          close();
        }
      }
    );
  }

  function boot(){
    bind();
    updateButtons();
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

  window.TablaMass = {
    version: VERSION,

    abrir: open,
    open: open,

    cerrar: close,
    close: close,

    refresh: refresh,

    prepararLote:
      prepareBatch,

    prepareBatch:
      prepareBatch,

    enviarLote:
      sendBatch,

    sendBatch:
      sendBatch,

    copiarPreview:
      copyPreview,

    copyPreview:
      copyPreview,

    getPrepared:
      function(){
        return state.prepared;
      },

    getState:
      function(){
        return {
          rows:
            state.rows.slice(),

          rejectedRows:
            state
              .rejectedRows
              .slice(),

          filters:
            Object.assign(
              {},
              state.filters
            ),

          type:
            state.type,

          prepared:
            state.prepared,

          sending:
            state.sending,

          opened:
            state.opened,

          lastResult:
            state.lastResult
        };
      }
  };
})(window, document);
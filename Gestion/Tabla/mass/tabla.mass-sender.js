/* =========================================================
Nombre completo: tabla.mass-sender.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/mass/tabla.mass-sender.js
Función o funciones:
- Preparar lotes de Telegram sin depender del DOM.
- Validar chatId, mensaje, período e identidad de cada estudiante.
- Ejecutar un solo lote a la vez y evitar reenvíos accidentales.
- Registrar enviados, fallidos y omitidos en el historial.
Con qué se conecta:
- tabla.utils.js
- tabla.data-normalizer.js
- tabla.message.js
- tabla.telegram-api.js
- tabla.history.js
- tabla.mass.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0";
  var U = window.TablaUtils || {};
  var N =
    window.TablaDataNormalizer ||
    {};

  var state = {
    prepared:
      null,

    running:
      false,

    cancelRequested:
      false,

    lastResult:
      null,

    sequence:
      0
  };

  function text(value){
    return U.text
      ? U.text(value)
      : String(
          value == null
            ? ""
            : value
        ).trim();
  }

  function nowIso(){
    return U.nowIso
      ? U.nowIso()
      : new Date()
          .toISOString();
  }

  function telegramInfo(row){
    if(N.telegramInfo){
      var info =
        N.telegramInfo(
          row || {}
        );

      return {
        user:
          text(
            info.user ||
            info.username
          ),

        chatId:
          text(info.chatId),

        hasTelegram:
          !!info.hasTelegram,

        canSendByBot:
          !!(
            info.canBot ||
            info.canSendByBot ||
            info.hasChatId
          )
      };
    }

    row = row || {};

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
        text(row._periodoId),

      division:
        text(row._division)
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

  function messageFor(
    row,
    type,
    payload,
    options
  ){
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
          payload || {},
          options &&
          options.messageOptions ||
          {}
        );
    }

    return text(
      payload &&
      (
        payload.texto ||
        payload.mensaje
      )
    );
  }

  function studentKey(
    row,
    index
  ){
    if(N.studentKey){
      return text(
        N.studentKey(row)
      );
    }

    row = row || {};

    return text(
      row._tablaSelectionKey ||
      row._id ||
      [
        row._cedula,
        row._periodoId,
        index
      ].join("::")
    );
  }

  function batchId(){
    state.sequence += 1;

    return (
      "tabla-lote-" +
      Date.now()
        .toString(36) +
      "-" +
      state.sequence
        .toString(36)
    );
  }

  function normalizedItem(
    row,
    index,
    options
  ){
    options = options || {};

    var data =
      studentData(row);

    var telegram =
      telegramInfo(row);

    var message =
      messageFor(
        row,
        options.type ||
          "requisitos",
        options.payload ||
          {},
        options
      );

    var item = {
      key:
        studentKey(
          row,
          index
        ),

      index:
        index,

      row:
        row,

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
        options.periodLabel ||
        "",

      periodoId:
        data.periodoId ||
        row._periodoId ||
        options.periodId ||
        "",

      division:
        data.division ||
        row._division ||
        "",

      telegramUser:
        telegram.user,

      telegramChatId:
        telegram.chatId,

      mensaje:
        message,

      tipoMensaje:
        options.type ||
        "requisitos",

      tipoLabel:
        typeLabel(
          options.type ||
          "requisitos"
        ),

      estado:
        "pendiente",

      error:
        ""
    };

    if(!item.telegramChatId){
      item.estado =
        "omitido";

      item.error =
        "Sin chatId";
    }else if(
      !text(item.mensaje)
    ){
      item.estado =
        "omitido";

      item.error =
        "Mensaje vacío";
    }

    return item;
  }

  function prepare(
    rows,
    options
  ){
    options = options || {};

    rows =
      Array.isArray(rows)
        ? rows
        : [];

    var seen =
      Object.create(null);

    var valid = [];
    var rejected = [];

    rows.forEach(
      function(row, index){
        var item =
          normalizedItem(
            row || {},
            index,
            options
          );

        if(!item.key){
          item.key =
            "fila::" +
            index;
        }

        if(seen[item.key]){
          item.estado =
            "omitido";

          item.error =
            "Duplicado dentro del lote";

          rejected.push(item);
          return;
        }

        seen[item.key] = true;

        if(
          item.estado ===
          "omitido"
        ){
          rejected.push(item);
        }else{
          valid.push(item);
        }
      }
    );

    var prepared = {
      id:
        batchId(),

      createdAt:
        nowIso(),

      sentAt:
        "",

      type:
        options.type ||
        "requisitos",

      typeLabel:
        typeLabel(
          options.type ||
          "requisitos"
        ),

      payload:
        Object.assign(
          {},
          options.payload ||
          {}
        ),

      periodId:
        text(
          options.periodId ||
          options.periodoId
        ),

      periodLabel:
        text(
          options.periodLabel ||
          options.periodo
        ),

      sourceSignature:
        text(options.signature),

      items:
        valid,

      rejected:
        rejected,

      totalInput:
        rows.length,

      totalReady:
        valid.length,

      totalRejected:
        rejected.length,

      consumed:
        false
    };

    state.prepared =
      prepared;

    state.lastResult =
      null;

    state.cancelRequested =
      false;

    return prepared;
  }

  function historyRecord(
    item,
    batch,
    mode
  ){
    item = item || {};
    batch = batch || {};

    return {
      canal:
        "telegram",

      modo:
        mode ||
        "masivo",

      accion:
        "bot",

      tipoMensaje:
        item.tipoMensaje ||
        batch.type ||
        "requisitos",

      tipoLabel:
        item.tipoLabel ||
        batch.typeLabel ||
        typeLabel(
          batch.type
        ),

      cedula:
        item.cedula ||
        "",

      nombre:
        item.nombre ||
        "",

      carrera:
        item.carrera ||
        "",

      periodo:
        item.periodo ||
        batch.periodLabel ||
        "",

      periodoId:
        item.periodoId ||
        batch.periodId ||
        "",

      division:
        item.division ||
        "",

      telegramUser:
        item.telegramUser ||
        "",

      telegramChatId:
        item.telegramChatId ||
        "",

      mensaje:
        item.mensaje ||
        "",

      estado:
        item.estado ||
        "pendiente",

      error:
        item.error ||
        "",

      loteId:
        batch.id ||
        "",

      telegramMessageId:
        item.telegramMessageId ||
        null
    };
  }

  function saveHistory(
    items,
    batch
  ){
    items =
      Array.isArray(items)
        ? items
        : [];

    if(
      !window.TablaHistory ||
      typeof window
        .TablaHistory
        .guardar !==
        "function"
    ){
      return [];
    }

    var records =
      items.map(
        function(item){
          return historyRecord(
            item,
            batch,
            "masivo"
          );
        }
      );

    if(
      typeof window
        .TablaHistory
        .guardarVarios ===
        "function"
    ){
      return (
        window.TablaHistory
          .guardarVarios(
            records
          ) ||
        records
      );
    }

    return records.map(
      function(record){
        return window.TablaHistory
          .guardar(record);
      }
    );
  }

  function mergeResult(
    batch,
    apiResult
  ){
    apiResult = apiResult || {};

    var sent =
      Array.isArray(
        apiResult.enviados
      )
        ? apiResult.enviados
        : [];

    var failed =
      Array.isArray(
        apiResult.fallidos
      )
        ? apiResult.fallidos
        : [];

    var omitted = []
      .concat(
        Array.isArray(
          apiResult.omitidos
        )
          ? apiResult.omitidos
          : []
      )
      .concat(
        Array.isArray(
          batch.rejected
        )
          ? batch.rejected
          : []
      );

    return {
      ok:
        failed.length === 0,

      batchId:
        batch.id,

      total:
        batch.totalInput,

      enviados:
        sent,

      fallidos:
        failed,

      omitidos:
        omitted,

      duracionMs:
        Number(
          apiResult.duracionMs ||
          0
        ),

      maxPerSecond:
        Number(
          apiResult.maxPerSecond ||
          0
        ),

      resumen: {
        enviados:
          sent.length,

        fallidos:
          failed.length,

        omitidos:
          omitted.length
      }
    };
  }

  async function send(
    batch,
    options
  ){
    options = options || {};

    batch =
      batch ||
      state.prepared;

    if(!batch){
      throw new Error(
        "No existe un lote preparado."
      );
    }

    if(state.running){
      throw new Error(
        "Ya existe un lote de Telegram en ejecución."
      );
    }

    if(
      batch.consumed &&
      options.allowResend !==
        true
    ){
      throw new Error(
        "Este lote ya fue enviado. Prepare un lote nuevo para evitar duplicados."
      );
    }

    if(!batch.items.length){
      var emptyResult =
        mergeResult(
          batch,
          {
            enviados:
              [],

            fallidos:
              [],

            omitidos:
              []
          }
        );

      saveHistory(
        emptyResult.omitidos,
        batch
      );

      batch.consumed =
        true;

      batch.sentAt =
        nowIso();

      state.lastResult =
        emptyResult;

      return emptyResult;
    }

    if(
      !window.TablaTelegramApi ||
      typeof window
        .TablaTelegramApi
        .enviarLoteTelegram !==
        "function"
    ){
      throw new Error(
        "No está disponible la API segura de Telegram."
      );
    }

    state.running = true;

    state.cancelRequested =
      false;

    try{
      var apiResult =
        await window
          .TablaTelegramApi
          .enviarLoteTelegram(
            batch.items,

            {
              retries:
                options.retries ==
                null
                  ? 2
                  : options.retries,

              maxPerSecond:
                options
                  .maxPerSecond ||
                25,

              adminToken:
                options.adminToken,

              baseFunctionsUrl:
                options
                  .baseFunctionsUrl,

              timeoutMs:
                options.timeoutMs,

              shouldContinue:
                function(){
                  return (
                    !state
                      .cancelRequested
                  );
                },

              onRetry:
                options.onRetry,

              onProgress:
                function(progress){
                  if(
                    typeof options
                      .onProgress ===
                    "function"
                  ){
                    options.onProgress(
                      progress
                    );
                  }
                }
            }
          );

      var result =
        mergeResult(
          batch,
          apiResult
        );

      var historyItems = []
        .concat(
          result.enviados
        )
        .concat(
          result.fallidos
        )
        .concat(
          result.omitidos
        );

      saveHistory(
        historyItems,
        batch
      );

      batch.consumed =
        true;

      batch.sentAt =
        nowIso();

      state.lastResult =
        result;

      return result;
    }finally{
      state.running = false;

      state.cancelRequested =
        false;

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

  function cancel(){
    if(!state.running){
      return false;
    }

    state.cancelRequested =
      true;

    return true;
  }

  function clear(){
    if(state.running){
      return false;
    }

    state.prepared = null;
    state.lastResult = null;
    state.cancelRequested = false;

    return true;
  }

  window.TablaMassSender = {
    version:
      VERSION,

    prepare:
      prepare,

    preparar:
      prepare,

    send:
      send,

    enviar:
      send,

    cancel:
      cancel,

    cancelar:
      cancel,

    clear:
      clear,

    limpiar:
      clear,

    getPrepared:
      function(){
        return state.prepared;
      },

    getState:
      function(){
        return {
          prepared:
            state.prepared,

          running:
            state.running,

          cancelRequested:
            state.cancelRequested,

          lastResult:
            state.lastResult
        };
      },

    historyRecord:
      historyRecord
  };
})(window);
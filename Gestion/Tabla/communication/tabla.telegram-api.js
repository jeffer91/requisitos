/* =========================================================
Nombre completo: tabla.telegram-api.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/communication/tabla.telegram-api.js
Función o funciones:
- Enviar mensajes mediante la función segura de Telegram.
- No guardar ni exponer el token del bot en el navegador.
- Controlar reintentos, retry_after, tiempo de espera y lotes limitados.
- Entregar resultados uniformes a Telegram individual y masivo.
Con qué se conecta:
- ta-titulo-articulo-api-telegram
- tabla.utils.js
- tabla.telegram.js
- tabla.mass-sender.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0";
  var U = window.TablaUtils || {};

  var FUNCTIONS_PATH =
    "/.netlify/functions";

  var LOCAL_DEFAULT =
    "http://127.0.0.1:8888/.netlify/functions";

  var BASE_URL_KEY =
    "tabla.telegram.baseFunctionsUrl";

  var ADMIN_TOKEN_KEY =
    "ta.titulo.articulo.adminToken";

  var ENDPOINT_NAME =
    "ta-titulo-articulo-api-telegram";

  var DEFAULT_RATE = 25;
  var DEFAULT_RETRIES = 2;
  var DEFAULT_TIMEOUT = 30000;

  var LOCAL_HOSTS = {
    localhost:
      true,

    "127.0.0.1":
      true,

    "0.0.0.0":
      true,

    "::1":
      true
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

  function messageText(value){
    return String(
      value == null
        ? ""
        : value
    )
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      )
      .trim();
  }

  function clamp(
    value,
    min,
    max,
    fallback
  ){
    value = Number(value);

    if(!isFinite(value)){
      value = fallback;
    }

    return Math.max(
      min,
      Math.min(
        max,
        value
      )
    );
  }

  function sleep(milliseconds){
    if(U.sleep){
      return U.sleep(
        milliseconds
      );
    }

    return new Promise(
      function(resolve){
        window.setTimeout(
          resolve,
          Math.max(
            0,
            Number(
              milliseconds
            ) ||
            0
          )
        );
      }
    );
  }

  function storageGet(key){
    try{
      return text(
        window.localStorage &&
        window.localStorage
          .getItem(key)
      );
    }catch(error){
      return "";
    }
  }

  function storageSet(
    key,
    value
  ){
    try{
      if(window.localStorage){
        window.localStorage
          .setItem(
            key,
            text(value)
          );
      }
    }catch(error){}
  }

  function storageRemove(key){
    try{
      if(window.localStorage){
        window.localStorage
          .removeItem(key);
      }
    }catch(error){}
  }

  function normalizeBaseUrl(value){
    var url =
      text(value)
        .replace(
          /\/+$/,
          ""
        );

    if(!url){
      return "";
    }

    if(
      url.slice(
        -FUNCTIONS_PATH.length
      ) === FUNCTIONS_PATH
    ){
      return url;
    }

    var index =
      url.indexOf(
        FUNCTIONS_PATH +
        "/"
      );

    if(index >= 0){
      return (
        url.slice(
          0,
          index
        ) +
        FUNCTIONS_PATH
      );
    }

    return (
      url +
      FUNCTIONS_PATH
    );
  }

  function queryParameter(){
    var names =
      Array.prototype
        .slice
        .call(arguments);

    var location =
      window.location ||
      {};

    if(
      !location.search ||
      typeof URLSearchParams !==
        "function"
    ){
      return "";
    }

    var params =
      new URLSearchParams(
        location.search
      );

    for(
      var i = 0;
      i < names.length;
      i += 1
    ){
      var value =
        text(
          params.get(
            names[i]
          )
        );

      if(value){
        return value;
      }
    }

    return "";
  }

  function isFileLocal(){
    return !!(
      window.location &&
      window.location.protocol ===
        "file:"
    );
  }

  function isHttpLocal(){
    return !!(
      window.location &&
      [
        "http:",
        "https:"
      ].indexOf(
        window.location.protocol
      ) >= 0 &&
      LOCAL_HOSTS[
        window.location.hostname
      ]
    );
  }

  function isNetlifyDev(){
    return (
      isHttpLocal() &&
      text(
        window.location.port
      ) === "8888"
    );
  }

  function configuredBaseUrl(){
    var value =
      normalizeBaseUrl(
        queryParameter(
          "tablaFunctionsUrl",
          "functionsUrl",
          "apiUrl",
          "baseFunctionsUrl"
        )
      );

    if(!value){
      value =
        normalizeBaseUrl(
          window
            .TABLA_TELEGRAM_FUNCTIONS_URL ||
          window
            .TA_TITULO_ARTICULO_FUNCTIONS_URL ||
          storageGet(
            BASE_URL_KEY
          )
        );
    }

    if(value){
      storageSet(
        BASE_URL_KEY,
        value
      );
    }

    return value;
  }

  function requestBaseUrl(){
    if(
      typeof window.prompt !==
      "function"
    ){
      throw new Error(
        "No se configuró la URL base de Netlify Functions."
      );
    }

    var value =
      normalizeBaseUrl(
        window.prompt(
          "Ingrese la URL base de Netlify Functions para Telegram.\n\n" +
          "Local: " +
          LOCAL_DEFAULT +
          "\n" +
          "Publicada: https://tu-sitio.netlify.app/.netlify/functions",

          LOCAL_DEFAULT
        ) ||
        ""
      );

    if(!value){
      throw new Error(
        "No se configuró la URL base de Netlify Functions."
      );
    }

    storageSet(
      BASE_URL_KEY,
      value
    );

    return value;
  }

  function baseFunctionsPath(
    options
  ){
    options = options || {};

    var explicit =
      normalizeBaseUrl(
        options.baseFunctionsUrl ||
        options.baseUrl
      );

    if(explicit){
      storageSet(
        BASE_URL_KEY,
        explicit
      );

      return explicit;
    }

    if(isNetlifyDev()){
      return FUNCTIONS_PATH;
    }

    if(
      isFileLocal() ||
      isHttpLocal()
    ){
      return (
        configuredBaseUrl() ||
        requestBaseUrl()
      );
    }

    return FUNCTIONS_PATH;
  }

  function adminToken(options){
    options = options || {};

    var value =
      text(
        options.adminToken ||
        queryParameter(
          "taAdminToken",
          "adminToken",
          "tablaAdminToken"
        ) ||
        storageGet(
          ADMIN_TOKEN_KEY
        )
      );

    if(value){
      storageSet(
        ADMIN_TOKEN_KEY,
        value
      );

      return value;
    }

    if(
      typeof window.prompt !==
      "function"
    ){
      throw new Error(
        "No se configuró el token administrativo."
      );
    }

    value =
      text(
        window.prompt(
          "Ingrese el token administrativo para enviar Telegram."
        ) ||
        ""
      );

    if(!value){
      throw new Error(
        "No se configuró el token administrativo."
      );
    }

    storageSet(
      ADMIN_TOKEN_KEY,
      value
    );

    return value;
  }

  function endpoint(options){
    return (
      baseFunctionsPath(
        options
      ) +
      "/" +
      ENDPOINT_NAME
    );
  }

  function cleanChatId(value){
    return text(value)
      .replace(
        /[^0-9-]/g,
        ""
      );
  }

  function retryAfterFrom(
    data,
    response
  ){
    var header =
      response &&
      response.headers
        ? response.headers.get(
            "Retry-After"
          )
        : "";

    var candidates = [
      data &&
        data.retryAfter,

      data &&
        data.retry_after,

      data &&
        data.parameters &&
        data.parameters.retry_after,

      data &&
        data.error &&
        data.error.retry_after,

      header
    ];

    var result = 0;

    candidates.some(
      function(value){
        value = Number(value);

        if(
          isFinite(value) &&
          value > 0
        ){
          result = value;
          return true;
        }

        return false;
      }
    );

    return clamp(
      result,
      0,
      120,
      0
    );
  }

  function requestError(
    response,
    data
  ){
    var error =
      new Error(
        text(
          data &&
          (
            data.error ||
            data.description ||
            data.message
          )
        ) ||
        (
          "Error HTTP " +
          String(
            response &&
            response.status ||
            0
          )
        )
      );

    error.name =
      "TablaTelegramRequestError";

    error.status =
      Number(
        response &&
        response.status ||
        0
      );

    error.retryAfter =
      retryAfterFrom(
        data,
        response
      );

    error.data =
      data || {};

    error.retryable =
      !!(
        error.status === 408 ||
        error.status === 429 ||
        error.status >= 500 ||
        error.retryAfter > 0
      );

    return error;
  }

  async function readJson(response){
    var raw =
      await response.text();

    if(!raw){
      return {};
    }

    try{
      return JSON.parse(raw);
    }catch(error){
      return {
        ok:
          false,

        error:
          "La respuesta del servidor no tiene formato JSON válido.",

        raw:
          raw
      };
    }
  }

  async function call(
    action,
    payload,
    options
  ){
    options = options || {};

    if(
      typeof window.fetch !==
      "function"
    ){
      throw new Error(
        "El navegador no permite realizar la solicitud de Telegram."
      );
    }

    var timeout =
      clamp(
        options.timeoutMs,
        5000,
        120000,
        DEFAULT_TIMEOUT
      );

    var controller =
      typeof AbortController ===
      "function"
        ? new AbortController()
        : null;

    var timer =
      window.setTimeout(
        function(){
          if(controller){
            controller.abort();
          }
        },
        timeout
      );

    try{
      var response =
        await window.fetch(
          endpoint(options),

          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              "x-ta-admin-token":
                adminToken(
                  options
                )
            },

            body:
              JSON.stringify({
                action:
                  action,

                payload:
                  payload || {}
              }),

            signal:
              controller
                ? controller.signal
                : undefined
          }
        );

      var data =
        await readJson(
          response
        );

      if(
        !response.ok ||
        data.ok === false
      ){
        throw requestError(
          response,
          data
        );
      }

      return data;
    }catch(error){
      if(
        error &&
        error.name ===
          "AbortError"
      ){
        var timeoutError =
          new Error(
            "La solicitud de Telegram superó el tiempo de espera."
          );

        timeoutError.name =
          "TablaTelegramTimeoutError";

        timeoutError.retryable =
          true;

        timeoutError.status =
          408;

        throw timeoutError;
      }

      throw error;
    }finally{
      window.clearTimeout(
        timer
      );
    }
  }

  function backoff(attempt){
    return Math.min(
      5000,
      600 *
      Math.pow(
        2,
        attempt
      )
    );
  }

  async function withRetries(
    task,
    options
  ){
    options = options || {};

    var retries =
      Math.floor(
        clamp(
          options.retries,
          0,
          5,
          DEFAULT_RETRIES
        )
      );

    var attempt = 0;

    while(true){
      try{
        return await task(
          attempt
        );
      }catch(error){
        var retryable =
          !!(
            error &&
            (
              error.retryable ||
              error.status === 408 ||
              error.status === 429 ||
              error.status >= 500
            )
          );

        if(
          !retryable ||
          attempt >= retries
        ){
          throw error;
        }

        var delay =
          error.retryAfter
            ? (
                error.retryAfter *
                1000
              )
            : backoff(
                attempt
              );

        if(
          typeof options
            .onRetry ===
          "function"
        ){
          options.onRetry({
            attempt:
              attempt + 1,

            delayMs:
              delay,

            error:
              error
          });
        }

        await sleep(delay);
        attempt += 1;
      }
    }
  }

  async function sendMessage(
    chatId,
    message,
    options
  ){
    options = options || {};

    chatId =
      cleanChatId(chatId);

    message =
      messageText(message);

    if(!chatId){
      throw new Error(
        "El estudiante no tiene chatId de Telegram para envío por bot."
      );
    }

    if(!message){
      throw new Error(
        "El mensaje está vacío."
      );
    }

    return withRetries(
      function(){
        return call(
          "enviarMensaje",

          {
            chatId:
              chatId,

            mensaje:
              message
          },

          options
        );
      },

      options
    );
  }

  function progress(
    options,
    data
  ){
    if(
      options &&
      typeof options
        .onProgress ===
      "function"
    ){
      try{
        options.onProgress(
          data
        );
      }catch(error){}
    }
  }

  async function processItem(
    item,
    index,
    totals,
    options
  ){
    item =
      Object.assign(
        {},
        item || {}
      );

    item.telegramChatId =
      cleanChatId(
        item.telegramChatId ||
        item.chatId
      );

    item.mensaje =
      messageText(
        item.mensaje ||
        item.message
      );

    if(
      !item.telegramChatId ||
      !item.mensaje
    ){
      totals.omitidos += 1;
      totals.processed += 1;

      item.estado =
        "omitido";

      item.error =
        !item.telegramChatId
          ? "Sin chatId"
          : "Mensaje vacío";

      progress(
        options,

        Object.assign(
          {},
          totals,
          {
            index:
              index,

            estado:
              "omitido",

            item:
              item
          }
        )
      );

      return {
        type:
          "omitido",

        item:
          item
      };
    }

    try{
      var data =
        await sendMessage(
          item.telegramChatId,
          item.mensaje,
          options
        );

      item.estado =
        "enviado";

      item.telegramMessageId =
        data.telegramMessageId ||
        data.messageId ||
        (
          data.result &&
          data.result.message_id
        ) ||
        null;

      totals.enviados += 1;
      totals.processed += 1;

      progress(
        options,

        Object.assign(
          {},
          totals,
          {
            index:
              index,

            estado:
              "enviado",

            item:
              item
          }
        )
      );

      return {
        type:
          "enviado",

        item:
          item
      };
    }catch(error){
      item.estado =
        "fallido";

      item.error =
        error &&
        error.message
          ? error.message
          : String(error);

      item.httpStatus =
        error &&
        error.status ||
        0;

      item.retryAfter =
        error &&
        error.retryAfter ||
        0;

      totals.fallidos += 1;
      totals.processed += 1;

      progress(
        options,

        Object.assign(
          {},
          totals,
          {
            index:
              index,

            estado:
              "fallido",

            item:
              item
          }
        )
      );

      return {
        type:
          "fallido",

        item:
          item
      };
    }
  }

  async function sendBatch(
    list,
    options
  ){
    options = options || {};

    var rows =
      Array.isArray(list)
        ? list.slice()
        : [];

    var rate =
      Math.floor(
        clamp(
          options.maxPerSecond,
          1,
          28,
          DEFAULT_RATE
        )
      );

    var sent = [];
    var failed = [];
    var omitted = [];

    var totals = {
      total:
        rows.length,

      processed:
        0,

      enviados:
        0,

      fallidos:
        0,

      omitidos:
        0
    };

    var started =
      Date.now();

    progress(
      options,

      Object.assign(
        {},
        totals,
        {
          estado:
            "iniciando"
        }
      )
    );

    for(
      var offset = 0;
      offset < rows.length;
      offset += rate
    ){
      if(
        typeof options
          .shouldContinue ===
          "function" &&
        options.shouldContinue() ===
          false
      ){
        rows.slice(offset)
          .forEach(function(item){
            var cancelled =
              Object.assign(
                {},
                item,
                {
                  estado:
                    "omitido",

                  error:
                    "Envío cancelado"
                }
              );

            omitted.push(
              cancelled
            );

            totals.omitidos += 1;
            totals.processed += 1;
          });

        break;
      }

      var chunkStarted =
        Date.now();

      var chunk =
        rows.slice(
          offset,
          offset + rate
        );

      var results =
        await Promise.all(
          chunk.map(
            function(
              item,
              index
            ){
              return processItem(
                item,
                offset + index,
                totals,
                options
              );
            }
          )
        );

      results.forEach(
        function(result){
          if(
            result.type ===
            "enviado"
          ){
            sent.push(
              result.item
            );
          }else if(
            result.type ===
            "fallido"
          ){
            failed.push(
              result.item
            );
          }else{
            omitted.push(
              result.item
            );
          }
        }
      );

      if(
        offset +
          chunk.length <
        rows.length
      ){
        var wait =
          Math.max(
            0,
            1000 -
            (
              Date.now() -
              chunkStarted
            )
          );

        if(wait){
          await sleep(wait);
        }
      }
    }

    var result = {
      ok:
        failed.length === 0,

      total:
        rows.length,

      enviados:
        sent,

      fallidos:
        failed,

      omitidos:
        omitted,

      duracionMs:
        Date.now() -
        started,

      maxPerSecond:
        rate,

      resumen: {
        enviados:
          sent.length,

        fallidos:
          failed.length,

        omitidos:
          omitted.length
      }
    };

    progress(
      options,

      Object.assign(
        {},
        totals,
        {
          estado:
            "finalizado",

          result:
            result
        }
      )
    );

    return result;
  }

  function configureBaseUrl(value){
    value =
      normalizeBaseUrl(value);

    if(!value){
      throw new Error(
        "La URL base de Functions no es válida."
      );
    }

    storageSet(
      BASE_URL_KEY,
      value
    );

    return value;
  }

  function status(){
    var base = "";
    var endpointValue = "";
    var error = "";

    try{
      base =
        configuredBaseUrl();

      if(base){
        endpointValue =
          base +
          "/" +
          ENDPOINT_NAME;
      }else if(
        isNetlifyDev() ||
        (
          !isFileLocal() &&
          !isHttpLocal()
        )
      ){
        endpointValue =
          FUNCTIONS_PATH +
          "/" +
          ENDPOINT_NAME;
      }
    }catch(currentError){
      error =
        currentError &&
        currentError.message
          ? currentError.message
          : String(
              currentError
            );
    }

    return {
      ok:
        !error,

      version:
        VERSION,

      endpoint:
        endpointValue,

      baseFunctionsUrl:
        base,

      adminTokenConfigured:
        !!storageGet(
          ADMIN_TOKEN_KEY
        ),

      error:
        error
    };
  }

  window.TablaTelegramApi = {
    version:
      VERSION,

    enviarMensajeTelegram:
      sendMessage,

    sendMessage:
      sendMessage,

    enviarLoteTelegram:
      sendBatch,

    sendBatch:
      sendBatch,

    endpoint:
      endpoint,

    obtenerAdminToken:
      adminToken,

    limpiarChatId:
      cleanChatId,

    retryAfterFrom:
      retryAfterFrom,

    configureBaseUrl:
      configureBaseUrl,

    clearConfiguration:
      function(){
        storageRemove(
          BASE_URL_KEY
        );

        storageRemove(
          ADMIN_TOKEN_KEY
        );

        return true;
      },

    status:
      status,

    sleep:
      sleep
  };
})(window);
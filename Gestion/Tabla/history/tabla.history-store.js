/* =========================================================
Nombre completo: tabla.history-store.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/history/tabla.history-store.js
Función o funciones:
- Guardar y leer el historial local de mensajes de Tabla.
- Migrar de forma segura las claves de versiones anteriores.
- Normalizar registros, evitar duplicados confirmados y limitar el tamaño.
- No contener lógica de interfaz ni cálculos de contadores.
Con qué se conecta:
- tabla.constants.js
- tabla.utils.js
- tabla.history-query.js
- tabla.history.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0";
  var C = window.TablaConstants || {};
  var U = window.TablaUtils || {};

  var STORAGE_KEY =
    "tabla.mensajes.historial.v2";

  var PREVIOUS_KEY =
    "tabla.mensajes.historial.v1";

  var LEGACY_KEY =
    "tabla.telegram.historial.v1";

  var MAX_ITEMS = 2000;
  var MAX_MESSAGE_LENGTH = 800;

  var cache = {
    loaded: false,
    list: [],
    revision: 0,
    migratedFrom: "",
    lastError: ""
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

  function norm(value){
    return U.normalizeKey
      ? U.normalizeKey(value)
      : text(value)
          .normalize("NFD")
          .replace(
            /[\u0300-\u036f]/g,
            ""
          )
          .replace(
            /[^a-z0-9]+/gi,
            ""
          )
          .toLowerCase();
  }

  function now(){
    return U.nowIso
      ? U.nowIso()
      : new Date()
          .toISOString();
  }

  function readRaw(key){
    try{
      var raw =
        window.localStorage
          ? window.localStorage
              .getItem(key)
          : "";

      if(!raw){
        return [];
      }

      var parsed =
        U.safeParse
          ? U.safeParse(
              raw,
              []
            )
          : JSON.parse(raw);

      if(Array.isArray(parsed)){
        return parsed;
      }

      if(
        parsed &&
        Array.isArray(parsed.items)
      ){
        return parsed.items;
      }

      if(
        parsed &&
        Array.isArray(parsed.list)
      ){
        return parsed.list;
      }

      return [];
    }catch(error){
      cache.lastError =
        error &&
        error.message
          ? error.message
          : String(error);

      return [];
    }
  }

  function writeRaw(list){
    try{
      if(window.localStorage){
        window.localStorage
          .setItem(
            STORAGE_KEY,
            JSON.stringify(
              list || []
            )
          );
      }

      cache.lastError = "";
      return true;
    }catch(error){
      cache.lastError =
        error &&
        error.message
          ? error.message
          : String(error);

      return false;
    }
  }

  function canonicalChannel(value){
    var current =
      norm(value);

    if(
      current === "wa" ||
      current === "whatsapp"
    ){
      return "whatsapp";
    }

    if(
      current === "tg" ||
      current === "telegram"
    ){
      return "telegram";
    }

    if(
      current === "email" ||
      current === "mail" ||
      current === "correo"
    ){
      return "mail";
    }

    return (
      current ||
      "telegram"
    );
  }

  function canonicalStatus(value){
    var current =
      norm(value);

    if(
      current === "enviado" ||
      current === "sent" ||
      current === "confirmado" ||
      current === "success" ||
      current === "ok"
    ){
      return "enviado";
    }

    if(
      current === "fallido" ||
      current === "failed" ||
      current === "error"
    ){
      return "fallido";
    }

    if(
      current === "omitido" ||
      current === "skipped" ||
      current === "cancelado"
    ){
      return "omitido";
    }

    if(
      current === "preparado" ||
      current === "abierto" ||
      current === "opened"
    ){
      return "preparado";
    }

    return "pendiente";
  }

  function canonicalCedula(value){
    return U.normalizeCedula
      ? U.normalizeCedula(value)
      : text(value)
          .replace(
            /[^0-9A-Za-z]/g,
            ""
          );
  }

  function canonicalPeriod(value){
    return U.canonicalPeriodId
      ? U.canonicalPeriodId(
          value
        )
      : text(value)
          .replace(
            /_+/g,
            "__"
          );
  }

  function compactMessage(value){
    value = String(
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

    if(
      value.length >
      MAX_MESSAGE_LENGTH
    ){
      return (
        value.slice(
          0,
          MAX_MESSAGE_LENGTH
        ) +
        "…"
      );
    }

    return value;
  }

  function makeId(item){
    item = item || {};

    if(text(item.id)){
      return text(item.id);
    }

    return [
      "tabla-msg",

      text(
        item.fecha ||
        item.createdAt ||
        now()
      ),

      canonicalChannel(
        item.canal ||
        item.channel
      ),

      canonicalCedula(
        item.cedula ||
        item.numeroIdentificacion
      ),

      canonicalPeriod(
        item.periodoId ||
        item.periodId ||
        item.periodo
      ),

      Math.random()
        .toString(36)
        .slice(2, 9)
    ].join("::");
  }

  function normalizeItem(item){
    item =
      item &&
      typeof item === "object"
        ? item
        : {};

    var fecha =
      text(
        item.fecha ||
        item.createdAt ||
        item.sentAt ||
        item.updatedAt ||
        now()
      );

    var cedula =
      canonicalCedula(
        item.cedula ||
        item.numeroIdentificacion ||
        item.identificacion ||
        ""
      );

    var periodoId =
      canonicalPeriod(
        item.periodoId ||
        item.periodId ||
        item.idPeriodo ||
        item.periodoCanonicoId ||
        ""
      );

    var periodo =
      text(
        item.periodo ||
        item.periodoLabel ||
        item.periodLabel ||
        periodoId
      );

    var canal =
      canonicalChannel(
        item.canal ||
        item.channel ||
        "telegram"
      );

    var estado =
      canonicalStatus(
        item.estado ||
        item.status ||
        "pendiente"
      );

    var normalized = {
      id: "",

      fecha:
        fecha,

      createdAt:
        fecha,

      canal:
        canal,

      modo:
        text(
          item.modo ||
          item.mode ||
          "individual"
        ) ||
        "individual",

      accion:
        text(
          item.accion ||
          item.action ||
          ""
        ),

      tipoMensaje:
        text(
          item.tipoMensaje ||
          item.messageType ||
          item.tipo ||
          "requisitos"
        ) ||
        "requisitos",

      tipoLabel:
        text(
          item.tipoLabel ||
          item.messageTypeLabel ||
          item.tipoMensaje ||
          item.tipo ||
          "requisitos"
        ),

      cedula:
        cedula,

      nombre:
        text(
          item.nombre ||
          item.nombres ||
          item.Nombres ||
          ""
        ),

      carrera:
        text(
          item.carrera ||
          item.NombreCarrera ||
          ""
        ),

      periodo:
        periodo,

      periodoId:
        periodoId,

      division:
        text(
          item.division ||
          item.Division ||
          ""
        ),

      correo:
        text(
          item.correo ||
          item.email ||
          item.address ||
          ""
        ),

      telefono:
        text(
          item.telefono ||
          item.phone ||
          item.celular ||
          ""
        ),

      destino:
        text(
          item.destino ||
          item.destination ||
          ""
        ),

      telegramUser:
        text(
          item.telegramUser ||
          item.usuarioTelegram ||
          ""
        ).replace(
          /^@+/,
          ""
        ),

      telegramChatId:
        text(
          item.telegramChatId ||
          item.chatId ||
          ""
        ),

      mensaje:
        compactMessage(
          item.mensaje ||
          item.message ||
          ""
        ),

      estado:
        estado,

      error:
        text(
          item.error ||
          item.errorMessage ||
          ""
        ),

      loteId:
        text(
          item.loteId ||
          item.batchId ||
          ""
        ),

      telegramMessageId:
        item.telegramMessageId ==
        null
          ? null
          : item
              .telegramMessageId
    };

    normalized.id =
      makeId(
        Object.assign(
          {},
          item,
          normalized
        )
      );

    normalized.studentPeriodKey =
      [
        norm(
          normalized.cedula
        ),

        norm(
          normalized.periodoId ||
          normalized.periodo
        )
      ].join("::");

    return normalized;
  }

  function sortList(list){
    return (
      Array.isArray(list)
        ? list
        : []
    )
      .slice()
      .sort(function(a, b){
        var ad =
          Date.parse(
            a &&
            a.fecha ||
            ""
          ) ||
          0;

        var bd =
          Date.parse(
            b &&
            b.fecha ||
            ""
          ) ||
          0;

        return bd - ad;
      });
  }

  function duplicateKey(item){
    item =
      normalizeItem(item);

    if(
      item.telegramMessageId !=
        null &&
      text(
        item.telegramMessageId
      )
    ){
      return [
        "tgmsg",
        item.telegramChatId,
        text(
          item.telegramMessageId
        )
      ].join("::");
    }

    if(
      item.loteId &&
      item.cedula
    ){
      return [
        "lote",
        item.loteId,
        norm(item.cedula),

        norm(
          item.periodoId ||
          item.periodo
        ),

        item.estado
      ].join("::");
    }

    return "";
  }

  function ensureLoaded(){
    if(cache.loaded){
      return cache.list;
    }

    var current =
      readRaw(
        STORAGE_KEY
      );

    var source =
      current;

    if(!source.length){
      var previous =
        readRaw(
          PREVIOUS_KEY
        );

      if(previous.length){
        source = previous;

        cache.migratedFrom =
          PREVIOUS_KEY;
      }else{
        var legacy =
          readRaw(
            LEGACY_KEY
          );

        if(legacy.length){
          source = legacy.map(
            function(item){
              return Object.assign(
                {
                  canal:
                    "telegram"
                },

                item || {}
              );
            }
          );

          cache.migratedFrom =
            LEGACY_KEY;
        }
      }
    }

    cache.list =
      sortList(
        source.map(
          normalizeItem
        )
      ).slice(
        0,
        MAX_ITEMS
      );

    cache.loaded = true;
    cache.revision += 1;

    if(cache.migratedFrom){
      writeRaw(
        cache.list
      );
    }

    return cache.list;
  }

  function read(){
    ensureLoaded();

    return cache.list.slice();
  }

  function write(list){
    cache.list =
      sortList(
        (
          Array.isArray(list)
            ? list
            : []
        ).map(
          normalizeItem
        )
      ).slice(
        0,
        MAX_ITEMS
      );

    cache.loaded = true;
    cache.revision += 1;

    writeRaw(
      cache.list
    );

    return read();
  }

  function findDuplicate(item){
    var wanted =
      duplicateKey(item);

    if(!wanted){
      return -1;
    }

    ensureLoaded();

    for(
      var i = 0;
      i < cache.list.length;
      i += 1
    ){
      if(
        duplicateKey(
          cache.list[i]
        ) === wanted
      ){
        return i;
      }
    }

    return -1;
  }

  function save(item){
    ensureLoaded();

    var normalized =
      normalizeItem(item);

    var duplicateIndex =
      findDuplicate(
        normalized
      );

    if(duplicateIndex >= 0){
      cache.list[
        duplicateIndex
      ] = normalizeItem(
        Object.assign(
          {},
          cache.list[
            duplicateIndex
          ],
          normalized,
          {
            id:
              cache.list[
                duplicateIndex
              ].id,

            fecha:
              normalized.fecha ||
              cache.list[
                duplicateIndex
              ].fecha
          }
        )
      );

      normalized =
        cache.list[
          duplicateIndex
        ];
    }else{
      cache.list.unshift(
        normalized
      );
    }

    write(cache.list);

    return normalized;
  }

  function saveMany(items){
    items =
      Array.isArray(items)
        ? items
        : [];

    var output = [];

    items.forEach(
      function(item){
        output.push(
          save(item)
        );
      }
    );

    return output;
  }

  function removeWhere(predicate){
    if(
      typeof predicate !==
      "function"
    ){
      return read();
    }

    ensureLoaded();

    return write(
      cache.list.filter(
        function(item, index){
          return !predicate(
            item,
            index
          );
        }
      )
    );
  }

  function clear(){
    return write([]);
  }

  function reload(){
    cache.loaded = false;
    cache.list = [];
    cache.migratedFrom = "";

    return read();
  }

  window.TablaHistoryStore = {
    version:
      VERSION,

    storageKey:
      STORAGE_KEY,

    previousKey:
      PREVIOUS_KEY,

    legacyKey:
      LEGACY_KEY,

    maxItems:
      MAX_ITEMS,

    normalize:
      normalizeItem,

    read:
      read,

    list:
      read,

    write:
      write,

    save:
      save,

    guardar:
      save,

    saveMany:
      saveMany,

    guardarVarios:
      saveMany,

    guardarMuchos:
      saveMany,

    removeWhere:
      removeWhere,

    clear:
      clear,

    limpiar:
      clear,

    reload:
      reload,

    duplicateKey:
      duplicateKey,

    status:
      function(){
        ensureLoaded();

        return {
          ok:
            !cache.lastError,

          version:
            VERSION,

          storageKey:
            STORAGE_KEY,

          total:
            cache.list.length,

          revision:
            cache.revision,

          migratedFrom:
            cache.migratedFrom,

          lastError:
            cache.lastError
        };
      }
  };
})(window);
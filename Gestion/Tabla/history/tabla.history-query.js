/* =========================================================
Nombre completo: tabla.history-query.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/history/tabla.history-query.js
Función o funciones:
- Consultar el historial sin leer ni escribir directamente localStorage.
- Separar estudiantes mediante cédula + período.
- Contar únicamente acciones válidas por canal.
- Obtener el último contacto, resúmenes y listas filtradas.
Con qué se conecta:
- tabla.utils.js
- tabla.history-store.js
- tabla.actions.js
- tabla.history.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0";
  var U = window.TablaUtils || {};

  var memo = {
    revision: -1,

    byStudentPeriod:
      Object.create(null),

    byCedula:
      Object.create(null),

    list: []
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

  function store(){
    return (
      window.TablaHistoryStore ||
      null
    );
  }

  function channel(value){
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

  function channelLabel(value){
    var current =
      channel(value);

    if(current === "whatsapp"){
      return "WhatsApp";
    }

    if(current === "telegram"){
      return "Telegram";
    }

    if(current === "mail"){
      return "Correo";
    }

    return (
      text(value) ||
      "Mensaje"
    );
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

  function cedulaFromRow(row){
    row = row || {};

    return canonicalCedula(
      row._cedula ||
      row.cedula ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.identificacion ||
      row
    );
  }

  function periodFromRow(row){
    row = row || {};

    return canonicalPeriod(
      row._periodoId ||
      row.periodoId ||
      row.periodId ||
      row._bl2PeriodoId ||
      row.periodoCanonicoId ||
      ""
    );
  }

  function periodFromItem(item){
    item = item || {};

    return canonicalPeriod(
      item.periodoId ||
      item.periodId ||
      item.periodo ||
      ""
    );
  }

  function studentPeriodKey(
    cedula,
    period
  ){
    cedula =
      canonicalCedula(
        cedula
      );

    period =
      canonicalPeriod(
        period
      );

    return [
      norm(cedula),
      norm(period)
    ].join("::");
  }

  function keyFromRow(row){
    return studentPeriodKey(
      cedulaFromRow(row),
      periodFromRow(row)
    );
  }

  function itemStudentPeriodKey(
    item
  ){
    return studentPeriodKey(
      item &&
      item.cedula,

      periodFromItem(item)
    );
  }

  function cedulaKey(value){
    return norm(
      canonicalCedula(value)
    );
  }

  function isCountable(item){
    item = item || {};

    var currentChannel =
      channel(item.canal);

    var status =
      norm(item.estado);

    if(
      currentChannel ===
      "telegram"
    ){
      return (
        status ===
        "enviado"
      );
    }

    if(
      currentChannel ===
        "whatsapp" ||
      currentChannel ===
        "mail"
    ){
      return (
        status === "preparado" ||
        status === "enviado" ||
        norm(item.accion) ===
          "abierto"
      );
    }

    return (
      status ===
      "enviado"
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

  function ensureRecord(
    index,
    key
  ){
    if(!index[key]){
      index[key] = {
        items: [],
        counts: emptyCounts(),
        last: null
      };
    }

    return index[key];
  }

  function addToRecord(
    record,
    item
  ){
    record.items.push(item);

    if(
      !record.last ||
      (
        Date.parse(
          item.fecha ||
          ""
        ) ||
        0
      ) >
      (
        Date.parse(
          record.last.fecha ||
          ""
        ) ||
        0
      )
    ){
      record.last = item;
    }

    if(!isCountable(item)){
      return;
    }

    var current =
      channel(item.canal);

    if(current === "whatsapp"){
      record.counts.wa += 1;

      record.counts
        .whatsapp += 1;
    }else if(
      current === "telegram"
    ){
      record.counts.tg += 1;

      record.counts
        .telegram += 1;
    }else if(
      current === "mail"
    ){
      record.counts.email += 1;

      record.counts.mail += 1;
    }

    record.counts.total += 1;
  }

  function rebuild(){
    var currentStore =
      store();

    var list =
      currentStore &&
      currentStore.read
        ? currentStore.read()
        : [];

    var storeStatus =
      currentStore &&
      currentStore.status
        ? currentStore.status()
        : {
            revision:
              list.length
          };

    if(
      memo.revision ===
        storeStatus.revision &&
      memo.list.length ===
        list.length
    ){
      return memo;
    }

    var byStudentPeriod =
      Object.create(null);

    var byCedula =
      Object.create(null);

    list.forEach(
      function(item){
        var studentKey =
          itemStudentPeriodKey(
            item
          );

        var currentCedulaKey =
          cedulaKey(
            item.cedula
          );

        addToRecord(
          ensureRecord(
            byStudentPeriod,
            studentKey
          ),

          item
        );

        addToRecord(
          ensureRecord(
            byCedula,
            currentCedulaKey
          ),

          item
        );
      }
    );

    memo = {
      revision:
        storeStatus.revision,

      byStudentPeriod:
        byStudentPeriod,

      byCedula:
        byCedula,

      list:
        list
    };

    return memo;
  }

  function read(){
    return rebuild()
      .list
      .slice();
  }

  function samePeriod(a, b){
    if(U.samePeriod){
      return U.samePeriod(
        a,
        b
      );
    }

    a = canonicalPeriod(a);
    b = canonicalPeriod(b);

    return (
      !b ||
      a === b
    );
  }

  function forPeriod(periodId){
    periodId =
      canonicalPeriod(
        periodId
      );

    if(!periodId){
      return read();
    }

    return read()
      .filter(function(item){
        return samePeriod(
          periodFromItem(item),
          periodId
        );
      });
  }

  function recordFor(
    rowOrCedula
  ){
    var indexes =
      rebuild();

    if(
      rowOrCedula &&
      typeof rowOrCedula ===
        "object"
    ){
      var rowPeriod =
        periodFromRow(
          rowOrCedula
        );

      var rowCedula =
        cedulaFromRow(
          rowOrCedula
        );

      if(rowPeriod){
        return (
          indexes
            .byStudentPeriod[
              studentPeriodKey(
                rowCedula,
                rowPeriod
              )
            ] ||
          null
        );
      }

      return (
        indexes.byCedula[
          cedulaKey(
            rowCedula
          )
        ] ||
        null
      );
    }

    return (
      indexes.byCedula[
        cedulaKey(
          rowOrCedula
        )
      ] ||
      null
    );
  }

  function forStudent(
    rowOrCedula
  ){
    var record =
      recordFor(
        rowOrCedula
      );

    return record
      ? record.items.slice()
      : [];
  }

  function countsForStudent(
    rowOrCedula
  ){
    var record =
      recordFor(
        rowOrCedula
      );

    return record
      ? Object.assign(
          {},
          record.counts
        )
      : emptyCounts();
  }

  function lastForStudent(
    rowOrCedula
  ){
    var record =
      recordFor(
        rowOrCedula
      );

    return record
      ? record.last
      : null;
  }

  function shortDay(value){
    try{
      return value
        ? new Date(value)
            .toLocaleDateString(
              "es-EC",
              {
                day:
                  "2-digit",

                month:
                  "2-digit"
              }
            )
        : "—";
    }catch(error){
      return (
        text(value)
          .slice(0, 10) ||
        "—"
      );
    }
  }

  function lastLabel(
    rowOrCedula
  ){
    var item =
      lastForStudent(
        rowOrCedula
      );

    if(!item){
      return "—";
    }

    return [
      channelLabel(
        item.canal
      ),

      item.tipoLabel ||
      item.tipoMensaje ||
      "Mensaje",

      shortDay(
        item.fecha
      )
    ].join(" · ");
  }

  function preloadForRows(){
    rebuild();
    return true;
  }

  function summary(list){
    list =
      Array.isArray(list)
        ? list
        : read();

    var result = {
      total: list.length,
      whatsapp: 0,
      telegram: 0,
      mail: 0,
      enviados: 0,
      preparados: 0,
      fallidos: 0,
      omitidos: 0,
      pendientes: 0,
      countable: 0,
      estudiantes: 0
    };

    var students =
      Object.create(null);

    list.forEach(
      function(item){
        var currentChannel =
          channel(item.canal);

        var currentStatus =
          norm(item.estado);

        if(
          currentChannel ===
          "whatsapp"
        ){
          result.whatsapp += 1;
        }else if(
          currentChannel ===
          "telegram"
        ){
          result.telegram += 1;
        }else if(
          currentChannel ===
          "mail"
        ){
          result.mail += 1;
        }

        if(
          currentStatus ===
          "enviado"
        ){
          result.enviados += 1;
        }else if(
          currentStatus ===
          "preparado"
        ){
          result.preparados += 1;
        }else if(
          currentStatus ===
          "fallido"
        ){
          result.fallidos += 1;
        }else if(
          currentStatus ===
          "omitido"
        ){
          result.omitidos += 1;
        }else{
          result.pendientes += 1;
        }

        if(isCountable(item)){
          result.countable += 1;
        }

        students[
          itemStudentPeriodKey(
            item
          )
        ] = true;
      }
    );

    result.estudiantes =
      Object.keys(students)
        .length;

    return result;
  }

  window.TablaHistoryQuery = {
    version:
      VERSION,

    channel:
      channel,

    channelLabel:
      channelLabel,

    isCountable:
      isCountable,

    studentPeriodKey:
      studentPeriodKey,

    keyFromRow:
      keyFromRow,

    itemStudentPeriodKey:
      itemStudentPeriodKey,

    read:
      read,

    list:
      read,

    forPeriod:
      forPeriod,

    forStudent:
      forStudent,

    countsForStudent:
      countsForStudent,

    lastForStudent:
      lastForStudent,

    lastLabel:
      lastLabel,

    preloadForRows:
      preloadForRows,

    summary:
      summary,

    invalidate:
      function(){
        memo.revision = -1;
        memo.list = [];

        memo.byStudentPeriod =
          Object.create(null);

        memo.byCedula =
          Object.create(null);
      }
  };
})(window);
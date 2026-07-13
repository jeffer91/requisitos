/* =========================================================
Nombre completo: tabla.selection.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/mass/tabla.selection.js
Función o funciones:
- Seleccionar estudiantes para Telegram masivo.
- Identificar cada registro mediante cédula + período.
- Evitar duplicados y conservar el registro más completo.
- Separar estudiantes con usuario, chatId y sin Telegram.
Con qué se conecta:
- tabla.utils.js
- tabla.data-normalizer.js
- tabla.events.js
- tabla.mass.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0";
  var C = window.TablaConstants || {};
  var U = window.TablaUtils || {};
  var N =
    window.TablaDataNormalizer ||
    {};
  var E = window.TablaEvents || null;

  var state = {
    rows:
      [],

    selected:
      Object.create(null),

    periodId:
      "",

    periodLabel:
      "",

    revision:
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

  function keyText(value){
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

  function telegramInfo(row){
    row = row || {};

    if(N.telegramInfo){
      var info =
        N.telegramInfo(row);

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

  function cedula(row){
    row = row || {};

    var value =
      row._cedula ||
      row.cedula ||
      row.Cedula ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.identificacion ||
      row.Identificacion ||
      "";

    return U.normalizeCedula
      ? U.normalizeCedula(
          value
        )
      : text(value);
  }

  function periodId(row){
    row = row || {};

    var value =
      row._periodoId ||
      row.periodoCanonicoId ||
      row.periodoId ||
      row.periodId ||
      row._bl2PeriodoId ||
      state.periodId ||
      "";

    return U.canonicalPeriodId
      ? U.canonicalPeriodId(
          value
        )
      : text(value);
  }

  function periodLabel(row){
    row = row || {};

    return text(
      row._periodo ||
      row.periodoLabel ||
      row.periodo ||
      row.Periodo ||
      row._bl2Periodo ||
      state.periodLabel ||
      periodId(row)
    );
  }

  function rawId(row){
    row = row || {};

    return text(
      row.idEstudiantePeriodo ||
      row.studentPeriodId ||
      row.studentId ||
      row._id ||
      row.id ||
      row.docId ||
      ""
    );
  }

  function identity(row, index){
    var studentCedula =
      keyText(
        cedula(row)
      );

    var studentPeriod =
      keyText(
        periodId(row) ||
        periodLabel(row)
      );

    var id =
      keyText(
        rawId(row)
      );

    if(studentCedula){
      return (
        studentCedula +
        "::" +
        (
          studentPeriod ||
          "sinperiodo"
        )
      );
    }

    if(id){
      return (
        "id::" +
        id +
        "::" +
        (
          studentPeriod ||
          "sinperiodo"
        )
      );
    }

    return (
      "fila::" +
      String(
        index == null
          ? 0
          : index
      )
    );
  }

  function rowKey(row, index){
    return (
      text(
        row &&
        row._tablaSelectionKey
      ) ||
      identity(
        row,
        index
      )
    );
  }

  function quality(row){
    row = row || {};

    var telegram =
      telegramInfo(row);

    var score =
      telegram.chatId
        ? 100
        : telegram.user
          ? 50
          : 0;

    if(
      text(
        row._nombres ||
        row.Nombres
      )
    ){
      score += 5;
    }

    if(
      text(
        row._carrera ||
        row.NombreCarrera
      )
    ){
      score += 3;
    }

    if(
      text(
        row._correo ||
        row.CorreoPersonal
      )
    ){
      score += 1;
    }

    return score;
  }

  function mergeRows(
    base,
    incoming
  ){
    var output =
      Object.assign(
        {},
        base || {}
      );

    Object.keys(
      incoming || {}
    ).forEach(function(field){
      var value =
        incoming[field];

      if(
        value != null &&
        (
          typeof value ===
            "object" ||
          text(value) !== ""
        )
      ){
        output[field] =
          value;
      }
    });

    return output;
  }

  function uniqueRows(rows){
    var map =
      Object.create(null);

    var order = [];

    (
      Array.isArray(rows)
        ? rows
        : []
    ).forEach(function(
      row,
      index
    ){
      var item =
        Object.assign(
          {},
          row || {}
        );

      var id =
        identity(
          item,
          index
        );

      if(!map[id]){
        map[id] = item;
        order.push(id);
        return;
      }

      var current =
        map[id];

      map[id] =
        quality(item) >=
        quality(current)
          ? mergeRows(
              current,
              item
            )
          : mergeRows(
              item,
              current
            );
    });

    return order.map(
      function(id, index){
        var item =
          Object.assign(
            {},
            map[id]
          );

        item._tablaSelectionKey =
          id;

        item._tablaSelectionIndex =
          index;

        item._tablaTelegramInfo =
          telegramInfo(item);

        return item;
      }
    );
  }

  function selectedRows(){
    return state.rows
      .filter(function(row){
        return !!state.selected[
          row._tablaSelectionKey
        ];
      });
  }

  function filterRows(
    rows,
    predicate
  ){
    return rows.filter(
      function(row){
        return predicate(
          row._tablaTelegramInfo ||
          telegramInfo(row),
          row
        );
      }
    );
  }

  function withTelegram(){
    return filterRows(
      state.rows,
      function(info){
        return !!info.hasTelegram;
      }
    );
  }

  function withBot(){
    return filterRows(
      state.rows,
      function(info){
        return !!info.canSendByBot;
      }
    );
  }

  function withoutTelegram(){
    return filterRows(
      state.rows,
      function(info){
        return !info.hasTelegram;
      }
    );
  }

  function selectedWithTelegram(){
    return filterRows(
      selectedRows(),
      function(info){
        return !!info.hasTelegram;
      }
    );
  }

  function selectedWithBot(){
    return filterRows(
      selectedRows(),
      function(info){
        return !!info.canSendByBot;
      }
    );
  }

  function selectedWithoutTelegram(){
    return filterRows(
      selectedRows(),
      function(info){
        return !info.hasTelegram;
      }
    );
  }

  function selectedWithoutBot(){
    return filterRows(
      selectedRows(),
      function(info){
        return !info.canSendByBot;
      }
    );
  }

  function summary(){
    return {
      total:
        state.rows.length,

      conTelegram:
        withTelegram().length,

      conChatId:
        withBot().length,

      sinTelegram:
        withoutTelegram().length,

      seleccionados:
        selectedRows().length,

      seleccionadosConTelegram:
        selectedWithTelegram()
          .length,

      seleccionadosConChatId:
        selectedWithBot().length,

      seleccionadosSinTelegram:
        selectedWithoutTelegram()
          .length,

      seleccionadosSinChatId:
        selectedWithoutBot()
          .length
    };
  }

  function signature(){
    return selectedRows()
      .map(function(row){
        return (
          row._tablaSelectionKey
        );
      })
      .sort()
      .join("|");
  }

  function snapshot(){
    return {
      rows:
        state.rows.slice(),

      selected:
        Object.assign(
          {},
          state.selected
        ),

      selectedRows:
        selectedRows(),

      selectedKeys:
        Object.keys(
          state.selected
        ),

      summary:
        summary(),

      periodId:
        state.periodId,

      periodLabel:
        state.periodLabel,

      signature:
        signature(),

      revision:
        state.revision
    };
  }

  function emit(reason){
    state.revision += 1;

    var current =
      snapshot();

    if(
      E &&
      typeof E.emit ===
        "function"
    ){
      E.emit(
        (
          C.events &&
          C.events.selectionUpdated
        ) ||
        "tabla:selection-updated",

        {
          reason:
            reason ||
            "selection",

          state:
            current,

          revision:
            state.revision
        }
      );
    }

    return current;
  }

  function create(
    rows,
    options
  ){
    options = options || {};

    state.periodId =
      U.canonicalPeriodId
        ? U.canonicalPeriodId(
            options.periodId ||
            options.periodoId ||
            ""
          )
        : text(
            options.periodId ||
            options.periodoId
          );

    state.periodLabel =
      text(
        options.periodLabel ||
        options.periodo ||
        state.periodId
      );

    state.rows =
      uniqueRows(rows);

    state.selected =
      Object.create(null);

    state.rows.forEach(
      function(row){
        var info =
          row._tablaTelegramInfo ||
          telegramInfo(row);

        var selected = false;

        if(
          options.selectAll ===
          true
        ){
          selected = true;
        }else if(
          options.selectWithTelegram ===
          true
        ){
          selected =
            info.hasTelegram;
        }else if(
          options.selectWithBot !==
          false
        ){
          selected =
            info.canSendByBot;
        }

        if(selected){
          state.selected[
            row._tablaSelectionKey
          ] = true;
        }
      }
    );

    return emit("create");
  }

  function hasKey(id){
    return state.rows.some(
      function(row){
        return (
          row._tablaSelectionKey ===
          id
        );
      }
    );
  }

  function toggle(
    id,
    checked
  ){
    id = text(id);

    if(
      !id ||
      !hasKey(id)
    ){
      return snapshot();
    }

    var next =
      checked === undefined
        ? !state.selected[id]
        : !!checked;

    if(next){
      state.selected[id] =
        true;
    }else{
      delete state.selected[id];
    }

    return emit("toggle");
  }

  function selectWhere(
    predicate,
    reason
  ){
    state.selected =
      Object.create(null);

    state.rows.forEach(
      function(row){
        var info =
          row._tablaTelegramInfo ||
          telegramInfo(row);

        if(
          predicate(
            info,
            row
          )
        ){
          state.selected[
            row._tablaSelectionKey
          ] = true;
        }
      }
    );

    return emit(
      reason ||
      "select"
    );
  }

  function selectAll(){
    return selectWhere(
      function(){
        return true;
      },
      "select-all"
    );
  }

  function selectWithTelegram(){
    return selectWhere(
      function(info){
        return !!info.hasTelegram;
      },
      "select-with-telegram"
    );
  }

  function selectWithBot(){
    return selectWhere(
      function(info){
        return !!info.canSendByBot;
      },
      "select-with-bot"
    );
  }

  function clear(){
    state.selected =
      Object.create(null);

    return emit("clear");
  }

  function getByKey(id){
    id = text(id);

    return state.rows
      .filter(function(row){
        return (
          row._tablaSelectionKey ===
          id
        );
      })[0] ||
      null;
  }

  window.TablaSelection = {
    version:
      VERSION,

    create:
      create,

    toggle:
      toggle,

    selectAll:
      selectAll,

    selectWithTelegram:
      selectWithTelegram,

    selectWithBot:
      selectWithBot,

    clear:
      clear,

    getState:
      snapshot,

    selectedRows:
      selectedRows,

    selectedKeys:
      function(){
        return Object.keys(
          state.selected
        );
      },

    getByKey:
      getByKey,

    withTelegram:
      withTelegram,

    withBot:
      withBot,

    withoutTelegram:
      withoutTelegram,

    selectedWithTelegram:
      selectedWithTelegram,

    selectedWithBot:
      selectedWithBot,

    selectedWithoutTelegram:
      selectedWithoutTelegram,

    selectedWithoutBot:
      selectedWithoutBot,

    summary:
      summary,

    signature:
      signature,

    telegramInfo:
      telegramInfo,

    key:
      rowKey,

    identity:
      identity
  };
})(window);
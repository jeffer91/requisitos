/* =========================================================
Nombre completo: tabla.selection.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.selection.js
Función o funciones:
- Manejar selección manual de estudiantes filtrados en Tabla.
- Seleccionar todos, solo con Telegram o limpiar selección.
- Separar estudiantes con Telegram, con chatId para bot y sin Telegram.
- Entregar seleccionados aptos para envío masivo por bot.
Con qué se conecta:
- tabla.core.js
- tabla.mass.js
========================================================= */
(function(window){
  "use strict";

  var state={rows:[],selected:{}};

  function text(value){return String(value==null?"":value).trim();}
  function telegramInfo(row){
    if(window.TablaCore&&typeof window.TablaCore.telegramInfo==="function")return window.TablaCore.telegramInfo(row||{});
    return {user:text(row&&row._telegramUser),chatId:text(row&&row._telegramChatId),hasTelegram:!!(row&&(row._telegramUser||row._telegramChatId)),canSendByBot:!!(row&&row._telegramChatId)};
  }
  function key(row,index){
    var base=text(row&&row._cedula)||text(row&&row.cedula)||text(row&&row.numeroIdentificacion)||text(row&&row._id)||text(row&&row.docId)||text(row&&row._bl2Id);
    return base||("fila_"+String(index));
  }
  function withKeys(rows){
    return (Array.isArray(rows)?rows:[]).map(function(row,index){
      var item=Object.assign({},row||{});
      item._tablaSelectionKey=key(item,index);
      item._tablaSelectionIndex=index;
      item._tablaTelegramInfo=telegramInfo(item);
      return item;
    });
  }
  function create(rows,options){
    options=options||{};
    state.rows=withKeys(rows);
    state.selected={};
    state.rows.forEach(function(row){
      var tg=row._tablaTelegramInfo||telegramInfo(row);
      if(options.selectAll||options.selectWithBot!==false&&tg.canSendByBot){
        state.selected[row._tablaSelectionKey]=true;
      }
    });
    return getState();
  }
  function toggle(id,checked){
    var k=text(id);
    if(!k)return getState();
    if(checked===undefined)state.selected[k]=!state.selected[k];
    else state.selected[k]=!!checked;
    return getState();
  }
  function selectAll(){state.rows.forEach(function(row){state.selected[row._tablaSelectionKey]=true;});return getState();}
  function selectWithTelegram(){state.selected={};state.rows.forEach(function(row){var tg=row._tablaTelegramInfo||telegramInfo(row);if(tg.hasTelegram)state.selected[row._tablaSelectionKey]=true;});return getState();}
  function selectWithBot(){state.selected={};state.rows.forEach(function(row){var tg=row._tablaTelegramInfo||telegramInfo(row);if(tg.canSendByBot)state.selected[row._tablaSelectionKey]=true;});return getState();}
  function clear(){state.selected={};return getState();}
  function selectedRows(){return state.rows.filter(function(row){return !!state.selected[row._tablaSelectionKey];});}
  function withTelegram(){return state.rows.filter(function(row){var tg=row._tablaTelegramInfo||telegramInfo(row);return !!tg.hasTelegram;});}
  function withBot(){return state.rows.filter(function(row){var tg=row._tablaTelegramInfo||telegramInfo(row);return !!tg.canSendByBot;});}
  function withoutTelegram(){return state.rows.filter(function(row){var tg=row._tablaTelegramInfo||telegramInfo(row);return !tg.hasTelegram;});}
  function selectedWithTelegram(){return selectedRows().filter(function(row){var tg=row._tablaTelegramInfo||telegramInfo(row);return !!tg.hasTelegram;});}
  function selectedWithBot(){return selectedRows().filter(function(row){var tg=row._tablaTelegramInfo||telegramInfo(row);return !!tg.canSendByBot;});}
  function selectedWithoutTelegram(){return selectedRows().filter(function(row){var tg=row._tablaTelegramInfo||telegramInfo(row);return !tg.hasTelegram;});}
  function selectedWithoutBot(){return selectedRows().filter(function(row){var tg=row._tablaTelegramInfo||telegramInfo(row);return !tg.canSendByBot;});}
  function summary(){
    return {
      total:state.rows.length,
      conTelegram:withTelegram().length,
      conChatId:withBot().length,
      sinTelegram:withoutTelegram().length,
      seleccionados:selectedRows().length,
      seleccionadosConTelegram:selectedWithTelegram().length,
      seleccionadosConChatId:selectedWithBot().length,
      seleccionadosSinTelegram:selectedWithoutTelegram().length,
      seleccionadosSinChatId:selectedWithoutBot().length
    };
  }
  function getState(){return {rows:state.rows.slice(),selected:Object.assign({},state.selected),selectedRows:selectedRows(),summary:summary()};}

  window.TablaSelection={create:create,toggle:toggle,selectAll:selectAll,selectWithTelegram:selectWithTelegram,selectWithBot:selectWithBot,clear:clear,getState:getState,selectedRows:selectedRows,withTelegram:withTelegram,withBot:withBot,withoutTelegram:withoutTelegram,selectedWithTelegram:selectedWithTelegram,selectedWithBot:selectedWithBot,selectedWithoutTelegram:selectedWithoutTelegram,selectedWithoutBot:selectedWithoutBot,summary:summary,telegramInfo:telegramInfo,key:key};
})(window);

/* =========================================================
Nombre completo: tabla.events.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/core/tabla.events.js
Función o funciones:
- Centralizar los eventos internos de la pantalla Tabla.
- Permitir suscripciones, emisiones y escuchas de una sola ejecución.
- Agrupar los eventos provenientes de BDLocal sin duplicar listeners.
Con qué se conecta:
- tabla.constants.js
- tabla.utils.js
- tabla.state.js
- tabla.data-guard.js
- tabla.app.js y módulos de interfaz.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0";

  var C =
    window.TablaConstants ||
    {};

  var U =
    window.TablaUtils ||
    {};

  var EVENTS =
    C.events ||
    {};

  var BASE_EVENTS =
    Array.isArray(C.baseEvents)
      ? C.baseEvents.slice()
      : [];

  var subscriptions = [];
  var baseSubscriptions = [];

  function text(value){
    return U.text
      ? U.text(value)
      : String(
          value == null
            ? ""
            : value
        ).trim();
  }

  function customEvent(
    name,
    detail
  ){
    try{
      return new CustomEvent(
        name,
        {
          detail: detail
        }
      );
    }catch(error){
      var event =
        window.document
          .createEvent(
            "CustomEvent"
          );

      event.initCustomEvent(
        name,
        false,
        false,
        detail
      );

      return event;
    }
  }

  function on(
    name,
    handler,
    options
  ){
    name = text(name);

    if(
      !name ||
      typeof handler !== "function"
    ){
      return function(){};
    }

    var target =
      options &&
      options.target
        ? options.target
        : window;

    var listenerOptions =
      options &&
      options.listenerOptions
        ? options.listenerOptions
        : false;

    target.addEventListener(
      name,
      handler,
      listenerOptions
    );

    var record = {
      name: name,
      handler: handler,
      target: target,
      listenerOptions:
        listenerOptions
    };

    subscriptions.push(
      record
    );

    return function(){
      off(
        name,
        handler,
        target,
        listenerOptions
      );
    };
  }

  function off(
    name,
    handler,
    target,
    listenerOptions
  ){
    target =
      target ||
      window;

    try{
      target.removeEventListener(
        name,
        handler,
        listenerOptions || false
      );
    }catch(error){}

    subscriptions =
      subscriptions.filter(
        function(item){
          return !(
            item.name === name &&
            item.handler === handler &&
            item.target === target
          );
        }
      );
  }

  function once(
    name,
    handler,
    options
  ){
    var unsubscribe =
      function(){};

    function wrapped(event){
      unsubscribe();
      handler(event);
    }

    unsubscribe = on(
      name,
      wrapped,
      options
    );

    return unsubscribe;
  }

  function emit(
    name,
    detail,
    options
  ){
    name = text(name);

    if(!name){
      return false;
    }

    var target =
      options &&
      options.target
        ? options.target
        : window;

    var payload =
      detail &&
      typeof detail === "object"
        ? Object.assign(
            {},
            detail
          )
        : {
            value: detail
          };

    if(!payload.at){
      payload.at =
        U.nowIso
          ? U.nowIso()
          : new Date()
              .toISOString();
    }

    try{
      return target.dispatchEvent(
        customEvent(
          name,
          payload
        )
      );
    }catch(error){
      return false;
    }
  }

  function emitKnown(
    key,
    detail
  ){
    return emit(
      EVENTS[key] || key,
      detail
    );
  }

  function listenBase(handler){
    if(
      typeof handler !== "function"
    ){
      return function(){};
    }

    stopBase();

    BASE_EVENTS.forEach(
      function(name){
        var unsubscribe = on(
          name,
          function(event){
            handler({
              name: name,
              event: event,

              detail:
                event &&
                event.detail
                  ? event.detail
                  : {}
            });
          }
        );

        baseSubscriptions.push(
          unsubscribe
        );
      }
    );

    var storageUnsubscribe =
      on(
        "storage",
        function(event){
          var keys =
            C.storage ||
            {};

          var watched = [
            keys.centralCache,
            keys.legacySnapshot,
            keys.oldSnapshot
          ].filter(Boolean);

          if(
            !event ||
            watched.indexOf(
              event.key
            ) >= 0
          ){
            handler({
              name: "storage",
              event: event,

              detail: {
                key:
                  event &&
                  event.key ||
                  "",

                oldValue:
                  event &&
                  event.oldValue,

                newValue:
                  event &&
                  event.newValue
              }
            });
          }
        }
      );

    baseSubscriptions.push(
      storageUnsubscribe
    );

    return function(){
      stopBase();
    };
  }

  function stopBase(){
    baseSubscriptions.forEach(
      function(unsubscribe){
        try{
          unsubscribe();
        }catch(error){}
      }
    );

    baseSubscriptions = [];
  }

  function destroy(){
    stopBase();

    subscriptions
      .slice()
      .forEach(function(item){
        off(
          item.name,
          item.handler,
          item.target,
          item.listenerOptions
        );
      });

    subscriptions = [];
  }

  window.TablaEvents = {
    version: VERSION,

    names:
      EVENTS,

    baseNames:
      BASE_EVENTS,

    on:
      on,

    off:
      off,

    once:
      once,

    emit:
      emit,

    emitKnown:
      emitKnown,

    listenBase:
      listenBase,

    stopBase:
      stopBase,

    destroy:
      destroy,

    requestRender:
      function(detail){
        return emit(
          EVENTS.renderRequested ||
            "tabla:render-requested",

          detail || {}
        );
      },

    dataUpdated:
      function(detail){
        return emit(
          EVENTS.dataUpdated ||
            "tabla:data-updated",

          detail || {}
        );
      },

    error:
      function(error, detail){
        detail = Object.assign(
          {},
          detail || {},
          {
            message:
              error &&
              error.message
                ? error.message
                : text(error),

            error:
              error ||
              null
          }
        );

        return emit(
          EVENTS.error ||
            "tabla:error",

          detail
        );
      }
  };
})(window);
/* =========================================================
Nombre completo: tabla.email.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/communication/tabla.email.js
Función o funciones:
- Validar el correo del estudiante.
- Construir asunto, cuerpo y enlace mailto sin registrar historial directamente.
- Devolver un resultado uniforme para tabla.actions.js.
Con qué se conecta:
- tabla.utils.js
- tabla.message.js
- tabla.actions.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0";
  var U = window.TablaUtils || {};

  function text(value){
    return U.text
      ? U.text(value)
      : String(
          value == null
            ? ""
            : value
        ).trim();
  }

  function normalizeEmail(value){
    return U.normalizeEmail
      ? U.normalizeEmail(value)
      : text(value)
          .toLowerCase();
  }

  function addressOf(row){
    row = row || {};

    return normalizeEmail(
      row._correo ||
      row.CorreoPersonal ||
      row.correoPersonal ||
      row.CorreoInstitucional ||
      row.correoInstitucional ||
      row.correo ||
      row.email ||
      row.Email ||
      ""
    );
  }

  function isValid(address){
    return U.isEmail
      ? U.isEmail(address)
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          normalizeEmail(
            address
          )
        );
  }

  function subjectFor(
    row,
    type,
    options
  ){
    options = options || {};

    if(text(options.subject)){
      return text(
        options.subject
      );
    }

    if(
      window.TablaMessage &&
      typeof window.TablaMessage
        .asunto === "function"
    ){
      return window.TablaMessage
        .asunto(
          row || {},
          type ||
            "requisitos"
        );
    }

    return "Proceso de titulación";
  }

  function buildUrl(
    row,
    type,
    message,
    options
  ){
    var address =
      addressOf(row);

    if(!isValid(address)){
      return "";
    }

    var subject =
      subjectFor(
        row,
        type,
        options
      );

    return (
      "mailto:" +
      encodeURIComponent(
        address
      ) +
      "?subject=" +
      encodeURIComponent(
        subject
      ) +
      "&body=" +
      encodeURIComponent(
        text(message)
      )
    );
  }

  function open(
    row,
    type,
    message,
    options
  ){
    var address =
      addressOf(row);

    var url =
      buildUrl(
        row,
        type,
        message,
        options
      );

    if(!url){
      return {
        ok:
          false,

        opened:
          false,

        address:
          address,

        url:
          "",

        message:
          address
            ? "El correo registrado no es válido."
            : "Sin correo registrado."
      };
    }

    try{
      var opened =
        U.openWindow
          ? U.openWindow(url)
          : !!window.open(
              url,
              "_blank",
              "noopener,noreferrer"
            );

      return {
        ok:
          opened,

        opened:
          opened,

        address:
          address,

        url:
          url,

        subject:
          subjectFor(
            row,
            type,
            options
          ),

        message:
          opened
            ? "Correo abierto con el mensaje preparado."
            : "El navegador bloqueó la apertura del correo."
      };
    }catch(error){
      return {
        ok:
          false,

        opened:
          false,

        address:
          address,

        url:
          url,

        error:
          error,

        message:
          error &&
          error.message
            ? error.message
            : "No se pudo abrir el correo."
      };
    }
  }

  window.TablaEmail = {
    version:
      VERSION,

    addressOf:
      addressOf,

    normalizeEmail:
      normalizeEmail,

    isValid:
      isValid,

    subjectFor:
      subjectFor,

    buildUrl:
      buildUrl,

    open:
      open,

    abrir:
      open,

    available:
      function(row){
        return isValid(
          addressOf(row)
        );
      }
  };
})(window);
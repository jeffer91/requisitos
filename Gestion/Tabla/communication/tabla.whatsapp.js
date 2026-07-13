/* =========================================================
Nombre completo: tabla.whatsapp.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/communication/tabla.whatsapp.js
Función o funciones:
- Validar y normalizar el celular de un estudiante.
- Construir la URL segura de WhatsApp con el mensaje preparado.
- Abrir WhatsApp y devolver un resultado uniforme a TablaActions.
Con qué se conecta:
- tabla.utils.js
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

  function normalizePhone(value){
    return U.normalizePhone
      ? U.normalizePhone(value)
      : text(value)
          .replace(
            /[^0-9]/g,
            ""
          );
  }

  function phoneOf(row){
    row = row || {};

    var raw =
      row._celular ||
      row.Celular ||
      row.celular ||
      row.telefono ||
      row.whatsapp ||
      "";

    return normalizePhone(raw);
  }

  function isValidPhone(phone){
    phone = text(phone)
      .replace(
        /[^0-9]/g,
        ""
      );

    return (
      phone.length >= 10 &&
      phone.length <= 15
    );
  }

  function buildUrl(row, message){
    var phone =
      phoneOf(row);

    if(!isValidPhone(phone)){
      return "";
    }

    return (
      "https://wa.me/" +
      phone +
      "?text=" +
      encodeURIComponent(
        text(message)
      )
    );
  }

  function open(row, message){
    var phone =
      phoneOf(row);

    var url =
      buildUrl(
        row,
        message
      );

    if(!url){
      return {
        ok:
          false,

        opened:
          false,

        phone:
          phone,

        url:
          "",

        message:
          "Sin celular válido registrado."
      };
    }

    var opened;

    try{
      opened =
        U.openWindow
          ? U.openWindow(url)
          : !!window.open(
              url,
              "_blank",
              "noopener,noreferrer"
            );
    }catch(error){
      return {
        ok:
          false,

        opened:
          false,

        phone:
          phone,

        url:
          url,

        error:
          error,

        message:
          error &&
          error.message
            ? error.message
            : "No se pudo abrir WhatsApp."
      };
    }

    return {
      ok:
        opened,

      opened:
        opened,

      phone:
        phone,

      url:
        url,

      message:
        opened
          ? "WhatsApp abierto con el mensaje preparado."
          : "El navegador bloqueó la apertura de WhatsApp."
    };
  }

  window.TablaWhatsApp = {
    version:
      VERSION,

    phoneOf:
      phoneOf,

    normalizePhone:
      normalizePhone,

    isValidPhone:
      isValidPhone,

    buildUrl:
      buildUrl,

    open:
      open,

    abrir:
      open,

    available:
      function(row){
        return isValidPhone(
          phoneOf(row)
        );
      }
  };
})(window);
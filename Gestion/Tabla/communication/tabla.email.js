/* =========================================================
Nombre completo: tabla.email.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/communication/tabla.email.js
Función o funciones:
- Validar el correo del estudiante.
- Construir asunto, cuerpo y enlace mailto sin registrar historial directamente.
- Devolver un resultado uniforme para tabla.actions.js.
- Aplicar el mensaje breve de proceso perdido a todos los canales de Tabla.
Con qué se conecta:
- tabla.utils.js
- tabla.message.js
- tabla.actions.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.1.0-lost-process-message";
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

  function normalizeType(value){
    var Message = window.TablaMessage || {};

    if(typeof Message.canonicalType === "function"){
      return Message.canonicalType(value || "requisitos");
    }

    return text(value || "requisitos")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "")
      .toLowerCase();
  }

  function uniqueRequirementLabels(items){
    var seen = Object.create(null);
    var labels = [];

    (Array.isArray(items) ? items : []).forEach(function(item){
      var label = text(item && (item.label || item.nombre || item.key));
      var identity = label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if(!label || seen[identity]){
        return;
      }

      seen[identity] = true;
      labels.push(label);
    });

    return labels;
  }

  function lostProcessMessage(row, options){
    var Message = window.TablaMessage || {};
    var data = typeof Message.datosEstudiante === "function"
      ? Message.datosEstudiante(row || {})
      : {};
    var pending = typeof Message.listarRequisitosPendientes === "function"
      ? Message.listarRequisitosPendientes(row || {})
      : [];
    var requirements = uniqueRequirementLabels(pending);
    var name = text(data.nombre) || "estudiante";
    var period = text(data.periodo) || "el período seleccionado";
    var lines = [
      "Estimado/a " + name + ":",
      "",
      "Se informa que perdió su proceso de titulación correspondiente al período " +
        period +
        ", debido a que no completó los siguientes requisitos:",
      ""
    ];

    if(requirements.length){
      requirements.forEach(function(label){
        lines.push("- " + label);
      });
    }else{
      lines.push("- Requisitos pendientes registrados en su proceso.");
    }

    lines.push(
      "",
      "Para continuar, deberá matricularse nuevamente en el siguiente período académico.",
      "",
      "Para conocer el proceso de matrícula y facturación, comuníquese a:",
      "",
      "Secretaría: secretaria@itsqmet.edu.ec",
      "Facturación: facturacion@itsqmet.edu.ec",
      "",
      "Saludos cordiales,",
      "Mgs. Jefferson Villarreal",
      "Coordinador de Titulación",
      "ITSQMET"
    );

    return lines.join("\n");
  }

  function lostProcessSubject(row){
    var Message = window.TablaMessage || {};
    var data = typeof Message.datosEstudiante === "function"
      ? Message.datosEstudiante(row || {})
      : {};
    var subject = "Proceso de titulación perdido por requisitos pendientes";

    if(text(data.periodo)){
      subject += " - " + text(data.periodo);
    }

    return subject;
  }

  function patchLostProcessMessage(){
    var Message = window.TablaMessage || null;

    if(!Message || Message.__lostProcessMessagePatch === VERSION){
      return Message;
    }

    var originalGenerate = Message.generarMensaje;
    var originalGenerateType = Message.generarMensajeTipo;
    var originalSubject = Message.asunto;

    Message.generarMensaje = function(row, type, payload, options){
      if(normalizeType(type) === "perdio"){
        return lostProcessMessage(row, options || {});
      }

      return typeof originalGenerate === "function"
        ? originalGenerate.call(Message, row, type, payload, options)
        : "";
    };

    Message.generarMensajeTipo = function(row, type, options){
      if(normalizeType(type) === "perdio"){
        return lostProcessMessage(row, options || {});
      }

      return typeof originalGenerateType === "function"
        ? originalGenerateType.call(Message, row, type, options)
        : "";
    };

    Message.asunto = function(row, type){
      if(normalizeType(type) === "perdio"){
        return lostProcessSubject(row);
      }

      return typeof originalSubject === "function"
        ? originalSubject.call(Message, row, type)
        : "Proceso de titulación";
    };

    Message.generarMensajePerdio = lostProcessMessage;
    Message.asuntoPerdio = lostProcessSubject;
    Message.__lostProcessMessagePatch = VERSION;

    return Message;
  }

  patchLostProcessMessage();

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
      },

    lostProcessMessage:
      lostProcessMessage,

    lostProcessSubject:
      lostProcessSubject,

    patchLostProcessMessage:
      patchLostProcessMessage
  };
})(window);

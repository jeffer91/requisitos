/* =========================================================
Nombre completo: tabla.email.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/communication/tabla.email.js
Función o funciones:
- Validar los correos personal e institucional del estudiante.
- Construir asunto, cuerpo y enlace mailto con uno o ambos destinatarios.
- Evitar destinatarios repetidos o inválidos.
- Devolver un resultado uniforme para tabla.actions.js.
- Aplicar el mensaje breve de proceso perdido a todos los canales de Tabla.
Con qué se conecta:
- tabla.utils.js
- tabla.message.js
- tabla.actions.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.2.0-dual-recipient-email";
  var U = window.TablaUtils || {};

  function text(value){
    return U.text
      ? U.text(value)
      : String(value == null ? "" : value).trim();
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

  function lostProcessMessage(row){
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
      : text(value).toLowerCase();
  }

  function isValid(address){
    return U.isEmail
      ? U.isEmail(address)
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(address));
  }

  function emailCandidates(row){
    row = row || {};

    return [
      row._correoPersonal,
      row.CorreoPersonal,
      row.correoPersonal,
      row._correoInstitucional,
      row.CorreoInstitucional,
      row.correoInstitucional,
      row.emailInstitucional,
      row.EmailInstitucional,
      row._correo,
      row.correo,
      row.email,
      row.Email
    ];
  }

  function addressesOf(row){
    var seen = Object.create(null);
    var addresses = [];

    emailCandidates(row).forEach(function(value){
      var address = normalizeEmail(value);
      var identity = address.toLowerCase();

      if(!address || !isValid(address) || seen[identity]){
        return;
      }

      seen[identity] = true;
      addresses.push(address);
    });

    return addresses;
  }

  function addressOf(row){
    return addressesOf(row).join(", ");
  }

  function subjectFor(row, type, options){
    options = options || {};

    if(text(options.subject)){
      return text(options.subject);
    }

    if(
      window.TablaMessage &&
      typeof window.TablaMessage.asunto === "function"
    ){
      return window.TablaMessage.asunto(row || {}, type || "requisitos");
    }

    return "Proceso de titulación";
  }

  function buildUrl(row, type, message, options){
    var addresses = addressesOf(row);

    if(!addresses.length){
      return "";
    }

    var subject = subjectFor(row, type, options);
    var recipients = addresses
      .map(function(address){
        return encodeURIComponent(address);
      })
      .join(",");

    return (
      "mailto:" +
      recipients +
      "?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(text(message))
    );
  }

  function open(row, type, message, options){
    var addresses = addressesOf(row);
    var address = addresses.join(", ");
    var url = buildUrl(row, type, message, options);

    if(!url){
      return {
        ok: false,
        opened: false,
        address: address,
        addresses: addresses,
        url: "",
        message: "Sin correo personal o institucional válido registrado."
      };
    }

    try{
      var opened = U.openWindow
        ? U.openWindow(url)
        : !!window.open(url, "_blank", "noopener,noreferrer");

      return {
        ok: opened,
        opened: opened,
        address: address,
        addresses: addresses,
        url: url,
        subject: subjectFor(row, type, options),
        message: opened
          ? addresses.length > 1
            ? "Correo abierto para las direcciones personal e institucional."
            : "Correo abierto con el mensaje preparado."
          : "El navegador bloqueó la apertura del correo."
      };
    }catch(error){
      return {
        ok: false,
        opened: false,
        address: address,
        addresses: addresses,
        url: url,
        error: error,
        message: error && error.message
          ? error.message
          : "No se pudo abrir el correo."
      };
    }
  }

  window.TablaEmail = {
    version: VERSION,
    emailCandidates: emailCandidates,
    addressesOf: addressesOf,
    addressOf: addressOf,
    normalizeEmail: normalizeEmail,
    isValid: isValid,
    subjectFor: subjectFor,
    buildUrl: buildUrl,
    open: open,
    abrir: open,
    available: function(row){
      return addressesOf(row).length > 0;
    },
    lostProcessMessage: lostProcessMessage,
    lostProcessSubject: lostProcessSubject,
    patchLostProcessMessage: patchLostProcessMessage
  };
})(window);

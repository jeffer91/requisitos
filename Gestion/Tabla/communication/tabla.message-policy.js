/* =========================================================
Nombre completo: tabla.message-policy.js
Ruta: /Gestion/Tabla/communication/tabla.message-policy.js
Función:
- Generar WhatsApp breve y personalizado según los requisitos realmente faltantes.
- Respetar la secuencia REGULAR: requisitos previos -> Financiero -> Titulación.
- Mostrar Titulación como etapa no habilitada cuando faltan requisitos previos.
- Agrupar requisitos por responsable y no incluir correos electrónicos en WhatsApp.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-whatsapp-requirements-policy";
  var api = window.TablaMessage;
  var policy = window.TablaRegularPolicy;
  if(!api || !policy || api.__whatsappPolicyPatched){ return; }

  var originalGenerate = typeof api.generarMensaje === "function"
    ? api.generarMensaje.bind(api)
    : null;

  var CONTACTO_GENERAL = api.CONTACTO_GENERAL || "0988402774";
  var DEFAULT_FIRMA = "Mgs. Jefferson Villarreal\nCoordinador de Titulación";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function array(value){
    return Array.isArray(value) ? value : [];
  }

  function typeKey(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function studentData(row){
    return typeof api.datosEstudiante === "function"
      ? (api.datosEstudiante(row) || {})
      : {
          nombre: text(row && row._nombres) || "estudiante",
          periodo: text(row && (row._periodo || row._periodoId))
        };
  }

  function requirementLabel(item){
    return text(item && (item.label || item.nombre || item.key)) || "Requisito";
  }

  function decorateRequirements(row, items){
    var decorated = typeof api.listarRequisitos === "function"
      ? api.listarRequisitos(row || {})
      : [];

    var byKey = Object.create(null);
    array(decorated).forEach(function(item){
      byKey[policy.key(item)] = item;
    });

    return array(items).map(function(item){
      var match = byKey[policy.key(item)] || {};
      return Object.assign({}, item || {}, match);
    });
  }

  function groupedResponsibles(items){
    var groups = Object.create(null);
    var order = [];

    array(items).forEach(function(item){
      var responsible = text(item && item.contacto) || "Área correspondiente";
      var id = responsible.toLowerCase();

      if(!groups[id]){
        groups[id] = {
          responsable: responsible,
          requisitos: []
        };
        order.push(id);
      }

      var label = requirementLabel(item);
      if(groups[id].requisitos.indexOf(label) < 0){
        groups[id].requisitos.push(label);
      }
    });

    return order.map(function(id){ return groups[id]; });
  }

  function contextualIntro(type){
    if(type === "urgente"){
      return "Su proceso requiere atención prioritaria para evitar inconvenientes en la continuidad de la titulación.";
    }
    if(type === "ultimo"){
      return "Este mensaje corresponde a un último aviso para regularizar los requisitos pendientes de su proceso.";
    }
    if(type === "regularizar"){
      return "Es necesario regularizar los requisitos indicados para continuar con su proceso.";
    }
    if(type === "alerta"){
      return "Se requiere revisar y gestionar los requisitos indicados a continuación.";
    }
    return "";
  }

  function buildRequirementsWhatsApp(row, type, options){
    row = row || {};
    options = options || {};

    var data = studentData(row);
    var state = policy.analyze(row);
    var missing = state.missing;
    var lines = [
      "Saludos, " + (data.nombre || "estudiante") + ".",
      "",
      "Desde el área de Titulación informamos que, al revisar su proceso correspondiente al período " +
        (data.periodo || "—") + ", se registra lo siguiente:"
    ];

    var intro = contextualIntro(type);
    if(intro){
      lines.push("", intro);
    }

    if(missing.length === 1){
      var only = missing[0];
      if(policy.key(only) === "titulacion"){
        lines.push(
          "",
          "Está próximo a finalizar su proceso. Le falta únicamente el requisito de Titulación."
        );
      }else{
        lines.push(
          "",
          "Está próximo a completar sus requisitos. Actualmente le falta únicamente el requisito de " +
            requirementLabel(only) + "."
        );
      }
    }else if(missing.length > 1){
      lines.push(
        "",
        "Actualmente tiene " + missing.length + " requisitos pendientes:"
      );

      missing.forEach(function(item){
        lines.push("• " + requirementLabel(item));
      });
    }else if(state.titulationBlocked){
      lines.push(
        "",
        "Titulación aún no está habilitada porque existen requisitos previos que deben ser regularizados."
      );
    }else{
      lines.push(
        "",
        "No registra requisitos pendientes en la información revisada."
      );
    }

    if(state.titulationBlocked){
      var n = state.priorBlocking.length;
      lines.push(
        "",
        n === 1
          ? "Una vez regularizado este requisito, podrá continuar con Titulación."
          : "Una vez regularizados estos requisitos, podrá continuar con Titulación."
      );
    }

    var responsibleItems = missing.length
      ? missing
      : state.titulationBlocked
        ? state.priorBlocking
        : [];

    responsibleItems = decorateRequirements(row, responsibleItems);

    var groups = groupedResponsibles(responsibleItems);

    if(groups.length){
      lines.push("", groups.length === 1 ? "Responsable:" : "Responsables:");

      groups.forEach(function(group){
        lines.push("", group.responsable);
        group.requisitos.forEach(function(label){
          lines.push("• " + label);
        });
      });
    }

    lines.push(
      "",
      "Número único del instituto: " + CONTACTO_GENERAL,
      "",
      text(options.firma) || DEFAULT_FIRMA
    );

    return lines.join("\n");
  }

  function removeEmails(message){
    return text(message)
      .split(/\r?\n/)
      .filter(function(line){
        return !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line);
      })
      .join("\n")
      .replace(
        /Para orientación general sobre el proceso de titulación, puede comunicarse al\s*([0-9\s+-]+)\.?/gi,
        "Número único del instituto: $1"
      )
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function generarMensajeWhatsApp(row, tipo, payload, options){
    var type = typeKey(tipo || "requisitos");

    if([
      "requisitos",
      "falta",
      "urgente",
      "ultimo",
      "ultimoaviso",
      "regularizar",
      "alerta"
    ].indexOf(type) >= 0){
      return buildRequirementsWhatsApp(row, type, options);
    }

    if(originalGenerate){
      return removeEmails(
        originalGenerate(row, tipo, payload || {}, options || {})
      );
    }

    return buildRequirementsWhatsApp(row, "requisitos", options);
  }

  api.generarMensajeWhatsApp = generarMensajeWhatsApp;
  api.whatsappMessage = generarMensajeWhatsApp;
  api.analizarSecuenciaRegular = policy.analyze;
  api.__whatsappPolicyPatched = true;
  api.whatsappPolicyVersion = VERSION;

  window.TablaMessagePolicy = {
    version: VERSION,
    generarMensajeWhatsApp: generarMensajeWhatsApp,
    buildRequirementsWhatsApp: buildRequirementsWhatsApp,
    removeEmails: removeEmails
  };
})(window);

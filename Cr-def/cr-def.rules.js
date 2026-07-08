/* =========================================================
Nombre completo: cr-def.rules.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.rules.js
Función o funciones:
- Definir reglas para saber si un estudiante puede agendar defensa.
- Validar requisitos obligatorios en CUMPLE.
- Validar nota de artículo mínima 7.
- Bloquear estudiantes con nota de defensa aprobada 7 o más.
- Separar casos de supletorio / segunda defensa cuando nota defensa sea menor a 7.
Con qué se conecta:
- cr-def.config.js
- cr-def.data.js
- cr-def.scheduler.js
========================================================= */
(function(window){
  "use strict";

  var config = window.CR_DEF_CONFIG || {};

  var REQUIRED_FIELDS = [
    {
      id: "academico",
      label: "Académico",
      aliases: ["academico", "académico", "requisito academico", "requisito académico"]
    },
    {
      id: "documentacion",
      label: "Documentación",
      aliases: ["documentacion", "documentación", "docs", "documentos"]
    },
    {
      id: "financiero",
      label: "Financiero",
      aliases: ["financiero", "finanzas", "pago", "pagos"]
    },
    {
      id: "practicas",
      label: "Prácticas",
      aliases: ["practicas", "prácticas", "practica", "práctica"]
    },
    {
      id: "vinculacion",
      label: "Vinculación",
      aliases: ["vinculacion", "vinculación"]
    },
    {
      id: "seguimientoGraduados",
      label: "Seguimiento graduados",
      aliases: ["seguimiento graduados", "seguimiento de graduados", "seguimiento"]
    },
    {
      id: "ingles",
      label: "Inglés",
      aliases: ["ingles", "inglés"]
    },
    {
      id: "actualizacionDatos",
      label: "Actualización de datos",
      aliases: ["actualizacion de datos", "actualización de datos", "actualizacion datos", "actualización datos"]
    }
  ];

  var APPROVED_VALUE = "CUMPLE";

  function text(value){
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function norm(value){
    return text(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function toNumber(value){
    if(typeof value === "number" && isFinite(value)){ return value; }
    var raw = text(value).replace(",", ".");
    var match = raw.match(/-?\d+(\.\d+)?/);
    if(!match){ return null; }
    var parsed = Number(match[0]);
    return isFinite(parsed) ? parsed : null;
  }

  function readByAliases(record, aliases){
    if(!record || !aliases || !aliases.length){ return ""; }

    var keys = Object.keys(record);
    var normalizedKeys = keys.map(function(key){
      return { raw: key, normalized: norm(key) };
    });

    for(var i = 0; i < aliases.length; i += 1){
      var alias = norm(aliases[i]);
      var found = normalizedKeys.find(function(item){ return item.normalized === alias; });
      if(found){ return record[found.raw]; }
    }

    for(var j = 0; j < aliases.length; j += 1){
      var partial = norm(aliases[j]);
      var partialFound = normalizedKeys.find(function(item){ return item.normalized.indexOf(partial) !== -1; });
      if(partialFound){ return record[partialFound.raw]; }
    }

    return "";
  }

  function requisitoCumple(record, requisito){
    var value = readByAliases(record, requisito.aliases);
    return norm(value) === norm(APPROVED_VALUE);
  }

  function requisitosFaltantes(record){
    return REQUIRED_FIELDS
      .filter(function(requisito){ return !requisitoCumple(record, requisito); })
      .map(function(requisito){ return requisito.label; });
  }

  function leerNotaArticulo(record){
    return toNumber(readByAliases(record, [
      "nota articulo",
      "nota artículo",
      "articulo",
      "artículo",
      "nota final articulo",
      "nota final artículo"
    ]));
  }

  function leerNotaDefensa(record){
    return toNumber(readByAliases(record, [
      "nota defensa",
      "defensa",
      "nota de defensa",
      "nota final defensa",
      "calificacion defensa",
      "calificación defensa"
    ]));
  }

  function evaluarAptitud(record){
    var faltantes = requisitosFaltantes(record);
    var notaArticulo = leerNotaArticulo(record);
    var notaDefensa = leerNotaDefensa(record);
    var minArticulo = Number(config.notaArticuloMinima || 7);
    var minDefensa = Number(config.notaDefensaAprobada || 7);
    var alertas = [];

    if(notaDefensa != null && notaDefensa >= minDefensa){
      return {
        apto: false,
        estadoClave: "defensa-aprobada",
        estado: "Defensa aprobada",
        faltantes: [],
        alertas: ["Ya tiene nota de defensa aprobada."],
        notaArticulo: notaArticulo,
        notaDefensa: notaDefensa
      };
    }

    if(notaDefensa != null && notaDefensa < minDefensa){
      alertas.push("Tiene nota de defensa menor a 7. Debe ir como supletorio / segunda defensa.");
    }

    if(faltantes.length){
      alertas.push("Faltan requisitos: " + faltantes.join(", ") + ".");
    }

    if(notaArticulo == null){
      alertas.push("Falta nota de artículo.");
    }else if(notaArticulo < minArticulo){
      alertas.push("Nota de artículo menor a 7.");
    }

    var apto = !faltantes.length && notaArticulo != null && notaArticulo >= minArticulo;
    var estadoClave = apto ? (notaDefensa != null && notaDefensa < minDefensa ? "supletorio" : "apto") : "bloqueado";
    var estado = apto
      ? (estadoClave === "supletorio" ? "Supletorio / segunda defensa" : "Apto para agendar")
      : "No apto";

    return {
      apto: apto,
      estadoClave: estadoClave,
      estado: estado,
      faltantes: faltantes,
      alertas: alertas,
      notaArticulo: notaArticulo,
      notaDefensa: notaDefensa
    };
  }

  window.CR_DEF_RULES = Object.freeze({
    requiredFields: REQUIRED_FIELDS,
    approvedValue: APPROVED_VALUE,
    evaluarAptitud: evaluarAptitud,
    requisitosFaltantes: requisitosFaltantes,
    leerNotaArticulo: leerNotaArticulo,
    leerNotaDefensa: leerNotaDefensa,
    helpers: Object.freeze({
      text: text,
      norm: norm,
      toNumber: toNumber,
      readByAliases: readByAliases
    })
  });
})(window);

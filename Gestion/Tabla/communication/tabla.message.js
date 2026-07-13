/* =========================================================
Nombre completo: tabla.message.js
Ruta: /Gestion/Tabla/communication/tabla.message.js
Función:
- Generar el mismo mensaje institucional para todos los canales de Tabla.
- Usar únicamente requisitos aplicables al tipo de período.
- Comunicar como faltantes solo los estados no_cumple confirmados.
- Separar incumplimientos de datos pendientes de validación.
- Excluir campos finales y Titulación cuando el período es PVC.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "3.0.0-confirmed-missing-only";
  var C = window.TablaConstants || {};
  var U = window.TablaUtils || {};
  var N = window.TablaDataNormalizer || {};

  var CONTACTO_GENERAL = "0988402774";
  var DEFAULT_FIRMA =
    "Mgs. Jefferson Villarreal\n" +
    "Coordinador de Titulación";

  var RESPONSABLES = {
    academico: {
      contacto: "Martha Tomalá y coordinadores",
      correo: "mtomala@itsqmet.edu.ec"
    },
    documentacion: {
      contacto: "Leidy Salinas",
      correo: "lsalinas@itsqmet.edu.ec"
    },
    financiero: {
      contacto: "Paulina Araujo",
      correo: "paraujo@itsqmet.edu.ec"
    },
    titulacion: {
      contacto: "Jefferson Villarreal",
      correo: "jvillarreal@itsqmet.edu.ec"
    },
    practicasvinculacion: {
      contacto: "Verónica Ayala",
      correo: "veayala@itsqmet.edu.ec"
    },
    vinculacion: {
      contacto: "Verónica Ayala",
      correo: "veayala@itsqmet.edu.ec"
    },
    seguimientograduados: {
      contacto: "Yessenia Ortega",
      correo: "mortegaf@itsqmet.edu.ec"
    },
    ingles: {
      contacto: "Alejandra Hernández",
      correo: "mhernandez@itsqmet.edu.ec"
    },
    actualizaciondatos: {
      contacto: "Leidy Salinas",
      correo: "lsalinas@itsqmet.edu.ec"
    }
  };

  var FALLBACK_REQUIREMENTS = [
    req("academico", "academico", "Académico", [
      "academico", "Académico", "Academico"
    ]),
    req("documentacion", "documentacion", "Documentación académica", [
      "documentacion", "Documentación", "Documentacion",
      "documentacionacademica", "documentacionAcademica"
    ]),
    req("financiero", "financiero", "Financiero", [
      "financiero", "Financiero", "deuda", "pagos"
    ]),
    req("practicasvinculacion", "practicasVinculacion", "Prácticas preprofesionales", [
      "practicasvinculacion", "practicasVinculacion",
      "PrácticasVinculacion", "PracticasVinculacion",
      "practicas", "practicaspreprofesionales"
    ]),
    req("vinculacion", "vinculacion", "Vinculación con la sociedad", [
      "vinculacion", "Vinculación", "Vinculacion"
    ]),
    req("seguimientograduados", "seguimientoGraduados", "Seguimiento a graduados", [
      "seguimientograduados", "seguimientoGraduados",
      "SeguimientoGraduados", "graduados"
    ]),
    req("ingles", "ingles", "Segunda lengua / Inglés", [
      "ingles", "Inglés", "Ingles", "segundaLengua"
    ]),
    req("actualizaciondatos", "actualizacionDatos", "Actualización de datos", [
      "actualizaciondatos", "actualizacionDatos",
      "ActualizaciónDatos", "ActualizacionDatos", "datos"
    ]),
    req("titulacion", "titulacion", "Titulación", [
      "titulacion", "Titulación", "Titulacion"
    ], "regular")
  ];

  var TYPE_LABELS = {
    requisitos: "Falta req.",
    falta: "Falta req.",
    urgente: "Urgente",
    ultimo: "Último aviso",
    ultimoaviso: "Último aviso",
    regularizar: "Regularizar",
    notaarticulo: "Falta N-Art",
    notadefensa: "Falta N-Def",
    sinarticulo: "Sin artículo",
    noaprueba: "No aprueba",
    perdio: "Perdió",
    alerta: "Alerta",
    cronograma: "Cronograma",
    libre: "Personal",
    personal: "Personal"
  };

  function text(value){
    return U.text
      ? U.text(value)
      : String(value == null ? "" : value).trim();
  }

  function key(value){
    return U.normalizeKey
      ? U.normalizeKey(value)
      : text(value)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/gi, "")
          .toLowerCase();
  }

  function array(value){
    return Array.isArray(value) ? value : [];
  }

  function req(id, field, label, aliases, group){
    return {
      key: id,
      field: field || id,
      label: label || id,
      aliases: array(aliases).slice(),
      group: group || "requisito"
    };
  }

  function canonicalType(value){
    var normalized = key(value || "requisitos");

    if(normalized === "falta"){ return "requisitos"; }
    if(normalized === "ultimoaviso"){ return "ultimo"; }
    if(normalized === "personal"){ return "libre"; }

    return normalized || "requisitos";
  }

  function definitionKey(item){
    item = item || {};
    return key(
      item.key ||
      item.field ||
      item.requisitoKey ||
      item.requirementKey ||
      item.label ||
      item.nombre ||
      ""
    );
  }

  function isFinalRequirement(item){
    if(N.isFinalRequirement){
      return N.isFinalRequirement(item);
    }

    return array(C.periodPolicy && C.periodPolicy.finalKeys)
      .map(key)
      .indexOf(definitionKey(item)) >= 0;
  }

  function definitions(){
    var configured = array(C.requirements);
    var base = configured.length ? configured : FALLBACK_REQUIREMENTS;

    return base
      .filter(function(item){
        return !isFinalRequirement(item);
      })
      .map(function(item){
        item = Object.assign({}, item || {});
        var id = definitionKey(item);
        var responsible = RESPONSABLES[id] || {};

        return {
          key: item.key || id,
          field: item.field || item.key || id,
          label: text(item.label || item.key || "Requisito"),
          aliases: array(item.aliases).length
            ? item.aliases.slice()
            : [item.key || id],
          group: item.group || "requisito",
          contacto: text(item.contacto || responsible.contacto || "Área correspondiente"),
          correo: text(item.correo || responsible.correo || "")
        };
      });
  }

  var REQ_DEFS = definitions();

  function definitionFor(value){
    var wanted = definitionKey(
      value && typeof value === "object" ? value : {key: value}
    );

    return REQ_DEFS.filter(function(definition){
      return (
        key(definition.key) === wanted ||
        key(definition.field) === wanted ||
        key(definition.label) === wanted ||
        definition.aliases.map(key).indexOf(wanted) >= 0
      );
    })[0] || null;
  }

  function statusOf(item){
    var value = item;

    if(item && typeof item === "object"){
      value =
        item.estado != null ? item.estado :
        item.status != null ? item.status :
        item.value != null ? item.value :
        item.valor;
    }

    if(N.statusFromValue){
      return N.statusFromValue(value);
    }

    var normalized = key(value);

    if(!normalized){ return "sin_dato"; }

    if([
      "cumple", "cumplido", "cumplida", "aprobado", "aprobada",
      "si", "s", "ok", "true", "1", "validado", "validada",
      "completo", "completa"
    ].indexOf(normalized) >= 0){
      return "cumple";
    }

    if([
      "noaplica", "na", "noaplicable"
    ].indexOf(normalized) >= 0){
      return "no_aplica";
    }

    if(
      normalized.indexOf("nocumple") >= 0 ||
      normalized.indexOf("reprob") >= 0 ||
      [
        "no", "n", "falta", "faltante", "false", "0",
        "incumple", "incompleto", "incompleta", "rechazado", "rechazada"
      ].indexOf(normalized) >= 0
    ){
      return "no_cumple";
    }

    if([
      "pendiente", "revision", "enrevision", "porvalidar",
      "procesando", "enproceso"
    ].indexOf(normalized) >= 0){
      return "pendiente";
    }

    return "pendiente";
  }

  function statusLabel(status){
    if(status === "cumple"){ return "Cumple"; }
    if(status === "no_cumple"){ return "No cumple"; }
    if(status === "no_aplica"){ return "No aplica"; }
    if(status === "sin_dato"){ return "Sin dato"; }
    return "Pendiente";
  }

  function isPVC(row){
    row = row || {};

    if(row._esPVC === true){ return true; }
    if(row._esRegular === true){ return false; }

    if(N.classifyStudent){
      return N.classifyStudent(row).isPVC === true;
    }

    return key(row._tipoPeriodo) === "pvc";
  }

  function requirementApplies(row, item){
    item = item || {};

    if(item.applies === false){ return false; }
    if(isFinalRequirement(item)){ return false; }
    if(statusOf(item) === "no_aplica"){ return false; }
    if(isPVC(row) && definitionKey(item) === "titulacion"){
      return false;
    }

    return true;
  }

  function fallbackRequirements(row){
    return REQ_DEFS.map(function(definition){
      var value = U.pick
        ? U.pick(row || {}, definition.aliases, "")
        : "";

      return Object.assign({}, definition, {
        value: text(value),
        rawValue: value,
        estado: statusOf(value),
        status: statusOf(value)
      });
    });
  }

  function rawRequirements(row){
    row = row || {};

    if(Array.isArray(row._requisitosAplicables)){
      return row._requisitosAplicables.slice();
    }

    if(Array.isArray(row._requisitos)){
      return row._requisitos.slice();
    }

    if(N.requirementsFor){
      return N.requirementsFor(row);
    }

    return fallbackRequirements(row);
  }

  function attachResponsible(row, item){
    item = Object.assign({}, item || {});
    var definition = definitionFor(item) || {};
    var status = statusOf(item);

    return {
      key: item.key || definition.key || definitionKey(item),
      field: item.field || definition.field || item.key || "",
      label: text(item.label || definition.label || item.key || "Requisito"),
      aliases: array(item.aliases).length
        ? item.aliases.slice()
        : array(definition.aliases).slice(),
      group: item.group || definition.group || "requisito",
      value: text(
        item.value != null ? item.value :
        item.valor != null ? item.valor :
        item.rawValue
      ),
      estado: status,
      status: status,
      estadoLabel: text(item.estadoLabel) || statusLabel(status),
      contacto: text(item.contacto || definition.contacto || "Área correspondiente"),
      correo: text(item.correo || definition.correo || ""),
      applies: requirementApplies(row, item)
    };
  }

  function listarRequisitos(row){
    row = row || {};

    return rawRequirements(row)
      .map(function(item){
        return attachResponsible(row, item);
      })
      .filter(function(item){
        return item.applies;
      });
  }

  function listarRequisitosPendientes(row){
    row = row || {};

    var source;

    if(Array.isArray(row._requisitosFaltantes)){
      source = row._requisitosFaltantes;
    }else if(N.missingRequirements){
      source = N.missingRequirements(row);
    }else{
      source = rawRequirements(row);
    }

    return array(source)
      .map(function(item){
        return attachResponsible(row, item);
      })
      .filter(function(item){
        return item.applies && item.estado === "no_cumple";
      });
  }

  function listarRequisitosSinDato(row){
    row = row || {};

    var source = Array.isArray(row._requisitosSinDato)
      ? row._requisitosSinDato
      : N.noDataRequirements
        ? N.noDataRequirements(row)
        : rawRequirements(row);

    return array(source)
      .map(function(item){
        return attachResponsible(row, item);
      })
      .filter(function(item){
        return (
          item.applies &&
          (item.estado === "sin_dato" || item.estado === "pendiente")
        );
      });
  }

  function datosEstudiante(row){
    row = row || {};

    var telegram = N.telegramInfo
      ? N.telegramInfo(row)
      : {
          user: text(row._telegramUser || row.telegramUser || row.telegram),
          chatId: text(row._telegramChatId || row.telegramChatId || row.chatId)
        };

    return {
      nombre: text(
        row._nombres || row.nombres || row.Nombres ||
        row.nombre || row.estudiante
      ) || "estudiante",
      cedula: text(
        row._cedula || row.cedula || row.numeroIdentificacion ||
        row.numeroidentificacion
      ),
      carrera: text(
        row._carrera || row.NombreCarrera || row.nombreCarrera || row.carrera
      ),
      carreraCorta: text(row._carreraCorta),
      periodo: text(
        row._periodo || row.periodoLabel || row.periodo ||
        row._bl2Periodo || row._periodoId
      ),
      periodoId: text(
        row._periodoId || row.periodoId || row.periodId || row._bl2PeriodoId
      ),
      tipoPeriodo: text(row._tipoPeriodo || (isPVC(row) ? "PVC" : "REGULAR")),
      division: text(row._division || row.division || row._bl2Division),
      correo: text(row._correo || row.correo || row.email || row.Email),
      celular: text(row._celular || row.celular || row.whatsapp || row.telefono),
      telegramUser: text(telegram.user),
      telegramChatId: text(telegram.chatId),
      telegram: text(telegram.chatId || telegram.user)
    };
  }

  function aplicarVariables(template, row){
    var data = datosEstudiante(row || {});

    return String(template == null ? "" : template)
      .replace(/{{\s*NOMBRE\s*}}/gi, data.nombre)
      .replace(/{{\s*CEDULA\s*}}/gi, data.cedula || "—")
      .replace(/{{\s*CARRERA\s*}}/gi, data.carrera || "—")
      .replace(/{{\s*PERIODO\s*}}/gi, data.periodo || "—")
      .replace(/{{\s*TIPO_PERIODO\s*}}/gi, data.tipoPeriodo || "—")
      .replace(/{{\s*DIVISION\s*}}/gi, data.division || "—")
      .replace(/{{\s*TELEGRAM\s*}}/gi, data.telegram || "—")
      .trim();
  }

  function firma(options){
    options = options || {};
    return text(options.firma) || DEFAULT_FIRMA;
  }

  function tipoLabel(tipo){
    return TYPE_LABELS[canonicalType(tipo)] || TYPE_LABELS.requisitos;
  }

  function contactosPorPendientes(pendientes){
    var seen = Object.create(null);
    var output = [];

    array(pendientes).forEach(function(item){
      item = item || {};

      if(statusOf(item) !== "no_cumple" || !text(item.correo)){
        return;
      }

      var identity = key(item.contacto + "|" + item.correo);
      if(seen[identity]){ return; }
      seen[identity] = true;

      output.push(
        text(item.label) + ":\n" +
        text(item.contacto || "Área correspondiente") + "\n" +
        text(item.correo)
      );
    });

    return output;
  }

  function specialDetail(type){
    if(type === "notaarticulo"){
      return "Se registra una novedad relacionada con la nota de artículo académico. Debe revisar si la nota no consta registrada o si no alcanza la calificación mínima requerida.";
    }
    if(type === "notadefensa"){
      return "Se registra una novedad relacionada con la nota de defensa. Debe revisar si la nota no consta registrada o si no alcanza la calificación mínima requerida.";
    }
    if(type === "sinarticulo"){
      return "Se registra que no consta el cumplimiento o registro del artículo académico dentro del proceso de titulación.";
    }
    if(type === "noaprueba"){
      return "Se registra que actualmente no cumple con las condiciones mínimas de aprobación del proceso de titulación. Debe revisar su situación de forma inmediata.";
    }
    if(type === "perdio"){
      return "Según la revisión registrada, su proceso consta como no aprobado o perdido en el período indicado. Debe comunicarse para recibir orientación sobre los siguientes pasos.";
    }
    return "";
  }

  function detailFor(row, tipo){
    var type = canonicalType(tipo);
    var pending = listarRequisitosPendientes(row || {});
    var noData = listarRequisitosSinDato(row || {});
    var lines = [];
    var special = specialDetail(type);

    if(special){
      lines.push(special);

      if([
        "notaarticulo", "notadefensa", "sinarticulo", "noaprueba"
      ].indexOf(type) >= 0){
        pending = pending.filter(function(item){
          return definitionKey(item) === "titulacion";
        });
      }

      return {
        lines: lines,
        pending: pending,
        noData: noData
      };
    }

    if(pending.length){
      if(type === "alerta"){
        lines.push("Su caso requiere revisión especial por parte del área correspondiente.");
      }else if(type === "urgente"){
        lines.push("Su proceso requiere atención urgente, debido a que existen incumplimientos confirmados que pueden afectar su continuidad.");
      }else if(type === "ultimo"){
        lines.push("Este mensaje corresponde a un último aviso de regularización de incumplimientos registrados en su proceso.");
      }else if(type === "regularizar"){
        lines.push("Debe regularizar los siguientes requisitos para continuar con su proceso.");
      }else{
        lines.push("Se identifican requisitos incumplidos que deben ser regularizados para continuar con su proceso.");
      }

      lines.push("", "Detalle:");

      pending.forEach(function(item){
        lines.push(
          "* " + item.label +
          (item.value ? " — Estado registrado: " + item.value : "")
        );
      });
    }else if(noData.length){
      lines.push(
        "No se identifican requisitos incumplidos en la información disponible. Sin embargo, existen datos pendientes de validación antes de confirmar el estado final de su proceso.",
        "",
        "Información pendiente de validación:"
      );

      noData.forEach(function(item){
        lines.push("* " + item.label);
      });
    }else{
      lines.push(
        "No se identifican requisitos incumplidos ni información pendiente de validación en la base revisada."
      );
    }

    return {
      lines: lines,
      pending: pending,
      noData: noData
    };
  }

  function baseMensaje(row, tipo, options){
    var data = datosEstudiante(row || {});
    var detail = detailFor(row || {}, tipo);
    var contacts = contactosPorPendientes(detail.pending);

    var lines = [
      "Saludos, " + data.nombre + ".",
      "",
      "Desde el área de Titulación se informa que, al revisar su proceso correspondiente al período " +
        (data.periodo || "—") +
        ", se registra la siguiente información:",
      "",
      "Cédula: " + (data.cedula || "—"),
      "Carrera: " + (data.carrera || "—"),
      "",
      detail.lines.join("\n")
    ];

    if(contacts.length){
      lines.push(
        "",
        "Por favor, revise la información y comuníquese con el área correspondiente:",
        "",
        contacts.join("\n\n")
      );
    }else if(detail.noData.length){
      lines.push(
        "",
        "La información pendiente debe ser validada antes de realizar una gestión de regularización."
      );
    }

    lines.push(
      "",
      "Para orientación general sobre el proceso de titulación, puede comunicarse al " +
        CONTACTO_GENERAL +
        ".",
      "",
      firma(options)
    );

    return lines.join("\n");
  }

  function generarMensajeRequisitos(row, options){
    return baseMensaje(row, "requisitos", options);
  }

  function generarMensajeTipo(row, tipo, options){
    return baseMensaje(row, tipo || "requisitos", options);
  }

  function generarMensajeCronograma(row, contenido, options){
    var data = datosEstudiante(row || {});
    var body = aplicarVariables(contenido, row || {});

    return [
      "Saludos, " + data.nombre + ".",
      "",
      "Desde el área de Titulación se comparte información correspondiente al período " +
        (data.periodo || "—") +
        ":",
      "",
      body || "[Escriba aquí el cronograma o la información que desea comunicar.]",
      "",
      "Para orientación general sobre el proceso de titulación, puede comunicarse al " +
        CONTACTO_GENERAL +
        ".",
      "",
      firma(options)
    ].join("\n");
  }

  function generarMensajeLibre(row, contenido, options){
    var data = datosEstudiante(row || {});
    var body = aplicarVariables(contenido, row || {});
    options = options || {};

    if(options.envolver === false){
      return body;
    }

    return [
      "Saludos, " + data.nombre + ".",
      "",
      body || "[Escriba aquí el mensaje que desea enviar.]",
      "",
      "Para orientación general sobre el proceso de titulación, puede comunicarse al " +
        CONTACTO_GENERAL +
        ".",
      "",
      firma(options)
    ].join("\n");
  }

  function generarMensaje(row, tipo, payload, options){
    var type = canonicalType(tipo);
    payload = payload || {};

    if(type === "cronograma"){
      return generarMensajeCronograma(
        row,
        payload.texto || payload.mensaje || "",
        options
      );
    }

    if(type === "libre"){
      return generarMensajeLibre(
        row,
        payload.texto || payload.mensaje || "",
        options
      );
    }

    return generarMensajeTipo(row, type, options);
  }

  function asunto(row, tipo){
    var data = datosEstudiante(row || {});
    var subject = tipoLabel(tipo || "requisitos") + " - Proceso de titulación";

    if(data.periodo){
      subject += " - " + data.periodo;
    }

    return subject;
  }

  window.TablaMessage = {
    version: VERSION,
    CONTACTO_GENERAL: CONTACTO_GENERAL,
    REQ_DEFS: REQ_DEFS.map(function(item){
      return Object.assign({}, item, {
        aliases: item.aliases.slice()
      });
    }),
    TIPO_LABELS: Object.assign({}, TYPE_LABELS),
    canonicalType: canonicalType,
    tipoLabel: tipoLabel,
    datosEstudiante: datosEstudiante,
    listarRequisitos: listarRequisitos,
    listarRequisitosPendientes: listarRequisitosPendientes,
    listarRequisitosSinDato: listarRequisitosSinDato,
    contactosPorPendientes: contactosPorPendientes,
    aplicarVariables: aplicarVariables,
    generarMensajeRequisitos: generarMensajeRequisitos,
    generarMensajeTipo: generarMensajeTipo,
    generarMensajeCronograma: generarMensajeCronograma,
    generarMensajeLibre: generarMensajeLibre,
    generarMensaje: generarMensaje,
    asunto: asunto
  };
})(window);

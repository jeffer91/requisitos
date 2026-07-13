/* =========================================================
Nombre completo: tabla.message.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/communication/tabla.message.js
Función o funciones:
- Generar mensajes institucionales para todos los canales de Tabla.
- Centralizar tipos, asuntos, variables y responsables de requisitos.
- Consumir los campos normalizados sin modificar al estudiante original.
Con qué se conecta:
- tabla.constants.js
- tabla.utils.js
- tabla.data-normalizer.js
- tabla.telegram.js, tabla.actions.js y tabla.mass-sender.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0";
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
    {
      key: "academico",
      field: "academico",
      label: "Académico",
      aliases: [
        "academico",
        "Académico",
        "Academico"
      ]
    },
    {
      key: "documentacion",
      field: "documentacion",
      label: "Documentación académica",
      aliases: [
        "documentacion",
        "Documentación",
        "Documentacion",
        "documentacionacademica"
      ]
    },
    {
      key: "financiero",
      field: "financiero",
      label: "Financiero",
      aliases: [
        "financiero",
        "Financiero",
        "deuda",
        "pagos"
      ]
    },
    {
      key: "titulacion",
      field: "titulacion",
      label: "Titulación",
      aliases: [
        "titulacion",
        "Titulación",
        "Titulacion",
        "aprobacionTitulacion"
      ]
    },
    {
      key: "practicasvinculacion",
      field: "practicasVinculacion",
      label: "Prácticas preprofesionales",
      aliases: [
        "practicasvinculacion",
        "practicasVinculacion",
        "PrácticasVinculacion",
        "PracticasVinculacion",
        "practicas",
        "practicaspreprofesionales"
      ]
    },
    {
      key: "vinculacion",
      field: "vinculacion",
      label: "Vinculación con la sociedad",
      aliases: [
        "vinculacion",
        "Vinculación",
        "Vinculacion"
      ]
    },
    {
      key: "seguimientograduados",
      field: "seguimientoGraduados",
      label: "Seguimiento a graduados",
      aliases: [
        "seguimientograduados",
        "seguimientoGraduados",
        "SeguimientoGraduados",
        "graduados"
      ]
    },
    {
      key: "ingles",
      field: "ingles",
      label: "Segunda lengua / Inglés",
      aliases: [
        "ingles",
        "Inglés",
        "Ingles",
        "segundaLengua"
      ]
    },
    {
      key: "actualizaciondatos",
      field: "actualizacionDatos",
      label: "Actualización de datos",
      aliases: [
        "actualizaciondatos",
        "actualizacionDatos",
        "ActualizaciónDatos",
        "ActualizacionDatos",
        "datos"
      ]
    }
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
      : String(
          value == null
            ? ""
            : value
        ).trim();
  }

  function key(value){
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

  function canonicalType(value){
    var normalized =
      key(
        value ||
        "requisitos"
      );

    if(normalized === "falta"){
      return "requisitos";
    }

    if(
      normalized ===
      "ultimoaviso"
    ){
      return "ultimo";
    }

    if(normalized === "personal"){
      return "libre";
    }

    return (
      normalized ||
      "requisitos"
    );
  }

  function definitions(){
    var base =
      Array.isArray(
        C.requirements
      ) &&
      C.requirements.length
        ? C.requirements
        : FALLBACK_REQUIREMENTS;

    return base.map(function(item){
      var definition =
        Object.assign(
          {},
          item || {}
        );

      var id =
        key(
          definition.key ||
          definition.field ||
          definition.label
        );

      var responsible =
        RESPONSABLES[id] ||
        {};

      definition.key =
        definition.key ||
        id;

      definition.field =
        definition.field ||
        definition.key;

      definition.label =
        definition.label ||
        definition.key ||
        "Requisito";

      definition.aliases =
        Array.isArray(
          definition.aliases
        )
          ? definition.aliases.slice()
          : [definition.key];

      definition.contacto =
        text(
          definition.contacto ||
          responsible.contacto ||
          "Área correspondiente"
        );

      definition.correo =
        text(
          definition.correo ||
          responsible.correo ||
          ""
        );

      return definition;
    });
  }

  var REQ_DEFS =
    definitions();

  function definitionFor(value){
    var wanted = key(value);
    var found = null;

    REQ_DEFS.some(
      function(definition){
        if(
          key(definition.key) ===
            wanted ||
          key(definition.field) ===
            wanted ||
          key(definition.label) ===
            wanted ||
          definition.aliases.some(
            function(alias){
              return (
                key(alias) ===
                wanted
              );
            }
          )
        ){
          found = definition;
          return true;
        }

        return false;
      }
    );

    return found;
  }

  function statusOf(item){
    var value =
      item &&
      typeof item === "object"
        ? (
            item.estado ||
            item.status ||
            item.value
          )
        : item;

    var normalized =
      key(value);

    if(
      [
        "cumple",
        "cumplido",
        "aprobado",
        "aprobada",
        "si",
        "ok",
        "true",
        "1"
      ].indexOf(normalized) >= 0
    ){
      return "cumple";
    }

    if(
      normalized.indexOf(
        "nocumple"
      ) >= 0 ||
      [
        "no",
        "reprobado",
        "reprobada",
        "falta",
        "faltante",
        "false",
        "0"
      ].indexOf(normalized) >= 0
    ){
      return "no_cumple";
    }

    return "pendiente";
  }

  function statusLabel(status){
    if(status === "cumple"){
      return "Cumple";
    }

    if(status === "no_cumple"){
      return "No cumple";
    }

    return "Pendiente";
  }

  function rawRequirements(row){
    if(N.requirementsFor){
      return N.requirementsFor(
        row || {}
      );
    }

    return REQ_DEFS.map(
      function(definition){
        var value =
          U.pick
            ? U.pick(
                row || {},
                definition.aliases,
                ""
              )
            : "";

        return {
          key:
            definition.key,

          field:
            definition.field,

          label:
            definition.label,

          value:
            text(value),

          estado:
            statusOf(value)
        };
      }
    );
  }

  function attachResponsible(item){
    item =
      Object.assign(
        {},
        item || {}
      );

    var definition =
      definitionFor(
        item.key ||
        item.field ||
        item.label
      ) ||
      {};

    var status =
      statusOf(
        item.estado ||
        item.status ||
        item.value
      );

    return {
      key:
        item.key ||
        definition.key ||
        key(item.label),

      field:
        item.field ||
        definition.field ||
        item.key ||
        "",

      label:
        text(
          item.label ||
          definition.label ||
          item.key ||
          "Requisito"
        ),

      value:
        text(item.value),

      estado:
        status,

      estadoLabel:
        text(
          item.estadoLabel
        ) ||
        statusLabel(status),

      contacto:
        text(
          item.contacto ||
          definition.contacto ||
          "Área correspondiente"
        ),

      correo:
        text(
          item.correo ||
          definition.correo ||
          ""
        )
    };
  }

  function listarRequisitos(row){
    return rawRequirements(
      row || {}
    ).map(
      attachResponsible
    );
  }

  function listarRequisitosPendientes(
    row
  ){
    if(
      row &&
      Array.isArray(
        row._requisitosFaltantes
      ) &&
      row._requisitosFaltantes
        .length
    ){
      return row
        ._requisitosFaltantes
        .map(attachResponsible)
        .filter(function(item){
          return (
            item.estado !==
            "cumple"
          );
        });
    }

    return listarRequisitos(row)
      .filter(function(item){
        return (
          item.estado !==
          "cumple"
        );
      });
  }

  function datosEstudiante(row){
    row = row || {};

    var telegram =
      N.telegramInfo
        ? N.telegramInfo(row)
        : {
            user:
              text(
                row._telegramUser ||
                row.telegramUser ||
                row.telegram
              ),

            chatId:
              text(
                row._telegramChatId ||
                row.telegramChatId ||
                row.chatId
              )
          };

    return {
      nombre:
        text(
          row._nombres ||
          row.nombres ||
          row.Nombres ||
          row.nombre ||
          row.estudiante
        ) ||
        "estudiante",

      cedula:
        text(
          row._cedula ||
          row.cedula ||
          row.numeroIdentificacion ||
          row.numeroidentificacion
        ),

      carrera:
        text(
          row._carrera ||
          row.NombreCarrera ||
          row.nombreCarrera ||
          row.carrera
        ),

      carreraCorta:
        text(
          row._carreraCorta
        ),

      periodo:
        text(
          row._periodo ||
          row.periodoLabel ||
          row.periodo ||
          row._bl2Periodo ||
          row._periodoId
        ),

      periodoId:
        text(
          row._periodoId ||
          row.periodoId ||
          row.periodId ||
          row._bl2PeriodoId
        ),

      division:
        text(
          row._division ||
          row.division ||
          row._bl2Division
        ),

      correo:
        text(
          row._correo ||
          row.correo ||
          row.email ||
          row.Email
        ),

      celular:
        text(
          row._celular ||
          row.celular ||
          row.whatsapp ||
          row.telefono
        ),

      telegramUser:
        text(telegram.user),

      telegramChatId:
        text(telegram.chatId),

      telegram:
        text(
          telegram.chatId ||
          telegram.user
        )
    };
  }

  function aplicarVariables(
    template,
    row
  ){
    var data =
      datosEstudiante(
        row || {}
      );

    return String(
      template == null
        ? ""
        : template
    )
      .replace(
        /{{\s*NOMBRE\s*}}/gi,
        data.nombre
      )
      .replace(
        /{{\s*CEDULA\s*}}/gi,
        data.cedula ||
        "—"
      )
      .replace(
        /{{\s*CARRERA\s*}}/gi,
        data.carrera ||
        "—"
      )
      .replace(
        /{{\s*PERIODO\s*}}/gi,
        data.periodo ||
        "—"
      )
      .replace(
        /{{\s*DIVISION\s*}}/gi,
        data.division ||
        "—"
      )
      .replace(
        /{{\s*TELEGRAM\s*}}/gi,
        data.telegram ||
        "—"
      )
      .trim();
  }

  function firma(options){
    options = options || {};

    return (
      text(options.firma) ||
      DEFAULT_FIRMA
    );
  }

  function tipoLabel(tipo){
    return (
      TYPE_LABELS[
        canonicalType(tipo)
      ] ||
      TYPE_LABELS.requisitos
    );
  }

  function contactosPorPendientes(
    pendientes
  ){
    var seen =
      Object.create(null);

    var output = [];

    (
      Array.isArray(pendientes)
        ? pendientes
        : []
    ).forEach(function(item){
      item =
        attachResponsible(item);

      if(!item.correo){
        return;
      }

      var identity =
        key(
          item.contacto +
          "|" +
          item.correo
        );

      if(seen[identity]){
        return;
      }

      seen[identity] = true;

      output.push(
        item.label +
        ":\n" +
        item.contacto +
        "\n" +
        item.correo
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
    var type =
      canonicalType(tipo);

    var pending =
      listarRequisitosPendientes(
        row || {}
      );

    var lines = [];
    var special =
      specialDetail(type);

    if(special){
      lines.push(special);

      if(
        [
          "notaarticulo",
          "notadefensa",
          "sinarticulo",
          "noaprueba"
        ].indexOf(type) >= 0
      ){
        pending =
          pending.filter(
            function(item){
              return (
                key(item.key) ===
                "titulacion"
              );
            }
          );
      }

      return {
        lines:
          lines,

        pending:
          pending
      };
    }

    if(type === "alerta"){
      lines.push(
        "Su caso requiere revisión especial por parte del área correspondiente."
      );
    }else if(type === "urgente"){
      lines.push(
        "Su proceso requiere atención urgente, debido a que existen novedades que pueden afectar su continuidad."
      );
    }else if(type === "ultimo"){
      lines.push(
        "Este mensaje corresponde a un último aviso de regularización de pendientes registrados en su proceso."
      );
    }else if(
      type === "regularizar"
    ){
      lines.push(
        "Debe regularizar la siguiente información para continuar con su proceso."
      );
    }else{
      lines.push(
        "Se identifican novedades pendientes que deben ser regularizadas para continuar con su proceso."
      );
    }

    lines.push(
      "",
      "Detalle:"
    );

    if(pending.length){
      pending.forEach(
        function(item){
          lines.push(
            "* " +
            item.label +
            (
              item.value
                ? (
                    " — Estado registrado: " +
                    item.value
                  )
                : ""
            )
          );
        }
      );
    }else{
      lines.push(
        "* No se identifican requisitos faltantes en la base revisada, pero se solicita validar la información registrada."
      );
    }

    return {
      lines:
        lines,

      pending:
        pending
    };
  }

  function baseMensaje(
    row,
    tipo,
    options
  ){
    var data =
      datosEstudiante(
        row || {}
      );

    var detail =
      detailFor(
        row || {},
        tipo
      );

    var contacts =
      contactosPorPendientes(
        detail.pending
      );

    var lines = [
      "Saludos, " +
        data.nombre +
        ".",

      "",

      "Desde el área de Titulación se informa que, al revisar su proceso correspondiente al período " +
        (
          data.periodo ||
          "—"
        ) +
        ", se registra la siguiente información:",

      "",

      "Cédula: " +
        (
          data.cedula ||
          "—"
        ),

      "Carrera: " +
        (
          data.carrera ||
          "—"
        ),

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
    }else{
      lines.push(
        "",
        "Por favor, revise la información y comuníquese con el área correspondiente para validar su situación."
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

  function generarMensajeRequisitos(
    row,
    options
  ){
    return baseMensaje(
      row,
      "requisitos",
      options
    );
  }

  function generarMensajeTipo(
    row,
    tipo,
    options
  ){
    return baseMensaje(
      row,
      tipo ||
        "requisitos",
      options
    );
  }

  function generarMensajeCronograma(
    row,
    contenido,
    options
  ){
    var data =
      datosEstudiante(
        row || {}
      );

    var body =
      aplicarVariables(
        contenido,
        row || {}
      );

    return [
      "Saludos, " +
        data.nombre +
        ".",

      "",

      "Desde el área de Titulación se comparte información correspondiente al período " +
        (
          data.periodo ||
          "—"
        ) +
        ":",

      "",

      body ||
        "[Escriba aquí el cronograma o la información que desea comunicar.]",

      "",

      "Para orientación general sobre el proceso de titulación, puede comunicarse al " +
        CONTACTO_GENERAL +
        ".",

      "",

      firma(options)
    ].join("\n");
  }

  function generarMensajeLibre(
    row,
    contenido,
    options
  ){
    var data =
      datosEstudiante(
        row || {}
      );

    var body =
      aplicarVariables(
        contenido,
        row || {}
      );

    options = options || {};

    if(options.envolver === false){
      return body;
    }

    return [
      "Saludos, " +
        data.nombre +
        ".",

      "",

      body ||
        "[Escriba aquí el mensaje que desea enviar.]",

      "",

      "Para orientación general sobre el proceso de titulación, puede comunicarse al " +
        CONTACTO_GENERAL +
        ".",

      "",

      firma(options)
    ].join("\n");
  }

  function generarMensaje(
    row,
    tipo,
    payload,
    options
  ){
    var type =
      canonicalType(tipo);

    payload = payload || {};

    if(type === "cronograma"){
      return generarMensajeCronograma(
        row,
        payload.texto ||
          payload.mensaje ||
          "",
        options
      );
    }

    if(type === "libre"){
      return generarMensajeLibre(
        row,
        payload.texto ||
          payload.mensaje ||
          "",
        options
      );
    }

    return generarMensajeTipo(
      row,
      type,
      options
    );
  }

  function asunto(row, tipo){
    var data =
      datosEstudiante(
        row || {}
      );

    var subject =
      tipoLabel(
        tipo ||
        "requisitos"
      ) +
      " - Proceso de titulación";

    if(data.periodo){
      subject +=
        " - " +
        data.periodo;
    }

    return subject;
  }

  window.TablaMessage = {
    version:
      VERSION,

    CONTACTO_GENERAL:
      CONTACTO_GENERAL,

    REQ_DEFS:
      REQ_DEFS.map(
        function(item){
          return Object.assign(
            {},
            item,
            {
              aliases:
                item.aliases.slice()
            }
          );
        }
      ),

    TIPO_LABELS:
      Object.assign(
        {},
        TYPE_LABELS
      ),

    canonicalType:
      canonicalType,

    tipoLabel:
      tipoLabel,

    datosEstudiante:
      datosEstudiante,

    listarRequisitos:
      listarRequisitos,

    listarRequisitosPendientes:
      listarRequisitosPendientes,

    contactosPorPendientes:
      contactosPorPendientes,

    aplicarVariables:
      aplicarVariables,

    generarMensajeRequisitos:
      generarMensajeRequisitos,

    generarMensajeTipo:
      generarMensajeTipo,

    generarMensajeCronograma:
      generarMensajeCronograma,

    generarMensajeLibre:
      generarMensajeLibre,

    generarMensaje:
      generarMensaje,

    asunto:
      asunto
  };
})(window);
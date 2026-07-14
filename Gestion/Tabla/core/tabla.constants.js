/* =========================================================
Nombre completo: tabla.constants.js
Ruta: /Gestion/Tabla/core/tabla.constants.js
Función:
- Centralizar constantes, filtros, eventos y alias de Tabla.
- Definir la política académica REGULAR/PVC igual que Ficha.
- Separar requisitos aplicables de campos finales de aprobación.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "3.0.0-period-policy";

  function deepFreeze(value){
    if(!value || typeof value !== "object" || Object.isFrozen(value)){
      return value;
    }

    Object.keys(value).forEach(function(key){
      deepFreeze(value[key]);
    });

    try{ Object.freeze(value); }catch(error){}
    return value;
  }

  function requirement(key, field, label, aliases, group){
    return {
      key: key,
      field: field || key,
      label: label || key,
      aliases: Array.isArray(aliases) ? aliases.slice() : [key],
      group: group || "requisito"
    };
  }

  var BASE_REQUIREMENTS = [
    requirement("academico", "academico", "Académico", [
      "academico", "Académico", "Academico"
    ]),
    requirement("documentacion", "documentacion", "Documentación académica", [
      "documentacion", "Documentación", "Documentacion",
      "documentacionacademica", "documentacionAcademica"
    ]),
    requirement("financiero", "financiero", "Financiero", [
      "financiero", "Financiero", "deuda", "pagos"
    ]),
    requirement("practicasvinculacion", "practicasVinculacion", "Prácticas preprofesionales", [
      "practicasvinculacion", "practicasVinculacion",
      "PrácticasVinculacion", "PracticasVinculacion",
      "practicas", "practicaspreprofesionales"
    ]),
    requirement("vinculacion", "vinculacion", "Vinculación con la sociedad", [
      "vinculacion", "Vinculación", "Vinculacion"
    ]),
    requirement("seguimientograduados", "seguimientoGraduados", "Seguimiento a graduados", [
      "seguimientograduados", "seguimientoGraduados",
      "SeguimientoGraduados", "graduados"
    ]),
    requirement("ingles", "ingles", "Segunda lengua / Inglés", [
      "ingles", "Inglés", "Ingles", "segundaLengua"
    ]),
    requirement("actualizaciondatos", "actualizacionDatos", "Actualización de datos", [
      "actualizaciondatos", "actualizacionDatos",
      "ActualizaciónDatos", "ActualizacionDatos", "datos"
    ])
  ];

  var REGULAR_REQUIREMENTS = [
    requirement("titulacion", "titulacion", "Titulación", [
      "titulacion", "Titulación", "Titulacion"
    ], "regular")
  ];

  var FINAL_REQUIREMENTS = [
    requirement(
      "aprobaciontitulacion",
      "aprobacionTitulacion",
      "Aprobación de titulación",
      [
        "aprobaciontitulacion", "aprobacionTitulacion",
        "AprobacionTitulacion", "AprobaciónTitulación"
      ],
      "final"
    ),
    requirement(
      "aprobacioncomplexivoproyecto",
      "aprobacionComplexivoProyecto",
      "Aprobación de complexivo/proyecto",
      [
        "aprobacioncomplexivoproyecto", "aprobacionComplexivoProyecto",
        "AprobacionComplexivoProyecto", "AprobaciónComplexivoProyecto"
      ],
      "final"
    )
  ];

  var constants = {
    version: VERSION,
    module: "Tabla",

    pagination: {
      defaultSize: 75,
      minSize: 25,
      maxSize: 300
    },

    delays: {
      render: 90,
      search: 300,
      baseEvent: 350,
      guardCapture: 120,
      guardRequest: 40
    },

    storage: {
      centralCache: "REQ_BDLOCAL_CONEXIONES_CACHE_V1",
      legacySnapshot: "REQ_BDLOCAL_LEGACY_SNAPSHOT_V1",
      oldSnapshot: "REQ_EXCEL_LOCAL_V1:snapshot",
      history: "tabla.telegram.historial.v1",
      selection: "tabla.telegram.selection.v1"
    },

    events: {
      ready: "tabla:ready",
      dataUpdated: "tabla:data-updated",
      filtersChanged: "tabla:filters-changed",
      pageChanged: "tabla:page-changed",
      stateChanged: "tabla:state-changed",
      renderRequested: "tabla:render-requested",
      rendered: "tabla:rendered",
      historyUpdated: "tabla:history-updated",
      selectionUpdated: "tabla:selection-updated",
      statusChanged: "tabla:status-changed",
      error: "tabla:error"
    },

    baseEvents: [
      "bdlocal:data-updated",
      "bdlocal:conexiones-cache-updated",
      "bdlocal:screen-data-updated",
      "bdlocal:screen-deps-ready",
      "bdlocal:legacy-ready",
      "bdlocal:legacy-snapshot",
      "requisitos:bl:snapshot-changed"
    ],

    sources: [
      "BDLocalConnectionClient",
      "ConTabla"
    ],

    matricula: {
      active: "ACTIVO",
      retired: "RETIRADO",
      all: ""
    },

    generalStatus: {
      ok: "cumple",
      pending: "pendiente",
      failed: "no_cumple",
      noData: "sin_dato"
    },

    requirementStatus: {
      ok: "cumple",
      pending: "pendiente",
      failed: "no_cumple",
      notApplicable: "no_aplica",
      noData: "sin_dato"
    },

    periodTypes: {
      regular: "REGULAR",
      pvc: "PVC"
    },

    periodPolicy: {
      regularPatterns: [
        ["octubre", "marzo"],
        ["abril", "septiembre"]
      ],
      baseKeys: BASE_REQUIREMENTS.map(function(item){ return item.key; }),
      regularOnlyKeys: REGULAR_REQUIREMENTS.map(function(item){ return item.key; }),
      finalKeys: FINAL_REQUIREMENTS.map(function(item){ return item.key; })
    },

    baseRequirements: BASE_REQUIREMENTS,
    regularOnlyRequirements: REGULAR_REQUIREMENTS,
    finalRequirements: FINAL_REQUIREMENTS,

    requirements: BASE_REQUIREMENTS.concat(REGULAR_REQUIREMENTS),

    defaultState: {
      periodId: "",
      division: "",
      matricula: "ACTIVO",
      career: "",
      status: "",
      search: "",
      requirementOrder: "",
      requirements: ["falta"],
      page: 1,
      pageSize: 75,
      rows: [],
      allRows: [],
      filteredRows: [],
      pagination: null,
      periods: [],
      divisionOptions: [],
      careerOptions: [],
      source: "Base Local",
      refreshing: false,
      rendering: false,
      booted: false,
      lastError: "",
      updatedAt: ""
    },

    messageTypes: [
      {value: "requisitos", label: "Falta req."},
      {value: "urgente", label: "Urgente"},
      {value: "ultimo", label: "Último aviso"},
      {value: "regularizar", label: "Regularizar"},
      {value: "nota_articulo", label: "Falta N-Art"},
      {value: "nota_defensa", label: "Falta N-Def"},
      {value: "sin_articulo", label: "Sin artículo"},
      {value: "no_aprueba", label: "No aprueba"},
      {value: "perdio", label: "Perdió"},
      {value: "alerta", label: "Alerta"},
      {value: "cronograma", label: "Cronograma"},
      {value: "libre", label: "Personal"}
    ],

    aliases: {
      id: [
        "id", "_id", "studentId", "estudianteId", "personaId",
        "_bl2Id", "idEstudiantePeriodo"
      ],

      cedula: [
        "_cedula", "cedula", "Cédula", "Cedula",
        "numeroIdentificacion", "NumeroIdentificacion",
        "numeroidentificacion", "identificacion", "Identificacion"
      ],

      names: [
        "_nombres", "Nombres", "nombres", "nombreCompleto",
        "nombre", "Nombre", "estudiante", "apellidosNombres"
      ],

      career: [
        "_carrera", "NombreCarrera", "nombreCarrera",
        "nombrecarrera", "Carrera", "carrera"
      ],

      careerCode: [
        "_codigoCarrera", "CodigoCarrera", "codigoCarrera",
        "codigocarrera", "codigo", "codCarrera"
      ],

      periodId: [
        "_periodoId", "periodoCanonicoId", "periodoId",
        "periodId", "ultimoPeriodoId", "idPeriodo", "_bl2PeriodoId"
      ],

      periodLabel: [
        "_periodo", "_periodoNormalizado", "periodoCanonicoLabel",
        "periodoLabel", "periodLabel", "periodo", "Periodo", "_bl2Periodo"
      ],

      division: [
        "_division", "_bl2Division", "division",
        "Division", "División", "divisionActual"
      ],

      matricula: [
        "_matricula", "_estadoMatricula", "matricula",
        "Matricula", "Matrícula", "estadoMatricula",
        "EstadoMatricula", "estado_matricula", "statusMatricula"
      ],

      email: [
        "_correo", "_correoPersonal", "_correoInstitucional",
        "CorreoPersonal", "correoPersonal",
        "CorreoInstitucional", "correoInstitucional",
        "correo", "email", "Email"
      ],

      personalEmail: [
        "_correoPersonal", "CorreoPersonal", "correoPersonal",
        "correopersonal", "correo", "email", "Email"
      ],

      institutionalEmail: [
        "_correoInstitucional", "CorreoInstitucional",
        "correoInstitucional", "correoinstitucional",
        "emailInstitucional", "EmailInstitucional"
      ],

      phone: [
        "_celular", "Celular", "celular", "telefono",
        "Teléfono", "Telefono", "whatsapp", "WhatsApp",
        "movil", "numeroCelular"
      ],

      telegramUser: [
        "_telegramUser", "telegramUser", "TelegramUser",
        "telegramuser", "usuarioTelegram", "UsuarioTelegram",
        "usuariotelegram", "telegram", "Telegram"
      ],

      telegramChatId: [
        "_telegramChatId", "telegramChatId", "TelegramChatId",
        "telegramchatid", "chatIdTelegram", "ChatIdTelegram",
        "chatidtelegram", "chatId", "ChatId", "chatid"
      ]
    }
  };

  window.TablaConstants = deepFreeze(constants);
})(window);

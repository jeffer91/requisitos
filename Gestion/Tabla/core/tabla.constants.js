/* =========================================================
Nombre completo: tabla.constants.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/core/tabla.constants.js
Función o funciones:
- Centralizar constantes, eventos, filtros y alias de campos de Tabla.
- Evitar valores duplicados entre datos, interfaz, comunicación e historial.
- Exponer una configuración inmutable mediante window.TablaConstants.
Con qué se conecta:
- Todos los módulos de la carpeta Tabla.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0";

  function deepFreeze(value){
    if(
      !value ||
      typeof value !== "object" ||
      Object.isFrozen(value)
    ){
      return value;
    }

    Object.keys(value).forEach(function(key){
      deepFreeze(value[key]);
    });

    try{
      Object.freeze(value);
    }catch(error){}

    return value;
  }

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
      centralCache:
        "REQ_BDLOCAL_CONEXIONES_CACHE_V1",

      legacySnapshot:
        "REQ_BDLOCAL_LEGACY_SNAPSHOT_V1",

      oldSnapshot:
        "REQ_EXCEL_LOCAL_V1:snapshot",

      history:
        "tabla.telegram.historial.v1",

      selection:
        "tabla.telegram.selection.v1"
    },

    events: {
      ready:
        "tabla:ready",

      dataUpdated:
        "tabla:data-updated",

      filtersChanged:
        "tabla:filters-changed",

      pageChanged:
        "tabla:page-changed",

      stateChanged:
        "tabla:state-changed",

      renderRequested:
        "tabla:render-requested",

      rendered:
        "tabla:rendered",

      historyUpdated:
        "tabla:history-updated",

      selectionUpdated:
        "tabla:selection-updated",

      statusChanged:
        "tabla:status-changed",

      error:
        "tabla:error"
    },

    baseEvents: [
      "bdlocal:conexiones-cache-updated",
      "bdlocal:screen-data-updated",
      "bdlocal:screen-deps-ready",
      "bdlocal:legacy-ready",
      "bdlocal:legacy-snapshot",
      "requisitos:bl:snapshot-changed"
    ],

    sources: [
      "ConTabla",
      "BDLocalTabla",
      "BDLocalConexiones",
      "BDLocalScreenDeps",
      "BL2DataEngine",
      "BL2EstudiantesRepo",
      "ExcelLocalRepo"
    ],

    matricula: {
      active: "ACTIVO",
      retired: "RETIRADO",
      all: ""
    },

    generalStatus: {
      ok: "cumple",
      pending: "pendiente",
      failed: "no_cumple"
    },

    requirementStatus: {
      ok: "cumple",
      pending: "pendiente",
      failed: "no_cumple"
    },

    defaultState: {
      periodId: "",
      division: "",
      matricula: "ACTIVO",
      career: "",
      status: "",
      search: "",
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
      {
        value: "requisitos",
        label: "Falta req."
      },
      {
        value: "urgente",
        label: "Urgente"
      },
      {
        value: "ultimo",
        label: "Último aviso"
      },
      {
        value: "regularizar",
        label: "Regularizar"
      },
      {
        value: "nota_articulo",
        label: "Falta N-Art"
      },
      {
        value: "nota_defensa",
        label: "Falta N-Def"
      },
      {
        value: "sin_articulo",
        label: "Sin artículo"
      },
      {
        value: "no_aprueba",
        label: "No aprueba"
      },
      {
        value: "perdio",
        label: "Perdió"
      },
      {
        value: "alerta",
        label: "Alerta"
      },
      {
        value: "cronograma",
        label: "Cronograma"
      },
      {
        value: "libre",
        label: "Personal"
      }
    ],

    requirements: [
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
    ],

    aliases: {
      id: [
        "id",
        "_id",
        "studentId",
        "estudianteId",
        "personaId",
        "_bl2Id"
      ],

      cedula: [
        "_cedula",
        "cedula",
        "Cédula",
        "Cedula",
        "numeroIdentificacion",
        "NumeroIdentificacion",
        "numeroidentificacion",
        "identificacion",
        "Identificacion"
      ],

      names: [
        "_nombres",
        "Nombres",
        "nombres",
        "nombre",
        "Nombre",
        "estudiante"
      ],

      career: [
        "_carrera",
        "NombreCarrera",
        "nombreCarrera",
        "nombrecarrera",
        "Carrera",
        "carrera"
      ],

      careerCode: [
        "CodigoCarrera",
        "codigoCarrera",
        "codigocarrera",
        "codigo",
        "codCarrera"
      ],

      periodId: [
        "_periodoId",
        "periodoCanonicoId",
        "periodoId",
        "periodId",
        "ultimoPeriodoId",
        "idPeriodo",
        "_bl2PeriodoId"
      ],

      periodLabel: [
        "_periodo",
        "periodoCanonicoLabel",
        "periodoLabel",
        "periodLabel",
        "periodo",
        "Periodo",
        "_bl2Periodo"
      ],

      division: [
        "_division",
        "_bl2Division",
        "division",
        "Division",
        "División",
        "divisionActual"
      ],

      matricula: [
        "matricula",
        "Matricula",
        "Matrícula",
        "estadoMatricula",
        "EstadoMatricula",
        "estado_matricula",
        "statusMatricula"
      ],

      email: [
        "_correo",
        "CorreoPersonal",
        "correoPersonal",
        "CorreoInstitucional",
        "correoInstitucional",
        "correo",
        "email",
        "Email"
      ],

      phone: [
        "_celular",
        "Celular",
        "celular",
        "telefono",
        "Teléfono",
        "whatsapp",
        "movil"
      ],

      telegramUser: [
        "_telegramUser",
        "telegramUser",
        "TelegramUser",
        "telegramuser",
        "usuarioTelegram",
        "UsuarioTelegram",
        "usuariotelegram",
        "telegram",
        "Telegram"
      ],

      telegramChatId: [
        "_telegramChatId",
        "telegramChatId",
        "TelegramChatId",
        "telegramchatid",
        "chatIdTelegram",
        "ChatIdTelegram",
        "chatidtelegram",
        "chatId",
        "ChatId",
        "chatid"
      ]
    }
  };

  window.TablaConstants =
    deepFreeze(constants);
})(window);
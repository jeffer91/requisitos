/* =========================================================
Nombre completo: ncomplex.config.js
Ruta o ubicación: /Ncomplex/ncomplex.config.js
Función o funciones:
- Centralizar constantes, modalidades, estados, fórmulas y campos de Ncomplex.
- Definir los encabezados reconocidos en el texto pegado.
- Mantener una sola configuración compartida por todos los archivos de pantalla.
Con qué se conecta:
- ncomplex.state.js
- ncomplex.parser.js
- ncomplex.calculator.js
- ncomplex.filters.js
- ncomplex.table.js
- ncomplex.app.js
========================================================= */
(function(window){
  "use strict";

  var MODALIDADES = {
    COMPLEXIVO: "EXAMEN_COMPLEXIVO",
    TRABAJO: "TRABAJO_TITULACION"
  };

  var ESTADOS = {
    SIN_NOTAS: "SIN_NOTAS",
    INCOMPLETO: "INCOMPLETO",
    APROBADO: "APROBADO",
    NO_APROBADO: "NO_APROBADO"
  };

  var CAMPOS_NOTA = [
    "notaTeorica",
    "notaPractica",
    "notaComplexivo",
    "notaTeoricaSupletorio",
    "notaPracticaSupletorio",
    "notaSupletorio",
    "notaEscrito",
    "notaDefensaTrabajo",
    "notaTrabajoTitulacion"
  ];

  var HEADER_ALIASES = {
    codigoTitulacion: [
      "codigo titulacion",
      "código titulación",
      "codigo de titulacion",
      "código de titulación"
    ],
    cedula: ["cedula", "cédula", "numero identificacion", "número identificación"],
    nombreCompleto: ["nombre completo", "estudiante", "nombres"],
    horario: ["horario", "jornada"],
    nota1: ["nota 1", "nota1", "teorico", "teórico"],
    nota2: ["nota 2", "nota2", "practico", "práctico"],
    supletorioComplexivo: ["supletorio complexivo", "supletorio"],
    trabajoTitulacion: ["trabajo titulacion", "trabajo titulación"],
    trabajoPromedioAcumulado: [
      "trabajo promedio acumulado",
      "promedio acumulado",
      "promedio"
    ]
  };

  function labelModalidad(value){
    return value === MODALIDADES.TRABAJO
      ? "Trabajo de titulación"
      : "Examen complexivo";
  }

  function labelEstado(value){
    var labels = {};
    labels[ESTADOS.SIN_NOTAS] = "Sin notas";
    labels[ESTADOS.INCOMPLETO] = "Incompleto";
    labels[ESTADOS.APROBADO] = "Aprobado";
    labels[ESTADOS.NO_APROBADO] = "No aprobado";
    return labels[value] || value || "Sin estado";
  }

  window.NcomplexConfig = {
    version: "1.0.0-bloque-2",
    pageSize: 25,
    passingGrade: 7,
    decimals: 2,
    modalidades: MODALIDADES,
    estados: ESTADOS,
    camposNota: CAMPOS_NOTA.slice(),
    headerAliases: HEADER_ALIASES,
    formulas: {
      complexivo: { teorico: 0.40, practico: 0.60 },
      trabajo: { escrito: 0.60, defensa: 0.40 }
    },
    selectors: {
      periodo: "ncomplex-filter-periodo",
      carrera: "ncomplex-filter-carrera",
      modalidad: "ncomplex-filter-modalidad",
      estado: "ncomplex-filter-estado",
      busqueda: "ncomplex-filter-search",
      soloFaltantes: "ncomplex-filter-faltantes",
      textarea: "ncomplex-paste-data",
      tabla: "ncomplex-table-wrap",
      resumen: "ncomplex-summary",
      resumenCarreras: "ncomplex-career-summary",
      resultadosImportacion: "ncomplex-import-results",
      paginacion: "ncomplex-pagination"
    },
    labelModalidad: labelModalidad,
    labelEstado: labelEstado
  };
})(window);
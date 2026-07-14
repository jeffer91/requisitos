/* =========================================================
Nombre completo: global.config.js
Ruta o ubicación: /Requisitos/Global/global.config.js
Función:
- Centralizar la configuración inicial del módulo Global.
- Definir identidad institucional, colores, logo, filtros y secciones.
- Mantener reglas mínimas para la clasificación Universitaria/Superior.
- Configurar un mes de espera para mostrar períodos finalizados.
- Configurar el criterio y mínimo institucional para graduados.
Con qué se conecta:
- global.html
- global.index.js
- global.core.js
========================================================= */
(function(window){
  "use strict";

  var CONFIG = Object.freeze({
    app: Object.freeze({
      id: "global",
      nombre: "Global",
      titulo: "Análisis Global de Titulación",
      subtitulo: "Análisis histórico y comparativo de información cargada en Base Local",
      unidad: "Unidad de Titulación y Eficiencia Terminal",
      version: "1.2.0-global-stable",
      modo: "base-ui"
    }),

    branding: Object.freeze({
      logoPath: "assets/branding/logo-instituto.png",
      logoFallbackText: "Logo institucional",
      azulMarino: "#071A33",
      azulMarino2: "#0B2447",
      dorado: "#C9A227",
      doradoSuave: "#E4C766",
      blanco: "#FFFFFF",
      fondo: "#F4F6FA",
      texto: "#1F2937"
    }),

    filtros: Object.freeze({
      pageSize: 25,
      autoAplicar: true,

      tiposCarrera: Object.freeze([
        {
          id: "",
          label: "Todas"
        },
        {
          id: "UNIVERSITARIA",
          label: "Universitaria"
        },
        {
          id: "SUPERIOR",
          label: "Superior"
        }
      ]),

      requisitoTodos: Object.freeze({
        id: "",
        label: "Todos los requisitos"
      }),

      carreraTodas: Object.freeze({
        id: "",
        label: "Todas las carreras"
      }),

      divisionTodas: Object.freeze({
        id: "",
        label: "Todas las divisiones"
      })
    }),

    periodos: Object.freeze({
      /*
       * Una vez finalizado el período se reserva un mes
       * completo para titulación. Se muestra desde el primer
       * día del mes siguiente.
       */
      mesesEsperaTitulacion: 1
    }),

    secciones: Object.freeze([
      {
        id: "resumen",
        label: "Resumen",
        titulo: "Resumen general",
        descripcion: "Vista ejecutiva del universo filtrado.",
        pdfTitulo: "Reporte global - Resumen general"
      },
      {
        id: "estudiantes",
        label: "Estudiantes",
        titulo: "Estudiantes",
        descripcion: "Cantidad, estado y detalle de estudiantes según filtros aplicados.",
        pdfTitulo: "Reporte global - Estudiantes"
      },
      {
        id: "carreras",
        label: "Carreras",
        titulo: "Carreras",
        descripcion: "Análisis comparativo de carreras dentro del rango seleccionado.",
        pdfTitulo: "Reporte global - Carreras"
      },
      {
        id: "requisitos",
        label: "Requisitos",
        titulo: "Requisitos",
        descripcion: "Cumplimiento, pendientes e incumplimientos por requisito.",
        pdfTitulo: "Reporte global - Requisitos"
      },
      {
        id: "periodos",
        label: "Períodos",
        titulo: "Períodos académicos",
        descripcion: "Comparativa histórica entre períodos académicos.",
        pdfTitulo: "Reporte global - Períodos académicos"
      },
      {
        id: "tipo-carrera",
        label: "Tipo de carrera",
        titulo: "Universitaria vs Superior",
        descripcion: "Comparativa por clasificación de carrera.",
        pdfTitulo: "Reporte global - Tipo de carrera"
      },
      {
        id: "comparativas",
        label: "Comparativas",
        titulo: "Comparativas cruzadas",
        descripcion: "Cruces entre carrera, período, requisito y tipo de carrera.",
        pdfTitulo: "Reporte global - Comparativas"
      },
      {
        id: "graduados",
        label: "Graduados",
        titulo: "Graduados por período",
        descripcion: "Períodos con al menos tres estudiantes cuyo campo AprobacionTitulacion tiene el valor CUMPLE.",
        pdfTitulo: "Reporte global - Graduados por período"
      },
      {
        id: "alertas",
        label: "Alertas",
        titulo: "Alertas y datos críticos",
        descripcion: "Identificación de requisitos críticos, carreras con pendientes y datos incompletos.",
        pdfTitulo: "Reporte global - Alertas"
      },
      {
        id: "reportes",
        label: "Reportes",
        titulo: "Reportes institucionales",
        descripcion: "Historial y generación de reportes filtrados por sección.",
        pdfTitulo: "Reporte global - Reportes"
      }
    ]),

    graduados: Object.freeze({
      campo: "AprobacionTitulacion",
      valorEsperado: "CUMPLE",

      /*
       * CUMPLE, cumple y " CUMPLE " serán reconocidos.
       * APROBADO, SÍ, OK y otros valores no serán aceptados.
       */
      compararMayusculas: true,
      recortarEspacios: true,

      /*
       * Evita contar dos veces al mismo estudiante dentro
       * del mismo período académico.
       */
      contarUnicoPorPeriodo: true,

      /*
       * Un período aparece en Graduados solo cuando alcanza
       * este mínimo de estudiantes graduados.
       */
      minimoPorPeriodo: 3
    }),

    reglas: Object.freeze({
      tipoCarrera: function(nombreCarrera){
        var value = String(
          nombreCarrera == null ? "" : nombreCarrera
        ).toUpperCase();

        return value.indexOf("UNIVERSITARIA") >= 0
          ? "UNIVERSITARIA"
          : "SUPERIOR";
      }
    })
  });

  window.GlobalConfig = CONFIG;
})(window);

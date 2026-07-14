/* =========================================================
Nombre completo: global.config.js
Ruta o ubicación: /Requisitos/Global/global.config.js
Función:
- Centralizar la configuración del módulo Global.
- Definir identidad, filtros, secciones, firmas y reglas institucionales.
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
      version: "1.3.0-reportes-institucionales",
      modo: "base-ui"
    }),

    branding: Object.freeze({
      logoPath: "assets/branding/logo-instituto.png",
      logoFallbackText: "ITSQMET",
      azulMarino: "#071A33",
      azulMarino2: "#0B2447",
      dorado: "#C9A227",
      doradoSuave: "#E4C766",
      blanco: "#FFFFFF",
      fondo: "#F4F6FA",
      texto: "#1F2937"
    }),

    firmas: Object.freeze([
      Object.freeze({
        responsabilidad: "ELABORADO POR:",
        nombre: "Mgtr. Jefferson Villarreal",
        cargo: "Coordinador de Titulación y Eficiencia Terminal"
      }),
      Object.freeze({
        responsabilidad: "REVISADO POR:",
        nombre: "Mpde. Martha Tomalá",
        cargo: "Secretaria General"
      }),
      Object.freeze({
        responsabilidad: "APROBADO POR:",
        nombre: "Dr. Alex León T.",
        cargo: "Vicerrector"
      })
    ]),

    filtros: Object.freeze({
      pageSize: 25,
      autoAplicar: true,
      tiposCarrera: Object.freeze([
        Object.freeze({ id: "", label: "Todas" }),
        Object.freeze({ id: "UNIVERSITARIA", label: "Universitaria" }),
        Object.freeze({ id: "SUPERIOR", label: "Superior" })
      ]),
      requisitoTodos: Object.freeze({ id: "", label: "Todos los requisitos" }),
      carreraTodas: Object.freeze({ id: "", label: "Todas las carreras" }),
      divisionTodas: Object.freeze({ id: "", label: "Todas las divisiones" })
    }),

    periodos: Object.freeze({
      mesesEsperaTitulacion: 1
    }),

    secciones: Object.freeze([
      { id: "resumen", label: "Resumen", titulo: "Resumen general", descripcion: "Vista ejecutiva del universo filtrado.", pdfTitulo: "Reporte global - Resumen general" },
      { id: "estudiantes", label: "Estudiantes", titulo: "Estudiantes", descripcion: "Cantidad, estado y detalle de estudiantes según filtros aplicados.", pdfTitulo: "Reporte global - Estudiantes" },
      { id: "carreras", label: "Carreras", titulo: "Carreras", descripcion: "Análisis comparativo de carreras dentro del rango seleccionado.", pdfTitulo: "Reporte global - Carreras" },
      { id: "requisitos", label: "Requisitos", titulo: "Requisitos", descripcion: "Cumplimiento, pendientes e incumplimientos por requisito.", pdfTitulo: "Reporte global - Requisitos" },
      { id: "periodos", label: "Períodos", titulo: "Períodos académicos", descripcion: "Comparativa histórica entre períodos académicos.", pdfTitulo: "Reporte global - Períodos académicos" },
      { id: "tipo-carrera", label: "Tipo de carrera", titulo: "Universitaria vs Superior", descripcion: "Comparativa por clasificación de carrera.", pdfTitulo: "Reporte global - Tipo de carrera" },
      { id: "comparativas", label: "Comparativas", titulo: "Comparativas cruzadas", descripcion: "Cruces entre carrera, período, requisito y tipo de carrera.", pdfTitulo: "Reporte global - Comparativas" },
      { id: "graduados", label: "Graduados", titulo: "Graduados por período", descripcion: "Distribución histórica de estudiantes graduados por período académico.", pdfTitulo: "Reporte global - Graduados por período" },
      { id: "alertas", label: "Alertas", titulo: "Alertas y datos críticos", descripcion: "Identificación de requisitos críticos, carreras con pendientes y datos incompletos.", pdfTitulo: "Reporte global - Alertas" },
      { id: "reportes", label: "Reportes", titulo: "Reportes institucionales", descripcion: "Historial y generación de reportes filtrados por sección.", pdfTitulo: "Reporte global - Reportes" }
    ]),

    graduados: Object.freeze({
      campo: "AprobacionTitulacion",
      valorEsperado: "CUMPLE",
      compararMayusculas: true,
      recortarEspacios: true,
      contarUnicoPorPeriodo: true,
      minimoPorPeriodo: 3
    }),

    reglas: Object.freeze({
      tipoCarrera: function(nombreCarrera){
        var value = String(nombreCarrera == null ? "" : nombreCarrera).toUpperCase();
        return value.indexOf("UNIVERSITARIA") >= 0 ? "UNIVERSITARIA" : "SUPERIOR";
      }
    })
  });

  window.GlobalConfig = CONFIG;
})(window);

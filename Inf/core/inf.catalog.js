/* Índice oficial del informe: conservar títulos, orden y numeración. */
(function (window) {
  "use strict";
  var chapters = [
  {
    "number": "1",
    "title": "Introducción",
    "sections": [
      {
        "number": "1.1",
        "title": "Contextualización del proceso de titulación",
        "sections": []
      },
      {
        "number": "1.2",
        "title": "Objetivos del informe",
        "sections": []
      },
      {
        "number": "1.3",
        "title": "Alcance y período académico evaluado",
        "sections": []
      }
    ]
  },
  {
    "number": "2",
    "title": "Base Legal",
    "sections": [
      {
        "number": "2.1",
        "title": "Constitución de la República del Ecuador",
        "sections": []
      },
      {
        "number": "2.2",
        "title": "Ley Orgánica de Educación Superior (LOES)",
        "sections": []
      },
      {
        "number": "2.3",
        "title": "Reglamento de Régimen Académico",
        "sections": []
      },
      {
        "number": "2.4",
        "title": "Normativa institucional de titulación",
        "sections": []
      },
      {
        "number": "2.5",
        "title": "Reglamento General a la Ley Orgánica de Educación Superior",
        "sections": []
      },
      {
        "number": "2.6",
        "title": "Normativa de evaluación y aseguramiento de la calidad de la educación superior",
        "sections": []
      },
      {
        "number": "2.7",
        "title": "Ley Orgánica de Protección de Datos Personales",
        "sections": []
      },
      {
        "number": "2.8",
        "title": "Integridad académica y propiedad intelectual",
        "sections": []
      },
      {
        "number": "2.9",
        "title": "Aplicación normativa, seguimiento y trazabilidad institucional",
        "sections": []
      }
    ]
  },
  {
    "number": "3",
    "title": "Metodología",
    "sections": [
      {
        "number": "3.1",
        "title": "Descripción del proceso de titulación",
        "sections": []
      },
      {
        "number": "3.2",
        "title": "Población estudiantil y fuentes de información",
        "sections": []
      },
      {
        "number": "3.3",
        "title": "Procedimiento de verificación de requisitos",
        "sections": []
      },
      {
        "number": "3.4",
        "title": "Metodología de los núcleos estructurantes",
        "sections": []
      },
      {
        "number": "3.5",
        "title": "Metodología de evaluación del examen complexivo",
        "sections": []
      },
      {
        "number": "3.6",
        "title": "Procedimiento de análisis de resultados",
        "sections": []
      }
    ]
  },
  {
    "number": "4",
    "title": "Resultados",
    "sections": [
      {
        "number": "4.1",
        "title": "Resultados de Requisitos de Titulación",
        "sections": [
          {
            "number": "4.1.1",
            "title": "Estado de cumplimiento de requisitos por carrera",
            "sections": []
          },
          {
            "number": "4.1.2",
            "title": "Análisis de requisitos cumplidos y pendientes",
            "sections": []
          },
          {
            "number": "4.1.3",
            "title": "Consolidado general de cumplimiento",
            "sections": []
          }
        ]
      },
      {
        "number": "4.2",
        "title": "Resultados de Núcleos Estructurantes",
        "sections": [
          {
            "number": "4.2.1",
            "title": "Resultados académicos por carrera y núcleo",
            "sections": []
          },
          {
            "number": "4.2.2",
            "title": "Análisis de calificaciones de los núcleos",
            "sections": []
          },
          {
            "number": "4.2.3",
            "title": "Consolidado general de resultados académicos",
            "sections": []
          }
        ]
      },
      {
        "number": "4.3",
        "title": "Resultados del Examen Complexivo",
        "sections": [
          {
            "number": "4.3.1",
            "title": "Resultados del componente teórico por carrera",
            "sections": []
          },
          {
            "number": "4.3.2",
            "title": "Resultados del componente práctico por carrera",
            "sections": []
          },
          {
            "number": "4.3.3",
            "title": "Resultados finales del examen complexivo",
            "sections": []
          },
          {
            "number": "4.3.4",
            "title": "Análisis de aprobados y estudiantes que requieren supletorio",
            "sections": []
          },
          {
            "number": "4.3.5",
            "title": "Consolidado general de resultados",
            "sections": []
          }
        ]
      }
    ]
  },
  {
    "number": "5",
    "title": "Resumen Ejecutivo",
    "sections": [
      {
        "number": "5.1",
        "title": "Principales indicadores del proceso de titulación",
        "sections": []
      },
      {
        "number": "5.2",
        "title": "Síntesis de resultados por carrera",
        "sections": []
      },
      {
        "number": "5.3",
        "title": "Principales hallazgos académicos y administrativos",
        "sections": []
      }
    ]
  },
  {
    "number": "6",
    "title": "Conclusiones",
    "sections": [
      {
        "number": "6.1",
        "title": "Conclusiones sobre el cumplimiento de requisitos",
        "sections": []
      },
      {
        "number": "6.2",
        "title": "Conclusiones sobre los núcleos estructurantes",
        "sections": []
      },
      {
        "number": "6.3",
        "title": "Conclusiones sobre el examen complexivo",
        "sections": []
      },
      {
        "number": "6.4",
        "title": "Conclusión general del proceso de titulación",
        "sections": []
      }
    ]
  },
  {
    "number": "7",
    "title": "Recomendaciones",
    "sections": [
      {
        "number": "7.1",
        "title": "Recomendaciones para la gestión de requisitos",
        "sections": []
      },
      {
        "number": "7.2",
        "title": "Recomendaciones para los núcleos estructurantes",
        "sections": []
      },
      {
        "number": "7.3",
        "title": "Recomendaciones para el examen complexivo",
        "sections": []
      },
      {
        "number": "7.4",
        "title": "Recomendaciones para la mejora del proceso de titulación",
        "sections": []
      }
    ]
  },
  {
    "number": "8",
    "title": "Referencias",
    "sections": []
  }
];
  function freeze(node) {
    (node.sections || []).forEach(freeze);
    Object.freeze(node.sections);
    return Object.freeze(node);
  }
  chapters.forEach(freeze);
  Object.freeze(chapters);
  function flatten() {
    var out = [];
    function visit(node) {
      out.push(node);
      (node.sections || []).forEach(visit);
    }
    chapters.forEach(visit);
    return out;
  }
  function find(number) {
    return flatten().find(function (node) { return node.number === String(number); }) || null;
  }
  window.InfCatalog = Object.freeze({
    chapters: chapters, flatten: flatten, find: find, version: "1.0.0"
  });
})(window);

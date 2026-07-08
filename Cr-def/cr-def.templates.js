/* =========================================================
Nombre completo: cr-def.templates.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.templates.js
Función o funciones:
- Definir plantillas quemadas para cronogramas de defensa.
- Permitir que el generador use días, aulas, sedes, horarios y tribunales base.
- Evitar edición dinámica de plantillas: los datos se llenan con BDLocal.
Con qué se conecta:
- cr-def.config.js
- cr-def.scheduler.js
========================================================= */
(function(window){
  "use strict";

  var DEFAULT_DURATION = 30;

  var CAREER_ALIASES = {
    administracion: [
      "UNIVERSITARIA EN ADMINISTRACIÓN DE EMPRESAS",
      "UNIVERSITARIA EN ADMINISTRACION DE EMPRESAS",
      "ADMINISTRACIÓN DE EMPRESAS",
      "ADMINISTRACION DE EMPRESAS"
    ],
    talentoHumano: [
      "UNIVERSITARIA EN ADMINISTRACIÓN DE TALENTO HUMANO",
      "UNIVERSITARIA EN ADMINISTRACION DE TALENTO HUMANO",
      "ADMINISTRACIÓN DE TALENTO HUMANO",
      "ADMINISTRACION DE TALENTO HUMANO",
      "TALENTO HUMANO"
    ],
    contabilidad: [
      "UNIVERSITARIA EN CONTABILIDAD Y TRIBUTARIA",
      "CONTABILIDAD Y TRIBUTARIA"
    ],
    redes: [
      "UNIVERSITARIA EN REDES Y TELECOMUNICACIONES",
      "UNIVERSITARIA EN REDES Y TELECOMUNICACIONES ONLINE",
      "REDES Y TELECOMUNICACIONES"
    ],
    marketing: [
      "UNIVERSITARIA EN MARKETING DIGITAL",
      "UNIVERSITARIA EN MARKETING DIGITAL ONLINE",
      "MARKETING DIGITAL"
    ],
    pedagogia: [
      "UNIVERSITARIA EN PEDAGOGÍA",
      "UNIVERSITARIA EN PEDAGOGIA",
      "PEDAGOGÍA",
      "PEDAGOGIA"
    ],
    educacionInicial: [
      "UNIVERSITARIA EN EDUCACIÓN INICIAL",
      "UNIVERSITARIA EN EDUCACION INICIAL",
      "UNIVERSITARIA EN EDUACIÓN INICIAL",
      "EDUCACIÓN INICIAL",
      "EDUCACION INICIAL",
      "EDUACIÓN INICIAL"
    ],
    mecanica: [
      "MECÁNICA AUTOMOTRIZ",
      "MECANICA AUTOMOTRIZ"
    ],
    alimentos: [
      "PROCESAMIENTO EN ALIMENTOS",
      "PROCESAMIENTO DE ALIMENTOS"
    ]
  };

  var TRIBUNALES = {
    administracion: [
      {
        id: "adm-01",
        nombre: "Administración · Tribunal 1",
        tribunal1: "Jefferson Villarreal",
        tribunal2: "Jhair Aldas",
        tribunal3: ""
      },
      {
        id: "adm-02",
        nombre: "Administración · Tribunal 2",
        tribunal1: "Rodrigo Espinoza",
        tribunal2: "José Zambrano",
        tribunal3: "Mercedes Escudero"
      },
      {
        id: "adm-03",
        nombre: "Administración · Tribunal 3",
        tribunal1: "Francisco Samaniego",
        tribunal2: "Katheryn Simbaña",
        tribunal3: "Luis Segovia"
      }
    ],
    talentoHumano: [
      {
        id: "th-01",
        nombre: "Talento Humano · Tribunal 1",
        tribunal1: "Alejandra Hernandez",
        tribunal2: "Veronica Ayala",
        tribunal3: ""
      },
      {
        id: "th-02",
        nombre: "Talento Humano · Tribunal 2",
        tribunal1: "Rodrigo Espinoza",
        tribunal2: "Luis Segovia",
        tribunal3: "Jefferson Villarreal"
      }
    ],
    contabilidad: [
      {
        id: "cont-01",
        nombre: "Contabilidad · Tribunal 1",
        tribunal1: "Carla Rivera",
        tribunal2: "Edison Tito",
        tribunal3: "Brenda Reyes"
      },
      {
        id: "cont-02",
        nombre: "Contabilidad · Tribunal 2",
        tribunal1: "Katheryn Simbaña",
        tribunal2: "Leonardo Segovia",
        tribunal3: "Viviana Toapanta"
      }
    ],
    redes: [
      {
        id: "redes-01",
        nombre: "Redes · Tribunal 1",
        tribunal1: "Juan Carlos Pazmiño Quiñonez",
        tribunal2: "William Andrés Pérez Mayorga",
        tribunal3: "Luis Enrique Yulan Mendoza"
      }
    ],
    marketing: [
      {
        id: "mkt-01",
        nombre: "Marketing · Tribunal 1",
        tribunal1: "",
        tribunal2: "",
        tribunal3: ""
      }
    ],
    pedagogia: [
      {
        id: "ped-01",
        nombre: "Pedagogía · Tribunal 1",
        tribunal1: "Maria Barre",
        tribunal2: "Katherine Gorritti",
        tribunal3: "Grimaneza Villarroel"
      }
    ],
    educacionInicial: [
      {
        id: "edu-01",
        nombre: "Educación Inicial · Tribunal 1",
        tribunal1: "Maria Barre",
        tribunal2: "Katherine Gorritti",
        tribunal3: "Grimaneza Villarroel"
      }
    ],
    mecanica: [
      {
        id: "mec-01",
        nombre: "Mecánica · Tribunal 1",
        tribunal1: "Stalyn Llumiquinga",
        tribunal2: "Juan Tunalaya",
        tribunal3: "Jefferson Villarreal"
      }
    ],
    alimentos: [
      {
        id: "alim-01",
        nombre: "Alimentos · Tribunal 1",
        tribunal1: "Bertha Cuchipe",
        tribunal2: "Alex Bustamante",
        tribunal3: "Mayra Molina"
      }
    ]
  };

  var TEMPLATES = [
    {
      id: "administracion-matriz",
      nombre: "Administración · Matriz",
      carreraKey: "administracion",
      sede: "Matriz",
      duracionMinutos: DEFAULT_DURATION,
      bloques: [
        { dia: "", aula: "306", inicio: "10:30", fin: "13:00", tribunalId: "adm-01" },
        { dia: "", aula: "301", inicio: "10:30", fin: "12:00", tribunalId: "adm-03" },
        { dia: "", aula: "302", inicio: "10:30", fin: "12:00", tribunalId: "adm-02" }
      ]
    },
    {
      id: "talento-humano-matriz",
      nombre: "Talento Humano · Matriz",
      carreraKey: "talentoHumano",
      sede: "Matriz",
      duracionMinutos: DEFAULT_DURATION,
      bloques: [
        { dia: "", aula: "302", inicio: "10:30", fin: "13:00", tribunalId: "th-01" },
        { dia: "", aula: "301", inicio: "10:30", fin: "13:00", tribunalId: "th-02" }
      ]
    },
    {
      id: "contabilidad-matriz",
      nombre: "Contabilidad · Matriz",
      carreraKey: "contabilidad",
      sede: "Matriz",
      duracionMinutos: DEFAULT_DURATION,
      bloques: [
        { dia: "", aula: "301", inicio: "10:30", fin: "13:00", tribunalId: "cont-01" },
        { dia: "", aula: "302", inicio: "10:30", fin: "12:00", tribunalId: "cont-02" }
      ]
    },
    {
      id: "redes-sur",
      nombre: "Redes · Sur",
      carreraKey: "redes",
      sede: "Sur",
      duracionMinutos: DEFAULT_DURATION,
      bloques: [
        { dia: "", aula: "209", inicio: "10:30", fin: "13:00", tribunalId: "redes-01" },
        { dia: "", aula: "209", inicio: "10:30", fin: "12:00", tribunalId: "redes-01" }
      ]
    },
    {
      id: "educacion-pedagogia-matriz",
      nombre: "Educación / Pedagogía · Matriz",
      carreraKey: "educacionInicial",
      sede: "Matriz",
      duracionMinutos: DEFAULT_DURATION,
      bloques: [
        { dia: "", aula: "302", inicio: "09:30", fin: "12:00", tribunalId: "edu-01" },
        { dia: "", aula: "305", inicio: "10:30", fin: "12:00", tribunalId: "edu-01" }
      ]
    },
    {
      id: "carreras-pequenas-matriz",
      nombre: "Carreras pequeñas · Matriz",
      carreraKey: "mixto",
      sede: "Matriz",
      duracionMinutos: DEFAULT_DURATION,
      bloques: [
        { dia: "", aula: "303", inicio: "10:30", fin: "12:00", tribunalId: "mec-01" },
        { dia: "", aula: "303", inicio: "10:30", fin: "12:00", tribunalId: "alim-01" },
        { dia: "", aula: "", inicio: "10:30", fin: "12:00", tribunalId: "mkt-01" }
      ]
    },
    {
      id: "virtual-general",
      nombre: "Virtual · General",
      carreraKey: "mixto",
      sede: "Virtual",
      duracionMinutos: DEFAULT_DURATION,
      bloques: [
        { dia: "", aula: "", inicio: "10:30", fin: "12:30", tribunalId: "" }
      ]
    }
  ];

  function text(value){
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function norm(value){
    return text(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function detectCareerKey(carrera){
    var clean = norm(carrera);
    var keys = Object.keys(CAREER_ALIASES);

    for(var i = 0; i < keys.length; i += 1){
      var key = keys[i];
      var aliases = CAREER_ALIASES[key] || [];
      var found = aliases.some(function(alias){
        var normalizedAlias = norm(alias);
        return clean === normalizedAlias || clean.indexOf(normalizedAlias) !== -1 || normalizedAlias.indexOf(clean) !== -1;
      });
      if(found){ return key; }
    }

    return "mixto";
  }

  function tribunalesPorCarrera(carrera){
    var key = detectCareerKey(carrera);
    return TRIBUNALES[key] || [];
  }

  function templatesPorCarrera(carrera){
    var key = detectCareerKey(carrera);
    return TEMPLATES.filter(function(template){
      return template.carreraKey === key || template.carreraKey === "mixto";
    });
  }

  function tribunalPorId(id){
    var keys = Object.keys(TRIBUNALES);
    for(var i = 0; i < keys.length; i += 1){
      var found = (TRIBUNALES[keys[i]] || []).find(function(item){ return item.id === id; });
      if(found){ return found; }
    }
    return null;
  }

  window.CR_DEF_TEMPLATES = Object.freeze({
    duration: DEFAULT_DURATION,
    careerAliases: CAREER_ALIASES,
    tribunales: TRIBUNALES,
    templates: TEMPLATES,
    detectCareerKey: detectCareerKey,
    tribunalesPorCarrera: tribunalesPorCarrera,
    templatesPorCarrera: templatesPorCarrera,
    tribunalPorId: tribunalPorId
  });
})(window);

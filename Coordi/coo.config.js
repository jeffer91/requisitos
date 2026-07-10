/* =========================================================
Nombre completo: coo.config.js
Ruta o ubicación: /Requisitos/Coordi/coo.config.js
Función o funciones:
- Centralizar responsables, correos y WhatsApp de Coordi.
- Definir las áreas que recibirán reportes.
- Mapear requisitos/campos pendientes hacia el área responsable.
Con qué se conecta:
- coo.report.js
- coo.mail.js
- coo.whatsapp.js
- coo.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-coo-config.1";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"").toLowerCase();}
  function phoneEC(value){
    var digits = text(value).replace(/[^0-9]/g, "");
    if(!digits){return "";}
    if(digits.indexOf("593") === 0){return digits;}
    if(digits.charAt(0) === "0"){return "593" + digits.slice(1);}
    if(digits.length === 9){return "593" + digits;}
    return digits;
  }

  var global = {
    id:"global",
    tipo:"global",
    area:"Reporte global",
    responsable:"Dr. Alex León",
    saludo:"Dr. Alex León",
    correo:"aleon@itsqmet.edu.ec",
    whatsapp:phoneEC("0984059654"),
    descripcion:"Resumen ejecutivo de pendientes por área."
  };

  var areas = [
    {
      id:"academico",
      orden:1,
      area:"Académico",
      responsable:"Martha Tomalá y coordinadores",
      saludo:"Martha",
      correo:"mtomala@itsqmet.edu.ec",
      whatsapp:phoneEC("0995278201"),
      descripcion:"Temas académicos y validación académica de requisitos.",
      requisitoKeys:["academico", "academica", "academicoestado", "estadoacademico"]
    },
    {
      id:"documentacion",
      orden:2,
      area:"Documentación académica",
      responsable:"Leidy Salinas",
      saludo:"Leidy",
      correo:"lsalinas@itsqmet.edu.ec",
      whatsapp:phoneEC("0990400113"),
      descripcion:"Documentos académicos, expedientes y soportes pendientes.",
      requisitoKeys:["documentacion", "documentacionacademica", "documentos", "requisitosdocumentales"]
    },
    {
      id:"financiero",
      orden:3,
      area:"Financiero",
      responsable:"Paulina Araujo",
      saludo:"Paulina",
      correo:"paraujo@itsqmet.edu.ec",
      whatsapp:phoneEC("098 484 8165"),
      descripcion:"Pendientes financieros del estudiante.",
      requisitoKeys:["financiero", "finanzas", "estadopagos", "pagos", "deuda"]
    },
    {
      id:"titulacion",
      orden:4,
      area:"Titulación",
      responsable:"Jefferson Villarreal",
      saludo:"Jefferson",
      correo:"jvillarreal@itsqmet.edu.ec",
      whatsapp:phoneEC("0984082332"),
      descripcion:"Aprobaciones y requisitos propios de titulación.",
      requisitoKeys:["titulacion", "aprobaciontitulacion", "aprobacioncomplexivoproyecto", "complexivo", "proyecto"]
    },
    {
      id:"practicas",
      orden:5,
      area:"Prácticas preprofesionales",
      responsable:"Verónica Ayala",
      saludo:"Verónica",
      correo:"veayala@itsqmet.edu.ec",
      whatsapp:phoneEC("096 234 6006"),
      descripcion:"Cumplimiento de prácticas preprofesionales.",
      requisitoKeys:["practicas", "practicaspreprofesionales", "practicasvinculacion", "practicapreprofesional"]
    },
    {
      id:"vinculacion",
      orden:6,
      area:"Vinculación con la sociedad",
      responsable:"Verónica Ayala",
      saludo:"Verónica",
      correo:"veayala@itsqmet.edu.ec",
      whatsapp:phoneEC("096 234 6006"),
      descripcion:"Cumplimiento de vinculación con la sociedad.",
      requisitoKeys:["vinculacion", "vinculacionconlasociedad", "vinculacionsociedad"]
    },
    {
      id:"seguimiento_graduados",
      orden:7,
      area:"Seguimiento a graduados",
      responsable:"Yessenia Ortega",
      saludo:"Yessenia",
      correo:"mortegaf@itsqmet.edu.ec",
      whatsapp:phoneEC("098 355 3466"),
      descripcion:"Registro y seguimiento a graduados.",
      requisitoKeys:["seguimientograduados", "seguimientoagraduados", "graduados"]
    },
    {
      id:"ingles",
      orden:8,
      area:"Segunda lengua / Inglés",
      responsable:"Alejandra Hernández",
      saludo:"Alejandra",
      correo:"mhernandez@itsqmet.edu.ec",
      whatsapp:phoneEC("099 974 1618"),
      descripcion:"Cumplimiento de segunda lengua / Inglés.",
      requisitoKeys:["ingles", "segundaLengua", "segundalengua", "idiomas", "english"]
    },
    {
      id:"actualizacion_datos",
      orden:9,
      area:"Actualización de datos",
      responsable:"Leidy Salinas",
      saludo:"Leidy",
      correo:"lsalinas@itsqmet.edu.ec",
      whatsapp:phoneEC("0990400113"),
      descripcion:"Actualización de información personal y de contacto.",
      requisitoKeys:["actualizaciondatos", "actualizaciondedatos", "datosactualizados", "actualizardatos"]
    }
  ];

  var byAreaId = Object.create(null);
  var byRequirement = Object.create(null);

  areas.forEach(function(area){
    byAreaId[area.id] = area;
    (area.requisitoKeys || []).forEach(function(key){
      byRequirement[norm(key)] = area.id;
    });
  });

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function listAreas(){return areas.slice().sort(function(a,b){return a.orden - b.orden;}).map(clone);}
  function getGlobal(){return clone(global);}
  function getArea(areaId){return byAreaId[areaId] ? clone(byAreaId[areaId]) : null;}
  function areaIdForRequirement(key){return byRequirement[norm(key)] || "";}
  function areaForRequirement(key){var areaId = areaIdForRequirement(key);return areaId ? getArea(areaId) : null;}

  window.COOConfig = {
    version:VERSION,
    global:getGlobal(),
    areas:listAreas(),
    helpers:{
      norm:norm,
      phoneEC:phoneEC,
      listAreas:listAreas,
      getGlobal:getGlobal,
      getArea:getArea,
      areaIdForRequirement:areaIdForRequirement,
      areaForRequirement:areaForRequirement
    }
  };
})(window);

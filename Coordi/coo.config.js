/* =========================================================
Nombre completo: coo.config.js
Ruta o ubicación: /Requisitos/Coordi/coo.config.js
Función o funciones:
- Centralizar responsables, destinatarios, copias y WhatsApp de Coordi.
- Definir los destinatarios de los tres tipos de correo.
- Mapear requisitos/campos pendientes hacia el área responsable.
- Mantener una opción especial para pendientes de defensa o núcleos.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.1-global-alex-leon";
  var ELIGIBILITY_KEY = "__pendientes_defensa_nucleos__";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"").toLowerCase(); }
  function phoneEC(value){
    var digits = text(value).replace(/[^0-9]/g,"");
    if(!digits){ return ""; }
    if(digits.indexOf("593") === 0){ return digits; }
    if(digits.charAt(0) === "0"){ return "593" + digits.slice(1); }
    if(digits.length === 9){ return "593" + digits; }
    return digits;
  }
  function clone(value){ return JSON.parse(JSON.stringify(value)); }

  var firma = {
    nombre:"Jefferson Villarreal",
    titulo:"Mgtr.",
    cargo:"Coordinador de Titulación",
    institucion:"ITSQMET"
  };

  var global = {
    id:"global",
    tipo:"global",
    area:"Reporte general",
    responsable:"Dr. Alex León",
    saludo:"Estimado Dr. Alex León",
    correos:["aleon@itsqmet.edu.ec"],
    correo:"aleon@itsqmet.edu.ec",
    copias:[],
    whatsapp:"",
    descripcion:"Reporte general de cumplimiento de requisitos."
  };

  var eligibility = {
    id:"eligibility",
    tipo:"eligibility",
    key:ELIGIBILITY_KEY,
    label:"Pendientes para defensa o núcleos",
    responsable:"Coordinadores de área",
    saludo:"Estimados coordinadores de área",
    correos:["mtomala@itsqmet.edu.ec","lsalinas@itsqmet.edu.ec"],
    correo:"mtomala@itsqmet.edu.ec, lsalinas@itsqmet.edu.ec",
    copias:[],
    descripcion:"Estudiantes con requisitos pendientes para continuar a defensa o núcleos."
  };

  var areas = [
    {
      id:"academico", orden:1, area:"Académico",
      responsable:"Martha Tomalá y coordinadores",
      saludo:"Martha", tratamiento:"Estimada Mgs. Martha Tomalá",
      correo:"mtomala@itsqmet.edu.ec", copias:[],
      whatsapp:phoneEC("0995278201"),
      descripcion:"Temas académicos y validación académica de requisitos.",
      requisitoKeys:["academico","academica","academicoestado","estadoacademico"]
    },
    {
      id:"documentacion", orden:2, area:"Documentación",
      responsable:"Leidy Salinas", saludo:"Leidy", tratamiento:"Estimada Leidy Salinas",
      correo:"lsalinas@itsqmet.edu.ec", copias:["mtomala@itsqmet.edu.ec"],
      whatsapp:phoneEC("0990400113"),
      descripcion:"Documentos académicos, expedientes y soportes pendientes.",
      requisitoKeys:["documentacion","documentacionacademica","documentos","requisitosdocumentales"]
    },
    {
      id:"financiero", orden:3, area:"Financiero",
      responsable:"Paulina Araujo", saludo:"Paulina", tratamiento:"Estimada Tnlg. Paulina Araujo",
      correo:"paraujo@itsqmet.edu.ec", copias:["mtomala@itsqmet.edu.ec"],
      whatsapp:phoneEC("098 484 8165"),
      descripcion:"Pendientes financieros del estudiante.",
      requisitoKeys:["financiero","finanzas","estadopagos","pagos","deuda"]
    },
    {
      id:"titulacion", orden:4, area:"Titulación",
      responsable:"Jefferson Villarreal", saludo:"Jefferson", tratamiento:"Estimado Mgtr. Jefferson Villarreal",
      correo:"jvillarreal@itsqmet.edu.ec", copias:["mtomala@itsqmet.edu.ec"],
      whatsapp:phoneEC("0984082332"),
      descripcion:"Requisitos propios de titulación.",
      requisitoKeys:["titulacion"]
    },
    {
      id:"practicas", orden:5, area:"Prácticas",
      responsable:"Verónica Ayala", saludo:"Verónica", tratamiento:"Estimada Verónica Ayala",
      correo:"veayala@itsqmet.edu.ec", copias:["mtomala@itsqmet.edu.ec"],
      whatsapp:phoneEC("096 234 6006"),
      descripcion:"Cumplimiento de prácticas preprofesionales.",
      requisitoKeys:["practicasvinculacion","practicas","practicaspreprofesionales","practicapreprofesional"]
    },
    {
      id:"vinculacion", orden:6, area:"Vinculación",
      responsable:"Verónica Ayala", saludo:"Verónica", tratamiento:"Estimada Verónica Ayala",
      correo:"veayala@itsqmet.edu.ec", copias:["mtomala@itsqmet.edu.ec"],
      whatsapp:phoneEC("096 234 6006"),
      descripcion:"Cumplimiento de vinculación con la sociedad.",
      requisitoKeys:["vinculacion","vinculacionconlasociedad","vinculacionsociedad"]
    },
    {
      id:"seguimiento_graduados", orden:7, area:"Seguimiento Graduados",
      responsable:"Yessenia Ortega", saludo:"Yessenia", tratamiento:"Estimada Yessenia Ortega",
      correo:"mortegaf@itsqmet.edu.ec", copias:["mtomala@itsqmet.edu.ec"],
      whatsapp:phoneEC("098 355 3466"),
      descripcion:"Registro y seguimiento a graduados.",
      requisitoKeys:["seguimientograduados","seguimientoagraduados","graduados"]
    },
    {
      id:"ingles", orden:8, area:"Inglés",
      responsable:"Alejandra Hernández", saludo:"Alejandra", tratamiento:"Estimada Alejandra Hernández",
      correo:"mhernandez@itsqmet.edu.ec", copias:["mtomala@itsqmet.edu.ec"],
      whatsapp:phoneEC("099 974 1618"),
      descripcion:"Cumplimiento de segunda lengua / Inglés.",
      requisitoKeys:["ingles","segundaLengua","segundalengua","idiomas","english"]
    },
    {
      id:"actualizacion_datos", orden:9, area:"Actualización de Datos",
      responsable:"Leidy Salinas", saludo:"Leidy", tratamiento:"Estimada Leidy Salinas",
      correo:"lsalinas@itsqmet.edu.ec", copias:["mtomala@itsqmet.edu.ec"],
      whatsapp:phoneEC("0990400113"),
      descripcion:"Actualización de información personal y de contacto.",
      requisitoKeys:["actualizaciondatos","actualizaciondedatos","datosactualizados","actualizardatos"]
    }
  ];

  var byAreaId = Object.create(null);
  var byRequirement = Object.create(null);

  areas.forEach(function(area){
    byAreaId[area.id] = area;
    (area.requisitoKeys || []).forEach(function(key){ byRequirement[norm(key)] = area.id; });
  });

  function listAreas(){ return areas.slice().sort(function(a,b){ return a.orden - b.orden; }).map(clone); }
  function getGlobal(){ return clone(global); }
  function getEligibility(){ return clone(eligibility); }
  function getArea(areaId){ return byAreaId[areaId] ? clone(byAreaId[areaId]) : null; }
  function areaIdForRequirement(key){ return byRequirement[norm(key)] || ""; }
  function areaForRequirement(key){ var areaId = areaIdForRequirement(key); return areaId ? getArea(areaId) : null; }
  function isEligibilityKey(key){ return text(key) === ELIGIBILITY_KEY; }

  window.COOConfig = {
    version:VERSION,
    firma:clone(firma),
    global:getGlobal(),
    eligibility:getEligibility(),
    specials:{ eligibilityKey:ELIGIBILITY_KEY, eligibilityLabel:eligibility.label },
    areas:listAreas(),
    helpers:{
      norm:norm,
      phoneEC:phoneEC,
      listAreas:listAreas,
      getGlobal:getGlobal,
      getEligibility:getEligibility,
      getArea:getArea,
      areaIdForRequirement:areaIdForRequirement,
      areaForRequirement:areaForRequirement,
      isEligibilityKey:isEligibilityKey
    }
  };
})(window);

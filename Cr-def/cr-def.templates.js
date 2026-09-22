/* =========================================================
Nombre completo: cr-def.templates.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.templates.js
Función:
- Definir plantillas base de horario, aula y responsables.
- Permitir Tribunal 2 e Investigador vacíos.
- Mantener compatibilidad con cronogramas antiguos que usaban tribunal3.
- Reconocer las carreras que se usan actualmente en defensas.
========================================================= */
(function(window){
  "use strict";

  var DEFAULT_DURATION = 30;

  var CAREER_ALIASES = {
    administracion:[
      "UNIVERSITARIA EN ADMINISTRACIÓN DE EMPRESAS","UNIVERSITARIA EN ADMINISTRACION DE EMPRESAS",
      "ADMINISTRACIÓN DE EMPRESAS","ADMINISTRACION DE EMPRESAS"
    ],
    talentoHumano:[
      "UNIVERSITARIA EN ADMINISTRACIÓN DE TALENTO HUMANO","UNIVERSITARIA EN ADMINISTRACION DE TALENTO HUMANO",
      "ADMINISTRACIÓN DE TALENTO HUMANO","ADMINISTRACION DE TALENTO HUMANO","TALENTO HUMANO"
    ],
    contabilidad:["UNIVERSITARIA EN CONTABILIDAD Y TRIBUTARIA","CONTABILIDAD Y TRIBUTARIA","CONTABILIDAD"],
    redes:[
      "UNIVERSITARIA EN REDES Y TELECOMUNICACIONES","UNIVERSITARIA EN REDES Y TELECOMUNICACIONES ONLINE",
      "REDES Y TELECOMUNICACIONES"
    ],
    marketing:[
      "UNIVERSITARIA EN MARKETING DIGITAL","UNIVERSITARIA EN MARKETING DIGITAL ONLINE",
      "MARKETING DIGITAL","MARKETING"
    ],
    pedagogia:["UNIVERSITARIA EN PEDAGOGÍA","UNIVERSITARIA EN PEDAGOGIA","PEDAGOGÍA","PEDAGOGIA"],
    educacionInicial:[
      "UNIVERSITARIA EN EDUCACIÓN INICIAL","UNIVERSITARIA EN EDUCACION INICIAL","UNIVERSITARIA EN EDUACIÓN INICIAL",
      "EDUCACIÓN INICIAL","EDUCACION INICIAL","EDUACIÓN INICIAL"
    ],
    mecanica:["MECÁNICA AUTOMOTRIZ","MECANICA AUTOMOTRIZ"],
    alimentos:["PROCESAMIENTO EN ALIMENTOS","PROCESAMIENTO DE ALIMENTOS"],
    disenoMultimedia:["DISEÑO MULTIMEDIA","DISENO MULTIMEDIA"],
    seguridadRiesgos:[
      "SEGURIDAD Y PREVENCIÓN DE RIESGOS LABORALES","SEGURIDAD Y PREVENCION DE RIESGOS LABORALES"
    ],
    seguridadCiudadana:[
      "SEGURIDAD CIUDADANA Y ORDEN PÚBLICO","SEGURIDAD CIUDADANA Y ORDEN PUBLICO"
    ],
    ventas:["VENTAS"]
  };

  function tribunal(id,nombre,t1,t2,investigador){
    return {id:id,nombre:nombre,tribunal1:t1||"",tribunal2:t2||"",investigador:investigador||"",tribunal3:investigador||""};
  }

  var TRIBUNALES = {
    administracion:[
      tribunal("adm-01","Administración · Tribunal 1","Jefferson Villarreal","Jhair Aldas",""),
      tribunal("adm-02","Administración · Tribunal 2","Rodrigo Espinoza","José Zambrano","Mercedes Escudero"),
      tribunal("adm-03","Administración · Tribunal 3","Francisco Samaniego","Katheryn Simbaña","Luis Segovia")
    ],
    talentoHumano:[
      tribunal("th-01","Talento Humano · Tribunal 1","Alejandra Hernandez","Veronica Ayala",""),
      tribunal("th-02","Talento Humano · Tribunal 2","Rodrigo Espinoza","Luis Segovia","Jefferson Villarreal")
    ],
    contabilidad:[
      tribunal("cont-01","Contabilidad · Tribunal 1","Carla Rivera","Edison Tito","Brenda Reyes"),
      tribunal("cont-02","Contabilidad · Tribunal 2","Katheryn Simbaña","Leonardo Segovia","Viviana Toapanta")
    ],
    redes:[tribunal("redes-01","Redes · Tribunal 1","Juan Carlos Pazmiño Quiñonez","William Andrés Pérez Mayorga","Luis Enrique Yulan Mendoza")],
    marketing:[tribunal("mkt-01","Marketing · Tribunal 1","Javier Tapia","","Brenda Reyes")],
    pedagogia:[tribunal("ped-01","Pedagogía · Tribunal 1","Maria Barre","Katherine Gorritti","Grimaneza Villarroel")],
    educacionInicial:[tribunal("edu-01","Educación Inicial · Tribunal 1","Maria Barre","Katherine Gorritti","Grimaneza Villarroel")],
    mecanica:[tribunal("mec-01","Mecánica Automotriz","Dario Torres","","")],
    alimentos:[tribunal("alim-01","Procesamiento de Alimentos","Mayra Molina","","")],
    disenoMultimedia:[tribunal("diseno-01","Diseño Multimedia","Javier Tapia","","")],
    seguridadRiesgos:[tribunal("sprl-01","Seguridad y Prevención de Riesgos Laborales","Rodrigo Espinoza","","")],
    seguridadCiudadana:[tribunal("scop-01","Seguridad Ciudadana y Orden Público","Sonia Moreno","Yajaira Zurita","Martha Tomalá")],
    ventas:[tribunal("ventas-01","Ventas","Javier Tapia","","")]
  };

  var TEMPLATES = [
    {id:"administracion-matriz",nombre:"Administración · Matriz",carreraKey:"administracion",sede:"Matriz",duracionMinutos:30,bloques:[
      {dia:"",aula:"306",inicio:"10:30",fin:"13:00",tribunalId:"adm-01"},
      {dia:"",aula:"301",inicio:"10:30",fin:"12:00",tribunalId:"adm-03"},
      {dia:"",aula:"302",inicio:"10:30",fin:"12:00",tribunalId:"adm-02"}
    ]},
    {id:"talento-humano-matriz",nombre:"Talento Humano · Matriz",carreraKey:"talentoHumano",sede:"Matriz",duracionMinutos:30,bloques:[
      {dia:"",aula:"302",inicio:"10:30",fin:"13:00",tribunalId:"th-01"},
      {dia:"",aula:"301",inicio:"10:30",fin:"13:00",tribunalId:"th-02"}
    ]},
    {id:"contabilidad-matriz",nombre:"Contabilidad · Matriz",carreraKey:"contabilidad",sede:"Matriz",duracionMinutos:30,bloques:[
      {dia:"",aula:"301",inicio:"10:30",fin:"13:00",tribunalId:"cont-01"},
      {dia:"",aula:"302",inicio:"10:30",fin:"12:00",tribunalId:"cont-02"}
    ]},
    {id:"redes-sur",nombre:"Redes · Sur",carreraKey:"redes",sede:"Sur",duracionMinutos:30,bloques:[
      {dia:"",aula:"209",inicio:"08:30",fin:"13:00",tribunalId:"redes-01"}
    ]},
    {id:"marketing-matriz",nombre:"Marketing · Matriz",carreraKey:"marketing",sede:"Matriz",duracionMinutos:30,bloques:[
      {dia:"",aula:"303",inicio:"10:30",fin:"12:30",tribunalId:"mkt-01"}
    ]},
    {id:"educacion-inicial-matriz",nombre:"Educación Inicial · Matriz",carreraKey:"educacionInicial",sede:"Matriz",duracionMinutos:30,bloques:[
      {dia:"",aula:"401",inicio:"09:30",fin:"13:00",tribunalId:"edu-01"}
    ]},
    {id:"pedagogia-matriz",nombre:"Pedagogía · Matriz",carreraKey:"pedagogia",sede:"Matriz",duracionMinutos:30,bloques:[
      {dia:"",aula:"401",inicio:"09:30",fin:"13:00",tribunalId:"ped-01"}
    ]},
    {id:"mecanica-matriz",nombre:"Mecánica Automotriz · Matriz",carreraKey:"mecanica",sede:"Matriz",duracionMinutos:30,bloques:[
      {dia:"",aula:"407",inicio:"10:30",fin:"13:00",tribunalId:"mec-01"}
    ]},
    {id:"alimentos-matriz",nombre:"Procesamiento de Alimentos · Matriz",carreraKey:"alimentos",sede:"Matriz",duracionMinutos:60,bloques:[
      {dia:"",aula:"",inicio:"10:30",fin:"13:30",tribunalId:"alim-01",duracionMinutos:60}
    ]},
    {id:"diseno-multimedia-matriz",nombre:"Diseño Multimedia · Matriz",carreraKey:"disenoMultimedia",sede:"Matriz",duracionMinutos:30,bloques:[
      {dia:"",aula:"303",inicio:"10:30",fin:"13:00",tribunalId:"diseno-01"}
    ]},
    {id:"seguridad-riesgos-matriz",nombre:"Seguridad y Prevención de Riesgos · Matriz",carreraKey:"seguridadRiesgos",sede:"Matriz",duracionMinutos:30,bloques:[
      {dia:"",aula:"303",inicio:"10:30",fin:"13:00",tribunalId:"sprl-01"}
    ]},
    {id:"seguridad-ciudadana-matriz",nombre:"Seguridad Ciudadana · Matriz",carreraKey:"seguridadCiudadana",sede:"Matriz",duracionMinutos:30,bloques:[
      {dia:"",aula:"303",inicio:"10:30",fin:"13:00",tribunalId:"scop-01"}
    ]},
    {id:"ventas-matriz",nombre:"Ventas · Matriz",carreraKey:"ventas",sede:"Matriz",duracionMinutos:30,bloques:[
      {dia:"",aula:"",inicio:"10:30",fin:"13:00",tribunalId:"ventas-01"}
    ]},
    {id:"virtual-general",nombre:"Virtual · General",carreraKey:"mixto",sede:"Virtual",duracionMinutos:30,
      allowedCareerKeys:["administracion","talentoHumano","contabilidad","redes","marketing","pedagogia","educacionInicial","mecanica","alimentos","disenoMultimedia","seguridadRiesgos","seguridadCiudadana","ventas"],
      bloques:[{dia:"",aula:"",inicio:"08:30",fin:"18:00",tribunalId:""}]
    }
  ];

  function text(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function norm(value){return text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}

  function detectCareerKey(carrera){
    var clean=norm(carrera);
    if(!clean)return "sin_carrera";
    var keys=Object.keys(CAREER_ALIASES);
    for(var i=0;i<keys.length;i+=1){
      var key=keys[i],aliases=CAREER_ALIASES[key]||[];
      var found=aliases.some(function(alias){
        var a=norm(alias);
        return clean===a||clean.indexOf(a)!==-1||(clean.length>=6&&a.indexOf(clean)!==-1);
      });
      if(found)return key;
    }
    return "mixto";
  }

  function tribunalesPorCarrera(carrera){var key=detectCareerKey(carrera);return TRIBUNALES[key]||[];}
  function templatesPorCarrera(carrera){
    var key=detectCareerKey(carrera);
    if(key==="sin_carrera"||key==="mixto")return [];
    return TEMPLATES.filter(function(template){
      return template.carreraKey===key||(Array.isArray(template.allowedCareerKeys)&&template.allowedCareerKeys.indexOf(key)>=0);
    });
  }
  function tribunalPorId(id){
    var keys=Object.keys(TRIBUNALES);
    for(var i=0;i<keys.length;i+=1){
      var found=(TRIBUNALES[keys[i]]||[]).find(function(item){return item.id===id;});
      if(found)return found;
    }
    return null;
  }

  window.CR_DEF_TEMPLATES=Object.freeze({
    duration:DEFAULT_DURATION,careerAliases:CAREER_ALIASES,tribunales:TRIBUNALES,templates:TEMPLATES,
    detectCareerKey:detectCareerKey,tribunalesPorCarrera:tribunalesPorCarrera,
    templatesPorCarrera:templatesPorCarrera,tribunalPorId:tribunalPorId
  });
})(window);

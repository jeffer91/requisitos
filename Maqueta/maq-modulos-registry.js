/* =========================================================
Nombre completo: maq-modulos-registry.js
Ruta o ubicación: /Requisitos/Maqueta/maq-modulos-registry.js
Función o funciones:
- Definir rutas internas reales del menú de Requisitos.
- Enviar Carga a la pantalla funcional BDLocal/bdlocal.html.
- Enviar BL a la pantalla de control BDLocal/bl.html.
- Marcar como pendientes las pantallas que aún no existen en este repositorio para evitar iframe roto.
Con qué se conecta:
- maq-config-service.js
- maq-core.js
========================================================= */
(function(window){
  "use strict";
  var base="..";
  var modules={
    carga_excel:{id:"carga_excel",nombre:"Carga",ruta:base+"/BDLocal/bdlocal.html",estado:"activo"},
    baselocal:{id:"baselocal",nombre:"BL",ruta:base+"/BDLocal/bl.html",estado:"activo"},
    tabla_principal:{id:"tabla_principal",nombre:"Tabla",ruta:base+"/Gestion/Tabla/tabla.html",estado:"activo"},
    ficha_estudiante:{id:"ficha_estudiante",nombre:"Ficha",ruta:base+"/Ficha/ficha.html",estado:"activo"},
    stat_main:{id:"stat_main",nombre:"Estadísticas",ruta:base+"/Stats/stats.html",estado:"activo"},
    coordi:{id:"coordi",nombre:"Coordi",ruta:base+"/Coordi/coordi.html",estado:"activo"},
    modulo_reporte:{id:"modulo_reporte",nombre:"Reportes",ruta:base+"/Reportes/repo.html",estado:"activo"},
    defart:{id:"defart",nombre:"Defensas",ruta:base+"/defart/defart.html",estado:"activo"},
    titulos_estudiante:{id:"titulos_estudiante",nombre:"Títulos - Estudiante",ruta:base+"/Titulos/public/ta-titulo-articulo-estudiante.html",estado:"pendiente"},
    titulos_admin:{id:"titulos_admin",nombre:"Títulos - Administrador",ruta:base+"/Titulos/electron/admin/ta-titulo-articulo-administrador.html",estado:"pendiente"},
    titulos_coordinador:{id:"titulos_coordinador",nombre:"Títulos - Coordinador",ruta:base+"/Titulos/public/ta-titulo-articulo-coordinador.html",estado:"pendiente"},
    titulacion:{id:"titulacion",nombre:"Infor",ruta:base+"/Infor/frontend/titulacion.html",estado:"activo"}
  };
  function buscarPorId(id){return modules[String(id||"").trim()]||null;}
  function listar(){return Object.keys(modules).map(function(k){return modules[k];});}
  window.MAQ_MODULOS_REGISTRY={buscarPorId:buscarPorId,listar:listar};
})(window);
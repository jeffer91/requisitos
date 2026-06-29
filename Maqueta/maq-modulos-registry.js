/* =========================================================
Nombre completo: maq-modulos-registry.js
Ruta o ubicación: /Requisitos/Maqueta/maq-modulos-registry.js
Función o funciones:
- Definir rutas internas reales del menú de Carga.
- Activar todos los módulos internos recuperados.
- Mantener rutas internas estables para no romper enlaces durante cambios de carpeta.
- Integrar el módulo Títulos desde la carpeta /Requisitos/Titulos.
- Mostrar el módulo de informes de titulación como Infor desde /Requisitos/Infor.
Con qué se conecta:
- maq-config-service.js
- maq-core.js
========================================================= */
(function(window){
  "use strict";
  var base="..";
  var modules={
    carga_excel:{id:"carga_excel",nombre:"Carga",ruta:base+"/Gestion/Excel/excel.html",estado:"activo"},
    baselocal:{id:"baselocal",nombre:"Base Local",ruta:base+"/BaseLocal/baselocal.html",estado:"activo"},
    tabla_principal:{id:"tabla_principal",nombre:"Tabla",ruta:base+"/Gestion/Tabla/tabla.html",estado:"activo"},
    ficha_estudiante:{id:"ficha_estudiante",nombre:"Ficha",ruta:base+"/Ficha/ficha.html",estado:"activo"},
    stat_main:{id:"stat_main",nombre:"Estadísticas",ruta:base+"/Stats/stats.html",estado:"activo"},
    coordi:{id:"coordi",nombre:"Coordi",ruta:base+"/Coordi/coordi.html",estado:"activo"},
    modulo_reporte:{id:"modulo_reporte",nombre:"Reportes",ruta:base+"/Reportes/repo.html",estado:"activo"},
    defart:{id:"defart",nombre:"Defensas",ruta:base+"/defart/defart.html",estado:"activo"},
    titulos_estudiante:{id:"titulos_estudiante",nombre:"Títulos - Estudiante",ruta:base+"/Titulos/public/ta-titulo-articulo-estudiante.html",estado:"activo"},
    titulos_admin:{id:"titulos_admin",nombre:"Títulos - Administrador",ruta:base+"/Titulos/electron/admin/ta-titulo-articulo-administrador.html",estado:"activo"},
    titulos_coordinador:{id:"titulos_coordinador",nombre:"Títulos - Coordinador",ruta:base+"/Titulos/public/ta-titulo-articulo-coordinador.html",estado:"activo"},
    titulacion:{id:"titulacion",nombre:"Infor",ruta:base+"/Infor/frontend/titulacion.html",estado:"activo"}
  };
  function buscarPorId(id){return modules[String(id||"").trim()]||null;}
  function listar(){return Object.keys(modules).map(function(k){return modules[k];});}
  window.MAQ_MODULOS_REGISTRY={buscarPorId:buscarPorId,listar:listar};
})(window);
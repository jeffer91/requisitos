/* =========================================================
Nombre completo: maq-modulos-registry.js
Ruta o ubicación: /Requisitos/Maqueta/maq-modulos-registry.js
Función o funciones:
- Definir las rutas internas reales del menú.
- Declarar el conector exclusivo de cada pantalla activa.
- Mantener pendientes las pantallas que todavía no existen.
- Evitar que dos pantallas compartan accidentalmente la misma identidad de conexión.
Con qué se conecta:
- maq-config-service.js
- maq-core.js
- maq-menu.js
- BDLocal/conexiones/cone.*.js
========================================================= */
(function(window){
  "use strict";

  var base="..";
  var conBase=base+"/BDLocal/conexiones/";

  var modules={
    carga_excel:{id:"carga_excel",nombre:"Carga",ruta:base+"/Carga/carga.html",estado:"activo",pantallaConexion:"carga",conexion:conBase+"cone.carga.js"},
    baselocal:{id:"baselocal",nombre:"BL",ruta:base+"/BDLocal/bl2.html",estado:"activo",pantallaConexion:"baselocal",conexion:conBase+"cone.baselocal.js"},
    tabla_principal:{id:"tabla_principal",nombre:"Tabla",ruta:base+"/Gestion/Tabla/tabla.html",estado:"activo",pantallaConexion:"tabla",conexion:conBase+"cone.tabla.js"},
    ficha_estudiante:{id:"ficha_estudiante",nombre:"Ficha",ruta:base+"/Ficha/ficha.html",estado:"activo",pantallaConexion:"ficha",conexion:conBase+"cone.ficha.js"},
    stat_main:{id:"stat_main",nombre:"Estadísticas",ruta:base+"/Stats/stats.html",estado:"activo",pantallaConexion:"stats",conexion:conBase+"cone.stats.js"},
    coordi:{id:"coordi",nombre:"Coordi",ruta:base+"/Coordi/coordi.html",estado:"activo",pantallaConexion:"coordi",conexion:conBase+"cone.coordi.js"},
    global:{id:"global",nombre:"Global",ruta:base+"/Global/global.html",estado:"activo",pantallaConexion:"global",conexion:conBase+"cone.global.js"},
    modulo_reporte:{id:"modulo_reporte",nombre:"Reportes",ruta:base+"/Reportes/repo.html",estado:"activo",pantallaConexion:"reportes",conexion:conBase+"cone.reportes.js"},
    defart:{id:"defart",nombre:"Defensas",ruta:base+"/defart/defart.html",estado:"activo",pantallaConexion:"defart",conexion:conBase+"cone.defart.js"},
    ncomplex:{id:"ncomplex",nombre:"Ncomplex",ruta:base+"/Ncomplex/ncomplex.html",estado:"activo",pantallaConexion:"ncomplex",conexion:conBase+"cone.ncomplex.js"},
    cr_def:{id:"cr_def",nombre:"Cr-def",ruta:base+"/Cr-def/cr-def.html",estado:"activo",pantallaConexion:"cr_def",conexion:conBase+"cone.crdef.js"},
    titulos_estudiante:{id:"titulos_estudiante",nombre:"Títulos - Estudiante",ruta:base+"/Titulos/public/ta-titulo-articulo-estudiante.html",estado:"pendiente",pantallaConexion:"",conexion:""},
    titulos_admin:{id:"titulos_admin",nombre:"Títulos - Administrador",ruta:base+"/Titulos/electron/admin/ta-titulo-articulo-administrador.html",estado:"pendiente",pantallaConexion:"",conexion:""},
    titulos_coordinador:{id:"titulos_coordinador",nombre:"Títulos - Coordinador",ruta:base+"/Titulos/public/ta-titulo-articulo-coordinador.html",estado:"pendiente",pantallaConexion:"",conexion:""},
    titulacion:{id:"titulacion",nombre:"InPVC",ruta:base+"/InPVC/inpvc.html",estado:"activo",pantallaConexion:"inpvc",conexion:conBase+"cone.inpvc.js"}
  };

  var aliases={
    requisito:"carga_excel",requisitos:"carga_excel",carga:"carga_excel","carga excel":"carga_excel",excel:"carga_excel",
    bl:"baselocal","base local":"baselocal","base-local":"baselocal",bdlocal:"baselocal",bl2:"baselocal",
    tabla:"tabla_principal","tabla principal":"tabla_principal",
    ficha:"ficha_estudiante","ficha estudiante":"ficha_estudiante",
    stats:"stat_main",estadisticas:"stat_main",estadísticas:"stat_main","stat main":"stat_main",
    coordinador:"coordi",coordi:"coordi",
    global:"global",globals:"global",historico:"global",histórico:"global","analisis global":"global","análisis global":"global",
    reporte:"modulo_reporte",reportes:"modulo_reporte",repor:"modulo_reporte",
    defensas:"defart",defensa:"defart",defart:"defart",
    ncomplex:"ncomplex",complexivo:"ncomplex","notas complexivo":"ncomplex","notas de complexivo":"ncomplex","evaluaciones titulacion":"ncomplex","evaluaciones titulación":"ncomplex",
    "cr-def":"cr_def","cr def":"cr_def",crdef:"cr_def","cronograma defensas":"cr_def","cronograma de defensas":"cr_def","sacar n":"cr_def",sacarn:"cr_def",
    "titulos estudiante":"titulos_estudiante","títulos estudiante":"titulos_estudiante",
    "titulos administrador":"titulos_admin","títulos administrador":"titulos_admin","titulos admin":"titulos_admin","títulos admin":"titulos_admin",
    "titulos coordinador":"titulos_coordinador","títulos coordinador":"titulos_coordinador",
    infor:"titulacion",inpvc:"titulacion",titulacion:"titulacion",titulación:"titulacion"
  };

  function text(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function norm(value){return text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}

  function cloneModule(modulo){
    if(!modulo){return null;}
    return {
      id:modulo.id,
      nombre:modulo.nombre,
      ruta:modulo.ruta,
      estado:modulo.estado,
      pantallaConexion:modulo.pantallaConexion||"",
      conexion:modulo.conexion||""
    };
  }

  function canonicalModuleId(moduloId){
    var raw=text(moduloId);
    if(!raw){return "";}
    if(modules[raw]){return raw;}
    var key=norm(raw).replace(/[_-]+/g," ");
    return aliases[key]||raw;
  }

  function buscarPorId(moduloId){return cloneModule(modules[canonicalModuleId(moduloId)]);}
  function existe(moduloId){return !!buscarPorId(moduloId);}
  function listar(){return Object.keys(modules).map(function(id){return cloneModule(modules[id]);});}
  function rutaDe(moduloId){var modulo=buscarPorId(moduloId);return modulo?modulo.ruta:"";}
  function estadoDe(moduloId){var modulo=buscarPorId(moduloId);return modulo?modulo.estado:"pendiente";}
  function conexionDe(moduloId){var modulo=buscarPorId(moduloId);return modulo?modulo.conexion:"";}
  function pantallaConexionDe(moduloId){var modulo=buscarPorId(moduloId);return modulo?modulo.pantallaConexion:"";}

  function registrar(modulo){
    if(!modulo||!text(modulo.id)){return false;}
    var previous=modules[text(modulo.id)]||{};
    modules[text(modulo.id)]={
      id:text(modulo.id),
      nombre:text(modulo.nombre||previous.nombre||modulo.id),
      ruta:text(modulo.ruta||previous.ruta||""),
      estado:text(modulo.estado||previous.estado||"activo"),
      pantallaConexion:text(modulo.pantallaConexion||previous.pantallaConexion||""),
      conexion:text(modulo.conexion||previous.conexion||"")
    };
    return true;
  }

  function diagnosticoConexiones(){
    var activos=listar().filter(function(item){return item.estado==="activo";});
    var sinConexion=activos.filter(function(item){return !item.pantallaConexion||!item.conexion;});
    var usados=Object.create(null);
    var duplicados=[];
    activos.forEach(function(item){
      if(!item.pantallaConexion){return;}
      if(usados[item.pantallaConexion]){duplicados.push([usados[item.pantallaConexion],item.id,item.pantallaConexion]);}
      else{usados[item.pantallaConexion]=item.id;}
    });
    return {ok:!sinConexion.length&&!duplicados.length,total:activos.length,sinConexion:sinConexion,duplicados:duplicados};
  }

  window.MAQ_MODULOS_REGISTRY={
    buscarPorId:buscarPorId,existe:existe,listar:listar,rutaDe:rutaDe,estadoDe:estadoDe,
    conexionDe:conexionDe,pantallaConexionDe:pantallaConexionDe,registrar:registrar,
    canonicalModuleId:canonicalModuleId,diagnosticoConexiones:diagnosticoConexiones
  };
})(window);

/* =========================================================
Nombre completo: maq-modulos-registry.js
Ruta o ubicación: /Requisitos/Maqueta/maq-modulos-registry.js
Función o funciones:
- Definir rutas internas reales del menú de Requisitos.
- Enviar Carga a la pantalla funcional Carga/carga.html.
- Enviar BL a la pantalla BDLocal/bl2.html.
- Registrar Global como módulo activo para análisis histórico multiperíodo.
- Registrar Cr-def como módulo activo para cronogramas de defensas.
- Marcar como pendientes las pantallas que aún no existen para evitar iframe roto.
Con qué se conecta:
- maq-config-service.js
- maq-core.js
- maq-menu.js
========================================================= */
(function(window){
  "use strict";

  var base = "..";

  var modules = {
    carga_excel: {
      id: "carga_excel",
      nombre: "Carga",
      ruta: base + "/Carga/carga.html",
      estado: "activo"
    },

    baselocal: {
      id: "baselocal",
      nombre: "BL",
      ruta: base + "/BDLocal/bl2.html",
      estado: "activo"
    },

    tabla_principal: {
      id: "tabla_principal",
      nombre: "Tabla",
      ruta: base + "/Gestion/Tabla/tabla.html",
      estado: "activo"
    },

    ficha_estudiante: {
      id: "ficha_estudiante",
      nombre: "Ficha",
      ruta: base + "/Ficha/ficha.html",
      estado: "activo"
    },

    stat_main: {
      id: "stat_main",
      nombre: "Estadísticas",
      ruta: base + "/Stats/stats.html",
      estado: "activo"
    },

    coordi: {
      id: "coordi",
      nombre: "Coordi",
      ruta: base + "/Coordi/coordi.html",
      estado: "activo"
    },

    global: {
      id: "global",
      nombre: "Global",
      ruta: base + "/Global/global.html",
      estado: "activo"
    },

    modulo_reporte: {
      id: "modulo_reporte",
      nombre: "Reportes",
      ruta: base + "/Reportes/repo.html",
      estado: "activo"
    },

    defart: {
      id: "defart",
      nombre: "Defensas",
      ruta: base + "/defart/defart.html",
      estado: "activo"
    },

    cr_def: {
      id: "cr_def",
      nombre: "Cr-def",
      ruta: base + "/Cr-def/cr-def.html",
      estado: "activo"
    },

    titulos_estudiante: {
      id: "titulos_estudiante",
      nombre: "Títulos - Estudiante",
      ruta: base + "/Titulos/public/ta-titulo-articulo-estudiante.html",
      estado: "activo"
    },

    titulos_admin: {
      id: "titulos_admin",
      nombre: "Títulos - Administrador",
      ruta: base + "/Titulos/electron/admin/ta-titulo-articulo-administrador.html",
      estado: "activo"
    },

    titulos_coordinador: {
      id: "titulos_coordinador",
      nombre: "Títulos - Coordinador",
      ruta: base + "/Titulos/public/ta-titulo-articulo-coordinador.html",
      estado: "activo"
    },

    titulacion: {
      id: "titulacion",
      nombre: "Infor",
      ruta: base + "/Infor/frontend/titulacion.html",
      estado: "activo"
    }
  };

  var aliases = {
    requisito: "carga_excel",
    requisitos: "carga_excel",
    carga: "carga_excel",
    "carga excel": "carga_excel",
    excel: "carga_excel",

    bl: "baselocal",
    "base local": "baselocal",
    "base-local": "baselocal",
    bdlocal: "baselocal",
    bl2: "baselocal",

    tabla: "tabla_principal",
    "tabla principal": "tabla_principal",

    ficha: "ficha_estudiante",
    "ficha estudiante": "ficha_estudiante",

    stats: "stat_main",
    estadisticas: "stat_main",
    estadísticas: "stat_main",
    "stat main": "stat_main",

    coordinador: "coordi",
    coordi: "coordi",

    global: "global",
    globals: "global",
    historico: "global",
    histórico: "global",
    "analisis global": "global",
    "análisis global": "global",

    reporte: "modulo_reporte",
    reportes: "modulo_reporte",
    repor: "modulo_reporte",

    defensas: "defart",
    defensa: "defart",
    defart: "defart",

    "cr-def": "cr_def",
    "cr def": "cr_def",
    crdef: "cr_def",
    "cronograma defensas": "cr_def",
    "cronograma de defensas": "cr_def",
    "sacar n": "cr_def",
    sacarn: "cr_def",

    "titulos estudiante": "titulos_estudiante",
    "títulos estudiante": "titulos_estudiante",
    "titulos administrador": "titulos_admin",
    "títulos administrador": "titulos_admin",
    "titulos admin": "titulos_admin",
    "títulos admin": "titulos_admin",
    "titulos coordinador": "titulos_coordinador",
    "títulos coordinador": "titulos_coordinador",

    infor: "titulacion",
    titulacion: "titulacion",
    titulación: "titulacion"
  };

  function text(value){
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function norm(value){
    return text(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function cloneModule(modulo){
    if(!modulo){ return null; }
    return {
      id: modulo.id,
      nombre: modulo.nombre,
      ruta: modulo.ruta,
      estado: modulo.estado
    };
  }

  function canonicalModuleId(moduloId){
    var raw = text(moduloId);
    if(!raw){ return ""; }
    if(modules[raw]){ return raw; }
    var key = norm(raw).replace(/[_-]+/g, " ");
    return aliases[key] || raw;
  }

  function buscarPorId(moduloId){
    var id = canonicalModuleId(moduloId);
    return cloneModule(modules[id]);
  }

  function existe(moduloId){ return !!buscarPorId(moduloId); }

  function listar(){
    return Object.keys(modules).map(function(id){ return cloneModule(modules[id]); });
  }

  function rutaDe(moduloId){
    var modulo = buscarPorId(moduloId);
    return modulo ? modulo.ruta : "";
  }

  function estadoDe(moduloId){
    var modulo = buscarPorId(moduloId);
    return modulo ? modulo.estado : "pendiente";
  }

  function registrar(modulo){
    if(!modulo || !text(modulo.id)){ return false; }
    modules[text(modulo.id)] = {
      id: text(modulo.id),
      nombre: text(modulo.nombre || modulo.id),
      ruta: text(modulo.ruta || ""),
      estado: text(modulo.estado || "activo")
    };
    return true;
  }

  window.MAQ_MODULOS_REGISTRY = {
    buscarPorId: buscarPorId,
    existe: existe,
    listar: listar,
    rutaDe: rutaDe,
    estadoDe: estadoDe,
    registrar: registrar,
    canonicalModuleId: canonicalModuleId
  };
})(window);

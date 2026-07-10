/* =========================================================
Nombre completo: cr-def.config.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.config.js
Función o funciones:
- Centralizar configuración base del módulo Cr-def.
- Definir columnas visibles, estados y parámetros generales.
- Mantener valores quemados para evitar dependencias innecesarias.
Con qué se conecta:
- cr-def.html
- cr-def.js
- cr-def.rules.js
- cr-def.templates.js
========================================================= */
(function(window){
  "use strict";

  var CONFIG = {
    appId: "Cr-def",
    appName: "Cr-def · Cronograma de defensas",
    version: "bloque-2",

    duracionMinutos: 30,

    periodoFiltroPrincipal: true,

    notaArticuloMinima: 7,
    notaDefensaAprobada: 7,

    storageKeys: {
      cache: "cr_def_cache_v1",
      firmaBDLocal: "cr_def_firma_bdl_v1",
      ultimoPeriodo: "cr_def_ultimo_periodo_v1"
    },

    estados: {
      apto: {
        clave: "apto",
        etiqueta: "Apto para agendar",
        tipo: "ok"
      },
      programado: {
        clave: "programado",
        etiqueta: "Defensa programada",
        tipo: "info"
      },
      supletorio: {
        clave: "supletorio",
        etiqueta: "Supletorio / segunda defensa",
        tipo: "warn"
      },
      sinCupo: {
        clave: "sin-cupo",
        etiqueta: "Sin defensa asignada",
        tipo: "warn"
      },
      conflicto: {
        clave: "conflicto",
        etiqueta: "Con conflicto",
        tipo: "danger"
      },
      bloqueado: {
        clave: "bloqueado",
        etiqueta: "No apto",
        tipo: "danger"
      },
      defensaAprobada: {
        clave: "defensa-aprobada",
        etiqueta: "Defensa aprobada",
        tipo: "done"
      }
    },

    columnasCronograma: [
      { id: "aula", etiqueta: "Aula" },
      { id: "dia", etiqueta: "Día" },
      { id: "hora", etiqueta: "Hora" },
      { id: "sede", etiqueta: "Sede" },
      { id: "cedula", etiqueta: "Cédula" },
      { id: "nombre", etiqueta: "Nombre" },
      { id: "carrera", etiqueta: "Carrera" },
      { id: "notaArticulo", etiqueta: "Nota artículo" },
      { id: "tribunal1", etiqueta: "Tribunal 1" },
      { id: "tribunal2", etiqueta: "Tribunal 2" },
      { id: "tribunal3", etiqueta: "Tribunal 3" },
      { id: "estado", etiqueta: "Estado" }
    ],

    filtrosInternos: {
      carrera: true,
      sede: true,
      estado: true,
      busquedaInteligente: true
    },

    exportaciones: {
      excel: true,
      pdf: true,
      whatsapp: true,
      correo: true
    }
  };

  window.CR_DEF_CONFIG = Object.freeze(CONFIG);
})(window);

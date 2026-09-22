/* =========================================================
Nombre completo: cr-def.config.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.config.js
Función o funciones:
- Centralizar configuración base del módulo Cr-def.
- Mantener la regla académica separada de la presentación del cronograma.
- Definir la salida real: día, hora, sede, estudiante, carrera, tribunal/coordinador, tribunal 2, investigador y aula.
========================================================= */
(function(window){
  "use strict";

  var CONFIG = {
    appId: "Cr-def",
    appName: "Cr-def · Cronograma de defensas",
    version: "bloque-7-cronograma-real",

    duracionMinutos: 30,
    permitirDuracionVariable: true,
    permitirCamposTribunalVacios: true,
    agruparPorFecha: true,
    agruparPorCarrera: true,

    periodoFiltroPrincipal: true,

    notaArticuloMinima: 7,
    notaDefensaAprobada: 7,

    storageKeys: {
      cache: "cr_def_cache_v1",
      firmaBDLocal: "cr_def_firma_bdl_v1",
      ultimoPeriodo: "cr_def_ultimo_periodo_v1"
    },

    estados: {
      apto: { clave:"apto", etiqueta:"Apto para agendar", tipo:"ok" },
      programado: { clave:"programado", etiqueta:"Defensa programada", tipo:"info" },
      supletorio: { clave:"supletorio", etiqueta:"Supletorio / segunda defensa", tipo:"warn" },
      sinCupo: { clave:"sin-cupo", etiqueta:"Sin defensa asignada", tipo:"warn" },
      conflicto: { clave:"conflicto", etiqueta:"Con conflicto", tipo:"danger" },
      bloqueado: { clave:"bloqueado", etiqueta:"No apto", tipo:"danger" },
      defensaAprobada: { clave:"defensa-aprobada", etiqueta:"Defensa aprobada", tipo:"done" }
    },

    columnasCronograma: [
      { id:"hora", etiqueta:"Hora" },
      { id:"nombre", etiqueta:"Estudiante" },
      { id:"cedula", etiqueta:"Cédula" },
      { id:"sede", etiqueta:"Sede" },
      { id:"tribunal1", etiqueta:"Tribunal 1" },
      { id:"tribunal2", etiqueta:"Tribunal 2" },
      { id:"investigador", etiqueta:"Tribunal 3" },
      { id:"aula", etiqueta:"Aula" }
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

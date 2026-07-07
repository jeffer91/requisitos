/* =========================================================
Archivo: bl2.config.v2.js
Ruta: /BDLocal/bl2.config.v2.js
Función:
- Subir configuración de IndexedDB a DB_VERSION 2.
- Declarar tablas nuevas oficiales sin eliminar tablas actuales.
- Preparar migración segura para persona, matrícula, requisitos, notas y sincronización por cola.
Con qué se conecta:
- BDLocal/bl2.config.js
- BDLocal/bl2.db.js
========================================================= */
(function(window){
  "use strict";

  var config = window.BL2Config = window.BL2Config || {};
  var stores = config.stores = config.stores || {};

  config.dbVersion = Math.max(Number(config.dbVersion || 1), 2);
  config.schemaVersion = "2";

  stores.periodosCarreras = stores.periodosCarreras || "periodos_carreras";
  stores.periodosDivisiones = stores.periodosDivisiones || "periodos_divisiones";
  stores.personas = stores.personas || "personas";
  stores.matriculasPeriodo = stores.matriculasPeriodo || "matriculas_periodo";
  stores.requisitosEstudiante = stores.requisitosEstudiante || "requisitos_estudiante";
  stores.notasTitulacion = stores.notasTitulacion || "notas_titulacion";
  stores.contactosEstudiante = stores.contactosEstudiante || "contactos_estudiante";
  stores.divisionesEstudiante = stores.divisionesEstudiante || "divisiones_estudiante";
  stores.importaciones = stores.importaciones || "importaciones";
  stores.cambiosPendientes = stores.cambiosPendientes || "cambios_pendientes";
  stores.syncEstado = stores.syncEstado || "sync_estado";
  stores.erroresValidacion = stores.erroresValidacion || "errores_validacion";
  stores.cacheViews = stores.cacheViews || "cache_views";

  config.dbV2 = {
    enabled: true,
    version: 2,
    createdAt: "2026-07-07",
    destructive: false,
    note: "Tablas nuevas agregadas sin borrar tablas actuales."
  };
})(window);

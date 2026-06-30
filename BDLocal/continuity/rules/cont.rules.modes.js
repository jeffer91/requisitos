/* =========================================================
Nombre completo: cont.rules.modes.js
Ruta: /BDLocal/continuity/rules/cont.rules.modes.js
Función:
- Definir modos generales de continuidad.
========================================================= */
(function(window){
  "use strict";

  var MODES = {
    normal: "normal",
    ahorroFirebase: "ahorro_firebase",
    emergenciaSupabase: "emergencia_supabase",
    respaldoLocal: "respaldo_local",
    sinConexion: "sin_conexion"
  };

  var LABELS = {
    normal: "Normal",
    ahorro_firebase: "Ahorro Firebase",
    emergencia_supabase: "Emergencia Supabase",
    respaldo_local: "Respaldo local",
    sin_conexion: "Sin conexión"
  };

  function label(mode){ return LABELS[mode] || mode || "Sin modo"; }

  window.BDLContModes = {
    values: MODES,
    label: label
  };
})(window);

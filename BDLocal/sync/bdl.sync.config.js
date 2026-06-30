(function(window){
  "use strict";

  window.BDLSyncConfig = {
    version: "1.1.0",
    collections: {
      estudiantes: "Estudiantes",
      periodos: "periodos"
    },
    collectionCandidates: {
      estudiantes: ["Estudiantes", "estudiantes", "EstudiantesRequisitos", "requisitos_estudiantes"],
      periodos: ["periodos", "Periodos"]
    },
    estados: {
      idle: "idle",
      preparing: "preparing",
      uploading: "uploading",
      downloading: "downloading",
      applying: "applying",
      completed: "completed",
      error: "error"
    },
    queueEstados: {
      pendiente: "pendiente",
      procesando: "procesando",
      sincronizado: "sincronizado",
      error: "error"
    },
    limites: {
      loteSubida: 100,
      loteBajada: 2000
    },
    now: function(){ return new Date().toISOString(); }
  };
})(window);

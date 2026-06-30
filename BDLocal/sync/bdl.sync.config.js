(function(window){
  "use strict";

  window.BDLSyncConfig = {
    version: "1.2.0-cloud-fallback",
    providers: {
      local: "bdlocal",
      primary: "firebase",
      fallback: "supabase"
    },
    collections: {
      estudiantes: "Estudiantes",
      periodos: "periodos"
    },
    collectionCandidates: {
      estudiantes: ["Estudiantes", "estudiantes", "EstudiantesRequisitos", "requisitos_estudiantes"],
      periodos: ["periodos", "Periodos"]
    },
    supabase: {
      moduleKey: "requisitos",
      recordsTable: "app_records",
      schemasTable: "app_schemas",
      logTable: "sync_log_cloud",
      tableKeys: {
        estudiantes: "estudiantes_periodo_resumen",
        periodos: "periodos",
        requisitos: "estudiante_requisitos",
        notas: "estudiante_notas",
        divisiones: "estudiante_divisiones"
      }
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
      loteBajada: 2000,
      loteSupabase: 100
    },
    now: function(){ return new Date().toISOString(); }
  };
})(window);

(function(window, document){
  "use strict";

  if(window.__BDL_SCREEN_DEPS_DONE__){ return; }
  window.__BDL_SCREEN_DEPS_DONE__ = true;

  var current = document.currentScript && document.currentScript.src ? document.currentScript.src : window.location.href;
  var base = new URL("../", current).href;
  var files = [
    "bdl.config.js",
    "bdl.schema.js",
    "bdl.keys.js",
    "bdl.db.js",
    "bdl.state.js",
    "bdl.cache.js",
    "normalizers/bdl.norm.text.js",
    "normalizers/bdl.norm.periodo.js",
    "normalizers/bdl.norm.requisito.js",
    "normalizers/bdl.norm.estudiante.js",
    "normalizers/bdl.norm.nota.js",
    "normalizers/bdl.norm.division.js",
    "normalizers/bdl.norm.error.js",
    "repositories/bdl.repo.base.js",
    "repositories/bdl.repo.config.js",
    "repositories/bdl.repo.periodos.js",
    "repositories/bdl.repo.carreras.js",
    "repositories/bdl.repo.personas.js",
    "repositories/bdl.repo.estudiantes.js",
    "repositories/bdl.repo.requisitos.js",
    "repositories/bdl.repo.notas.js",
    "repositories/bdl.repo.divisiones.js",
    "repositories/bdl.repo.dashboard.js",
    "repositories/bdl.repo.errores.js",
    "repositories/bdl.repositories.index.js",
    "api/bdl.api.js",
    "sync/bdl.sync.config.js",
    "sync/bdl.sync.queue.js",
    "sync/bdl.sync.log.js",
    "sync/bdl.sync.firebase.js",
    "sync/bdl.sync.upload.js",
    "sync/bdl.sync.download.js",
    "sync/bdl.sync.engine.js",
    "sync/bdl.sync.index.js",
    "connections/shared/conn.interface.js",
    "connections/shared/conn.registry.js",
    "connections/shared/conn.response.js",
    "connections/bdlocal/bdl.adapter.js",
    "connections/firebase/fb.adapter.js",
    "connections/supabase/sb.adapter.js",
    "connections/excel/ex.adapter.js",
    "connections/google-sheets/gs.adapter.js",
    "continuity/rules/cont.rules.config.js",
    "continuity/rules/cont.rules.priority.js",
    "continuity/rules/cont.rules.modes.js",
    "continuity/events/cont.event.model.js",
    "continuity/events/cont.event.classify.js",
    "continuity/events/cont.event.repo.js",
    "continuity/events/cont.event.create.js",
    "continuity/health/cont.health.repo.js",
    "continuity/health/cont.health.checker.js",
    "continuity/guardian/cont.guardian.state.js",
    "continuity/alerts/cont.alert.throttle.js",
    "continuity/alerts/cont.alert.messages.js",
    "continuity/alerts/cont.alert.service.js",
    "continuity/guardian/cont.guardian.js",
    "continuity/cont.index.js",
    "adapters/bdl.screen-compat.js",
    "adapters/bdl.screen-autorefresh.js"
  ];

  document.write(files.map(function(file){
    return '<script src="' + base + file + '"><\/script>';
  }).join(""));
})(window, document);

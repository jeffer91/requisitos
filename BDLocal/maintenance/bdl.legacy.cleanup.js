/* =========================================================
Nombre completo: bdl.legacy.cleanup.js
Ruta o ubicación: /BDLocal/maintenance/bdl.legacy.cleanup.js
Función o funciones:
- Auditar integridad, duplicados, registros incompletos y relaciones rotas.
- Comparar tablas legacy con DB_VERSION 2 sin borrar datos.
- Revisar stores, índices, caché, errores y cambios bloqueados.
- Ejecutar únicamente mantenimiento conservador con confirmación.
- Montarse dentro de Mantenimiento seguro.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.3.0-safe-maintenance";
  var LEGACY = ["estudiantes","requisitos","notas","cambios","contactos"];
  var V2 = ["personas","matriculas_periodo","requisitos_estudiante","notas_titulacion","contactos_estudiante","divisiones_estudiante","cambios_pendientes"];
  var lastReport = null;
  var migrationReady = false;

  function id(name){ return document.getElementById(name); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function db(){ return window.BL2DB || null; }
  function config(){ return window.BL2Config || {}; }
  function outbox(){ return window.BDLSyncOutbox || null; }
  function now(){ return new Date().toISOString(); }

  function period(){
    if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
      var selected = window.BL2App.getSelectedPeriod();
      if(selected && text(selected.id)){ return { id:text(selected.id),label:text(selected.label || selected.id) }; }
    }
    var select = id("bl2-period-select");
    var periodoId = text(select && select.value);
    return { id:periodoId,label:select && select.selectedOptions && select.selectedOptions[0] ? text(select.selectedOptions[0].textContent) : periodoId };
  }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function rowPeriod(row){ return text(row && (row.periodoId || row.periodId || row.periodoCanonicoId)); }
  function rowCedula(row){ return normalizeCedula(row && (row.cedula || row.numeroIdentificacion || row.idPersona)); }
  function rowStudentId(row){ return text(row && (row.idEstudiantePeriodo || row.studentId || (rowPeriod(row) && rowCedula(row) ? rowPeriod(row) + "__" + rowCedula(row) : ""))); }

  function read(name){
    var current = db();
    if(!current || typeof current.getAll !== "function"){ return Promise.resolve([]); }
    return current.getAll(name).then(function(rows){ return Array.isArray(rows) ? rows : []; }).catch(function(){ return []; });
  }

  function physicalMeta(){
    var current = db();
    return current && typeof current.meta === "function" ? current.meta() : { stores:[],missingStores:[] };
  }

  function expectedStores(){
    var stores = config().stores || {};
    var seen = Object.create(null);
    return Object.keys(stores).map(function(key){ return text(stores[key]); }).filter(function(name){ if(!name || seen[name]){ return false; } seen[name] = true; return true; });
  }

  function expectedIndexes(){
    var stores = config().stores || {};
    var source = config().dbV2 && config().dbV2.indexes || {};
    var result = {};
    Object.keys(source).forEach(function(key){
      var table = text(stores[key] || key);
      if(table){ result[table] = Array.isArray(source[key]) ? source[key].slice() : []; }
    });
    return result;
  }

  function inspectIndexes(){
    var current = db();
    if(!current || typeof current.open !== "function"){ return Promise.resolve({ ok:false,tables:{},missing:["BL2DB.open"] }); }
    return current.open().then(function(nativeDb){
      var expected = expectedIndexes();
      var result = { ok:true,tables:{},missing:[] };
      Object.keys(expected).forEach(function(table){
        if(!nativeDb.objectStoreNames.contains(table)){
          result.tables[table] = { exists:false,expected:expected[table],actual:[],missing:expected[table].slice() };
          expected[table].forEach(function(index){ result.missing.push(table + "." + index); });
          result.ok = false;
          return;
        }
        var store = nativeDb.transaction([table],"readonly").objectStore(table);
        var actual = Array.prototype.slice.call(store.indexNames || []);
        var missing = expected[table].filter(function(index){ return actual.indexOf(index) < 0; });
        result.tables[table] = { exists:true,keyPath:Array.isArray(store.keyPath) ? store.keyPath.join(" + ") : text(store.keyPath),expected:expected[table],actual:actual,missing:missing };
        missing.forEach(function(index){ result.missing.push(table + "." + index); });
        if(missing.length){ result.ok = false; }
      });
      return result;
    }).catch(function(error){ return { ok:false,tables:{},missing:[],error:error.message || String(error) }; });
  }

  function duplicateGroups(rows,keyFn){
    var map = Object.create(null);
    (rows || []).forEach(function(row){ var key = text(keyFn(row)); if(!key){ return; } if(!map[key]){ map[key] = []; } map[key].push(row); });
    return Object.keys(map).filter(function(key){ return map[key].length > 1; }).map(function(key){ return { key:key,total:map[key].length }; });
  }

  function relationKey(row){ return rowStudentId(row); }
  function missingRelation(rows,valid){
    return (rows || []).filter(function(row){ var key = relationKey(row); return !!key && !valid[key]; });
  }

  function coverage(source,target,keyFn){
    var targetMap = Object.create(null);
    (target || []).forEach(function(row){ var key = text(keyFn(row)); if(key){ targetMap[key] = true; } });
    var missing = (source || []).filter(function(row){ var key = text(keyFn(row)); return !!key && !targetMap[key]; });
    return { legacy:(source || []).length,v2:(target || []).length,missingInV2:missing.length,sample:missing.slice(0,10).map(keyFn) };
  }

  function analyzeBlocked(changes){
    var ob = outbox();
    var result = { google:0,firebase:0,supabase:0,total:0 };
    ["google","firebase","supabase"].forEach(function(target){
      (changes || []).forEach(function(row){
        var blocked = ob && typeof ob.isBlocked === "function" ? ob.isBlocked(row,target,{}) : false;
        if(blocked){ result[target]++; result.total++; }
      });
    });
    return result;
  }

  function recommendations(report){
    var list = [];
    if(report.stores.missing.length){ list.push("Faltan tablas físicas: " + report.stores.missing.join(", ") + ". Preparar una recarga segura."); }
    if(report.indexes.missing.length){ list.push("Faltan índices: " + report.indexes.missing.join(", ") + ". Requieren actualización del esquema y recarga segura."); }
    if(report.duplicates.total){ list.push("Hay " + report.duplicates.total + " duplicado(s) lógicos. Revisar el JSON antes de corregirlos; este módulo no elimina registros automáticamente."); }
    if(report.incomplete.total){ list.push("Hay " + report.incomplete.total + " registro(s) incompleto(s) que requieren revisión de origen."); }
    if(report.orphans.total){ list.push("Hay " + report.orphans.total + " relación(es) huérfana(s). No deben eliminarse sin revisar la cédula y el período."); }
    if(report.legacy.missingTotal){ list.push("Existen " + report.legacy.missingTotal + " registro(s) legacy sin equivalente V2. Ejecutar la migración segura."); }
    if(report.blocked.total){ list.push("Hay " + report.blocked.total + " destino(s) bloqueado(s) en sincronización. Puede rehabilitarlos desde mantenimiento."); }
    if(report.validationErrors){ list.push("Hay " + report.validationErrors + " error(es) de validación en el período activo."); }
    if(!list.length){ list.push("No se detectaron problemas estructurales importantes en el período revisado."); }
    list.push("Las tablas legacy permanecen intactas. No se ofrece un botón de borrado masivo.");
    return list;
  }

  function analyze(){
    var currentPeriod = period();
    var names = expectedStores().concat(LEGACY).concat(V2);
    var unique = names.filter(function(name,index){ return name && names.indexOf(name) === index; });
    return Promise.all([Promise.all(unique.map(function(name){ return read(name).then(function(rows){ return { name:name,rows:rows }; }); })),inspectIndexes()]).then(function(values){
      var tables = {};
      values[0].forEach(function(item){ tables[item.name] = item.rows; });
      var allMatriculas = tables.matriculas_periodo || [];
      var matriculas = currentPeriod.id ? allMatriculas.filter(function(row){ return rowPeriod(row) === currentPeriod.id; }) : allMatriculas;
      var requisitos = currentPeriod.id ? (tables.requisitos_estudiante || []).filter(function(row){ return rowPeriod(row) === currentPeriod.id; }) : tables.requisitos_estudiante || [];
      var notas = currentPeriod.id ? (tables.notas_titulacion || []).filter(function(row){ return rowPeriod(row) === currentPeriod.id; }) : tables.notas_titulacion || [];
      var contactos = currentPeriod.id ? (tables.contactos_estudiante || []).filter(function(row){ return rowPeriod(row) === currentPeriod.id; }) : tables.contactos_estudiante || [];
      var divisiones = currentPeriod.id ? (tables.divisiones_estudiante || []).filter(function(row){ return rowPeriod(row) === currentPeriod.id; }) : tables.divisiones_estudiante || [];
      var cambios = currentPeriod.id ? (tables.cambios_pendientes || []).filter(function(row){ return !rowPeriod(row) || rowPeriod(row) === currentPeriod.id; }) : tables.cambios_pendientes || [];
      var errores = currentPeriod.id ? (tables.errores_validacion || []).filter(function(row){ return !rowPeriod(row) || rowPeriod(row) === currentPeriod.id; }) : tables.errores_validacion || [];
      var matriculaMap = Object.create(null);
      matriculas.forEach(function(row){ var key = rowStudentId(row); if(key){ matriculaMap[key] = true; } });
      var cedulasMatriculadas = Object.create(null);
      allMatriculas.forEach(function(row){ var cedula = rowCedula(row); if(cedula){ cedulasMatriculadas[cedula] = true; } });

      var duplicates = {
        matriculas:duplicateGroups(matriculas,function(row){ return rowPeriod(row) + "__" + rowCedula(row); }),
        requisitos:duplicateGroups(requisitos,function(row){ return rowStudentId(row) + "__" + text(row.requisitoKey || row.key || row.nombre); }),
        notas:duplicateGroups(notas,rowStudentId)
      };
      duplicates.total = duplicates.matriculas.length + duplicates.requisitos.length + duplicates.notas.length;

      var incomplete = {
        personas:(tables.personas || []).filter(function(row){ return !rowCedula(row) || !text(row.nombreCompleto || row.nombres || row.Nombres); }),
        matriculas:matriculas.filter(function(row){ return !rowPeriod(row) || !rowCedula(row) || !rowStudentId(row); })
      };
      incomplete.total = incomplete.personas.length + incomplete.matriculas.length;

      var orphans = {
        requisitos:missingRelation(requisitos,matriculaMap),
        notas:missingRelation(notas,matriculaMap),
        contactos:missingRelation(contactos,matriculaMap),
        divisiones:missingRelation(divisiones,matriculaMap),
        personasSinMatricula:(tables.personas || []).filter(function(row){ var cedula = rowCedula(row); return !!cedula && !cedulasMatriculadas[cedula]; })
      };
      orphans.total = orphans.requisitos.length + orphans.notas.length + orphans.contactos.length + orphans.divisiones.length + orphans.personasSinMatricula.length;

      var legacy = {
        estudiantes:coverage(tables.estudiantes || [],tables.matriculas_periodo || [],rowStudentId),
        requisitos:coverage(tables.requisitos || [],tables.requisitos_estudiante || [],function(row){ return rowStudentId(row) + "__" + text(row.requisitoKey || row.key || row.nombre); }),
        notas:coverage(tables.notas || [],tables.notas_titulacion || [],rowStudentId),
        cambios:coverage(tables.cambios || [],tables.cambios_pendientes || [],function(row){ return text(row.id || row.cambioId); })
      };
      legacy.missingTotal = Object.keys(legacy).reduce(function(total,key){ return total + num(legacy[key] && legacy[key].missingInV2); },0);

      var meta = physicalMeta();
      var expected = expectedStores();
      var actual = Array.isArray(meta.stores) ? meta.stores : [];
      var report = {
        ok:true,
        version:VERSION,
        checkedAt:now(),
        period:currentPeriod,
        stores:{ expected:expected,actual:actual,missing:expected.filter(function(name){ return actual.indexOf(name) < 0; }) },
        indexes:values[1],
        counts:{ personas:(tables.personas || []).length,matriculas:matriculas.length,requisitos:requisitos.length,notas:notas.length,contactos:contactos.length,divisiones:divisiones.length,cambios:cambios.length,cache:(tables.cache_views || []).length },
        duplicates:duplicates,
        incomplete:{ total:incomplete.total,personas:incomplete.personas.slice(0,20),matriculas:incomplete.matriculas.slice(0,20) },
        orphans:{ total:orphans.total,requisitos:orphans.requisitos.slice(0,20),notas:orphans.notas.slice(0,20),contactos:orphans.contactos.slice(0,20),divisiones:orphans.divisiones.slice(0,20),personasSinMatricula:orphans.personasSinMatricula.slice(0,20) },
        legacy:legacy,
        blocked:analyzeBlocked(cambios),
        validationErrors:errores.length
      };
      report.ok = !report.stores.missing.length && !report.indexes.missing.length && !report.duplicates.total && !report.incomplete.total && !report.orphans.total;
      report.safeToCleanLegacy = legacy.missingTotal === 0 && (tables.matriculas_periodo || []).length > 0;
      report.recommendations = recommendations(report);
      lastReport = report;
      return report;
    });
  }

  function reportStatus(message,type){
    var box = id("maintenance-status");
    if(box){ box.className = "bdlc-alert " + (type || "info"); box.textContent = message; }
  }

  function paint(report){
    var summary = id("maintenance-summary");
    var output = id("maintenance-json");
    if(!summary || !output){ return; }
    var rows = [
      ["Estado",report.ok ? "Sin alertas importantes" : "Requiere revisión"],
      ["Período",report.period && (report.period.label || report.period.id) || "Todos"],
      ["Stores faltantes",report.stores.missing.length],
      ["Índices faltantes",report.indexes.missing.length],
      ["Duplicados lógicos",report.duplicates.total],
      ["Registros incompletos",report.incomplete.total],
      ["Relaciones huérfanas",report.orphans.total],
      ["Legacy sin equivalente V2",report.legacy.missingTotal],
      ["Destinos bloqueados",report.blocked.total],
      ["Errores de validación",report.validationErrors]
    ];
    summary.className = "bdlc-table-wrap";
    summary.innerHTML = '<table class="bdlc-table"><tbody>' + rows.map(function(row){ return '<tr><th>' + esc(row[0]) + '</th><td>' + esc(row[1]) + '</td></tr>'; }).join("") + '</tbody></table><div class="bdlc-log-list">' + report.recommendations.map(function(item){ return '<div class="bdlc-log-item"><strong>Recomendación</strong><span>' + esc(item) + '</span></div>'; }).join("") + '</div>';
    output.textContent = JSON.stringify(report,null,2);
    var migrate = id("maintenance-migrate");
    if(migrate){ migrate.disabled = !migrationReady || !report.legacy.missingTotal; }
  }

  function runAndPaint(){
    reportStatus("Analizando BDLocal sin modificar datos...","info");
    return analyze().then(function(report){ paint(report); reportStatus("Análisis finalizado. Revise las recomendaciones antes de ejecutar acciones.",report.ok ? "success" : "warning"); return report; }).catch(function(error){ reportStatus(error.message || String(error),"error"); throw error; });
  }

  function previewMigration(){
    var migration = window.BDLMigrationLegacyV2;
    if(!migration || typeof migration.preview !== "function"){ return Promise.reject(new Error("La migración legacy → V2 no está disponible.")); }
    reportStatus("Generando vista previa de migración...","info");
    return migration.preview().then(function(result){ migrationReady = !!(result && result.ok); var button = id("maintenance-migrate"); if(button){ button.disabled = !migrationReady; } var output = id("maintenance-json"); if(output){ output.textContent = JSON.stringify({ maintenance:lastReport,migrationPreview:result },null,2); } reportStatus("Vista previa lista. No se escribió ningún dato.","success"); return result; });
  }

  function runMigration(){
    var migration = window.BDLMigrationLegacyV2;
    var backup = window.BL2Backup;
    if(!migrationReady){ return Promise.reject(new Error("Ejecute primero la vista previa de migración.")); }
    if(!migration || typeof migration.run !== "function"){ return Promise.reject(new Error("La migración no está disponible.")); }
    if(!confirm("Migrar los registros legacy faltantes hacia V2. Se creará un respaldo completo y las tablas legacy permanecerán intactas. ¿Continuar?")){ return Promise.resolve({ cancelled:true }); }
    reportStatus("Creando respaldo de seguridad...","warning");
    var safety = backup && typeof backup.createBackup === "function" ? backup.createBackup({ scope:"all",type:"pre_migration" }) : Promise.resolve(null);
    return safety.then(function(saved){
      reportStatus("Ejecutando migración segura...","warning");
      return migration.run({ confirm:true }).then(function(result){ result.safetyBackupId = saved && saved.record && saved.record.id; migrationReady = false; reportStatus(result.message || "Migración finalizada.",result.ok === false ? "error" : "success"); return runAndPaint().then(function(){ return result; }); });
    });
  }

  function clearCache(){
    var current = db();
    if(!current || typeof current.clear !== "function"){ return Promise.reject(new Error("BL2DB.clear no está disponible.")); }
    if(!confirm("Vaciar únicamente cache_views. No se borrarán personas, matrículas, requisitos ni notas. ¿Continuar?")){ return Promise.resolve({ cancelled:true }); }
    return current.clear("cache_views").then(function(){
      if(window.BDLocalConexiones && typeof window.BDLocalConexiones.refreshCache === "function"){ return window.BDLocalConexiones.refreshCache({ force:true,light:true,source:"maintenance" }).catch(function(){ return null; }); }
      return null;
    }).then(function(){ reportStatus("Caché visual limpiada y actualización solicitada.","success"); return runAndPaint(); });
  }

  function resetBlocked(){
    var ob = outbox();
    var currentPeriod = period();
    if(!ob || typeof ob.list !== "function" || typeof ob.resetRetries !== "function"){ return Promise.reject(new Error("La cola de sincronización no permite rehabilitar reintentos.")); }
    return ob.list({ periodoId:currentPeriod.id }).then(function(changes){
      var plan = {};
      ["google","firebase","supabase"].forEach(function(target){ plan[target] = (changes || []).filter(function(row){ return typeof ob.isBlocked === "function" && ob.isBlocked(row,target,{}); }); });
      var total = Object.keys(plan).reduce(function(sum,target){ return sum + plan[target].length; },0);
      if(!total){ reportStatus("No existen cambios bloqueados.","success"); return { ok:true,updated:0 }; }
      if(!confirm("Rehabilitar " + total + " destino(s) bloqueado(s). Los cambios volverán a estado PENDIENTE, pero no se subirán automáticamente. ¿Continuar?")){ return { cancelled:true }; }
      var chain = Promise.resolve();
      Object.keys(plan).forEach(function(target){ if(plan[target].length){ chain = chain.then(function(){ return ob.resetRetries(plan[target],target); }); } });
      return chain.then(function(){ reportStatus("Cambios bloqueados rehabilitados. Use la Cola de sincronización para subirlos.","success"); return runAndPaint(); });
    });
  }

  function prepareReload(){
    if(!window.BDLFinalHealth || typeof window.BDLFinalHealth.prepareReload !== "function"){ return Promise.reject(new Error("BDLFinalHealth.prepareReload no está disponible.")); }
    if(!confirm("Cerrar IndexedDB y recargar la pantalla para completar stores o índices declarados. No se borrarán datos. ¿Continuar?")){ return Promise.resolve({ cancelled:true }); }
    return Promise.resolve(window.BDLFinalHealth.prepareReload({ reload:true,delay:400,reason:"Mantenimiento seguro de esquema" }));
  }

  function copyReport(){
    if(!navigator.clipboard || !navigator.clipboard.writeText){ return Promise.reject(new Error("El portapapeles no está disponible.")); }
    return navigator.clipboard.writeText(JSON.stringify(lastReport || {},null,2)).then(function(){ reportStatus("Reporte copiado.","success"); return true; });
  }

  function mount(container){
    if(typeof container === "string"){ container = document.querySelector(container); }
    container = container || id("bl2-maintenance-slot");
    if(!container){ return Promise.resolve(null); }
    if(container.getAttribute("data-maintenance-mounted") !== "true"){
      container.className = "";
      container.setAttribute("data-maintenance-mounted","true");
      container.innerHTML = '<div class="bdlc-card"><div class="bdlc-header"><div><h3>Análisis de integridad</h3><p>Primero analiza y muestra el impacto. No elimina registros automáticamente.</p></div><span class="bdlc-status ok">Operaciones controladas</span></div><div class="bdlc-actions"><button id="maintenance-analyze" class="bdlc-button" type="button">Analizar base</button><button id="maintenance-copy" class="bdlc-button secondary" type="button">Copiar reporte</button><button id="maintenance-migration-preview" class="bdlc-button secondary" type="button">Vista previa legacy → V2</button><button id="maintenance-migrate" class="bdlc-button warning" type="button" disabled>Migrar legacy faltante</button></div><div id="maintenance-status" class="bdlc-alert info">Pendiente de análisis.</div></div><div class="bdlc-card"><h3>Resultado</h3><div id="maintenance-summary" class="bdlc-empty">Ejecute el análisis para revisar la integridad.</div></div><div class="bdlc-card"><div class="bdlc-header"><div><h3>Acciones conservadoras</h3><p>Estas acciones no borran estudiantes ni limpian toda la base.</p></div></div><div class="bdlc-actions"><button id="maintenance-cache" class="bdlc-button secondary" type="button">Limpiar caché visual</button><button id="maintenance-retries" class="bdlc-button secondary" type="button">Rehabilitar bloqueados</button><button id="maintenance-reload" class="bdlc-button secondary" type="button">Preparar recarga segura</button></div></div><div class="bdlc-card"><h3>JSON técnico</h3><pre id="maintenance-json" class="bdlc-raw-output">{}</pre></div>';
      id("maintenance-analyze").addEventListener("click",function(){ runAndPaint().catch(function(){}); });
      id("maintenance-copy").addEventListener("click",function(){ copyReport().catch(function(error){ reportStatus(error.message,"error"); }); });
      id("maintenance-migration-preview").addEventListener("click",function(){ previewMigration().catch(function(error){ reportStatus(error.message,"error"); }); });
      id("maintenance-migrate").addEventListener("click",function(){ runMigration().catch(function(error){ reportStatus(error.message,"error"); }); });
      id("maintenance-cache").addEventListener("click",function(){ clearCache().catch(function(error){ reportStatus(error.message,"error"); }); });
      id("maintenance-retries").addEventListener("click",function(){ resetBlocked().catch(function(error){ reportStatus(error.message,"error"); }); });
      id("maintenance-reload").addEventListener("click",function(){ prepareReload().catch(function(error){ reportStatus(error.message,"error"); }); });
    }
    return Promise.resolve(container);
  }

  function bind(){ return mount(id("bl2-maintenance-slot")); }

  window.BDLLegacyCleanup = {
    version:VERSION,
    analyze:analyze,
    runAndPaint:runAndPaint,
    previewMigration:previewMigration,
    runMigration:runMigration,
    clearCache:clearCache,
    resetBlocked:resetBlocked,
    prepareReload:prepareReload,
    mount:mount,
    bind:bind,
    getLastReport:function(){ return lastReport; }
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",bind);
  }else{
    bind();
  }
})(window, document);

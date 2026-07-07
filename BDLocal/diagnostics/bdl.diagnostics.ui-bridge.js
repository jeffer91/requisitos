/* =========================================================
Archivo: bdl.diagnostics.ui-bridge.js
Ruta: /BDLocal/diagnostics/bdl.diagnostics.ui-bridge.js
Función:
- Inyectar diagnóstico general en BL2 sin tocar bl2.app.js.
- Inyectar migración manual legacy → DB_VERSION 2.
- Mostrar salud, recomendaciones y JSON técnico.
Con qué se conecta:
- BDLocal/diagnostics/bdl.diagnostics.general.js
- BDLocal/bl2.db.js
- BDLocal/bl2.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.2.0-block12";

  function byId(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function esc(value){
    return text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function db(){ return window.BL2DB || null; }
  function stores(){ return window.BL2Config && window.BL2Config.stores ? window.BL2Config.stores : {}; }
  function now(){ return new Date().toISOString(); }
  function ced(v){ var r = text(v).replace(/[^0-9A-Za-z]/g, ""); return /^\d{9}$/.test(r) ? "0" + r : r; }
  function per(v){ v = text(v); var m = v.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/); return m ? m[1] + "-" + m[2] + "__" + m[3] + "-" + m[4] : v.replace(/_+/g, "__"); }
  function sid(p, c){ p = per(p); c = ced(c); return p && c ? p + "__" + c : ""; }
  function first(row, keys){ for(var i=0;i<keys.length;i++){ if(text((row||{})[keys[i]]) !== ""){ return row[keys[i]]; } } return ""; }
  function note(v){ var raw = text(v).replace(",", "."); if(!raw){ return null; } var n = Number(raw); return isFinite(n) ? Math.max(0, Math.min(10, Math.round(n * 100) / 100)) : null; }
  function fin(a,b){ a = note(a); b = note(b); return a == null || b == null ? null : Math.round(((a * 0.70) + (b * 0.30)) * 100) / 100; }
  function vals(map){ return Object.keys(map).map(function(k){ return map[k]; }); }
  function put(map, key, row){ if(key && !map[key]){ map[key] = row; } }

  function ensurePanel(){
    if(byId("bdl-general-diagnostics-card")){ return byId("bdl-general-diagnostics-card"); }
    var main = document.querySelector(".bl2-main") || document.body;
    var section = document.createElement("section");
    section.id = "bdl-general-diagnostics-card";
    section.className = "bl2-card bdl-general-diagnostics-card";
    section.innerHTML = [
      '<div class="bl2-card-head bl2-card-head-row">',
      '  <div><h2>Diagnóstico general BDLocal</h2><p>Revisa reglas, repositorios, servicios, notas, cambios y sincronización.</p></div>',
      '  <button id="bdl-btn-general-diagnostics" class="bl2-btn bl2-btn-light" type="button">Ejecutar diagnóstico</button>',
      '</div>',
      '<div id="bdl-general-diagnostics-summary" class="bdl-general-diagnostics-summary">Pendiente de ejecutar.</div>',
      '<details class="bdl-general-diagnostics-details"><summary>Ver JSON técnico</summary><pre id="bdl-general-diagnostics-json">{}</pre></details>'
    ].join("");
    main.appendChild(section);
    return section;
  }

  function ensureMigrationPanel(){
    if(byId("bdl-legacy-v2-card")){ return byId("bdl-legacy-v2-card"); }
    var main = document.querySelector(".bl2-main") || document.body;
    var section = document.createElement("section");
    section.id = "bdl-legacy-v2-card";
    section.className = "bl2-card bdl-general-diagnostics-card";
    section.innerHTML = [
      '<div class="bl2-card-head bl2-card-head-row">',
      '  <div><h2>Migración DB_VERSION 2</h2><p>Convierte estudiantes legacy hacia personas, matrículas, requisitos, notas, contactos y cola nueva.</p></div>',
      '  <div><button id="bdl-btn-legacy-v2-preview" class="bl2-btn bl2-btn-light" type="button">Vista previa</button> <button id="bdl-btn-legacy-v2-run" class="bl2-btn bl2-btn-light" type="button" disabled>Migrar</button></div>',
      '</div>',
      '<pre id="bdl-legacy-v2-json">Ejecuta vista previa antes de migrar.</pre>'
    ].join("");
    main.appendChild(section);
    return section;
  }

  function statusClass(percent){ percent = Number(percent || 0); if(percent >= 85){ return "ok"; } if(percent >= 65){ return "warn"; } return "bad"; }

  function render(result){
    var summary = byId("bdl-general-diagnostics-summary");
    var json = byId("bdl-general-diagnostics-json");
    if(!summary || !json){ return; }
    var score = result && result.score ? result.score : { percent:0, passed:0, total:0 };
    var cls = statusClass(score.percent);
    var recs = Array.isArray(result && result.recommendations) ? result.recommendations : [];
    var counts = Array.isArray(result && result.counts) ? result.counts : [];
    summary.innerHTML = [
      '<div class="bdl-diag-score bdl-diag-score-'+esc(cls)+'"><strong>'+esc(score.percent)+'%</strong><span>'+esc(score.passed)+' / '+esc(score.total)+' controles OK</span></div>',
      '<div class="bdl-diag-counts">',
      counts.map(function(item){ return '<span><b>'+esc(item.name)+'</b>: '+esc(item.total || 0)+(item.ok ? '' : ' · error')+'</span>'; }).join(""),
      '</div>',
      '<div class="bdl-diag-recommendations">',
      recs.map(function(item){ return '<p>'+esc(item)+'</p>'; }).join(""),
      '</div>'
    ].join("");
    json.textContent = JSON.stringify(result || {}, null, 2);
  }

  function runDiagnostics(){
    ensurePanel();
    var summary = byId("bdl-general-diagnostics-summary");
    if(summary){ summary.textContent = "Diagnosticando BDLocal..."; }
    if(!window.BDLDiagnosticsGeneral || typeof window.BDLDiagnosticsGeneral.run !== "function"){
      render({ ok:false, score:{ percent:0, passed:0, total:1 }, recommendations:["BDLDiagnosticsGeneral no está disponible."], counts:[] });
      return;
    }
    window.BDLDiagnosticsGeneral.run({ source:"ui" }).then(render).catch(function(error){
      render({ ok:false, score:{ percent:0, passed:0, total:1 }, recommendations:[error.message || String(error)], counts:[], error:error.message || String(error), checkedAt:now() });
    });
  }

  function readLegacy(){
    var current = db();
    if(!current){ return Promise.reject(new Error("BL2DB no disponible.")); }
    var s = stores();
    return Promise.all([
      current.getAll(s.estudiantes || "estudiantes").catch(function(){ return []; }),
      current.getAll(s.requisitos || "requisitos").catch(function(){ return []; }),
      current.getAll(s.notas || "notas").catch(function(){ return []; }),
      current.getAll(s.contactos || "contactos").catch(function(){ return []; }),
      current.getAll(s.cambios || "cambios").catch(function(){ return []; })
    ]).then(function(r){ return { estudiantes:r[0]||[], requisitos:r[1]||[], notas:r[2]||[], contactos:r[3]||[], cambios:r[4]||[] }; });
  }

  function convert(legacy){
    var personas = {}, matriculas = {}, contactos = {}, divisiones = {}, carreras = {}, perDivs = {};
    (legacy.estudiantes || []).forEach(function(row){
      var c = ced(first(row,["cedula","_cedula","numeroIdentificacion","NumeroIdentificacion","Cedula","Cédula"]));
      var p = per(first(row,["periodoId","periodId","ultimoPeriodoId","_periodoId"]));
      var id = text(row.idEstudiantePeriodo || row.studentId || sid(p,c));
      if(!c || !p || !id){ return; }
      var nombre = text(first(row,["nombreCompleto","nombres","Nombres","nombre","Nombre","Estudiante","estudiante"]));
      var carrera = text(first(row,["carrera","NombreCarrera","nombreCarrera","Carrera","_carrera"]));
      var sede = text(first(row,["sede","Sede","campus","_sede"]));
      var division = text(first(row,["division","Division","División","_division"]));
      var updatedAt = text(row.updatedAt || row.actualizadoEn || "") || now();
      put(personas, c, { cedula:c, nombreCompleto:nombre, nombres:nombre, correoPersonal:text(first(row,["correoPersonal","CorreoPersonal","email","Email"])), correoInstitucional:text(first(row,["correoInstitucional","CorreoInstitucional"])), celular:text(first(row,["celular","Celular","telefono","Telefono"])), updatedAt:updatedAt, origen:"legacy.estudiantes" });
      put(matriculas, id, { idEstudiantePeriodo:id, periodoId:p, cedula:c, carrera:carrera, nombreCarrera:carrera, sede:sede, division:division, estadoMatricula:text(row.estadoMatricula || row.EstadoMatricula || "ACTIVO").toUpperCase()==="RETIRADO"?"RETIRADO":"ACTIVO", updatedAt:updatedAt, origen:"legacy.estudiantes" });
      put(contactos, id, { id:id, idEstudiantePeriodo:id, periodoId:p, cedula:c, correoPersonal:text(first(row,["correoPersonal","CorreoPersonal","email","Email"])), correoInstitucional:text(first(row,["correoInstitucional","CorreoInstitucional"])), celular:text(first(row,["celular","Celular","telefono","Telefono"])), telegram:text(first(row,["telegram","Telegram","usuarioTelegram"])), updatedAt:updatedAt, origen:"legacy.estudiantes" });
      if(division){ put(divisiones, id+"__"+division, { id:id+"__"+division, idEstudiantePeriodo:id, periodoId:p, cedula:c, carrera:carrera, division:division, updatedAt:updatedAt, origen:"legacy.estudiantes" }); put(perDivs, p+"__"+division, { id:p+"__"+division, periodoId:p, division:division, updatedAt:updatedAt, origen:"legacy.estudiantes" }); }
      if(carrera){ put(carreras, p+"__"+carrera, { id:p+"__"+carrera, periodoId:p, carrera:carrera, updatedAt:updatedAt, origen:"legacy.estudiantes" }); }
    });
    return {
      personas: vals(personas), matriculasPeriodo: vals(matriculas), contactosEstudiante: vals(contactos), divisionesEstudiante: vals(divisiones), periodosCarreras: vals(carreras), periodosDivisiones: vals(perDivs),
      requisitosEstudiante: (legacy.requisitos || []).map(function(row,i){ var p=per(row.periodoId); var c=ced(row.cedula); var idEP=text(row.idEstudiantePeriodo || row.studentId || sid(p,c)); var k=text(row.requisitoKey || row.key || row.nombre || row.Nombre || "requisito"); return { id:text(row.id)||idEP+"__"+k||"req_"+i, idEstudiantePeriodo:idEP, periodoId:p, cedula:c, requisitoKey:k, nombre:text(row.nombre||row.Nombre||k), estado:text(row.estado||row.valor||row.value), valor:text(row.valor||row.value||row.estado), updatedAt:text(row.updatedAt)||now(), origen:"legacy.requisitos" }; }).filter(function(x){ return !!x.id; }),
      notasTitulacion: (legacy.notas || []).map(function(row,i){ var p=per(row.periodoId); var c=ced(row.cedula); var idEP=text(row.idEstudiantePeriodo || row.studentId || sid(p,c) || row.id || "nota_"+i); var a=note(first(row,["notart","Notart","Nart","_nart"])); var b=note(first(row,["notdef","Notdef","Ndef","_ndef"])); var f=note(first(row,["notafinal","Notafinal","Nfinal","_nfin"])); return { idEstudiantePeriodo:idEP, periodoId:p, cedula:c, notart:a, notdef:b, notafinal:f==null?fin(a,b):f, Notart:a, Notdef:b, Notafinal:f==null?fin(a,b):f, estadoNota:text(row.estadoNota), updatedAt:text(row.updatedAt)||now(), origen:"legacy.notas" }; }).filter(function(x){ return !!x.idEstudiantePeriodo; }),
      cambiosPendientes: (legacy.cambios || []).map(function(row,i){ row=Object.assign({}, row||{}); row.id=text(row.id||row.cambioId||"cambio_"+Date.now()+"_"+i); row.cambioId=row.cambioId||row.id; row.updatedAt=text(row.updatedAt)||now(); row.createdAt=text(row.createdAt)||row.updatedAt; row.origen=text(row.origen||row.source||"legacy.cambios"); return row; })
    };
  }

  function count(data){ var out={}; Object.keys(data||{}).forEach(function(k){ out[k]=Array.isArray(data[k])?data[k].length:0; }); return out; }
  function paintMigration(result){ var box=byId("bdl-legacy-v2-json"); if(box){ box.textContent = JSON.stringify(result || {}, null, 2); } }

  function migrationPreview(){
    ensureMigrationPanel();
    var runBtn = byId("bdl-btn-legacy-v2-run");
    paintMigration({ message:"Preparando vista previa..." });
    readLegacy().then(function(legacy){ var converted = convert(legacy); var result = { ok:true, generatedAt:now(), legacy:count(legacy), target:count(converted), message:"Vista previa lista. No se escribió nada." }; paintMigration(result); if(runBtn){ runBtn.disabled = false; } }).catch(function(error){ paintMigration({ ok:false, message:error.message || String(error) }); });
  }

  function writeConverted(converted){
    var current = db(); var s = stores(); var written = {};
    var plan = [[s.periodosCarreras||"periodos_carreras",converted.periodosCarreras],[s.periodosDivisiones||"periodos_divisiones",converted.periodosDivisiones],[s.personas||"personas",converted.personas],[s.matriculasPeriodo||"matriculas_periodo",converted.matriculasPeriodo],[s.requisitosEstudiante||"requisitos_estudiante",converted.requisitosEstudiante],[s.notasTitulacion||"notas_titulacion",converted.notasTitulacion],[s.contactosEstudiante||"contactos_estudiante",converted.contactosEstudiante],[s.divisionesEstudiante||"divisiones_estudiante",converted.divisionesEstudiante],[s.cambiosPendientes||"cambios_pendientes",converted.cambiosPendientes]];
    var chain = Promise.resolve();
    plan.forEach(function(item){ chain = chain.then(function(){ written[item[0]]=0; if(!item[1] || !item[1].length){ return null; } return current.bulkPut(item[0], item[1]).then(function(){ written[item[0]] = item[1].length; }); }); });
    return chain.then(function(){ return written; });
  }

  function migrationRun(){
    if(!window.confirm("Ejecutar migración manual DB_VERSION 2?")){ return; }
    paintMigration({ message:"Migrando..." });
    readLegacy().then(function(legacy){
      var converted = convert(legacy);
      var backup = { scope:"bdlocal.migration", tipo:"before_legacy_to_v2", schemaVersion:"2", totalRegistros:(legacy.estudiantes||[]).length, payload:{ legacy:count(legacy), createdAt:now() }, origen:"diagnostics.ui" };
      var backupsRepo = window.BDLRepositories && window.BDLRepositories.get ? window.BDLRepositories.get("backups") : null;
      var backupPromise = backupsRepo && typeof backupsRepo.save === "function" ? backupsRepo.save(backup) : Promise.resolve(backup);
      return backupPromise.then(function(savedBackup){ return writeConverted(converted).then(function(written){ return { ok:true, migratedAt:now(), backup:savedBackup, legacy:count(legacy), target:count(converted), written:written, message:"Migración completada. Tablas legacy intactas." }; }); });
    }).then(function(result){ paintMigration(result); runDiagnostics(); }).catch(function(error){ paintMigration({ ok:false, message:error.message || String(error) }); });
  }

  function bind(){
    ensurePanel();
    ensureMigrationPanel();
    var diag = byId("bdl-btn-general-diagnostics");
    var prev = byId("bdl-btn-legacy-v2-preview");
    var runBtn = byId("bdl-btn-legacy-v2-run");
    if(diag && !diag.__bdlGeneralDiagnosticsBound){ diag.__bdlGeneralDiagnosticsBound = true; diag.addEventListener("click", runDiagnostics); }
    if(prev && !prev.__bdlLegacyPreviewBound){ prev.__bdlLegacyPreviewBound = true; prev.addEventListener("click", migrationPreview); }
    if(runBtn && !runBtn.__bdlLegacyRunBound){ runBtn.__bdlLegacyRunBound = true; runBtn.addEventListener("click", migrationRun); }
  }

  window.BDLDiagnosticsUIBridge = { version:VERSION, bind:bind, run:runDiagnostics, render:render, migrationPreview:migrationPreview, migrationRun:migrationRun };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(window, document);

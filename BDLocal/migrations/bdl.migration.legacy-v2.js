/* =========================================================
Archivo: bdl.migration.legacy-v2.js
Ruta: /BDLocal/migrations/bdl.migration.legacy-v2.js
Función:
- Migrar manualmente datos legacy hacia el modelo DB_VERSION 2.
- Crear personas, matrículas, requisitos, notas, contactos y cola nueva.
- Guardar respaldo previo antes de escribir en tablas nuevas.
- Mantener intactas las tablas legacy.
Con qué se conecta:
- BDLocal/bl2.db.js
- BDLocal/repositories/bdl.repo.backups.js
- BDLocal/migrations/bdl.migration.index.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block12";
  var running = false;
  var lastPreview = null;
  var lastResult = null;

  function text(v){ return String(v == null ? "" : v).trim(); }
  function now(){ return new Date().toISOString(); }
  function db(){ return window.BL2DB || null; }
  function stores(){ return window.BL2Config && window.BL2Config.stores ? window.BL2Config.stores : {}; }
  function cleanId(v){
    var raw = text(v).replace(/[^0-9A-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }
  function period(v){
    v = text(v);
    var m = v.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return m ? m[1] + "-" + m[2] + "__" + m[3] + "-" + m[4] : v.replace(/_+/g, "__");
  }
  function epId(periodoId, cedula){
    periodoId = period(periodoId);
    cedula = cleanId(cedula);
    return periodoId && cedula ? periodoId + "__" + cedula : "";
  }
  function first(row, keys){
    row = row || {};
    for(var i = 0; i < keys.length; i++){
      if(text(row[keys[i]]) !== ""){ return row[keys[i]]; }
    }
    return "";
  }
  function note(v){
    var raw = text(v).replace(",", ".");
    if(!raw){ return null; }
    var n = Number(raw);
    if(!isFinite(n)){ return null; }
    return Math.max(0, Math.min(10, Math.round(n * 100) / 100));
  }
  function finalNote(a, b){
    a = note(a); b = note(b);
    if(a == null || b == null){ return null; }
    return Math.round(((a * 0.70) + (b * 0.30)) * 100) / 100;
  }
  function values(map){ return Object.keys(map).map(function(k){ return map[k]; }); }
  function upsert(map, key, row){ if(key && !map[key]){ map[key] = row; } }

  function readAll(){
    var current = db();
    if(!current){ return Promise.reject(new Error("BL2DB no disponible.")); }
    var s = stores();
    return Promise.all([
      current.getAll(s.estudiantes || "estudiantes").catch(function(){ return []; }),
      current.getAll(s.requisitos || "requisitos").catch(function(){ return []; }),
      current.getAll(s.notas || "notas").catch(function(){ return []; }),
      current.getAll(s.contactos || "contactos").catch(function(){ return []; }),
      current.getAll(s.cambios || "cambios").catch(function(){ return []; })
    ]).then(function(r){
      return { estudiantes:r[0] || [], requisitos:r[1] || [], notas:r[2] || [], contactos:r[3] || [], cambios:r[4] || [] };
    });
  }

  function convert(legacy){
    legacy = legacy || {};
    var personas = {}, matriculas = {}, contactos = {}, divisiones = {}, carreras = {}, perDivs = {};

    (legacy.estudiantes || []).forEach(function(row){
      var cedula = cleanId(first(row, ["cedula", "_cedula", "numeroIdentificacion", "NumeroIdentificacion", "Cedula", "Cédula"]));
      var periodoId = period(first(row, ["periodoId", "periodId", "ultimoPeriodoId", "_periodoId"]));
      var idEP = text(row.idEstudiantePeriodo || row.studentId || epId(periodoId, cedula));
      if(!cedula || !periodoId || !idEP){ return; }

      var nombre = text(first(row, ["nombreCompleto", "nombres", "Nombres", "nombre", "Nombre", "Estudiante", "estudiante"]));
      var carrera = text(first(row, ["carrera", "NombreCarrera", "nombreCarrera", "Carrera", "_carrera"]));
      var sede = text(first(row, ["sede", "Sede", "campus", "_sede"]));
      var division = text(first(row, ["division", "Division", "División", "_division"]));
      var updatedAt = text(row.updatedAt || row.actualizadoEn || "") || now();

      upsert(personas, cedula, { cedula:cedula, nombreCompleto:nombre, nombres:nombre, correoPersonal:text(first(row,["correoPersonal","CorreoPersonal","email","Email"])), correoInstitucional:text(first(row,["correoInstitucional","CorreoInstitucional"])), celular:text(first(row,["celular","Celular","telefono","Telefono"])), updatedAt:updatedAt, origen:"legacy.estudiantes" });
      upsert(matriculas, idEP, { idEstudiantePeriodo:idEP, periodoId:periodoId, cedula:cedula, carrera:carrera, nombreCarrera:carrera, sede:sede, division:division, estadoMatricula:text(row.estadoMatricula || row.EstadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO", updatedAt:updatedAt, origen:"legacy.estudiantes" });
      upsert(contactos, idEP, { id:idEP, idEstudiantePeriodo:idEP, periodoId:periodoId, cedula:cedula, correoPersonal:text(first(row,["correoPersonal","CorreoPersonal","email","Email"])), correoInstitucional:text(first(row,["correoInstitucional","CorreoInstitucional"])), celular:text(first(row,["celular","Celular","telefono","Telefono"])), telegram:text(first(row,["telegram","Telegram","usuarioTelegram"])), updatedAt:updatedAt, origen:"legacy.estudiantes" });
      if(division){ upsert(divisiones, idEP + "__" + division, { id:idEP + "__" + division, idEstudiantePeriodo:idEP, periodoId:periodoId, cedula:cedula, carrera:carrera, division:division, updatedAt:updatedAt, origen:"legacy.estudiantes" }); }
      if(carrera){ upsert(carreras, periodoId + "__" + carrera, { id:periodoId + "__" + carrera, periodoId:periodoId, carrera:carrera, updatedAt:updatedAt, origen:"legacy.estudiantes" }); }
      if(division){ upsert(perDivs, periodoId + "__" + division, { id:periodoId + "__" + division, periodoId:periodoId, division:division, updatedAt:updatedAt, origen:"legacy.estudiantes" }); }
    });

    return {
      personas: values(personas),
      matriculasPeriodo: values(matriculas),
      contactosEstudiante: values(contactos).concat((legacy.contactos || []).map(function(row, i){ var p=period(row.periodoId); var c=cleanId(row.cedula); var id=epId(p,c) || text(row.id) || "contacto_"+i; return { id:id, idEstudiantePeriodo:id, periodoId:p, cedula:c, correoPersonal:text(row.correoPersonal || row.CorreoPersonal || row.email), correoInstitucional:text(row.correoInstitucional || row.CorreoInstitucional), celular:text(row.celular || row.Celular || row.telefono), telegram:text(row.telegram || row.Telegram), updatedAt:text(row.updatedAt)||now(), origen:"legacy.contactos" }; })),
      divisionesEstudiante: values(divisiones),
      periodosCarreras: values(carreras),
      periodosDivisiones: values(perDivs),
      requisitosEstudiante: (legacy.requisitos || []).map(function(row, i){ var p=period(row.periodoId); var c=cleanId(row.cedula); var idEP=text(row.idEstudiantePeriodo || row.studentId || epId(p,c)); var k=text(row.requisitoKey || row.key || row.nombre || row.Nombre || "requisito"); return { id:text(row.id)||idEP+"__"+k||"req_"+i, idEstudiantePeriodo:idEP, periodoId:p, cedula:c, requisitoKey:k, nombre:text(row.nombre || row.Nombre || k), estado:text(row.estado || row.valor || row.value), valor:text(row.valor || row.value || row.estado), updatedAt:text(row.updatedAt)||now(), origen:"legacy.requisitos" }; }).filter(function(x){ return !!x.id; }),
      notasTitulacion: (legacy.notas || []).map(function(row, i){ var p=period(row.periodoId); var c=cleanId(row.cedula); var idEP=text(row.idEstudiantePeriodo || row.studentId || epId(p,c) || row.id || "nota_"+i); var na=note(first(row,["notart","Notart","Nart","_nart"])); var nd=note(first(row,["notdef","Notdef","Ndef","_ndef"])); var nf=note(first(row,["notafinal","Notafinal","Nfinal","_nfin"])); return { idEstudiantePeriodo:idEP, periodoId:p, cedula:c, notart:na, notdef:nd, notafinal:nf==null?finalNote(na,nd):nf, Notart:na, Notdef:nd, Notafinal:nf==null?finalNote(na,nd):nf, estadoNota:text(row.estadoNota), updatedAt:text(row.updatedAt)||now(), origen:"legacy.notas" }; }).filter(function(x){ return !!x.idEstudiantePeriodo; }),
      cambiosPendientes: (legacy.cambios || []).map(function(row, i){ row=Object.assign({}, row||{}); row.id=text(row.id || row.cambioId || "cambio_"+Date.now()+"_"+i); row.cambioId=row.cambioId||row.id; row.updatedAt=text(row.updatedAt)||now(); row.createdAt=text(row.createdAt)||row.updatedAt; row.origen=text(row.origen || row.source || "legacy.cambios"); return row; })
    };
  }

  function count(data){ var out={}; Object.keys(data||{}).forEach(function(k){ out[k]=Array.isArray(data[k])?data[k].length:0; }); return out; }

  function preview(){
    return readAll().then(function(legacy){
      var converted = convert(legacy);
      lastPreview = { ok:true, version:VERSION, generatedAt:now(), legacy:count(legacy), target:count(converted), message:"Vista previa lista. No se escribió nada." };
      return lastPreview;
    });
  }

  function saveBackup(legacy){
    var repo = window.BDLRepositories && window.BDLRepositories.get ? window.BDLRepositories.get("backups") : null;
    var payload = { legacyCounts:count(legacy), createdAt:now() };
    var row = { scope:"bdlocal.migration", tipo:"before_legacy_to_v2", schemaVersion:"2", totalRegistros:(legacy.estudiantes||[]).length, payload:payload, origen:"BDLMigrationLegacyV2" };
    if(repo && typeof repo.save === "function"){ return repo.save(row); }
    return Promise.resolve(row);
  }

  function write(converted){
    var current = db();
    var s = stores();
    var plan = [
      [s.periodosCarreras || "periodos_carreras", converted.periodosCarreras],
      [s.periodosDivisiones || "periodos_divisiones", converted.periodosDivisiones],
      [s.personas || "personas", converted.personas],
      [s.matriculasPeriodo || "matriculas_periodo", converted.matriculasPeriodo],
      [s.requisitosEstudiante || "requisitos_estudiante", converted.requisitosEstudiante],
      [s.notasTitulacion || "notas_titulacion", converted.notasTitulacion],
      [s.contactosEstudiante || "contactos_estudiante", converted.contactosEstudiante],
      [s.divisionesEstudiante || "divisiones_estudiante", converted.divisionesEstudiante],
      [s.cambiosPendientes || "cambios_pendientes", converted.cambiosPendientes]
    ];
    var written = {};
    var chain = Promise.resolve();
    plan.forEach(function(item){ chain = chain.then(function(){ written[item[0]] = 0; if(!item[1] || !item[1].length){ return null; } return current.bulkPut(item[0], item[1]).then(function(){ written[item[0]] = item[1].length; }); }); });
    return chain.then(function(){ return written; });
  }

  function run(options){
    options = options || {};
    if(running){ return Promise.resolve({ ok:false, message:"Migración en curso." }); }
    if(!options.confirm){ return Promise.resolve({ ok:false, message:"Debe confirmar la migración manual." }); }
    running = true;
    return readAll().then(function(legacy){
      var converted = convert(legacy);
      return saveBackup(legacy).then(function(backup){ return write(converted).then(function(written){ lastResult = { ok:true, version:VERSION, migratedAt:now(), backup:backup, legacy:count(legacy), target:count(converted), written:written, message:"Migración completada. Las tablas legacy quedan intactas." }; return lastResult; }); });
    }).catch(function(error){ return { ok:false, message:error.message || String(error), failedAt:now() }; }).finally(function(){ running = false; });
  }

  function status(){ return { version:VERSION, running:running, lastPreview:lastPreview, lastResult:lastResult }; }

  window.BDLMigrationLegacyV2 = { version:VERSION, preview:preview, run:run, status:status, convert:convert };

  if(window.BDLMigrations && typeof window.BDLMigrations.register === "function"){
    window.BDLMigrations.register("2.1.0-legacy-to-v2-manual", { title:"Migración manual legacy a modelo DB_VERSION 2", destructive:false, preview:preview, run:run, status:status });
  }
})(window);

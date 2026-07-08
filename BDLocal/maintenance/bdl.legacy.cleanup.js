/* =========================================================
Archivo: bdl.legacy.cleanup.js
Ruta: /BDLocal/maintenance/bdl.legacy.cleanup.js
Función:
- Auditar dependencia legacy antes de limpiar.
- Comparar legacy vs DB_VERSION 2.
- Mostrar si estudiantes/requisitos/notas/cambios ya están cubiertos.
- No borra datos automáticamente.
Con qué se conecta:
- BL2DB
- BL2Config.stores
- BDLocal/bl2.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.1.0-block28";
  var LEGACY_TABLES = ["estudiantes", "requisitos", "notas", "cambios", "contactos"];
  var V2_TABLES = ["personas", "matriculas_periodo", "requisitos_estudiante", "notas_titulacion", "cambios_pendientes", "contactos_estudiante", "divisiones_estudiante"];

  function text(v){ return String(v == null ? "" : v).trim(); }
  function byId(id){ return document.getElementById(id); }
  function esc(v){ return text(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function db(){ return window.BL2DB || null; }

  function read(name){
    var current = db();
    if(!current || typeof current.getAll !== "function"){
      return Promise.resolve({ name:name, ok:false, rows:[], error:"BL2DB.getAll no disponible." });
    }
    return current.getAll(name).then(function(rows){ return { name:name, ok:true, rows:Array.isArray(rows) ? rows : [] }; }).catch(function(error){ return { name:name, ok:false, rows:[], error:error.message || String(error) }; });
  }

  function key(row){
    row = row || {};
    return text(row.idEstudiantePeriodo || row.studentId || ((row.periodoId || "") + "__" + (row.cedula || row.numeroIdentificacion || "")) || row.id || row.cedula);
  }

  function mapKeys(rows){
    var map = Object.create(null);
    rows.forEach(function(row){ var k = key(row); if(k){ map[k] = true; } });
    return map;
  }

  function countMissing(sourceRows, targetRows){
    var target = mapKeys(targetRows || []);
    var missing = 0;
    (sourceRows || []).forEach(function(row){ var k = key(row); if(k && !target[k]){ missing++; } });
    return missing;
  }

  function analyze(){
    var names = LEGACY_TABLES.concat(V2_TABLES);
    var result = { version:VERSION, checkedAt:new Date().toISOString(), tables:{}, legacy:{}, v2:{}, coverage:{}, safeToClean:false, recommendations:[] };
    return Promise.all(names.map(read)).then(function(list){
      list.forEach(function(item){
        result.tables[item.name] = { ok:item.ok, count:item.rows.length, error:item.error || "" };
        if(LEGACY_TABLES.indexOf(item.name) >= 0){ result.legacy[item.name] = item.rows; }
        if(V2_TABLES.indexOf(item.name) >= 0){ result.v2[item.name] = item.rows; }
      });

      result.coverage.estudiantesToMatriculas = {
        legacy: (result.legacy.estudiantes || []).length,
        v2: (result.v2.matriculas_periodo || []).length,
        missingInV2: countMissing(result.legacy.estudiantes || [], result.v2.matriculas_periodo || [])
      };
      result.coverage.requisitos = {
        legacy: (result.legacy.requisitos || []).length,
        v2: (result.v2.requisitos_estudiante || []).length,
        missingInV2: countMissing(result.legacy.requisitos || [], result.v2.requisitos_estudiante || [])
      };
      result.coverage.notas = {
        legacy: (result.legacy.notas || []).length,
        v2: (result.v2.notas_titulacion || []).length,
        missingInV2: countMissing(result.legacy.notas || [], result.v2.notas_titulacion || [])
      };
      result.coverage.cambios = {
        legacy: (result.legacy.cambios || []).length,
        v2: (result.v2.cambios_pendientes || []).length,
        missingInV2: countMissing(result.legacy.cambios || [], result.v2.cambios_pendientes || [])
      };

      var missingTotal = Object.keys(result.coverage).reduce(function(total, name){ return total + Number(result.coverage[name].missingInV2 || 0); }, 0);
      var hasV2 = (result.v2.matriculas_periodo || []).length > 0 || (result.v2.personas || []).length > 0;
      result.safeToClean = hasV2 && missingTotal === 0;

      if(!hasV2){ result.recommendations.push("Todavía no hay suficientes datos en DB_VERSION 2. No limpiar legacy."); }
      if(missingTotal > 0){ result.recommendations.push("Hay " + missingTotal + " registro(s) legacy sin equivalente V2. Ejecutar o revisar migración antes de limpiar."); }
      if(result.safeToClean){ result.recommendations.push("Legacy parece cubierto por DB_VERSION 2. Aun así, crear backup V2 antes de cualquier limpieza."); }
      result.recommendations.push("No se borró ningún dato. Este bloque solo audita y prepara limpieza segura.");

      delete result.legacy;
      delete result.v2;
      return result;
    });
  }

  function ensurePanel(){
    if(byId("bdl-legacy-cleanup-card")){ return byId("bdl-legacy-cleanup-card"); }
    var main = document.querySelector(".bl2-main") || document.body;
    var section = document.createElement("section");
    section.id = "bdl-legacy-cleanup-card";
    section.className = "bl2-card";
    section.innerHTML = [
      '<div class="bl2-card-head bl2-card-head-row">',
      '  <div><h2>Limpieza legacy segura</h2><p>Audita si las tablas antiguas ya están cubiertas por DB_VERSION 2. No borra datos.</p></div>',
      '  <button id="bdl-legacy-analyze" class="bl2-btn bl2-btn-light" type="button">Analizar legacy</button>',
      '</div>',
      '<div id="bdl-legacy-summary" class="bl2-summary"><div class="bl2-empty">Pendiente de análisis.</div></div>',
      '<pre id="bdl-legacy-json" style="max-height:320px;overflow:auto;background:#0f172a;color:#e5e7eb;border-radius:14px;padding:14px;font-size:12px;line-height:1.45;">{}</pre>'
    ].join("");
    main.appendChild(section);
    return section;
  }

  function paint(result){
    var box = byId("bdl-legacy-summary");
    var json = byId("bdl-legacy-json");
    var coverage = result.coverage || {};
    var rows = [
      '<div class="bl2-log-item"><strong>Estado</strong><span>'+esc(result.safeToClean ? "Listo para limpieza futura con backup previo" : "No limpiar todavía")+'</span></div>'
    ];
    Object.keys(coverage).forEach(function(name){
      var item = coverage[name] || {};
      rows.push('<div class="bl2-log-item"><strong>'+esc(name)+'</strong><span>Legacy: '+esc(item.legacy)+' · V2: '+esc(item.v2)+' · Faltan en V2: '+esc(item.missingInV2)+'</span></div>');
    });
    (result.recommendations || []).forEach(function(msg){ rows.push('<div class="bl2-log-item"><strong>Recomendación</strong><span>'+esc(msg)+'</span></div>'); });
    if(box){ box.innerHTML = rows.join(""); }
    if(json){ json.textContent = JSON.stringify(result, null, 2); }
  }

  function runAndPaint(){
    var box = byId("bdl-legacy-summary");
    if(box){ box.innerHTML = '<div class="bl2-empty">Analizando legacy...</div>'; }
    return analyze().then(function(result){ paint(result); return result; }).catch(function(error){
      var result = { ok:false, error:error.message || String(error), checkedAt:new Date().toISOString() };
      if(box){ box.innerHTML = '<div class="bl2-empty">Error: '+esc(result.error)+'</div>'; }
      var json = byId("bdl-legacy-json");
      if(json){ json.textContent = JSON.stringify(result, null, 2); }
      return result;
    });
  }

  function bind(){
    ensurePanel();
    var btn = byId("bdl-legacy-analyze");
    if(btn && !btn.__bdlLegacyBound){
      btn.__bdlLegacyBound = true;
      btn.addEventListener("click", runAndPaint);
    }
    setTimeout(runAndPaint, 1200);
  }

  window.BDLLegacyCleanup = { version:VERSION, analyze:analyze, bind:bind, runAndPaint:runAndPaint };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(window, document);

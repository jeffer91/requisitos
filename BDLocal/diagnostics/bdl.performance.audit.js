/* =========================================================
Archivo: bdl.performance.audit.js
Ruta: /BDLocal/diagnostics/bdl.performance.audit.js
Función:
- Auditar rendimiento e índices de DB_VERSION 2.
- Medir conteos de tablas críticas sin cargar toda la base.
- Probar índices con queryByIndex.
- Medir servicios principales de consulta/paginación.
- Mostrar resultados visuales en BL2 sin modificar datos.
Con qué se conecta:
- BL2DB
- BDLServices
- BDLServiceDefensas
- BDLServiceEstudiantes
- BDLocal/bl2.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.1.0-block29";
  var PROBE = "__bdl_perf_probe__";

  var TABLES = [
    "personas",
    "matriculas_periodo",
    "requisitos_estudiante",
    "notas_titulacion",
    "cambios_pendientes",
    "periodos",
    "estudiantes",
    "requisitos",
    "notas",
    "cambios"
  ];

  var INDEX_CHECKS = [
    { table:"matriculas_periodo", index:"periodoId", label:"Matrículas por período" },
    { table:"matriculas_periodo", index:"cedula", label:"Matrículas por cédula" },
    { table:"matriculas_periodo", index:"periodo_cedula", value:[PROBE, PROBE], label:"Matrícula período+cédula" },
    { table:"requisitos_estudiante", index:"periodoId", label:"Requisitos por período" },
    { table:"requisitos_estudiante", index:"idEstudiantePeriodo", label:"Requisitos por estudiante/período" },
    { table:"notas_titulacion", index:"periodoId", label:"Notas por período" },
    { table:"notas_titulacion", index:"cedula", label:"Notas por cédula" },
    { table:"cambios_pendientes", index:"tabla", label:"Cola por tabla" },
    { table:"cambios_pendientes", index:"estadoSheets", label:"Cola estado Google" },
    { table:"cambios_pendientes", index:"estadoFirebase", label:"Cola estado Firebase" },
    { table:"cambios_pendientes", index:"estadoSupabase", label:"Cola estado Supabase" }
  ];

  function text(v){ return String(v == null ? "" : v).trim(); }
  function byId(id){ return document.getElementById(id); }
  function db(){ return window.BL2DB || null; }
  function esc(v){ return text(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function nowMs(){ return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function round(n){ return Math.round(Number(n || 0) * 100) / 100; }

  function measure(label, fn){
    var started = nowMs();
    return Promise.resolve().then(fn).then(function(value){
      return { label:label, ok:true, ms:round(nowMs() - started), value:value };
    }).catch(function(error){
      return { label:label, ok:false, ms:round(nowMs() - started), error:error.message || String(error) };
    });
  }

  function countTable(name){
    var current = db();
    if(!current || typeof current.count !== "function"){ return Promise.resolve({ table:name, ok:false, count:0, error:"BL2DB.count no disponible." }); }
    return measure("count " + name, function(){ return current.count(name); }).then(function(result){
      return { table:name, ok:result.ok, count:result.value || 0, ms:result.ms, error:result.error || "" };
    });
  }

  function checkIndex(item){
    var current = db();
    if(!current || typeof current.queryByIndex !== "function"){
      return Promise.resolve({ table:item.table, index:item.index, label:item.label, ok:false, ms:0, error:"BL2DB.queryByIndex no disponible." });
    }
    return measure(item.table + "." + item.index, function(){
      return current.queryByIndex(item.table, item.index, item.value === undefined ? PROBE : item.value);
    }).then(function(result){
      return { table:item.table, index:item.index, label:item.label, ok:result.ok, ms:result.ms, count:Array.isArray(result.value) ? result.value.length : 0, error:result.error || "" };
    });
  }

  function activePeriodId(){
    if(window.BL2Core && typeof window.BL2Core.getActivePeriod === "function"){
      return window.BL2Core.getActivePeriod().then(function(period){ return text(period && period.id); }).catch(function(){ return ""; });
    }
    var current = db();
    if(current && typeof current.getSetting === "function"){
      return current.getSetting("activePeriodId", "").then(function(value){ return text(value); }).catch(function(){ return ""; });
    }
    return Promise.resolve("");
  }

  function callService(name, method, args){
    args = args || [];
    var services = window.BDLServices || null;
    var service = null;
    try{ service = services && typeof services.get === "function" ? services.get(name) : null; }catch(error){}
    if(!service && name === "defensas"){ service = window.BDLServiceDefensas || null; }
    if(!service && name === "estudiantes"){ service = window.BDLServiceEstudiantes || null; }
    if(!service || typeof service[method] !== "function"){
      return Promise.resolve({ service:name, method:method, ok:false, ms:0, error:"Servicio no disponible." });
    }
    return measure(name + "." + method, function(){ return service[method].apply(service, args); }).then(function(result){
      var value = result.value || {};
      return { service:name, method:method, ok:result.ok, ms:result.ms, total:value.total || value.filteredTotal || 0, rows:Array.isArray(value.rows) ? value.rows.length : Array.isArray(value.items) ? value.items.length : 0, error:result.error || "" };
    });
  }

  function serviceChecks(){
    return activePeriodId().then(function(periodoId){
      var options = { periodoId:periodoId, page:1, limit:25, filtros:{} };
      return Promise.all([
        callService("estudiantes", "page", [options]),
        callService("defensas", "getPage", [options])
      ]).then(function(results){
        return { periodoId:periodoId, results:results };
      });
    });
  }

  function recommendations(result){
    var list = [];
    var badIndexes = (result.indexes || []).filter(function(item){ return !item.ok; });
    var slowCounts = (result.counts || []).filter(function(item){ return item.ms > 500; });
    var slowServices = ((result.services && result.services.results) || []).filter(function(item){ return item.ms > 800; });

    if(badIndexes.length){ list.push("Faltan o fallan índices: " + badIndexes.map(function(x){ return x.table + "." + x.index; }).join(", ")); }
    if(slowCounts.length){ list.push("Conteos lentos en: " + slowCounts.map(function(x){ return x.table + " (" + x.ms + " ms)"; }).join(", ")); }
    if(slowServices.length){ list.push("Servicios lentos: " + slowServices.map(function(x){ return x.service + "." + x.method + " (" + x.ms + " ms)"; }).join(", ")); }
    if(!result.services || !text(result.services.periodoId)){ list.push("No hay período activo detectado; las pruebas de servicios se ejecutan con alcance conservador."); }
    if(!list.length){ list.push("Índices y servicios principales se ven listos para continuar."); }
    return list;
  }

  function run(){
    var result = { version:VERSION, checkedAt:new Date().toISOString(), counts:[], indexes:[], services:null, recommendations:[] };
    var chain = Promise.resolve();
    TABLES.forEach(function(name){ chain = chain.then(function(){ return countTable(name).then(function(item){ result.counts.push(item); }); }); });
    INDEX_CHECKS.forEach(function(item){ chain = chain.then(function(){ return checkIndex(item).then(function(row){ result.indexes.push(row); }); }); });
    chain = chain.then(function(){ return serviceChecks().then(function(s){ result.services = s; }); });
    return chain.then(function(){
      result.ok = result.indexes.every(function(item){ return item.ok; }) && ((result.services && result.services.results) || []).every(function(item){ return item.ok !== false; });
      result.recommendations = recommendations(result);
      return result;
    });
  }

  function ensurePanel(){
    if(byId("bdl-performance-card")){ return byId("bdl-performance-card"); }
    var main = document.querySelector(".bl2-main") || document.body;
    var section = document.createElement("section");
    section.id = "bdl-performance-card";
    section.className = "bl2-card";
    section.innerHTML = [
      '<div class="bl2-card-head bl2-card-head-row">',
      '  <div><h2>Rendimiento e índices</h2><p>Mide conteos, índices y servicios sin modificar datos.</p></div>',
      '  <button id="bdl-performance-run" class="bl2-btn bl2-btn-light" type="button">Ejecutar prueba</button>',
      '</div>',
      '<div id="bdl-performance-summary" class="bl2-summary"><div class="bl2-empty">Pendiente de prueba.</div></div>',
      '<pre id="bdl-performance-json" style="max-height:360px;overflow:auto;background:#0f172a;color:#e5e7eb;border-radius:14px;padding:14px;font-size:12px;line-height:1.45;">{}</pre>'
    ].join("");
    main.appendChild(section);
    return section;
  }

  function paint(result){
    var box = byId("bdl-performance-summary");
    var json = byId("bdl-performance-json");
    var badIndexes = (result.indexes || []).filter(function(item){ return !item.ok; }).length;
    var indexOk = (result.indexes || []).length - badIndexes;
    var serviceRows = result.services && result.services.results ? result.services.results : [];
    var html = [];
    html.push('<div class="bl2-log-item"><strong>Estado</strong><span>'+esc(result.ok ? "Correcto" : "Revisar")+'</span></div>');
    html.push('<div class="bl2-log-item"><strong>Índices</strong><span>'+esc(indexOk)+' OK · '+esc(badIndexes)+' con alerta</span></div>');
    serviceRows.forEach(function(item){ html.push('<div class="bl2-log-item"><strong>'+esc(item.service+'.'+item.method)+'</strong><span>'+esc(item.ok ? item.ms + " ms · filas " + item.rows + " · total " + item.total : "Error: " + item.error)+'</span></div>'); });
    (result.recommendations || []).forEach(function(msg){ html.push('<div class="bl2-log-item"><strong>Recomendación</strong><span>'+esc(msg)+'</span></div>'); });
    if(box){ box.innerHTML = html.join(""); }
    if(json){ json.textContent = JSON.stringify(result, null, 2); }
  }

  function runAndPaint(){
    var box = byId("bdl-performance-summary");
    if(box){ box.innerHTML = '<div class="bl2-empty">Ejecutando pruebas de rendimiento...</div>'; }
    return run().then(function(result){ paint(result); return result; }).catch(function(error){
      var result = { ok:false, error:error.message || String(error), checkedAt:new Date().toISOString() };
      if(box){ box.innerHTML = '<div class="bl2-empty">Error: '+esc(result.error)+'</div>'; }
      var json = byId("bdl-performance-json");
      if(json){ json.textContent = JSON.stringify(result, null, 2); }
      return result;
    });
  }

  function bind(){
    ensurePanel();
    var btn = byId("bdl-performance-run");
    if(btn && !btn.__bdlPerfBound){
      btn.__bdlPerfBound = true;
      btn.addEventListener("click", runAndPaint);
    }
    setTimeout(runAndPaint, 1600);
  }

  window.BDLPerformanceAudit = { version:VERSION, run:run, runAndPaint:runAndPaint, bind:bind };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(window, document);

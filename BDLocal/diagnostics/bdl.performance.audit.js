/* =========================================================
Nombre completo: bdl.performance.audit.js
Ruta o ubicación: /BDLocal/diagnostics/bdl.performance.audit.js
Función o funciones:
- Auditar conteos, índices y consultas principales sin modificar datos.
- Detectar índices faltantes a partir de la configuración real.
- Exponer resultados al Centro de Control sin crear tarjetas externas.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.2.0-diagnostics-engine";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function nowMs(){ return window.performance && performance.now ? performance.now() : Date.now(); }
  function round(value){ return Math.round(Number(value || 0) * 100) / 100; }
  function db(){ return window.BL2DB || null; }
  function config(){ return window.BL2Config || {}; }

  function measure(label,fn){
    var started = nowMs();
    return Promise.resolve().then(fn).then(function(value){ return { label:label,ok:true,ms:round(nowMs() - started),value:value }; }).catch(function(error){ return { label:label,ok:false,ms:round(nowMs() - started),error:error.message || String(error) }; });
  }

  function physicalTables(){
    var current = db();
    var meta = current && typeof current.meta === "function" ? current.meta() : {};
    return Array.isArray(meta.stores) ? meta.stores.slice() : [];
  }

  function expectedIndexes(){
    var stores = config().stores || {};
    var source = config().dbV2 && config().dbV2.indexes || {};
    var output = {};
    Object.keys(source).forEach(function(key){
      var table = text(stores[key] || key);
      if(table){ output[table] = Array.isArray(source[key]) ? source[key].slice() : []; }
    });
    return output;
  }

  function countTable(name){
    var current = db();
    if(!current || typeof current.count !== "function"){ return Promise.resolve({ table:name,ok:false,count:0,ms:0,error:"BL2DB.count no disponible." }); }
    return measure("count " + name,function(){ return current.count(name); }).then(function(result){ return { table:name,ok:result.ok,count:Number(result.value || 0),ms:result.ms,error:result.error || "" }; });
  }

  function inspectIndexes(){
    var current = db();
    if(!current || typeof current.open !== "function"){ return Promise.resolve([]); }
    return current.open().then(function(nativeDb){
      var expected = expectedIndexes();
      var rows = [];
      Object.keys(expected).forEach(function(table){
        if(!nativeDb.objectStoreNames.contains(table)){
          expected[table].forEach(function(index){ rows.push({ table:table,index:index,ok:false,ms:0,error:"Tabla no disponible." }); });
          return;
        }
        var store = nativeDb.transaction([table],"readonly").objectStore(table);
        var actual = Array.prototype.slice.call(store.indexNames || []);
        expected[table].forEach(function(index){ rows.push({ table:table,index:index,ok:actual.indexOf(index) >= 0,ms:0,error:actual.indexOf(index) >= 0 ? "" : "Índice no creado." }); });
      });
      return rows;
    }).catch(function(error){ return [{ table:"IndexedDB",index:"open",ok:false,ms:0,error:error.message || String(error) }]; });
  }

  function activePeriod(){
    if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
      var period = window.BL2App.getSelectedPeriod();
      if(period && text(period.id)){ return Promise.resolve(period); }
    }
    if(window.BL2Core && typeof window.BL2Core.getActivePeriod === "function"){ return window.BL2Core.getActivePeriod(); }
    return Promise.resolve(null);
  }

  function service(name,method,args){
    args = args || [];
    var registry = window.BDLServices;
    var api = null;
    try{ api = registry && typeof registry.get === "function" ? registry.get(name) : null; }catch(error){}
    if(!api && name === "estudiantes"){ api = window.BDLServiceEstudiantes || null; }
    if(!api && name === "defensas"){ api = window.BDLServiceDefensas || null; }
    if(!api || typeof api[method] !== "function"){ return Promise.resolve({ service:name,method:method,ok:false,ms:0,error:"Servicio no disponible." }); }
    return measure(name + "." + method,function(){ return api[method].apply(api,args); }).then(function(result){
      var value = result.value || {};
      return { service:name,method:method,ok:result.ok,ms:result.ms,total:Number(value.total || value.filteredTotal || 0),rows:Array.isArray(value.rows) ? value.rows.length : Array.isArray(value.items) ? value.items.length : 0,error:result.error || "" };
    });
  }

  function serviceChecks(){
    return activePeriod().then(function(period){
      var periodoId = text(period && period.id);
      if(!periodoId){ return { periodoId:"",results:[],warning:"No hay período activo." }; }
      var options = { periodoId:periodoId,page:1,limit:25,filtros:{} };
      return Promise.all([
        service("estudiantes","page",[options]),
        service("defensas","getPage",[options])
      ]).then(function(results){ return { periodoId:periodoId,results:results }; });
    });
  }

  function recommendations(report){
    var list = [];
    var badIndexes = report.indexes.filter(function(item){ return !item.ok; });
    var slowCounts = report.counts.filter(function(item){ return item.ms > 500; });
    var slowServices = (report.services.results || []).filter(function(item){ return item.ms > 800; });
    if(badIndexes.length){ list.push("Índices faltantes: " + badIndexes.map(function(item){ return item.table + "." + item.index; }).join(", ") + "."); }
    if(slowCounts.length){ list.push("Conteos lentos: " + slowCounts.map(function(item){ return item.table + " (" + item.ms + " ms)"; }).join(", ") + "."); }
    if(slowServices.length){ list.push("Servicios lentos: " + slowServices.map(function(item){ return item.service + "." + item.method + " (" + item.ms + " ms)"; }).join(", ") + "."); }
    if(report.services.warning){ list.push(report.services.warning); }
    if(!list.length){ list.push("Los conteos, índices y servicios revisados responden correctamente."); }
    return list;
  }

  function run(){
    var tables = physicalTables();
    var report = { version:VERSION,checkedAt:new Date().toISOString(),counts:[],indexes:[],services:{ results:[] },recommendations:[] };
    return Promise.all([Promise.all(tables.map(countTable)),inspectIndexes(),serviceChecks()]).then(function(values){
      report.counts = values[0];
      report.indexes = values[1];
      report.services = values[2];
      report.ok = report.counts.every(function(item){ return item.ok; }) && report.indexes.every(function(item){ return item.ok; }) && (report.services.results || []).every(function(item){ return item.ok; });
      report.recommendations = recommendations(report);
      return report;
    });
  }

  window.BDLPerformanceAudit = {
    version:VERSION,
    run:run,
    runAndPaint:run,
    bind:function(){ return true; },
    expectedIndexes:expectedIndexes
  };

  try{ window.dispatchEvent(new CustomEvent("bdlocal:performance-audit-ready",{ detail:{ version:VERSION } })); }catch(error){}
})(window);

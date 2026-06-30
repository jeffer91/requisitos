(function(window){
  "use strict";

  var cfg = window.BDLConfig;
  var db = window.BDLDB;
  var T = window.BDLNormText;
  var K = window.BDLKeys;

  if(!cfg || !db || !T || !K){ throw new Error("BDLRepoBase requiere BDLConfig, BDLDB, BDLNormText y BDLKeys."); }

  function now(){ return new Date().toISOString(); }
  function asArray(value){ return Array.isArray(value) ? value : []; }
  function safeRow(row){ return row && typeof row === "object" ? row : {}; }
  function put(storeName, row){ return db.put(storeName, row); }
  function putAll(storeName, rows){
    rows = asArray(rows);
    var chain = Promise.resolve({ saved: 0, total: rows.length });
    rows.forEach(function(row){
      chain = chain.then(function(result){
        return db.put(storeName, row).then(function(){ result.saved += 1; return result; });
      });
    });
    return chain;
  }
  function remove(storeName, key){ return db.remove(storeName, key); }
  function get(storeName, id){ return db.get(storeName, id); }
  function list(storeName, options){ return db.list(storeName, options || {}); }
  function byIndex(storeName, indexName, value, options){ return db.list(storeName, Object.assign({}, options || {}, { index: indexName, value: value })); }
  function cacheClear(){ if(window.BDLCache && typeof window.BDLCache.clear === "function"){ window.BDLCache.clear(); } }
  function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(error){} }
  function result(ok, extra){ return Object.assign({ ok: !!ok, updatedAt: now() }, extra || {}); }

  window.BDLRepoBase = { now:now, asArray:asArray, safeRow:safeRow, put:put, putAll:putAll, remove:remove, get:get, list:list, byIndex:byIndex, cacheClear:cacheClear, emit:emit, result:result, stores:cfg.stores };
})(window);

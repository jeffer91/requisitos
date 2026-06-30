(function(window){
  "use strict";

  function ok(name, condition){
    return { name:name, ok:!!condition, detail:condition ? "OK" : "FALLA" };
  }

  function has(name){ return ok("Existe " + name, !!window[name]); }

  function run(){
    var checks = [
      has("BDLConfig"),
      has("BDLSchema"),
      has("BDLDB"),
      has("BDLNormEstudiante"),
      has("BDLRepoEstudiantes"),
      has("BDLRepoDashboard"),
      has("CargaApp"),
      has("BDLSync"),
      has("BDLDiagnostics")
    ];

    var chain = Promise.resolve();

    if(window.BDLDB && typeof window.BDLDB.open === "function"){
      chain = chain.then(function(){
        return window.BDLDB.open().then(function(){
          checks.push(ok("IndexedDB abre correctamente", true));
        }).catch(function(error){
          checks.push({ name:"IndexedDB abre correctamente", ok:false, detail:error && error.message ? error.message : String(error) });
        });
      });
    }

    if(window.BDLRepoEstudiantes && window.BDLTestData){
      chain = chain.then(function(){
        return window.BDLRepoEstudiantes.guardarMuchos(window.BDLTestData.clone()).then(function(result){
          checks.push(ok("Carga de datos de prueba", result && result.saved === 2));
        }).catch(function(error){
          checks.push({ name:"Carga de datos de prueba", ok:false, detail:error && error.message ? error.message : String(error) });
        });
      });
    }

    return chain.then(function(){
      var result = {
        ok: checks.every(function(item){ return item.ok; }),
        checks: checks,
        at: new Date().toISOString()
      };
      try{ window.dispatchEvent(new CustomEvent("bdlocal:smoke-test", { detail:result })); }catch(error){}
      if(window.console){ console.table(checks); }
      return result;
    });
  }

  window.BDLSmokeTest = { run: run };
})(window);

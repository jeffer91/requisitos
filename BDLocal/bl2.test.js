/* =========================================================
Archivo: bl2.test.js
Ruta: /BDLocal/bl2.test.js
Función:
- Ejecutar pruebas rápidas de BL2.
- Verificar IndexedDB, período activo, guardado, búsqueda,
  requisitos, cambios pendientes, respaldo y sincronización.
- No depende de Firebase ni Google Sheets para aprobar prueba local.
========================================================= */
(function(window){
  "use strict";

  var config = window.BL2Config || {};
  var db = window.BL2DB;
  var core = window.BL2Core;
  var backup = window.BL2Backup;
  var stores = config.stores || {};
  var utils = config.utils || {};

  var state = {
    running: false,
    lastResult: null
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function nowISO(){
    return utils.nowISO ? utils.nowISO() : new Date().toISOString();
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    return JSON.parse(JSON.stringify(value));
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, {
        detail: clone(detail || {})
      }));
    }catch(error){}
  }

  function ok(name, message, payload){
    return {
      ok: true,
      level: "ok",
      name: name,
      message: message || "Correcto",
      payload: payload || null,
      at: nowISO()
    };
  }

  function warn(name, message, payload){
    return {
      ok: true,
      level: "warn",
      name: name,
      message: message || "Advertencia",
      payload: payload || null,
      at: nowISO()
    };
  }

  function bad(name, message, payload){
    return {
      ok: false,
      level: "bad",
      name: name,
      message: message || "Error",
      payload: payload || null,
      at: nowISO()
    };
  }

  function safe(name, fn){
    return Promise.resolve()
      .then(fn)
      .catch(function(error){
        return bad(name, error && error.message ? error.message : String(error));
      });
  }

  function requireModules(){
    var missing = [];

    if(!window.BL2Config){ missing.push("BL2Config"); }
    if(!window.BL2DB){ missing.push("BL2DB"); }
    if(!window.BL2Import){ missing.push("BL2Import"); }
    if(!window.BL2Core){ missing.push("BL2Core"); }
    if(!window.BL2Backup){ missing.push("BL2Backup"); }
    if(!window.BL2Sync){ missing.push("BL2Sync"); }
    if(!window.BDLocal){ missing.push("BDLocal compat"); }

    if(missing.length){
      return Promise.resolve(bad("Módulos cargados", "Faltan módulos: " + missing.join(", "), { missing: missing }));
    }

    return Promise.resolve(ok("Módulos cargados", "Todos los módulos principales están disponibles."));
  }

  function testDBOpen(){
    return db.open().then(function(){
      return ok("IndexedDB", "BL2 abrió correctamente.", {
        dbName: config.dbName,
        version: config.dbVersion
      });
    });
  }

  function testBasePeriods(){
    return core.getPeriods().then(function(periods){
      if(!periods.length){
        return bad("Períodos base", "No existen períodos disponibles.");
      }

      return ok("Períodos base", "Períodos disponibles: " + periods.length, {
        total: periods.length
      });
    });
  }

  function testActivePeriod(){
    return core.getActivePeriod().then(function(period){
      if(!period || !text(period.id)){
        return bad("Período activo", "No existe período activo.");
      }

      return ok("Período activo", "Período activo: " + (period.label || period.id), period);
    });
  }

  function testCedulaNineDigits(){
    var normalized = window.BL2Import.normalizeCedula("987654321");

    if(normalized !== "0987654321"){
      return Promise.resolve(bad("Cédula 9 dígitos", "No agregó 0 inicial.", {
        expected: "0987654321",
        received: normalized
      }));
    }

    return Promise.resolve(ok("Cédula 9 dígitos", "Corrige 9 dígitos agregando 0 inicial.", {
      received: normalized
    }));
  }

  function testSaveAndFindStudent(){
    var periodoId = "TEST-2026-01__2026-02";
    var periodoLabel = "Período de Prueba BL2";

    var rows = [
      {
        numeroIdentificacion: "999999991",
        Nombres: "ESTUDIANTE PRUEBA BL2",
        CodigoCarrera: "TEST-001",
        NombreCarrera: "CARRERA DE PRUEBA",
        Sede: "Matriz",
        Modalidad: "Presencial",
        Academico: "CUMPLE",
        Financiero: "NO CUMPLE",
        Documentacion: "PENDIENTE",
        Celular: "0999999999",
        CorreoPersonal: "prueba@example.com"
      }
    ];

    return core.saveStudents(rows, {
      periodoId: periodoId,
      periodoLabel: periodoLabel
    }).then(function(summary){
      return core.getStudentByCedula("0999999991", periodoId).then(function(student){
        if(!student){
          return bad("Guardar y buscar estudiante", "No se encontró el estudiante guardado.", summary);
        }

        if(student.cedula !== "0999999991"){
          return bad("Guardar y buscar estudiante", "La cédula no se normalizó correctamente.", student);
        }

        return ok("Guardar y buscar estudiante", "El estudiante fue guardado y encontrado.", {
          summary: summary,
          student: student
        });
      });
    });
  }

  function testRequirements(){
    var periodoId = "TEST-2026-01__2026-02";

    return core.getRequirements({
      periodoId: periodoId,
      cedula: "0999999991"
    }).then(function(reqs){
      if(!reqs || reqs.length < 3){
        return bad("Requisitos", "No se guardaron los requisitos detectados.", {
          total: reqs ? reqs.length : 0,
          requisitos: reqs
        });
      }

      return ok("Requisitos", "Requisitos detectados y guardados: " + reqs.length, {
        total: reqs.length
      });
    });
  }

  function testPendingChanges(){
    var periodoId = "TEST-2026-01__2026-02";

    return core.getPendingChanges("google", periodoId).then(function(changes){
      if(!changes.length){
        return warn("Cambios pendientes", "No se encontraron cambios pendientes para Google.");
      }

      return ok("Cambios pendientes", "Cambios pendientes detectados: " + changes.length, {
        total: changes.length
      });
    });
  }

  function testSummary(){
    var periodoId = "TEST-2026-01__2026-02";

    return core.getSummary(periodoId).then(function(summary){
      if(!summary || Number(summary.totalEstudiantes || 0) < 1){
        return bad("Resumen", "El resumen no calculó estudiantes.", summary);
      }

      return ok("Resumen", "Resumen calculado correctamente.", summary);
    });
  }

  function testBackupPayload(){
    if(!backup || typeof backup.createPayload !== "function"){
      return Promise.resolve(warn("Respaldo", "BL2Backup no está disponible."));
    }

    return backup.createPayload({
      scope: "period",
      periodoId: "TEST-2026-01__2026-02",
      periodoLabel: "Período de Prueba BL2",
      type: "test"
    }).then(function(payload){
      if(!payload || !payload.tables){
        return bad("Respaldo", "No se creó payload de respaldo.");
      }

      return ok("Respaldo", "Payload de respaldo creado correctamente.", {
        summary: payload.summary
      });
    });
  }

  function testCompat(){
    if(!window.BDLocal || !window.BL2DataEngine){
      return Promise.resolve(bad("Compatibilidad", "No existen aliases de compatibilidad."));
    }

    return window.BDLocal.getStudents({
      periodoId: "TEST-2026-01__2026-02"
    }).then(function(rows){
      if(!Array.isArray(rows)){
        return bad("Compatibilidad", "BDLocal.getStudents no devolvió arreglo.");
      }

      return ok("Compatibilidad", "Aliases compatibles funcionando.", {
        rows: rows.length
      });
    });
  }

  function buildSummary(results){
    var summary = {
      ok: true,
      total: results.length,
      passed: 0,
      warned: 0,
      failed: 0,
      status: "ok",
      message: "Prueba BL2 correcta."
    };

    results.forEach(function(item){
      if(item.level === "bad" || item.ok === false){
        summary.failed += 1;
      }else if(item.level === "warn"){
        summary.warned += 1;
      }else{
        summary.passed += 1;
      }
    });

    if(summary.failed){
      summary.ok = false;
      summary.status = "bad";
      summary.message = "BL2 tiene pruebas fallidas.";
    }else if(summary.warned){
      summary.status = "warn";
      summary.message = "BL2 funciona con advertencias.";
    }

    return summary;
  }

  function run(options){
    options = options || {};

    if(state.running){
      return Promise.resolve({
        ok: true,
        running: true,
        message: "La prueba BL2 ya está en ejecución."
      });
    }

    state.running = true;

    emit("bl2:test-start", {
      at: nowISO()
    });

    var tests = [
      function(){ return requireModules(); },
      function(){ return safe("IndexedDB", testDBOpen); },
      function(){ return safe("Inicialización", function(){ return core.init().then(function(){ return ok("Inicialización", "BL2 inicializó correctamente."); }); }); },
      function(){ return safe("Períodos base", testBasePeriods); },
      function(){ return safe("Período activo", testActivePeriod); },
      function(){ return safe("Cédula 9 dígitos", testCedulaNineDigits); },
      function(){ return safe("Guardar y buscar estudiante", testSaveAndFindStudent); },
      function(){ return safe("Requisitos", testRequirements); },
      function(){ return safe("Cambios pendientes", testPendingChanges); },
      function(){ return safe("Resumen", testSummary); },
      function(){ return safe("Respaldo", testBackupPayload); },
      function(){ return safe("Compatibilidad", testCompat); }
    ];

    var results = [];
    var chain = Promise.resolve();

    tests.forEach(function(test){
      chain = chain.then(function(){
        return test().then(function(result){
          results.push(result);
          emit("bl2:test-step", result);
        });
      });
    });

    return chain.then(function(){
      var report = {
        ok: true,
        generatedAt: nowISO(),
        summary: buildSummary(results),
        results: results
      };

      report.ok = report.summary.ok;

      state.running = false;
      state.lastResult = clone(report);

      emit("bl2:test-finish", report);

      if(options.log !== false){
        console.group("[BL2 Test]");
        console.log(report);
        console.groupEnd();
      }

      return report;
    }).catch(function(error){
      var report = {
        ok: false,
        generatedAt: nowISO(),
        summary: {
          ok: false,
          status: "bad",
          message: error && error.message ? error.message : String(error)
        },
        results: results
      };

      state.running = false;
      state.lastResult = clone(report);

      emit("bl2:test-error", report);

      return report;
    });
  }

  function getLastResult(){
    return clone(state.lastResult);
  }

  window.BL2Test = {
    run: run,
    runAll: run,
    print: function(){
      return run({
        log: true
      });
    },
    getLastResult: getLastResult
  };
})(window);
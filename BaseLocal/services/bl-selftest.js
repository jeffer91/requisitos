/* =========================================================
Nombre completo: bl-selftest.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-selftest.js
Función o funciones:
- Probar reglas críticas de Base Local sin tocar datos reales.
- Validar ACTIVO, RETIRADO, reactivación, cambio de período y parche controlado.
- Agregar un botón de prueba en la pantalla Base Local.
Con qué se conecta:
- bl-matricula.service.js
- bl-firestore-patch.js
- bl-healthcheck.js
- baselocal.html
========================================================= */
(function(window,document){
  "use strict";

  var KEY = "REQ_BL_SELFTEST_LAST";

  function now(){return new Date().toISOString();}
  function text(value){return String(value == null ? "" : value).trim();}
  function ok(name, pass, detail){return {name:name, pass:!!pass, detail:detail || ""};}

  function period(id,label){return {id:id, label:label || id, periodoId:id, periodoLabel:label || id};}
  function student(cedula,nombres,extra){return Object.assign({cedula:cedula, numeroIdentificacion:cedula, Nombres:nombres || cedula, NombreCarrera:"PRUEBA", estadoMatricula:"ACTIVO"}, extra || {});}

  function requireService(name){
    if(!window[name]){throw new Error("Servicio no cargado: " + name);}
    return window[name];
  }

  function save(result){
    try{window.localStorage.setItem(KEY, JSON.stringify(result));}catch(error){}
    window.BL_SELFTEST_LAST = result;
    return result;
  }

  function read(){
    if(window.BL_SELFTEST_LAST){return window.BL_SELFTEST_LAST;}
    try{var raw = window.localStorage.getItem(KEY);return raw ? JSON.parse(raw) : null;}catch(error){return null;}
  }

  function run(){
    var tests = [];
    var matricula = requireService("BLMatriculaService");
    var p1 = period("2025-11__2026-05", "Noviembre 2025 a Mayo 2026");
    var p2 = period("2026-04__2026-09", "Abril 2026 a Septiembre 2026");

    var snap = {students:[]};
    var r1 = matricula.reconcile(snap, [student("1000000001", "UNO"), student("1000000002", "DOS"), student("1000000003", "TRES")], p1);
    tests.push(ok("Carga inicial agrega estudiantes", r1.stats.added === 3 && r1.students.length === 3, JSON.stringify(r1.stats)));

    var r2 = matricula.reconcile({students:r1.students}, [student("1000000001", "UNO"), student("1000000002", "DOS")], p1);
    var retirado = r2.students.find(function(s){return s.cedula === "1000000003";});
    tests.push(ok("Desaparecido pasa a RETIRADO", !!retirado && retirado.estadoMatricula === "RETIRADO" && !!retirado.retiradoEn && r2.stats.retired === 1, JSON.stringify(r2.stats)));

    var r3 = matricula.reconcile({students:r2.students}, [student("1000000001", "UNO"), student("1000000002", "DOS"), student("1000000003", "TRES")], p1);
    var reactivado = r3.students.find(function(s){return s.cedula === "1000000003";});
    tests.push(ok("Retirado vuelve a ACTIVO", !!reactivado && reactivado.estadoMatricula === "ACTIVO" && r3.stats.reactivated === 1, JSON.stringify(r3.stats)));

    var r4 = matricula.reconcile({students:r3.students}, [student("1000000001", "UNO")], p2);
    var movido = r4.students.find(function(s){return s.cedula === "1000000001";});
    tests.push(ok("Cambio de período reemplaza anterior", !!movido && movido.periodoId === p2.id && movido.ultimoPeriodoId === p2.id && r4.stats.moved === 1, JSON.stringify(r4.stats)));

    if(window.BLFirestorePatch && typeof window.BLFirestorePatch.buildPatch === "function"){
      var patch = window.BLFirestorePatch.buildPatch(Object.assign({}, movido, {NombreCarrera:"NO_DEBE_SUBIR", CorreoPersonal:"no@debe.subir"}));
      tests.push(ok("Parche Firestore no sube campos sensibles", patch.NombreCarrera === undefined && patch.CorreoPersonal === undefined && patch.estadoMatricula === "ACTIVO", Object.keys(patch).join(", ")));
    }else{
      tests.push(ok("Parche Firestore disponible", false, "BLFirestorePatch no cargado"));
    }

    if(window.BLHealthCheck && typeof window.BLHealthCheck.serviceStatus === "function"){
      var services = window.BLHealthCheck.serviceStatus();
      tests.push(ok("Servicios principales cargados", !!services.BLCampos && !!services.BLMatriculaService && !!services.BLFirestorePatch, JSON.stringify(services)));
    }else{
      tests.push(ok("HealthCheck disponible", false, "BLHealthCheck no cargado"));
    }

    var failed = tests.filter(function(t){return !t.pass;});
    return save({ok:failed.length === 0, checkedAt:now(), total:tests.length, failed:failed.length, tests:tests});
  }

  function show(result){
    var box = document.getElementById("bl-diagnostics-box");
    if(box){
      box.textContent = JSON.stringify({selftest:result}, null, 2);
    }
    var status = document.getElementById("bl-status");
    if(status){
      status.textContent = result.ok ? "Prueba interna Base Local aprobada." : "Prueba interna Base Local con errores. Revisa Diagnóstico.";
      status.className = "bl-status " + (result.ok ? "bl-status-ok" : "bl-status-warn");
    }
  }

  function ensureButton(){
    var tools = document.querySelector(".bl-tools");
    if(!tools || document.getElementById("bl-btn-selftest")){return;}
    var btn = document.createElement("button");
    btn.id = "bl-btn-selftest";
    btn.type = "button";
    btn.textContent = "Probar Base Local";
    btn.addEventListener("click", function(){
      try{show(run());}
      catch(error){show(save({ok:false, checkedAt:now(), total:0, failed:1, error:error.message || String(error)}));}
    });
    tools.appendChild(btn);
  }

  function boot(){ensureButton();}
  if(document.readyState === "loading"){document.addEventListener("DOMContentLoaded", boot);}else{boot();}

  window.BLSelfTest = {run:run, read:read, show:show, key:KEY};
})(window,document);

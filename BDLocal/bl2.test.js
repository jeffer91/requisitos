/* =========================================================
Nombre completo: bl2.test.js
Ruta o ubicación: /BDLocal/bl2.test.js
Función o funciones:
- Ejecutar certificación integral sin escribir datos ni usar internet.
- Verificar arranque, tablas, registros, servicios y conectores.
- Comprobar identidad ecuatoriana, claves locales y separación Firebase.
- Certificar Telegram de solo lectura y mantenimientos manuales.
- Confirmar política manual, lote máximo y puerta única.
- Detectar duplicados lógicos en cambios_pendientes.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="4.0.0-final-certification";
  var state={running:false,lastResult:null};

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function db(){return window.BL2DB||null;}
  function core(){return window.BL2Core||null;}
  function config(){return window.BL2Config||{};}
  function result(name,level,message,payload){return {ok:level!=="bad",level:level,name:name,message:message,payload:payload||null,at:now()};}
  function ok(name,message,payload){return result(name,"ok",message,payload);}
  function warn(name,message,payload){return result(name,"warn",message,payload);}
  function bad(name,message,payload){return result(name,"bad",message,payload);}
  function safe(name,fn){return Promise.resolve().then(fn).catch(function(error){return bad(name,error&&error.message?error.message:String(error));});}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:clone(detail||{})}));}catch(error){}}
  function registryList(registry){try{return registry&&registry.list?registry.list():[];}catch(error){return [];}}
  function missing(existing,expected){return expected.filter(function(name){return existing.indexOf(name)<0;});}

  function activePeriod(){
    if(window.BL2App&&window.BL2App.getSelectedPeriod){var selected=window.BL2App.getSelectedPeriod();if(selected&&text(selected.id)){return Promise.resolve(selected);}}
    return core()&&core().getActivePeriod?core().getActivePeriod():Promise.resolve(null);
  }

  function prepareSupportModules(){
    var tasks=[];
    if(window.BDLSyncV2&&window.BDLSyncV2.loadExtraTargets){tasks.push(window.BDLSyncV2.loadExtraTargets().catch(function(){return null;}));}
    var fixups=window.BDLocalSyncFixups;
    if(fixups){
      if(fixups.loadTelegramModule){tasks.push(fixups.loadTelegramModule().catch(function(){return null;}));}
      if(fixups.loadFirebaseIdentityRepairModule){tasks.push(fixups.loadFirebaseIdentityRepairModule().catch(function(){return null;}));}
      if(fixups.loadLocalIdentityRepairModule){tasks.push(fixups.loadLocalIdentityRepairModule().catch(function(){return null;}));}
    }
    return Promise.all(tasks);
  }

  function checkModules(){
    return prepareSupportModules().then(function(){
      var required=[
        "BL2Config","BL2DB","BL2Core","BL2Backup","BL2App","BL2Test",
        "BDLRules","BDLRepositories","BDLServices","BDLocalConexiones",
        "BDLSyncTargets","BDLSyncOutbox","BDLSyncOrchestrator","BDLSyncV2",
        "BDLSyncUIBridge","BDLocalSyncFixups","BL2CloudPullSafe","BL2FirebaseGuard",
        "BDLSyncTargetFirebase","BDLFirebaseTelegramPull","BDLFirebaseIdentityRepair",
        "BDLLocalIdentityRepair"
      ];
      var absent=required.filter(function(name){return !window[name];});
      return absent.length
        ?bad("Módulos","Faltan módulos: "+absent.join(", "),{missing:absent})
        :ok("Módulos",required.length+" módulos principales disponibles.");
    });
  }

  function checkRegistries(){
    var rules=registryList(window.BDLRules);
    var repos=registryList(window.BDLRepositories);
    var services=registryList(window.BDLServices);
    var targets=registryList(window.BDLSyncTargets);
    var connectors=[];
    try{var status=window.BDLocalConexiones&&window.BDLocalConexiones.status?window.BDLocalConexiones.status():{};connectors=Array.isArray(status.connectors)?status.connectors:[];}catch(error){}
    var failures={
      rules:missing(rules,["periodo.require","persona.normalize","matricula.normalize","requisitos.extract","notas.normalize","duplicados.merge","retirados.detect","sync.change","errors.collect","pipeline.import.rows","pipeline.sync.changes"]),
      repositories:missing(repos,["periodos","estudiantes","personas","matriculas","requisitos","notas","contactos","cambios","logs","backups"]),
      services:missing(services,["periodos","estudiantes","ficha","defensas","tabla","stats","reportes","coordi"]),
      connectors:missing(connectors,["carga","tabla","ficha","stats","coordi","reportes","defensas","global"]),
      targets:missing(targets,["google","firebase","supabase"])
    };
    var failed=Object.keys(failures).filter(function(key){return failures[key].length;});
    return Promise.resolve(failed.length
      ?bad("Registros centrales","Faltan registros en: "+failed.join(", "),failures)
      :ok("Registros centrales","Registros principales completos.",{rules:rules.length,repositories:repos.length,services:services.length,connectors:connectors.length,targets:targets}));
  }

  function checkApp(){
    if(!window.BL2App||!window.BL2App.getState){return Promise.resolve(bad("Arranque","BL2App.getState no disponible."));}
    var app=window.BL2App.getState()||{};
    return Promise.resolve(app.ready&&app.scriptsReady
      ?ok("Arranque","Aplicación lista después de cargar scripts.",app)
      :bad("Arranque","La aplicación no está completamente lista.",app));
  }

  function checkDB(){
    if(!db()||!db().open){return Promise.resolve(bad("IndexedDB","BL2DB.open no disponible."));}
    return db().open().then(function(){var meta=db().meta?db().meta():{};return meta.open?ok("IndexedDB","Base abierta correctamente.",meta):bad("IndexedDB","La base no aparece abierta.",meta);});
  }

  function checkStores(){
    var meta=db()&&db().meta?db().meta():{};
    var actual=Array.isArray(meta.stores)?meta.stores:[];
    var map={};
    Object.keys(config().stores||{}).forEach(function(key){var name=text(config().stores[key]);if(name){map[name]=true;}});
    var expected=Object.keys(map);
    var absent=expected.filter(function(name){return actual.indexOf(name)<0;});
    return Promise.resolve(absent.length
      ?bad("Tablas físicas","Faltan tablas: "+absent.join(", "),{expected:expected,actual:actual})
      :ok("Tablas físicas",actual.length+" tablas disponibles.",{stores:actual}));
  }

  function checkQuery(){
    return activePeriod().then(function(period){
      if(!period||!text(period.id)){return warn("Consulta","No hay período activo.");}
      if(core()&&core().searchStudents){
        return core().searchStudents({periodoId:period.id,search:"",limit:1}).then(function(data){return ok("Consulta","Consulta respondió correctamente.",{periodoId:period.id,total:Number(data&&data.total||0)});});
      }
      return core()&&core().getStudents
        ?core().getStudents({periodoId:period.id,limit:1}).then(function(rows){return ok("Consulta","Consulta respondió correctamente.",{periodoId:period.id,rows:(rows||[]).length});})
        :Promise.resolve(bad("Consulta","No existe método de consulta."));
    });
  }

  function checkBackup(){
    var backup=window.BL2Backup;
    if(!backup||!backup.createPayload){return Promise.resolve(bad("Respaldo","BL2Backup.createPayload no disponible."));}
    return activePeriod()
      .then(function(period){return backup.createPayload(period&&period.id?{scope:"period",periodoId:period.id,periodoLabel:period.label,type:"diagnostic"}:{scope:"all",type:"diagnostic"});})
      .then(function(payload){var total=payload&&payload.tables?Object.keys(payload.tables).length:0;return total?ok("Respaldo","Payload generado sin descargar.",{tables:total}):bad("Respaldo","Payload sin tablas.");});
  }

  function checkIdentityRules(){
    var persona=window.BDLRulesPersona;
    var matricula=window.BDLRulesMatricula;
    var requisitos=window.BDLRulesRequisitos;
    var notas=window.BDLRulesNotas;
    var problems=[];
    var period="2026-04__2026-09";
    var corrected="0706175312";

    if(!persona||!persona.normalizeCedula||!persona.isValidEcuadorianCedula){problems.push("La regla central de identidad no está disponible.");}
    else{
      if(persona.normalizeCedula("706175312")!==corrected){problems.push("No completa correctamente el cero de una cédula ecuatoriana válida.");}
      if(persona.normalizeCedula("123456789")!=="123456789"){problems.push("Transforma una identificación de nueve dígitos no validada.");}
      if(persona.isValidEcuadorianCedula(corrected)!==true){problems.push("No valida la cédula ecuatoriana de control.");}
    }

    var localId=corrected+"__"+period;
    if(!matricula||matricula.makeId(period,corrected)!==localId){problems.push("Matrícula no usa cedula__periodoId.");}
    if(!requisitos||requisitos.studentId(period,corrected)!==localId){problems.push("Requisitos no usan cedula__periodoId.");}
    if(!notas||notas.makeId(period,corrected)!==localId){problems.push("Notas no usan cedula__periodoId.");}

    return Promise.resolve(problems.length
      ?bad("Identidad y claves locales",problems.join(" "))
      :ok("Identidad y claves locales","Cédulas validadas y clave local cedula__periodoId confirmada.",{sample:localId}));
  }

  function checkSyncPolicy(){
    var cfg=config();
    var policy=cfg.sync||{};
    var firebase=cfg.firebase||{};
    var problems=[];
    if(policy.manualOnly!==true||policy.automatic!==false){problems.push("La política general no es manual.");}
    if(policy.syncOnIdle!==false||policy.syncOnClose!==false){problems.push("Existe disparador automático externo.");}
    if(Number(policy.maxBatchSize||25)>25||Number(firebase.maxBatchSize||firebase.batchSize||25)>25){problems.push("Un lote supera 25.");}
    if(firebase.manualOnly!==true||firebase.automatic!==false){problems.push("Firebase académico no es manual.");}
    var fixups=window.BDLocalSyncFixups&&window.BDLocalSyncFixups.status?window.BDLocalSyncFixups.status():{};
    if(!fixups.installed||!fixups.manager||!fixups.legacy||!fixups.ui){problems.push("La puerta única está incompleta.");}
    return Promise.resolve(problems.length
      ?bad("Política de sincronización",problems.join(" "),{policy:policy,firebase:firebase,fixups:fixups})
      :ok("Política de sincronización","Escrituras externas manuales y máximo 25.",{fixups:fixups}));
  }

  function checkFirebaseSplit(){
    var firebase=config().firebase||{};
    var target=window.BDLSyncTargetFirebase;
    var guard=window.BL2FirebaseGuard;
    var problems=[];
    if(text(firebase.personCollection)!=="Estudiantes"){problems.push("La colección personal no es Estudiantes.");}
    if(text(firebase.academicCollection||firebase.collection)!=="EstudiantesPeriodo"){problems.push("La colección académica no es EstudiantesPeriodo.");}
    if(text(firebase.collection)!=="EstudiantesPeriodo"){problems.push("La colección de compatibilidad apunta al destino incorrecto.");}
    if(text(firebase.personDocumentIdStrategy)!=="cedula"){problems.push("Estudiantes no usa solo cédula como ID.");}
    if(text(firebase.academicDocumentIdStrategy||firebase.documentIdStrategy)!=="periodoId__cedula"){problems.push("EstudiantesPeriodo no usa período y cédula.");}
    if(!target||!target.documentId||!target.buildDocument||!target.stripTelegramFields){problems.push("El destino Firebase no expone controles académicos.");}

    var period="2026-01__2026-06";
    var cedula="0123456789";
    if(target){
      var academicId=target.documentId(period,cedula);
      if(academicId!==period+"__"+cedula){problems.push("El ID académico no es estable.");}
      var documentData=target.buildDocument({cedula:cedula,numeroIdentificacion:cedula,Nombres:"Estudiante de prueba",periodoId:period,telegramUser:"@usuario",telegramChatId:"123",chatId:"456",telegramUpdatedAt:now()},{cedula:cedula,periodoId:period,changeIds:["c1"]});
      ["telegramUser","telegramChatId","chatId","telegramUpdatedAt"].forEach(function(field){if(documentData&&Object.prototype.hasOwnProperty.call(documentData,field)){problems.push("El documento académico conserva "+field+".");}});
      if(target.academicCollectionName&&target.academicCollectionName()!=="EstudiantesPeriodo"){problems.push("El target escribe en una colección académica incorrecta.");}
    }
    if(guard&&guard.academicCollectionName&&guard.academicCollectionName()!=="EstudiantesPeriodo"){problems.push("La descarga académica consulta una colección incorrecta.");}
    if(guard&&guard.personCollectionName&&guard.personCollectionName()!=="Estudiantes"){problems.push("La colección personal del guard es incorrecta.");}

    return Promise.resolve(problems.length
      ?bad("Separación Firebase",problems.join(" "),{firebase:firebase})
      :ok("Separación Firebase","Estudiantes/{cedula} conserva persona/Telegram y EstudiantesPeriodo/{periodoId__cedula} conserva datos académicos.",{personCollection:"Estudiantes",personId:"cedula",academicCollection:"EstudiantesPeriodo",academicId:period+"__"+cedula,telegramExcluded:true}));
  }

  function checkTelegramPull(){
    var module=window.BDLFirebaseTelegramPull;
    var problems=[];
    if(!module){problems.push("El módulo Telegram no está disponible.");}
    else{
      if(module.collection!=="Estudiantes"){problems.push("Telegram no consulta Estudiantes.");}
      if(Number(module.maxReads)!==25){problems.push("Telegram no limita a 25 lecturas.");}
      if(module.writesFirebase!==false){problems.push("Telegram permite escrituras Firebase.");}
      if(module.createsOutbox!==false){problems.push("Telegram crea cola externa.");}
    }
    return Promise.resolve(problems.length
      ?bad("Telegram Firebase",problems.join(" "))
      :ok("Telegram Firebase","Descarga desde Estudiantes/{cedula}, máximo 25 lecturas, sin escrituras remotas ni cola."));
  }

  function checkMaintenanceSafety(){
    var firebaseRepair=window.BDLFirebaseIdentityRepair;
    var localRepair=window.BDLLocalIdentityRepair;
    var problems=[];
    if(!firebaseRepair){problems.push("Falta mantenimiento de identidades Firebase.");}
    else{
      if(firebaseRepair.writesAutomatic!==false){problems.push("La corrección Firebase permite escritura automática.");}
      if(firebaseRepair.createsOutbox!==false){problems.push("La corrección Firebase crea cola.");}
    }
    if(!localRepair){problems.push("Falta mantenimiento de identidades locales.");}
    else{
      if(localRepair.writesExternal!==false){problems.push("La corrección local permite escritura externa.");}
      if(localRepair.createsOutbox!==false){problems.push("La corrección local crea cola.");}
      if(localRepair.canonicalStudentId("0706175312","2026-04__2026-09")!=="0706175312__2026-04__2026-09"){problems.push("La corrección local usa una clave incorrecta.");}
    }
    return Promise.resolve(problems.length
      ?bad("Mantenimiento seguro",problems.join(" "))
      :ok("Mantenimiento seguro","Correcciones manuales, con clave canónica y sin sincronización externa automática."));
  }

  function checkQueue(){
    var current=db();
    var queue=window.BDLSyncOutbox;
    var storeName=text(config().stores&&config().stores.cambiosPendientes||"cambios_pendientes");
    if(!current||!current.getAll||!queue||!queue.logicalKey){return Promise.resolve(bad("Integridad de cola","No se puede analizar la cola."));}
    return activePeriod().then(function(period){
      return current.getAll(storeName).then(function(rows){
        rows=(rows||[]).filter(function(row){return !period||!period.id||!text(row.periodoId)||text(row.periodoId)===text(period.id);});
        var counts={};
        rows.forEach(function(row){var key=queue.logicalKey(row);counts[key]=(counts[key]||0)+1;});
        var duplicates=Object.keys(counts).filter(function(key){return counts[key]>1;});
        return duplicates.length
          ?bad("Integridad de cola",duplicates.length+" claves duplicadas.",{duplicates:duplicates.slice(0,20)})
          :ok("Integridad de cola",rows.length+" cambios revisados sin duplicados.");
      });
    });
  }

  function checkSheets(){
    var pull=window.BL2CloudPullSafe;
    var facade=window.BL2CloudPull;
    var problems=[];
    if(!pull||!pull.diagnostics){problems.push("La descarga segura no está disponible.");}
    if(!facade||facade.compatibilityOnly!==true){problems.push("La fachada antigua sigue activa.");}
    return Promise.resolve(problems.length?bad("Google Sheets seguro",problems.join(" ")):ok("Google Sheets seguro","Fachada única y descarga segura disponibles."));
  }

  function checkUI(){
    var collection=document.getElementById("bdlc-firebase-collection");
    var person=document.getElementById("bdlc-firebase-person-collection");
    var problems=[];
    if(collection&&collection.value!=="EstudiantesPeriodo"){problems.push("La interfaz muestra una colección académica incorrecta.");}
    if(collection&&!person){problems.push("La interfaz no muestra la colección personal.");}
    if(!window.BDLSyncUIBridge||window.BDLSyncUIBridge.__singleSyncGateInstalled!==true){problems.push("La interfaz no usa la puerta única.");}
    return Promise.resolve(problems.length?bad("Interfaz Firebase",problems.join(" ")):ok("Interfaz Firebase","La separación de colecciones y la puerta única se muestran correctamente."));
  }

  function summarize(results){
    var summary={ok:true,total:results.length,passed:0,warned:0,failed:0,status:"ok",message:"Certificación correcta y de solo lectura."};
    results.forEach(function(item){if(!item||item.level==="bad"||item.ok===false){summary.failed+=1;}else if(item.level==="warn"){summary.warned+=1;}else{summary.passed+=1;}});
    if(summary.failed){summary.ok=false;summary.status="bad";summary.message="BDLocal tiene controles fallidos.";}
    else if(summary.warned){summary.status="warn";summary.message="Controles superados con advertencias.";}
    return summary;
  }

  function run(options){
    options=options||{};
    if(state.running){return Promise.resolve({ok:true,running:true,message:"La certificación ya está en ejecución."});}
    state.running=true;
    emit("bl2:test-start",{at:now(),readOnly:true,network:false});

    var tests=[
      checkModules,checkRegistries,checkApp,checkDB,checkStores,checkQuery,checkBackup,
      checkIdentityRules,checkSyncPolicy,checkFirebaseSplit,checkTelegramPull,
      checkMaintenanceSafety,checkQueue,checkSheets,checkUI
    ];
    var results=[];
    var chain=Promise.resolve();
    tests.forEach(function(test){
      chain=chain.then(function(){return safe("Prueba",test).then(function(item){results.push(item);emit("bl2:test-step",item);});});
    });

    return chain.then(function(){
      var report={ok:true,readOnly:true,network:false,version:VERSION,generatedAt:now(),summary:summarize(results),results:results};
      report.ok=report.summary.ok;
      state.lastResult=clone(report);
      emit("bl2:test-finish",report);
      if(options.log!==false&&window.console){console.info("[BL2 Certificación]",report);}
      return report;
    }).finally(function(){state.running=false;});
  }

  window.BL2Test={
    version:VERSION,
    readOnly:true,
    network:false,
    run:run,
    runAll:run,
    print:function(){return run({log:true});},
    getLastResult:function(){return clone(state.lastResult);}
  };
})(window,document);

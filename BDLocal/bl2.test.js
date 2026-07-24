/* =========================================================
Nombre completo: bl2.test.js
Ruta: /BDLocal/bl2.test.js
Función:
- Ejecutar certificación integral sin escribir datos ni usar internet.
- Verificar arranque, IndexedDB, tablas, registros, servicios y conectores.
- Certificar la arquitectura Firebase V2 y sus identificadores.
- Confirmar sincronización manual, cola única y pantallas seguras.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="4.1.0-firebase-v2-runtime-certification";
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
  function registryList(registry){try{return registry&&typeof registry.list==="function"?registry.list():[];}catch(error){return [];}}
  function missing(existing,expected){existing=Array.isArray(existing)?existing:[];return expected.filter(function(name){return existing.indexOf(name)<0;});}
  function hasOwn(row,key){return !!row&&Object.prototype.hasOwnProperty.call(row,key);}

  function activePeriod(){
    try{
      if(window.RequisitosPeriodoGlobal&&typeof window.RequisitosPeriodoGlobal.get==="function"){
        var shared=window.RequisitosPeriodoGlobal.get();
        if(shared&&text(shared.id)){return Promise.resolve(shared);}
      }
    }catch(error){}
    if(window.BL2App&&typeof window.BL2App.getSelectedPeriod==="function"){
      var selected=window.BL2App.getSelectedPeriod();
      if(selected&&text(selected.id)){return Promise.resolve(selected);}
    }
    return core()&&typeof core().getActivePeriod==="function"?core().getActivePeriod():Promise.resolve(null);
  }

  function prepareSupportModules(){
    var tasks=[];
    if(window.BDLSharedArchitectureReady&&typeof window.BDLSharedArchitectureReady.then==="function"){
      tasks.push(window.BDLSharedArchitectureReady.catch(function(){return null;}));
    }
    if(window.BDLSyncV2&&typeof window.BDLSyncV2.loadExtraTargets==="function"){
      tasks.push(window.BDLSyncV2.loadExtraTargets().catch(function(){return null;}));
    }
    var fixups=window.BDLocalSyncFixups;
    if(fixups){
      if(typeof fixups.loadTelegramModule==="function"){tasks.push(fixups.loadTelegramModule().catch(function(){return null;}));}
      if(typeof fixups.loadFirebaseIdentityRepairModule==="function"){tasks.push(fixups.loadFirebaseIdentityRepairModule().catch(function(){return null;}));}
      if(typeof fixups.loadLocalIdentityRepairModule==="function"){tasks.push(fixups.loadLocalIdentityRepairModule().catch(function(){return null;}));}
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
        "BDLLocalIdentityRepair","RequisitosFirebaseSchema","RequisitosFirebaseIdentity",
        "RequisitosFirebaseMapper","RequisitosFirebaseRepository","RequisitosFirebaseSyncEngine"
      ];
      var absent=required.filter(function(name){return !window[name];});
      return absent.length
        ?bad("Módulos","Faltan módulos: "+absent.join(", "),{missing:absent})
        :ok("Módulos",required.length+" módulos principales y Firebase V2 disponibles.");
    });
  }

  function checkRegistries(){
    var rules=registryList(window.BDLRules);
    var repos=registryList(window.BDLRepositories);
    var services=registryList(window.BDLServices);
    var targets=registryList(window.BDLSyncTargets);
    var connectors=[];
    try{
      var status=window.BDLocalConexiones&&typeof window.BDLocalConexiones.status==="function"?window.BDLocalConexiones.status():{};
      connectors=Array.isArray(status.connectors)?status.connectors:[];
    }catch(error){}
    var failures={
      rules:missing(rules,["periodo.require","persona.normalize","matricula.normalize","requisitos.extract","notas.normalize","duplicados.merge","retirados.detect","sync.change","errors.collect","pipeline.import.rows","pipeline.sync.changes"]),
      repositories:missing(repos,["periodos","estudiantes","personas","matriculas","requisitos","notas","contactos","cambios","logs","backups","importaciones","cambios_pendientes","sync_estado"]),
      services:missing(services,["periodos","estudiantes","ficha","defensas","tabla","stats","reportes","coordi","ncomplex"]),
      connectors:missing(connectors,["carga","tabla","ficha","stats","coordi","reportes","defensas","global","ncomplex","inpvc","defart","cr_def"]),
      targets:missing(targets,["google","firebase","supabase"])
    };
    var failed=Object.keys(failures).filter(function(key){return failures[key].length;});
    return Promise.resolve(failed.length
      ?bad("Registros centrales","Faltan registros en: "+failed.join(", "),failures)
      :ok("Registros centrales","Registros principales completos.",{rules:rules.length,repositories:repos.length,services:services.length,connectors:connectors.length,targets:targets}));
  }

  function checkApp(){
    if(!window.BL2App||typeof window.BL2App.getState!=="function"){return Promise.resolve(bad("Arranque","BL2App.getState no disponible."));}
    var app=window.BL2App.getState()||{};
    var closing=/database connection is closing|conexi[oó]n.*cerrando/i.test(text(app.lastError));
    if(closing){return Promise.resolve(bad("Arranque","IndexedDB fue cerrado durante el arranque.",app));}
    return Promise.resolve(app.ready&&app.scriptsReady
      ?ok("Arranque","Aplicación lista después de cargar scripts.",app)
      :bad("Arranque","La aplicación no está completamente lista.",app));
  }

  function checkDB(){
    if(!db()||typeof db().open!=="function"){return Promise.resolve(bad("IndexedDB","BL2DB.open no disponible."));}
    return db().open().then(function(){
      var meta=typeof db().meta==="function"?db().meta():{};
      return meta.open?ok("IndexedDB","Base abierta correctamente.",meta):bad("IndexedDB","La base no aparece abierta.",meta);
    });
  }

  function checkStores(){
    var meta=db()&&typeof db().meta==="function"?db().meta():{};
    var actual=Array.isArray(meta.stores)?meta.stores:[];
    var expected=[];
    Object.keys(config().stores||{}).forEach(function(key){var name=text(config().stores[key]);if(name&&expected.indexOf(name)<0){expected.push(name);}});
    var absent=expected.filter(function(name){return actual.indexOf(name)<0;});
    return Promise.resolve(absent.length
      ?bad("Tablas físicas","Faltan tablas: "+absent.join(", "),{expected:expected,actual:actual})
      :ok("Tablas físicas",actual.length+" tablas disponibles.",{stores:actual}));
  }

  function checkQuery(){
    return activePeriod().then(function(period){
      if(!period||!text(period.id)){return warn("Consulta","No hay período activo en la base aislada.");}
      if(core()&&typeof core().searchStudents==="function"){
        return core().searchStudents({periodoId:period.id,search:"",limit:1}).then(function(data){return ok("Consulta","Consulta respondió correctamente.",{periodoId:period.id,total:Number(data&&data.total||0)});});
      }
      return core()&&typeof core().getStudents==="function"
        ?core().getStudents({periodoId:period.id,limit:1}).then(function(rows){return ok("Consulta","Consulta respondió correctamente.",{periodoId:period.id,rows:(rows||[]).length});})
        :Promise.resolve(bad("Consulta","No existe método de consulta."));
    });
  }

  function checkBackup(){
    var backup=window.BL2Backup;
    if(!backup||typeof backup.createPayload!=="function"){return Promise.resolve(bad("Respaldo","BL2Backup.createPayload no disponible."));}
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
    if(!persona||typeof persona.normalizeCedula!=="function"||typeof persona.isValidEcuadorianCedula!=="function"){problems.push("La regla central de identidad no está disponible.");}
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
    var schema=window.RequisitosFirebaseSchema||{};
    var problems=[];
    if(policy.manualOnly!==true||policy.automatic!==false){problems.push("La política general no es manual.");}
    if(policy.syncOnIdle!==false||policy.syncOnClose!==false){problems.push("Existe disparador automático externo.");}
    if(Number(policy.maxBatchSize||25)>25||Number(firebase.maxBatchSize||firebase.batchSize||25)>25){problems.push("Un lote supera 25.");}
    if(schema.architecture&&schema.architecture.sourceOfTruth!=="firebase"){problems.push("Firebase no está definido como fuente oficial.");}
    if(schema.architecture&&schema.architecture.localRole!=="cache"){problems.push("BDLocal no está definido como caché.");}
    var fixups=window.BDLocalSyncFixups&&typeof window.BDLocalSyncFixups.status==="function"?window.BDLocalSyncFixups.status():{};
    if(!fixups.installed||!fixups.manager||!fixups.legacy||!fixups.ui){problems.push("La puerta única está incompleta.");}
    return Promise.resolve(problems.length
      ?bad("Política de sincronización",problems.join(" "),{policy:policy,firebase:firebase,fixups:fixups})
      :ok("Política de sincronización","Firebase V2 es manual, diferencial y con máximo 25.",{fixups:fixups}));
  }

  function checkFirebaseV2(){
    var schema=window.RequisitosFirebaseSchema||{};
    var identity=window.RequisitosFirebaseIdentity||{};
    var mapper=window.RequisitosFirebaseMapper||{};
    var repository=window.RequisitosFirebaseRepository||{};
    var target=window.BDLSyncTargetFirebase||{};
    var problems=[];
    var expectedCollections=["estudiantes","matriculas","requisitos","notas","periodos","carreras","historial","importaciones"];
    var collections=schema.collections||{};
    expectedCollections.forEach(function(name){if(text(collections[name])!==name){problems.push("Falta la colección V2 "+name+".");}});

    var period="2026-01__2026-06";
    var cedula="0123456789";
    var localId=cedula+"__"+period;
    var remoteId=period+"__"+cedula;
    if(typeof identity.localStudentPeriodId!=="function"||identity.localStudentPeriodId(period,cedula)!==localId){problems.push("El ID local V2 no es estable.");}
    if(typeof identity.remoteStudentPeriodId!=="function"||identity.remoteStudentPeriodId(period,cedula)!==remoteId){problems.push("El ID remoto V2 no es estable.");}

    var bundle=null;
    if(typeof mapper.bundle!=="function"){problems.push("El mapeador V2 no expone bundle.");}
    else{
      bundle=mapper.bundle({
        periodoId:period,cedula:cedula,numeroIdentificacion:cedula,
        Nombres:"Estudiante de prueba",CodigoCarrera:"ENF",NombreCarrera:"ENFERMERÍA",
        estadoMatricula:"ACTIVO",telegramUser:"@usuario",telegramChatId:"123",
        Academico:"CUMPLE",Financiero:"CUMPLE",Notart:8,Notdef:9,Notafinal:8.3
      },{});
      if(!bundle||bundle.ok===false){problems.push("El mapeador no pudo formar el paquete V2.");}
    }

    if(bundle&&bundle.documents){
      ["matriculas","requisitos","notas"].forEach(function(entity){
        var doc=bundle.documents[entity]||{};
        ["telegramUser","telegramChatId","chatId","telegramUpdatedAt"].forEach(function(field){
          if(hasOwn(doc,field)){problems.push(entity+" conserva "+field+".");}
        });
      });
      if(typeof repository.documentId!=="function"){problems.push("El repositorio V2 no expone documentId.");}
      else{
        if(repository.documentId("estudiantes",bundle.documents.estudiantes)!==cedula){problems.push("estudiantes no usa cédula como ID.");}
        if(repository.documentId("matriculas",bundle.documents.matriculas)!==remoteId){problems.push("matriculas no usa periodoId__cedula.");}
        if(repository.documentId("requisitos",bundle.documents.requisitos)!==remoteId){problems.push("requisitos no usa periodoId__cedula.");}
        if(repository.documentId("notas",bundle.documents.notas)!==remoteId){problems.push("notas no usa periodoId__cedula.");}
      }
    }

    if(typeof target.push!=="function"||typeof target.entitiesFor!=="function"||typeof target.prepareEntries!=="function"){problems.push("El destino Firebase V2 no expone la puerta segura.");}
    return Promise.resolve(problems.length
      ?bad("Firebase V2",problems.join(" "),{collections:collections})
      :ok("Firebase V2","Ocho colecciones, IDs canónicos y documentos separados confirmados.",{collections:expectedCollections,localId:localId,remoteId:remoteId}));
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
    if(!current||typeof current.getAll!=="function"||!queue||typeof queue.logicalKey!=="function"){return Promise.resolve(bad("Integridad de cola","No se puede analizar la cola."));}
    return activePeriod().then(function(period){
      return current.getAll(storeName).then(function(rows){
        rows=(rows||[]).filter(function(row){return !period||!period.id||!text(row.periodoId)||text(row.periodoId)===text(period.id);});
        var counts={};
        rows.forEach(function(row){var logical=queue.logicalKey(row);counts[logical]=(counts[logical]||0)+1;});
        var duplicates=Object.keys(counts).filter(function(logical){return counts[logical]>1;});
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
    if(!pull||typeof pull.diagnostics!=="function"){problems.push("La descarga segura no está disponible.");}
    if(!facade||facade.compatibilityOnly!==true){problems.push("La fachada antigua sigue activa.");}
    return Promise.resolve(problems.length?bad("Google Sheets seguro",problems.join(" ")):ok("Google Sheets seguro","Fachada única y descarga segura disponibles."));
  }

  function checkUI(){
    var problems=[];
    if(!window.BDLSyncUIBridge||window.BDLSyncUIBridge.__singleSyncGateInstalled!==true){problems.push("La interfaz no usa la puerta única.");}
    if(!window.RequisitosFirebaseControlCenter){problems.push("El centro Firebase V2 no está disponible.");}
    if(!window.RequisitosFirebaseMigration){problems.push("La migración Firebase V2 no está disponible.");}
    return Promise.resolve(problems.length
      ?bad("Interfaz Firebase",problems.join(" "))
      :ok("Interfaz Firebase","Centro V2, migración segura y puerta única disponibles."));
  }

  function summarize(results){
    var summary={ok:true,total:results.length,passed:0,warned:0,failed:0,status:"ok",message:"Certificación correcta y de solo lectura."};
    results.forEach(function(item){
      if(!item||item.level==="bad"||item.ok===false){summary.failed+=1;}
      else if(item.level==="warn"){summary.warned+=1;}
      else{summary.passed+=1;}
    });
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
      checkIdentityRules,checkSyncPolicy,checkFirebaseV2,checkTelegramPull,
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

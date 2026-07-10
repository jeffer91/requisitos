/* =========================================================
Nombre completo: bl2.test.js
Ruta o ubicación: /BDLocal/bl2.test.js
Función o funciones:
- Ejecutar certificación integral sin escribir datos ni usar internet.
- Verificar arranque, tablas, registros, servicios y conectores.
- Comprobar política manual, lote máximo y puerta única.
- Certificar Estudiantes y EstudiantesPeriodo como colecciones separadas.
- Confirmar que documentos académicos nunca incluyen Telegram.
- Detectar duplicados lógicos en cambios_pendientes.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="3.2.0-firebase-split-certification";
  var state={running:false,lastResult:null};

  function text(v){return String(v==null?"":v).trim();}
  function now(){return new Date().toISOString();}
  function clone(v){try{return JSON.parse(JSON.stringify(v));}catch(e){return v;}}
  function db(){return window.BL2DB||null;}
  function core(){return window.BL2Core||null;}
  function config(){return window.BL2Config||{};}
  function result(name,level,message,payload){return {ok:level!=="bad",level:level,name:name,message:message,payload:payload||null,at:now()};}
  function ok(name,message,payload){return result(name,"ok",message,payload);}
  function warn(name,message,payload){return result(name,"warn",message,payload);}
  function bad(name,message,payload){return result(name,"bad",message,payload);}
  function safe(name,fn){return Promise.resolve().then(fn).catch(function(e){return bad(name,e&&e.message?e.message:String(e));});}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:clone(detail||{})}));}catch(e){}}
  function registryList(registry){try{return registry&&registry.list?registry.list():[];}catch(e){return [];}}
  function missing(existing,expected){return expected.filter(function(name){return existing.indexOf(name)<0;});}

  function activePeriod(){
    if(window.BL2App&&window.BL2App.getSelectedPeriod){var p=window.BL2App.getSelectedPeriod();if(p&&text(p.id)){return Promise.resolve(p);}}
    return core()&&core().getActivePeriod?core().getActivePeriod():Promise.resolve(null);
  }

  function prepareFirebaseTarget(){return window.BDLSyncV2&&window.BDLSyncV2.loadExtraTargets?window.BDLSyncV2.loadExtraTargets():Promise.resolve(window.BDLSyncTargetFirebase||null);}

  function checkModules(){
    return prepareFirebaseTarget().catch(function(){return null;}).then(function(){
      var required=["BL2Config","BL2DB","BL2Core","BL2Backup","BL2App","BL2Test","BDLRules","BDLRepositories","BDLServices","BDLocalConexiones","BDLSyncTargets","BDLSyncOutbox","BDLSyncOrchestrator","BDLSyncV2","BDLSyncUIBridge","BDLocalSyncFixups","BL2CloudPullSafe","BL2FirebaseGuard","BDLSyncTargetFirebase"];
      var absent=required.filter(function(name){return !window[name];});
      return absent.length?bad("Módulos","Faltan módulos: "+absent.join(", "),{missing:absent}):ok("Módulos",required.length+" módulos principales disponibles.");
    });
  }

  function checkRegistries(){
    var rules=registryList(window.BDLRules),repos=registryList(window.BDLRepositories),services=registryList(window.BDLServices),targets=registryList(window.BDLSyncTargets),connectors=[];
    try{var status=window.BDLocalConexiones&&window.BDLocalConexiones.status?window.BDLocalConexiones.status():{};connectors=Array.isArray(status.connectors)?status.connectors:[];}catch(e){}
    var failures={
      rules:missing(rules,["periodo.require","persona.normalize","matricula.normalize","requisitos.extract","notas.normalize","duplicados.merge","retirados.detect","sync.change","errors.collect","pipeline.import.rows","pipeline.sync.changes"]),
      repositories:missing(repos,["periodos","estudiantes","personas","matriculas","requisitos","notas","contactos","cambios","logs","backups"]),
      services:missing(services,["periodos","estudiantes","ficha","defensas","tabla","stats","reportes","coordi"]),
      connectors:missing(connectors,["carga","tabla","ficha","stats","coordi","reportes","defensas","global"]),
      targets:missing(targets,["google","firebase","supabase"])
    };
    var failed=Object.keys(failures).filter(function(k){return failures[k].length;});
    return Promise.resolve(failed.length?bad("Registros centrales","Faltan registros en: "+failed.join(", "),failures):ok("Registros centrales","Registros principales completos.",{rules:rules.length,repositories:repos.length,services:services.length,connectors:connectors.length,targets:targets}));
  }

  function checkApp(){
    if(!window.BL2App||!window.BL2App.getState){return Promise.resolve(bad("Arranque","BL2App.getState no disponible."));}
    var app=window.BL2App.getState()||{};
    return Promise.resolve(app.ready&&app.scriptsReady?ok("Arranque","Aplicación lista después de cargar scripts.",app):bad("Arranque","La aplicación no está completamente lista.",app));
  }

  function checkDB(){
    if(!db()||!db().open){return Promise.resolve(bad("IndexedDB","BL2DB.open no disponible."));}
    return db().open().then(function(){var meta=db().meta?db().meta():{};return meta.open?ok("IndexedDB","Base abierta correctamente.",meta):bad("IndexedDB","La base no aparece abierta.",meta);});
  }

  function checkStores(){
    var meta=db()&&db().meta?db().meta():{},actual=Array.isArray(meta.stores)?meta.stores:[],map={};
    Object.keys(config().stores||{}).forEach(function(k){var name=text(config().stores[k]);if(name){map[name]=true;}});
    var expected=Object.keys(map),absent=expected.filter(function(name){return actual.indexOf(name)<0;});
    return Promise.resolve(absent.length?bad("Tablas físicas","Faltan tablas: "+absent.join(", "),{expected:expected,actual:actual}):ok("Tablas físicas",actual.length+" tablas disponibles.",{stores:actual}));
  }

  function checkQuery(){
    return activePeriod().then(function(p){
      if(!p||!text(p.id)){return warn("Consulta","No hay período activo.");}
      if(core()&&core().searchStudents){return core().searchStudents({periodoId:p.id,search:"",limit:1}).then(function(data){return ok("Consulta","Consulta respondió correctamente.",{periodoId:p.id,total:Number(data&&data.total||0)});});}
      return core()&&core().getStudents?core().getStudents({periodoId:p.id,limit:1}).then(function(rows){return ok("Consulta","Consulta respondió correctamente.",{periodoId:p.id,rows:(rows||[]).length});}):Promise.resolve(bad("Consulta","No existe método de consulta."));
    });
  }

  function checkBackup(){
    var backup=window.BL2Backup;
    if(!backup||!backup.createPayload){return Promise.resolve(bad("Respaldo","BL2Backup.createPayload no disponible."));}
    return activePeriod().then(function(p){return backup.createPayload(p&&p.id?{scope:"period",periodoId:p.id,periodoLabel:p.label,type:"diagnostic"}:{scope:"all",type:"diagnostic"});}).then(function(payload){var total=payload&&payload.tables?Object.keys(payload.tables).length:0;return total?ok("Respaldo","Payload generado sin descargar.",{tables:total}):bad("Respaldo","Payload sin tablas.");});
  }

  function checkSyncPolicy(){
    var cfg=config(),policy=cfg.sync||{},firebase=cfg.firebase||{},problems=[];
    if(policy.manualOnly!==true||policy.automatic!==false){problems.push("La política general no es manual.");}
    if(policy.syncOnIdle!==false||policy.syncOnClose!==false){problems.push("Existe disparador automático.");}
    if(Number(policy.maxBatchSize||25)>25||Number(firebase.maxBatchSize||firebase.batchSize||25)>25){problems.push("Un lote supera 25.");}
    if(firebase.manualOnly!==true||firebase.automatic!==false){problems.push("Firebase no es manual.");}
    var fixups=window.BDLocalSyncFixups&&window.BDLocalSyncFixups.status?window.BDLocalSyncFixups.status():{};
    if(!fixups.installed||!fixups.manager||!fixups.legacy||!fixups.ui){problems.push("La puerta única está incompleta.");}
    return Promise.resolve(problems.length?bad("Política de sincronización",problems.join(" "),{policy:policy,firebase:firebase,fixups:fixups}):ok("Política de sincronización","Solo manual y máximo 25.",{fixups:fixups}));
  }

  function checkFirebaseSplit(){
    var firebase=config().firebase||{},target=window.BDLSyncTargetFirebase,guard=window.BL2FirebaseGuard,problems=[];
    if(text(firebase.personCollection)!=="Estudiantes"){problems.push("La colección personal no es Estudiantes.");}
    if(text(firebase.academicCollection||firebase.collection)!=="EstudiantesPeriodo"){problems.push("La colección académica no es EstudiantesPeriodo.");}
    if(text(firebase.collection)!=="EstudiantesPeriodo"){problems.push("La colección de compatibilidad apunta al destino incorrecto.");}
    if(text(firebase.personDocumentIdStrategy)!=="cedula"){problems.push("La persona no usa cédula como ID.");}
    if(text(firebase.academicDocumentIdStrategy||firebase.documentIdStrategy)!=="periodoId__cedula"){problems.push("El documento académico no usa período y cédula.");}
    if(!target||!target.documentId||!target.buildDocument||!target.stripTelegramFields){problems.push("El destino Firebase no expone controles académicos.");}

    var period="2026-01__2026-06",cedula="0123456789";
    if(target){
      var id=target.documentId(period,cedula);
      if(id!==period+"__"+cedula){problems.push("El ID académico no es estable.");}
      var doc=target.buildDocument({cedula:cedula,numeroIdentificacion:cedula,Nombres:"Estudiante de prueba",periodoId:period,telegramUser:"@usuario",telegramChatId:"123",chatId:"456",telegramUpdatedAt:now()},{cedula:cedula,periodoId:period,changeIds:["c1"]});
      ["telegramUser","telegramChatId","chatId","telegramUpdatedAt"].forEach(function(field){if(doc&&Object.prototype.hasOwnProperty.call(doc,field)){problems.push("El documento académico conserva "+field+".");}});
      if(target.academicCollectionName&&target.academicCollectionName()!=="EstudiantesPeriodo"){problems.push("El target escribe en una colección académica incorrecta.");}
    }
    if(guard&&guard.academicCollectionName&&guard.academicCollectionName()!=="EstudiantesPeriodo"){problems.push("La descarga consulta una colección incorrecta.");}
    if(guard&&guard.personCollectionName&&guard.personCollectionName()!=="Estudiantes"){problems.push("La colección personal del guard es incorrecta.");}

    return Promise.resolve(problems.length?bad("Separación Firebase",problems.join(" "),{firebase:firebase}):ok("Separación Firebase","Estudiantes conserva persona/Telegram y EstudiantesPeriodo conserva datos académicos.",{personCollection:"Estudiantes",academicCollection:"EstudiantesPeriodo",academicId:period+"__"+cedula,telegramExcluded:true}));
  }

  function checkQueue(){
    var current=db(),box=window.BDLSyncOutbox,storeName=text(config().stores&&config().stores.cambiosPendientes||"cambios_pendientes");
    if(!current||!current.getAll||!box||!box.logicalKey){return Promise.resolve(bad("Integridad de cola","No se puede analizar la cola."));}
    return activePeriod().then(function(p){return current.getAll(storeName).then(function(rows){rows=(rows||[]).filter(function(r){return !p||!p.id||!text(r.periodoId)||text(r.periodoId)===text(p.id);});var counts={};rows.forEach(function(r){var key=box.logicalKey(r);counts[key]=(counts[key]||0)+1;});var duplicates=Object.keys(counts).filter(function(k){return counts[k]>1;});return duplicates.length?bad("Integridad de cola",duplicates.length+" claves duplicadas.",{duplicates:duplicates.slice(0,20)}):ok("Integridad de cola",rows.length+" cambios revisados sin duplicados.");});});
  }

  function checkSheets(){
    var pull=window.BL2CloudPullSafe,facade=window.BL2CloudPull,problems=[];
    if(!pull||!pull.diagnostics){problems.push("La descarga segura no está disponible.");}
    if(!facade||facade.compatibilityOnly!==true){problems.push("La fachada antigua sigue activa.");}
    return Promise.resolve(problems.length?bad("Google Sheets seguro",problems.join(" ")):ok("Google Sheets seguro","Fachada única y descarga segura disponibles."));
  }

  function checkUI(){
    var collection=document.getElementById("bdlc-firebase-collection"),person=document.getElementById("bdlc-firebase-person-collection"),problems=[];
    if(collection&&collection.value!=="EstudiantesPeriodo"){problems.push("La interfaz muestra una colección académica incorrecta.");}
    if(collection&&!person){problems.push("La interfaz no muestra la colección personal.");}
    if(!window.BDLSyncUIBridge||window.BDLSyncUIBridge.__singleSyncGateInstalled!==true){problems.push("La interfaz no usa la puerta única.");}
    return Promise.resolve(problems.length?bad("Interfaz Firebase",problems.join(" ")):ok("Interfaz Firebase","La separación de colecciones se muestra correctamente."));
  }

  function summarize(results){
    var summary={ok:true,total:results.length,passed:0,warned:0,failed:0,status:"ok",message:"Certificación correcta y de solo lectura."};
    results.forEach(function(item){if(!item||item.level==="bad"||item.ok===false){summary.failed++;}else if(item.level==="warn"){summary.warned++;}else{summary.passed++;}});
    if(summary.failed){summary.ok=false;summary.status="bad";summary.message="BDLocal tiene controles fallidos.";}else if(summary.warned){summary.status="warn";summary.message="Controles superados con advertencias.";}return summary;
  }

  function run(options){
    options=options||{};if(state.running){return Promise.resolve({ok:true,running:true,message:"La certificación ya está en ejecución."});}
    state.running=true;emit("bl2:test-start",{at:now(),readOnly:true,network:false});
    var tests=[checkModules,checkRegistries,checkApp,checkDB,checkStores,checkQuery,checkBackup,checkSyncPolicy,checkFirebaseSplit,checkQueue,checkSheets,checkUI],results=[],chain=Promise.resolve();
    tests.forEach(function(fn){chain=chain.then(function(){return safe("Prueba",fn).then(function(item){results.push(item);emit("bl2:test-step",item);});});});
    return chain.then(function(){var report={ok:true,readOnly:true,network:false,version:VERSION,generatedAt:now(),summary:summarize(results),results:results};report.ok=report.summary.ok;state.lastResult=clone(report);emit("bl2:test-finish",report);if(options.log!==false&&window.console){console.info("[BL2 Certificación]",report);}return report;}).finally(function(){state.running=false;});
  }

  window.BL2Test={version:VERSION,readOnly:true,network:false,run:run,runAll:run,print:function(){return run({log:true});},getLastResult:function(){return clone(state.lastResult);}};
})(window,document);

/* =========================================================
Nombre completo: bl2.google-push.guard.js
Ruta o ubicación: /BDLocal/bl2.google-push.guard.js
Función o funciones:
- Mantener Firebase en modo exclusivamente manual.
- Leer datos académicos desde EstudiantesPeriodo.
- Excluir todos los campos Telegram de la descarga académica.
- Proteger cambios locales, crear respaldo y controlar cuota.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="4.2.0-academic-collection";
  var pulling=false;
  var installed=false;
  var TELEGRAM=["telegram","telegramUser","telegramUsername","usuarioTelegram","telegramChatId","chatIdTelegram","chatId","telegramUpdatedAt","telegramSource","telegramCheckedAt","telegramVerifiedAt","_telegramUser","_telegramChatId"];

  function text(v){return String(v==null?"":v).trim();}
  function now(){return new Date().toISOString();}
  function store(){return window.BDLocalConfigStore||null;}
  function core(){return window.BL2Core||null;}
  function sync(){return window.BL2Sync||null;}
  function manager(){return window.BDLocalSyncManager||null;}
  function outbox(){return window.BDLSyncOutbox||null;}
  function cfg(){return window.BL2Config&&window.BL2Config.firebase||{};}
  function academicCollection(){var c=cfg();return text(c.academicCollection||c.collection||"EstudiantesPeriodo")||"EstudiantesPeriodo";}
  function personCollection(){var c=cfg();return text(c.personCollection||c.telegramCollection||"Estudiantes")||"Estudiantes";}
  function cedula(v){var raw=text(v).replace(/[^0-9A-Za-z]/g,"");return /^\d{9}$/.test(raw)?"0"+raw:raw;}
  function period(v){v=text(v);var m=v.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return m?m[1]+"-"+m[2]+"__"+m[3]+"-"+m[4]:v.replace(/_+/g,"__");}
  function stripTelegram(row){row=Object.assign({},row||{});TELEGRAM.forEach(function(k){delete row[k];});return row;}
  function emitProgress(percent,message){try{window.dispatchEvent(new CustomEvent("bl2:sync-progress",{detail:{target:"firebase",percent:percent,detail:message,at:now()}}));}catch(e){}}
  function log(message,level,data){try{if(store()&&store().addLog){store().addLog("firebase_academic_guard",message,level||"success",data||{});}}catch(e){}}
  function blocked(message){return Promise.resolve({ok:true,skipped:true,blocked:true,target:"firebase",message:message});}

  function activePeriod(){
    try{if(window.BL2App&&window.BL2App.getSelectedPeriod){var p=window.BL2App.getSelectedPeriod();if(p&&text(p.id)){return Promise.resolve({id:period(p.id),label:text(p.label||p.id)});}}}catch(e){}
    return core()&&core().getActivePeriod?core().getActivePeriod().then(function(p){return p&&text(p.id)?{id:period(p.id),label:text(p.label||p.periodoLabel||p.id)}:null;}):Promise.resolve(null);
  }

  function requestManual(options){
    options=Object.assign({},options||{});
    if(options.manual!==true){return blocked("Solicitud automática bloqueada.");}
    if(!window.BDLSyncV2||!window.BDLSyncV2.request){return Promise.reject(new Error("BDLSyncV2 no está disponible."));}
    return (text(options.periodoId)?Promise.resolve({id:period(options.periodoId),label:text(options.periodoLabel||options.periodoId)}):activePeriod()).then(function(p){
      if(!p){throw new Error("Seleccione un período.");}
      return window.BDLSyncV2.request({manual:true,automatic:false,source:"BL2Sync.firebase.manual",targets:["firebase"],periodoId:p.id,periodoLabel:p.label,limit:Math.min(25,Math.max(1,Number(options.limit||25))),batchSize:Math.min(25,Math.max(1,Number(options.batchSize||25)))});
    });
  }

  function ensureFirebase(){return sync()&&sync().ensureFirebase?sync().ensureFirebase():Promise.reject(new Error("Firebase no está disponible."));}

  function readBudget(){
    if(!store()||!store().getFirebaseQuotaStatus){return {controlled:false,readLimit:500};}
    var first=store().getFirebaseQuotaStatus(1)||{};
    if(first.allowed===false){throw new Error("Lectura Firebase bloqueada por cuota manual.");}
    var all=store().loadConfig?store().loadConfig()||{}:{};
    var fc=all.firebase||{};
    var limit=Math.max(1,Number(first.limit||fc.dailyLimit||500));
    var used=Math.max(0,Number(first.used||0));
    var stop=Math.floor(limit*Math.max(1,Math.min(100,Number(fc.stopPercent||95)))/100);
    var available=Math.max(0,stop-used-1);
    if(available<1){throw new Error("No existe cuota segura para consultar Firebase.");}
    return {controlled:true,readLimit:Math.min(500,available),used:used,limit:limit,available:available};
  }

  function registerReads(n,label){try{if(store()&&store().registerFirebaseUsage){store().registerFirebaseUsage({reads:Number(n||0),label:label});}}catch(e){}}
  function time(row){var n=Date.parse(text(row&&(row.updatedAt||row.ultimaSincronizacion||row.createdAt)));return Number.isFinite(n)?n:0;}

  function readRemote(p){
    var budget;
    try{budget=readBudget();}catch(e){return Promise.reject(e);}
    return ensureFirebase().then(function(db){var q=db.collection(academicCollection()).where("periodoId","==",p.id);if(q.limit){q=q.limit(budget.readLimit);}return q.get();}).then(function(snapshot){
      registerReads(snapshot.size,"Lectura EstudiantesPeriodo "+p.id);
      var map={};var duplicates=0;
      snapshot.forEach(function(doc){
        var row=stripTelegram(doc.data()||{});var id=text(doc.id);var c=cedula(row.cedula||row.numeroIdentificacion||(id.indexOf(p.id+"__")===0?id.slice((p.id+"__").length):id));if(!c){return;}
        row.cedula=c;row.numeroIdentificacion=text(row.numeroIdentificacion||c);row.periodoId=p.id;row.periodoCanonicoId=p.id;row.periodoLabel=text(row.periodoLabel||row.periodoCanonicoLabel||p.label);row.firebaseDocumentId=id;row.firebaseCollection=academicCollection();row.source="firebase_academic_pull";
        if(map[c]){duplicates+=1;if(time(row)<time(map[c])){return;}}
        map[c]=row;
      });
      return {rows:Object.keys(map).map(function(k){return map[k];}),rawCount:Number(snapshot.size||0),duplicates:duplicates,truncated:!!(budget.controlled&&snapshot.size>=budget.readLimit),readLimit:budget.readLimit};
    });
  }

  function pendingMap(periodoId){
    if(!outbox()||!outbox().list){return Promise.resolve({});}
    return outbox().list({periodoId:periodoId}).then(function(rows){var map={};(rows||[]).forEach(function(r){var p=r.payload||{};var c=cedula(r.cedula||p.cedula||p.numeroIdentificacion);if(c){map[c]=true;}});return map;}).catch(function(){return {};});
  }

  function compare(local,remote){
    if(core()&&core().compareRecords){var result=core().compareRecords(local,remote);if(["remote","local","equal"].indexOf(result)>=0){return result;}}
    if(time(remote)>time(local)){return "remote";}if(time(local)>time(remote)){return "local";}return time(local)&&time(remote)?"equal":"ambiguous";
  }

  function preview(p){
    if(!core()||!core().getStudents){return Promise.reject(new Error("BL2Core.getStudents no está disponible."));}
    emitProgress(15,"Leyendo EstudiantesPeriodo...");
    return Promise.all([readRemote(p),core().getStudents({periodoId:p.id}),pendingMap(p.id)]).then(function(v){
      var remote=v[0],local=v[1]||[],pending=v[2]||{},localMap={},apply=[],equal=[],localNewer=[],conflict=[],ambiguous=[];
      local.forEach(function(r){var c=cedula(r.cedula||r.numeroIdentificacion);if(c){localMap[c]=r;}});
      remote.rows.forEach(function(r){var c=cedula(r.cedula||r.numeroIdentificacion);if(pending[c]){conflict.push(c);return;}if(!localMap[c]){apply.push(r);return;}var win=compare(localMap[c],r);if(win==="remote"){apply.push(r);}else if(win==="equal"){equal.push(c);}else if(win==="local"){localNewer.push(c);}else{ambiguous.push(c);}});
      return {ok:true,period:p,collection:academicCollection(),personCollection:personCollection(),rowsToApply:apply,remoteDocuments:remote.rawCount,remoteUnique:remote.rows.length,duplicateDocumentsIgnored:remote.duplicates,truncated:remote.truncated,readLimit:remote.readLimit,local:local.length,apply:apply.length,equal:equal.length,localNewer:localNewer.length,pendingConflict:conflict.length,ambiguous:ambiguous.length,telegramExcluded:true};
    });
  }

  function publicPreview(p){var copy=Object.assign({},p);delete copy.rowsToApply;copy.previewOnly=true;copy.message=p.truncated?"Lectura parcial por cuota; no puede aplicarse.":"Comparación EstudiantesPeriodo terminada sin modificar Telegram.";return copy;}
  function backup(p){var b=window.BL2BackupV2||window.BL2Backup;return b&&b.createBackup?b.createBackup({scope:"period",periodoId:p.id,periodoLabel:p.label,type:"pre_firebase_academic_pull"}):Promise.reject(new Error("No se pudo crear respaldo."));}

  function closeImported(changes){
    if(!changes||!changes.length||!outbox()||!outbox().markSynced){return Promise.resolve();}
    var chain=Promise.resolve();["firebase","google","supabase"].forEach(function(t){chain=chain.then(function(){return outbox().markSynced(changes,t,{syncedAt:now(),source:"firebase_academic_pull",imported:true});});});return chain;
  }

  function apply(p){
    if(p.truncated){return Promise.reject(new Error("No se aplicó una lectura parcial."));}
    if(!p.rowsToApply.length){var empty=publicPreview(p);empty.previewOnly=false;empty.applied=0;empty.message="No hay cambios académicos seguros.";return Promise.resolve(empty);}
    emitProgress(55,"Creando respaldo...");
    return backup(p.period).then(function(b){return core().saveStudents(p.rowsToApply,{normalized:true,periodoId:p.period.id,periodoLabel:p.period.label,source:"firebase_academic_pull",markRetired:false,sync:false,localOnly:true,cloudSync:false,manualCloudSync:true}).then(function(s){return closeImported(s.changes).then(function(){var r=publicPreview(p);r.previewOnly=false;r.applied=p.rowsToApply.length;r.summary=s;r.safetyBackupId=b&&b.record&&b.record.id||"";r.message="EstudiantesPeriodo aplicado. Telegram no fue modificado.";return r;});});});
  }

  function pull(periodInfo,options){
    options=options||{};if(pulling){return blocked("Ya existe una descarga Firebase en curso.");}pulling=true;window.BL2_FIREBASE_PULLING=true;
    return (periodInfo&&periodInfo.id?Promise.resolve({id:period(periodInfo.id),label:text(periodInfo.label||periodInfo.id)}):activePeriod()).then(function(p){if(!p){throw new Error("Seleccione un período.");}return preview(p).then(function(view){if(options.previewOnly){return publicPreview(view);}if(view.truncated){var partial=publicPreview(view);partial.blocked=true;partial.applied=0;return partial;}var approved=options.confirm===false||window.confirm("EstudiantesPeriodo → Base Local\n\nCambios seguros: "+view.apply+"\nTelegram no se modificará. ¿Continuar?");return approved?apply(view):Object.assign(publicPreview(view),{cancelled:true,previewOnly:false});});}).then(function(result){emitProgress(100,result.message||"Firebase académico procesado.");log(result.message||"Firebase académico procesado.",result.blocked?"warning":"success",result);return result;}).finally(function(){pulling=false;window.BL2_FIREBASE_PULLING=false;});
  }

  function install(){
    var m=manager();if(m){m.pullFirebaseToLocal=function(o){o=o||{};return pull(o.period||null,{confirm:o.confirm!==false,previewOnly:o.previewOnly===true});};m.__externalFirebasePullGuardInstalled=true;}
    var s=sync();if(s){s.maybeSyncFirebaseDaily=function(){return blocked("Sincronización diaria desactivada.");};s.syncBeforeClose=function(){return blocked("Sincronización al cerrar desactivada.");};s.syncFirebase=function(o){o=o||{};var a=text(o.action||"upload").toLowerCase();if(a==="compare"){return pull({id:o.periodoId,label:o.periodoLabel},{confirm:false,previewOnly:true});}if(a==="download"){return pull({id:o.periodoId,label:o.periodoLabel},{confirm:o.confirm!==false});}return requestManual(Object.assign({},o,{manual:o.manual===true}));};s.__externalSyncGuardInstalled=true;}
    installed=!!m&&!!s;return installed;
  }

  window.BL2GooglePushGuard={version:VERSION,manualOnly:true,singleGate:true,install:install,requestManualTarget:requestManual,status:function(){return {version:VERSION,installed:installed,singleGate:true,intervals:false,readQuota:true,academicCollection:academicCollection(),personCollection:personCollection(),telegramExcluded:true};}};
  window.BL2FirebaseGuard={version:VERSION,manualOnly:true,singleGate:true,install:install,pullFirebaseToLocal:pull,previewFirebase:function(p){return pull(p||null,{confirm:false,previewOnly:true});},documentId:function(p,c){return period(p)+"__"+cedula(c);},academicCollectionName:academicCollection,personCollectionName:personCollection,stripTelegramFields:stripTelegram,isPulling:function(){return pulling;},readBudget:readBudget,status:function(){return {version:VERSION,installed:installed,pulling:pulling,singleGate:true,readQuota:true,academicCollection:academicCollection(),personCollection:personCollection(),telegramExcluded:true};}};

  window.addEventListener("bdlocal:bl2-html-scripts-loaded",install,{once:true});
  if(!document.querySelector("script[data-bl2-loader-src]")){if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",install,{once:true});}else{install();}}
})(window,document);

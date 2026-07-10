/* =========================================================
Nombre completo: bdl.firebase.telegram-pull.js
Ruta o ubicación: /BDLocal/sync/bdl.firebase.telegram-pull.js
Función o funciones:
- Traer Telegram desde Firebase Estudiantes/{cedula} hacia Base Local.
- Ejecutar automáticamente una vez al día por período.
- Leer máximo 25 documentos por ejecución y respetar la cuota interna.
- Completar únicamente campos Telegram faltantes.
- Detectar conflictos sin sobrescribir valores locales.
- Registrar revisiones, progreso y cursor en sync_estado.
- No escribir en Firebase ni crear cambios_pendientes.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "1.0.0-auto-low-cost";
  var TARGET = "firebase_telegram_pull";
  var COLLECTION = "Estudiantes";
  var MAX_READS = 25;
  var RECHECK_DAYS = 7;
  var LOCK_MINUTES = 10;
  var running = false;
  var timer = null;
  var observer = null;
  var lastResult = null;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function today(){
    var date = new Date();
    return date.getFullYear() + "-" + String(date.getMonth()+1).padStart(2,"0") + "-" + String(date.getDate()).padStart(2,"0");
  }
  function clone(value){ try{return JSON.parse(JSON.stringify(value));}catch(error){return value;} }
  function config(){ return window.BL2Config || {}; }
  function db(){ return window.BL2DB || null; }
  function core(){ return window.BL2Core || null; }
  function repo(){ return window.BDLRepoContactos || window.BDLRepositories && window.BDLRepositories.get && window.BDLRepositories.get("contactos") || null; }
  function quotaStore(){ return window.BDLocalConfigStore || null; }
  function firebaseSync(){ return window.BL2Sync || null; }
  function stateStore(){ return config().stores && config().stores.syncEstado || "sync_estado"; }
  function stateId(periodoId){ return TARGET + "__" + text(periodoId); }

  function normalizeCedula(value){
    var rules = window.BDLRulesPersona;
    if(rules && rules.normalizeCedula){ return rules.normalizeCedula(value); }
    var raw = text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }
  function normalizeUser(value){
    var rules = window.BDLRulesPersona;
    return rules && rules.normalizeTelegramUser ? rules.normalizeTelegramUser(value) : text(value).replace(/^@+/,"").replace(/\s+/g,"");
  }
  function normalizeChatId(value){
    var rules = window.BDLRulesPersona;
    return rules && rules.normalizeTelegramChatId ? rules.normalizeTelegramChatId(value) : text(value).replace(/\s+/g,"");
  }
  function compactId(value){ return text(value).replace(/[^0-9A-Za-z_-]/g,""); }
  function currentPeriod(){
    try{
      if(window.BL2App && window.BL2App.getSelectedPeriod){
        var selected = window.BL2App.getSelectedPeriod();
        if(selected && text(selected.id)){ return Promise.resolve({id:text(selected.id),label:text(selected.label || selected.id)}); }
      }
    }catch(error){}
    return core() && core().getActivePeriod ? core().getActivePeriod() : Promise.resolve(null);
  }
  function emit(name,detail){
    try{ window.dispatchEvent(new CustomEvent(name,{detail:clone(detail || {})})); }catch(error){}
  }
  function progress(percent,message,detail){
    var payload=Object.assign({target:"telegram",percent:Math.max(0,Math.min(100,Number(percent||0))),detail:text(message),at:now()},detail||{});
    emit("bl2:sync-progress",payload);
    emit("bdlocal:telegram-pull-progress",payload);
  }
  function log(message,level,payload){
    try{
      if(core() && core().log){ core().log(level === "error" ? "ERROR" : level === "warn" ? "WARN" : "INFO",message,payload || {}).catch(function(){}); }
    }catch(error){}
  }
  function getState(periodoId){
    var current=db();
    if(!current || !current.get){ return Promise.resolve(null); }
    return current.get(stateStore(),stateId(periodoId)).catch(function(){return null;});
  }
  function saveState(periodoId,patch){
    var current=db();
    if(!current || !current.put){ return Promise.resolve(null); }
    return getState(periodoId).then(function(existing){
      var row=Object.assign({},existing || {},patch || {},{
        id:stateId(periodoId),target:TARGET,periodoId:text(periodoId),updatedAt:now()
      });
      return current.put(stateStore(),row);
    });
  }
  function lockActive(state){
    if(!state || text(state.status).toUpperCase() !== "RUNNING"){ return false; }
    var until=new Date(state.lockUntil || 0).getTime();
    return Number.isFinite(until) && until>Date.now();
  }
  function checkedRecently(value,days){
    var time=new Date(value || 0).getTime();
    if(!Number.isFinite(time) || time<=0){ return false; }
    return Date.now()-time < Number(days || RECHECK_DAYS)*86400000;
  }
  function localTelegram(row){
    row=row || {};
    return {
      user:normalizeUser(row.telegramUser || row._telegramUser || row.usuarioTelegram || row.telegram || ""),
      chatId:normalizeChatId(row.telegramChatId || row._telegramChatId || row.chatIdTelegram || row.chatId || ""),
      checkedAt:text(row.telegramCheckedAt || row.telegramRevisadoEn || "")
    };
  }
  function remoteIds(row){
    var values=[];
    function add(value){ value=compactId(value);if(value && values.indexOf(value)<0){values.push(value);} }
    add(row.numeroIdentificacion);
    add(row.cedula);
    var canonical=normalizeCedula(row.cedula || row.numeroIdentificacion);
    add(canonical);
    if(/^0\d{9}$/.test(canonical)){ add(canonical.slice(1)); }
    return values;
  }
  function candidates(rows,options){
    options=options || {};
    var map=Object.create(null);
    (rows || []).forEach(function(row){
      var cedula=normalizeCedula(row.cedula || row.numeroIdentificacion);
      if(!cedula || map[cedula]){ return; }
      var local=localTelegram(row);
      if(local.user && local.chatId){ return; }
      if(options.forceRecheck !== true && checkedRecently(local.checkedAt,RECHECK_DAYS)){ return; }
      map[cedula]={cedula:cedula,nombre:text(row.Nombres || row.nombres || row.nombreCompleto),row:row,local:local,remoteIds:remoteIds(row)};
    });
    return Object.keys(map).map(function(key){return map[key];}).sort(function(a,b){return text(a.nombre).localeCompare(text(b.nombre),"es",{sensitivity:"base"});});
  }
  function allowedReads(requested){
    requested=Math.min(MAX_READS,Math.max(0,Number(requested || MAX_READS)));
    var store=quotaStore();
    if(!store || !store.getFirebaseQuotaStatus){ return requested; }
    while(requested>0 && store.getFirebaseQuotaStatus(requested).allowed === false){ requested-=1; }
    return requested;
  }
  function registerReads(reads,label){
    var store=quotaStore();
    if(store && store.registerFirebaseUsage){ store.registerFirebaseUsage({reads:Number(reads || 0),writes:0,deletes:0,label:label || "Lectura Telegram Firebase."}); }
  }
  function ensureFirebase(){
    var sync=firebaseSync();
    return sync && sync.ensureFirebase ? sync.ensureFirebase() : Promise.reject(new Error("Firebase no está disponible."));
  }
  function readDocument(firestore,id){
    return firestore.collection(COLLECTION).doc(id).get().then(function(snapshot){
      return {ok:true,exists:!!snapshot.exists,id:id,data:snapshot.exists ? snapshot.data() || {} : null};
    }).catch(function(error){return {ok:false,exists:false,id:id,error:error.message || String(error)};});
  }
  function readCandidate(firestore,candidate,tracker,remainingCandidates){
    var ids=candidate.remoteIds.length ? candidate.remoteIds.slice() : [candidate.cedula];
    var primary=ids.shift();
    if(tracker.reads>=tracker.limit){ return Promise.resolve({candidate:candidate,exists:false,skipped:true}); }
    tracker.reads+=1;
    return readDocument(firestore,primary).then(function(result){
      if(result.exists || !ids.length){ return Object.assign(result,{candidate:candidate}); }
      var reserved=Math.max(0,Number(remainingCandidates || 0));
      if(tracker.reads+reserved>=tracker.limit){ return Object.assign(result,{candidate:candidate}); }
      tracker.reads+=1;
      return readDocument(firestore,ids[0]).then(function(fallback){return Object.assign(fallback,{candidate:candidate,fallback:true,primaryId:primary});});
    });
  }
  function compareField(localValue,remoteValue,type,conflicts){
    localValue=type === "user" ? normalizeUser(localValue) : normalizeChatId(localValue);
    remoteValue=type === "user" ? normalizeUser(remoteValue) : normalizeChatId(remoteValue);
    if(!remoteValue){ return {value:"",changed:false}; }
    if(!localValue){ return {value:remoteValue,changed:true}; }
    if(localValue===remoteValue){ return {value:"",changed:false}; }
    conflicts.push({field:type === "user" ? "telegramUser" : "telegramChatId",local:localValue,remote:remoteValue});
    return {value:"",changed:false};
  }
  function applyResult(item,summary,checkedAt){
    var candidate=item.candidate;
    var remote=item.exists ? item.data || {} : {};
    var conflicts=[];
    var userResult=compareField(candidate.local.user,remote.telegramUser || remote.usuarioTelegram || remote.telegram || "","user",conflicts);
    var chatResult=compareField(candidate.local.chatId,remote.telegramChatId || remote.chatIdTelegram || remote.chatId || "","chat",conflicts);
    var patch={
      cedula:candidate.cedula,
      telegramUser:userResult.value,
      telegramChatId:chatResult.value,
      telegramUpdatedAt:text(remote.telegramUpdatedAt || remote.updatedAt || remote.ultimaSincronizacion || checkedAt),
      telegramSource:"firebase:"+COLLECTION,
      telegramCheckedAt:checkedAt,
      telegramVerifiedAt:text(remote.telegramVerifiedAt || "")
    };
    if(conflicts.length){
      summary.conflicts.push({cedula:candidate.cedula,nombre:candidate.nombre,documentId:item.id || "",fields:conflicts});
    }
    if(item.exists){ summary.found+=1; }else{ summary.notFound+=1; }
    if(userResult.changed){ summary.usersImported+=1; }
    if(chatResult.changed){ summary.chatIdsImported+=1; }
    if(userResult.changed || chatResult.changed){ summary.updated+=1; }
    if(!repo() || !repo().saveTelegramForCedula){ return Promise.reject(new Error("Repositorio local de contactos no disponible.")); }
    return repo().saveTelegramForCedula(candidate.cedula,patch,{source:"firebase_telegram_pull",checkedAt:checkedAt,writeLegacy:true}).then(function(result){
      summary.localWrites+=Number(result && result.periodos || 0)+1;
      return result;
    });
  }
  function refreshScreens(){
    var hub=window.BDLocalConexiones;
    if(hub && hub.refreshCache){ return hub.refreshCache({force:true,light:true}).catch(function(){return null;}); }
    emit("bdlocal:screen-data-updated",{source:"firebase_telegram_pull",at:now()});
    return Promise.resolve(null);
  }

  function run(options){
    options=options || {};
    var automatic=options.automatic === true;
    var reason=text(options.reason || (automatic ? "automatic" : "manual"));
    if(running){ return Promise.resolve({ok:true,skipped:true,running:true,message:"La descarga Telegram ya está en ejecución."}); }
    if(typeof navigator !== "undefined" && navigator.onLine === false){ return Promise.resolve({ok:true,skipped:true,offline:true,message:"Sin conexión; Telegram se revisará más tarde."}); }

    return currentPeriod().then(function(period){
      if(!period || !text(period.id)){ throw new Error("Seleccione un período antes de traer Telegram."); }
      return getState(period.id).then(function(savedState){
        if(lockActive(savedState)){ return {skip:true,result:{ok:true,skipped:true,locked:true,message:"Existe otra revisión Telegram en curso."}}; }
        if(automatic && text(savedState && savedState.lastAutomaticDate)===today()){
          return {skip:true,result:{ok:true,skipped:true,alreadyToday:true,message:"Telegram ya se revisó automáticamente hoy para este período."}};
        }
        return {skip:false,period:period,state:savedState};
      });
    }).then(function(context){
      if(context.skip){ return context.result; }
      var period=context.period;
      running=true;
      var startedAt=now();
      var lockUntil=new Date(Date.now()+LOCK_MINUTES*60000).toISOString();
      emit("bdlocal:telegram-pull-start",{period:period,automatic:automatic,reason:reason,at:startedAt});
      progress(5,"Buscando estudiantes con Telegram incompleto...",{periodoId:period.id});

      return saveState(period.id,{status:"RUNNING",lockUntil:lockUntil,lastStartedAt:startedAt,lastReason:reason}).then(function(){
        if(!core() || !core().getStudents){ throw new Error("BL2Core.getStudents no está disponible."); }
        return core().getStudents({periodoId:period.id});
      }).then(function(rows){
        var pending=candidates(rows,{forceRecheck:options.forceRecheck === true});
        var readLimit=allowedReads(Math.min(MAX_READS,pending.length));
        if(readLimit<1){
          return {period:period,summary:{ok:true,skipped:true,quotaBlocked:true,automatic:automatic,reason:reason,periodoId:period.id,eligible:pending.length,reads:0,found:0,notFound:0,updated:0,usersImported:0,chatIdsImported:0,localWrites:0,conflicts:[],message:"Telegram no se consultó porque la cuota interna está protegida."}};
        }
        var selected=pending.slice(0,readLimit);
        var summary={ok:true,automatic:automatic,reason:reason,periodoId:period.id,periodoLabel:period.label,eligible:pending.length,selected:selected.length,reads:0,found:0,notFound:0,updated:0,usersImported:0,chatIdsImported:0,localWrites:0,conflicts:[],errors:[],collection:COLLECTION,maxReads:MAX_READS,startedAt:startedAt};
        if(!selected.length){ summary.skipped=true;summary.message="No hay estudiantes pendientes de revisión Telegram.";return {period:period,summary:summary}; }

        return ensureFirebase().then(function(firestore){
          var tracker={reads:0,limit:readLimit};
          var chain=Promise.resolve();
          selected.forEach(function(candidate,index){
            chain=chain.then(function(){
              var remaining=selected.length-index-1;
              progress(10+Math.round((index/Math.max(selected.length,1))*75),"Revisando Telegram: "+(index+1)+" de "+selected.length,{cedula:candidate.cedula});
              return readCandidate(firestore,candidate,tracker,remaining).then(function(item){
                if(item.error){ summary.errors.push({cedula:candidate.cedula,documentId:item.id,error:item.error}); }
                return applyResult(item,summary,now()).catch(function(error){summary.errors.push({cedula:candidate.cedula,error:error.message || String(error)});});
              });
            });
          });
          return chain.then(function(){
            summary.reads=tracker.reads;
            summary.finishedAt=now();
            summary.message="Telegram revisado: "+summary.reads+" lectura(s), "+summary.updated+" estudiante(s) actualizado(s), "+summary.conflicts.length+" conflicto(s).";
            registerReads(summary.reads,"Consulta automática/manual de Telegram en Estudiantes.");
            return {period:period,summary:summary};
          });
        });
      }).then(function(context){
        var summary=context.summary;
        lastResult=clone(summary);
        var statePatch={
          status:"IDLE",lockUntil:"",lastRunAt:now(),lastReason:reason,lastSummary:summary,
          lastAutomaticDate:automatic ? today() : text(context.state && context.state.lastAutomaticDate)
        };
        if(automatic){ statePatch.lastAutomaticDate=today(); }
        return saveState(context.period.id,statePatch).then(function(){
          return refreshScreens().then(function(){
            progress(100,summary.message || "Revisión Telegram finalizada.",{summary:summary});
            emit("bdlocal:telegram-pull-finished",summary);
            renderUI();
            log(summary.message || "Revisión Telegram finalizada.",summary.errors && summary.errors.length ? "warn" : "info",summary);
            return summary;
          });
        });
      }).catch(function(error){
        var periodId=text(window.BL2App && window.BL2App.getSelectedPeriod && window.BL2App.getSelectedPeriod().id);
        return saveState(periodId,{status:"ERROR",lockUntil:"",lastRunAt:now(),lastError:error.message || String(error)}).catch(function(){return null;}).then(function(){
          var failed={ok:false,automatic:automatic,reason:reason,error:error.message || String(error),message:"No se pudo traer Telegram: "+(error.message || String(error))};
          lastResult=failed;
          emit("bdlocal:telegram-pull-finished",failed);
          progress(0,failed.message);
          renderUI();
          return failed;
        });
      }).finally(function(){ running=false; });
    });
  }

  function runAutomatic(reason){ return run({automatic:true,reason:reason || "automatic"}); }
  function runManual(){
    if(!window.confirm("Traer Telegram desde Firebase\n\nSe leerán como máximo 25 documentos de Estudiantes y no se escribirá nada en Firebase. ¿Continuar?")){
      return Promise.resolve({ok:true,cancelled:true,message:"Revisión Telegram cancelada."});
    }
    return run({automatic:false,reason:"manual"});
  }
  function scheduleAutomatic(reason){
    window.clearTimeout(timer);
    timer=window.setTimeout(function(){ runAutomatic(reason).catch(function(){}); },1200);
  }

  function firebaseCard(){
    var cards=document.querySelectorAll(".bdlc-connection-card");
    for(var i=0;i<cards.length;i+=1){
      var title=cards[i].querySelector("h3");
      if(title && text(title.textContent)==="Firebase"){ return cards[i]; }
    }
    return null;
  }
  function renderUI(){
    var card=firebaseCard();
    if(!card){ return false; }
    var actions=card.querySelector(".bdlc-actions");
    if(actions && !document.getElementById("bl2-btn-pull-telegram")){
      var button=document.createElement("button");
      button.id="bl2-btn-pull-telegram";
      button.className="bdlc-button secondary";
      button.type="button";
      button.textContent="Traer Telegram";
      button.addEventListener("click",function(){
        button.disabled=true;
        runManual().then(function(result){
          if(window.BDLocalConfigUI && window.BDLocalConfigUI.notify && result && !result.cancelled){window.BDLocalConfigUI.notify(result.message || "Telegram procesado.",result.ok===false ? "error" : "success");}
        }).finally(function(){button.disabled=false;renderUI();});
      });
      actions.appendChild(button);
    }
    var status=card.querySelector("#bdlc-telegram-pull-status");
    if(!status){
      status=document.createElement("div");
      status.id="bdlc-telegram-pull-status";
      status.className="bdlc-alert info";
      status.style.marginTop="12px";
      card.appendChild(status);
    }
    var current=lastResult;
    if(running){status.textContent="Telegram: revisión en curso, máximo 25 lecturas.";}
    else if(current){status.textContent="Telegram: "+text(current.message || "última revisión registrada.");}
    else{status.textContent="Telegram: revisión automática diaria, solo faltantes, máximo 25 lecturas.";}
    return true;
  }

  function status(){
    return currentPeriod().then(function(period){
      if(!period || !period.id){return {ok:true,version:VERSION,running:running,period:null,lastResult:lastResult};}
      return getState(period.id).then(function(saved){return {ok:true,version:VERSION,running:running,period:period,state:saved,lastResult:lastResult,collection:COLLECTION,maxReads:MAX_READS,recheckDays:RECHECK_DAYS,automatic:true,writesFirebase:false,createsOutbox:false};});
    });
  }
  function diagnostics(){
    return Promise.all([currentPeriod(),status()]).then(function(values){
      var period=values[0],snapshot=values[1];
      if(!period || !period.id || !core() || !core().getStudents){return Object.assign({},snapshot,{eligible:0});}
      return core().getStudents({periodoId:period.id}).then(function(rows){return Object.assign({},snapshot,{students:(rows||[]).length,eligible:candidates(rows,{}).length});});
    });
  }
  function bind(){
    renderUI();
    if(window.MutationObserver && !observer){observer=new MutationObserver(function(){renderUI();});observer.observe(document.body,{childList:true,subtree:true});}
    window.addEventListener("bl2:ready",function(){renderUI();scheduleAutomatic("app_ready");});
    window.addEventListener("bl2:period-changed",function(){lastResult=null;renderUI();scheduleAutomatic("period_changed");});
    window.addEventListener("bl2:app-refreshed",renderUI);
    var appState=window.BL2App && window.BL2App.getState ? window.BL2App.getState() : null;
    if(appState && appState.ready){scheduleAutomatic("module_loaded");}
  }

  window.BDLFirebaseTelegramPull={
    version:VERSION,collection:COLLECTION,maxReads:MAX_READS,recheckDays:RECHECK_DAYS,
    run:run,runAutomatic:runAutomatic,runManual:runManual,scheduleAutomatic:scheduleAutomatic,
    status:status,diagnostics:diagnostics,renderUI:renderUI,candidates:candidates,remoteIds:remoteIds,
    isRunning:function(){return running;},getLastResult:function(){return clone(lastResult);},writesFirebase:false,createsOutbox:false
  };

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind,{once:true});}else{bind();}
})(window,document);

/* =========================================================
Nombre completo: stats.telegram.firebase-sync.js
Ruta: /Stats/stats.telegram.firebase-sync.js
Función:
- Sincronizar Telegram desde Firebase cuando se actualiza la sección Telegram de Stats.
- Leer únicamente telegramUser y telegramChatId de Estudiantes/{cedula}.
- Guardar los datos en contactos_estudiante sin sobrescribir valores locales.
- Refrescar completamente ConStats para que la cobertura se recalcule de inmediato.
- Evitar nuevas lecturas durante siete días cuando un estudiante ya fue revisado.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-stats-telegram-firebase";
  var COLLECTION="Estudiantes";
  var MAX_READS=1000;
  var RECHECK_DAYS=7;
  var BATCH_SIZE=12;
  var running=false;

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function delay(){return new Promise(function(resolve){window.setTimeout(resolve,0);});}

  function status(message,type){
    var node=document.getElementById("stats-status");
    if(!node){return;}
    node.textContent=text(message);
    node.className="stats-status "+(type||"");
  }

  function button(){return document.getElementById("stats-refresh");}

  function normalizeCedula(value){
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }

  function normalizeUser(value){return text(value).replace(/^@+/,"").replace(/\s+/g,"");}
  function normalizeChatId(value){return text(value).replace(/\s+/g,"");}

  function state(){
    if(window.StatsApp&&typeof window.StatsApp.getState==="function"){
      return window.StatsApp.getState()||{};
    }
    return {
      periodId:text(document.getElementById("stats-periodo")&&document.getElementById("stats-periodo").value),
      matricula:text(document.getElementById("stats-matricula")&&document.getElementById("stats-matricula").value)
    };
  }

  function activeSection(){
    try{
      if(window.StatsSections&&typeof window.StatsSections.current==="function"){
        return text(window.StatsSections.current());
      }
    }catch(error){}
    return text(window.location.hash).replace(/^#/,"");
  }

  function shouldIntercept(){
    var current=state();
    return !!text(current.periodId)&&(
      activeSection()==="stats-telegram-section"||
      text(current.requirementKey)==="telegram"
    );
  }

  function repo(){return window.BDLocalStats||window.ConStats||null;}
  function contactsRepo(){
    if(window.BDLRepoContactos){return window.BDLRepoContactos;}
    if(window.BDLRepositories&&typeof window.BDLRepositories.get==="function"){
      return window.BDLRepositories.get("contactos")||null;
    }
    return null;
  }
  function firebaseSync(){return window.BL2Sync||null;}
  function quotaStore(){return window.BDLocalConfigStore||null;}

  function localTelegram(row){
    row=row||{};
    var contact=row._contacto&&typeof row._contacto==="object"?row._contacto:{};
    return {
      user:normalizeUser(
        row._telegramUser||row.telegramUser||row.usuarioTelegram||row.telegram||
        contact.telegramUser||contact._telegramUser||contact.usuarioTelegram||contact.telegram||""
      ),
      chatId:normalizeChatId(
        row._telegramChatId||row.telegramChatId||row.chatIdTelegram||row.chatId||
        contact.telegramChatId||contact._telegramChatId||contact.chatIdTelegram||contact.chatId||""
      ),
      checkedAt:text(
        row.telegramCheckedAt||row.telegramRevisadoEn||
        contact.telegramCheckedAt||contact.telegramRevisadoEn||""
      )
    };
  }

  function checkedRecently(value){
    var time=new Date(value||0).getTime();
    return Number.isFinite(time)&&time>0&&Date.now()-time<RECHECK_DAYS*86400000;
  }

  function candidates(rows){
    var map=Object.create(null);
    (Array.isArray(rows)?rows:[]).forEach(function(row){
      row=row||{};
      var rawId=text(row.numeroIdentificacion||row.NumeroIdentificacion||row.cedula||row._cedula);
      var cedula=normalizeCedula(rawId);
      if(!cedula||map[cedula]){return;}
      var local=localTelegram(row);
      if(local.user&&local.chatId){return;}
      if(checkedRecently(local.checkedAt)){return;}
      map[cedula]={
        cedula:cedula,
        remoteId:rawId||cedula,
        nombre:text(row._nombres||row.Nombres||row.nombres||row.nombreCompleto),
        local:local
      };
    });
    return Object.keys(map).map(function(key){return map[key];});
  }

  function allowedReads(requested){
    requested=Math.min(MAX_READS,Math.max(0,Number(requested||0)));
    var store=quotaStore();
    if(!store||typeof store.getFirebaseQuotaStatus!=="function"){return requested;}
    while(requested>0){
      var snapshot;
      try{snapshot=store.getFirebaseQuotaStatus(requested);}catch(error){return 0;}
      if(!snapshot||snapshot.allowed!==false){break;}
      requested-=1;
    }
    return requested;
  }

  function registerReads(reads,periodId){
    var store=quotaStore();
    if(store&&typeof store.registerFirebaseUsage==="function"&&reads>0){
      store.registerFirebaseUsage({
        reads:Number(reads),
        writes:0,
        deletes:0,
        label:"Stats Telegram Firebase "+text(periodId)
      });
    }
  }

  function ensureFirebase(){
    var sync=firebaseSync();
    return sync&&typeof sync.ensureFirebase==="function"
      ?sync.ensureFirebase()
      :Promise.reject(new Error("Firebase no está disponible."));
  }

  function readRemote(firestore,item){
    var remoteId=text(item.remoteId)||item.cedula;
    return firestore.collection(COLLECTION).doc(remoteId).get().then(function(snapshot){
      if(snapshot.exists){return {exists:true,id:remoteId,data:snapshot.data()||{}};}
      if(remoteId!==item.cedula){
        return firestore.collection(COLLECTION).doc(item.cedula).get().then(function(fallback){
          return {exists:!!fallback.exists,id:item.cedula,data:fallback.exists?fallback.data()||{}:{},fallback:true,reads:2};
        });
      }
      return {exists:false,id:remoteId,data:{}};
    });
  }

  function saveResult(item,remote,summary){
    var local=item.local||{};
    var data=remote&&remote.data||{};
    var remoteUser=normalizeUser(data.telegramUser||data.usuarioTelegram||data.telegram||"");
    var remoteChat=normalizeChatId(data.telegramChatId||data.chatIdTelegram||data.chatId||"");
    var user=!local.user?remoteUser:"";
    var chatId=!local.chatId?remoteChat:"";
    var repository=contactsRepo();

    summary.reads+=Number(remote&&remote.reads||1);
    if(remote&&remote.exists){summary.found+=1;}else{summary.notFound+=1;}
    if(user){summary.usersImported+=1;}
    if(chatId){summary.chatIdsImported+=1;}
    if(user||chatId){summary.updated+=1;}

    if(!repository||typeof repository.saveTelegramForCedula!=="function"){
      return Promise.reject(new Error("Repositorio local de contactos no disponible."));
    }

    return repository.saveTelegramForCedula(
      item.cedula,
      {
        cedula:item.cedula,
        telegramUser:user,
        telegramChatId:chatId,
        telegramUpdatedAt:text(data.telegramUpdatedAt||data.updatedAt||data.ultimaSincronizacion||""),
        telegramSource:"firebase:"+COLLECTION,
        telegramCheckedAt:now(),
        telegramVerifiedAt:text(data.telegramVerifiedAt||"")
      },
      {source:"stats_telegram_firebase_sync",checkedAt:now(),writeLegacy:true}
    ).then(function(result){
      summary.localWrites+=Number(result&&result.periodos||0)+1;
      return result;
    });
  }

  function processCandidates(firestore,list,summary){
    var index=0;
    function nextBatch(){
      if(index>=list.length){return Promise.resolve(summary);}
      var batch=list.slice(index,index+BATCH_SIZE);
      index+=batch.length;
      status("Sincronizando Telegram desde Firebase: "+Math.min(index,list.length)+" de "+list.length+"...","");
      return Promise.all(batch.map(function(item){
        return readRemote(firestore,item)
          .then(function(remote){return saveResult(item,remote,summary);})
          .catch(function(error){
            summary.errors.push({cedula:item.cedula,error:error&&error.message?error.message:String(error)});
            return null;
          });
      })).then(delay).then(nextBatch);
    }
    return nextBatch();
  }

  function refreshFull(periodId,source){
    var current=repo();
    if(!current){return Promise.reject(new Error("ConStats no está disponible."));}
    if(typeof current.refreshFull==="function"){
      return Promise.resolve(current.refreshFull({
        periodoId:periodId,
        periodId:periodId,
        source:source||"StatsTelegramSync.refreshFull",
        mode:"full",
        full:true,
        force:true,
        immediate:true,
        incremental:true,
        cooldown:0
      }));
    }
    if(typeof current.refresh==="function"){
      return Promise.resolve(current.refresh({
        periodoId:periodId,
        periodId:periodId,
        source:source||"StatsTelegramSync.refresh",
        mode:"full",
        full:true,
        force:true,
        immediate:true,
        incremental:true,
        cooldown:0
      }));
    }
    return Promise.reject(new Error("ConStats no puede actualizar la caché."));
  }

  function rowsForCurrentState(current){
    var currentRepo=repo();
    var options={
      periodoId:text(current.periodId),
      periodId:text(current.periodId),
      matricula:current.matricula==null?"":current.matricula,
      estadoMatricula:current.matricula==null?"":current.matricula
    };
    if(currentRepo&&typeof currentRepo.students==="function"){
      return Promise.resolve(currentRepo.students(options)||[]);
    }
    if(currentRepo&&typeof currentRepo.getStudents==="function"){
      return Promise.resolve(currentRepo.getStudents(options)||[]);
    }
    return Promise.reject(new Error("ConStats no entregó estudiantes."));
  }

  function renderUpdated(summary){
    try{
      if(window.StatsDataPatch&&typeof window.StatsDataPatch.reload==="function"){
        window.StatsDataPatch.reload(true).catch(function(){});
      }
      if(window.StatsCore&&typeof window.StatsCore.invalidate==="function"){
        window.StatsCore.invalidate({reason:"telegram-firebase-sync",keepPeriods:true});
      }
      if(window.StatsApp&&typeof window.StatsApp.render==="function"){
        window.StatsApp.render({force:false,reason:"telegram-firebase-sync"});
      }
      window.dispatchEvent(new CustomEvent("stats:telegram-synced",{detail:summary}));
    }catch(error){}
  }

  function run(){
    if(running){return Promise.resolve({ok:true,skipped:true,running:true});}
    var current=state();
    var periodId=text(current.periodId);
    if(!periodId){return Promise.reject(new Error("Seleccione un período antes de actualizar Telegram."));}

    running=true;
    var refreshButton=button();
    if(refreshButton){refreshButton.disabled=true;}
    status("Preparando estudiantes y contactos de Telegram...","");

    var summary={
      ok:true,
      periodId:periodId,
      eligible:0,
      selected:0,
      reads:0,
      found:0,
      notFound:0,
      updated:0,
      usersImported:0,
      chatIdsImported:0,
      localWrites:0,
      errors:[],
      startedAt:now()
    };

    return refreshFull(periodId,"StatsTelegramSync.before")
      .then(function(){return rowsForCurrentState(current);})
      .then(function(rows){
        var pending=candidates(rows);
        var limit=allowedReads(pending.length);
        summary.eligible=pending.length;
        summary.selected=Math.min(pending.length,limit);
        if(limit<1&&pending.length){throw new Error("La cuota interna de Firebase no permite nuevas lecturas.");}
        if(!summary.selected){return null;}
        return ensureFirebase().then(function(firestore){
          return processCandidates(firestore,pending.slice(0,summary.selected),summary);
        });
      })
      .then(function(){
        registerReads(summary.reads,periodId);
        status("Actualizando la cobertura de Telegram en Stats...","");
        return refreshFull(periodId,"StatsTelegramSync.after");
      })
      .then(function(){
        summary.finishedAt=now();
        summary.message=summary.selected
          ?"Telegram actualizado: "+summary.updated+" estudiantes importados de "+summary.selected+" revisados."
          :"Telegram ya estaba actualizado para los estudiantes revisados.";
        renderUpdated(summary);
        status(summary.message,summary.errors.length?"warn":"ok");
        return summary;
      })
      .catch(function(error){
        summary.ok=false;
        summary.error=error&&error.message?error.message:String(error);
        summary.message="No se pudo sincronizar Telegram. Stats conservó la información local: "+summary.error;
        status(summary.message,"warn");
        return refreshFull(periodId,"StatsTelegramSync.recover")
          .catch(function(){return null;})
          .then(function(){renderUpdated(summary);return summary;});
      })
      .finally(function(){
        running=false;
        if(refreshButton){refreshButton.disabled=false;}
      });
  }

  function bind(){
    var refreshButton=button();
    if(!refreshButton||refreshButton.__statsTelegramSyncBound){return false;}
    refreshButton.__statsTelegramSyncBound=true;
    refreshButton.addEventListener("click",function(event){
      if(!shouldIntercept()){return;}
      event.preventDefault();
      event.stopImmediatePropagation();
      run();
    },true);
    return true;
  }

  window.StatsTelegramFirebaseSync={
    version:VERSION,
    collection:COLLECTION,
    maxReads:MAX_READS,
    run:run,
    bind:bind,
    candidates:candidates,
    isRunning:function(){return running;}
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",bind,{once:true});
  }else{
    bind();
  }
})(window,document);

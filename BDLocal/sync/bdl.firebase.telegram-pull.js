/* =========================================================
Nombre completo: bdl.firebase.telegram-pull.js
Ruta o ubicación: /BDLocal/sync/bdl.firebase.telegram-pull.js
Función o funciones:
- Traer Telegram manualmente desde Firebase Estudiantes/{cedula} hacia Base Local.
- Leer máximo 25 documentos por ejecución y respetar la cuota interna.
- Completar únicamente campos Telegram faltantes.
- Detectar conflictos sin sobrescribir valores locales.
- Registrar revisiones, progreso y bloqueo en sync_estado.
- No escribir en Firebase, no crear cambios_pendientes y no ejecutar tareas automáticas.
- Renderizar su interfaz sin MutationObserver global ni ciclos de DOM.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.2.0-manual-no-observer";
  var TARGET="firebase_telegram_pull";
  var COLLECTION="Estudiantes";
  var MAX_READS=25;
  var RECHECK_DAYS=7;
  var LOCK_MINUTES=10;

  var running=false;
  var bound=false;
  var rendering=false;
  var lastResult=null;

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function config(){return window.BL2Config||{};}
  function db(){return window.BL2DB||null;}
  function core(){return window.BL2Core||null;}
  function quotaStore(){return window.BDLocalConfigStore||null;}
  function firebaseSync(){return window.BL2Sync||null;}
  function stateStore(){return config().stores&&config().stores.syncEstado||"sync_estado";}
  function stateId(periodoId){return TARGET+"__"+text(periodoId);}

  function repo(){
    if(window.BDLRepoContactos){return window.BDLRepoContactos;}
    if(window.BDLRepositories&&typeof window.BDLRepositories.get==="function"){
      return window.BDLRepositories.get("contactos")||null;
    }
    return null;
  }

  function normalizeCedula(value){
    var rules=window.BDLRulesPersona;
    if(rules&&typeof rules.normalizeCedula==="function"){return rules.normalizeCedula(value);}
    return text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
  }

  function normalizeUser(value){
    var rules=window.BDLRulesPersona;
    return rules&&typeof rules.normalizeTelegramUser==="function"
      ?rules.normalizeTelegramUser(value)
      :text(value).replace(/^@+/,"").replace(/\s+/g,"");
  }

  function normalizeChatId(value){
    var rules=window.BDLRulesPersona;
    return rules&&typeof rules.normalizeTelegramChatId==="function"
      ?rules.normalizeTelegramChatId(value)
      :text(value).replace(/\s+/g,"");
  }

  function compactId(value){return text(value).replace(/[^0-9A-Za-z_-]/g,"");}

  function setNodeText(node,value){
    value=text(value);
    if(node&&text(node.textContent)!==value){node.textContent=value;}
  }

  function currentPeriod(){
    try{
      if(window.BL2App&&typeof window.BL2App.getSelectedPeriod==="function"){
        var selected=window.BL2App.getSelectedPeriod();
        if(selected&&text(selected.id)){
          return Promise.resolve({id:text(selected.id),label:text(selected.label||selected.id)});
        }
      }
    }catch(error){}
    return core()&&typeof core().getActivePeriod==="function"
      ?core().getActivePeriod()
      :Promise.resolve(null);
  }

  function emit(name,detail){
    try{window.dispatchEvent(new CustomEvent(name,{detail:clone(detail||{})}));}
    catch(error){}
  }

  function progress(percent,message,detail){
    var payload=Object.assign({
      target:"telegram",
      percent:Math.max(0,Math.min(100,Number(percent||0))),
      detail:text(message),
      at:now()
    },detail||{});
    emit("bl2:sync-progress",payload);
    emit("bdlocal:telegram-pull-progress",payload);
  }

  function log(message,level,payload){
    try{
      if(core()&&typeof core().log==="function"){
        core().log(
          level==="error"?"ERROR":level==="warn"?"WARN":"INFO",
          message,
          payload||{}
        ).catch(function(){});
      }
    }catch(error){}
  }

  function getState(periodoId){
    var current=db();
    return current&&typeof current.get==="function"
      ?current.get(stateStore(),stateId(periodoId)).catch(function(){return null;})
      :Promise.resolve(null);
  }

  function saveState(periodoId,patch){
    var current=db();
    periodoId=text(periodoId);
    if(!current||typeof current.put!=="function"||!periodoId){return Promise.resolve(null);}
    return getState(periodoId).then(function(existing){
      return current.put(
        stateStore(),
        Object.assign({},existing||{},patch||{},{
          id:stateId(periodoId),
          target:TARGET,
          periodoId:periodoId,
          updatedAt:now()
        })
      );
    });
  }

  function lockActive(state){
    if(!state||text(state.status).toUpperCase()!=="RUNNING"){return false;}
    var until=new Date(state.lockUntil||0).getTime();
    return Number.isFinite(until)&&until>Date.now();
  }

  function checkedRecently(value,days){
    var time=new Date(value||0).getTime();
    return Number.isFinite(time)&&time>0&&Date.now()-time<Number(days||RECHECK_DAYS)*86400000;
  }

  function localTelegram(row){
    row=row||{};
    return {
      user:normalizeUser(row.telegramUser||row._telegramUser||row.usuarioTelegram||row.telegram||""),
      chatId:normalizeChatId(row.telegramChatId||row._telegramChatId||row.chatIdTelegram||row.chatId||""),
      checkedAt:text(row.telegramCheckedAt||row.telegramRevisadoEn||"")
    };
  }

  function remoteIds(row){
    var values=[];
    function add(value){
      value=compactId(value);
      if(value&&values.indexOf(value)<0){values.push(value);}
    }
    add(row&&row.numeroIdentificacion);
    add(row&&row.cedula);
    var canonical=normalizeCedula(row&&(row.cedula||row.numeroIdentificacion));
    add(canonical);
    if(/^0\d{9}$/.test(canonical)){add(canonical.slice(1));}
    return values;
  }

  function candidates(rows,options){
    options=options||{};
    var map=Object.create(null);

    (Array.isArray(rows)?rows:[]).forEach(function(row){
      var cedula=normalizeCedula(row&&(row.cedula||row.numeroIdentificacion));
      if(!cedula||map[cedula]){return;}

      var local=localTelegram(row);
      if(local.user&&local.chatId){return;}
      if(options.forceRecheck!==true&&checkedRecently(local.checkedAt,RECHECK_DAYS)){return;}

      map[cedula]={
        cedula:cedula,
        nombre:text(row.Nombres||row.nombres||row.nombreCompleto),
        row:row,
        local:local,
        remoteIds:remoteIds(row)
      };
    });

    return Object.keys(map).map(function(key){return map[key];}).sort(function(a,b){
      return text(a.nombre).localeCompare(text(b.nombre),"es",{sensitivity:"base"});
    });
  }

  function allowedReads(requested){
    requested=Math.min(MAX_READS,Math.max(0,Number(requested||0)));
    if(requested<1){return 0;}

    var store=quotaStore();
    if(!store||typeof store.getFirebaseQuotaStatus!=="function"){return requested;}

    while(requested>0){
      var snapshot;
      try{snapshot=store.getFirebaseQuotaStatus(requested);}
      catch(error){return 0;}
      if(!snapshot||snapshot.allowed!==false){break;}
      requested-=1;
    }

    return requested;
  }

  function registerReads(reads,label){
    var store=quotaStore();
    if(store&&typeof store.registerFirebaseUsage==="function"&&reads>0){
      store.registerFirebaseUsage({
        reads:Number(reads),
        writes:0,
        deletes:0,
        label:label||"Lectura Telegram Firebase."
      });
    }
  }

  function ensureFirebase(){
    var sync=firebaseSync();
    return sync&&typeof sync.ensureFirebase==="function"
      ?sync.ensureFirebase()
      :Promise.reject(new Error("Firebase no está disponible."));
  }

  function readDocument(firestore,id){
    return firestore.collection(COLLECTION).doc(id).get().then(function(snapshot){
      return {
        ok:true,
        exists:!!snapshot.exists,
        id:id,
        data:snapshot.exists?snapshot.data()||{}:null
      };
    }).catch(function(error){
      return {
        ok:false,
        exists:false,
        id:id,
        error:error&&error.message?error.message:String(error)
      };
    });
  }

  function readCandidate(firestore,candidate,tracker,remainingCandidates){
    var ids=candidate.remoteIds.length?candidate.remoteIds.slice():[candidate.cedula];
    var primary=ids.shift();

    if(tracker.reads>=tracker.limit){
      return Promise.resolve({candidate:candidate,exists:false,skipped:true});
    }

    tracker.reads+=1;

    return readDocument(firestore,primary).then(function(result){
      if(result.exists||result.error||!ids.length){
        return Object.assign(result,{candidate:candidate});
      }

      var reserved=Math.max(0,Number(remainingCandidates||0));
      if(tracker.reads+reserved>=tracker.limit){
        return Object.assign(result,{candidate:candidate});
      }

      tracker.reads+=1;
      return readDocument(firestore,ids[0]).then(function(fallback){
        return Object.assign(fallback,{
          candidate:candidate,
          fallback:true,
          primaryId:primary
        });
      });
    });
  }

  function compareField(localValue,remoteValue,type,conflicts){
    localValue=type==="user"?normalizeUser(localValue):normalizeChatId(localValue);
    remoteValue=type==="user"?normalizeUser(remoteValue):normalizeChatId(remoteValue);

    if(!remoteValue){return {value:"",changed:false};}
    if(!localValue){return {value:remoteValue,changed:true};}
    if(localValue===remoteValue){return {value:"",changed:false};}

    conflicts.push({
      field:type==="user"?"telegramUser":"telegramChatId",
      local:localValue,
      remote:remoteValue
    });

    return {value:"",changed:false};
  }

  function applyResult(item,summary,checkedAt){
    var candidate=item.candidate;
    var remote=item.exists?item.data||{}:{};
    var conflicts=[];

    var userResult=compareField(
      candidate.local.user,
      remote.telegramUser||remote.usuarioTelegram||remote.telegram||"",
      "user",
      conflicts
    );

    var chatResult=compareField(
      candidate.local.chatId,
      remote.telegramChatId||remote.chatIdTelegram||remote.chatId||"",
      "chat",
      conflicts
    );

    var patch={
      cedula:candidate.cedula,
      telegramUser:userResult.value,
      telegramChatId:chatResult.value,
      telegramUpdatedAt:text(remote.telegramUpdatedAt||remote.updatedAt||remote.ultimaSincronizacion||""),
      telegramSource:"firebase:"+COLLECTION,
      telegramCheckedAt:checkedAt,
      telegramVerifiedAt:text(remote.telegramVerifiedAt||"")
    };

    if(conflicts.length){
      summary.conflicts.push({
        cedula:candidate.cedula,
        nombre:candidate.nombre,
        documentId:item.id||"",
        fields:conflicts
      });
    }

    if(item.exists){summary.found+=1;}else{summary.notFound+=1;}
    if(userResult.changed){summary.usersImported+=1;}
    if(chatResult.changed){summary.chatIdsImported+=1;}
    if(userResult.changed||chatResult.changed){summary.updated+=1;}

    var contactsRepo=repo();
    if(!contactsRepo||typeof contactsRepo.saveTelegramForCedula!=="function"){
      return Promise.reject(new Error("Repositorio local de contactos no disponible."));
    }

    return contactsRepo.saveTelegramForCedula(
      candidate.cedula,
      patch,
      {source:"firebase_telegram_pull",checkedAt:checkedAt,writeLegacy:true}
    ).then(function(result){
      summary.localWrites+=Number(result&&result.periodos||0)+1;
      return result;
    });
  }

  function refreshScreens(){
    var hub=window.BDLocalConexiones;
    if(hub&&typeof hub.refreshCache==="function"){
      return hub.refreshCache({
        force:true,
        light:true,
        source:"firebase_telegram_pull"
      }).catch(function(){return null;});
    }
    emit("bdlocal:screen-data-updated",{source:"firebase_telegram_pull",at:now()});
    return Promise.resolve(null);
  }

  function run(options){
    options=options||{};
    var automatic=options.automatic===true;
    var reason=text(options.reason||(automatic?"automatic":"manual"));
    var runPeriod=null;
    var previousState=null;

    if(automatic){
      return Promise.resolve({
        ok:true,
        skipped:true,
        automaticBlocked:true,
        manualOnly:true,
        message:"La lectura de Telegram es manual."
      });
    }

    if(running){
      return Promise.resolve({
        ok:true,
        skipped:true,
        running:true,
        message:"La descarga Telegram ya está en ejecución."
      });
    }

    if(typeof navigator!=="undefined"&&navigator.onLine===false){
      return Promise.resolve({
        ok:true,
        skipped:true,
        offline:true,
        message:"Sin conexión; no se realizó la lectura Telegram."
      });
    }

    return currentPeriod().then(function(period){
      if(!period||!text(period.id)){
        throw new Error("Seleccione un período antes de traer Telegram.");
      }

      runPeriod=period;

      return getState(period.id).then(function(saved){
        previousState=saved;
        if(lockActive(saved)){
          return {
            skip:true,
            result:{
              ok:true,
              skipped:true,
              locked:true,
              message:"Existe otra revisión Telegram en curso."
            }
          };
        }
        return {skip:false};
      });
    }).then(function(context){
      if(context.skip){return context.result;}

      running=true;
      renderUI();

      var startedAt=now();
      emit("bdlocal:telegram-pull-start",{
        period:runPeriod,
        automatic:false,
        reason:reason,
        at:startedAt
      });
      progress(5,"Buscando estudiantes con Telegram incompleto...",{
        periodoId:runPeriod.id
      });

      return saveState(runPeriod.id,{
        status:"RUNNING",
        lockUntil:new Date(Date.now()+LOCK_MINUTES*60000).toISOString(),
        lastStartedAt:startedAt,
        lastReason:reason
      }).then(function(){
        if(!core()||typeof core().getStudents!=="function"){
          throw new Error("BL2Core.getStudents no está disponible.");
        }
        return core().getStudents({periodoId:runPeriod.id});
      }).then(function(rows){
        var pending=candidates(rows,{forceRecheck:options.forceRecheck===true});
        var readLimit=allowedReads(Math.min(MAX_READS,pending.length));

        var summary={
          ok:true,
          automatic:false,
          manualOnly:true,
          reason:reason,
          periodoId:runPeriod.id,
          periodoLabel:runPeriod.label,
          eligible:pending.length,
          selected:0,
          reads:0,
          found:0,
          notFound:0,
          updated:0,
          usersImported:0,
          chatIdsImported:0,
          localWrites:0,
          conflicts:[],
          errors:[],
          collection:COLLECTION,
          maxReads:MAX_READS,
          startedAt:startedAt
        };

        if(readLimit<1){
          summary.skipped=true;
          summary.quotaBlocked=pending.length>0;
          summary.message=pending.length
            ?"Telegram no se consultó porque la cuota interna está protegida."
            :"No hay estudiantes pendientes de revisión Telegram.";
          return {summary:summary};
        }

        var reserve=Math.min(5,Math.floor(readLimit/5));
        var selectedCount=Math.min(pending.length,Math.max(1,readLimit-reserve));
        var selected=pending.slice(0,selectedCount);
        summary.selected=selected.length;

        if(!selected.length){
          summary.skipped=true;
          summary.message="No hay estudiantes pendientes de revisión Telegram.";
          return {summary:summary};
        }

        return ensureFirebase().then(function(firestore){
          var tracker={reads:0,limit:readLimit};
          var chain=Promise.resolve();

          selected.forEach(function(candidate,index){
            chain=chain.then(function(){
              progress(
                10+Math.round((index/Math.max(selected.length,1))*75),
                "Revisando Telegram: "+(index+1)+" de "+selected.length,
                {cedula:candidate.cedula}
              );

              return readCandidate(
                firestore,
                candidate,
                tracker,
                selected.length-index-1
              ).then(function(item){
                if(item.error){
                  summary.errors.push({
                    cedula:candidate.cedula,
                    documentId:item.id,
                    error:item.error
                  });
                  return null;
                }

                return applyResult(item,summary,now()).catch(function(error){
                  summary.errors.push({
                    cedula:candidate.cedula,
                    error:error&&error.message?error.message:String(error)
                  });
                  return null;
                });
              });
            });
          });

          return chain.then(function(){
            summary.reads=tracker.reads;
            summary.finishedAt=now();
            summary.message=summary.errors.length
              ?"Revisión Telegram completada con observaciones."
              :"Revisión Telegram finalizada.";
            registerReads(summary.reads,"Telegram Firebase "+runPeriod.id);
            return {summary:summary};
          });
        });
      }).then(function(context){
        var summary=context.summary;
        lastResult=clone(summary);

        return saveState(runPeriod.id,{
          status:"IDLE",
          lockUntil:"",
          lastRunAt:now(),
          lastReason:reason,
          lastSummary:summary,
          lastError:""
        }).then(function(){
          return refreshScreens();
        }).then(function(){
          progress(100,summary.message||"Revisión Telegram finalizada.",{
            summary:summary
          });
          emit("bdlocal:telegram-pull-finished",summary);
          renderUI();
          log(
            summary.message||"Revisión Telegram finalizada.",
            summary.errors&&summary.errors.length?"warn":"info",
            summary
          );
          return summary;
        });
      });
    }).catch(function(error){
      var periodId=runPeriod&&runPeriod.id||"";
      var failed={
        ok:false,
        automatic:false,
        manualOnly:true,
        reason:reason,
        error:error&&error.message?error.message:String(error),
        message:"No se pudo traer Telegram: "+(
          error&&error.message?error.message:String(error)
        )
      };

      lastResult=failed;

      return saveState(periodId,{
        status:"ERROR",
        lockUntil:"",
        lastRunAt:now(),
        lastError:failed.error,
        lastAutomaticDate:text(previousState&&previousState.lastAutomaticDate)
      }).catch(function(){return null;}).then(function(){
        emit("bdlocal:telegram-pull-finished",failed);
        progress(0,failed.message);
        renderUI();
        return failed;
      });
    }).finally(function(){
      running=false;
      renderUI();
    });
  }

  function runAutomatic(){
    return Promise.resolve({
      ok:true,
      skipped:true,
      automaticBlocked:true,
      manualOnly:true,
      message:"La lectura Telegram solo puede iniciarse manualmente."
    });
  }

  function scheduleAutomatic(){
    return runAutomatic();
  }

  function runManual(){
    if(!window.confirm(
      "Traer Telegram desde Firebase\n\n"+
      "Se leerán como máximo 25 documentos de Estudiantes y no se escribirá nada en Firebase.\n\n"+
      "¿Continuar?"
    )){
      return Promise.resolve({
        ok:true,
        cancelled:true,
        message:"Revisión Telegram cancelada."
      });
    }
    return run({automatic:false,reason:"manual"});
  }

  function firebaseCard(){
    var cards=document.querySelectorAll(".bdlc-connection-card");
    for(var index=0;index<cards.length;index+=1){
      var title=cards[index].querySelector("h3");
      if(title&&text(title.textContent)==="Firebase"){return cards[index];}
    }
    return null;
  }

  function statusMessage(){
    if(running){return "Telegram: revisión manual en curso, máximo 25 lecturas.";}
    if(lastResult){return "Telegram: "+text(lastResult.message||"última revisión registrada.");}
    return "Telegram: lectura manual desde Estudiantes, máximo 25 documentos.";
  }

  function renderDiagnosticsCard(){
    var slot=document.getElementById("bl2-diagnostics-slot");
    if(!slot){return;}

    var card=document.getElementById("bdlc-telegram-diagnostics");
    if(!card){
      card=document.createElement("div");
      card.id="bdlc-telegram-diagnostics";
      card.className="bdlc-card";
      card.innerHTML=
        '<div class="bdlc-header">'+
          '<div><h3>Telegram Firebase</h3><p id="bdlc-telegram-diagnostics-message"></p></div>'+
          '<span class="bdlc-status ok">Solo lectura remota</span>'+
        '</div>'+
        '<div class="bdlc-table-wrap"><table class="bdlc-table"><tbody>'+
          '<tr><th>Colección</th><td>Estudiantes/{cedula}</td></tr>'+
          '<tr><th>Máximo</th><td>25 lecturas por ejecución</td></tr>'+
          '<tr><th>Modo</th><td>Manual</td></tr>'+
          '<tr><th>Escrituras Firebase</th><td>0</td></tr>'+
          '<tr><th>Cola externa</th><td>No genera</td></tr>'+
        '</tbody></table></div>';
      slot.appendChild(card);
    }

    setNodeText(
      document.getElementById("bdlc-telegram-diagnostics-message"),
      statusMessage()
    );

    var badge=card.querySelector(".bdlc-status");
    if(badge){
      badge.className="bdlc-status "+(lastResult&&lastResult.ok===false?"error":"ok");
    }
  }

  function renderUI(){
    if(rendering){return false;}
    rendering=true;

    try{
      var card=firebaseCard();

      if(card){
        var actions=card.querySelector(".bdlc-actions");
        var button=document.getElementById("bl2-btn-pull-telegram");

        if(actions&&!button){
          button=document.createElement("button");
          button.id="bl2-btn-pull-telegram";
          button.className="bdlc-button secondary";
          button.type="button";
          button.textContent="Traer Telegram";
          button.addEventListener("click",function(){
            button.disabled=true;
            runManual().then(function(result){
              if(
                window.BDLocalConfigUI&&
                typeof window.BDLocalConfigUI.notify==="function"&&
                result&&!result.cancelled
              ){
                window.BDLocalConfigUI.notify(
                  result.message||"Telegram procesado.",
                  result.ok===false?"error":"success"
                );
              }
            }).finally(function(){
              button.disabled=false;
              renderUI();
            });
          });
          actions.appendChild(button);
        }

        button=document.getElementById("bl2-btn-pull-telegram");
        if(button){button.disabled=running;}

        var statusNode=document.getElementById("bdlc-telegram-pull-status");
        if(!statusNode){
          statusNode=document.createElement("div");
          statusNode.id="bdlc-telegram-pull-status";
          statusNode.className="bdlc-alert info";
          statusNode.style.marginTop="12px";
          card.appendChild(statusNode);
        }
        setNodeText(statusNode,statusMessage());
      }

      renderDiagnosticsCard();
      return !!card;
    }finally{
      rendering=false;
    }
  }

  function status(){
    return currentPeriod().then(function(period){
      if(!period||!period.id){
        return {
          ok:true,
          version:VERSION,
          running:running,
          period:null,
          lastResult:lastResult,
          collection:COLLECTION,
          maxReads:MAX_READS,
          recheckDays:RECHECK_DAYS,
          automatic:false,
          manualOnly:true,
          writesFirebase:false,
          createsOutbox:false
        };
      }

      return getState(period.id).then(function(saved){
        return {
          ok:true,
          version:VERSION,
          running:running,
          period:period,
          state:saved,
          lastResult:lastResult,
          collection:COLLECTION,
          maxReads:MAX_READS,
          recheckDays:RECHECK_DAYS,
          automatic:false,
          manualOnly:true,
          writesFirebase:false,
          createsOutbox:false
        };
      });
    });
  }

  function diagnostics(){
    return Promise.all([currentPeriod(),status()]).then(function(values){
      var period=values[0];
      var snapshot=values[1];

      if(!period||!period.id||!core()||typeof core().getStudents!=="function"){
        return Object.assign({},snapshot,{eligible:0});
      }

      return core().getStudents({periodoId:period.id}).then(function(rows){
        return Object.assign({},snapshot,{
          students:(rows||[]).length,
          eligible:candidates(rows,{}).length
        });
      });
    });
  }

  function attachToDiagnosticReport(event){
    diagnostics().then(function(snapshot){
      if(event&&event.detail){event.detail.telegram=snapshot;}
      var output=document.getElementById("diagnostics-json");
      if(output&&event&&event.detail){
        output.textContent=JSON.stringify(event.detail,null,2);
      }
      renderDiagnosticsCard();
    }).catch(function(){});
  }

  function bind(){
    if(bound){return;}
    bound=true;

    renderUI();

    window.addEventListener("bl2:ready",renderUI);
    window.addEventListener("bl2:period-changed",function(){
      lastResult=null;
      renderUI();
    });
    window.addEventListener("bl2:app-refreshed",renderUI);
    window.addEventListener("bdlocal:diagnostics-finished",attachToDiagnosticReport);
    window.addEventListener("bdlocal:config-ui-rendered",renderUI);
  }

  window.BDLFirebaseTelegramPull={
    version:VERSION,
    collection:COLLECTION,
    maxReads:MAX_READS,
    recheckDays:RECHECK_DAYS,
    manualOnly:true,
    automatic:false,
    run:run,
    runAutomatic:runAutomatic,
    runManual:runManual,
    scheduleAutomatic:scheduleAutomatic,
    status:status,
    diagnostics:diagnostics,
    renderUI:renderUI,
    candidates:candidates,
    remoteIds:remoteIds,
    isRunning:function(){return running;},
    getLastResult:function(){return clone(lastResult);},
    writesFirebase:false,
    createsOutbox:false
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",bind,{once:true});
  }else{
    bind();
  }
})(window,document);

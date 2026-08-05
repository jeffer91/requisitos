/* =========================================================
Nombre completo: bdl.firebase.operation-center.js
Ruta: /BDLocal/firebase/bdl.firebase.operation-center.js
Función:
- Coordinar las operaciones Firebase de Carga, Defensas, Ncomplex y Stats.
- Mantener ocho colecciones oficiales y separar la propiedad de cada pantalla.
- Exigir análisis vigente antes de subir, con lotes máximos de 25 cambios.
- Descargar desde Stats únicamente Telegram desde estudiantes.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.1.0-ncomplex-domain-routing";
  var MAX_BATCH_SIZE=25;
  var currentScript=document.currentScript;
  var base=currentScript&&currentScript.src?currentScript.src:document.baseURI;
  var loading=Object.create(null);
  var readyPromise=null;
  var state={
    running:false,
    operation:"",
    startedAt:"",
    lastError:"",
    lastResult:null,
    analyses:Object.create(null)
  };

  var SCOPES={
    carga:{
      id:"carga",
      label:"Carga",
      entities:["estudiantes","matriculas","requisitos","periodos","carreras","importaciones","historial"]
    },
    defensas:{
      id:"defensas",
      label:"Defensas",
      entities:["notas","historial"]
    },
    ncomplex:{
      id:"ncomplex",
      label:"Ncomplex",
      entities:["notas","importaciones","historial"]
    },
    telegram:{
      id:"telegram",
      label:"Stats / Telegram",
      entities:["estudiantes"]
    }
  };

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function canonicalPeriodId(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function normalizeKey(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  }
  function emit(name,detail){
    try{window.dispatchEvent(new CustomEvent(name,{detail:Object.assign({at:now()},detail||{})}));}catch(error){}
  }
  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){
    return Array.prototype.slice.call(document.scripts||[]).some(function(script){
      return script.src===src||script.getAttribute("data-firebase-operation-center-src")===src;
    });
  }
  function waitFor(test,label,timeoutMs){
    timeoutMs=Math.max(500,Number(timeoutMs||15000));
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        var value=null;
        try{value=test();}catch(error){}
        if(value){resolve(value);return;}
        if(Date.now()-started>=timeoutMs){reject(new Error("No se pudo preparar "+label+"."));return;}
        window.setTimeout(check,60);
      })();
    });
  }
  function load(relative,test){
    var src=url(relative),current=null;
    try{current=test&&test();}catch(error){}
    if(current){return Promise.resolve(current);}
    if(loading[src]){return loading[src];}
    if(existing(src)){return test?waitFor(test,relative,15000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=src;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-firebase-operation-center-src",src);
      script.onload=function(){
        var value=src;
        try{value=test?test():src;}catch(error){value=null;}
        value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));
      };
      script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};
      (document.head||document.documentElement).appendChild(script);
    }).finally(function(){delete loading[src];});
    return loading[src];
  }

  function outbox(){return window.BDLSyncOutbox||null;}
  function target(){return window.BDLSyncTargetFirebase||null;}
  function repository(){return window.RequisitosFirebaseRepository||null;}
  function personasRepo(){
    return window.BDLRepoPersonas||
      (window.BDLRepositories&&window.BDLRepositories.get&&window.BDLRepositories.get("personas"))||null;
  }

  function activateHeavy(){
    var current=window.BDLocalScreenDeps;
    var task=current&&typeof current.activateHeavy==="function"
      ?Promise.resolve(current.activateHeavy())
      :load("../adapters/bdl.screen-deps.js",function(){return window.BDLocalScreenDeps;})
        .then(function(api){return api&&typeof api.activateHeavy==="function"?api.activateHeavy():api;});

    return task.then(function(){
      if(window.BDLOutboxBridge&&typeof window.BDLOutboxBridge.loadSharedArchitecture==="function"){
        return window.BDLOutboxBridge.loadSharedArchitecture();
      }
      return true;
    });
  }

  function ensure(){
    if(outbox()&&target()&&repository()&&personasRepo()){
      return Promise.resolve(window.RequisitosFirebaseOperationCenter);
    }
    if(readyPromise){return readyPromise;}
    readyPromise=activateHeavy().then(function(){
      return waitFor(function(){
        return outbox()&&target()&&repository()&&personasRepo();
      },"la arquitectura Firebase V2",20000);
    }).then(function(){
      state.lastError="";
      return window.RequisitosFirebaseOperationCenter;
    }).catch(function(error){
      state.lastError=error&&error.message?error.message:String(error);
      throw error;
    }).finally(function(){readyPromise=null;});
    return readyPromise;
  }

  function scopeOf(value){
    var key=normalizeKey(value);
    var current=SCOPES[key];
    if(!current){throw new Error("Ámbito Firebase no soportado: "+text(value)+".");}
    return current;
  }

  function entityOf(row){
    row=row||{};
    var table=normalizeKey(row.tabla||row.table||row.tipo||row.type||"");
    if(!table){return "desconocido";}
    if(table==="estudiantes"||table==="estudiante"||/persona|contact|estudiante/.test(table)){return "estudiantes";}
    if(table==="matriculas"||table==="matricula"||/matricula|division/.test(table)){return "matriculas";}
    if(table==="requisitos"||table==="requisito"||/requisit/.test(table)){return "requisitos";}
    if(table==="notas"||table==="nota"||/nota|evaluacion|defensa|complex/.test(table)){return "notas";}
    if(table==="importaciones"||table==="importacion"||/importacion/.test(table)){return "importaciones";}
    if(table==="periodos"||table==="periodo"||/periodo/.test(table)){return "periodos";}
    if(table==="carreras"||table==="carrera"||/carrera/.test(table)){return "carreras";}
    if(table==="historial"||/historial|log/.test(table)){return "historial";}
    return "desconocido";
  }

  function payloadOf(row){
    row=row||{};
    return row.payload||row.data||row.registro||{};
  }

  function originOf(row){
    row=row||{};
    var payload=payloadOf(row);
    return normalizeKey([
      row.source,row.origen,row.pantalla,row.screen,row.modulo,
      payload.source,payload.origen,payload.pantalla,payload.screen,payload.modulo
    ].filter(Boolean).join(" "));
  }

  function hasAnyField(data,fields){
    data=data||{};
    return fields.some(function(field){
      return Object.prototype.hasOwnProperty.call(data,field);
    });
  }

  function noteOwner(row){
    var origin=originOf(row);
    var table=normalizeKey(row&&(row.tabla||row.table||row.tipo||row.type)||"");
    var payload=payloadOf(row);

    if(/ncomplex|complexivo/.test(origin)||/evaluaciones_titulacion|ncomplex|complexivo/.test(table)){
      return "ncomplex";
    }
    if(/defart|defensas|defensa/.test(origin)||/defart|defensas/.test(table)){
      return "defensas";
    }

    var complexFields=[
      "notaTeorica","notaPractica","notaComplexivo",
      "notaTeoricaSupletorio","notaPracticaSupletorio","notaSupletorio",
      "oportunidadAplicada","horarioOrigen"
    ];
    var defenseFields=[
      "notaArticulo","notaDefensa","notaFinal",
      "notart","notdef","notafinal","Notart","Notdef","Notafinal",
      "notaEscrito","notaDefensaTrabajo","notaTrabajoTitulacion"
    ];
    var complex=hasAnyField(payload,complexFields);
    var defense=hasAnyField(payload,defenseFields);

    if(complex&&!defense){return "ncomplex";}
    return "defensas";
  }

  function auxiliaryOwner(row){
    var origin=originOf(row);
    if(/ncomplex|complexivo/.test(origin)){return "ncomplex";}
    if(/defart|defensas|defensa/.test(origin)){return "defensas";}
    return "carga";
  }

  function rowOwner(row){
    var entity=entityOf(row);
    if(entity==="notas"){return noteOwner(row);}
    if(entity==="historial"||entity==="importaciones"){return auxiliaryOwner(row);}
    if(entity==="estudiantes"||entity==="matriculas"||entity==="requisitos"||
       entity==="periodos"||entity==="carreras"){
      return "carga";
    }
    return "desconocido";
  }

  function canonicalTable(entity){
    var map={
      estudiantes:"personas",
      matriculas:"matriculas",
      requisitos:"requisitos",
      notas:"notas",
      importaciones:"importaciones",
      periodos:"periodos",
      carreras:"carreras",
      historial:"historial"
    };
    return map[entity]||entity;
  }

  function rowBelongsToScope(row,scope){
    var entity=entityOf(row);
    if(scope.entities.indexOf(entity)<0){return false;}
    if(scope.id==="telegram"){return entity==="estudiantes";}
    return rowOwner(row)===scope.id;
  }

  function allowedRows(rows,scope){
    return (Array.isArray(rows)?rows:[]).filter(function(row){
      return rowBelongsToScope(row,scope);
    });
  }

  function eligibleRows(scope,options){
    options=Object.assign({},options||{});
    var periodoId=canonicalPeriodId(options.periodoId||options.periodId||"");
    if(!periodoId){return Promise.reject(new Error("Seleccione un período antes de sincronizar."));}
    var api=outbox();
    if(!api||typeof api.list!=="function"){return Promise.reject(new Error("La cola de sincronización no está disponible."));}
    return api.list({periodoId:periodoId,includeLegacy:false,force:true}).then(function(rows){
      return allowedRows(rows,scope).filter(function(row){
        return !api.isDone(row,"firebase")&&
          !api.isBlocked(row,"firebase",options)&&
          api.retryDue(row,"firebase",options);
      });
    });
  }

  function normalizeRows(rows){
    return (rows||[]).map(function(row){
      var entity=entityOf(row);
      var copy=Object.assign({},row);
      copy.tabla=canonicalTable(entity);
      copy.table=copy.tabla;
      copy._firebaseDomainEntity=entity;
      copy._firebaseDomainOwner=rowOwner(row);
      return copy;
    });
  }

  function rowId(row){
    var api=outbox();
    return api&&typeof api.rowId==="function"?api.rowId(row):text(row&&(row.id||row.cambioId));
  }
  function signature(rows){
    return (rows||[]).map(function(row){
      return [rowId(row),text(row.updatedAt||row.createdAt),entityOf(row),rowOwner(row)].join("|");
    }).sort().join("::");
  }
  function analysisKey(scope,periodoId){return scope.id+"__"+canonicalPeriodId(periodoId);}

  function expectedKnown(expected){
    expected=expected||{};
    return expected.exists!==undefined||text(expected.hash)||Number(expected.version)>0||text(expected.updatedAt);
  }
  function remoteMatchesExpected(remote,expected){
    expected=expected||{};
    if(expected.exists===false){return !remote;}
    if(!remote){return expected.exists!==true&&!text(expected.hash)&&!Number(expected.version)&&!text(expected.updatedAt);}
    if(text(expected.hash)&&text(remote.dataHash)!==text(expected.hash)){return false;}
    if(Number(expected.version)>0&&Number(remote.version||0)!==Number(expected.version)){return false;}
    if(text(expected.updatedAt)&&text(remote.updatedAt)!==text(expected.updatedAt)){return false;}
    return true;
  }
  function classify(entry,remoteItem){
    var remote=remoteItem&&remoteItem.data||null;
    var local=entry.document||{};
    if(remote&&text(remote.dataHash)&&text(local.dataHash)&&text(remote.dataHash)===text(local.dataHash)){
      return "sinCambios";
    }
    if(!remote){
      return entry.expected&&entry.expected.exists===true?"conflictos":"nuevos";
    }
    if(!expectedKnown(entry.expected)){
      return "conflictos";
    }
    return remoteMatchesExpected(remote,entry.expected)?"modificados":"conflictos";
  }

  function emptyEntitySummary(){return {nuevos:0,modificados:0,sinCambios:0,conflictos:0,total:0};}

  function analyze(scopeName,options){
    options=Object.assign({},options||{});
    var scope=scopeOf(scopeName);
    var periodoId=canonicalPeriodId(options.periodoId||options.periodId||"");
    return ensure().then(function(){
      return eligibleRows(scope,options);
    }).then(function(allRows){
      var batchRows=allRows.slice(0,MAX_BATCH_SIZE);
      var normalized=normalizeRows(batchRows);
      if(!batchRows.length){
        var empty={
          ok:true,scope:scope.id,scopeLabel:scope.label,periodoId:periodoId,
          pendingChanges:0,batchChanges:0,remainingChanges:0,documents:0,
          nuevos:0,modificados:0,sinCambios:0,conflictos:0,differences:0,
          skipped:[],entities:{},signature:"",analyzedAt:now()
        };
        state.analyses[analysisKey(scope,periodoId)]=empty;
        state.lastResult=empty;
        return empty;
      }
      return target().prepareEntries(normalized,{
        manual:true,periodoId:periodoId,limit:MAX_BATCH_SIZE,batchSize:MAX_BATCH_SIZE
      }).then(function(prepared){
        var summary={
          ok:true,scope:scope.id,scopeLabel:scope.label,periodoId:periodoId,
          pendingChanges:allRows.length,batchChanges:batchRows.length,
          remainingChanges:Math.max(0,allRows.length-batchRows.length),
          documents:prepared.entries.length,
          nuevos:0,modificados:0,sinCambios:0,conflictos:0,differences:0,
          skipped:prepared.skipped||[],entities:{},signature:signature(batchRows),
          analyzedAt:now(),rows:batchRows.map(rowId).filter(Boolean)
        };
        var chain=Promise.resolve();
        prepared.entries.forEach(function(entry){
          chain=chain.then(function(){
            return repository().getById(entry.entity,entry.documentId).then(function(remote){
              var status=classify(entry,remote);
              summary[status]+=1;
              summary.entities[entry.entity]=summary.entities[entry.entity]||emptyEntitySummary();
              summary.entities[entry.entity][status]+=1;
              summary.entities[entry.entity].total+=1;
            });
          });
        });
        return chain.then(function(){
          summary.differences=summary.nuevos+summary.modificados;
          state.analyses[analysisKey(scope,periodoId)]=clone(summary);
          state.lastResult=clone(summary);
          emit("requisitos:firebase-domain-analyzed",summary);
          return summary;
        });
      });
    }).catch(function(error){
      var result={ok:false,scope:scope.id,periodoId:periodoId,message:error&&error.message?error.message:String(error),at:now()};
      state.lastError=result.message;
      state.lastResult=result;
      return result;
    });
  }

  function lock(operation){
    if(state.running){throw new Error("Ya existe una operación Firebase en curso.");}
    state.running=true;
    state.operation=operation;
    state.startedAt=now();
    state.lastError="";
    emit("requisitos:firebase-domain-started",{operation:operation});
  }
  function unlock(){state.running=false;state.operation="";state.startedAt="";}

  function push(scopeName,options){
    options=Object.assign({},options||{});
    var scope=scopeOf(scopeName);
    var periodoId=canonicalPeriodId(options.periodoId||options.periodId||"");
    var operation="push:"+scope.id;
    var selectedRows=[];
    try{lock(operation);}catch(error){return Promise.resolve({ok:false,blocked:true,message:error.message,scope:scope.id});}

    return ensure().then(function(){
      return eligibleRows(scope,options);
    }).then(function(allRows){
      selectedRows=allRows.slice(0,MAX_BATCH_SIZE);
      var previous=state.analyses[analysisKey(scope,periodoId)]||null;
      if(options.requireAnalysis!==false){
        if(!previous){throw new Error("Primero analice las diferencias antes de subir.");}
        if(previous.signature!==signature(selectedRows)){
          delete state.analyses[analysisKey(scope,periodoId)];
          throw new Error("Los cambios variaron después del análisis. Analice nuevamente.");
        }
      }
      if(!selectedRows.length){
        return {ok:true,target:"firebase",scope:scope.id,periodoId:periodoId,processedIds:[],documentsWritten:0,conflicts:0,message:"No existen diferencias pendientes para este ámbito."};
      }
      return target().push(normalizeRows(selectedRows),{
        manual:true,periodoId:periodoId,limit:MAX_BATCH_SIZE,batchSize:MAX_BATCH_SIZE,
        source:text(options.source||"FirebaseOperationCenter."+scope.id)
      });
    }).then(function(result){
      result=result||{};
      var processed=Array.isArray(result.processedIds)?result.processedIds:[];
      var processedMap=Object.create(null);
      processed.forEach(function(id){processedMap[text(id)]=true;});
      var confirmed=selectedRows.filter(function(row){return processedMap[rowId(row)]===true;});
      var markTask=confirmed.length
        ?outbox().markSynced(confirmed,"firebase",{syncedAt:now(),response:result})
        :Promise.resolve({ok:true,updated:0});

      if(result.ok===false&&!result.blocked&&!result.deferWithoutAttempt&&!confirmed.length&&selectedRows.length){
        markTask=outbox().markError(selectedRows,"firebase",{error:result.message||result.error||"Error de subida Firebase."});
      }

      return markTask.then(function(marked){
        delete state.analyses[analysisKey(scope,periodoId)];
        var finalResult=Object.assign({},result,{
          scope:scope.id,scopeLabel:scope.label,periodoId:periodoId,
          selectedChanges:selectedRows.length,confirmedChanges:confirmed.length,
          marked:Number(marked&&marked.updated||0),finishedAt:now()
        });
        state.lastResult=clone(finalResult);
        emit("requisitos:firebase-domain-finished",finalResult);
        return finalResult;
      });
    }).catch(function(error){
      var result={ok:false,scope:scope.id,periodoId:periodoId,message:error&&error.message?error.message:String(error),at:now()};
      state.lastError=result.message;
      state.lastResult=result;
      emit("requisitos:firebase-domain-error",result);
      return result;
    }).finally(unlock);
  }

  function readTelegramCursor(){
    try{return JSON.parse(window.localStorage.getItem("REQ_FIREBASE_TELEGRAM_CURSOR_V2")||"{}")||{};}catch(error){return {};}
  }
  function writeTelegramCursor(cursor){
    try{window.localStorage.setItem("REQ_FIREBASE_TELEGRAM_CURSOR_V2",JSON.stringify(cursor||{}));return true;}catch(error){return false;}
  }
  function telegramFields(data){
    data=data||{};
    var userKeys=["telegramUser","_telegramUser","telegramUsername","usuarioTelegram","TelegramUser","TelegramUsuario","telegram","Telegram"];
    var chatKeys=["telegramChatId","_telegramChatId","chatIdTelegram","telegramChatID","TelegramChatId","chatId"];
    var hasUser=userKeys.some(function(key){return Object.prototype.hasOwnProperty.call(data,key);});
    var hasChat=chatKeys.some(function(key){return Object.prototype.hasOwnProperty.call(data,key);});
    function first(keys){
      for(var i=0;i<keys.length;i+=1){
        if(data[keys[i]]!==undefined&&data[keys[i]]!==null){return data[keys[i]];}
      }
      return "";
    }
    var rules=window.BDLRulesPersona||{};
    var user=typeof rules.normalizeTelegramUser==="function"?rules.normalizeTelegramUser(first(userKeys)):text(first(userKeys)).replace(/^@+/,"");
    var chatId=typeof rules.normalizeTelegramChatId==="function"?rules.normalizeTelegramChatId(first(chatKeys)):text(first(chatKeys));
    return {
      present:hasUser||hasChat,
      user:user,
      chatId:chatId,
      updatedAt:text(data.telegramUpdatedAt||data.updatedAt),
      source:text(data.telegramSource||data.syncSource||"firebase")
    };
  }
  function telegramPatch(existing,remote){
    var info=telegramFields(remote);
    if(!info.present){return {changed:false,row:existing};}
    var row=Object.assign({},existing||{});
    var oldInfo=telegramFields(row);
    var changed=oldInfo.user!==info.user||oldInfo.chatId!==info.chatId;
    ["telegramUser","_telegramUser","telegramUsername","usuarioTelegram","TelegramUser","TelegramUsuario","telegram","Telegram"].forEach(function(key){row[key]=info.user;});
    ["telegramChatId","_telegramChatId","chatIdTelegram","telegramChatID","TelegramChatId","chatId"].forEach(function(key){row[key]=info.chatId;});
    row.telegramUpdatedAt=info.updatedAt||now();
    row.telegramSource=info.source||"firebase:estudiantes";
    row.telegramAvailable=!!(info.user||info.chatId);
    row.updatedAt=changed?now():text(row.updatedAt)||now();
    return {changed:changed,row:row};
  }

  function refreshTelegram(options){
    options=Object.assign({},options||{});
    var periodoId=canonicalPeriodId(options.periodoId||options.periodId||"");
    var limit=Math.max(1,Math.min(1000,Number(options.limit||500)));
    var maxPages=Math.max(1,Math.min(100,Number(options.maxPages||50)));
    var full=options.full===true;
    var cursor=full?{updatedAt:"",documentId:""}:readTelegramCursor();
    var totals={downloaded:0,written:0,unchanged:0,skipped:0,pages:0};
    var operation="pull:telegram";
    try{lock(operation);}catch(error){return Promise.resolve({ok:false,blocked:true,message:error.message,periodoId:periodoId});}

    return ensure().then(function(){
      function next(page){
        return repository().list("estudiantes",{
          cursor:cursor,includeDeleted:true,limit:limit
        }).then(function(result){
          totals.pages+=1;
          totals.downloaded+=Number(result.total||0);
          var chain=Promise.resolve();
          (result.documents||[]).forEach(function(item){
            chain=chain.then(function(){
              var data=item.data||{};
              if(data.eliminado===true){totals.skipped+=1;return null;}
              var cedula=text(data.cedula||data.numeroIdentificacion||item.documentId);
              if(!cedula){totals.skipped+=1;return null;}
              return personasRepo().getByCedula(cedula).then(function(existing){
                if(!existing){totals.skipped+=1;return null;}
                var patch=telegramPatch(existing,data);
                if(!patch.changed){totals.unchanged+=1;return null;}
                return personasRepo().save(patch.row).then(function(){totals.written+=1;});
              });
            });
          });
          return chain.then(function(){
            var before=cursor;
            cursor=result.cursorAfter||cursor;
            var advanced=text(before.updatedAt)!==text(cursor.updatedAt)||text(before.documentId)!==text(cursor.documentId);
            if(result.hasMore&&page<maxPages&&advanced){return next(page+1);}
            if(result.hasMore&&!advanced){throw new Error("La actualización de Telegram no pudo avanzar en la paginación.");}
            return result;
          });
        });
      }
      return next(1);
    }).then(function(){
      writeTelegramCursor(cursor);
      var result={
        ok:true,periodoId:periodoId,downloaded:totals.downloaded,written:totals.written,
        unchanged:totals.unchanged,skipped:totals.skipped,pages:totals.pages,
        cursor:clone(cursor),scope:"telegram",telegramOnly:true,collection:"estudiantes",finishedAt:now()
      };
      state.lastResult=clone(result);
      emit("requisitos:firebase-telegram-refreshed",result);
      return result;
    }).catch(function(error){
      var result={ok:false,periodoId:periodoId,scope:"telegram",telegramOnly:true,message:error&&error.message?error.message:String(error),at:now()};
      state.lastError=result.message;
      state.lastResult=result;
      emit("requisitos:firebase-domain-error",result);
      return result;
    }).finally(unlock);
  }

  function status(){
    return {
      ok:!state.lastError,version:VERSION,maxBatchSize:MAX_BATCH_SIZE,
      running:state.running,operation:state.operation,startedAt:state.startedAt,
      lastError:state.lastError,lastResult:clone(state.lastResult),
      scopes:clone(SCOPES),analyses:Object.keys(state.analyses)
    };
  }

  window.RequisitosFirebaseOperationCenter={
    version:VERSION,
    maxBatchSize:MAX_BATCH_SIZE,
    scopes:clone(SCOPES),
    ensure:ensure,
    analyze:analyze,
    push:push,
    refreshTelegram:refreshTelegram,
    entityOf:entityOf,
    rowOwner:rowOwner,
    allowedRows:function(rows,scopeName){return allowedRows(rows,scopeOf(scopeName));},
    telegramPatch:telegramPatch,
    status:status,
    isRunning:function(){return state.running;}
  };

  emit("requisitos:firebase-operation-center-ready",{version:VERSION});
})(window,document);

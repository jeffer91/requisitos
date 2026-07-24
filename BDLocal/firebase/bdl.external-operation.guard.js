/* =========================================================
Nombre completo: bdl.external-operation.guard.js
Ruta: /BDLocal/firebase/bdl.external-operation.guard.js
Función:
- Mantener un único bloqueo para sincronización, descargas y migración.
- Evitar operaciones externas simultáneas entre Firebase, Sheets y Supabase.
- Congelar el período y los botones mientras una operación está activa.
- Revalidar las colecciones legacy antes de aplicar la migración V2.
- Crear una vista previa fresca y un nuevo respaldo justo antes de escribir.
- Detectar cambios de origen durante la vista previa o durante la aplicación.
- No borrar colecciones ni iniciar tareas automáticas.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-single-external-operation";
  var INSTALL_FLAG="__bdlExternalOperationGuardInstalled";
  var PATCH_FLAG="__bdlExternalOperationGuardPatched";
  var MAX_PATCH_ATTEMPTS=180;
  var patchAttempts=0;
  var patchTimer=null;
  var previewMeta=Object.create(null);
  var state={
    locked:false,
    owner:"",
    kind:"",
    token:"",
    startedAt:"",
    blocked:0,
    lastReleasedAt:""
  };

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function byId(id){return document.getElementById(id);}
  function migration(){return window.RequisitosFirebaseMigration||null;}

  function stable(value){
    if(value===null||value===undefined){return String(value);}
    if(typeof value!=="object"){return JSON.stringify(value);}
    if(Array.isArray(value)){return "["+value.map(stable).join(",")+"]";}
    return "{"+Object.keys(value).sort().map(function(key){return JSON.stringify(key)+":"+stable(value[key]);}).join(",")+"}";
  }

  function hashString(source){
    source=String(source==null?"":source);
    var result=2166136261;
    for(var index=0;index<source.length;index+=1){
      result^=source.charCodeAt(index);
      result+=(result<<1)+(result<<4)+(result<<7)+(result<<8)+(result<<24);
    }
    return "h"+(result>>>0).toString(16).padStart(8,"0");
  }

  function sourceSignature(raw){
    raw=raw||{};
    var parts=[];
    Object.keys(raw).sort().forEach(function(collection){
      var documents=raw[collection]&&raw[collection].documents||[];
      var ordered=documents.slice().sort(function(left,right){
        return text(left&&left.documentId).localeCompare(text(right&&right.documentId));
      });
      parts.push("collection="+collection,"count="+ordered.length);
      ordered.forEach(function(item){
        parts.push(text(item&&item.documentId),hashString(stable(item&&item.data||{})));
      });
    });
    return hashString(parts.join("|"));
  }

  function operationSelectors(){
    return [
      "#bl2-period-select",
      "#bl2-btn-push-google",
      "#bl2-btn-push-firebase",
      "#bl2-btn-push-supabase",
      "#bl2-btn-fetch-firebase-config",
      "#bl2-btn-pull-firebase-full-period",
      "#bl2-btn-correct-firebase-base",
      "#bl2-btn-migration-preview",
      "#bl2-btn-migration-apply",
      "[data-bdlc-action='test-firebase']",
      "[data-bdlc-action='preview-firebase']",
      "[data-bdlc-action='pull-firebase']",
      "[data-bdlc-action='test-sheets']",
      "[data-bdlc-action='test-supabase']"
    ].join(",");
  }

  function setUiLocked(locked){
    var nodes=[];
    try{nodes=Array.prototype.slice.call(document.querySelectorAll(operationSelectors()));}catch(error){}
    nodes.forEach(function(node){
      if(!node||!("disabled" in node)){return;}
      if(locked){
        if(node.disabled!==true){
          node.setAttribute("data-bdl-operation-gate-disabled","true");
          node.disabled=true;
        }
      }else if(node.getAttribute("data-bdl-operation-gate-disabled")==="true"){
        node.removeAttribute("data-bdl-operation-gate-disabled");
        node.disabled=false;
      }
    });
  }

  function emit(){
    try{
      window.dispatchEvent(new CustomEvent("bdlocal:external-operation-lock-changed",{
        detail:status()
      }));
    }catch(error){}
  }

  function acquire(owner,meta){
    owner=text(owner||"external-operation");
    meta=meta||{};
    if(state.locked){
      state.blocked+=1;
      return {
        ok:false,
        blocked:true,
        owner:state.owner,
        kind:state.kind,
        startedAt:state.startedAt,
        message:"Ya existe una operación externa en curso: "+state.owner+"."
      };
    }
    state.locked=true;
    state.owner=owner;
    state.kind=text(meta.kind||owner.split(":")[0]||"external");
    state.token="external__"+Date.now()+"__"+Math.random().toString(16).slice(2);
    state.startedAt=now();
    setUiLocked(true);
    emit();
    return {ok:true,token:state.token,owner:state.owner,kind:state.kind,startedAt:state.startedAt};
  }

  function release(token){
    if(!state.locked){return true;}
    if(text(token)!==state.token){return false;}
    state.locked=false;
    state.owner="";
    state.kind="";
    state.token="";
    state.startedAt="";
    state.lastReleasedAt=now();
    setUiLocked(false);
    emit();
    return true;
  }

  function withLock(owner,work,meta){
    var lock=acquire(owner,meta||{});
    if(!lock.ok){return Promise.reject(new Error(lock.message));}
    return Promise.resolve().then(function(){return typeof work==="function"?work(lock):work;}).finally(function(){release(lock.token);});
  }

  function status(){
    return {
      version:VERSION,
      locked:state.locked,
      owner:state.owner,
      kind:state.kind,
      startedAt:state.startedAt,
      blocked:state.blocked,
      lastReleasedAt:state.lastReleasedAt,
      manualOnly:true,
      automatic:false,
      destructive:false
    };
  }

  function invalidateMigrationUi(message){
    var apply=byId("bl2-btn-migration-apply");
    if(apply){apply.disabled=true;}
    var statusBox=byId("bl2-firebase-migration-status");
    if(statusBox){
      statusBox.className="bdlc-placeholder";
      statusBox.innerHTML="<strong>Vista previa invalidada</strong><span>"+text(message).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+"</span>";
    }
  }

  function readSignature(api,options){
    if(!api||typeof api.readAllLegacy!=="function"){
      return Promise.reject(new Error("La lectura legacy de migración no está disponible."));
    }
    return api.readAllLegacy(Object.assign({limit:400,maxPages:500},options||{})).then(function(raw){
      return {signature:sourceSignature(raw),raw:raw};
    });
  }

  function rememberPreview(result,signature){
    if(!result||!text(result.token)){return result;}
    previewMeta[text(result.token)]={
      token:text(result.token),
      fingerprint:text(result.fingerprint),
      sourceFingerprint:text(signature),
      counts:clone(result.counts||{}),
      backupId:text(result.backup&&result.backup.backupId),
      createdAt:now()
    };
    var keys=Object.keys(previewMeta);
    if(keys.length>6){
      keys.sort(function(a,b){return text(previewMeta[a]&&previewMeta[a].createdAt).localeCompare(text(previewMeta[b]&&previewMeta[b].createdAt));});
      keys.slice(0,keys.length-6).forEach(function(key){delete previewMeta[key];});
    }
    result.sourceFingerprint=text(signature);
    result.sourceStable=true;
    result.operationGuardVersion=VERSION;
    return result;
  }

  function patchMigration(){
    var api=migration();
    if(!api||api[PATCH_FLAG]){return !!api;}
    if(typeof api.preview!=="function"||typeof api.apply!=="function"||typeof api.readAllLegacy!=="function"){return false;}

    var originalPreview=api.preview.bind(api);
    var originalApply=api.apply.bind(api);
    var originalReset=typeof api.resetPreview==="function"?api.resetPreview.bind(api):function(){return true;};

    api.preview=function(options){
      options=Object.assign({limit:400,maxPages:500},options||{});
      return withLock("migration:preview",function(){
        var before="";
        return readSignature(api,options).then(function(check){
          before=check.signature;
          return originalPreview(options);
        }).then(function(result){
          return readSignature(api,options).then(function(check){
            if(before!==check.signature){
              originalReset();
              invalidateMigrationUi("Los datos legacy cambiaron mientras se generaba la vista previa. Genérela nuevamente.");
              throw new Error("Los datos legacy cambiaron durante la vista previa. No se habilitó la migración.");
            }
            return rememberPreview(result,check.signature);
          });
        });
      },{kind:"migration-preview"});
    };

    api.apply=function(previewToken,confirmation,options){
      options=Object.assign({},options||{});
      return withLock("migration:apply",function(){
        var previous=previewMeta[text(previewToken)];
        if(!previous){
          invalidateMigrationUi("La vista previa segura ya no está disponible. Genere una nueva.");
          return Promise.reject(new Error("La vista previa segura ya no está disponible. Genere una nueva."));
        }

        var readOptions={limit:400,maxPages:500};
        var before="";
        var stableBeforeApply="";
        var fresh=null;

        return readSignature(api,readOptions).then(function(check){
          before=check.signature;
          return originalPreview(readOptions);
        }).then(function(result){
          fresh=result;
          return readSignature(api,readOptions);
        }).then(function(check){
          stableBeforeApply=check.signature;
          if(before!==stableBeforeApply){
            originalReset();
            invalidateMigrationUi("Los datos legacy cambiaron durante la revalidación. Genere otra vista previa.");
            throw new Error("Los datos legacy cambiaron durante la revalidación previa a la escritura.");
          }
          if(previous.sourceFingerprint!==stableBeforeApply){
            originalReset();
            invalidateMigrationUi("Los datos legacy cambiaron desde la vista previa revisada. Debe revisar una nueva vista previa.");
            throw new Error("Los datos legacy cambiaron desde la vista previa. La migración fue bloqueada antes de escribir.");
          }
          if(fresh.errors&&fresh.errors.length){
            originalReset();
            invalidateMigrationUi("La revalidación encontró errores de transformación.");
            throw new Error("La revalidación encontró errores de transformación. No se escribió información.");
          }
          return originalApply(fresh.token,confirmation,options);
        }).then(function(result){
          return readSignature(api,readOptions).then(function(finalCheck){
            result=Object.assign({},result||{}, {
              previewRefreshedBeforeApply:true,
              previewConsumed:true,
              sourceFingerprint:stableBeforeApply,
              freshBackupId:text(fresh&&fresh.backup&&fresh.backup.backupId),
              operationGuardVersion:VERSION
            });
            delete previewMeta[text(previewToken)];
            if(finalCheck.signature!==stableBeforeApply){
              result.ok=false;
              result.sourceChangedDuringApply=true;
              result.needsNewPreview=true;
              result.message="La migración terminó de forma no destructiva, pero los datos legacy cambiaron durante el proceso. Genere una nueva vista previa para completar los cambios recientes.";
            }else{
              result.sourceStableDuringApply=true;
            }
            window.setTimeout(function(){var button=byId("bl2-btn-migration-apply");if(button){button.disabled=true;}},0);
            return result;
          });
        });
      },{kind:"migration-apply"});
    };

    api[PATCH_FLAG]=true;
    api.operationGuardVersion=VERSION;
    api.sourceSignature=sourceSignature;
    return true;
  }

  function patchSyncV2(){
    var api=window.BDLSyncV2;
    if(!api||api[PATCH_FLAG]||typeof api.request!=="function"){return !!api;}
    var original=api.request.bind(api);
    var wrapped=function(options){
      options=Object.assign({},options||{});
      var targets=Array.isArray(options.targets)?options.targets.join(","):text(options.target||"queue");
      return withLock("sync:"+(targets||"queue"),function(){return original(options);},{kind:"sync"});
    };
    api.request=wrapped;
    api.syncQueue=wrapped;
    api[PATCH_FLAG]=true;
    api.operationGuardVersion=VERSION;
    return true;
  }

  function wrapMethod(api,name,owner,kind){
    if(!api||typeof api[name]!=="function"){return false;}
    if(api[name][PATCH_FLAG]){return true;}
    var original=api[name].bind(api);
    var wrapped=function(){
      var args=Array.prototype.slice.call(arguments);
      return withLock(owner,function(){return original.apply(null,args);},{kind:kind});
    };
    wrapped[PATCH_FLAG]=true;
    wrapped.__original=original;
    api[name]=wrapped;
    return true;
  }

  function patchFirebaseReads(){
    var api=window.BL2FirebaseGuard;
    if(!api){return false;}
    wrapMethod(api,"pullFirebaseToLocal","firebase:download","firebase-read");
    wrapMethod(api,"pullAllFirebaseToLocal","firebase:download-all","firebase-read");
    wrapMethod(api,"previewFirebase","firebase:compare","firebase-read");
    wrapMethod(api,"previewAllFirebase","firebase:compare-all","firebase-read");
    api.operationGuardVersion=VERSION;
    return true;
  }

  function patchPushControl(){
    var api=window.RequisitosFirebasePushControl;
    if(!api){return false;}
    wrapMethod(api,"run","firebase:push-control","sync");
    api.operationGuardVersion=VERSION;
    return true;
  }

  function patchAll(){
    patchMigration();
    patchSyncV2();
    patchFirebaseReads();
    patchPushControl();
    return !!migration()&&!!window.BDLSyncV2;
  }

  function schedulePatch(delay){
    if(patchTimer||patchAttempts>=MAX_PATCH_ATTEMPTS){return;}
    patchTimer=window.setTimeout(function(){
      patchTimer=null;
      patchAttempts+=1;
      if(!patchAll()){schedulePatch(patchAttempts<30?80:220);}
    },Math.max(30,Number(delay||60)));
  }

  window.BDLExternalOperationGate={
    version:VERSION,
    manualOnly:true,
    automatic:false,
    destructive:false,
    acquire:acquire,
    release:release,
    withLock:withLock,
    isLocked:function(){return state.locked;},
    status:status,
    sourceSignature:sourceSignature,
    patchAll:patchAll
  };

  if(!window[INSTALL_FLAG]){
    window[INSTALL_FLAG]=true;
    [
      "DOMContentLoaded",
      "bdlocal:bl2-html-scripts-loaded",
      "requisitos:arquitectura-compartida-lista",
      "requisitos:firebase-migration-ready",
      "requisitos:firebase-redesign-ready",
      "bdlocal:outbox-bridge-ready"
    ].forEach(function(name){window.addEventListener(name,function(){patchAttempts=0;schedulePatch(20);});});
  }

  patchAll();
  schedulePatch(30);
})(window,document);

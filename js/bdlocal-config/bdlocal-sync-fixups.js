/* =========================================================
Nombre completo: bdlocal-sync-fixups.js
Ruta o ubicación: /js/bdlocal-config/bdlocal-sync-fixups.js
Función o funciones:
- Mantener una sola puerta manual de escritura externa.
- Reafirmar EstudiantesPeriodo como colección académica.
- Mostrar Estudiantes como colección personal y de Telegram.
- Delegar compare/download académicos en BL2FirebaseGuard.
- Cargar Telegram y mantenimientos sin observadores globales del DOM.
- Impedir ciclos de renderizado y tareas automáticas durante el arranque.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="3.6.0-manual-no-dom-observer";
  var MAX=25;

  var installed=false;
  var bound=false;
  var patching=false;
  var supportLoading=null;
  var telegramLoading=null;
  var firebaseRepairLoading=null;
  var localRepairLoading=null;

  function text(value){
    return String(value==null?"":value).trim();
  }

  function limit(value){
    value=Math.floor(Number(value||MAX));
    return Math.min(MAX,Math.max(1,value||MAX));
  }

  function outbox(){
    return window.BDLSyncOutbox||null;
  }

  function firebaseConfig(){
    return {
      enabled:true,
      mode:"manual",
      manualOnly:true,
      automatic:false,
      collection:"EstudiantesPeriodo",
      academicCollection:"EstudiantesPeriodo",
      personCollection:"Estudiantes",
      telegramCollection:"Estudiantes",
      documentIdStrategy:"periodoId__cedula",
      academicDocumentIdStrategy:"periodoId__cedula",
      personDocumentIdStrategy:"cedula",
      excludeTelegramFromAcademic:true,
      telegramAutoPull:false,
      telegramMaxReads:25,
      telegramRecheckDays:7,
      identityRepairManualOnly:true,
      identityRepairScanLimit:15,
      identityRepairMaxCorrections:10,
      localIdentityRepairManualOnly:true,
      localIdentityRepairMaxIdentities:25,
      batchSize:25,
      maxBatchSize:25,
      deleteAllowed:false,
      previewBeforePull:true,
      backupBeforePull:true,
      protectLocalPending:true
    };
  }

  function enforce(){
    var cfg=window.BL2Config=window.BL2Config||{};
    cfg.sync=Object.assign({},cfg.sync||{}, {
      mode:"manual",
      manualOnly:true,
      automatic:false,
      syncOnIdle:false,
      syncOnClose:false,
      maxBatchSize:25
    });
    cfg.firebase=Object.assign({},cfg.firebase||{},firebaseConfig());

    try{
      var store=window.BDLocalConfigStore;
      if(store&&typeof store.patchConfig==="function"){
        store.patchConfig({
          sync:{
            mode:"manual",
            manualOnly:true,
            automatic:false,
            syncOnIdle:false,
            syncOnClose:false,
            maxBatchSize:25
          },
          firebase:firebaseConfig()
        });
      }
    }catch(error){}

    return cfg.firebase;
  }

  function selectedPeriod(){
    try{
      if(window.BL2App&&typeof window.BL2App.getSelectedPeriod==="function"){
        var selected=window.BL2App.getSelectedPeriod();
        if(selected&&text(selected.id)){
          return Promise.resolve({
            id:text(selected.id),
            label:text(selected.label||selected.id)
          });
        }
      }
    }catch(error){}

    return window.BL2Core&&typeof window.BL2Core.getActivePeriod==="function"
      ?window.BL2Core.getActivePeriod().then(function(period){
        return period&&text(period.id)
          ?{id:text(period.id),label:text(period.label||period.periodoLabel||period.id)}
          :null;
      })
      :Promise.resolve(null);
  }

  function request(target,options){
    options=Object.assign({},options||{});

    if(options.manual!==true){
      return Promise.resolve({
        ok:false,
        blocked:true,
        target:target,
        message:"Solicitud automática de escritura bloqueada."
      });
    }

    if(!window.BDLSyncV2||typeof window.BDLSyncV2.request!=="function"){
      return Promise.reject(new Error("BDLSyncV2 no está disponible."));
    }

    var periodPromise=text(options.periodoId)
      ?Promise.resolve({
        id:text(options.periodoId),
        label:text(options.periodoLabel||options.periodoId)
      })
      :selectedPeriod();

    return periodPromise.then(function(period){
      if(!period){throw new Error("Seleccione un período.");}

      var size=limit(options.limit||options.batchSize);
      return window.BDLSyncV2.request({
        manual:true,
        automatic:false,
        source:text(options.source||"BDLocalSyncFixups.manual."+target),
        targets:[target],
        periodoId:period.id,
        periodoLabel:period.label,
        limit:size,
        batchSize:size
      });
    });
  }

  function count(target,periodoId){
    var queue=outbox();
    if(!queue||typeof queue.counts!=="function"){return Promise.resolve(0);}

    return queue.counts({periodoId:periodoId}).then(function(counts){
      var detail=counts&&counts.detail&&counts.detail[target]||{};
      return Number(detail.pending||0)+
        Number(detail.error||0)+
        Number(detail.blocked||0)+
        Number(detail.waitingRetry||0);
    }).catch(function(){
      return 0;
    });
  }

  function confirmed(target,options){
    options=Object.assign({},options||{});

    return selectedPeriod().then(function(period){
      if(!period){throw new Error("Seleccione un período.");}

      return count(target,period.id).then(function(total){
        if(!total&&!options.forceRetry){
          return {
            ok:true,
            skipped:true,
            target:target,
            message:"No existen pendientes."
          };
        }

        var size=limit(options.limit||options.batchSize);

        if(options.confirm!==false){
          var note=target==="firebase"
            ?"\nColección: EstudiantesPeriodo\nTelegram no se modifica"
            :"";

          if(!window.confirm(
            "Sincronización manual\n\n"+
            "Destino: "+target+"\n"+
            "Período: "+period.label+"\n"+
            "Pendientes: "+total+"\n"+
            "Máximo: "+Math.min(size,total||size)+note+
            "\n\n¿Continuar?"
          )){
            return {ok:true,cancelled:true,target:target};
          }
        }

        return request(target,{
          manual:true,
          periodoId:period.id,
          periodoLabel:period.label,
          limit:size,
          batchSize:size,
          source:"BDLocalSyncFixups.confirmed."+target
        });
      });
    });
  }

  function patchManager(){
    var manager=window.BDLocalSyncManager;
    if(!manager){return false;}

    manager.pushLocalToSheets=function(options){
      return request("google",Object.assign({},options||{}, {
        source:"BDLocalSyncManager.google"
      }));
    };

    manager.pushLocalToFirebase=function(options){
      return request("firebase",Object.assign({},options||{}, {
        source:"BDLocalSyncManager.firebase"
      }));
    };

    manager.pushLocalToSupabase=function(options){
      return request("supabase",Object.assign({},options||{}, {
        source:"BDLocalSyncManager.supabase"
      }));
    };

    manager.syncQueue=function(options){
      options=Object.assign({},options||{});

      if(options.manual!==true){
        return Promise.resolve({
          ok:false,
          blocked:true,
          message:"Cola automática bloqueada."
        });
      }

      return selectedPeriod().then(function(period){
        if(!period){throw new Error("Seleccione un período.");}

        var size=limit(options.limit||options.batchSize);
        return window.BDLSyncV2.request({
          manual:true,
          automatic:false,
          source:"BDLocalSyncManager.queue",
          targets:options.targets||["google","firebase","supabase"],
          periodoId:period.id,
          periodoLabel:period.label,
          limit:size,
          batchSize:size
        });
      });
    };

    manager.syncAll=manager.syncQueue;
    manager.__singleSyncGateInstalled=true;
    return true;
  }

  function patchSync(){
    var legacy=window.BL2Sync;
    if(!legacy){return false;}

    legacy.syncGoogle=function(options){
      return request("google",Object.assign({},options||{}, {
        source:"BL2Sync.google"
      }));
    };

    legacy.syncFirebase=function(options){
      options=options||{};
      var action=text(options.action||"upload").toLowerCase();

      if(action==="compare"||action==="download"){
        var guard=window.BL2FirebaseGuard;
        if(!guard||typeof guard.pullFirebaseToLocal!=="function"){
          return Promise.reject(new Error("BL2FirebaseGuard no está disponible."));
        }
        return guard.pullFirebaseToLocal(
          {
            id:options.periodoId,
            label:options.periodoLabel||options.periodoId
          },
          {
            confirm:options.confirm!==false,
            previewOnly:action==="compare"
          }
        );
      }

      return request("firebase",Object.assign({},options, {
        source:"BL2Sync.firebase"
      }));
    };

    legacy.maybeSyncGoogleIdle=function(){
      return Promise.resolve({ok:false,blocked:true,manualOnly:true});
    };

    legacy.maybeSyncFirebaseDaily=function(){
      return Promise.resolve({ok:false,blocked:true,manualOnly:true});
    };

    legacy.syncBeforeClose=function(){
      return Promise.resolve({ok:true,skipped:true,manualOnly:true});
    };

    legacy.__singleSyncGateInstalled=true;
    return true;
  }

  function patchUI(){
    var ui=window.BDLSyncUIBridge;
    if(!ui){return false;}

    ui.runTarget=function(target,options){
      return confirmed(text(target).toLowerCase(),options||{});
    };

    ui.__singleSyncGateInstalled=true;
    return true;
  }

  function saveSheets(){
    var field=document.getElementById("bdlc-sheets-token");
    var store=window.BDLocalConfigStore;

    if(
      !field||
      !store||
      typeof store.getSheetsConfig!=="function"||
      typeof store.setSheetsConfig!=="function"
    ){
      return;
    }

    var current=store.getSheetsConfig({includeSecret:true})||{};
    store.setSheetsConfig({
      enabled:current.enabled,
      appsScriptUrl:current.appsScriptUrl,
      token:text(field.value),
      spreadsheetId:current.spreadsheetId,
      sheetName:current.sheetName,
      batchSize:current.batchSize
    });
  }

  function setInputValue(node,value){
    if(node&&text(node.value)!==value){node.value=value;}
  }

  function patchVisibleConfig(){
    if(patching){return false;}
    patching=true;

    try{
      var changed=false;
      var academic=document.getElementById("bdlc-firebase-collection");
      var strategy=document.getElementById("bdlc-firebase-document-id");

      if(academic&&text(academic.value)!=="EstudiantesPeriodo"){
        academic.value="EstudiantesPeriodo";
        changed=true;
      }

      if(strategy&&text(strategy.value)!=="periodoId__cedula"){
        strategy.value="periodoId__cedula";
        changed=true;
      }

      if(academic&&!document.getElementById("bdlc-firebase-person-collection")){
        var field=academic.closest
          ?academic.closest(".bdlc-field")
          :academic.parentNode;

        if(field&&field.parentNode){
          var node=document.createElement("div");
          node.className="bdlc-field";
          node.innerHTML=
            '<label class="bdlc-label">Colección persona y Telegram</label>'+
            '<input id="bdlc-firebase-person-collection" class="bdlc-input" '+
            'value="Estudiantes" readonly>';
          field.parentNode.insertBefore(node,field.nextSibling);
          changed=true;
        }
      }

      var person=document.getElementById("bdlc-firebase-person-collection");
      setInputValue(person,"Estudiantes");

      Array.prototype.forEach.call(
        document.querySelectorAll(".bdlc-connection-card"),
        function(card){
          var title=card.querySelector("h3");
          var description=card.querySelector(".bdlc-connection-head p");
          var message=
            "EstudiantesPeriodo guarda datos académicos; "+
            "Estudiantes conserva persona y Telegram.";

          if(
            title&&
            text(title.textContent)==="Firebase"&&
            description&&
            text(description.textContent)!==message
          ){
            description.textContent=message;
            changed=true;
          }
        }
      );

      return changed;
    }finally{
      patching=false;
    }
  }

  function scriptUrl(src){
    try{return new URL(src,document.baseURI).href;}
    catch(error){return src;}
  }

  function existingScript(src){
    var url=scriptUrl(src);
    return Array.prototype.find.call(document.scripts||[],function(script){
      return script.src===url||
        script.getAttribute("data-bdl-module-loader-src")===url;
    })||null;
  }

  function waitForGlobal(globalName,timeoutMs){
    return new Promise(function(resolve){
      var started=Date.now();

      function check(){
        if(window[globalName]){
          resolve(window[globalName]);
          return;
        }

        if(Date.now()-started>=timeoutMs){
          resolve(null);
          return;
        }

        window.setTimeout(check,50);
      }

      check();
    });
  }

  function loadModule(globalName,sources,getLoading,setLoading){
    if(window[globalName]){return Promise.resolve(window[globalName]);}
    if(getLoading()){return getLoading();}

    sources=(Array.isArray(sources)?sources:[]).slice();

    var pending=new Promise(function(resolve){
      function next(){
        if(window[globalName]){
          resolve(window[globalName]);
          return;
        }

        var src=sources.shift();
        if(!src){
          resolve(null);
          return;
        }

        var found=existingScript(src);
        if(found){
          waitForGlobal(globalName,5000).then(function(module){
            if(module){resolve(module);}
            else{next();}
          });
          return;
        }

        var script=document.createElement("script");
        var url=scriptUrl(src);
        script.src=url;
        script.async=false;
        script.defer=false;
        script.setAttribute("data-bdl-module-loader",globalName);
        script.setAttribute("data-bdl-module-loader-src",url);

        script.onload=function(){
          if(window[globalName]){resolve(window[globalName]);}
          else{next();}
        };

        script.onerror=function(){
          next();
        };

        (document.body||document.head||document.documentElement).appendChild(script);
      }

      next();
    }).catch(function(error){
      try{console.warn("[BDLocalSyncFixups]",error);}
      catch(inner){}
      return null;
    }).finally(function(){
      setLoading(null);
    });

    setLoading(pending);
    return pending;
  }

  function loadTelegramModule(){
    return loadModule(
      "BDLFirebaseTelegramPull",
      [
        "sync/bdl.firebase.telegram-pull.js",
        "../BDLocal/sync/bdl.firebase.telegram-pull.js"
      ],
      function(){return telegramLoading;},
      function(value){telegramLoading=value;}
    );
  }

  function loadFirebaseIdentityRepairModule(){
    return loadModule(
      "BDLFirebaseIdentityRepair",
      [
        "maintenance/bdl.firebase.identity-repair.js",
        "../BDLocal/maintenance/bdl.firebase.identity-repair.js"
      ],
      function(){return firebaseRepairLoading;},
      function(value){firebaseRepairLoading=value;}
    );
  }

  function loadLocalIdentityRepairModule(){
    return loadModule(
      "BDLLocalIdentityRepair",
      [
        "maintenance/bdl.local.identity-repair.js",
        "../BDLocal/maintenance/bdl.local.identity-repair.js"
      ],
      function(){return localRepairLoading;},
      function(value){localRepairLoading=value;}
    );
  }

  function mountMaintenanceModules(){
    var slot=document.getElementById("bl2-maintenance-slot");
    if(!slot){return false;}

    if(
      window.BDLFirebaseIdentityRepair&&
      typeof window.BDLFirebaseIdentityRepair.mount==="function"
    ){
      window.BDLFirebaseIdentityRepair.mount(slot);
    }

    if(
      window.BDLLocalIdentityRepair&&
      typeof window.BDLLocalIdentityRepair.mount==="function"
    ){
      window.BDLLocalIdentityRepair.mount(slot);
    }

    return true;
  }

  function renderFeatureModules(){
    patchVisibleConfig();

    if(
      window.BDLFirebaseTelegramPull&&
      typeof window.BDLFirebaseTelegramPull.renderUI==="function"
    ){
      window.BDLFirebaseTelegramPull.renderUI();
    }

    mountMaintenanceModules();
  }

  function loadSupportModules(){
    if(supportLoading){return supportLoading;}

    supportLoading=Promise.allSettled([
      loadTelegramModule(),
      loadFirebaseIdentityRepairModule(),
      loadLocalIdentityRepairModule()
    ]).then(function(){
      renderFeatureModules();
      return {
        telegram:!!window.BDLFirebaseTelegramPull,
        firebaseIdentityRepair:!!window.BDLFirebaseIdentityRepair,
        localIdentityRepair:!!window.BDLLocalIdentityRepair
      };
    }).finally(function(){
      supportLoading=null;
    });

    return supportLoading;
  }

  function bind(){
    if(bound){return;}
    bound=true;

    document.addEventListener("click",function(event){
      var button=event.target&&event.target.closest
        ?event.target.closest("[data-bdlc-action]")
        :null;
      var action=button
        ?text(button.getAttribute("data-bdlc-action"))
        :"";

      if(action==="save-sheets"){
        saveSheets();
      }

      if(action==="save-firebase"){
        window.setTimeout(function(){
          enforce();
          renderFeatureModules();
        },0);
      }
    },true);
  }

  function install(){
    enforce();
    bind();

    var manager=patchManager();
    var legacy=patchSync();
    var ui=patchUI();

    installed=manager||legacy||ui||installed;
    renderFeatureModules();

    window.setTimeout(function(){
      loadSupportModules().catch(function(){});
    },0);

    return {
      ok:installed,
      manager:manager,
      legacy:legacy,
      ui:ui,
      academicCollection:"EstudiantesPeriodo",
      personCollection:"Estudiantes",
      telegramAutoPull:false,
      domObserver:false,
      telegramModule:!!window.BDLFirebaseTelegramPull,
      firebaseIdentityRepairModule:!!window.BDLFirebaseIdentityRepair,
      localIdentityRepairModule:!!window.BDLLocalIdentityRepair
    };
  }

  window.BDLocalSyncFixups={
    version:VERSION,
    compatibilityOnly:true,
    manualOnly:true,
    automatic:false,
    maxBatchSize:MAX,
    install:install,
    enforceFirebaseSplit:enforce,
    patchFirebaseUI:patchVisibleConfig,
    renderFeatureModules:renderFeatureModules,
    loadSupportModules:loadSupportModules,
    requestTarget:request,
    confirmedTarget:confirmed,
    saveSheetsAccess:saveSheets,
    loadTelegramModule:loadTelegramModule,
    loadFirebaseIdentityRepairModule:loadFirebaseIdentityRepairModule,
    loadIdentityRepairModule:loadFirebaseIdentityRepairModule,
    loadLocalIdentityRepairModule:loadLocalIdentityRepairModule,
    status:function(){
      return {
        version:VERSION,
        installed:installed,
        manager:!!(
          window.BDLocalSyncManager&&
          window.BDLocalSyncManager.__singleSyncGateInstalled
        ),
        legacy:!!(
          window.BL2Sync&&
          window.BL2Sync.__singleSyncGateInstalled
        ),
        ui:!!(
          window.BDLSyncUIBridge&&
          window.BDLSyncUIBridge.__singleSyncGateInstalled
        ),
        academicCollection:"EstudiantesPeriodo",
        personCollection:"Estudiantes",
        telegramAutoPull:false,
        domObserver:false,
        supportLoading:!!supportLoading,
        telegramModule:!!window.BDLFirebaseTelegramPull,
        firebaseIdentityRepairModule:!!window.BDLFirebaseIdentityRepair,
        localIdentityRepairModule:!!window.BDLLocalIdentityRepair
      };
    }
  };

  window.addEventListener("bdlocal:bl2-html-scripts-loaded",function(){
    install();
  });

  window.addEventListener("bl2:ready",function(){
    install();
  });

  window.addEventListener("bl2:app-refreshed",function(){
    enforce();
    patchManager();
    patchSync();
    patchUI();
    renderFeatureModules();
  });

  window.addEventListener("bdlocal:config-ui-rendered",function(){
    enforce();
    renderFeatureModules();
  });
})(window,document);

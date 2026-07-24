/* =========================================================
Nombre completo: bdl.firebase.control-center.js
Ruta: /BDLocal/firebase/bdl.firebase.control-center.js
Función:
- Conectar los controles Firebase del Centro BDLocal con el motor V2.
- Descargar el período activo o todos los períodos de forma incremental.
- Permitir una relectura completa explícita del período seleccionado.
- Mostrar estado, lecturas, escrituras, cursores y conflictos abiertos.
- Sustituir los listeners Firebase heredados sin tocar los controles Google.
- Mantener todas las operaciones exclusivamente manuales.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-control-center-v2";
  var FLAG="__firebaseV2ControlCenterBound";
  var running=false;
  var refreshTimer=null;

  function text(value){return String(value==null?"":value).trim();}
  function byId(id){return document.getElementById(id);}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function engine(){return window.RequisitosFirebaseSyncEngine||null;}
  function repository(){return window.RequisitosFirebaseRepository||null;}
  function conflicts(){return window.BDLRepoConflictos||null;}
  function core(){return window.BL2Core||null;}

  function selectedPeriod(){
    try{
      if(window.RequisitosPeriodoGlobal&&typeof window.RequisitosPeriodoGlobal.get==="function"){
        var globalPeriod=window.RequisitosPeriodoGlobal.get();
        if(globalPeriod&&text(globalPeriod.id)){return {id:text(globalPeriod.id),label:text(globalPeriod.label||globalPeriod.id)};}
      }
    }catch(error){}
    try{
      if(window.BL2App&&typeof window.BL2App.getSelectedPeriod==="function"){
        var selected=window.BL2App.getSelectedPeriod();
        if(selected&&text(selected.id)){return {id:text(selected.id),label:text(selected.label||selected.id)};}
      }
    }catch(error){}
    var select=byId("bl2-period-select");
    var id=text(select&&select.value);
    var option=select&&select.selectedOptions&&select.selectedOptions[0];
    return id?{id:id,label:text(option&&option.textContent||id)}:null;
  }

  function waitReady(timeoutMs){
    timeoutMs=Math.max(1000,Number(timeoutMs||10000));
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        if(engine()&&repository()&&conflicts()){resolve(true);return;}
        if(window.BDLOutboxBridge&&typeof window.BDLOutboxBridge.loadSharedArchitecture==="function"){
          window.BDLOutboxBridge.loadSharedArchitecture().catch(function(){});
        }
        if(Date.now()-started>=timeoutMs){reject(new Error("La arquitectura Firebase V2 no terminó de cargar."));return;}
        window.setTimeout(check,80);
      })();
    });
  }

  function log(message,level){
    var box=byId("bl2-log");
    if(box){
      var item=document.createElement("div");
      item.className="bl2-log-item "+(level?"is-"+level:"");
      item.innerHTML="<strong>Firebase V2</strong><span>"+esc(message)+"</span>";
      box.insertBefore(item,box.firstChild);
    }
    try{
      if(core()&&typeof core().log==="function"){
        core().log(level==="error"?"ERROR":level==="warn"?"WARN":"INFO",message,{source:"firebase_control_center"}).catch(function(){});
      }
    }catch(error){}
  }

  function progress(percent,detail){
    try{
      window.dispatchEvent(new CustomEvent("bl2:sync-progress",{detail:{
        target:"Firebase",percent:Math.max(0,Math.min(100,Number(percent||0))),detail:text(detail),at:now()
      }}));
    }catch(error){}
  }

  function ensurePanel(){
    var status=byId("bl2-firebase-status");
    var card=status&&status.closest?status.closest(".bdlc-connection-card"):null;
    if(!card){return null;}

    var title=card.querySelector("h3");
    var copy=card.querySelector(".bdlc-connection-head p");
    if(title){title.textContent="Firebase · base oficial";}
    if(copy){copy.textContent="Fuente oficial; BDLocal conserva una copia rápida y sin conexión.";}

    if(!byId("bl2-firebase-v2-detail")){
      var detail=document.createElement("div");
      detail.id="bl2-firebase-v2-detail";
      detail.className="bdlc-card-grid two";
      detail.innerHTML=
        '<article class="bdlc-card bdlc-kpi-card"><span>Última operación</span><strong id="bl2-firebase-last-sync">Sin ejecutar</strong><small id="bl2-firebase-last-mode">Solo manual</small></article>'+
        '<article class="bdlc-card bdlc-kpi-card"><span>Conflictos abiertos</span><strong id="bl2-firebase-conflict-count">0</strong><small>No se sobrescriben automáticamente</small></article>'+
        '<article class="bdlc-card bdlc-kpi-card"><span>Documentos leídos</span><strong id="bl2-firebase-read-count">0</strong><small id="bl2-firebase-query-count">0 consultas</small></article>'+
        '<article class="bdlc-card bdlc-kpi-card"><span>Documentos escritos</span><strong id="bl2-firebase-write-count">0</strong><small id="bl2-firebase-engine-version">Motor V2</small></article>';
      var actions=card.querySelector(".bdlc-actions");
      if(actions){card.insertBefore(detail,actions);}else{card.appendChild(detail);}
    }

    if(!byId("bl2-firebase-conflicts-list")){
      var conflictsBox=document.createElement("div");
      conflictsBox.id="bl2-firebase-conflicts-list";
      conflictsBox.className="bdlc-placeholder";
      conflictsBox.innerHTML="<strong>Conflictos</strong><span>No existen conflictos abiertos.</span>";
      card.appendChild(conflictsBox);
    }

    var actionsBox=card.querySelector(".bdlc-actions");
    if(actionsBox&&!byId("bl2-btn-pull-firebase-full-period")){
      var full=document.createElement("button");
      full.id="bl2-btn-pull-firebase-full-period";
      full.className="bdlc-button subtle";
      full.type="button";
      full.textContent="Releer período";
      actionsBox.appendChild(full);
    }

    var configButton=byId("bl2-btn-fetch-firebase-config");
    if(configButton){configButton.textContent="Actualizar estado";}

    var eyebrow=document.querySelector(".bl2-eyebrow");
    if(eyebrow){eyebrow.textContent="Caché local de la aplicación";}
    var footer=document.querySelector(".bdlc-sidebar-footer");
    if(footer){footer.innerHTML="<span></span>Firebase oficial · BDLocal caché";}

    return card;
  }

  function replaceControl(id,handler){
    var current=byId(id);
    if(!current){return null;}
    var button=current.cloneNode(true);
    current.parentNode.replaceChild(button,current);
    button.__singleSafePullBound=true;
    button.__firebaseV2ControlBound=true;
    button.setAttribute("data-cloud-pull-owner","firebase-v2");
    button.addEventListener("click",function(event){
      event.preventDefault();
      event.stopPropagation();
      Promise.resolve().then(handler).catch(function(error){
        log(error&&error.message?error.message:String(error),"error");
        window.alert(error&&error.message?error.message:String(error));
      });
    },true);
    return button;
  }

  function setBusy(value,label){
    running=!!value;
    ["bl2-btn-pull-firebase","bl2-btn-pull-firebase-all","bl2-btn-pull-firebase-full-period","bl2-btn-fetch-firebase-config","bl2-btn-push-firebase"].forEach(function(id){
      var button=byId(id);if(button){button.disabled=running;}
    });
    var status=byId("bl2-firebase-status");
    if(status&&label){status.textContent=label;}
  }

  function totalsOf(result){
    var totals={downloaded:0,written:0,removed:0,conflicts:0,rejected:0,pages:0,periods:0};
    function add(item){
      if(!item){return;}
      if(Array.isArray(item)){item.forEach(add);return;}
      if(item.results&&Array.isArray(item.results)){item.results.forEach(add);}
      totals.downloaded+=Number(item.downloaded||0);
      totals.written+=Number(item.written||0);
      totals.removed+=Number(item.removed||0);
      totals.conflicts+=Number(item.conflicts||0);
      totals.rejected+=Number(item.rejected||0);
      totals.pages+=Number(item.pages||0);
      if(item.periodoId&&item.operation==="pull:all"){totals.periods+=1;}
    }
    add(result);
    return totals;
  }

  function notifyResult(title,result){
    var totals=totalsOf(result);
    var message=title+"\n\nDescargados: "+totals.downloaded+
      "\nGuardados: "+totals.written+
      "\nEliminados localmente: "+totals.removed+
      "\nConflictos: "+totals.conflicts+
      "\nRechazados: "+totals.rejected;
    window.alert(message);
    log(title+": "+totals.downloaded+" descargados, "+totals.written+" guardados y "+totals.conflicts+" conflictos.",totals.conflicts?"warn":"ok");
  }

  function afterOperation(result,label){
    try{
      window.dispatchEvent(new CustomEvent("bl2:external-pull-finished",{detail:{target:"firebase",summary:clone(result),at:now()}}));
      window.dispatchEvent(new CustomEvent("bdlocal:connections-cache-updated",{detail:{target:"firebase",at:now()}}));
    }catch(error){}
    if(window.BL2App&&typeof window.BL2App.refresh==="function"){
      window.BL2App.refresh({force:true,reason:"firebase-v2-pull"}).catch(function(){});
    }
    return refreshStatus({force:true}).then(function(){
      if(label){notifyResult(label,result);}
      return result;
    });
  }

  function runPeriod(full){
    if(running){return Promise.reject(new Error("Ya existe una operación Firebase en curso."));}
    var period=selectedPeriod();
    if(!period||!period.id){return Promise.reject(new Error("Seleccione un período."));}
    var action=full?"releer completamente":"descargar cambios de";
    if(!window.confirm("Firebase V2\n\nSe va a "+action+" "+period.label+".\nLos cambios locales pendientes serán protegidos y los conflictos no se sobrescribirán.\n\n¿Continuar?")){
      return Promise.resolve({ok:true,cancelled:true});
    }
    setBusy(true,full?"Releyendo período...":"Descargando cambios...");
    progress(10,"Preparando "+period.label+"...");
    return waitReady().then(function(){
      progress(25,"Consultando catálogos y datos del período...");
      return engine().pullAll({manual:true,periodoId:period.id,full:full===true,limit:500,maxPages:50});
    }).then(function(result){
      if(!result||result.ok===false){throw new Error(text(result&&result.message)||"Firebase no completó la descarga.");}
      progress(100,"Firebase actualizado en BDLocal.");
      return afterOperation(result,full?"Relectura completa finalizada":"Descarga incremental finalizada");
    }).finally(function(){setBusy(false,"Actualizando estado...");});
  }

  function listPeriods(){
    var current=core();
    if(current&&typeof current.getPeriods==="function"){
      return Promise.resolve(current.getPeriods()).then(function(rows){return Array.isArray(rows)?rows:[];});
    }
    if(window.BL2DB&&typeof window.BL2DB.getAll==="function"){
      return window.BL2DB.getAll("periodos");
    }
    return Promise.resolve([]);
  }

  function runAllPeriods(){
    if(running){return Promise.reject(new Error("Ya existe una operación Firebase en curso."));}
    if(!window.confirm("Firebase V2\n\nSe descargarán los catálogos, estudiantes y los datos académicos de todos los períodos registrados.\nLa operación será incremental y puede tardar varios minutos.\n\n¿Continuar?")){
      return Promise.resolve({ok:true,cancelled:true});
    }
    setBusy(true,"Descargando todos los períodos...");
    progress(5,"Preparando descarga global...");
    var summary={ok:true,operation:"pull:all-periods",global:null,periods:[],startedAt:now()};
    return waitReady().then(function(){
      return engine().pullAll({manual:true,entities:["periodos","carreras","estudiantes"],limit:500,maxPages:50});
    }).then(function(globalResult){
      if(!globalResult||globalResult.ok===false){throw new Error(text(globalResult&&globalResult.message)||"No se pudo descargar la base global.");}
      summary.global=globalResult;
      return listPeriods();
    }).then(function(periods){
      periods=(periods||[]).filter(function(row){return text(row&&(row.id||row.periodoId));});
      var chain=Promise.resolve();
      periods.forEach(function(row,index){
        chain=chain.then(function(){
          var periodoId=text(row.id||row.periodoId);
          progress(10+Math.round(((index+1)/Math.max(periods.length,1))*85),"Descargando "+text(row.label||row.periodoLabel||periodoId)+"...");
          return engine().pullAll({manual:true,periodoId:periodoId,entities:["matriculas","requisitos","notas"],limit:500,maxPages:50}).then(function(result){
            if(!result||result.ok===false){throw new Error("No se pudo descargar el período "+periodoId+": "+text(result&&result.message));}
            summary.periods.push(result);
          });
        });
      });
      return chain;
    }).then(function(){
      summary.finishedAt=now();
      progress(100,"Todos los períodos fueron procesados.");
      return afterOperation(summary,"Descarga de todos los períodos finalizada");
    }).finally(function(){setBusy(false,"Actualizando estado...");});
  }

  function renderConflicts(rows){
    var box=byId("bl2-firebase-conflicts-list");
    rows=Array.isArray(rows)?rows:[];
    if(!box){return;}
    if(!rows.length){
      box.className="bdlc-placeholder";
      box.innerHTML="<strong>Conflictos</strong><span>No existen conflictos abiertos.</span>";
      return;
    }
    box.className="bdlc-table-wrap";
    box.innerHTML='<table class="bdlc-table"><thead><tr><th>Entidad</th><th>Cédula / documento</th><th>Motivo</th><th>Fecha</th></tr></thead><tbody>'+
      rows.slice(0,8).map(function(row){return "<tr><td>"+esc(row.entidad)+"</td><td>"+esc(row.cedula||row.documentoId)+"</td><td>"+esc(row.motivo)+"</td><td>"+esc(row.updatedAt?new Date(row.updatedAt).toLocaleString("es-EC"):"—")+"</td></tr>";}).join("")+"</tbody></table>";
  }

  function refreshStatus(){
    ensurePanel();
    return waitReady().then(function(){
      return Promise.all([
        engine().status(),
        Promise.resolve(repository().status()),
        conflicts().list({estado:"ABIERTO"})
      ]);
    }).then(function(values){
      var sync=values[0]||{};
      var repo=values[1]||{};
      var open=values[2]||[];
      var states=Array.isArray(sync.syncStates)?sync.syncStates:[];
      var latest=states.slice().sort(function(a,b){return text(b.updatedAt).localeCompare(text(a.updatedAt));})[0];
      var last=text(latest&&(latest.lastPullAt||latest.lastPushAt||latest.updatedAt));
      var status=byId("bl2-firebase-status");
      if(status){
        status.textContent=sync.running
          ? "Operación manual en curso: "+text(sync.operation)
          : "Manual · "+open.length+" conflicto(s) abierto(s) · "+states.length+" cursor(es) registrados.";
      }
      var dot=byId("bl2-dot-firebase");
      if(dot){dot.className="bl2-dot "+(sync.lastError||open.length?"bl2-dot-warn":"bl2-dot-ok");}
      var lastNode=byId("bl2-firebase-last-sync");if(lastNode){lastNode.textContent=last?new Date(last).toLocaleString("es-EC"):"Sin ejecutar";}
      var modeNode=byId("bl2-firebase-last-mode");if(modeNode){modeNode.textContent=latest?text(latest.mode||latest.operation||"Manual"):"Solo manual";}
      var conflictNode=byId("bl2-firebase-conflict-count");if(conflictNode){conflictNode.textContent=String(open.length);}
      var reads=byId("bl2-firebase-read-count");if(reads){reads.textContent=String(Number(repo.readDocuments||repo.reads||0));}
      var queries=byId("bl2-firebase-query-count");if(queries){queries.textContent=String(Number(repo.queries||0))+" consultas";}
      var writes=byId("bl2-firebase-write-count");if(writes){writes.textContent=String(Number(repo.writes||0));}
      var version=byId("bl2-firebase-engine-version");if(version){version.textContent="Motor "+text(sync.version||VERSION);}
      renderConflicts(open);
      return {sync:sync,repository:repo,conflicts:open};
    }).catch(function(error){
      var status=byId("bl2-firebase-status");if(status){status.textContent="No disponible: "+error.message;}
      throw error;
    });
  }

  function scheduleRefresh(delay){
    window.clearTimeout(refreshTimer);
    refreshTimer=window.setTimeout(function(){refreshStatus().catch(function(){});},Math.max(50,Number(delay||180)));
  }

  function bind(){
    if(window[FLAG]){scheduleRefresh(20);return window.RequisitosFirebaseControlCenter;}
    window[FLAG]=true;
    ensurePanel();
    replaceControl("bl2-btn-pull-firebase",function(){return runPeriod(false);});
    replaceControl("bl2-btn-pull-firebase-all",runAllPeriods);
    replaceControl("bl2-btn-pull-firebase-full-period",function(){return runPeriod(true);});
    replaceControl("bl2-btn-fetch-firebase-config",function(){return refreshStatus().then(function(){window.alert("Estado Firebase V2 actualizado.");});});

    ["requisitos:firebase-sync-finished","requisitos:firebase-sync-error","bdlocal:sync-conflict","bdlocal:sync-v2-finished","bl2:period-changed","requisitos:periodo-global-cambiado"].forEach(function(name){
      window.addEventListener(name,function(){scheduleRefresh(150);});
    });
    scheduleRefresh(20);
    return window.RequisitosFirebaseControlCenter;
  }

  window.RequisitosFirebaseControlCenter={
    version:VERSION,
    manualOnly:true,
    automatic:false,
    bind:bind,
    refreshStatus:refreshStatus,
    pullPeriod:function(options){return runPeriod(options&&options.full===true);},
    pullAllPeriods:runAllPeriods,
    status:function(){return {version:VERSION,bound:!!window[FLAG],running:running,period:selectedPeriod()};}
  };

  bind();
})(window,document);

/* =========================================================
Nombre completo: centro-datos.ui.js
Ruta: /BDLocal/centro-datos/centro-datos.ui.js
Función:
- Convertir el Centro de Control existente en Centro de datos.
- Separar visualmente Base Local y Conexiones Externas.
- Mantener las rutas, identificadores y motores actuales.
- No ejecutar operaciones externas automáticamente.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-centro-datos-final";
  var ROOT_ID="bdlocal-control-center-root";
  var STORAGE_KEY="requisitos.centro-datos.ui.section.v1";
  var mounted=false;
  var mounting=false;
  var observer=null;
  var refreshTimer=null;
  var currentSection="resumen";
  var currentScript=document.currentScript;
  var scriptBase=currentScript&&currentScript.src?currentScript.src:window.location.href;

  function id(name){return document.getElementById(name);}
  function text(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function num(value){value=Number(value||0);return Number.isFinite(value)?value:0;}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function format(value){try{return num(value).toLocaleString("es-EC");}catch(error){return String(num(value));}}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function now(){return new Date().toISOString();}
  function root(){return id(ROOT_ID);}
  function main(){var current=root();return current&&current.querySelector(".bdlc-main");}
  function localApi(){return window.BDLocalPantallas||null;}
  function externalApi(){return window.ConexionesExternas||null;}

  function source(relative){
    try{return new URL(relative,scriptBase).href;}
    catch(error){return relative;}
  }

  function injectStyle(){
    if(id("centro-datos-ui-style")){return;}
    var link=document.createElement("link");
    link.id="centro-datos-ui-style";
    link.rel="stylesheet";
    link.href=source("centro-datos.ui.css");
    (document.head||document.documentElement).appendChild(link);
  }

  function setText(name,value){var node=id(name);if(node){node.textContent=value;}}

  function sectionTemplate(overline,title,description,content,extraClass){
    return '<div class="bdlc-header">'+
      '<div><span class="bdlc-overline">'+esc(overline)+'</span>'+
      '<h2 class="bdlc-title">'+esc(title)+'</h2>'+
      '<p class="bdlc-description">'+esc(description)+'</p></div></div>'+
      '<div class="cde-section-body '+esc(extraClass||"")+'">'+content+'</div>';
  }

  function createSection(sectionId,overline,title,description,content,extraClass){
    var node=id("bl2-section-"+sectionId);
    if(node){return node;}
    node=document.createElement("section");
    node.id="bl2-section-"+sectionId;
    node.className="bdlc-section cde-section "+(extraClass||"");
    node.setAttribute("data-bl2-section",sectionId);
    node.innerHTML=sectionTemplate(overline,title,description,content,extraClass);
    main().appendChild(node);
    return node;
  }

  function insertAfter(reference,node){
    if(!reference||!reference.parentNode){return;}
    if(reference.nextSibling){reference.parentNode.insertBefore(node,reference.nextSibling);}
    else{reference.parentNode.appendChild(node);}
  }

  function headerCard(label,valueId,help){
    return '<article class="bdlc-card bdlc-kpi-card cde-kpi">'+
      '<span>'+esc(label)+'</span><strong id="'+esc(valueId)+'">—</strong><small>'+esc(help)+'</small></article>';
  }

  function prepareHeader(){
    document.title="Centro de datos | Requisitos";
    var eyebrow=document.querySelector(".bl2-eyebrow");
    var heading=document.querySelector(".bl2-header h1");
    var subtitle=document.querySelector(".bl2-subtitle");
    if(eyebrow){eyebrow.textContent="Administración de datos";}
    if(heading){heading.textContent="Centro de datos";}
    if(subtitle){subtitle.textContent="Base Local, pantallas, respaldos y conexiones externas en una sola área de control.";}

    var dbPill=id("bl2-db-pill");
    if(dbPill&&!id("centro-datos-external-pill")){
      var external=document.createElement("span");
      external.id="centro-datos-external-pill";
      external.className="bl2-pill bl2-pill-soft";
      external.textContent="Conexiones externas: preparando";
      dbPill.parentNode.insertBefore(external,dbPill.nextSibling);
    }

    var sidebar=id("bl2-sidebar");
    if(sidebar){sidebar.setAttribute("aria-label","Menú del Centro de datos");}
    var mark=document.querySelector(".bdlc-sidebar-mark");
    var title=document.querySelector(".bdlc-sidebar-title");
    var sideSubtitle=document.querySelector(".bdlc-sidebar-subtitle");
    if(mark){mark.textContent="CD";}
    if(title){title.textContent="Centro de datos";}
    if(sideSubtitle){sideSubtitle.textContent="Base Local y conexiones";}
  }

  function prepareSummary(){
    var section=id("bl2-section-resumen");
    if(!section){return;}
    var overline=section.querySelector(".bdlc-overline");
    var title=section.querySelector(".bdlc-title");
    var description=section.querySelector(".bdlc-description");
    if(overline){overline.textContent="Centro de datos";}
    if(title){title.textContent="Resumen general";}
    if(description){description.textContent="Estado consolidado de Base Local, período activo y salidas externas.";}

    ["bl2-kpi-google","bl2-kpi-firebase","bl2-kpi-supabase"].forEach(function(name){
      var value=id(name);
      var card=value&&value.closest?value.closest(".bdlc-kpi-card"):null;
      var small=card&&card.querySelector("small");
      if(small){small.textContent="Conexiones Externas";}
    });
  }

  function prepareBaseLocal(){
    var section=createSection(
      "base-local",
      "Base Local",
      "Estado y rendimiento",
      "Resumen del núcleo local, sus pantallas, tablas, respaldos y capacidad sin internet.",
      '<div class="bdlc-card-grid cde-local-grid">'+
        headerCard("Estado local","cde-local-status","IndexedDB y núcleo")+
        headerCard("Pantallas","cde-local-screens","Conectores registrados")+
        headerCard("Tablas","cde-local-tables","Stores disponibles")+
        headerCard("Estudiantes","cde-local-students","Período activo")+
        headerCard("Respaldos","cde-local-backups","Copias registradas")+
        headerCard("Operación sin internet","cde-local-offline","Base principal")+
      '</div>'+
      '<div class="bdlc-card cde-quick-card"><h3>Accesos de Base Local</h3><p>Estas funciones no necesitan una conexión externa para consultar y trabajar con la información guardada.</p>'+ 
      '<div class="bdlc-actions">'+
        '<button type="button" class="bdlc-button secondary" data-cde-go="pantallas">Pantallas</button>'+ 
        '<button type="button" class="bdlc-button secondary" data-cde-go="tablas">Tablas</button>'+ 
        '<button type="button" class="bdlc-button secondary" data-cde-go="respaldos">Respaldos</button>'+ 
        '<button type="button" class="bdlc-button secondary" data-cde-go="diagnostico">Diagnóstico</button>'+ 
      '</div></div>',
      "cde-base-local-section"
    );
    var summary=id("bl2-section-resumen");
    if(summary&&section.parentNode===summary.parentNode){
      section.parentNode.removeChild(section);
      insertAfter(summary,section);
    }
  }

  function providerCard(buttonId){
    var button=id(buttonId);
    return button&&button.closest?button.closest(".bdlc-connection-card"):null;
  }

  function providerSection(sectionId,title,description,card){
    var section=createSection(
      sectionId,
      "Conexiones Externas",
      title,
      description,
      '<div class="bdlc-connections-grid cde-single-provider" data-cde-provider-host="'+esc(sectionId)+'"></div>',
      "cde-provider-section"
    );
    var host=section.querySelector("[data-cde-provider-host]");
    if(card&&host&&!host.contains(card)){host.appendChild(card);}
    return section;
  }

  function prepareExternalSections(){
    var external=id("bl2-section-bases-externas");
    if(!external){return;}

    var google=providerCard("bl2-btn-push-google");
    var firebase=providerCard("bl2-btn-push-firebase");
    var supabase=providerCard("bl2-btn-push-supabase");

    providerSection("google","Google Sheets","Configuración, subida, descarga y mantenimiento manual de Google Sheets.",google);
    providerSection("firebase","Firebase","Estado, descarga limitada, subida manual y configuración de Firebase.",firebase);
    providerSection("supabase","Supabase","Configuración y subida manual hacia la base paralela.",supabase);

    external.innerHTML=sectionTemplate(
      "Conexiones Externas",
      "Resumen de sincronización",
      "Estado independiente de Firebase, Supabase y Google Sheets. Todas las operaciones continúan siendo manuales.",
      '<div class="bdlc-card-grid cde-external-grid">'+
        headerCard("Proveedores","cde-external-providers","Firebase, Supabase y Google")+
        headerCard("Pendientes abiertos","cde-external-pending","Cola local")+
        headerCard("Errores o bloqueos","cde-external-errors","Por proveedor")+
        headerCard("Motor","cde-external-running","Estado actual")+
        headerCard("Pausa","cde-external-paused","Control manual")+
      '</div>'+ 
      '<div class="bdlc-card cde-provider-overview"><div class="cde-card-head"><div><h3>Estado por proveedor</h3><p>Una falla externa no bloquea Base Local.</p></div>'+ 
      '<div class="bdlc-actions"><button id="cde-btn-refresh-external" class="bdlc-button secondary" type="button">Actualizar estado</button>'+ 
      '<button id="cde-btn-pause-external" class="bdlc-button subtle" type="button">Pausar</button>'+ 
      '<button id="cde-btn-resume-external" class="bdlc-button subtle" type="button">Reanudar</button></div></div>'+ 
      '<div id="cde-provider-summary" class="cde-provider-summary"><div class="bdlc-empty">Preparando proveedores...</div></div></div>',
      "cde-external-summary"
    );

    var conflictBox=id("bl2-firebase-conflicts-list");
    var conflicts=createSection(
      "conflictos",
      "Conexiones Externas",
      "Conflictos",
      "Registros remotos que requieren revisión antes de sobrescribir información local.",
      '<div id="cde-conflict-host" class="cde-conflict-host"></div>',
      "cde-conflicts-section"
    );
    var conflictHost=conflicts.querySelector("#cde-conflict-host");
    if(!conflictBox){
      conflictBox=document.createElement("div");
      conflictBox.id="bl2-firebase-conflicts-list";
      conflictBox.className="bdlc-placeholder";
      conflictBox.innerHTML="<strong>Conflictos</strong><span>No existen conflictos abiertos.</span>";
    }
    if(conflictHost&&!conflictHost.contains(conflictBox)){conflictHost.appendChild(conflictBox);}

    createSection(
      "consumo",
      "Conexiones Externas",
      "Cuotas y consumo",
      "Mediciones locales y estados de uso. No se presentan como cuotas oficiales del proveedor.",
      '<div class="bdlc-alert info cde-usage-warning">Los valores mostrados son mediciones locales o estimaciones. La cuota oficial debe confirmarse en cada proveedor.</div>'+ 
      '<div id="cde-usage-grid" class="bdlc-card-grid three cde-usage-grid"><div class="bdlc-empty">Calculando consumo local...</div></div>',
      "cde-usage-section"
    );
  }

  function navButton(target,label,breadcrumb){
    return '<button type="button" class="bdlc-subnav-button" data-bl2-section-target="'+esc(target)+'" data-bl2-section-label="'+esc(label)+'" data-cde-breadcrumb="'+esc(breadcrumb)+'">'+esc(label)+'</button>';
  }

  function rebuildNavigation(){
    var nav=document.querySelector(".bdlc-nav");
    if(!nav){return;}
    nav.innerHTML=
      '<button type="button" class="bdlc-nav-button" data-bl2-section-target="resumen" data-bl2-section-label="Resumen general" data-cde-breadcrumb="Resumen general"><span class="bdlc-nav-icon">R</span><span>Resumen</span></button>'+ 
      '<div class="bdlc-nav-group is-open" data-cde-nav-group="base-local">'+
        '<button type="button" class="bdlc-nav-group-button" data-cde-menu-toggle="base-local" aria-expanded="true"><span class="bdlc-nav-icon">BL</span><span>Base Local</span><span class="bdlc-nav-arrow">⌄</span></button>'+ 
        '<div class="bdlc-subnav">'+
          navButton("base-local","Estado y rendimiento","Base Local / Estado y rendimiento")+
          navButton("pantallas","Pantallas","Base Local / Pantallas")+
          navButton("tablas","Tablas","Base Local / Tablas")+
          navButton("estudiante","Consulta de estudiante","Base Local / Consulta de estudiante")+
          navButton("respaldos","Respaldos","Base Local / Respaldos")+
          navButton("mantenimiento","Mantenimiento","Base Local / Mantenimiento")+
          navButton("diagnostico","Diagnóstico","Base Local / Diagnóstico")+
        '</div></div>'+ 
      '<div class="bdlc-nav-group" data-cde-nav-group="external">'+
        '<button type="button" class="bdlc-nav-group-button" data-cde-menu-toggle="external" aria-expanded="false"><span class="bdlc-nav-icon">CE</span><span>Conexiones Externas</span><span class="bdlc-nav-arrow">⌄</span></button>'+ 
        '<div class="bdlc-subnav">'+
          navButton("bases-externas","Resumen de sincronización","Conexiones Externas / Resumen")+
          navButton("firebase","Firebase","Conexiones Externas / Firebase")+
          navButton("supabase","Supabase","Conexiones Externas / Supabase")+
          navButton("google","Google Sheets","Conexiones Externas / Google Sheets")+
          navButton("cola","Cola y reintentos","Conexiones Externas / Cola y reintentos")+
          navButton("conflictos","Conflictos","Conexiones Externas / Conflictos")+
          navButton("consumo","Cuotas y consumo","Conexiones Externas / Cuotas y consumo")+
        '</div></div>';

    var footer=document.querySelector(".bdlc-sidebar-footer");
    if(footer){footer.innerHTML="<span></span>Base Local activa · conexiones manuales";}
  }

  function sectionGroup(sectionId){
    return ["base-local","pantallas","tablas","estudiante","respaldos","mantenimiento","diagnostico"].indexOf(sectionId)>=0
      ?"base-local"
      :["bases-externas","firebase","supabase","google","cola","conflictos","consumo"].indexOf(sectionId)>=0
        ?"external"
        :"";
  }

  function closeMobileMenu(){
    document.body.classList.remove("bl2-sidebar-open");
    var toggle=id("bl2-btn-sidebar-toggle");
    if(toggle){toggle.setAttribute("aria-expanded","false");}
  }

  function activate(sectionId){
    sectionId=text(sectionId||"resumen");
    var currentRoot=root();
    if(!currentRoot){return false;}
    var section=currentRoot.querySelector('[data-bl2-section="'+sectionId+'"]');
    if(!section){sectionId="resumen";section=currentRoot.querySelector('[data-bl2-section="resumen"]');}

    Array.prototype.forEach.call(currentRoot.querySelectorAll("[data-bl2-section]"),function(node){
      node.classList.toggle("is-active",node===section);
    });
    Array.prototype.forEach.call(currentRoot.querySelectorAll("[data-bl2-section-target]"),function(node){
      node.classList.toggle("is-active",node.getAttribute("data-bl2-section-target")===sectionId);
    });

    var button=currentRoot.querySelector('[data-bl2-section-target="'+sectionId+'"]');
    var groupName=sectionGroup(sectionId);
    if(groupName){
      var group=currentRoot.querySelector('[data-cde-nav-group="'+groupName+'"]');
      var groupButton=group&&group.querySelector("[data-cde-menu-toggle]");
      if(group){group.classList.add("is-open");}
      if(groupButton){groupButton.setAttribute("aria-expanded","true");}
    }

    var breadcrumb=id("bl2-breadcrumb");
    if(breadcrumb){breadcrumb.textContent="Centro de datos / "+text(button&&button.getAttribute("data-cde-breadcrumb")||"Resumen general");}
    currentSection=sectionId;
    try{window.localStorage.setItem(STORAGE_KEY,sectionId);}catch(error){}
    closeMobileMenu();

    if(sectionId==="tablas"&&window.BDLocalConfigUI&&typeof window.BDLocalConfigUI.mountTables==="function"){
      window.setTimeout(function(){window.BDLocalConfigUI.mountTables(false);},0);
    }
    if(sectionId==="cola"&&window.BDLocalConfigUI&&typeof window.BDLocalConfigUI.mountQueue==="function"){
      window.setTimeout(function(){window.BDLocalConfigUI.mountQueue(false);},0);
    }
    if(["base-local","bases-externas","firebase","supabase","google","conflictos","consumo"].indexOf(sectionId)>=0){scheduleRefresh("section",30);}

    try{window.dispatchEvent(new CustomEvent("centro-datos:section-changed",{detail:{section:sectionId,at:now()}}));}catch(error2){}
    return true;
  }

  function bindNavigation(){
    var currentRoot=root();
    if(!currentRoot){return;}
    Array.prototype.forEach.call(currentRoot.querySelectorAll("[data-bl2-section-target]"),function(button){
      button.addEventListener("click",function(){activate(button.getAttribute("data-bl2-section-target"));});
    });
    Array.prototype.forEach.call(currentRoot.querySelectorAll("[data-cde-menu-toggle]"),function(button){
      button.addEventListener("click",function(){
        var group=currentRoot.querySelector('[data-cde-nav-group="'+button.getAttribute("data-cde-menu-toggle")+'"]');
        if(!group){return;}
        var open=!group.classList.contains("is-open");
        group.classList.toggle("is-open",open);
        button.setAttribute("aria-expanded",open?"true":"false");
      });
    });
    Array.prototype.forEach.call(currentRoot.querySelectorAll("[data-cde-go]"),function(button){
      button.addEventListener("click",function(){activate(button.getAttribute("data-cde-go"));});
    });

    var refresh=id("cde-btn-refresh-external");
    var pause=id("cde-btn-pause-external");
    var resume=id("cde-btn-resume-external");
    if(refresh){refresh.addEventListener("click",function(){refreshAll({force:true});});}
    if(pause){pause.addEventListener("click",function(){var api=externalApi();if(api&&typeof api.pause==="function"){api.pause("Pausa manual desde Centro de datos");scheduleRefresh("pause",20);}});}
    if(resume){resume.addEventListener("click",function(){var api=externalApi();if(api&&typeof api.resume==="function"){api.resume();scheduleRefresh("resume",20);}});}
  }

  function backupCount(){
    var current=window.BL2Backup||window.BL2BackupV2||null;
    if(current&&typeof current.listBackups==="function"){
      return Promise.resolve(current.listBackups()).then(function(rows){return Array.isArray(rows)?rows.length:0;}).catch(function(){return 0;});
    }
    if(window.BL2DB&&typeof window.BL2DB.getAll==="function"){
      return window.BL2DB.getAll("backups").then(function(rows){return Array.isArray(rows)?rows.length:0;}).catch(function(){return 0;});
    }
    return Promise.resolve(0);
  }

  function refreshLocal(){
    var status={};
    var meta={};
    try{status=localApi()&&typeof localApi().status==="function"?localApi().status():{};}catch(error){status={ok:false,error:error.message||String(error)};}
    try{meta=window.BL2DB&&typeof window.BL2DB.meta==="function"?window.BL2DB.meta()||{}:{};}catch(error2){meta={};}
    var stores=Array.isArray(meta.stores)?meta.stores:Object.keys((window.BL2Config&&window.BL2Config.stores)||{});
    var students=text((id("bl2-kpi-students")||{}).textContent)||"0";

    setText("cde-local-status",status.ok===false?"Revisar":"Operativa");
    setText("cde-local-screens",format(status.totalScreens||status.screens&&status.screens.length||0));
    setText("cde-local-tables",format(stores.length));
    setText("cde-local-students",students);
    setText("cde-local-offline",status.offlineCapable===false?"No":"Sí");

    return backupCount().then(function(total){
      setText("cde-local-backups",format(total));
      return {status:status,meta:meta,backups:total};
    });
  }

  function countsSnapshot(){
    var bridge=window.BDLSyncUIBridge||null;
    if(bridge&&typeof bridge.getSnapshot==="function"){
      var snapshot=bridge.getSnapshot();
      if(snapshot){return Promise.resolve(snapshot);}
    }
    if(bridge&&typeof bridge.refreshCounts==="function"){
      return Promise.resolve(bridge.refreshCounts({force:false})).catch(function(){return {};});
    }
    return Promise.resolve({});
  }

  function countDetail(counts,target){
    counts=counts||{};
    return counts.detail&&counts.detail[target]?counts.detail[target]:{};
  }

  function openCount(row){
    row=row||{};
    return num(row.pending)+num(row.error)+num(row.blocked)+num(row.waitingRetry);
  }

  function providerLabel(target){
    return target==="google"?"Google Sheets":target==="firebase"?"Firebase":target==="supabase"?"Supabase":target;
  }

  function normalizedProviderStatus(item){
    item=item||{};
    var data=item.data&&typeof item.data==="object"?item.data:item;
    var target=text(item.target||data.target).toLowerCase();
    return {
      target:target,
      ok:item.ok!==false&&data.ok!==false&&!item.error&&!data.error,
      message:text(item.message||data.message||data.status||"Disponible"),
      data:data
    };
  }

  function renderProviderSummary(providers,counts){
    var box=id("cde-provider-summary");
    if(!box){return;}
    var byTarget={};
    (providers||[]).forEach(function(item){var row=normalizedProviderStatus(item);if(row.target){byTarget[row.target]=row;}});
    box.innerHTML=["firebase","supabase","google"].map(function(target){
      var state=byTarget[target]||{target:target,ok:false,message:"Preparando"};
      var detail=countDetail(counts,target);
      var total=openCount(detail);
      return '<article class="cde-provider-row">'+
        '<div class="cde-provider-identity"><span class="bl2-dot '+(state.ok?"bl2-dot-ok":"bl2-dot-warn")+'"></span><div><strong>'+esc(providerLabel(target))+'</strong><small>'+esc(state.message||"Estado local")+'</small></div></div>'+ 
        '<div class="cde-provider-metrics"><span>'+format(total)+' abierto(s)</span><button type="button" class="bdlc-button subtle" data-cde-go="'+esc(target)+'">Abrir</button></div></article>';
    }).join("");
    Array.prototype.forEach.call(box.querySelectorAll("[data-cde-go]"),function(button){
      button.addEventListener("click",function(){activate(button.getAttribute("data-cde-go"));});
    });
  }

  function usageCard(row){
    row=row||{};
    var target=text(row.target).toLowerCase();
    var runtime=row.runtime||{};
    var quota=row.quota||{};
    var details=[];
    if(target==="firebase"){
      details.push("Usado local: "+format(quota.used||0));
      details.push("Límite configurado: "+format(quota.limit||0));
      details.push("Porcentaje local: "+format(quota.percent||0)+"%");
    }else if(target==="google"){
      details.push("Pendientes locales: "+format(runtime.pendingCount||0));
      details.push("Lote máximo: "+format(runtime.batchSize||25));
      details.push("Estado: "+text(runtime.status||"sin configurar"));
    }else if(target==="supabase"){
      details.push("Tabla: "+text(runtime.tableName||"app_records"));
      details.push("Estado: "+text(runtime.status||"sin configurar"));
      details.push(runtime.connected?"Conexión verificada":"Conexión no verificada");
    }
    return '<article class="bdlc-card cde-usage-card"><div class="cde-card-head"><div><h3>'+esc(providerLabel(target))+'</h3><p>'+esc(row.label||"Estado local")+'</p></div><span class="bdlc-status warning">No oficial</span></div>'+ 
      '<ul>'+details.map(function(value){return "<li>"+esc(value)+"</li>";}).join("")+'</ul><small>'+esc(row.warning||"Medición local")+'</small></article>';
  }

  function renderUsage(rows){
    var grid=id("cde-usage-grid");
    if(!grid){return;}
    rows=Array.isArray(rows)?rows:[];
    grid.innerHTML=rows.length?rows.map(usageCard).join(""):'<div class="bdlc-empty">No existe información de consumo local.</div>';
  }

  function refreshExternal(){
    var api=externalApi();
    var statusTask=api&&typeof api.status==="function"?Promise.resolve(api.status()).catch(function(error){return {ok:false,error:error.message||String(error),providers:[]};}):Promise.resolve({ok:false,providers:[]});
    return Promise.all([statusTask,countsSnapshot()]).then(function(values){
      var status=values[0]||{};
      var counts=values[1]||{};
      var providers=Array.isArray(status.providers)?status.providers:[];
      var targets=["google","firebase","supabase"];
      var pending=0;
      var errors=0;
      targets.forEach(function(target){var row=countDetail(counts,target);pending+=openCount(row);errors+=num(row.error)+num(row.blocked);});

      setText("cde-external-providers",format(providers.length||3));
      setText("cde-external-pending",format(pending));
      setText("cde-external-errors",format(errors));
      setText("cde-external-running",status.engine&&status.engine.running||api&&typeof api.isRunning==="function"&&api.isRunning()?"En ejecución":"En espera");
      setText("cde-external-paused",status.paused||api&&typeof api.isPaused==="function"&&api.isPaused()?"Pausada":"Activa");

      var pill=id("centro-datos-external-pill");
      if(pill){
        pill.className="bl2-pill "+(errors?"bl2-pill-warn":status.ok===false?"bl2-pill-bad":"bl2-pill-ok");
        pill.textContent=errors?"Externas: "+errors+" por revisar":status.ok===false?"Externas no disponibles":"Externas listas";
      }

      renderProviderSummary(providers,counts);
      var usage=api&&typeof api.usage==="function"?api.usage():[];
      renderUsage(usage);
      return {status:status,counts:counts,usage:clone(usage)};
    });
  }

  function refreshAll(options){
    options=options||{};
    return Promise.all([refreshLocal(),refreshExternal()]).then(function(values){
      var view=id("bl2-view-status");
      if(view){view.textContent="Centro de datos actualizado";}
      try{window.dispatchEvent(new CustomEvent("centro-datos:updated",{detail:{ok:true,force:!!options.force,local:values[0],external:values[1],at:now()}}));}catch(error){}
      return values;
    }).catch(function(error){
      var view=id("bl2-view-status");
      if(view){view.textContent="Centro de datos con información parcial";}
      return {ok:false,error:error.message||String(error)};
    });
  }

  function scheduleRefresh(reason,delay){
    window.clearTimeout(refreshTimer);
    refreshTimer=window.setTimeout(function(){refreshAll({reason:reason||"event"});},Math.max(20,Number(delay||160)));
  }

  function bindEvents(){
    [
      "bl2:app-refreshed",
      "bl2:period-changed",
      "bdlocal:sync-ui-updated",
      "bdlocal:sync-v2-finished",
      "bdlocal:pantallas-facade-ready",
      "bdlocal:screen-connections-ready",
      "conexiones-externas:facade-ready",
      "conexiones-externas:finished",
      "conexiones-externas:error",
      "conexiones-externas:pause-changed"
    ].forEach(function(name){window.addEventListener(name,function(){scheduleRefresh(name,120);});});
  }

  function initialSection(){
    var value="resumen";
    try{value=window.localStorage.getItem(STORAGE_KEY)||window.localStorage.getItem("requisitos.bdlocal.ui.section.v2")||"resumen";}catch(error){}
    return id("bl2-section-"+value)?value:"resumen";
  }

  function readyForMount(){
    var external=id("bl2-section-bases-externas");
    return !!(
      root()&&main()&&external&&external.__built&&
      id("bl2-btn-push-google")&&id("bl2-btn-push-firebase")&&id("bl2-btn-push-supabase")&&
      id("bl2-section-resumen")&&id("bl2-section-pantallas")
    );
  }

  function mount(){
    if(mounted||mounting){return Promise.resolve(window.CentroDatosUI||null);}
    if(!readyForMount()){return Promise.resolve(null);}
    mounting=true;
    injectStyle();
    prepareHeader();
    prepareSummary();
    prepareBaseLocal();
    prepareExternalSections();
    rebuildNavigation();
    bindNavigation();
    bindEvents();
    mounted=true;
    mounting=false;
    if(observer){observer.disconnect();observer=null;}
    activate(initialSection());
    refreshAll({force:true});
    try{window.dispatchEvent(new CustomEvent("centro-datos:ready",{detail:{ok:true,version:VERSION,section:currentSection,at:now()}}));}catch(error){}
    return Promise.resolve(window.CentroDatosUI);
  }

  function tryMount(){
    if(mounted){return true;}
    if(readyForMount()){mount();return true;}
    return false;
  }

  function watch(){
    if(tryMount()){return;}
    var target=root()||document.body||document.documentElement;
    if(window.MutationObserver&&target){
      observer=new MutationObserver(function(){tryMount();});
      observer.observe(target,{childList:true,subtree:true});
    }
    var attempts=0;
    (function poll(){
      attempts+=1;
      if(tryMount()||attempts>=150){return;}
      window.setTimeout(poll,100);
    })();
  }

  window.CentroDatosUI={
    version:VERSION,
    mount:mount,
    refresh:refreshAll,
    activate:activate,
    isMounted:function(){return mounted;},
    getState:function(){return {mounted:mounted,mounting:mounting,section:currentSection,manualExternal:true,version:VERSION};}
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",watch,{once:true});
  }else{
    watch();
  }
})(window,document);

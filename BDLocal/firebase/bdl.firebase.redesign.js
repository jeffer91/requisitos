/* =========================================================
Nombre completo: bdl.firebase.redesign.js
Ruta: /BDLocal/firebase/bdl.firebase.redesign.js
Función:
- Rediseñar el Centro de Control de Datos sin alterar la lógica de negocio.
- Presentar Firebase como base oficial y BDLocal como caché local.
- Separar Firebase, Google Sheets, Supabase, sincronización y mantenimiento.
- Crear un menú lateral jerárquico con submenús funcionales.
- Mantener los bloqueos, confirmaciones y acciones protegidas existentes.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.0.0-control-center-navigation";
  var STYLE_ID="bdl-firebase-redesign-style";
  var GUARD_SCRIPT_ID="bdl-external-operation-guard-script";
  var SUPPLEMENT_SCRIPT_ID="bdl-external-operation-supplement-script";
  var ACTIONS_SCRIPT_ID="bdl-firebase-user-actions-script";
  var WORKFLOW_ID="bdlc-safe-workflow";
  var NAV_FLAG="__bdlcRedesignNavigationBound";
  var SECTION_FLAG="__bdlcRedesignSectionsReady";
  var STORAGE_KEY="requisitos.bdlocal.ui.section.v3";
  var applied=false;
  var attempts=0;
  var timer=null;
  var observer=null;
  var scriptBase=document.currentScript&&document.currentScript.src?document.currentScript.src:window.location.href;

  function text(value){return String(value==null?"":value).trim();}
  function byId(id){return document.getElementById(id);}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function styleUrl(){try{return new URL("bdl.firebase.redesign.css",scriptBase).href;}catch(error){return "./firebase/bdl.firebase.redesign.css";}}
  function guardUrl(){try{return new URL("bdl.external-operation.guard.js",scriptBase).href;}catch(error){return "./firebase/bdl.external-operation.guard.js";}}
  function supplementUrl(){try{return new URL("bdl.external-operation.supplement.js",scriptBase).href;}catch(error){return "./firebase/bdl.external-operation.supplement.js";}}
  function actionsUrl(){try{return new URL("bdl.firebase.user-actions.js",scriptBase).href;}catch(error){return "./firebase/bdl.firebase.user-actions.js";}}

  function ensureStyle(){
    if(byId(STYLE_ID)){return;}
    var link=document.createElement("link");
    link.id=STYLE_ID;
    link.rel="stylesheet";
    link.href=styleUrl();
    (document.head||document.documentElement).appendChild(link);
  }

  function disableUnsafeControls(message){
    [
      "bl2-btn-push-google","bl2-btn-push-firebase","bl2-btn-push-supabase",
      "bl2-btn-pull-sheets","bl2-btn-pull-sheets-all","bl2-btn-clean-sheets-duplicates",
      "bl2-btn-correct-firebase-base","bl2-btn-migration-preview","bl2-btn-migration-apply"
    ].forEach(function(id){var button=byId(id);if(button){button.disabled=true;}});
    var status=byId("bl2-firebase-migration-status");
    if(status){status.innerHTML="<strong>Operaciones bloqueadas</strong><span>"+esc(message)+"</span>";}
  }

  function ensureActions(){
    if(!window.BDLExternalOperationGate||!window.BDLExternalOperationSupplement){return;}
    if(window.RequisitosFirebaseUserActions){
      if(typeof window.RequisitosFirebaseUserActions.refresh==="function"){window.RequisitosFirebaseUserActions.refresh();}
      return;
    }
    if(byId(ACTIONS_SCRIPT_ID)){return;}
    var script=document.createElement("script");
    script.id=ACTIONS_SCRIPT_ID;
    script.src=actionsUrl();
    script.async=false;
    script.defer=false;
    script.setAttribute("data-bdl-firebase-actions","true");
    script.onerror=function(){
      disableUnsafeControls("No se pudieron cargar las acciones protegidas de Firebase.");
      try{console.warn("[BDLocal redesign] No se pudieron cargar las acciones operativas.");}catch(error){}
    };
    (document.head||document.documentElement).appendChild(script);
  }

  function ensureSupplement(){
    if(!window.BDLExternalOperationGate){return;}
    if(window.BDLExternalOperationSupplement){
      if(typeof window.BDLExternalOperationSupplement.patchCloud==="function"){window.BDLExternalOperationSupplement.patchCloud();}
      if(typeof window.BDLExternalOperationSupplement.syncUi==="function"){window.BDLExternalOperationSupplement.syncUi();}
      ensureActions();
      return;
    }
    var existing=byId(SUPPLEMENT_SCRIPT_ID);
    if(existing){
      if(existing.getAttribute("data-bdl-supplement-waiting")!=="true"){
        existing.setAttribute("data-bdl-supplement-waiting","true");
        existing.addEventListener("load",ensureActions,{once:true});
      }
      return;
    }
    var script=document.createElement("script");
    script.id=SUPPLEMENT_SCRIPT_ID;
    script.src=supplementUrl();
    script.async=false;
    script.defer=false;
    script.setAttribute("data-bdl-external-operation-supplement","true");
    script.onload=function(){ensureActions();};
    script.onerror=function(){
      disableUnsafeControls("No se cargó la protección de descargas y período. Reinicie la aplicación.");
      try{console.warn("[BDLocal redesign] No se pudo cargar el suplemento operativo.");}catch(error){}
    };
    (document.head||document.documentElement).appendChild(script);
  }

  function ensureGuard(){
    if(window.BDLExternalOperationGate){
      if(typeof window.BDLExternalOperationGate.patchAll==="function"){window.BDLExternalOperationGate.patchAll();}
      ensureSupplement();
      return;
    }
    var existing=byId(GUARD_SCRIPT_ID);
    if(existing){
      if(existing.getAttribute("data-bdl-guard-waiting")!=="true"){
        existing.setAttribute("data-bdl-guard-waiting","true");
        existing.addEventListener("load",ensureSupplement,{once:true});
      }
      return;
    }
    var script=document.createElement("script");
    script.id=GUARD_SCRIPT_ID;
    script.src=guardUrl();
    script.async=false;
    script.defer=false;
    script.setAttribute("data-bdl-external-operation-guard","true");
    script.onload=function(){
      if(window.BDLExternalOperationGate&&typeof window.BDLExternalOperationGate.patchAll==="function"){window.BDLExternalOperationGate.patchAll();}
      ensureSupplement();
    };
    script.onerror=function(){
      disableUnsafeControls("No se cargó el bloqueo único de operaciones. Reinicie la aplicación antes de continuar.");
      try{console.warn("[BDLocal redesign] No se pudo cargar el bloqueo operativo.");}catch(error){}
    };
    (document.head||document.documentElement).appendChild(script);
  }

  function createSection(id,overline,title,description,hostId,beforeNode){
    var current=byId("bl2-section-"+id);
    if(current){return current;}
    var main=document.querySelector(".bdlc-main");
    if(!main){return null;}
    current=document.createElement("section");
    current.id="bl2-section-"+id;
    current.className="bdlc-section bdlc-redesign-section";
    current.setAttribute("data-bl2-section",id);
    current.innerHTML=
      '<div class="bdlc-header bdlc-redesign-header">'+
        '<div><span class="bdlc-overline">'+esc(overline)+'</span><h2 class="bdlc-title">'+esc(title)+'</h2><p class="bdlc-description">'+esc(description)+'</p></div>'+
      '</div>'+
      '<div id="'+esc(hostId)+'" class="bdlc-redesign-host"></div>';
    main.insertBefore(current,beforeNode||null);
    return current;
  }

  function ensureSections(){
    var root=byId("bdlocal-control-center-root");
    var main=root&&root.querySelector(".bdlc-main");
    var staging=byId("bl2-section-bases-externas");
    var screens=byId("bl2-section-pantallas");
    if(!root||!main||!staging){return false;}

    createSection(
      "firebase",
      "Base oficial",
      "Firebase",
      "Fuente oficial de estudiantes, matrículas, requisitos, notas, períodos, carreras, historial e importaciones.",
      "bdlc-firebase-host",
      screens
    );
    createSection(
      "google",
      "Integración auxiliar",
      "Google Sheets",
      "Importación, exportación y respaldo controlado. No reemplaza a Firebase como fuente oficial.",
      "bdlc-google-host",
      screens
    );
    createSection(
      "supabase",
      "Integración opcional",
      "Supabase",
      "Respaldo paralelo opcional. Permanece separado del flujo oficial mientras no esté habilitado.",
      "bdlc-supabase-host",
      screens
    );

    var diagnostic=byId("bl2-section-diagnostico");
    createSection(
      "registros",
      "Auditoría técnica",
      "Registros del sistema",
      "Eventos de conexión, importación, sincronización, respaldo y migración.",
      "bdlc-logs-host",
      diagnostic
    );

    var maintenance=byId("bl2-section-mantenimiento");
    if(maintenance&&!byId("bl2-firebase-migration-host")){
      var intro=document.createElement("div");
      intro.className="bdlc-maintenance-layout";
      intro.innerHTML=
        '<article class="bdlc-card bdlc-maintenance-guide">'+
          '<span class="bdlc-overline">Flujo seguro</span>'+
          '<h3>Migración, identidades y reparación</h3>'+
          '<p>Las operaciones de mantenimiento deben comenzar con vista previa y respaldo. Ninguna limpieza legacy se habilita antes de validar la migración.</p>'+
          '<div class="bdlc-mini-flow"><span>1. Analizar</span><span>2. Respaldar</span><span>3. Aplicar</span><span>4. Verificar</span></div>'+
        '</article>'+
        '<div id="bl2-firebase-migration-host" class="bdlc-migration-host"></div>';
      var slot=byId("bl2-maintenance-slot");
      maintenance.insertBefore(intro,slot||null);
    }

    var logs=byId("bl2-log");
    var logsHost=byId("bdlc-logs-host");
    if(logs&&logsHost&&logs.parentNode!==logsHost){
      logsHost.appendChild(logs);
      logs.classList.add("bdlc-system-log");
    }

    root[SECTION_FLAG]=true;
    return true;
  }

  function navButton(id,icon,label){
    return '<button type="button" class="bdlc-nav-button" data-bdlc-redesign-target="'+esc(id)+'"><span class="bdlc-nav-icon">'+esc(icon)+'</span><span>'+esc(label)+'</span></button>';
  }

  function subButton(id,label){
    return '<button type="button" class="bdlc-subnav-button" data-bdlc-redesign-target="'+esc(id)+'">'+esc(label)+'</button>';
  }

  function navGroup(key,icon,label,items){
    return '<div class="bdlc-nav-group" data-bdlc-redesign-group="'+esc(key)+'">'+
      '<button type="button" class="bdlc-nav-group-button" data-bdlc-redesign-toggle="'+esc(key)+'" aria-expanded="false">'+
        '<span class="bdlc-nav-icon">'+esc(icon)+'</span><span>'+esc(label)+'</span><span class="bdlc-nav-arrow">⌄</span>'+
      '</button><div class="bdlc-subnav">'+items.join("")+'</div></div>';
  }

  function closeMobileMenu(){
    document.body.classList.remove("bl2-sidebar-open");
    var toggle=byId("bl2-btn-sidebar-toggle");
    if(toggle){toggle.setAttribute("aria-expanded","false");}
  }

  function activate(sectionId,label){
    var root=byId("bdlocal-control-center-root");
    if(!root){return;}
    sectionId=text(sectionId||"resumen");
    if(sectionId==="bases-externas"){sectionId="firebase";}
    var section=root.querySelector('[data-bl2-section="'+sectionId+'"]');
    if(!section){sectionId="resumen";section=root.querySelector('[data-bl2-section="resumen"]');}

    Array.prototype.slice.call(root.querySelectorAll("[data-bl2-section]")).forEach(function(node){
      node.classList.toggle("is-active",node===section);
    });
    Array.prototype.slice.call(root.querySelectorAll("[data-bdlc-redesign-target]")).forEach(function(node){
      node.classList.toggle("is-active",node.getAttribute("data-bdlc-redesign-target")===sectionId);
    });
    Array.prototype.slice.call(root.querySelectorAll("[data-bdlc-redesign-group]")).forEach(function(group){
      var selected=!!group.querySelector('[data-bdlc-redesign-target="'+sectionId+'"]');
      group.classList.toggle("is-open",selected);
      var button=group.querySelector("[data-bdlc-redesign-toggle]");
      if(button){button.setAttribute("aria-expanded",selected?"true":"false");}
    });

    var breadcrumb=byId("bl2-breadcrumb");
    if(breadcrumb){breadcrumb.textContent="Centro de datos / "+text(label||sectionId);}
    try{window.localStorage.setItem(STORAGE_KEY,sectionId);}catch(error){}

    if(sectionId==="tablas"&&window.BDLocalConfigUI&&typeof window.BDLocalConfigUI.mountTables==="function"){
      window.setTimeout(function(){window.BDLocalConfigUI.mountTables(false);},0);
    }
    if(sectionId==="cola"&&window.BDLocalConfigUI&&typeof window.BDLocalConfigUI.mountQueue==="function"){
      window.setTimeout(function(){window.BDLocalConfigUI.mountQueue(false);},0);
    }
    closeMobileMenu();
  }

  function rebuildNavigation(){
    var root=byId("bdlocal-control-center-root");
    var nav=root&&root.querySelector(".bdlc-nav");
    if(!root||!nav||root[NAV_FLAG]){return false;}

    nav.innerHTML=
      navButton("resumen","R","Resumen")+
      navGroup("datos","D","Datos locales",[
        subButton("tablas","Explorador de datos"),
        subButton("estudiante","Consulta de estudiante")
      ])+
      navGroup("conexiones","C","Conexiones",[
        subButton("firebase","Firebase · base oficial"),
        subButton("google","Google Sheets"),
        subButton("supabase","Supabase"),
        subButton("pantallas","Pantallas de la app")
      ])+
      navGroup("sincronizacion","S","Sincronización",[
        subButton("cola","Cambios pendientes")
      ])+
      navGroup("respaldos","B","Respaldos",[
        subButton("respaldos","Crear y restaurar")
      ])+
      navGroup("mantenimiento","M","Mantenimiento",[
        subButton("mantenimiento","Migración y reparaciones")
      ])+
      navGroup("diagnostico","Q","Diagnóstico",[
        subButton("diagnostico","Estado y pruebas"),
        subButton("registros","Registros técnicos")
      ]);

    Array.prototype.slice.call(nav.querySelectorAll("[data-bdlc-redesign-target]")).forEach(function(button){
      button.addEventListener("click",function(){
        activate(button.getAttribute("data-bdlc-redesign-target"),button.textContent);
      });
    });
    Array.prototype.slice.call(nav.querySelectorAll("[data-bdlc-redesign-toggle]")).forEach(function(button){
      button.addEventListener("click",function(){
        var group=nav.querySelector('[data-bdlc-redesign-group="'+button.getAttribute("data-bdlc-redesign-toggle")+'"]');
        if(!group){return;}
        var open=!group.classList.contains("is-open");
        group.classList.toggle("is-open",open);
        button.setAttribute("aria-expanded",open?"true":"false");
      });
    });

    root[NAV_FLAG]=true;
    var initial="resumen";
    try{initial=window.localStorage.getItem(STORAGE_KEY)||"resumen";}catch(error){}
    if(initial==="bases-externas"){initial="firebase";}
    var initialButton=nav.querySelector('[data-bdlc-redesign-target="'+initial+'"]');
    activate(initial,initialButton?initialButton.textContent:"Resumen");
    return true;
  }

  function updateCopy(){
    document.body.classList.add("bdlc-redesign-active");
    var eyebrow=document.querySelector(".bl2-eyebrow");
    var title=document.querySelector(".bl2-header h1");
    var subtitle=document.querySelector(".bl2-subtitle");
    if(eyebrow){eyebrow.textContent="Centro de datos de la aplicación";}
    if(title){title.textContent="Centro de Control de Datos";}
    if(subtitle){subtitle.textContent="Firebase es la base oficial. BDLocal conserva la caché, los respaldos y la cola segura de cambios.";}

    var sidebarTitle=document.querySelector(".bdlc-sidebar-title");
    var sidebarSubtitle=document.querySelector(".bdlc-sidebar-subtitle");
    if(sidebarTitle){sidebarTitle.textContent="Centro de datos";}
    if(sidebarSubtitle){sidebarSubtitle.textContent="Control y sincronización";}
    var footer=document.querySelector(".bdlc-sidebar-footer");
    if(footer){footer.innerHTML="<span></span><span>Firebase oficial · BDLocal caché</span>";}

    var periodTitle=document.querySelector(".bl2-period-strip-copy > span");
    var periodDescription=document.querySelector(".bl2-period-strip-copy p");
    if(periodTitle){periodTitle.textContent="Contexto de trabajo";}
    if(periodDescription){periodDescription.textContent="Las consultas y operaciones usan el período seleccionado. Las acciones masivas indican claramente su origen y destino.";}
  }

  function cardOf(statusId){
    var status=byId(statusId);
    return status&&status.closest?status.closest(".bdlc-connection-card"):null;
  }

  function setButton(id,label,className){
    var button=byId(id);
    if(!button){return;}
    if(label){button.textContent=label;}
    ["bdlc-action-primary","bdlc-action-secondary","bdlc-action-utility","bdlc-action-warning","bdlc-action-danger"].forEach(function(name){button.classList.remove(name);});
    if(className){button.classList.add(className);}
  }

  function setActionButton(card,action,label,className){
    var button=card&&card.querySelector('[data-bdlc-action="'+action+'"]');
    if(!button){return;}
    button.textContent=label;
    ["bdlc-action-primary","bdlc-action-secondary","bdlc-action-utility","bdlc-action-warning","bdlc-action-danger"].forEach(function(name){button.classList.remove(name);});
    if(className){button.classList.add(className);}
  }

  function badge(card,label,className){
    if(!card){return;}
    var current=card.querySelector(".bdlc-connection-head .bdlc-status");
    if(current){current.textContent=label;current.className="bdlc-status "+(className||"pending");}
  }

  function improveDetails(card){
    if(!card){return;}
    var summary=card.querySelector("details > summary");
    if(summary){summary.textContent="Configuración avanzada y seguridad";}
  }

  function buildWorkflow(section,host){
    if(!section||!host||byId(WORKFLOW_ID)){return;}
    var workflow=document.createElement("div");
    workflow.id=WORKFLOW_ID;
    workflow.className="bdlc-safe-workflow";
    workflow.innerHTML=
      '<div class="bdlc-safe-workflow-step"><span>1</span><div><strong>Comparar</strong><small>Revise Firebase y BDLocal sin escribir.</small></div></div>'+ 
      '<div class="bdlc-safe-workflow-step"><span>2</span><div><strong>Validar</strong><small>Compruebe pendientes, conflictos y conteos.</small></div></div>'+ 
      '<div class="bdlc-safe-workflow-step"><span>3</span><div><strong>Ejecutar</strong><small>Envíe o descargue únicamente el lote necesario.</small></div></div>';
    section.insertBefore(workflow,host);
  }

  function personalizeCard(card,key){
    if(!card){return;}
    card.setAttribute("data-connection-key",key);
    card.classList.add("bdlc-connection-"+key);
    improveDetails(card);
    var title=card.querySelector(".bdlc-connection-head h3");
    var description=card.querySelector(".bdlc-connection-head p");

    if(key==="firebase"){
      if(title){title.textContent="Firebase · base oficial";}
      if(description){description.textContent="Fuente oficial. BDLocal mantiene una copia rápida y una cola protegida para trabajar con continuidad.";}
      badge(card,"Base oficial","ok");
      var mode=byId("bdlc-firebase-mode");if(mode){mode.value="Cola segura y operaciones controladas";}
      var collection=byId("bdlc-firebase-collection");if(collection){collection.value="Colecciones Firebase V2";}
      setActionButton(card,"preview-firebase","Comparar período","bdlc-action-primary");
      setActionButton(card,"pull-firebase","Traer cambios a BDLocal","bdlc-action-secondary");
      setActionButton(card,"test-firebase","Probar conexión","bdlc-action-utility");
      setButton("bl2-btn-push-firebase","Enviar pendientes a Firebase","bdlc-action-primary");
      setButton("bl2-btn-fetch-firebase-config","Actualizar configuración","bdlc-action-utility");
      setButton("bl2-btn-pull-firebase-full-period","Releer período","bdlc-action-secondary");
    }

    if(key==="google"){
      if(title){title.textContent="Google Sheets";}
      if(description){description.textContent="Integración auxiliar para importar, exportar y conservar respaldos operativos.";}
      badge(card,"Importación y respaldo","pending");
      setButton("bl2-btn-pull-sheets","Importar período","bdlc-action-primary");
      setButton("bl2-btn-pull-sheets-all","Importar todos","bdlc-action-secondary");
      setButton("bl2-btn-push-google","Enviar respaldo pendiente","bdlc-action-secondary");
      setActionButton(card,"test-sheets","Probar conexión","bdlc-action-utility");
    }

    if(key==="supabase"){
      if(title){title.textContent="Supabase";}
      if(description){description.textContent="Integración paralela opcional. No participa en el flujo oficial mientras permanezca desactivada.";}
      badge(card,"Opcional","pending");
      setButton("bl2-btn-push-supabase","Enviar respaldo","bdlc-action-secondary");
      setActionButton(card,"test-supabase","Probar conexión","bdlc-action-utility");
    }
  }

  function transformConnections(){
    var staging=byId("bl2-section-bases-externas");
    var firebaseCard=cardOf("bl2-firebase-status");
    var googleCard=cardOf("bl2-google-status");
    var supabaseCard=cardOf("bl2-supabase-status");
    var firebaseHost=byId("bdlc-firebase-host");
    var googleHost=byId("bdlc-google-host");
    var supabaseHost=byId("bdlc-supabase-host");
    if(!staging||!firebaseCard||!googleCard||!supabaseCard||!firebaseHost||!googleHost||!supabaseHost){return false;}

    personalizeCard(firebaseCard,"firebase");
    personalizeCard(googleCard,"google");
    personalizeCard(supabaseCard,"supabase");
    firebaseHost.appendChild(firebaseCard);
    googleHost.appendChild(googleCard);
    supabaseHost.appendChild(supabaseCard);

    var firebaseSection=byId("bl2-section-firebase");
    buildWorkflow(firebaseSection,firebaseHost);

    var testAll=staging.querySelector('[data-bdlc-action="test-all"]');
    var firebaseHeader=firebaseSection&&firebaseSection.querySelector(".bdlc-header");
    if(testAll&&firebaseHeader&&testAll.parentNode!==firebaseHeader){
      testAll.textContent="Probar todas las conexiones";
      testAll.classList.add("bdlc-action-utility");
      firebaseHeader.appendChild(testAll);
    }

    staging.classList.add("bdlc-connections-staging");
    return true;
  }

  function transformSummary(){
    var section=byId("bl2-section-resumen");
    if(!section){return;}
    var title=section.querySelector(".bdlc-title");
    var description=section.querySelector(".bdlc-description");
    if(title){title.textContent="Resumen del sistema de datos";}
    if(description){description.textContent="Estado de Firebase, BDLocal, cambios pendientes, respaldos y período de trabajo.";}

    if(!section.querySelector(".bdlc-architecture-banner")){
      var header=section.querySelector(".bdlc-header");
      var banner=document.createElement("div");
      banner.className="bdlc-architecture-banner";
      banner.innerHTML=
        '<article class="is-official"><span>Base oficial</span><strong>Firebase</strong><small>Fuente de verdad institucional</small></article>'+ 
        '<article><span>Caché y continuidad</span><strong>BDLocal</strong><small>Trabajo rápido y sin conexión</small></article>'+ 
        '<article><span>Integraciones auxiliares</span><strong>Sheets y Supabase</strong><small>Importación y respaldos controlados</small></article>';
      if(header&&header.nextSibling){section.insertBefore(banner,header.nextSibling);}else{section.appendChild(banner);}
    }

    ["bl2-kpi-google","bl2-kpi-supabase"].forEach(function(id){
      var node=byId(id);var card=node&&node.closest?node.closest(".bdlc-kpi-card"):null;
      if(card){card.classList.add("bdlc-kpi-secondary");}
    });
    var firebase=byId("bl2-kpi-firebase");
    var firebaseCard=firebase&&firebase.closest?firebase.closest(".bdlc-kpi-card"):null;
    if(firebaseCard){firebaseCard.classList.add("bdlc-kpi-official");}

    var connections=byId("bdlc-summary-connections");
    if(connections&&connections.previousElementSibling){connections.previousElementSibling.textContent="Conexiones y cola segura";}
  }

  function moveMigration(){
    var panel=byId("bl2-firebase-migration-panel");
    var host=byId("bl2-firebase-migration-host");
    if(panel&&host&&panel.parentNode!==host){host.appendChild(panel);}
    var preview=byId("bl2-btn-migration-preview");
    var applyButton=byId("bl2-btn-migration-apply");
    if(preview){preview.classList.add("bdlc-action-secondary");}
    if(applyButton){applyButton.classList.add("bdlc-action-danger");}
  }

  function apply(){
    ensureStyle();
    ensureGuard();
    updateCopy();
    if(!ensureSections()){return false;}
    rebuildNavigation();
    transformSummary();
    var transformed=transformConnections();
    moveMigration();
    applied=!!transformed;
    ensureGuard();
    if(applied){
      try{window.dispatchEvent(new CustomEvent("requisitos:firebase-redesign-ready",{detail:{ok:true,version:VERSION,navigation:true,sections:true,guard:!!window.BDLExternalOperationGate,supplement:!!window.BDLExternalOperationSupplement,at:new Date().toISOString()}}));}catch(error){}
    }
    return applied;
  }

  function schedule(){
    window.clearTimeout(timer);
    timer=window.setTimeout(function(){
      attempts+=1;
      if(apply()||attempts>=100){return;}
      schedule();
    },attempts<12?100:250);
  }

  function observe(){
    if(observer||!document.body||typeof MutationObserver!=="function"){return;}
    observer=new MutationObserver(function(){
      if(!applied||!byId("bl2-firebase-migration-host")||!byId("bdlc-firebase-host")){attempts=0;schedule();return;}
      moveMigration();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  ["DOMContentLoaded","bdlocal:bl2-html-scripts-loaded","requisitos:arquitectura-compartida-lista","bdlocal:connections-cache-updated","bl2:external-pull-finished"].forEach(function(name){
    window.addEventListener(name,function(){attempts=0;schedule();observe();});
  });

  window.RequisitosFirebaseRedesign={
    version:VERSION,
    apply:apply,
    refresh:function(){applied=false;attempts=0;schedule();},
    activate:activate,
    status:function(){return {version:VERSION,applied:applied,attempts:attempts,navigation:!!(byId("bdlocal-control-center-root")&&byId("bdlocal-control-center-root")[NAV_FLAG]),sections:!!byId("bl2-section-firebase"),guard:!!window.BDLExternalOperationGate,supplement:!!window.BDLExternalOperationSupplement,actions:!!window.RequisitosFirebaseUserActions};}
  };

  ensureStyle();
  ensureGuard();
  schedule();
  observe();
})(window,document);

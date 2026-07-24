/* =========================================================
Nombre completo: bdl.firebase.redesign.js
Ruta: /BDLocal/firebase/bdl.firebase.redesign.js
Función:
- Aplicar el rediseño visual del Centro BDLocal sin cambiar su lógica.
- Presentar Firebase como fuente oficial y principal.
- Agrupar Google Sheets y Supabase como fuentes secundarias.
- Diferenciar acciones rutinarias, avanzadas y de riesgo.
- Cargar primero el bloqueo operativo y después las acciones visibles.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.2.0-operation-guard";
  var STYLE_ID="bdl-firebase-redesign-style";
  var GUARD_SCRIPT_ID="bdl-external-operation-guard-script";
  var ACTIONS_SCRIPT_ID="bdl-firebase-user-actions-script";
  var WORKFLOW_ID="bdlc-safe-workflow";
  var applied=false;
  var attempts=0;
  var timer=null;
  var scriptBase=document.currentScript&&document.currentScript.src?document.currentScript.src:window.location.href;

  function text(value){return String(value==null?"":value).trim();}
  function byId(id){return document.getElementById(id);}
  function styleUrl(){try{return new URL("bdl.firebase.redesign.css",scriptBase).href;}catch(error){return "./firebase/bdl.firebase.redesign.css";}}
  function guardUrl(){try{return new URL("bdl.external-operation.guard.js",scriptBase).href;}catch(error){return "./firebase/bdl.external-operation.guard.js";}}
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
      "bl2-btn-correct-firebase-base","bl2-btn-migration-preview","bl2-btn-migration-apply"
    ].forEach(function(id){var button=byId(id);if(button){button.disabled=true;}});
    var status=byId("bl2-firebase-migration-status");
    if(status){status.innerHTML="<strong>Operaciones bloqueadas</strong><span>"+text(message)+"</span>";}
  }

  function ensureActions(){
    if(!window.BDLExternalOperationGate){return;}
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
      try{console.warn("[Firebase redesign] No se pudieron cargar las acciones operativas.");}catch(error){}
    };
    (document.head||document.documentElement).appendChild(script);
  }

  function ensureGuard(){
    if(window.BDLExternalOperationGate){
      if(typeof window.BDLExternalOperationGate.patchAll==="function"){window.BDLExternalOperationGate.patchAll();}
      ensureActions();
      return;
    }
    var existing=byId(GUARD_SCRIPT_ID);
    if(existing){
      if(existing.getAttribute("data-bdl-guard-waiting")!=="true"){
        existing.setAttribute("data-bdl-guard-waiting","true");
        existing.addEventListener("load",ensureActions,{once:true});
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
      ensureActions();
    };
    script.onerror=function(){
      disableUnsafeControls("No se cargó el bloqueo único de operaciones. Reinicie la aplicación antes de continuar.");
      try{console.warn("[Firebase redesign] No se pudo cargar el bloqueo operativo.");}catch(error){}
    };
    (document.head||document.documentElement).appendChild(script);
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

  function addOfficialBadge(card){
    if(!card||card.querySelector(".bdlc-official-badge")){return;}
    var copy=card.querySelector(".bdlc-connection-head p");
    var badge=document.createElement("span");
    badge.className="bdlc-official-badge";
    badge.textContent="Fuente oficial de datos";
    if(copy&&copy.parentNode){copy.parentNode.appendChild(badge);}
  }

  function buildWorkflow(section,grid){
    if(byId(WORKFLOW_ID)){return;}
    var workflow=document.createElement("div");
    workflow.id=WORKFLOW_ID;
    workflow.className="bdlc-safe-workflow";
    workflow.innerHTML=
      '<div class="bdlc-safe-workflow-step"><span>1</span><div><strong>Comparar</strong><small>Revise Firebase y BDLocal sin escribir cambios.</small></div></div>'+ 
      '<div class="bdlc-safe-workflow-step"><span>2</span><div><strong>Validar</strong><small>Compruebe pendientes, conflictos y conteos.</small></div></div>'+ 
      '<div class="bdlc-safe-workflow-step"><span>3</span><div><strong>Ejecutar</strong><small>Aplique solo la operación manual necesaria.</small></div></div>';
    section.insertBefore(workflow,grid);
  }

  function organizeCards(grid,firebaseCard,googleCard,supabaseCard){
    if(!grid||!firebaseCard||!googleCard||!supabaseCard){return false;}
    grid.classList.add("bdlc-connections-redesigned");

    var primary=grid.querySelector(".bdlc-primary-source");
    if(!primary){
      primary=document.createElement("div");
      primary.className="bdlc-primary-source";
      grid.appendChild(primary);
    }

    var secondary=grid.querySelector(".bdlc-secondary-sources");
    if(!secondary){
      secondary=document.createElement("div");
      secondary.className="bdlc-secondary-sources";
      grid.appendChild(secondary);
    }

    primary.appendChild(firebaseCard);
    secondary.appendChild(googleCard);
    secondary.appendChild(supabaseCard);
    return true;
  }

  function improveDetails(card){
    if(!card){return;}
    var summary=card.querySelector("details > summary");
    if(summary){summary.textContent="Opciones avanzadas y seguridad";}
  }

  function apply(){
    ensureStyle();
    ensureGuard();

    var section=byId("bl2-section-bases-externas");
    if(!section){return false;}

    var grid=section.querySelector(".bdlc-connections-grid");
    var firebaseCard=cardOf("bl2-firebase-status");
    var googleCard=cardOf("bl2-google-status");
    var supabaseCard=cardOf("bl2-supabase-status");
    if(!grid||!firebaseCard||!googleCard||!supabaseCard){return false;}

    firebaseCard.classList.add("bdlc-connection-firebase");
    googleCard.classList.add("bdlc-connection-google");
    supabaseCard.classList.add("bdlc-connection-supabase");

    var title=section.querySelector(".bdlc-title");
    var description=section.querySelector(".bdlc-description");
    var overline=section.querySelector(".bdlc-overline");
    var alert=section.querySelector(":scope > .bdlc-alert.info");
    if(overline){overline.textContent="Fuentes y sincronización";}
    if(title){title.textContent="Fuentes de datos";}
    if(description){description.textContent="Firebase es la base oficial. BDLocal mantiene una copia rápida para trabajar sin conexión; todas las operaciones externas continúan siendo manuales.";}
    if(alert){alert.textContent="Firebase es la fuente oficial. Compare primero, revise los resultados y ejecute únicamente la acción necesaria.";}

    organizeCards(grid,firebaseCard,googleCard,supabaseCard);
    buildWorkflow(section,grid);
    addOfficialBadge(firebaseCard);

    setButton("bl2-btn-pull-firebase","Descargar a BDLocal","bdlc-action-secondary");
    setButton("bl2-btn-push-firebase",null,"bdlc-action-warning");
    setButton("bl2-btn-fetch-firebase-config","Actualizar estado","bdlc-action-utility");
    setButton("bl2-btn-pull-firebase-full-period","Releer período","bdlc-action-utility");

    var preview=section.querySelector('[data-bdlc-action="preview-firebase"]');
    if(preview){preview.textContent="Comparar período";preview.classList.add("bdlc-action-primary");}
    var testFirebase=section.querySelector('[data-bdlc-action="test-firebase"]');
    if(testFirebase){testFirebase.textContent="Probar conexión";testFirebase.classList.add("bdlc-action-utility");}

    setButton("bl2-btn-pull-sheets","Traer período","bdlc-action-primary");
    setButton("bl2-btn-pull-sheets-all","Traer todos","bdlc-action-secondary");
    setButton("bl2-btn-push-google",null,"bdlc-action-warning");
    var testSheets=section.querySelector('[data-bdlc-action="test-sheets"]');
    if(testSheets){testSheets.textContent="Probar conexión";testSheets.classList.add("bdlc-action-utility");}

    setButton("bl2-btn-push-supabase",null,"bdlc-action-warning");
    var testSupabase=section.querySelector('[data-bdlc-action="test-supabase"]');
    if(testSupabase){testSupabase.textContent="Probar conexión";testSupabase.classList.add("bdlc-action-secondary");}

    [firebaseCard,googleCard,supabaseCard].forEach(improveDetails);

    var migrationPreview=byId("bl2-btn-migration-preview");
    if(migrationPreview){migrationPreview.classList.add("bdlc-action-secondary");}
    var migrationApply=byId("bl2-btn-migration-apply");
    if(migrationApply){migrationApply.classList.add("bdlc-action-danger");}

    applied=true;
    ensureGuard();
    try{window.dispatchEvent(new CustomEvent("requisitos:firebase-redesign-ready",{detail:{ok:true,version:VERSION,guard:!!window.BDLExternalOperationGate,at:new Date().toISOString()}}));}catch(error){}
    return true;
  }

  function schedule(){
    window.clearTimeout(timer);
    timer=window.setTimeout(function(){
      attempts+=1;
      if(apply()||attempts>=80){return;}
      schedule();
    },attempts<10?120:250);
  }

  ["DOMContentLoaded","bdlocal:bl2-html-scripts-loaded","requisitos:arquitectura-compartida-lista","bdlocal:connections-cache-updated","bl2:external-pull-finished"].forEach(function(name){
    window.addEventListener(name,function(){attempts=0;schedule();});
  });

  window.RequisitosFirebaseRedesign={
    version:VERSION,
    apply:apply,
    refresh:function(){applied=false;attempts=0;schedule();},
    status:function(){return {version:VERSION,applied:applied,attempts:attempts,guard:!!window.BDLExternalOperationGate,actions:!!window.RequisitosFirebaseUserActions};}
  };

  ensureStyle();
  ensureGuard();
  schedule();
})(window,document);

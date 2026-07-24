/* =========================================================
Nombre completo: bdl.firebase.migration-ui.js
Ruta: /BDLocal/firebase/bdl.firebase.migration-ui.js
Función:
- Mostrar la migración V2 dentro de Base Local.
- Esperar a que la tarjeta Firebase exista antes de insertar el panel.
- Cargar la capa de rediseño visual sin alterar la lógica de datos.
- Crear una vista previa y respaldo antes de habilitar escrituras.
- Exigir una frase exacta para aplicar la migración.
- Mostrar conteos, errores, conflictos y resultado por colección.
- No ofrecer ni ejecutar eliminación de colecciones legacy.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.2.0-redesign-loader";
  var FLAG="__firebaseMigrationUIBound";
  var busy=false;
  var preview=null;
  var bindTimer=null;
  var bindAttempts=0;
  var MAX_BIND_ATTEMPTS=150;
  var scriptBase=document.currentScript&&document.currentScript.src?document.currentScript.src:window.location.href;

  function text(value){return String(value==null?"":value).trim();}
  function byId(id){return document.getElementById(id);}
  function migration(){return window.RequisitosFirebaseMigration||null;}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function card(){var status=byId("bl2-firebase-status");return status&&status.closest?status.closest(".bdlc-connection-card"):null;}
  function log(message,level){
    var box=byId("bl2-log");
    if(box){
      var item=document.createElement("div");
      item.className="bl2-log-item "+(level?"is-"+level:"");
      item.innerHTML="<strong>Migración V2</strong><span>"+esc(message)+"</span>";
      box.insertBefore(item,box.firstChild);
    }
  }
  function redesignUrl(){try{return new URL("bdl.firebase.redesign.js",scriptBase).href;}catch(error){return "./firebase/bdl.firebase.redesign.js";}}
  function loadRedesign(){
    if(window.RequisitosFirebaseRedesign){
      if(typeof window.RequisitosFirebaseRedesign.refresh==="function"){window.RequisitosFirebaseRedesign.refresh();}
      return Promise.resolve(window.RequisitosFirebaseRedesign);
    }
    var url=redesignUrl();
    var existing=Array.prototype.slice.call(document.scripts||[]).find(function(script){return script.src===url||script.getAttribute("data-bdl-redesign-src")===url;});
    if(existing){
      return new Promise(function(resolve){
        if(window.RequisitosFirebaseRedesign){resolve(window.RequisitosFirebaseRedesign);return;}
        existing.addEventListener("load",function(){resolve(window.RequisitosFirebaseRedesign||null);},{once:true});
        window.setTimeout(function(){resolve(window.RequisitosFirebaseRedesign||null);},1800);
      });
    }
    return new Promise(function(resolve){
      var script=document.createElement("script");
      script.src=url;
      script.async=false;
      script.setAttribute("data-bdl-redesign-src",url);
      script.onload=function(){resolve(window.RequisitosFirebaseRedesign||null);};
      script.onerror=function(){resolve(null);};
      (document.head||document.documentElement).appendChild(script);
    });
  }
  function ensureReady(timeoutMs){
    timeoutMs=Math.max(1000,Number(timeoutMs||10000));var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        if(migration()){resolve(migration());return;}
        if(window.BDLOutboxBridge&&typeof window.BDLOutboxBridge.loadSharedArchitecture==="function"){
          window.BDLOutboxBridge.loadSharedArchitecture().catch(function(){});
        }
        if(Date.now()-started>=timeoutMs){reject(new Error("La migración Firebase V2 no terminó de cargar."));return;}
        window.setTimeout(check,70);
      })();
    });
  }
  function ensurePanel(){
    var host=card();if(!host){return null;}
    if(byId("bl2-firebase-migration-panel")){return byId("bl2-firebase-migration-panel");}
    var panel=document.createElement("section");
    panel.id="bl2-firebase-migration-panel";
    panel.className="bdlc-card";
    panel.innerHTML=
      '<div class="bdlc-section-heading"><div><span class="bdlc-kicker">Migración no destructiva</span><h3>Actualizar colecciones antiguas</h3><p>La vista previa crea un respaldo local antes de habilitar la migración. Estudiantes y EstudiantesPeriodo no se eliminan.</p></div></div>'+ 
      '<div class="bdlc-actions">'+ 
        '<button id="bl2-btn-migration-preview" class="bdlc-button primary" type="button">Crear vista previa y respaldo</button>'+ 
        '<button id="bl2-btn-migration-apply" class="bdlc-button danger" type="button" disabled>Aplicar migración V2</button>'+ 
      '</div>'+ 
      '<div id="bl2-firebase-migration-status" class="bdlc-placeholder"><strong>Sin vista previa</strong><span>No se ha leído ni modificado información legacy.</span></div>'+ 
      '<div id="bl2-firebase-migration-result"></div>';
    host.appendChild(panel);
    loadRedesign().then(function(redesign){if(redesign&&typeof redesign.apply==="function"){redesign.apply();}});
    return panel;
  }
  function setBusy(value,message){
    busy=!!value;
    ["bl2-btn-migration-preview","bl2-btn-migration-apply"].forEach(function(id){var button=byId(id);if(button){button.disabled=busy||(id==="bl2-btn-migration-apply"&&!preview);}});
    var status=byId("bl2-firebase-migration-status");
    if(status&&message){status.innerHTML="<strong>Procesando</strong><span>"+esc(message)+"</span>";}
  }
  function countTable(counts){
    counts=counts||{};
    var order=["estudiantes","matriculas","requisitos","notas","periodos","carreras","historial","importaciones"];
    return '<div class="bdlc-table-wrap"><table class="bdlc-table"><thead><tr><th>Colección nueva</th><th>Documentos previstos</th></tr></thead><tbody>'+order.map(function(entity){return "<tr><td>"+esc(entity)+"</td><td>"+Number(counts[entity]||0)+"</td></tr>";}).join("")+"</tbody></table></div>";
  }
  function renderPreview(result){
    preview=result;
    var status=byId("bl2-firebase-migration-status");
    var output=byId("bl2-firebase-migration-result");
    if(status){
      status.className="bdlc-placeholder";
      status.innerHTML="<strong>Vista previa creada</strong><span>Respaldo: "+esc(result.backup&&result.backup.backupId)+" · Huella: "+esc(result.fingerprint)+"</span>";
    }
    if(output){
      output.innerHTML=countTable(result.counts)+
        (result.errors&&result.errors.length?'<div class="bdlc-placeholder"><strong>'+result.errors.length+' error(es) de transformación</strong><span>La migración permanecerá bloqueada hasta corregirlos.</span></div>':'<div class="bdlc-placeholder"><strong>Transformación válida</strong><span>La vista previa no modificó las colecciones antiguas ni nuevas.</span></div>')+
        (result.warnings&&result.warnings.length?'<div class="bdlc-placeholder"><strong>Advertencias</strong><span>'+esc(result.warnings.join(" · "))+'</span></div>':'');
    }
    var apply=byId("bl2-btn-migration-apply");
    if(apply){apply.disabled=busy||!result.token||Boolean(result.errors&&result.errors.length);}
  }
  function renderResult(result){
    var status=byId("bl2-firebase-migration-status");
    var output=byId("bl2-firebase-migration-result");
    if(status){
      status.innerHTML="<strong>"+esc(result.message||"Migración finalizada")+"</strong><span>Escritos: "+Number(result.written||0)+" · Sin cambios: "+Number(result.unchanged||0)+" · Conflictos: "+Number(result.conflicts||0)+" · Errores: "+Number(result.failed||0)+"</span>";
    }
    if(output){
      output.innerHTML='<div class="bdlc-table-wrap"><table class="bdlc-table"><thead><tr><th>Colección</th><th>Escritos</th><th>Sin cambios</th><th>Conflictos</th><th>Errores</th></tr></thead><tbody>'+Object.keys(result.byEntity||{}).map(function(entity){var item=result.byEntity[entity]||{};return "<tr><td>"+esc(entity)+"</td><td>"+Number(item.written||0)+"</td><td>"+Number(item.unchanged||0)+"</td><td>"+Number(item.conflicts||0)+"</td><td>"+Number(item.failed||0)+"</td></tr>";}).join("")+"</tbody></table></div>"+
        '<div class="bdlc-placeholder"><strong>Colecciones antiguas conservadas</strong><span>La migración no ejecutó eliminaciones.</span></div>';
    }
  }
  function createPreview(){
    if(busy){return Promise.reject(new Error("Ya existe una operación de migración en curso."));}
    if(!window.confirm("Migración Firebase V2\n\nSe leerán Estudiantes, EstudiantesPeriodo e historiales antiguos y se creará un respaldo completo en BDLocal.\nNo se escribirá todavía en las colecciones nuevas.\n\n¿Continuar?")){
      return Promise.resolve({ok:true,cancelled:true});
    }
    preview=null;setBusy(true,"Leyendo colecciones legacy y creando respaldo...");
    return ensureReady().then(function(current){return current.preview({limit:400,maxPages:500});}).then(function(result){
      renderPreview(result);
      log("Vista previa creada. "+Number(result.counts&&result.counts.matriculas||0)+" matrículas previstas.",result.errors&&result.errors.length?"warn":"ok");
      window.alert("Vista previa finalizada.\n\nRespaldo: "+text(result.backup&&result.backup.backupId)+"\nErrores: "+Number(result.errors&&result.errors.length||0)+"\nLas colecciones antiguas no fueron modificadas.");
      return result;
    }).finally(function(){setBusy(false);});
  }
  function applyMigration(){
    if(busy){return Promise.reject(new Error("Ya existe una operación de migración en curso."));}
    if(!preview||!preview.token){return Promise.reject(new Error("Genere primero una vista previa."));}
    if(preview.errors&&preview.errors.length){return Promise.reject(new Error("La vista previa contiene errores y no puede aplicarse."));}
    var current=migration();
    var phrase=current&&current.confirmation||"MIGRAR A FIREBASE V2";
    var entered=window.prompt("Escriba exactamente la siguiente frase para aplicar la migración:\n\n"+phrase+"\n\nLas colecciones antiguas se conservarán.","");
    if(text(entered)!==phrase){return Promise.reject(new Error("La frase de confirmación no coincide."));}
    if(!window.confirm("Confirmación final\n\nSe escribirán documentos en las colecciones V2. Los documentos diferentes que ya existan se registrarán como conflictos y no serán reemplazados.\n\n¿Aplicar ahora?")){
      return Promise.resolve({ok:true,cancelled:true});
    }
    setBusy(true,"Aplicando documentos V2 de forma idempotente...");
    return current.apply(preview.token,entered,{overwriteExisting:false,continueOnError:true}).then(function(result){
      renderResult(result);
      log(result.message||"Migración finalizada.",result.ok?"ok":"warn");
      if(window.RequisitosFirebaseControlCenter&&typeof window.RequisitosFirebaseControlCenter.refreshStatus==="function"){
        window.RequisitosFirebaseControlCenter.refreshStatus().catch(function(){});
      }
      window.alert((result.message||"Migración finalizada.")+"\n\nEscritos: "+Number(result.written||0)+"\nConflictos: "+Number(result.conflicts||0)+"\nErrores: "+Number(result.failed||0)+"\n\nLas colecciones antiguas permanecen intactas.");
      return result;
    }).finally(function(){setBusy(false);});
  }
  function scheduleBind(delay){
    if(window[FLAG]||bindTimer||bindAttempts>=MAX_BIND_ATTEMPTS){return;}
    bindTimer=window.setTimeout(function(){
      bindTimer=null;
      bindAttempts+=1;
      bind();
    },Math.max(50,Number(delay||100)));
  }
  function bind(){
    if(window[FLAG]){return window.RequisitosFirebaseMigrationUI;}
    if(!ensurePanel()){
      scheduleBind(100);
      return null;
    }
    var previewButton=byId("bl2-btn-migration-preview");
    var applyButton=byId("bl2-btn-migration-apply");
    if(previewButton){previewButton.addEventListener("click",function(event){event.preventDefault();createPreview().catch(function(error){log(error.message||String(error),"error");window.alert(error.message||String(error));setBusy(false);});});}
    if(applyButton){applyButton.addEventListener("click",function(event){event.preventDefault();applyMigration().catch(function(error){log(error.message||String(error),"error");window.alert(error.message||String(error));setBusy(false);});});}
    window[FLAG]=true;
    if(bindTimer){window.clearTimeout(bindTimer);bindTimer=null;}
    loadRedesign();
    return window.RequisitosFirebaseMigrationUI;
  }

  window.RequisitosFirebaseMigrationUI={
    version:VERSION,
    manualOnly:true,
    destructive:false,
    bind:bind,
    preview:createPreview,
    apply:applyMigration,
    status:function(){return {version:VERSION,bound:!!window[FLAG],busy:busy,hasPreview:!!preview,destructive:false,bindAttempts:bindAttempts};}
  };

  ["DOMContentLoaded","bdlocal:bl2-html-scripts-loaded","requisitos:arquitectura-compartida-lista"].forEach(function(eventName){
    window.addEventListener(eventName,function(){loadRedesign();scheduleBind(50);},{once:true});
  });

  loadRedesign();
  bind();
  scheduleBind(100);
})(window,document);

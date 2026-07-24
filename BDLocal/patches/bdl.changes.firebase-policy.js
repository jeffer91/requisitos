/* =========================================================
Nombre completo: bdl.changes.firebase-policy.js
Ruta: /BDLocal/patches/bdl.changes.firebase-policy.js
Función:
- Aplicar Firebase como destino operativo por defecto en cambios_pendientes.
- Evitar que una nueva revisión reactive Sheets o Supabase por compatibilidad legacy.
- Respetar acciones que soliciten explícitamente Google, Supabase o Firebase.
- Preservar estados sincronizados cuando el contenido no cambia.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-firebase-official-policy";
  var FLAG="__bdlFirebaseOutboxPolicyInstalled";
  var installing=null;

  function text(value){return String(value==null?"":value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function upper(value){return text(value).toUpperCase();}
  function list(value){
    if(Array.isArray(value)){return value.map(function(item){return text(item).toLowerCase();}).filter(Boolean);}
    return text(value).split(/[\s,;|]+/).map(function(item){return item.toLowerCase();}).filter(Boolean);
  }
  function repo(){
    if(window.BDLRepoCambios){return window.BDLRepoCambios;}
    var registry=window.BDLRepositories;
    return registry&&typeof registry.get==="function"
      ? registry.get("cambios_pendientes")||registry.get("cambios")
      : null;
  }
  function hasOwn(row,names){return names.some(function(name){return Object.prototype.hasOwnProperty.call(row||{},name);});}
  function requested(row,options,target){
    row=row||{};options=options||{};target=text(target).toLowerCase();
    var values=list(options.targets||options.target||row.targets||row.target||row.destinos||row.destino);
    if(target==="google"){return values.some(function(item){return item==="google"||item==="sheets"||item==="google_sheets";});}
    if(target==="firebase"){return values.some(function(item){return item==="firebase"||item==="firestore";});}
    return values.some(function(item){return item==="supabase";});
  }
  function targetListPresent(row,options){
    return list(options&&options.targets||options&&options.target||row&&row.targets||row&&row.target||row&&row.destinos||row&&row.destino).length>0;
  }
  function desired(row,options,target){
    row=row||{};options=options||{};
    if(target==="firebase"){
      if(hasOwn(row,["estadoFirebase","statusFirebase"])){
        return upper(row.estadoFirebase||row.statusFirebase||"PENDIENTE");
      }
      return requested(row,options,"firebase")||!targetListPresent(row,options)?"PENDIENTE":"SINCRONIZADO";
    }
    if(target==="google"){
      if(hasOwn(row,["estadoSheets","statusGoogle"])){
        return upper(row.estadoSheets||row.statusGoogle||"SINCRONIZADO");
      }
      return requested(row,options,"google")?"PENDIENTE":"SINCRONIZADO";
    }
    if(hasOwn(row,["estadoSupabase","statusSupabase"])){
      return upper(row.estadoSupabase||row.statusSupabase||"SINCRONIZADO");
    }
    return requested(row,options,"supabase")?"PENDIENTE":"SINCRONIZADO";
  }
  function fields(target){
    if(target==="google"){
      return ["estadoSheets","statusGoogle","sincronizadoEnSheets","ultimoErrorSheets","nextRetryAtSheets","bloqueadoSheets","intentosSheets"];
    }
    if(target==="firebase"){
      return ["estadoFirebase","statusFirebase","sincronizadoEnFirebase","ultimoErrorFirebase","nextRetryAtFirebase","bloqueadoFirebase","intentosFirebase"];
    }
    return ["estadoSupabase","statusSupabase","sincronizadoEnSupabase","ultimoErrorSupabase","nextRetryAtSupabase","bloqueadoSupabase","intentosSupabase"];
  }
  function applyTarget(row,target,status){
    var targetFields=fields(target);
    status=upper(status||"SINCRONIZADO");
    row[targetFields[0]]=status;
    row[targetFields[1]]=status;
    if(status==="SINCRONIZADO"){
      row[targetFields[3]]="";
      row[targetFields[4]]="";
      row[targetFields[5]]=false;
      row[targetFields[6]]=Number(row[targetFields[6]]||0);
    }else if(status==="PENDIENTE"){
      row[targetFields[2]]="";
      row[targetFields[3]]="";
      row[targetFields[4]]="";
      row[targetFields[5]]=false;
      row[targetFields[6]]=0;
    }
    return row;
  }
  function applyPolicy(row,source,options,contentChanged){
    row=Object.assign({},row||{});source=source||{};options=options||{};
    if(contentChanged!==false){
      ["google","firebase","supabase"].forEach(function(target){
        applyTarget(row,target,desired(source,options,target));
      });
    }
    row.firebaseOfficialPolicy=true;
    row.firebaseOfficialPolicyVersion=VERSION;
    return row;
  }
  function install(){
    if(window[FLAG]){return Promise.resolve(window.BDLFirebaseOutboxPolicy);}
    if(installing){return installing;}
    var started=Date.now();
    installing=new Promise(function(resolve,reject){
      (function check(){
        var current=repo();
        if(current&&typeof current.save==="function"&&typeof current.normalize==="function"&&typeof current.mergeExisting==="function"&&typeof current.getByIds==="function"){
          var originalSave=current.save.bind(current);
          var originalNormalize=current.normalize.bind(current);
          var originalMerge=current.mergeExisting.bind(current);
          var originalGetByIds=current.getByIds.bind(current);

          current.save=function(row,options){
            options=Object.assign({},options||{});
            if(options.__firebasePolicyBypass===true){return originalSave(row,options);}
            var source=clone(row||{});
            var normalized=originalNormalize(source,options);
            return originalGetByIds([normalized.id]).then(function(rows){
              var existing=rows&&rows[0]||null;
              var changed=!existing||text(existing.contentHash)!==text(normalized.contentHash);
              var next=options.replace===true?normalized:originalMerge(existing,normalized);
              next=applyPolicy(next,source,options,changed);
              return originalSave(next,Object.assign({},options,{replace:true,__firebasePolicyBypass:true}));
            });
          };
          current.saveMany=function(rows,options){
            rows=Array.isArray(rows)?rows:[];var saved=[],chain=Promise.resolve();
            rows.forEach(function(row){chain=chain.then(function(){return current.save(row,options||{}).then(function(item){if(item){saved.push(item);}});});});
            return chain.then(function(){return saved;});
          };
          current.firebaseTargetPolicy={version:VERSION,defaultTarget:"firebase",googleRole:"explicit_export",supabaseRole:"explicit_only"};
          window.BDLRepoCambios=current;
          window[FLAG]=true;
          try{window.dispatchEvent(new CustomEvent("bdlocal:firebase-outbox-policy-ready",{detail:clone(current.firebaseTargetPolicy)}));}catch(error){}
          resolve(window.BDLFirebaseOutboxPolicy);
          return;
        }
        if(Date.now()-started>10000){reject(new Error("No se pudo instalar la política Firebase de cambios_pendientes."));return;}
        window.setTimeout(check,50);
      })();
    }).finally(function(){installing=null;});
    return installing;
  }

  window.BDLFirebaseOutboxPolicy={version:VERSION,install:install,applyPolicy:applyPolicy,desired:desired,requested:requested,status:function(){return {version:VERSION,installed:!!window[FLAG],defaultTarget:"firebase"};}};
  install().catch(function(error){try{console.warn("[BDLFirebaseOutboxPolicy]",error);}catch(innerError){}});
})(window);

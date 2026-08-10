/* =========================================================
Nombre completo: carga.firebase-rootfix.js
Ruta: /Carga/carga.firebase-rootfix.js
Función:
- Corregir la ruta real Carga -> BDLocal -> Firebase sin crear conexiones paralelas.
- Persistir contactos del archivo de Carga también en el repositorio oficial de contactos.
- Recuperar correos/celular desde todas las copias locales válidas antes de reconstruir Firebase.
- Limpiar únicamente la cola reconstruible de Carga del período antes de generar una nueva.
- Hidratar cada lote Firebase con contactos locales antes de analizarlo y escribirlo.
- Mantener lotes, validaciones, conflictos y repositorio Firebase existentes.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-carga-root-sync-fix";
  var installingTarget=false;
  var preflightTask=null;
  var originalCargaSave=null;

  function text(value){return String(value==null?"":value).trim();}
  function canon(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function norm(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  }
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function first(row,names){
    row=row||{};names=Array.isArray(names)?names:[];
    var keys=Object.keys(row),wanted=names.map(norm);
    for(var i=0;i<keys.length;i+=1){
      if(wanted.indexOf(norm(keys[i]))>=0&&text(row[keys[i]])!==""){return row[keys[i]];}
    }
    return "";
  }
  function cedulaOf(row){
    row=row||{};
    var rules=window.BDLRulesPersona||{};
    var raw=first(row,["cedula","numeroIdentificacion","NumeroIdentificacion","identificacion","Cedula","Cédula","_cedula"]);
    if(typeof rules.normalizeCedula==="function"){
      try{return text(rules.normalizeCedula(raw));}catch(error){}
    }
    raw=text(raw).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }
  function periodOf(row,fallback){
    row=row||{};
    return canon(first(row,["periodoId","periodId","periodoCanonicoId","ultimoPeriodoId","_periodoId"])||fallback||"");
  }
  function selectedPeriod(){
    var select=document.getElementById("cargaPeriodoSelect");
    return canon(select&&select.value||"");
  }
  function payloadOf(row){
    row=row||{};
    return row.payload||row.data||row.registro||{};
  }
  function contactView(row){
    row=row||{};
    return {
      correoPersonal:text(first(row,["correoPersonal","CorreoPersonal","correo_personal","emailPersonal","email","correo"])),
      correoInstitucional:text(first(row,["correoInstitucional","CorreoInstitucional","correo_institucional","emailInstitucional"])),
      celular:text(first(row,["celular","Celular","telefono","Telefono","Teléfono","movil","móvil"])),
      telegramUser:text(first(row,["telegramUser","_telegramUser","usuarioTelegram","telegram"])).replace(/^@+/,""),
      telegramChatId:text(first(row,["telegramChatId","_telegramChatId","chatIdTelegram","chatId"]))
    };
  }
  function hasContact(row){
    var current=contactView(row);
    return !!(current.correoPersonal||current.correoInstitucional||current.celular||current.telegramUser||current.telegramChatId);
  }
  function mergeContact(target,source){
    target=target||{};source=contactView(source);
    Object.keys(source).forEach(function(key){if(text(source[key])!==""){target[key]=source[key];}});
    return target;
  }
  function contactRecord(cedula,periodoId,data){
    var id=cedula&&periodoId?cedula+"__"+periodoId:"";
    var contact=mergeContact({},data);
    return {
      id:id,idEstudiantePeriodo:id,studentId:id,
      cedula:cedula,numeroIdentificacion:cedula,
      periodoId:periodoId,periodId:periodoId,
      correoPersonal:contact.correoPersonal||"",
      correoInstitucional:contact.correoInstitucional||"",
      celular:contact.celular||"",
      CorreoPersonal:contact.correoPersonal||"",
      CorreoInstitucional:contact.correoInstitucional||"",
      Celular:contact.celular||"",
      telegramUser:contact.telegramUser||"",
      telegramChatId:contact.telegramChatId||"",
      _telegramUser:contact.telegramUser||"",
      _telegramChatId:contact.telegramChatId||"",
      source:"carga_rootfix",
      updatedAt:new Date().toISOString()
    };
  }

  function ensureLocal(){
    var task=Promise.resolve();
    var index=window.CargaConnectionIndex;
    if(index&&typeof index.ensureConnector==="function"){
      task=task.then(function(){return index.ensureConnector();});
    }
    return task.then(function(){
      var hub=window.BDLocalConexiones;
      return hub&&typeof hub.ensureCoreReady==="function"?hub.ensureCoreReady():true;
    });
  }

  function rowsFromNormalized(normalized){
    normalized=normalized||{};
    if(Array.isArray(normalized.rowsMapeadas)){return normalized.rowsMapeadas;}
    if(Array.isArray(normalized.rows)){return normalized.rows;}
    if(Array.isArray(normalized.students)){return normalized.students;}
    return [];
  }

  function saveContacts(rows,periodoId){
    rows=Array.isArray(rows)?rows:[];periodoId=canon(periodoId);
    var repo=window.BDLRepoContactos;
    if(!repo||typeof repo.save!=="function"){return Promise.resolve({saved:0,candidates:0});}
    var map=Object.create(null);
    rows.forEach(function(row){
      var cedula=cedulaOf(row);var period=periodOf(row,periodoId);
      if(!cedula||!period||period!==periodoId||!hasContact(row)){return;}
      var key=cedula+"__"+period;
      map[key]=mergeContact(map[key]||{},row);
      map[key].cedula=cedula;map[key].periodoId=period;
    });
    var keys=Object.keys(map),saved=0,index=0;
    function batch(){
      var slice=keys.slice(index,index+25);index+=slice.length;
      if(!slice.length){return Promise.resolve({saved:saved,candidates:keys.length});}
      return Promise.all(slice.map(function(key){
        var item=map[key];
        return repo.save(contactRecord(item.cedula,item.periodoId,item),{writeLegacy:true,source:"Carga.firebase.rootfix"})
          .then(function(result){if(result){saved+=1;}return result;});
      })).then(batch);
    }
    return batch();
  }

  function stateRows(periodoId){
    try{
      var state=window.CargaState&&typeof window.CargaState.get==="function"?window.CargaState.get():null;
      var normalized=state&&state.normalized||{};
      return rowsFromNormalized(normalized).filter(function(row){
        var period=periodOf(row,periodoId);
        return !period||period===periodoId;
      });
    }catch(error){return [];}
  }

  function consolidateContacts(periodoId){
    periodoId=canon(periodoId);
    var contacts=window.BDLRepoContactos;
    var persons=window.BDLRepoPersonas;
    var students=window.BDLRepoEstudiantesV2||
      (window.BDLRepositories&&window.BDLRepositories.get&&window.BDLRepositories.get("estudiantes"));
    var enrollments=window.BDLRepoMatriculas||
      (window.BDLRepositories&&window.BDLRepositories.get&&window.BDLRepositories.get("matriculas"));

    function list(repo,options){
      return repo&&typeof repo.list==="function"?Promise.resolve(repo.list(options||{})).catch(function(){return [];}):Promise.resolve([]);
    }

    return Promise.all([
      list(contacts,{periodoId:periodoId}),
      list(persons,{}),
      list(students,{periodoId:periodoId}),
      list(enrollments,{periodoId:periodoId})
    ]).then(function(values){
      var allowed=Object.create(null);
      (values[2]||[]).concat(values[3]||[]).forEach(function(row){var id=cedulaOf(row);if(id){allowed[id]=true;}});
      var map=Object.create(null);
      function add(row){
        var id=cedulaOf(row);if(!id||(!allowed[id]&&Object.keys(allowed).length)){return;}
        if(!hasContact(row)){return;}
        map[id]=mergeContact(map[id]||{},row);
      }
      (values[1]||[]).forEach(add);
      (values[2]||[]).forEach(add);
      (values[3]||[]).forEach(add);
      stateRows(periodoId).forEach(add);
      /* El repositorio oficial va al final para que sus valores no vacíos tengan prioridad. */
      (values[0]||[]).forEach(add);
      var rows=Object.keys(map).map(function(id){
        return Object.assign({cedula:id,periodoId:periodoId},map[id]);
      });
      return saveContacts(rows,periodoId).then(function(result){
        result.sources={official:(values[0]||[]).length,persons:(values[1]||[]).length,students:(values[2]||[]).length,enrollments:(values[3]||[]).length,state:stateRows(periodoId).length};
        return result;
      });
    });
  }

  function sourceOf(row){
    row=row||{};var payload=payloadOf(row);
    return norm([row.source,row.origen,row.pantalla,row.screen,row.modulo,payload.source,payload.origen,payload.pantalla,payload.screen,payload.modulo].filter(Boolean).join(" "));
  }
  function tableOf(row){return norm(row&&(row.tabla||row.table||row.tipo||row.type)||"");}
  function isCargaOutboxRow(row){
    var table=tableOf(row),source=sourceOf(row);
    if(/nota|evaluacion|defensa|complex/.test(table)){return false;}
    if(/historial|log/.test(table)){return /carga/.test(source)||row.firebaseRebuild===true;}
    if(/importacion/.test(table)){return !/ncomplex|complexivo/.test(source);}
    return /persona|contact|estudiante|matricula|division|requisit|periodo|carrera/.test(table);
  }
  function clearCargaOutbox(periodoId){
    periodoId=canon(periodoId);
    var db=window.BL2DB;
    var store=window.BL2Config&&window.BL2Config.stores&&window.BL2Config.stores.cambiosPendientes||"cambios_pendientes";
    if(!db||typeof db.getAll!=="function"||typeof db.remove!=="function"){return Promise.resolve({removed:0,total:0});}
    return db.getAll(store).then(function(rows){
      rows=Array.isArray(rows)?rows:[];
      var targets=rows.filter(function(row){return canon(row&&row.periodoId||"")===periodoId&&isCargaOutboxRow(row);});
      var index=0,removed=0;
      function batch(){
        var slice=targets.slice(index,index+25);index+=slice.length;
        if(!slice.length){
          try{if(window.BDLSyncOutbox&&typeof window.BDLSyncOutbox.invalidateCache==="function"){window.BDLSyncOutbox.invalidateCache();}}catch(error){}
          try{if(window.BDLRepoCambios&&typeof window.BDLRepoCambios.invalidateCache==="function"){window.BDLRepoCambios.invalidateCache();}}catch(error2){}
          return {removed:removed,total:targets.length};
        }
        return Promise.all(slice.map(function(row){
          var id=text(row&&row.id||row&&row.cambioId);
          return id?db.remove(store,id).then(function(ok){if(ok){removed+=1;}return ok;}):Promise.resolve(false);
        })).then(batch);
      }
      return batch();
    });
  }

  function hydrateRowsForFirebase(rows,options){
    rows=Array.isArray(rows)?rows:[];options=options||{};
    var repo=window.BDLRepoContactos;
    if(!repo){return Promise.resolve(rows);}
    var cache=Object.create(null);
    function getContact(cedula,periodoId){
      var key=cedula+"__"+periodoId;
      if(cache[key]){return cache[key];}
      if(typeof repo.getByCedula==="function"){
        cache[key]=Promise.resolve(repo.getByCedula(cedula,periodoId)).catch(function(){return null;});
      }else if(typeof repo.list==="function"){
        cache[key]=Promise.resolve(repo.list({cedula:cedula,periodoId:periodoId})).then(function(list){return list&&list[0]||null;}).catch(function(){return null;});
      }else{cache[key]=Promise.resolve(null);}
      return cache[key];
    }
    return Promise.all(rows.map(function(row){
      var payload=payloadOf(row),cedula=cedulaOf(Object.assign({},payload,row));
      var periodoId=periodOf(Object.assign({},payload,row),options.periodoId||selectedPeriod());
      if(!cedula||!periodoId){return row;}
      return getContact(cedula,periodoId).then(function(contact){
        if(!contact||!hasContact(contact)){return row;}
        var merged=Object.assign({},payload);
        var current=contactView(contact);
        if(current.correoPersonal){merged.correoPersonal=current.correoPersonal;merged.CorreoPersonal=current.correoPersonal;}
        if(current.correoInstitucional){merged.correoInstitucional=current.correoInstitucional;merged.CorreoInstitucional=current.correoInstitucional;}
        if(current.celular){merged.celular=current.celular;merged.Celular=current.celular;}
        if(current.telegramUser){merged.telegramUser=current.telegramUser;merged._telegramUser=current.telegramUser;}
        if(current.telegramChatId){merged.telegramChatId=current.telegramChatId;merged._telegramChatId=current.telegramChatId;}
        return Object.assign({},row,{payload:merged});
      });
    }));
  }

  function installTargetFix(){
    var target=window.BDLSyncTargetFirebase;
    if(!target||target.__cargaRootFixVersion===VERSION){return !!target;}
    if(installingTarget){return false;}
    installingTarget=true;
    try{
      if(typeof target.prepareEntries==="function"){
        var originalPrepare=target.prepareEntries.bind(target);
        target.prepareEntries=function(rows,options){
          return hydrateRowsForFirebase(rows,options).then(function(hydrated){return originalPrepare(hydrated,options||{});});
        };
      }
      if(typeof target.push==="function"){
        var originalPush=target.push.bind(target);
        target.push=function(rows,options){
          return hydrateRowsForFirebase(rows,options).then(function(hydrated){return originalPush(hydrated,options||{});});
        };
      }
      target.__cargaRootFixVersion=VERSION;
      return true;
    }finally{installingTarget=false;}
  }

  function installSaveFix(){
    var api=window.CargaSave;
    if(!api||typeof api.save!=="function"||api.__cargaRootFixVersion===VERSION){return false;}
    originalCargaSave=api.save.bind(api);
    api.save=function(normalized,validation,options){
      options=options||{};
      return Promise.resolve(originalCargaSave(normalized,validation,options)).then(function(result){
        if(!result||result.ok===false){return result;}
        var periodoId=canon(options.periodoId||options.periodoCanonicoId||result.periodoId||"");
        if(!periodoId){return result;}
        return ensureLocal().then(function(){return saveContacts(rowsFromNormalized(normalized),periodoId);}).then(function(info){
          result.contactosPersistidos=Number(info&&info.saved||0);
          return result;
        }).catch(function(error){
          result.contactosAdvertencia=error&&error.message?error.message:String(error);
          return result;
        });
      });
    };
    api.__cargaRootFixVersion=VERSION;
    return true;
  }

  function preflight(periodoId){
    periodoId=canon(periodoId||selectedPeriod());
    if(!periodoId){return Promise.reject(new Error("Seleccione un período antes de actualizar Firebase."));}
    if(preflightTask){return preflightTask;}
    preflightTask=ensureLocal().then(function(){
      return consolidateContacts(periodoId);
    }).then(function(contactInfo){
      return clearCargaOutbox(periodoId).then(function(queueInfo){
        return {ok:true,periodoId:periodoId,contacts:contactInfo,queue:queueInfo,version:VERSION};
      });
    }).finally(function(){preflightTask=null;});
    return preflightTask;
  }

  function showPreflightError(error){
    var status=document.getElementById("cargaFirebaseStatus");
    var message=document.getElementById("cargaFirebaseMessage");
    if(status){status.textContent="Error";status.setAttribute("data-status","is-danger");}
    if(message){message.textContent=error&&error.message?error.message:String(error);message.className="carga-firebase-message is-danger";}
  }

  /*
   * Interceptamos el clic en fase capture para ejecutar el saneamiento antes
   * del listener de carga.firebase-smart.js. Después llamamos la misma API
   * pública; no se crea otra conexión ni otro sincronizador.
   */
  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest?event.target.closest("#cargaBtnFirebaseActualizar"):null;
    if(!button||button.__cargaRootFixRunning){return;}
    event.preventDefault();
    event.stopImmediatePropagation();
    button.__cargaRootFixRunning=true;
    button.disabled=true;
    var oldText=button.textContent;
    button.textContent="Preparando Firebase...";
    preflight(selectedPeriod()).then(function(){
      installTargetFix();
      var api=window.CargaFirebaseSmart||window.CargaFirebaseSync;
      if(!api||typeof api.update!=="function"){throw new Error("El controlador inteligente de Firebase no está disponible.");}
      return api.update();
    }).catch(showPreflightError).finally(function(){
      button.__cargaRootFixRunning=false;
      if(button.textContent==="Preparando Firebase..."){button.textContent=oldText||"Actualizar Firebase";}
      if(window.CargaFirebaseSmart&&typeof window.CargaFirebaseSmart.status==="function"){
        var state=window.CargaFirebaseSmart.status();
        button.disabled=!!(state&&state.running)||!selectedPeriod();
      }else{button.disabled=!selectedPeriod();}
    });
  },true);

  installSaveFix();
  var attempts=0;
  var timer=window.setInterval(function(){
    attempts+=1;
    installSaveFix();
    installTargetFix();
    if(attempts>=1200){window.clearInterval(timer);}
  },50);

  window.CargaFirebaseRootFix={
    version:VERSION,
    preflight:preflight,
    consolidateContacts:consolidateContacts,
    clearCargaOutbox:clearCargaOutbox,
    hydrateRowsForFirebase:hydrateRowsForFirebase,
    installSaveFix:installSaveFix,
    installTargetFix:installTargetFix,
    status:function(){return {version:VERSION,saveFixed:!!(window.CargaSave&&window.CargaSave.__cargaRootFixVersion),targetFixed:!!(window.BDLSyncTargetFirebase&&window.BDLSyncTargetFirebase.__cargaRootFixVersion)};}
  };
})(window,document);

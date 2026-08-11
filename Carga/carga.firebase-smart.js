/* =========================================================
Nombre completo: carga.firebase-smart.js
Ruta: /Carga/carga.firebase-smart.js
Función:
- Actualizar Firebase directamente desde el archivo analizado en Carga.
- Mantener Firebase y BDLocal como procesos independientes.
- Comparar el roster del archivo con Firebase antes de escribir.
- Alertar y pedir confirmación si los estudiantes nuevos superan el 10% del roster remoto del período.
- Marcar como retirados/eliminados lógicamente los estudiantes que ya no aparecen en el archivo.
- Escribir Estudiante, matriculas, requisitos, periodos, carreras, importaciones e historial.
- No usar la cola cambios_pendientes ni el límite histórico de 25 cambios.
- Verificar al final que matriculas y requisitos coincidan 1:1 con el archivo actual.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="3.0.0-direct-file-authority";
  var NEW_STUDENT_ALERT_PERCENT=10;
  var REPOSITORY_CHUNK_LIMIT=400;
  var READ_CONCURRENCY=16;
  var running=false;
  var architectureTask=null;
  var currentScript=document.currentScript;
  var scriptBase=currentScript&&currentScript.src?currentScript.src:window.location.href;

  function byId(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function now(){return new Date().toISOString();}
  function canon(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function normalizeKey(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[^a-z0-9]+/g,"");
  }
  function normalizeCedula(value){
    var helper=window.RequisitosFirebaseIdentity;
    if(helper&&typeof helper.normalizeCedula==="function"){
      try{return text(helper.normalizeCedula(value));}catch(error){}
    }
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }
  function first(row,names){
    row=row||{};
    for(var i=0;i<(names||[]).length;i+=1){
      if(row[names[i]]!==undefined&&row[names[i]]!==null&&text(row[names[i]])!==""){
        return row[names[i]];
      }
    }
    return "";
  }
  function cedulaOf(row){
    return normalizeCedula(first(row,[
      "cedula","numeroIdentificacion","NumeroIdentificacion","identificacion",
      "Identificacion","Cedula","Cédula","_cedula"
    ]));
  }
  function periodId(){return canon(byId("cargaPeriodoSelect")&&byId("cargaPeriodoSelect").value||"");}
  function periodLabel(){
    var select=byId("cargaPeriodoSelect");
    if(!select||select.selectedIndex<0){return periodId();}
    return text(select.options[select.selectedIndex]&&select.options[select.selectedIndex].text)||periodId();
  }
  function currentState(){
    try{return window.CargaState&&typeof window.CargaState.get==="function"?window.CargaState.get():null;}
    catch(error){return null;}
  }
  function normalizedRows(){
    var state=currentState()||{};
    var normalized=state.normalized||{};
    var rows=Array.isArray(normalized.rowsMapeadas)?normalized.rowsMapeadas:
      Array.isArray(normalized.rows)?normalized.rows:
      Array.isArray(normalized.students)?normalized.students:[];
    return rows.filter(function(row){return !!cedulaOf(row);});
  }
  function analyzedPeriod(){
    var state=currentState()||{};
    var normalized=state.normalized||{};
    var detected=normalized.periodoDetectado||{};
    return canon(detected.periodoId||detected.periodoCanonicoId||"");
  }
  function currentFileName(){
    var state=currentState()||{};
    return text(state.fileName||state.normalized&&state.normalized.fileName||"archivo_carga");
  }
  function currentErrors(){
    var state=currentState()||{};
    return Array.isArray(state.errors)?state.errors:[];
  }
  function status(label,type){
    var node=byId("cargaFirebaseStatus");
    if(node){node.textContent=text(label);node.setAttribute("data-status",text(type||""));}
  }
  function message(value,type){
    var node=byId("cargaFirebaseMessage");
    if(node){node.textContent=text(value);node.className="carga-firebase-message "+text(type||"");}
  }
  function setRunning(value){
    running=!!value;
    var button=byId("cargaBtnFirebaseActualizar");
    if(button){
      button.disabled=running||!periodId()||!normalizedRows().length||currentErrors().length>0;
      button.textContent=running?"Actualizando Firebase...":"Actualizar Firebase";
    }
  }
  function syncUi(){
    if(running){return;}
    var rows=normalizedRows();
    if(!periodId()){
      status("Sin período","");
      message("Seleccione un período antes de actualizar Firebase.","");
    }else if(!rows.length){
      status("Sin archivo","");
      message("Analice un archivo para poder actualizar Firebase directamente desde esa carga.","");
    }else if(currentErrors().length){
      status("Archivo con errores","is-danger");
      message("Corrija los errores del archivo antes de actualizar Firebase.","is-danger");
    }else{
      status("Listo","is-ok");
      message("Firebase se actualizará directamente desde el archivo analizado. BDLocal no participa en este proceso.","");
    }
    setRunning(false);
  }

  function absolute(relative){try{return new URL(relative,scriptBase).href;}catch(error){return relative;}}
  function scriptExists(src){
    return Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src;});
  }
  function waitFor(test,label,timeoutMs){
    var started=Date.now();timeoutMs=Math.max(500,Number(timeoutMs||15000));
    return new Promise(function(resolve,reject){
      (function check(){
        var value=null;try{value=test();}catch(error){}
        if(value){resolve(value);return;}
        if(Date.now()-started>=timeoutMs){reject(new Error("No se pudo preparar "+label+"."));return;}
        window.setTimeout(check,50);
      })();
    });
  }
  function loadScript(src,test,label){
    var current=null;try{current=test&&test();}catch(error){}
    if(current){return Promise.resolve(current);}
    var absoluteSrc=/^https?:\/\//i.test(src)?src:absolute(src);
    if(scriptExists(absoluteSrc)){
      return test?waitFor(test,label||src,15000):Promise.resolve(absoluteSrc);
    }
    return new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=absoluteSrc;script.async=false;script.defer=false;
      script.onload=function(){
        if(test){waitFor(test,label||src,15000).then(resolve).catch(reject);}
        else{resolve(absoluteSrc);}
      };
      script.onerror=function(){reject(new Error("No se pudo cargar "+(label||src)+"."));};
      (document.head||document.documentElement).appendChild(script);
    });
  }
  function ensureArchitecture(){
    if(architectureTask){return architectureTask;}
    architectureTask=Promise.resolve()
      .then(function(){
        return loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js",function(){return window.firebase&&window.firebase.initializeApp?window.firebase:null;},"Firebase App SDK");
      })
      .then(function(){
        return loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js",function(){return window.firebase&&window.firebase.firestore?window.firebase.firestore:null;},"Firebase Firestore SDK");
      })
      .then(function(){
        return loadScript("../firebase-config.js",function(){return window.firebaseConfig||window.FIREBASE_CONFIG;},"la configuración Firebase");
      })
      .then(function(){
        if(window.firebase&&window.firebase.initializeApp&&(!window.firebase.apps||!window.firebase.apps.length)){
          window.firebase.initializeApp(window.firebaseConfig||window.FIREBASE_CONFIG||{});
        }
        return loadScript("../BDLocal/firebase/bdl.firebase.schema.v2.js",function(){return window.RequisitosFirebaseSchema;},"el esquema Firebase");
      })
      .then(function(){return loadScript("../BDLocal/firebase/bdl.firebase.identity.js",function(){return window.RequisitosFirebaseIdentity;},"la identidad Firebase");})
      .then(function(){return loadScript("../BDLocal/firebase/bdl.firebase.validator.v2.js",function(){return window.RequisitosFirebaseValidator;},"el validador Firebase");})
      .then(function(){return loadScript("../BDLocal/firebase/bdl.firebase.mapper.v2.js",function(){return window.RequisitosFirebaseMapper;},"el mapeador Firebase");})
      .then(function(){return loadScript("../BDLocal/firebase/bdl.firebase.repository.v2.js",function(){return window.RequisitosFirebaseRepository;},"el repositorio Firebase");})
      .then(function(){
        var repo=window.RequisitosFirebaseRepository;
        if(!repo||typeof repo.ensureFirestore!=="function"){throw new Error("El repositorio Firebase no quedó disponible.");}
        return repo.ensureFirestore();
      })
      .finally(function(){architectureTask=null;});
    return architectureTask;
  }

  function canonicalRequirementAliases(){
    return {
      academico:"Academico",
      documentacion:"Documentacion",
      financiero:"Financiero",
      titulacion:"Titulacion",
      practicasvinculacion:"PracticasVinculacion",
      practicayvinculacion:"PracticasVinculacion",
      practicasyvinculacion:"PracticasVinculacion",
      vinculacion:"Vinculacion",
      seguimientograduados:"SeguimientoGraduados",
      ingles:"Ingles",
      actualizaciondatos:"ActualizacionDatos",
      aprobaciontitulacion:"AprobacionTitulacion",
      aprobacioncomplexivoproyecto:"AprobacionComplexivoProyecto",
      aprobacioncomplexivo:"AprobacionComplexivoProyecto"
    };
  }
  function enrichRequirements(row){
    var out=Object.assign({},row||{}),aliases=canonicalRequirementAliases();
    Object.keys(row||{}).forEach(function(key){
      var canonical=aliases[normalizeKey(key)];
      if(canonical&&text(row[key])!==""){out[canonical]=row[key];}
    });
    return out;
  }
  function authoritativeRows(periodoId){
    var map=Object.create(null);
    normalizedRows().forEach(function(raw){
      var cedula=cedulaOf(raw);if(!cedula){return;}
      var row=enrichRequirements(raw);
      row=Object.assign({},row,{
        cedula:cedula,
        numeroIdentificacion:cedula,
        periodoId:periodoId,
        periodId:periodoId,
        periodoCanonicoId:periodoId,
        estadoMatricula:"ACTIVO",
        retirado:false,
        retiradoEn:"",
        eliminado:false,
        eliminadoEn:""
      });
      map[cedula]=row;
    });
    return Object.keys(map).sort().map(function(id){return map[id];});
  }

  function mapper(){return window.RequisitosFirebaseMapper;}
  function repository(){return window.RequisitosFirebaseRepository;}
  function identity(){return window.RequisitosFirebaseIdentity;}
  function hashDocument(entity,document){
    var current=mapper();
    var copy=Object.assign({},document||{});
    copy.updatedAt=text(copy.updatedAt)||now();
    copy.createdAt=text(copy.createdAt)||copy.updatedAt;
    copy.version=Math.max(1,Number(copy.version||1));
    copy.eliminado=copy.eliminado===true;
    copy.eliminadoEn=copy.eliminado?(text(copy.eliminadoEn)||copy.updatedAt):"";
    if(current&&typeof current.dataHash==="function"){
      var functional=typeof current.functionalContent==="function"?current.functionalContent(copy):copy;
      copy.dataHash=current.dataHash({entity:entity,data:functional});
    }
    return copy;
  }
  function buildDocuments(rows,periodoId){
    var current=mapper();
    if(!current){throw new Error("El mapeador Firebase no está disponible.");}
    var students=[],enrollments=[],requirements=[];
    var careers=Object.create(null);
    rows.forEach(function(row){
      var student=current.studentDocument(row);
      var enrollment=current.enrollmentDocument(row);
      var requirement=current.requirementsDocument(row,[]);
      if(!student||!enrollment||!requirement){
        throw new Error("No se pudieron formar todos los documentos Firebase para la cédula "+cedulaOf(row)+".");
      }
      students.push(student);enrollments.push(enrollment);requirements.push(requirement);
      var code=text(first(row,["codigoCarrera","CodigoCarrera","codigoCarreraActual","CódigoCarrera"]));
      var name=text(first(row,["nombreCarrera","NombreCarrera","nombreCarreraActual","Carrera","carrera"]));
      if(!code&&name){code=normalizeKey(name).toUpperCase();}
      if(code){
        careers[code]=hashDocument("carreras",{
          id:code,codigoCarrera:code,nombreCarrera:name||code,nombreCorto:name||code,activo:true
        });
      }
    });
    var period=hashDocument("periodos",{
      id:periodoId,periodoId:periodoId,label:periodLabel(),activo:true
    });
    return {
      estudiantes:students,
      matriculas:enrollments,
      requisitos:requirements,
      periodos:[period],
      carreras:Object.keys(careers).sort().map(function(code){return careers[code];})
    };
  }

  function fetchAll(entity,options){
    options=Object.assign({},options||{});
    var repo=repository();
    if(!repo||typeof repo.list!=="function"){return Promise.reject(new Error("El repositorio Firebase no permite consultar "+entity+"."));}
    var all=[],cursor={updatedAt:"",documentId:""},pages=0;
    function next(){
      pages+=1;
      if(pages>1000){throw new Error("La paginación de "+entity+" no pudo finalizar.");}
      return repo.list(entity,Object.assign({},options,{limit:1000,cursor:cursor,includeDeleted:true})).then(function(result){
        var docs=result&&result.documents||[];
        all=all.concat(docs);
        var nextCursor=result&&result.cursorAfter||cursor;
        var advanced=text(nextCursor.updatedAt)!==text(cursor.updatedAt)||text(nextCursor.documentId)!==text(cursor.documentId);
        cursor=nextCursor;
        if(result&&result.hasMore&&docs.length&&advanced){return next();}
        return all;
      });
    }
    return next();
  }
  function mapByDocumentId(items){
    var map=Object.create(null);
    (items||[]).forEach(function(item){if(item&&item.documentId){map[text(item.documentId)]=item;}});
    return map;
  }
  function activeEnrollment(item){
    var data=item&&item.data||{};
    var state=text(data.estadoMatricula).toUpperCase();
    return data.eliminado!==true&&data.retirado!==true&&state!=="RETIRADO"&&state!=="NO_APARECE_EN_ULTIMA_CARGA";
  }
  function activeRequirement(item){return !(item&&item.data&&item.data.eliminado===true);}
  function idSet(values){
    var map=Object.create(null);
    (values||[]).forEach(function(value){value=normalizeCedula(value);if(value){map[value]=true;}});
    return map;
  }
  function difference(a,b){return Object.keys(a).filter(function(key){return b[key]!==true;});}
  function remoteRoster(periodoId){
    return fetchAll("matriculas",{periodoId:periodoId}).then(function(items){
      var active=items.filter(activeEnrollment);
      return {
        all:items,
        active:active,
        activeIds:idSet(active.map(function(item){return item.data&&item.data.cedula;})),
        byId:mapByDocumentId(items)
      };
    });
  }
  function safetyCheck(rows,remote){
    var fileIds=idSet(rows.map(cedulaOf));
    var existing=remote&&remote.activeIds||Object.create(null);
    var existingCount=Object.keys(existing).length;
    var newIds=difference(fileIds,existing);
    var missingIds=difference(existing,fileIds);
    var percent=existingCount?newIds.length/existingCount*100:0;
    return {
      fileIds:fileIds,existingIds:existing,existingCount:existingCount,newIds:newIds,missingIds:missingIds,
      newPercent:Math.round(percent*100)/100,requiresConfirmation:existingCount>0&&percent>NEW_STUDENT_ALERT_PERCENT
    };
  }
  function confirmSafety(check,periodoId){
    if(!check.requiresConfirmation){return true;}
    var prompt="ALERTA DE SEGURIDAD\n\n"+
      "Período: "+periodLabel()+"\n"+
      "Actualmente en Firebase: "+check.existingCount+" estudiantes activos\n"+
      "Archivo nuevo: "+Object.keys(check.fileIds).length+" estudiantes\n"+
      "Estudiantes nuevos: "+check.newIds.length+" ("+check.newPercent+"%)\n\n"+
      "Los nuevos superan el "+NEW_STUDENT_ALERT_PERCENT+"% del roster existente. Esto puede indicar que seleccionó un período incorrecto.\n\n"+
      "¿Confirma que desea continuar con este período?";
    return window.confirm(prompt);
  }

  function mapLimit(values,limit,worker){
    values=Array.isArray(values)?values:[];limit=Math.max(1,Number(limit||1));
    var nextIndex=0,results=new Array(values.length);
    function runner(){
      function step(){
        var index=nextIndex++;if(index>=values.length){return Promise.resolve();}
        return Promise.resolve(worker(values[index],index)).then(function(result){results[index]=result;return step();});
      }
      return step();
    }
    var runners=[];for(var i=0;i<Math.min(limit,values.length);i+=1){runners.push(runner());}
    return Promise.all(runners).then(function(){return results;});
  }
  function getStudents(ids){
    var repo=repository(),map=Object.create(null);
    return mapLimit(ids,READ_CONCURRENCY,function(id){
      return repo.getById("estudiantes",id).then(function(item){if(item){map[id]=item;}return item;});
    }).then(function(){return map;});
  }
  function expectedFromRemote(item){
    var data=item&&item.data||null;
    if(!data){return {exists:false};}
    return {exists:true,hash:text(data.dataHash),version:Number(data.version||0),updatedAt:text(data.updatedAt)};
  }
  function sameHash(local,remoteItem){
    var remote=remoteItem&&remoteItem.data||null;
    return !!(remote&&text(remote.dataHash)&&text(local&&local.dataHash)&&text(remote.dataHash)===text(local.dataHash));
  }
  function writeEntity(entity,documents,remoteMap){
    documents=Array.isArray(documents)?documents:[];remoteMap=remoteMap||Object.create(null);
    var repo=repository();
    var entries=[];
    documents.forEach(function(document){
      var id=repo.documentId(entity,document);
      var remote=remoteMap[id]||null;
      if(sameHash(document,remote)){return;}
      entries.push({documentId:id,document:document,expected:expectedFromRemote(remote)});
    });
    if(!entries.length){return Promise.resolve({entity:entity,written:0,unchanged:documents.length,conflicts:0});}
    var written=0,unchanged=documents.length-entries.length,conflicts=0,index=0;
    function next(){
      var slice=entries.slice(index,index+REPOSITORY_CHUNK_LIMIT);index+=slice.length;
      if(!slice.length){return Promise.resolve({entity:entity,written:written,unchanged:unchanged,conflicts:conflicts});}
      return repo.writeManyChecked(entity,slice,{merge:false,allowUnbasedOverwrite:false}).then(function(result){
        written+=Number(result&&result.written||0);unchanged+=Number(result&&result.unchanged||0);conflicts+=Number(result&&result.conflicts&&result.conflicts.length||0);
        if(result&&result.conflicts&&result.conflicts.length){throw new Error("Se detectaron "+result.conflicts.length+" conflicto(s) en "+repo.collectionName(entity)+".");}
        return next();
      }).catch(function(error){
        throw new Error("Falló la colección "+repo.collectionName(entity)+": "+(error&&error.message?error.message:String(error)));
      });
    }
    return next();
  }

  function softDeleteMissing(periodoId,check,remoteEnrollment,remoteRequirements,allEnrollments,studentMap){
    var helper=identity(),stamp=now(),matriculas=[],requisitos=[],students=[];
    var otherActive=Object.create(null);
    (allEnrollments||[]).forEach(function(item){
      var data=item&&item.data||{};
      if(!activeEnrollment(item)){return;}
      var cedula=normalizeCedula(data.cedula);var period=canon(data.periodoId);
      if(cedula&&period&&period!==periodoId){otherActive[cedula]=true;}
    });
    (check.retireIds||check.missingIds||[]).forEach(function(cedula){
      var remoteId=helper.makeRemoteStudentPeriodId(periodoId,cedula);
      var enrollmentItem=remoteEnrollment[remoteId];
      if(enrollmentItem&&enrollmentItem.data){
        matriculas.push(hashDocument("matriculas",Object.assign({},enrollmentItem.data,{
          estadoMatricula:"RETIRADO",retirado:true,retiradoEn:stamp,eliminado:true,eliminadoEn:stamp,updatedAt:stamp
        })));
      }
      var requirementItem=remoteRequirements[remoteId];
      if(requirementItem&&requirementItem.data){
        requisitos.push(hashDocument("requisitos",Object.assign({},requirementItem.data,{
          eliminado:true,eliminadoEn:stamp,updatedAt:stamp
        })));
      }
      if(!otherActive[cedula]&&studentMap[cedula]&&studentMap[cedula].data){
        students.push(hashDocument("estudiantes",Object.assign({},studentMap[cedula].data,{
          eliminado:true,eliminadoEn:stamp,updatedAt:stamp
        })));
      }
    });
    return {estudiantes:students,matriculas:matriculas,requisitos:requisitos};
  }

  function makeAuxiliaryDocuments(periodoId,rows,check){
    var stamp=now();var token=String(Date.now());
    var importId="carga__"+periodoId+"__"+token;
    var historyId="carga_firebase__"+periodoId+"__"+token;
    var importDoc=hashDocument("importaciones",{
      id:importId,periodoId:periodoId,archivoNombre:currentFileName(),archivoTipo:"carga_estudiantes",
      totalFilas:rows.length,nuevos:check.newIds.length,actualizados:Math.max(0,rows.length-check.newIds.length),
      sinCambios:0,retirados:check.missingIds.length,errores:0,estado:"COMPLETADO",source:"Carga.firebase.direct",
      createdAt:stamp,updatedAt:stamp
    });
    var historyDoc=hashDocument("historial",{
      id:historyId,entidad:"carga",entidadId:periodoId,periodoId:periodoId,accion:"ACTUALIZAR_FIREBASE_DESDE_ARCHIVO",
      pantalla:"Carga",source:"Carga.firebase.direct",
      metadata:{archivo:currentFileName(),estudiantes:rows.length,nuevos:check.newIds.length,retirados:check.missingIds.length},
      createdAt:stamp,updatedAt:stamp
    });
    return {importaciones:[importDoc],historial:[historyDoc]};
  }

  function verifyRemote(periodoId,rows,careerCodes,importId,historyId){
    var expected=idSet(rows.map(cedulaOf));
    return Promise.all([
      fetchAll("matriculas",{periodoId:periodoId}),
      fetchAll("requisitos",{periodoId:periodoId}),
      getStudents(Object.keys(expected)),
      repository().getById("periodos",periodoId),
      mapLimit(careerCodes,READ_CONCURRENCY,function(code){return repository().getById("carreras",code);}),
      importId?repository().getById("importaciones",importId):Promise.resolve(null),
      historyId?repository().getById("historial",historyId):Promise.resolve(null)
    ]).then(function(values){
      var activeM=idSet((values[0]||[]).filter(activeEnrollment).map(function(item){return item.data&&item.data.cedula;}));
      var activeR=idSet((values[1]||[]).filter(activeRequirement).map(function(item){return item.data&&item.data.cedula;}));
      var students=Object.create(null);Object.keys(values[2]||{}).forEach(function(id){var item=values[2][id];if(item&&item.data&&item.data.eliminado!==true){students[id]=true;}});
      var missingStudents=difference(expected,students);
      var missingMatriculas=difference(expected,activeM);
      var missingRequisitos=difference(expected,activeR);
      var extraMatriculas=difference(activeM,expected);
      var extraRequisitos=difference(activeR,expected);
      var missingCareers=[];(values[4]||[]).forEach(function(item,index){if(!item||!item.data||item.data.eliminado===true){missingCareers.push(careerCodes[index]);}});
      var ok=!missingStudents.length&&!missingMatriculas.length&&!missingRequisitos.length&&!extraMatriculas.length&&!extraRequisitos.length&&
        !!(values[3]&&values[3].data)&&!missingCareers.length&&(!importId||!!(values[5]&&values[5].data))&&(!historyId||!!(values[6]&&values[6].data));
      return {
        ok:ok,expected:Object.keys(expected).length,
        estudiantes:Object.keys(students).length,matriculas:Object.keys(activeM).length,requisitos:Object.keys(activeR).length,
        missingStudents:missingStudents,missingMatriculas:missingMatriculas,missingRequisitos:missingRequisitos,
        extraMatriculas:extraMatriculas,extraRequisitos:extraRequisitos,missingCareers:missingCareers,
        periodo:!!(values[3]&&values[3].data),importacion:!importId||!!(values[5]&&values[5].data),historial:!historyId||!!(values[6]&&values[6].data)
      };
    });
  }

  function updateFirebase(){
    if(running){return Promise.resolve({ok:false,blocked:true,message:"Ya existe una actualización Firebase en curso."});}
    var periodoId=periodId();var rows=authoritativeRows(periodoId);var detected=analyzedPeriod();
    if(!periodoId){return Promise.resolve({ok:false,blocked:true,message:"Seleccione un período antes de actualizar Firebase."});}
    if(!rows.length){return Promise.resolve({ok:false,blocked:true,message:"Analice un archivo antes de actualizar Firebase."});}
    if(currentErrors().length){return Promise.resolve({ok:false,blocked:true,message:"El archivo contiene errores. Corríjalos antes de actualizar Firebase."});}
    if(detected&&detected!==periodoId){
      return Promise.resolve({ok:false,blocked:true,message:"El archivo fue analizado para "+detected+" y ahora está seleccionado "+periodoId+". Vuelva a analizar el archivo con el período correcto."});
    }

    setRunning(true);status("Preparando","is-warn");message("Preparando Firebase directamente desde el archivo analizado...","");
    var remoteCurrent=null,allEnrollments=null,requirementsCurrent=null,studentMap=null,documents=null,check=null,aux=null;
    var remoteMaps={};var totals={written:0,unchanged:0,conflicts:0};

    return ensureArchitecture()
      .then(function(){
        status("Comparando","is-warn");message("Comparando el archivo con Firebase para el período seleccionado...","");
        return Promise.all([
          remoteRoster(periodoId),
          fetchAll("requisitos",{periodoId:periodoId})
        ]);
      })
      .then(function(values){
        remoteCurrent=values[0];requirementsCurrent=values[1]||[];allEnrollments=[];
        check=safetyCheck(rows,remoteCurrent);
        var requirementActiveIds=idSet(requirementsCurrent.filter(activeRequirement).map(function(item){return item.data&&item.data.cedula;}));
        var extraRequirementIds=difference(requirementActiveIds,check.fileIds);
        check.retireIds=check.missingIds.concat(extraRequirementIds).filter(function(id,index,array){return array.indexOf(id)===index;});
        if(!confirmSafety(check,periodoId)){
          return {cancelled:true,result:{ok:false,blocked:true,cancelled:true,message:"Actualización cancelada por la alerta de seguridad del 10%."}};
        }
        status("Preparando datos","is-warn");
        message("Preparando "+rows.length+" estudiantes, matrículas y requisitos directamente desde el archivo...","");
        documents=buildDocuments(rows,periodoId);
        var studentIds=Object.keys(check.fileIds).concat(check.missingIds).filter(function(id,index,array){return array.indexOf(id)===index;});
        return getStudents(studentIds).then(function(map){
          studentMap=map;
          if(check.retireIds&&check.retireIds.length){
            return fetchAll("matriculas",{}).then(function(items){allEnrollments=items||[];return {cancelled:false};});
          }
          allEnrollments=[];return {cancelled:false};
        });
      })
      .then(function(stage){
        if(stage&&stage.cancelled){return stage;}
        var reqMap=mapByDocumentId(requirementsCurrent);
        remoteMaps.estudiantes=studentMap||Object.create(null);
        remoteMaps.matriculas=remoteCurrent&&remoteCurrent.byId||Object.create(null);
        remoteMaps.requisitos=reqMap;
        var retired=softDeleteMissing(periodoId,check,remoteMaps.matriculas,remoteMaps.requisitos,allEnrollments,remoteMaps.estudiantes);
        documents.estudiantes=documents.estudiantes.concat(retired.estudiantes);
        documents.matriculas=documents.matriculas.concat(retired.matriculas);
        documents.requisitos=documents.requisitos.concat(retired.requisitos);
        aux=makeAuxiliaryDocuments(periodoId,rows,check);
        documents.importaciones=aux.importaciones;
        documents.historial=aux.historial;
        var careerCodes=(documents.carreras||[]).map(function(doc){return text(doc.codigoCarrera);}).filter(Boolean);
        return Promise.all([
          repository().getById("periodos",periodoId),
          mapLimit(careerCodes,READ_CONCURRENCY,function(code){return repository().getById("carreras",code);})
        ]).then(function(values){
          remoteMaps.periodos=Object.create(null);if(values[0]){remoteMaps.periodos[periodoId]=values[0];}
          remoteMaps.carreras=Object.create(null);(values[1]||[]).forEach(function(item,index){if(item){remoteMaps.carreras[careerCodes[index]]=item;}});
          remoteMaps.importaciones=Object.create(null);remoteMaps.historial=Object.create(null);
          return {cancelled:false};
        });
      })
      .then(function(stage){
        if(stage&&stage.cancelled){return stage;}
        var order=["periodos","carreras","estudiantes","matriculas","requisitos","importaciones","historial"];
        var chain=Promise.resolve();
        order.forEach(function(entity){
          chain=chain.then(function(){
            status("Actualizando","is-warn");
            message("Actualizando colección "+repository().collectionName(entity)+"...","");
            return writeEntity(entity,documents[entity]||[],remoteMaps[entity]||Object.create(null)).then(function(result){
              totals.written+=Number(result.written||0);totals.unchanged+=Number(result.unchanged||0);totals.conflicts+=Number(result.conflicts||0);
            });
          });
        });
        return chain.then(function(){return {cancelled:false};});
      })
      .then(function(stage){
        if(stage&&stage.cancelled){return stage;}
        status("Verificando","is-warn");message("La escritura terminó. Verificando que Firebase esté completo...","");
        var careerCodes=(documents.carreras||[]).map(function(doc){return text(doc.codigoCarrera);}).filter(Boolean);
        var importId=documents.importaciones&&documents.importaciones[0]&&documents.importaciones[0].id;
        var historyId=documents.historial&&documents.historial[0]&&documents.historial[0].id;
        return verifyRemote(periodoId,rows,careerCodes,importId,historyId).then(function(verification){
          if(!verification.ok){
            var error=new Error("Firebase quedó incompleto. Esperados "+verification.expected+" estudiantes: Estudiante "+verification.estudiantes+", matrículas "+verification.matriculas+", requisitos "+verification.requisitos+".");
            error.verification=verification;throw error;
          }
          status("Completo","is-ok");
          message("Firebase verificado: "+verification.expected+" Estudiante, "+verification.expected+" matrículas y "+verification.expected+" requisitos. Escritos "+totals.written+" documento(s); "+totals.unchanged+" ya estaban iguales.","is-ok");
          return {ok:true,periodoId:periodoId,source:"archivo",students:rows.length,safety:check,verification:verification,totals:totals};
        });
      })
      .then(function(stage){return stage&&stage.result||stage;})
      .catch(function(error){
        status("Error","is-danger");message(error&&error.message?error.message:String(error),"is-danger");
        return {ok:false,message:error&&error.message?error.message:String(error),verification:error&&error.verification||null};
      })
      .finally(function(){setRunning(false);});
  }

  function ensureInlineUI(){
    var legacyTitle=byId("tituloCargaFirebase");
    var legacyCard=legacyTitle&&legacyTitle.closest?legacyTitle.closest("section"):null;
    if(legacyCard&&legacyCard.parentNode){legacyCard.parentNode.removeChild(legacyCard);}
    var actions=byId("cargaBtnGuardar");actions=actions&&actions.parentNode;
    if(!actions){return false;}
    var button=byId("cargaBtnFirebaseActualizar");
    if(!button){
      button=document.createElement("button");button.type="button";button.id="cargaBtnFirebaseActualizar";
      button.className="carga-btn carga-btn-primary";button.textContent="Actualizar Firebase";
      var clean=byId("cargaBtnLimpiar");actions.insertBefore(button,clean&&clean.parentNode===actions?clean:null);
    }
    var panel=actions.closest?actions.closest(".carga-file-panel"):actions.parentNode;
    if(panel&&!byId("cargaFirebaseInlineState")){
      var row=document.createElement("div");row.id="cargaFirebaseInlineState";
      row.innerHTML='<span>Firebase</span><strong id="cargaFirebaseStatus">Listo</strong>';panel.appendChild(row);
      var info=document.createElement("div");info.id="cargaFirebaseMessage";info.className="carga-firebase-message";
      info.textContent="Firebase se actualizará directamente desde el archivo analizado.";panel.appendChild(info);
    }
    return true;
  }
  function bind(){
    ensureInlineUI();
    var button=byId("cargaBtnFirebaseActualizar");var select=byId("cargaPeriodoSelect");
    if(button&&!button.__firebaseDirectBound){
      button.__firebaseDirectBound=true;button.addEventListener("click",function(event){event.preventDefault();updateFirebase();});
    }
    if(select&&!select.__firebaseDirectBound){select.__firebaseDirectBound=true;select.addEventListener("change",syncUi);}
    ["carga:processed","carga:saved"].forEach(function(name){window.addEventListener(name,syncUi);});
    syncUi();
  }

  var publicApi={
    version:VERSION,directFromFile:true,bdLocalIndependent:true,newStudentAlertPercent:NEW_STUDENT_ALERT_PERCENT,
    update:updateFirebase,analyze:updateFirebase,rebuild:updateFirebase,upload:updateFirebase,
    ensureArchitecture:ensureArchitecture,currentRows:function(){return authoritativeRows(periodId());},
    status:function(){return {version:VERSION,running:running,periodoId:periodId(),rows:normalizedRows().length,directFromFile:true,bdLocalIndependent:true};}
  };
  window.CargaFirebaseSmart=publicApi;
  window.CargaFirebaseSync=publicApi;

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind,{once:true});}else{bind();}
})(window,document);

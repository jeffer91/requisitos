/* =========================================================
Nombre completo: bdl.firebase.rebuild.js
Ruta: /BDLocal/firebase/bdl.firebase.rebuild.js
Función:
- Reconstruir la cola Firebase desde las tablas oficiales de IndexedDB.
- No depender del historial previo de cambios_pendientes.
- Separar Carga, Defensas y Ncomplex por propiedad funcional.
- Forzar únicamente el estado Firebase a PENDIENTE conservando Google y Supabase.
- Actualizar Telegram leyendo como máximo 25 estudiantes que realmente lo necesitan.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-local-source-rebuild";
  var MAX_BATCH_SIZE=25;
  var running=false;

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function canonicalPeriodId(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function normalizeCedula(value){
    var rules=window.BDLRulesPersona;
    if(rules&&typeof rules.normalizeCedula==="function"){
      try{return text(rules.normalizeCedula(value));}catch(error){}
    }
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }
  function normalizeKey(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  }
  function registry(){return window.BDLRepositories||null;}
  function registered(names){
    var current=registry();
    if(!current||typeof current.get!=="function"){return null;}
    for(var index=0;index<names.length;index+=1){
      var found=current.get(names[index]);
      if(found){return found;}
    }
    return null;
  }
  function repo(names,globals){
    globals=globals||[];
    for(var index=0;index<globals.length;index+=1){
      if(window[globals[index]]){return window[globals[index]];}
    }
    return registered(names||[]);
  }
  function repos(){
    return {
      personas:repo(["personas","estudiantes"],["BDLRepoPersonas","BDLRepoEstudiantesV2"]),
      matriculas:repo(["matriculas","matriculas_periodo"],["BDLRepoMatriculas"]),
      requisitos:repo(["requisitos","requisitos_estudiante"],["BDLRepoRequisitos"]),
      notas:repo(["notas","notas_titulacion"],["BDLRepoNotas"]),
      evaluaciones:repo(["evaluaciones_titulacion","ncomplex"],["BDLRepoEvaluacionesTitulacion"]),
      periodos:repo(["periodos"],["BDLRepoPeriodos"]),
      importaciones:repo(["importaciones"],["BDLRepoImportaciones"]),
      cambios:repo(["cambios_pendientes","cambios"],["BDLRepoCambios"])
    };
  }
  function listResult(value){
    if(Array.isArray(value)){return value;}
    if(value&&Array.isArray(value.rows)){return value.rows;}
    if(value&&Array.isArray(value.items)){return value.items;}
    if(value&&Array.isArray(value.data)){return value.data;}
    return [];
  }
  function list(repository,options){
    if(!repository){return Promise.resolve([]);}
    try{
      if(typeof repository.list==="function"){
        return Promise.resolve(repository.list(options||{})).then(listResult).catch(function(){return [];});
      }
      if(typeof repository.getAll==="function"){
        return Promise.resolve(repository.getAll(options||{})).then(listResult).catch(function(){return [];});
      }
    }catch(error){}
    return Promise.resolve([]);
  }
  function rowPeriod(row){
    return canonicalPeriodId(row&&(row.periodoId||row.periodId||row.periodoCanonicoId||row.ultimoPeriodoId||row.idPeriodo)||"");
  }
  function rowCedula(row){
    return normalizeCedula(row&&(row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.identificacion)||"");
  }
  function samePeriod(row,periodoId){return rowPeriod(row)===canonicalPeriodId(periodoId);}
  function studentPeriodId(periodoId,cedula){
    periodoId=canonicalPeriodId(periodoId);cedula=normalizeCedula(cedula);
    return periodoId&&cedula?cedula+"__"+periodoId:"";
  }
  function sourceOf(row){
    return normalizeKey([
      row&&row.source,row&&row.origen,row&&row.pantalla,row&&row.scope,row&&row.tipo
    ].filter(Boolean).join(" "));
  }
  function hasField(row,names){
    row=row||{};
    return names.some(function(name){
      return Object.prototype.hasOwnProperty.call(row,name)&&row[name]!==null&&text(row[name])!=="";
    });
  }
  function hasDefenseData(row){
    return hasField(row,[
      "notaArticulo","Notart","Nart","notart","nart",
      "notaDefensa","Notdef","Ndef","notdef","ndef",
      "notaFinal","Notafinal","Nfinal","notafinal","nfinal"
    ]);
  }
  function hasTelegram(row){
    return hasField(row,["telegramUser","_telegramUser","telegramUsername","usuarioTelegram","telegram","Telegram"])&&
      hasField(row,["telegramChatId","_telegramChatId","chatIdTelegram","telegramChatID","TelegramChatId","chatId"]);
  }
  function active(row){return !!row&&row.eliminado!==true&&text(row.estadoRegistro).toUpperCase()!=="ELIMINADO";}
  function recordId(row,fallback){
    return text(row&&(row.id||row.importacionId||row.evaluacionId||row.notaId||row.idEstudiantePeriodo||row.studentId||row.codigoCarrera||row.CodigoCarrera||row.periodoId)||fallback);
  }
  function pendingChange(table,row,options){
    options=options||{};
    var periodoId=canonicalPeriodId(options.periodoId||rowPeriod(row));
    var cedula=normalizeCedula(options.cedula||rowCedula(row));
    var stamp=now();
    return {
      tabla:table,
      tipo:table,
      periodoId:periodoId,
      cedula:cedula,
      registroId:text(options.registroId||recordId(row,cedula||periodoId)),
      accion:"UPSERT",
      payload:clone(row||{}),
      prioridad:1,
      estadoSheets:"SINCRONIZADO",
      statusGoogle:"SINCRONIZADO",
      estadoSupabase:"SINCRONIZADO",
      statusSupabase:"SINCRONIZADO",
      estadoFirebase:"PENDIENTE",
      statusFirebase:"PENDIENTE",
      sincronizadoEnFirebase:"",
      ultimoErrorFirebase:"",
      nextRetryAtFirebase:"",
      bloqueadoFirebase:false,
      intentosFirebase:0,
      source:text(options.source),
      origen:text(options.source),
      pantalla:text(options.pantalla||options.source),
      manualOnly:true,
      firebaseRebuild:true,
      createdAt:stamp,
      updatedAt:stamp
    };
  }
  function unique(rows){
    var map=Object.create(null);
    (rows||[]).forEach(function(row){
      var key=[text(row.tabla),canonicalPeriodId(row.periodoId),text(row.registroId)].join("|");
      map[key]=row;
    });
    return Object.keys(map).map(function(key){return map[key];});
  }
  function periodRows(rows,periodoId){return (rows||[]).filter(function(row){return active(row)&&samePeriod(row,periodoId);});}
  function careerDocument(row){
    var code=text(row&&(row.codigoCarrera||row.CodigoCarrera||row.codigo||row.id));
    var name=text(row&&(row.nombreCarrera||row.NombreCarrera||row.Carrera||row.carrera||row.nombre));
    if(!code&&name){code=normalizeKey(name).toUpperCase();}
    return code?{
      id:code,codigoCarrera:code,nombreCarrera:name||code,
      nombreCorto:text(row&&(row.nombreCorto||row.NombreCorto)||name||code),
      activo:true,updatedAt:now()
    }:null;
  }
  function buildCarga(periodoId,current){
    return Promise.all([
      list(current.personas,{}),
      list(current.matriculas,{periodoId:periodoId,periodId:periodoId}),
      list(current.requisitos,{periodoId:periodoId,periodId:periodoId}),
      list(current.periodos,{}),
      list(current.importaciones,{periodoId:periodoId,periodId:periodoId})
    ]).then(function(values){
      var people=values[0].filter(active);
      var enrollments=periodRows(values[1],periodoId);
      var requirements=periodRows(values[2],periodoId);
      var periods=values[3].filter(function(row){return active(row)&&samePeriod(row,periodoId);});
      var imports=periodRows(values[4],periodoId).filter(function(row){return !/ncomplex|complexivo/.test(sourceOf(row));});
      var cedulas=Object.create(null);
      enrollments.concat(requirements).forEach(function(row){var id=rowCedula(row);if(id){cedulas[id]=true;}});
      people.forEach(function(row){var id=rowCedula(row);if(id&&samePeriod(row,periodoId)){cedulas[id]=true;}});

      var changes=[];
      people.forEach(function(row){
        var cedula=rowCedula(row);
        if(cedula&&cedulas[cedula]){
          changes.push(pendingChange("personas",row,{periodoId:periodoId,cedula:cedula,registroId:cedula,source:"carga",pantalla:"Carga"}));
        }
      });
      enrollments.forEach(function(row){
        var cedula=rowCedula(row),id=studentPeriodId(periodoId,cedula);
        if(id){changes.push(pendingChange("matriculas_periodo",row,{periodoId:periodoId,cedula:cedula,registroId:id,source:"carga",pantalla:"Carga"}));}
      });
      var requirementsByStudent=Object.create(null);
      requirements.forEach(function(row){
        var cedula=rowCedula(row),id=studentPeriodId(periodoId,cedula);
        if(id&&!requirementsByStudent[id]){requirementsByStudent[id]=row;}
      });
      Object.keys(requirementsByStudent).forEach(function(id){
        var row=requirementsByStudent[id],cedula=rowCedula(row);
        changes.push(pendingChange("requisitos_estudiante",row,{periodoId:periodoId,cedula:cedula,registroId:id,source:"carga",pantalla:"Carga"}));
      });
      if(!periods.length){periods=[{id:periodoId,periodoId:periodoId,label:periodoId,activo:true,updatedAt:now()}];}
      periods.forEach(function(row){
        var id=canonicalPeriodId(rowPeriod(row)||periodoId);
        changes.push(pendingChange("periodos",Object.assign({},row,{id:id,periodoId:id}),{periodoId:periodoId,registroId:id,source:"carga",pantalla:"Carga"}));
      });
      var careers=Object.create(null);
      enrollments.concat(people.filter(function(row){return !!cedulas[rowCedula(row)];})).forEach(function(row){
        var item=careerDocument(row);if(item){careers[item.codigoCarrera]=item;}
      });
      Object.keys(careers).forEach(function(code){
        changes.push(pendingChange("carreras",careers[code],{periodoId:periodoId,registroId:code,source:"carga",pantalla:"Carga"}));
      });
      imports.forEach(function(row){
        var id=recordId(row,"importacion__"+periodoId);
        changes.push(pendingChange("importaciones",row,{periodoId:periodoId,registroId:id,source:"carga",pantalla:"Carga"}));
      });
      return unique(changes);
    });
  }
  function buildDefensas(periodoId,current){
    return list(current.notas,{periodoId:periodoId,periodId:periodoId}).then(function(rows){
      return unique(periodRows(rows,periodoId).filter(hasDefenseData).map(function(row){
        var cedula=rowCedula(row),id=studentPeriodId(periodoId,cedula);
        return pendingChange("notas_titulacion",row,{periodoId:periodoId,cedula:cedula,registroId:id,source:"defart",pantalla:"Defensas"});
      }).filter(function(row){return !!row.registroId;}));
    });
  }
  function buildNcomplex(periodoId,current){
    return Promise.all([
      list(current.evaluaciones,{periodoId:periodoId,periodId:periodoId}),
      list(current.importaciones,{periodoId:periodoId,periodId:periodoId})
    ]).then(function(values){
      var changes=periodRows(values[0],periodoId).map(function(row){
        var cedula=rowCedula(row),id=studentPeriodId(periodoId,cedula);
        return pendingChange("evaluaciones_titulacion",row,{periodoId:periodoId,cedula:cedula,registroId:id,source:"ncomplex",pantalla:"Ncomplex"});
      }).filter(function(row){return !!row.registroId;});
      periodRows(values[1],periodoId).filter(function(row){return /ncomplex|complexivo/.test(sourceOf(row));}).forEach(function(row){
        var id=recordId(row,"ncomplex_import__"+periodoId);
        changes.push(pendingChange("importaciones",row,{periodoId:periodoId,registroId:id,source:"ncomplex",pantalla:"Ncomplex"}));
      });
      return unique(changes);
    });
  }
  function build(scope,periodoId,current){
    if(scope==="carga"){return buildCarga(periodoId,current);}
    if(scope==="defensas"){return buildDefensas(periodoId,current);}
    if(scope==="ncomplex"){return buildNcomplex(periodoId,current);}
    return Promise.reject(new Error("Ámbito no soportado para reconstrucción: "+scope+"."));
  }
  function prepare(scopeName,options){
    options=Object.assign({},options||{});
    var scope=normalizeKey(scopeName);
    var periodoId=canonicalPeriodId(options.periodoId||options.periodId||"");
    if(!periodoId){return Promise.resolve({ok:false,scope:scope,message:"Seleccione un período antes de reconstruir Firebase."});}
    if(running){return Promise.resolve({ok:false,blocked:true,scope:scope,message:"Ya existe una reconstrucción local en curso."});}
    running=true;
    var current=repos();
    if(!current.cambios||typeof current.cambios.saveMany!=="function"){
      running=false;
      return Promise.resolve({ok:false,scope:scope,periodoId:periodoId,message:"No está disponible cambios_pendientes para preparar Firebase."});
    }
    return build(scope,periodoId,current).then(function(rows){
      if(!rows.length){
        return {ok:true,scope:scope,periodoId:periodoId,prepared:0,requeued:0,fromLocalTables:true,message:"No existen registros locales de este ámbito para el período seleccionado."};
      }
      return current.cambios.saveMany(rows,{
        source:"firebase_rebuild_from_local",
        replace:true,
        forceFirebasePending:true
      }).then(function(saved){
        var count=Array.isArray(saved)?saved.length:rows.length;
        var result={
          ok:true,scope:scope,periodoId:periodoId,
          prepared:count,requeued:count,generated:rows.length,
          fromLocalTables:true,replaceOutbox:true,
          message:"Se prepararon "+count+" cambio(s) desde las tablas locales oficiales.",
          finishedAt:now()
        };
        try{window.dispatchEvent(new CustomEvent("requisitos:firebase-rebuild-prepared",{detail:clone(result)}));}catch(error){}
        return result;
      });
    }).catch(function(error){
      return {ok:false,scope:scope,periodoId:periodoId,message:error&&error.message?error.message:String(error),at:now()};
    }).finally(function(){running=false;});
  }
  function telegramPatch(existing,remote){
    var center=window.RequisitosFirebaseOperationCenter;
    if(center&&typeof center.telegramPatch==="function"){
      return center.telegramPatch(existing,remote);
    }
    var row=Object.assign({},existing||{});
    var user=text(remote&&(remote.telegramUser||remote._telegramUser||remote.telegramUsername||remote.usuarioTelegram||remote.telegram)).replace(/^@+/,"");
    var chatId=text(remote&&(remote.telegramChatId||remote._telegramChatId||remote.chatIdTelegram||remote.chatId));
    var changed=text(row.telegramUser)!==user||text(row.telegramChatId)!==chatId;
    row.telegramUser=user;row._telegramUser=user;row.telegramChatId=chatId;row._telegramChatId=chatId;
    row.telegramUpdatedAt=text(remote&&remote.updatedAt)||now();row.telegramSource="firebase:estudiantes";
    return {changed:changed,row:row};
  }
  function refreshTelegram(options){
    options=Object.assign({},options||{});
    var periodoId=canonicalPeriodId(options.periodoId||options.periodId||"");
    var limit=Math.max(1,Math.min(MAX_BATCH_SIZE,Number(options.limit||MAX_BATCH_SIZE)));
    if(!periodoId){return Promise.resolve({ok:false,message:"Seleccione un período antes de actualizar Telegram."});}
    if(running){return Promise.resolve({ok:false,blocked:true,message:"Ya existe una operación local en curso."});}
    running=true;
    var current=repos();
    var remote=window.RequisitosFirebaseRepository||null;
    if(!current.personas||typeof current.personas.save!=="function"||!remote||typeof remote.getById!=="function"){
      running=false;
      return Promise.resolve({ok:false,message:"No están disponibles los repositorios necesarios para Telegram."});
    }
    return Promise.all([
      list(current.personas,{}),
      list(current.matriculas,{periodoId:periodoId,periodId:periodoId})
    ]).then(function(values){
      var enrolled=Object.create(null);
      periodRows(values[1],periodoId).forEach(function(row){var id=rowCedula(row);if(id){enrolled[id]=true;}});
      var candidates=values[0].filter(function(row){
        var id=rowCedula(row);
        return active(row)&&id&&enrolled[id]&&!hasTelegram(row);
      }).slice(0,limit);
      var totals={requested:candidates.length,downloaded:0,written:0,unchanged:0,skipped:0};
      var chain=Promise.resolve();
      candidates.forEach(function(person){
        chain=chain.then(function(){
          var cedula=rowCedula(person);
          return remote.getById("estudiantes",cedula).then(function(item){
            if(!item||!item.data||item.data.eliminado===true){totals.skipped+=1;return;}
            totals.downloaded+=1;
            var patch=telegramPatch(person,item.data);
            if(!patch.changed){totals.unchanged+=1;return;}
            return current.personas.save(patch.row).then(function(){totals.written+=1;});
          }).catch(function(){totals.skipped+=1;});
        });
      });
      return chain.then(function(){
        return {
          ok:true,scope:"telegram",periodoId:periodoId,telegramOnly:true,
          requested:totals.requested,downloaded:totals.downloaded,written:totals.written,
          unchanged:totals.unchanged,skipped:totals.skipped,
          limit:limit,maxBatchSize:MAX_BATCH_SIZE,collection:"estudiantes",
          missingOnly:true,finishedAt:now()
        };
      });
    }).catch(function(error){
      return {ok:false,scope:"telegram",periodoId:periodoId,message:error&&error.message?error.message:String(error)};
    }).finally(function(){running=false;});
  }
  function install(){
    var center=window.RequisitosFirebaseOperationCenter;
    if(!center){return false;}
    if(center.__localSourceRebuildInstalled){return true;}
    center.__legacyRequeue=center.requeue;
    center.__legacyRefreshTelegram=center.refreshTelegram;
    center.requeue=function(scope,options){return prepare(scope,options);};
    center.refreshTelegram=function(options){return refreshTelegram(options);};
    center.__localSourceRebuildInstalled=true;
    center.rebuildVersion=VERSION;
    return true;
  }
  function status(){return {version:VERSION,running:running,maxBatchSize:MAX_BATCH_SIZE,installed:!!(window.RequisitosFirebaseOperationCenter&&window.RequisitosFirebaseOperationCenter.__localSourceRebuildInstalled)};}

  window.RequisitosFirebaseRebuild={
    version:VERSION,maxBatchSize:MAX_BATCH_SIZE,
    prepare:prepare,refreshTelegram:refreshTelegram,install:install,status:status,
    _build:build,_repos:repos,_pendingChange:pendingChange
  };
  install();
})(window);

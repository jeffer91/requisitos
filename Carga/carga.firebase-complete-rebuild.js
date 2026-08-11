/* =========================================================
Nombre completo: carga.firebase-complete-rebuild.js
Ruta: /Carga/carga.firebase-complete-rebuild.js
Función:
- Preparar Firebase desde el roster ACTIVO del período seleccionado.
- Evitar que estudiantes RETIRADOS o de cargas antiguas vuelvan a Firebase.
- Generar siempre Estudiante, matrícula y requisitos para cada estudiante activo.
- Reutilizar los repositorios, la cola y el Centro de Operaciones existentes.
- No crear conexiones Firebase paralelas.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-active-roster-complete";
  var installedCenters=[];
  var lastResult=null;

  function text(value){return String(value==null?"":value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function canon(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function normalizeCedula(value){
    var rules=window.BDLRulesPersona||{};
    if(typeof rules.normalizeCedula==="function"){
      try{return text(rules.normalizeCedula(value));}catch(error){}
    }
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }
  function normalizeKey(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  }
  function first(row,names){
    row=row||{};names=Array.isArray(names)?names:[];
    for(var index=0;index<names.length;index+=1){
      var value=row[names[index]];
      if(value!==undefined&&value!==null&&text(value)!==""){return value;}
    }
    return "";
  }
  function cedulaOf(row){
    row=row||{};
    return normalizeCedula(first(row,[
      "cedula","numeroIdentificacion","NumeroIdentificacion","identificacion",
      "Cedula","Cédula","_cedula"
    ]));
  }
  function periodOf(row,fallback){
    row=row||{};
    return canon(first(row,[
      "periodoId","periodId","periodoCanonicoId","ultimoPeriodoId","idPeriodo","_periodoId"
    ])||fallback||"");
  }
  function active(row){
    row=row||{};
    var state=text(first(row,["estadoMatricula","EstadoMatricula","_estadoMatricula"])).toUpperCase();
    return row.eliminado!==true&&row.retirado!==true&&state!=="RETIRADO"&&text(row.estadoRegistro).toUpperCase()!=="ELIMINADO";
  }
  function useful(value){
    return value!==undefined&&value!==null&&
      (typeof value==="boolean"||typeof value==="number"||text(value)!=="");
  }
  function mergeFilled(){
    var out={};
    Array.prototype.slice.call(arguments).forEach(function(source){
      Object.keys(source||{}).forEach(function(key){
        var value=source[key];
        if(useful(value)||out[key]===undefined){out[key]=clone(value);}
      });
    });
    return out;
  }
  function timeOf(row){
    var parsed=Date.parse(text(row&&(row.updatedAt||row.fechaRegistro||row.createdAt)));
    return Number.isFinite(parsed)?parsed:0;
  }
  function better(current,candidate){
    if(!current){return candidate;}
    if(!candidate){return current;}
    var left=timeOf(current),right=timeOf(candidate);
    if(right!==left){return right>left?candidate:current;}
    function score(row){
      return Object.keys(row||{}).reduce(function(total,key){return total+(useful(row[key])?1:0);},0);
    }
    return score(candidate)>=score(current)?candidate:current;
  }
  function list(repository,options){
    if(!repository){return Promise.resolve([]);}
    try{
      if(typeof repository.list==="function"){
        return Promise.resolve(repository.list(options||{})).then(function(value){
          if(Array.isArray(value)){return value;}
          if(value&&Array.isArray(value.rows)){return value.rows;}
          if(value&&Array.isArray(value.items)){return value.items;}
          return [];
        }).catch(function(){return [];});
      }
      if(typeof repository.getAll==="function"){
        return Promise.resolve(repository.getAll(options||{})).then(function(value){return Array.isArray(value)?value:[];}).catch(function(){return [];});
      }
    }catch(error){}
    return Promise.resolve([]);
  }
  function registry(){return window.BDLRepositories||null;}
  function registered(name){
    var current=registry();
    return current&&typeof current.get==="function"?current.get(name):null;
  }
  function repos(){
    return {
      estudiantes:window.BDLRepoEstudiantesV2||registered("estudiantes"),
      personas:window.BDLRepoPersonas||registered("personas"),
      contactos:window.BDLRepoContactos||registered("contactos_estudiante")||registered("contactos"),
      matriculas:window.BDLRepoMatriculas||registered("matriculas_periodo")||registered("matriculas"),
      requisitos:window.BDLRepoRequisitos||registered("requisitos_estudiante")||registered("requisitos"),
      periodos:window.BDLRepoPeriodos||registered("periodos"),
      importaciones:window.BDLRepoImportaciones||registered("importaciones"),
      logs:window.BDLRepoLogs||registered("logs"),
      cambios:window.BDLRepoCambios||registered("cambios_pendientes")||registered("cambios")
    };
  }
  function groupByCedula(rows,periodoId,onlyActive){
    var map=Object.create(null);
    (rows||[]).forEach(function(row){
      if(periodoId&&periodOf(row,periodoId)!==periodoId){return;}
      if(onlyActive&&!active(row)){return;}
      var cedula=cedulaOf(row);
      if(!cedula){return;}
      map[cedula]=better(map[cedula],row);
    });
    return map;
  }
  function requirementsByCedula(rows,periodoId){
    var map=Object.create(null);
    (rows||[]).forEach(function(row){
      if(periodOf(row,periodoId)!==periodoId||row&&row.eliminado===true){return;}
      var cedula=cedulaOf(row);
      if(!cedula){return;}
      map[cedula]=map[cedula]||[];
      map[cedula].push(row);
    });
    return map;
  }
  function requirementPatch(rows){
    var patch={};
    (rows||[]).forEach(function(row){
      var key=text(first(row,["requisitoKey","requirementKey","key","campo","field","nombre","codigo"]));
      var value=first(row,["valor","value","estado","estadoKey","cumple","aprobado","resultado"]);
      if(key&&useful(value)){patch[key]=value;}
    });
    return patch;
  }
  function studentPeriodId(periodoId,cedula){return cedula&&periodoId?cedula+"__"+periodoId:"";}
  function careerDocument(row){
    row=row||{};
    var code=text(first(row,["codigoCarrera","CodigoCarrera","codigoCarreraActual","codigo","id"]));
    var name=text(first(row,["nombreCarrera","NombreCarrera","nombreCarreraActual","Carrera","carrera","nombre"]));
    if(!code&&name){code=normalizeKey(name).toUpperCase();}
    return code?{
      id:code,codigoCarrera:code,nombreCarrera:name||code,
      nombreCorto:name||code,activo:true,updatedAt:new Date().toISOString()
    }:null;
  }
  function pendingChange(table,row,options,sequence,baseTime){
    options=options||{};
    var periodoId=canon(options.periodoId||periodOf(row,""));
    var cedula=normalizeCedula(options.cedula||cedulaOf(row));
    var stamp=new Date(baseTime+Number(sequence||0)).toISOString();
    return {
      tabla:table,tipo:table,periodoId:periodoId,cedula:cedula,
      registroId:text(options.registroId||row&&row.id||cedula||periodoId),
      accion:"UPSERT",payload:clone(row||{}),prioridad:Number(options.prioridad||1),
      estadoSheets:"SINCRONIZADO",statusGoogle:"SINCRONIZADO",
      estadoSupabase:"SINCRONIZADO",statusSupabase:"SINCRONIZADO",
      estadoFirebase:"PENDIENTE",statusFirebase:"PENDIENTE",
      sincronizadoEnFirebase:"",ultimoErrorFirebase:"",nextRetryAtFirebase:"",
      bloqueadoFirebase:false,intentosFirebase:0,
      source:"carga_complete_rebuild",origen:"carga_complete_rebuild",pantalla:"Carga",
      manualOnly:true,firebaseRebuild:true,createdAt:stamp,updatedAt:stamp
    };
  }
  function clearQueue(periodoId){
    var fix=window.CargaFirebaseRootFix;
    if(fix&&typeof fix.clearCargaOutbox==="function"){
      return fix.clearCargaOutbox(periodoId);
    }
    return Promise.resolve({removed:0,total:0});
  }
  function historyChange(periodoId,rosterCount,sequence,baseTime){
    var id="carga_firebase__"+periodoId;
    var row={
      id:id,entidad:"carga",entidadId:periodoId,accion:"RECONSTRUIR_FIREBASE",
      periodoId:periodoId,pantalla:"Carga",source:"carga_complete_rebuild",
      detalle:"Reconstrucción desde roster activo de BDLocal",
      estudiantesActivos:Number(rosterCount||0),createdAt:new Date(baseTime).toISOString(),
      updatedAt:new Date(baseTime).toISOString()
    };
    return pendingChange("historial",row,{periodoId:periodoId,registroId:id,prioridad:90},sequence,baseTime);
  }

  function prepareCarga(options){
    options=Object.assign({},options||{});
    var periodoId=canon(options.periodoId||options.periodId||"");
    if(!periodoId){return Promise.resolve({ok:false,scope:"carga",message:"Seleccione un período antes de preparar Firebase."});}
    var current=repos();
    if(!current.cambios||typeof current.cambios.saveMany!=="function"){
      return Promise.resolve({ok:false,scope:"carga",periodoId:periodoId,message:"No está disponible cambios_pendientes."});
    }

    return Promise.all([
      list(current.estudiantes,{periodoId:periodoId,matricula:"ACTIVO"}),
      list(current.personas,{}),
      list(current.contactos,{periodoId:periodoId,periodId:periodoId}),
      list(current.matriculas,{periodoId:periodoId,periodId:periodoId}),
      list(current.requisitos,{periodoId:periodoId,periodId:periodoId}),
      list(current.periodos,{}),
      list(current.importaciones,{periodoId:periodoId,periodId:periodoId})
    ]).then(function(values){
      var legacyStudents=(values[0]||[]).filter(active).filter(function(row){return periodOf(row,periodoId)===periodoId;});
      var people=values[1]||[];
      var contacts=values[2]||[];
      var enrollments=(values[3]||[]).filter(function(row){return periodOf(row,periodoId)===periodoId;});
      var requirements=values[4]||[];
      var periods=(values[5]||[]).filter(function(row){return periodOf(row,periodoId)===periodoId&&row.eliminado!==true;});
      var imports=(values[6]||[]).filter(function(row){return periodOf(row,periodoId)===periodoId&&row.eliminado!==true;});

      var activeEnrollments=enrollments.filter(active);
      var rosterByCedula=groupByCedula(legacyStudents,periodoId,true);
      if(!Object.keys(rosterByCedula).length){
        rosterByCedula=groupByCedula(activeEnrollments,periodoId,true);
      }
      var roster=Object.keys(rosterByCedula).sort();
      if(!roster.length){
        return {ok:false,scope:"carga",periodoId:periodoId,message:"No existen estudiantes ACTIVO en BDLocal para este período."};
      }

      var peopleByCedula=groupByCedula(people,"",false);
      var contactsByCedula=groupByCedula(contacts,periodoId,false);
      var enrollmentByCedula=groupByCedula(activeEnrollments,periodoId,true);
      var reqByCedula=requirementsByCedula(requirements,periodoId);

      if(!periods.length){
        periods=[{id:periodoId,periodoId:periodoId,label:periodoId,activo:true,updatedAt:new Date().toISOString()}];
      }

      var baseTime=Date.now();
      var sequence=0;
      var changes=[];
      periods.forEach(function(period){
        var row=Object.assign({},period,{id:periodoId,periodoId:periodoId});
        changes.push(pendingChange("periodos",row,{periodoId:periodoId,registroId:periodoId,prioridad:1},sequence++,baseTime));
      });

      var careers=Object.create(null);
      roster.forEach(function(cedula){
        var row=mergeFilled(peopleByCedula[cedula],rosterByCedula[cedula],enrollmentByCedula[cedula]);
        var career=careerDocument(row);
        if(career){careers[career.codigoCarrera]=career;}
      });
      Object.keys(careers).sort().forEach(function(code){
        changes.push(pendingChange("carreras",careers[code],{periodoId:periodoId,registroId:code,prioridad:2},sequence++,baseTime));
      });

      roster.forEach(function(cedula){
        var student=rosterByCedula[cedula]||{};
        var person=peopleByCedula[cedula]||{};
        var contact=contactsByCedula[cedula]||{};
        var enrollment=enrollmentByCedula[cedula]||student;
        var reqRows=reqByCedula[cedula]||[];
        var reqValues=requirementPatch(reqRows);
        var identity={
          cedula:cedula,numeroIdentificacion:cedula,
          periodoId:periodoId,periodId:periodoId,periodoCanonicoId:periodoId,
          idEstudiantePeriodo:studentPeriodId(periodoId,cedula),
          studentId:studentPeriodId(periodoId,cedula),
          estadoMatricula:"ACTIVO",retirado:false
        };
        var complete=mergeFilled(person,student,enrollment,contact,reqValues,identity);
        var matricula=mergeFilled(student,enrollment,identity);
        var requisitos=mergeFilled(complete,reqValues,identity);

        changes.push(pendingChange("personas",complete,{
          periodoId:periodoId,cedula:cedula,registroId:cedula,prioridad:10
        },sequence++,baseTime));
        changes.push(pendingChange("matriculas_periodo",matricula,{
          periodoId:periodoId,cedula:cedula,registroId:identity.idEstudiantePeriodo,prioridad:11
        },sequence++,baseTime));
        /* Siempre se crea un documento agregado de requisitos por estudiante activo. */
        changes.push(pendingChange("requisitos_estudiante",requisitos,{
          periodoId:periodoId,cedula:cedula,registroId:identity.idEstudiantePeriodo,prioridad:12
        },sequence++,baseTime));
      });

      imports.forEach(function(row){
        var id=text(row.id||row.importacionId||("importacion__"+periodoId+"__"+sequence));
        changes.push(pendingChange("importaciones",row,{periodoId:periodoId,registroId:id,prioridad:80},sequence++,baseTime));
      });
      changes.push(historyChange(periodoId,roster.length,sequence++,baseTime));

      return clearQueue(periodoId).then(function(queueInfo){
        return current.cambios.saveMany(changes,{
          source:"carga_complete_rebuild",
          replace:true,
          forceFirebasePending:true
        }).then(function(saved){
          var result={
            ok:true,scope:"carga",periodoId:periodoId,
            rosterSource:legacyStudents.length?"estudiantes_activos":"matriculas_activas",
            estudiantesActivos:roster.length,
            periodos:periods.length,carreras:Object.keys(careers).length,
            matriculas:roster.length,requisitos:roster.length,
            importaciones:imports.length,historial:1,
            generated:changes.length,prepared:Array.isArray(saved)?saved.length:changes.length,
            requeued:Array.isArray(saved)?saved.length:changes.length,
            queueRemoved:Number(queueInfo&&queueInfo.removed||0),
            fromLocalTables:true,completeRoster:true,finishedAt:new Date().toISOString()
          };
          lastResult=clone(result);
          try{window.dispatchEvent(new CustomEvent("requisitos:firebase-complete-rebuild-prepared",{detail:clone(result)}));}catch(error){}
          return result;
        });
      });
    }).catch(function(error){
      var result={ok:false,scope:"carga",periodoId:periodoId,message:error&&error.message?error.message:String(error),at:new Date().toISOString()};
      lastResult=clone(result);
      return result;
    });
  }

  function installOnCenter(center){
    if(!center||installedCenters.indexOf(center)>=0){return !!center;}
    var assigned=typeof center.requeue==="function"?center.requeue:null;
    try{
      Object.defineProperty(center,"requeue",{
        configurable:true,enumerable:true,
        get:function(){
          return function(scope,options){
            if(normalizeKey(scope)==="carga"){return prepareCarga(options||{});}
            if(typeof assigned==="function"){return assigned.call(center,scope,options||{});}
            return Promise.resolve({ok:false,scope:normalizeKey(scope),message:"No existe reconstrucción para este ámbito."});
          };
        },
        set:function(fn){if(typeof fn==="function"){assigned=fn;}}
      });
      center.__cargaCompleteRebuildVersion=VERSION;
      installedCenters.push(center);
      return true;
    }catch(error){
      try{
        var original=assigned;
        center.requeue=function(scope,options){
          if(normalizeKey(scope)==="carga"){return prepareCarga(options||{});}
          return typeof original==="function"?original.call(center,scope,options||{}):Promise.resolve({ok:false});
        };
        center.__cargaCompleteRebuildVersion=VERSION;
        installedCenters.push(center);
        return true;
      }catch(inner){return false;}
    }
  }

  function installCenterTrap(){
    var existing=window.RequisitosFirebaseOperationCenter;
    if(existing){return installOnCenter(existing);}
    var stored=null;
    try{
      Object.defineProperty(window,"RequisitosFirebaseOperationCenter",{
        configurable:true,enumerable:true,
        get:function(){return stored;},
        set:function(value){stored=value;installOnCenter(value);}
      });
      return true;
    }catch(error){return false;}
  }

  window.CargaFirebaseCompleteRebuild={
    version:VERSION,
    prepare:prepareCarga,
    install:function(){return installCenterTrap()||installOnCenter(window.RequisitosFirebaseOperationCenter);},
    installOnCenter:installOnCenter,
    lastResult:function(){return clone(lastResult);},
    status:function(){return {version:VERSION,centerInstalled:!!(window.RequisitosFirebaseOperationCenter&&window.RequisitosFirebaseOperationCenter.__cargaCompleteRebuildVersion),lastResult:clone(lastResult)};}
  };

  installCenterTrap();
  window.setInterval(function(){
    if(window.RequisitosFirebaseOperationCenter){installOnCenter(window.RequisitosFirebaseOperationCenter);}
  },100);
})(window);

/* =========================================================
Archivo: cone.carga.ops.js
Ruta: /BDLocal/conexiones/cone.carga.ops.js
Función:
- Extender ConCarga con lecturas y escrituras usadas por /Carga/.
- Encerrar BL2Core, divisiones, importaciones y cola dentro del conector.
- Registrar cada carga de archivo para Firebase sin duplicar por archivo/período.
========================================================= */
(function(window){
  "use strict";
  var api=window.ConCarga||window.BDLocalCarga;
  if(!api){return;}
  var VERSION="1.1.0-import-audit";
  function text(v){return String(v==null?"":v).trim();}
  function core(){return window.BL2Core||null;}
  function service(){return window.BLDivisionesService||null;}
  function repositories(){return window.BDLRepositories||null;}
  function importRepo(){
    if(window.BDLRepoImportaciones){return window.BDLRepoImportaciones;}
    var registry=repositories();
    return registry&&typeof registry.get==="function"?registry.get("importaciones"):null;
  }
  function changesRepo(){
    if(window.BDLRepoCambios){return window.BDLRepoCambios;}
    var registry=repositories();
    return registry&&typeof registry.get==="function"?(registry.get("cambios_pendientes")||registry.get("cambios")):null;
  }
  function canon(v){
    var u=window.BDLocalConUtils;
    return u&&typeof u.canonicalPeriodId==="function"?u.canonicalPeriodId(v):text(v).replace(/_+/g,"__");
  }
  function idOf(row){return text(row&&(row.idEstudiantePeriodo||row.studentId||row.id||row._id));}
  function ready(){
    return Promise.resolve(typeof api.ready==="function"?api.ready():true).then(function(result){
      if(result&&result.ok===false){throw new Error(result.error||"ConCarga no está listo.");}
      if(!core()){throw new Error("BL2Core no está disponible dentro de cone.carga.");}
      return api;
    });
  }
  function students(options){
    options=Object.assign({matricula:""},options||{});
    options.periodoId=canon(options.periodoId||options.periodId||"");
    return ready().then(function(){
      if(typeof core().getStudents!=="function"){throw new Error("No se pueden consultar estudiantes.");}
      return core().getStudents(options);
    }).then(function(rows){return Array.isArray(rows)?rows:[];});
  }
  function updateStudent(id,changes,options){
    options=Object.assign({localOnly:true,sync:false},options||{});
    return ready().then(function(){
      if(typeof core().updateStudent!=="function"){throw new Error("No se puede actualizar el estudiante.");}
      return core().updateStudent(text(id),changes||{},options);
    });
  }
  function removeStudents(periodoId,options){
    periodoId=canon(periodoId);
    options=Object.assign({localOnly:true,sync:false},options||{});
    return ready().then(function(){
      if(typeof core().deleteStudentsByPeriod==="function"){
        return core().deleteStudentsByPeriod(periodoId,options);
      }
      if(typeof core().deleteStudent!=="function"){throw new Error("No se pueden borrar estudiantes.");}
      return students({periodoId:periodoId,matricula:""}).then(function(rows){
        var p=Promise.resolve();
        rows.forEach(function(row){
          p=p.then(function(){var id=idOf(row);return id?core().deleteStudent(id,options):null;});
        });
        return p.then(function(){return {ok:true,deleted:rows.length};});
      });
    }).then(function(result){
      return typeof api.refresh==="function"?Promise.resolve(api.refresh({periodoId:periodoId,force:true,changed:true})).then(function(){return result;}):result;
    });
  }
  function removePeriod(periodoId,options){
    periodoId=canon(periodoId);
    options=Object.assign({deleteStudents:true,deleteDivisions:true,localOnly:true,sync:false},options||{});
    return ready().then(function(){
      if(typeof core().deletePeriod!=="function"){throw new Error("No se puede borrar el período.");}
      return core().deletePeriod(periodoId,options);
    }).then(function(result){
      return typeof api.refresh==="function"?Promise.resolve(api.refresh({force:true,changed:true})).then(function(){return result;}):result;
    });
  }
  function career(row){
    row=row||{};
    var code=text(row.CodigoCarrera||row.codigoCarrera||"");
    var name=text(row.NombreCarrera||row.nombreCarrera||row.carrera||row.Carrera||code);
    var key=text(code||name).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
    return {id:key,codigo:code,nombre:name,total:0};
  }
  function careers(periodoId){
    var s=service();
    if(s&&typeof s.careersForPeriod==="function"){
      try{return Promise.resolve(s.careersForPeriod(canon(periodoId))||[]);}catch(error){}
    }
    return students({periodoId:periodoId,matricula:""}).then(function(rows){
      var map={};
      rows.forEach(function(row){var c=career(row);if(!c.id){return;}if(!map[c.id]){map[c.id]=c;}map[c.id].total+=1;});
      return Object.keys(map).map(function(k){return map[k];});
    });
  }
  function divisions(periodoId){
    var s=service();
    if(s&&typeof s.divisionsForPeriod==="function"){
      try{return Promise.resolve(s.divisionsForPeriod(canon(periodoId))||[]);}catch(error){}
    }
    return Promise.resolve([]);
  }
  function saveDivisions(period,divisionRows,careerRows){
    period=Object.assign({},period||{});
    var periodoId=canon(period.periodoId||period.id||"");
    period.id=periodoId;
    period.periodoId=periodoId;
    period.divisiones=Array.isArray(divisionRows)?divisionRows:[];
    period.carrerasDetectadas=Array.isArray(careerRows)?careerRows:[];
    var assigned={};
    period.divisiones.forEach(function(d){(d.carreras||[]).forEach(function(c){assigned[text(c.id||c.codigo||c.nombre)]=text(d.nombre||d.id);});});
    return ready().then(function(){return typeof core().savePeriod==="function"?core().savePeriod(period):period;})
      .then(function(){return students({periodoId:periodoId,matricula:""});})
      .then(function(rows){
        var p=Promise.resolve();var updated=0;
        rows.forEach(function(row){
          var c=career(row);var desired=text(assigned[c.id]||"");var current=text(row.division||row.Division||row._division||"");
          if(current===desired||!idOf(row)){return;}
          p=p.then(function(){return updateStudent(idOf(row),{division:desired,divisiones:desired?[desired]:[],updatedAt:new Date().toISOString()},{periodoId:periodoId,action:"division_period_career_update"}).then(function(){updated+=1;});});
        });
        return p.then(function(){return {ok:true,updated:updated,total:rows.length};});
      }).then(function(result){
        return typeof api.refresh==="function"?Promise.resolve(api.refresh({periodoId:periodoId,force:true,changed:true})).then(function(){return result;}):result;
      });
  }
  function waitImportRepository(timeoutMs){
    timeoutMs=Math.max(1000,Number(timeoutMs||8000));
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        var current=importRepo();
        if(current&&typeof current.save==="function"){resolve(current);return;}
        if(window.BDLOutboxBridge&&typeof window.BDLOutboxBridge.loadSharedArchitecture==="function"){
          window.BDLOutboxBridge.loadSharedArchitecture().catch(function(){});
        }
        if(Date.now()-started>=timeoutMs){reject(new Error("No se pudo preparar el repositorio de importaciones."));return;}
        window.setTimeout(check,60);
      })();
    });
  }
  function saveImport(row){
    row=Object.assign({},row||{});
    row.periodoId=canon(row.periodoId||row.periodId||"");
    row.archivoHash=text(row.archivoHash||row.rawTextHash||row.hash);
    row.archivoNombre=text(row.archivoNombre||row.fileName||row.archivo||"carga_estudiantes");
    row.source=text(row.source||"CARGA_ARCHIVO").toUpperCase();
    row.tipo=text(row.tipo||"ARCHIVO_ESTUDIANTES").toUpperCase();
    row.createdAt=text(row.createdAt)||new Date().toISOString();
    row.updatedAt=new Date().toISOString();
    if(!row.periodoId){return Promise.reject(new Error("La importación no tiene período."));}
    if(!row.archivoHash){return Promise.reject(new Error("La importación no tiene hash de archivo."));}
    row.id=text(row.id)||"importacion__"+row.archivoHash+"__"+row.periodoId;
    row.importacionId=row.id;

    return waitImportRepository().then(function(current){return current.save(row);}).then(function(saved){
      var changes=changesRepo();
      if(!changes||typeof changes.save!=="function"){throw new Error("No se pudo preparar la cola para la importación.");}
      return changes.save({
        tabla:"importaciones",
        periodoId:saved.periodoId,
        registroId:saved.id,
        accion:"UPSERT",
        payload:saved,
        estadoSheets:"SINCRONIZADO",
        statusGoogle:"SINCRONIZADO",
        estadoSupabase:"SINCRONIZADO",
        statusSupabase:"SINCRONIZADO",
        estadoFirebase:"PENDIENTE",
        statusFirebase:"PENDIENTE",
        createdAt:saved.createdAt,
        updatedAt:saved.updatedAt
      },{source:"cone.carga.saveImport"}).then(function(change){
        try{window.dispatchEvent(new CustomEvent("bdlocal:carga-import-registered",{detail:{importacion:saved,cambioId:change&&change.id||""}}));}catch(error){}
        return Object.assign({},saved,{cambioId:change&&change.id||""});
      });
    });
  }

  api.versionOps=VERSION;
  api.listStudents=students;api.getStudents=students;
  api.updateStudent=updateStudent;api.actualizarEstudiante=updateStudent;
  api.deleteStudentsByPeriod=removeStudents;api.deletePeriod=removePeriod;
  api.listCareers=careers;api.getCareers=careers;
  api.listDivisions=divisions;api.getDivisions=divisions;
  api.saveDivisions=saveDivisions;
  api.saveImport=saveImport;api.registrarImportacion=saveImport;
  api.read=function(options){
    options=options||{};
    return Promise.all([api.getPeriods(),students(options),api.getSummary(canon(options.periodoId||options.periodId||""))]).then(function(v){return {ok:true,source:"ConCarga",screen:"carga",data:{periods:v[0]||[],students:v[1]||[],summary:v[2]||{}}};});
  };
})(window);

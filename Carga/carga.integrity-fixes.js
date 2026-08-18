/* =========================================================
Nombre completo: carga.integrity-fixes.js
Ruta o ubicación: /Carga/carga.integrity-fixes.js
Función o funciones:
- Conservar el nombre existente cuando el archivo trae PENDIENTE.
- Mantener PENDIENTE cuando no existe ningún nombre disponible.
- Completar el borrado local de estudiantes y períodos aunque BL2Core no exponga métodos delete.
- Limpiar datos distribuidos, colas y cachés del período sin borrar personas globales.
- Recordar períodos eliminados para que los períodos base no reaparezcan en Carga al reiniciar.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-carga-integrity";
  var DELETED_PERIODS_KEY="carga.periodos.eliminados.v1";
  var patched=false;

  var STUDENT_PERIOD_STORES=[
    "estudiantes",
    "requisitos",
    "contactos",
    "notas",
    "cambios",
    "resumen",
    "sync_meta",
    "matriculas_periodo",
    "requisitos_estudiante",
    "notas_titulacion",
    "contactos_estudiante",
    "divisiones_estudiante",
    "importaciones",
    "cambios_pendientes",
    "sync_estado",
    "errores",
    "errores_validacion",
    "cache_views"
  ];

  var COMPLETE_PERIOD_EXTRA_STORES=[
    "periodos_carreras",
    "periodos_divisiones",
    "backups"
  ];

  function text(value){return String(value==null?"":value).trim();}
  function canon(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function db(){return window.BL2DB||null;}
  function core(){return window.BL2Core||null;}
  function connector(){return window.ConCarga||window.BDLocalCarga||null;}
  function normalizeCedula(value){
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }
  function key(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  }
  function firstValue(row,aliases){
    row=row||{};var wanted=(aliases||[]).map(key),keys=Object.keys(row);
    for(var i=0;i<keys.length;i+=1){if(wanted.indexOf(key(keys[i]))>=0){return row[keys[i]];}}
    return "";
  }
  function cedulaOf(row){return normalizeCedula(firstValue(row,["numeroIdentificacion","NumeroIdentificacion","identificacion","cedula","cédula","documento"]));}
  function nameOf(row){return text(firstValue(row,["Nombres","nombres","Nombre","nombre","Estudiante","estudiante","ApellidosNombres","apellidosNombres"]));}
  function withName(row,name){
    var copy=Object.assign({},row||{}),resolved=text(name)||"PENDIENTE";
    copy.nombres=resolved;
    copy.Nombres=resolved;
    return copy;
  }
  function isPendingName(value){
    value=text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
    return !value||value==="PENDIENTE";
  }
  function periodOf(row){return canon(row&&(row.periodoId||row.periodId||row.periodoCanonicoId||row.ultimoPeriodoId||""));}
  function primaryKey(store,row){
    row=row||{};
    if(store==="matriculas_periodo"||store==="notas_titulacion"){return text(row.idEstudiantePeriodo||row.id||row._id);}
    if(store==="periodos"){return text(row.id||row.periodoId);}
    if(store==="settings"){return text(row.key);}
    return text(row.id||row.idEstudiantePeriodo||row.key||row._id);
  }
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}

  function readDeletedPeriods(){
    try{
      var rows=JSON.parse(window.localStorage.getItem(DELETED_PERIODS_KEY)||"[]");
      return Array.isArray(rows)?rows.map(canon).filter(Boolean):[];
    }catch(error){return [];}
  }
  function writeDeletedPeriods(rows){
    rows=(Array.isArray(rows)?rows:[]).map(canon).filter(Boolean);
    var map=Object.create(null);rows.forEach(function(id){map[id]=true;});
    rows=Object.keys(map);
    try{window.localStorage.setItem(DELETED_PERIODS_KEY,JSON.stringify(rows));}catch(error){}
    return rows;
  }
  function markDeleted(periodoId){var rows=readDeletedPeriods();rows.push(canon(periodoId));writeDeletedPeriods(rows);}
  function unmarkDeleted(periodoId){var id=canon(periodoId);writeDeletedPeriods(readDeletedPeriods().filter(function(item){return item!==id;}));}

  function removeRowsFromStore(storeName,periodoId){
    var database=db();periodoId=canon(periodoId);
    if(!database||typeof database.getAll!=="function"||typeof database.remove!=="function"){return Promise.resolve(0);}
    return database.getAll(storeName).catch(function(){return [];}).then(function(rows){
      rows=(Array.isArray(rows)?rows:[]).filter(function(row){return periodOf(row)===periodoId;});
      var removed=0,chain=Promise.resolve();
      rows.forEach(function(row){
        var id=primaryKey(storeName,row);if(!id){return;}
        chain=chain.then(function(){return database.remove(storeName,id).then(function(){removed+=1;}).catch(function(){return false;});});
      });
      return chain.then(function(){return removed;});
    });
  }
  function purgeStores(stores,periodoId){
    var result={};var chain=Promise.resolve();
    (stores||[]).forEach(function(storeName){
      chain=chain.then(function(){return removeRowsFromStore(storeName,periodoId).then(function(total){result[storeName]=total;});});
    });
    return chain.then(function(){return result;});
  }
  function totalRemoved(result){return Object.keys(result||{}).reduce(function(total,name){return total+Number(result[name]||0);},0);}

  function refreshAfterDelete(periodoId){
    var api=connector();
    if(api&&typeof api.refresh==="function"){
      return Promise.resolve(api.refresh({periodoId:canon(periodoId),force:true,changed:true,allowEmpty:true,immediate:true})).catch(function(){return null;});
    }
    return Promise.resolve(null);
  }
  function resetPeriodMetadata(periodoId){
    var currentCore=core();periodoId=canon(periodoId);
    if(!currentCore||typeof currentCore.getPeriods!=="function"||typeof currentCore.savePeriod!=="function"){return Promise.resolve(null);}
    return Promise.resolve(currentCore.getPeriods()).then(function(periods){
      var period=(Array.isArray(periods)?periods:[]).filter(function(item){return canon(item&&(item.periodoId||item.id))===periodoId;})[0];
      if(!period){return null;}
      period=Object.assign({},period,{estudiantes:0,totalEstudiantes:0,carrerasDetectadas:[],updatedAt:new Date().toISOString()});
      return currentCore.savePeriod(period);
    }).catch(function(){return null;});
  }
  function clearActivePeriodIfNeeded(periodoId){
    periodoId=canon(periodoId);var database=db();
    try{
      if(canon(window.localStorage.getItem("carga.periodoSeleccionado")||"")===periodoId){
        window.localStorage.removeItem("carga.periodoSeleccionado");
        window.localStorage.removeItem("carga.periodoSeleccionadoLabel");
      }
    }catch(error){}
    if(!database||typeof database.getSetting!=="function"||typeof database.setSetting!=="function"){return Promise.resolve();}
    return database.getSetting("activePeriodId","").then(function(active){
      if(canon(active)!==periodoId){return null;}
      return database.setSetting("activePeriodId","").then(function(){return database.setSetting("activePeriodLabel","");});
    }).catch(function(){return null;});
  }

  function deleteStudentsByPeriod(periodoId){
    periodoId=canon(periodoId);
    if(!periodoId){return Promise.reject(new Error("Seleccione un período válido."));}
    return purgeStores(STUDENT_PERIOD_STORES,periodoId).then(function(counts){
      return resetPeriodMetadata(periodoId).then(function(){return refreshAfterDelete(periodoId);}).then(function(){
        var deleted=Number(counts.estudiantes||0)||Number(counts.matriculas_periodo||0)||0;
        emit("bl2:students-deleted",{ok:true,periodoId:periodoId,deleted:deleted,details:counts,source:"CargaIntegrityFixes"});
        return {ok:true,deleted:deleted,totalRemoved:totalRemoved(counts),details:counts,periodoId:periodoId};
      });
    });
  }

  function deletePeriod(periodoId){
    periodoId=canon(periodoId);
    if(!periodoId){return Promise.reject(new Error("Seleccione un período válido."));}
    markDeleted(periodoId);
    return purgeStores(STUDENT_PERIOD_STORES.concat(COMPLETE_PERIOD_EXTRA_STORES),periodoId).then(function(counts){
      var database=db();
      var removePeriod=database&&typeof database.remove==="function"?database.remove("periodos",periodoId).catch(function(){return false;}):Promise.resolve(false);
      return removePeriod.then(function(){return clearActivePeriodIfNeeded(periodoId);}).then(function(){return refreshAfterDelete(periodoId);}).then(function(){
        emit("bl2:period-deleted",{ok:true,periodoId:periodoId,details:counts,source:"CargaIntegrityFixes"});
        return {ok:true,deleted:Number(counts.estudiantes||0)||Number(counts.matriculas_periodo||0)||0,totalRemoved:totalRemoved(counts)+1,details:counts,periodoId:periodoId};
      });
    }).catch(function(error){
      unmarkDeleted(periodoId);
      throw error;
    });
  }

  function patchConnector(api){
    if(!api||api.__cargaIntegrityPatched){return api;}

    var originalSaveStudents=typeof api.saveStudents==="function"?api.saveStudents.bind(api):null;
    var originalSavePeriod=typeof api.savePeriod==="function"?api.savePeriod.bind(api):null;
    var originalGetPeriods=typeof api.getPeriods==="function"?api.getPeriods.bind(api):null;

    if(originalSaveStudents){
      api.saveStudents=function(rows,options){
        rows=Array.isArray(rows)?rows:[];options=options||{};
        var periodoId=canon(options.periodoCanonicoId||options.periodoId||options.id||"");
        var existingTask=typeof api.listStudents==="function"&&periodoId?api.listStudents({periodoId:periodoId,matricula:""}):Promise.resolve([]);
        return Promise.resolve(existingTask).catch(function(){return [];}).then(function(existing){
          var byCedula=Object.create(null);
          (Array.isArray(existing)?existing:[]).forEach(function(row){var id=cedulaOf(row);if(id){byCedula[id]=row;}});
          var prepared=rows.map(function(row){
            var current=nameOf(row);
            if(!isPendingName(current)){return row;}
            var previous=byCedula[cedulaOf(row)];
            var previousName=nameOf(previous);
            return withName(row,isPendingName(previousName)?"PENDIENTE":previousName);
          });
          return originalSaveStudents(prepared,options);
        });
      };
      api.guardarEstudiantes=function(rows,periodoInfo,options){return api.saveStudents(rows,Object.assign({},options||{},periodoInfo||{}));};
    }

    if(originalGetPeriods){
      api.getPeriods=function(){
        return Promise.resolve(originalGetPeriods()).then(function(rows){
          var deleted=readDeletedPeriods();
          if(!deleted.length){return rows;}
          var database=db();
          if(database&&typeof database.remove==="function"){
            deleted.forEach(function(id){database.remove("periodos",id).catch(function(){return false;});});
          }
          return (Array.isArray(rows)?rows:[]).filter(function(period){return deleted.indexOf(canon(period&&(period.periodoId||period.id)))<0;});
        });
      };
      api.listarPeriodos=api.getPeriods;
    }

    if(originalSavePeriod){
      api.savePeriod=function(period){
        var id=canon(period&&(period.periodoId||period.id||period.periodoCanonicoId));
        if(id){unmarkDeleted(id);}
        return originalSavePeriod(period);
      };
      api.guardarPeriodo=api.savePeriod;
    }

    api.deleteStudentsByPeriod=deleteStudentsByPeriod;
    api.borrarEstudiantesPeriodo=deleteStudentsByPeriod;
    api.deletePeriod=deletePeriod;
    api.borrarPeriodo=deletePeriod;
    api.__cargaIntegrityPatched=true;
    api.integrityFixVersion=VERSION;
    return api;
  }

  function patch(){
    if(patched){return Promise.resolve(connector());}
    var api=connector();
    if(!api){return Promise.reject(new Error("ConCarga no está disponible para aplicar las correcciones de integridad."));}
    patchConnector(api);patched=true;
    return Promise.resolve(api);
  }

  window.CargaIntegrityFixes={version:VERSION,patch:patch,deleteStudentsByPeriod:deleteStudentsByPeriod,deletePeriod:deletePeriod,readDeletedPeriods:readDeletedPeriods};
})(window);

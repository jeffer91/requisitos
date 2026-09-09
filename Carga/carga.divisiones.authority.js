/* =========================================================
Nombre completo: carga.divisiones.authority.js
Ruta o ubicación: /Carga/carga.divisiones.authority.js
Función o funciones:
- Hacer que ConCarga entregue una sola configuración de divisiones por período.
- Priorizar las divisiones persistidas oficialmente y usar cachés locales solo como compatibilidad.
- Migrar una sola vez divisiones históricas o locales cuando no existe configuración oficial.
- Evitar que Carga muestre 0 divisiones mientras otras pantallas todavía conocen la configuración.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.1.0-canonical-period-divisions";
  var LS_DIVISIONES="carga.periodos.divisiones";
  var LS_PERIODOS="carga.periodos.local";
  var patched=false;

  function text(value){return String(value==null?"":value).trim();}
  function canon(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function key(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").toLowerCase().replace(/[^a-z0-9]+/g,"");
  }
  function now(){return new Date().toISOString();}
  function connector(){return window.ConCarga||window.BDLocalCarga||null;}
  function safeParse(raw,fallback){try{var value=JSON.parse(raw||"");return value==null?fallback:value;}catch(error){return fallback;}}
  function storageGet(name,fallback){try{return safeParse(window.localStorage.getItem(name)||"",fallback);}catch(error){return fallback;}}
  function storageSet(name,value){try{window.localStorage.setItem(name,JSON.stringify(value));return true;}catch(error){return false;}}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}

  function periodIdOf(item){
    item=item||{};
    return canon(item.periodoCanonicoId||item.periodoId||item.periodId||item.ultimoPeriodoId||item.id||item.value||"");
  }
  function career(api,item){
    if(api&&typeof api.normalizeCareer==="function"){
      try{return api.normalizeCareer(item);}catch(error){}
    }
    item=item||{};
    if(typeof item==="string"){item={nombre:item};}
    var code=text(item.codigo||item.codigoCarrera||item.CodigoCarrera||item.codCarrera||"");
    var name=text(item.nombre||item.nombreCarrera||item.NombreCarrera||item.carrera||item.Carrera||item._carrera||item.label||code);
    var id=key(code||name);
    return id&&name?{id:id,codigo:code,nombre:name}:null;
  }
  function uniqueCareers(api,list){
    var map=Object.create(null);
    (Array.isArray(list)?list:[]).forEach(function(item){var current=career(api,item);if(current&&current.id){map[current.id]=Object.assign({},map[current.id]||{},current);}});
    return Object.keys(map).map(function(id){return map[id];}).sort(function(a,b){return a.nombre.localeCompare(b.nombre,"es",{sensitivity:"base"});});
  }
  function normalizeDivision(api,item){
    if(!item){return null;}
    if(typeof item==="string"){item={nombre:item};}
    var name=text(item.nombre||item.label||item.name||item.id||"");
    var id=key(item.id||name);
    if(!id||!name){return null;}
    return {id:id,nombre:name,carreras:uniqueCareers(api,item.carreras||item.careers||[]),createdAt:item.createdAt||now(),updatedAt:item.updatedAt||now()};
  }
  function sanitize(api,list,allowedCareers){
    if(api&&typeof api.sanitizeDivisions==="function"){
      try{return api.sanitizeDivisions(list||[],allowedCareers||[]);}catch(error){}
    }
    var allowed=Object.create(null),owner=Object.create(null);
    uniqueCareers(api,allowedCareers||[]).forEach(function(item){allowed[item.id]=item;});
    return (Array.isArray(list)?list:[]).map(function(item){
      var division=normalizeDivision(api,item);if(!division){return null;}
      var careers=[];
      (division.carreras||[]).forEach(function(value){var current=career(api,value);if(!current||!allowed[current.id]||owner[current.id]){return;}owner[current.id]=division.id;careers.push(allowed[current.id]);});
      division.carreras=uniqueCareers(api,careers);return division;
    }).filter(Boolean);
  }
  function divisionLabel(row){
    row=row||{};
    var value=text(row._division||row._bl2Division||row.division||row.Division||row["División"]||row.divisionActual||"");
    if(!value&&Array.isArray(row.divisiones)&&row.divisiones.length){value=text(row.divisiones[0]);}
    return value&&key(value)!=="sindivision"?value:"";
  }
  function legacyDivisions(api,rows,allowedCareers){
    var votes=Object.create(null),careerMap=Object.create(null);
    uniqueCareers(api,allowedCareers||[]).forEach(function(item){careerMap[item.id]=item;});
    (Array.isArray(rows)?rows:[]).forEach(function(row){
      var current=career(api,row),label=divisionLabel(row);
      if(!current||!careerMap[current.id]||!label){return;}
      var labelKey=key(label);if(!labelKey){return;}
      if(!votes[current.id]){votes[current.id]={};}
      if(!votes[current.id][labelKey]){votes[current.id][labelKey]={label:label,total:0};}
      votes[current.id][labelKey].total+=1;
    });
    var divisions=Object.create(null);
    Object.keys(votes).forEach(function(careerId){
      var options=Object.keys(votes[careerId]).map(function(id){return votes[careerId][id];});
      if(options.length!==1){return;}
      var winner=options[0],divisionId=key(winner.label);
      if(!divisionId){return;}
      if(!divisions[divisionId]){divisions[divisionId]={id:divisionId,nombre:winner.label,carreras:[],createdAt:now(),updatedAt:now()};}
      divisions[divisionId].carreras.push(careerMap[careerId]);
    });
    return Object.keys(divisions).map(function(id){var item=divisions[id];item.carreras=uniqueCareers(api,item.carreras);return item;}).sort(function(a,b){return a.nombre.localeCompare(b.nombre,"es",{sensitivity:"base"});});
  }
  function mergeConfiguredWithLegacy(api,configured,legacy,allowedCareers){
    var map=Object.create(null),order=[];
    (Array.isArray(configured)?configured:[]).forEach(function(item){
      var div=normalizeDivision(api,item);if(!div){return;}
      var id=key(div.nombre||div.id);if(!map[id]){map[id]=div;order.push(id);}
      else{map[id].carreras=uniqueCareers(api,[].concat(map[id].carreras||[],div.carreras||[]));}
    });
    (Array.isArray(legacy)?legacy:[]).forEach(function(item){
      var div=normalizeDivision(api,item);if(!div){return;}
      var id=key(div.nombre||div.id);
      if(!map[id]){map[id]=div;order.push(id);}
      else if(!(map[id].carreras||[]).length){map[id].carreras=div.carreras||[];}
    });
    return sanitize(api,order.map(function(id){return map[id];}),allowedCareers||[]);
  }
  function hasCareerAssignments(divisions){
    return (Array.isArray(divisions)?divisions:[]).some(function(item){return item&&Array.isArray(item.carreras)&&item.carreras.length>0;});
  }
  function localConfigured(periodoId){
    periodoId=canon(periodoId);
    var store=storageGet(LS_DIVISIONES,{})||{};
    var record=store[periodoId];
    var fromStore=Array.isArray(record)?record:record&&Array.isArray(record.divisiones)?record.divisiones:[];
    if(fromStore.length){return fromStore;}
    var periods=storageGet(LS_PERIODOS,[])||[];
    var period=(Array.isArray(periods)?periods:[]).filter(function(item){return periodIdOf(item)===periodoId;})[0];
    return period&&Array.isArray(period.divisiones)?period.divisiones:[];
  }
  function cacheLocal(period,divisions,careers){
    if(!period){return;}
    var periodoId=periodIdOf(period);if(!periodoId){return;}
    var store=storageGet(LS_DIVISIONES,{})||{};
    store[periodoId]={periodoId:periodoId,divisiones:divisions||[],updatedAt:now()};
    storageSet(LS_DIVISIONES,store);
    var periods=storageGet(LS_PERIODOS,[])||[],found=false;
    periods=(Array.isArray(periods)?periods:[]).map(function(item){
      if(periodIdOf(item)!==periodoId){return item;}
      found=true;return Object.assign({},item,period,{id:periodoId,periodoId:periodoId,periodoCanonicoId:periodoId,divisiones:divisions||[],carrerasDetectadas:careers||[],updatedAt:now()});
    });
    if(!found){periods.push(Object.assign({},period,{id:periodoId,periodoId:periodoId,periodoCanonicoId:periodoId,divisiones:divisions||[],carrerasDetectadas:careers||[],updatedAt:now()}));}
    storageSet(LS_PERIODOS,periods);
  }
  function periodRecord(api,periodoId){
    periodoId=canon(periodoId);
    if(!api||typeof api.getPeriods!=="function"){return Promise.resolve({id:periodoId,periodoId:periodoId});}
    return Promise.resolve(api.getPeriods()).catch(function(){return [];}).then(function(periods){
      return (Array.isArray(periods)?periods:[]).filter(function(item){return periodIdOf(item)===periodoId;})[0]||{id:periodoId,periodoId:periodoId,periodoCanonicoId:periodoId};
    });
  }
  function persistMigration(api,originalSaveDivisions,period,divisions,careers,source){
    return Promise.resolve(originalSaveDivisions(period,divisions)).then(function(result){
      var saved=result&&result.period&&Array.isArray(result.period.divisiones)?result.period.divisiones:divisions;
      saved=sanitize(api,saved,careers);
      cacheLocal(result&&result.period||period,saved,careers);
      var detail={ok:true,periodoId:periodIdOf(result&&result.period||period),divisiones:saved.length,carreras:careers.length,migrated:true,source:source||"CargaDivisionAuthority",version:VERSION};
      emit("carga:divisions-migrated",detail);
      emit("carga:divisions-saved",detail);
      return saved;
    });
  }

  function patchApi(api){
    if(!api||api.__cargaDivisionAuthorityPatched){return api;}
    var originalListDivisions=typeof api.listDivisions==="function"?api.listDivisions.bind(api):null;
    var originalSaveDivisions=typeof api.saveDivisions==="function"?api.saveDivisions.bind(api):null;
    if(!originalListDivisions||!originalSaveDivisions){return api;}

    api.listDivisions=function(periodoId){
      periodoId=canon(periodoId);
      if(!periodoId){return Promise.resolve([]);}
      var rowsTask=typeof api.listStudents==="function"?api.listStudents({periodoId:periodoId,matricula:""}):Promise.resolve([]);
      return Promise.all([
        Promise.resolve(originalListDivisions(periodoId)).catch(function(){return [];}),
        Promise.resolve(rowsTask).catch(function(){return [];}),
        periodRecord(api,periodoId)
      ]).then(function(values){
        var official=Array.isArray(values[0])?values[0]:[];
        var rows=Array.isArray(values[1])?values[1]:[];
        var period=values[2]||{id:periodoId,periodoId:periodoId};
        var careers=uniqueCareers(api,rows);
        if(official.length){return sanitize(api,official,careers);}

        var legacy=legacyDivisions(api,rows,careers);
        var local=localConfigured(periodoId);
        var configured=mergeConfiguredWithLegacy(api,local,legacy,careers);
        if(configured.length){
          if(!rows.length||hasCareerAssignments(configured)){
            return persistMigration(api,originalSaveDivisions,period,configured,careers,"CargaDivisionAuthority.local-migration").catch(function(){return configured;});
          }
          return configured;
        }

        if(!legacy.length){return [];}
        return persistMigration(api,originalSaveDivisions,period,legacy,careers,"CargaDivisionAuthority.legacy-migration").catch(function(){return legacy;});
      });
    };
    api.getDivisions=api.listDivisions;

    api.saveDivisions=function(period,divisionRows){
      return Promise.resolve(originalSaveDivisions(period,divisionRows)).then(function(result){
        var savedPeriod=result&&result.period?result.period:period||{};
        var savedDivisions=result&&result.period&&Array.isArray(result.period.divisiones)?result.period.divisiones:Array.isArray(divisionRows)?divisionRows:[];
        var careers=result&&result.period&&Array.isArray(result.period.carrerasDetectadas)?result.period.carrerasDetectadas:[];
        cacheLocal(savedPeriod,savedDivisions,careers);
        try{if(window.BLDivisionesService&&typeof window.BLDivisionesService.invalidate==="function"){window.BLDivisionesService.invalidate();}}catch(error){}
        try{if(window.parent&&window.parent!==window&&window.parent.BLDivisionesService&&typeof window.parent.BLDivisionesService.invalidate==="function"){window.parent.BLDivisionesService.invalidate();}}catch(error2){}
        emit("carga:divisions-authority-updated",{ok:true,periodoId:periodIdOf(savedPeriod),divisiones:savedDivisions.length,source:"CargaDivisionAuthority",version:VERSION});
        return result;
      });
    };

    api.__cargaDivisionAuthorityPatched=true;
    api.divisionAuthorityVersion=VERSION;
    return api;
  }

  function install(){
    if(patched){return Promise.resolve(connector());}
    var api=connector();
    if(!api){return Promise.reject(new Error("ConCarga no está disponible para instalar la autoridad de divisiones."));}
    patchApi(api);patched=true;return Promise.resolve(api);
  }

  window.CargaDivisionAuthority={version:VERSION,install:install,patchApi:patchApi,legacyDivisions:legacyDivisions,mergeConfiguredWithLegacy:mergeConfiguredWithLegacy};
})(window);
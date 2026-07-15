/* =========================================================
Archivo: cone.carga.ops.js
Ruta: /BDLocal/conexiones/cone.carga.ops.js
Función:
- Extender ConCarga con lecturas y escrituras usadas por /Carga/.
- Encerrar BL2Core y BLDivisionesService dentro de conexiones.
========================================================= */
(function(window){
  "use strict";
  var api=window.ConCarga||window.BDLocalCarga;
  if(!api){return;}
  var VERSION="1.0.0-carga-ops";
  function text(v){return String(v==null?"":v).trim();}
  function core(){return window.BL2Core||null;}
  function service(){return window.BLDivisionesService||null;}
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
  api.versionOps=VERSION;
  api.listStudents=students;api.getStudents=students;
  api.updateStudent=updateStudent;api.actualizarEstudiante=updateStudent;
  api.deleteStudentsByPeriod=removeStudents;api.deletePeriod=removePeriod;
  api.listCareers=careers;api.getCareers=careers;
  api.listDivisions=divisions;api.getDivisions=divisions;
  api.saveDivisions=saveDivisions;
  api.read=function(options){
    options=options||{};
    return Promise.all([api.getPeriods(),students(options),api.getSummary(canon(options.periodoId||options.periodId||""))]).then(function(v){return {ok:true,source:"ConCarga",screen:"carga",data:{periods:v[0]||[],students:v[1]||[],summary:v[2]||{}}};});
  };
})(window);
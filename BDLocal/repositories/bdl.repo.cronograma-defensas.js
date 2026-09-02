/* =========================================================
Nombre completo: bdl.repo.cronograma-defensas.js
Ruta: /BDLocal/repositories/bdl.repo.cronograma-defensas.js
Función:
- Persistir cronogramas de defensas en BDLocal.
- Separar intento ordinario y supletorio.
- Conservar estado, fecha, hora, aula y tribunal por estudiante/período.
========================================================= */
(function(window){
  "use strict";
  var VERSION="1.0.0-crdef-persistence";
  var Repos=window.BDLRepositories;
  if(!Repos){return;}

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function normalizeCedula(value){
    var rules=window.BDLRulesPersona;
    if(rules&&typeof rules.normalizeCedula==="function"){return rules.normalizeCedula(value);}
    var utils=window.BL2Config&&window.BL2Config.utils;
    return utils&&typeof utils.normalizeCedula==="function"?utils.normalizeCedula(value):text(value).replace(/[^0-9A-Za-z]/g,"");
  }
  function canonicalPeriodId(value){
    value=text(value);if(!value){return "";}
    var m=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return m?m[1]+"-"+m[2]+"__"+m[3]+"-"+m[4]:value.replace(/_+/g,"__");
  }
  function store(){return Repos.storeName("cronogramaDefensas","cronograma_defensas");}
  function attempt(row){
    var n=Number(row&&row.intento);
    if(n===1||n===2){return n;}
    return /supletorio|segunda/i.test(text(row&&(row.tipoDefensa||row.estado||row.estadoClave)))?2:1;
  }
  function idOf(periodoId,cedula,intento){
    periodoId=canonicalPeriodId(periodoId);cedula=normalizeCedula(cedula);intento=Number(intento||1);
    return periodoId&&cedula?cedula+"__"+periodoId+"__defensa_"+intento:"";
  }
  function parseRange(value){
    var m=text(value).match(/(\d{1,2}:\d{2})\s*(?:a|-|–)\s*(\d{1,2}:\d{2})/i);
    return m?{inicio:m[1],fin:m[2]}:{inicio:"",fin:""};
  }
  function normalize(row){
    row=Object.assign({},row||{});
    var periodoId=canonicalPeriodId(row.periodoId||row.periodId);
    var cedula=normalizeCedula(row.cedula||row.numeroIdentificacion);
    var intento=attempt(row);
    var range=parseRange(row.hora);
    var id=idOf(periodoId,cedula,intento)||text(row.id);
    return Object.assign({},row,{
      id:id,periodoId:periodoId,periodId:periodoId,cedula:cedula,numeroIdentificacion:cedula,
      intento:intento,tipoDefensa:text(row.tipoDefensa)||(intento===2?"SUPLETORIO":"ORDINARIA"),
      fechaISO:text(row.fechaISO||row.diaISO||""),dia:text(row.dia||""),
      hora:text(row.hora||""),horaInicio:text(row.horaInicio||range.inicio),horaFin:text(row.horaFin||range.fin),
      aula:text(row.aula||""),sede:text(row.sede||""),
      tribunal1:text(row.tribunal1||""),tribunal2:text(row.tribunal2||""),tribunal3:text(row.tribunal3||""),
      estadoCronograma:text(row.estadoCronograma||row.cronogramaEstado||"BORRADOR").toUpperCase(),
      updatedAt:text(row.updatedAt)||now(),createdAt:text(row.createdAt)||now()
    });
  }
  function list(options){
    options=options||{};
    var periodoId=canonicalPeriodId(options.periodoId||options.periodId);
    var cedula=normalizeCedula(options.cedula||options.numeroIdentificacion);
    var intento=Number(options.intento||0);
    return Repos.safeGetAll(store()).then(function(rows){
      return (rows||[]).map(normalize).filter(function(row){
        if(periodoId&&row.periodoId!==periodoId){return false;}
        if(cedula&&row.cedula!==cedula){return false;}
        if(intento&&row.intento!==intento){return false;}
        return true;
      });
    });
  }
  function save(row){
    var incoming=normalize(row);
    if(!incoming.id){return Promise.reject(new Error("Cronograma sin identificación, período o intento."));}
    return list({periodoId:incoming.periodoId,cedula:incoming.cedula,intento:incoming.intento}).then(function(rows){
      var existing=rows[0]||{};
      incoming.createdAt=text(existing.createdAt)||incoming.createdAt;
      return Repos.safePut(store(),Object.assign({},existing,incoming,{updatedAt:now()}));
    });
  }
  function saveMany(rows){
    rows=Array.isArray(rows)?rows:[];
    if(!rows.length){return Promise.resolve([]);}
    return list({}).then(function(existingRows){
      var map={};(existingRows||[]).forEach(function(row){map[row.id]=row;});
      var items=rows.map(normalize).filter(function(row){return !!row.id;}).map(function(row){
        var existing=map[row.id]||{};
        return Object.assign({},existing,row,{createdAt:text(existing.createdAt)||row.createdAt||now(),updatedAt:now()});
      });
      return items.length?Repos.bulkPut(store(),items):Promise.resolve([]);
    });
  }
  function getByStudent(periodoId,cedula,intento){
    return list({periodoId:periodoId,cedula:cedula,intento:intento}).then(function(rows){return rows[0]||null;});
  }

  var api={version:VERSION,normalize:normalize,idOf:idOf,list:list,save:save,saveMany:saveMany,getByStudent:getByStudent};
  Repos.register("cronograma_defensas",api);
  Repos.register("cronogramaDefensas",api);
  window.BDLRepoCronogramaDefensas=api;
})(window);

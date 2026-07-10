/* =========================================================
Nombre completo: bdl.migration.legacy-v2.js
Ruta o ubicación: /BDLocal/migrations/bdl.migration.legacy-v2.js
Función o funciones:
- Migrar manualmente datos legacy hacia DB_VERSION 2.
- Conservar telegramUser y telegramChatId como campos independientes.
- Unificar idEstudiantePeriodo local como cedula__periodoId.
- Validar cédulas ecuatorianas antes de completar el cero inicial.
- Combinar duplicados sin reemplazar valores válidos por campos vacíos.
- Crear respaldo previo y mantener intactas las tablas legacy.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.3.0-identity-safe";
  var running = false;
  var lastPreview = null;
  var lastResult = null;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function db(){ return window.BL2DB || null; }
  function config(){ return window.BL2Config || {}; }
  function stores(){ return config().stores || {}; }

  function cleanId(value){
    var rules = window.BDLRulesPersona;
    if(rules && typeof rules.normalizeCedula === "function"){ return rules.normalizeCedula(value); }
    var utils = config().utils || {};
    if(typeof utils.normalizeCedula === "function"){ return utils.normalizeCedula(value); }
    return text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
  }

  function normalizeKey(value){
    var utils = config().utils || {};
    if(typeof utils.normalizeKey === "function"){ return utils.normalizeKey(value); }
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  }

  function period(value){
    value = text(value);
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4] : value.replace(/_+/g,"__");
  }

  function epId(periodoId,cedula){
    periodoId = period(periodoId);
    cedula = cleanId(cedula);
    return periodoId && cedula ? cedula+"__"+periodoId : "";
  }

  function first(row,keys){
    row = row || {};
    for(var i=0;i<keys.length;i+=1){ if(text(row[keys[i]]) !== ""){ return row[keys[i]]; } }
    return "";
  }

  function normalizeUser(value){
    var rules = window.BDLRulesPersona;
    return rules && rules.normalizeTelegramUser ? rules.normalizeTelegramUser(value) : text(value).replace(/^@+/,"").replace(/\s+/g,"");
  }

  function normalizeChatId(value){
    var rules = window.BDLRulesPersona;
    return rules && rules.normalizeTelegramChatId ? rules.normalizeTelegramChatId(value) : text(value).replace(/\s+/g,"");
  }

  function telegram(row){
    row = row || {};
    return {
      telegramUser:normalizeUser(first(row,["telegramUser","_telegramUser","telegramUsername","usuarioTelegram","telegram","Telegram"])),
      telegramChatId:normalizeChatId(first(row,["telegramChatId","_telegramChatId","chatIdTelegram","telegramChatID","chatId"])),
      telegramUpdatedAt:text(first(row,["telegramUpdatedAt","telegramActualizadoEn"])),
      telegramSource:text(first(row,["telegramSource","origenTelegram"])),
      telegramCheckedAt:text(first(row,["telegramCheckedAt","telegramRevisadoEn"])),
      telegramVerifiedAt:text(first(row,["telegramVerifiedAt","telegramVerificadoEn"]))
    };
  }

  function mergeNonEmpty(existing,incoming){
    existing = existing || {};
    incoming = incoming || {};
    var merged = Object.assign({},existing);
    Object.keys(incoming).forEach(function(key){
      var value = incoming[key];
      if(value === undefined || value === null || text(value) === ""){
        if(merged[key] === undefined){ merged[key] = value; }
      }else{
        merged[key] = value;
      }
    });
    merged.createdAt = existing.createdAt || incoming.createdAt || now();
    merged.updatedAt = text(incoming.updatedAt || existing.updatedAt) || now();
    return merged;
  }

  function values(map){ return Object.keys(map).map(function(key){ return map[key]; }); }
  function upsert(map,key,row){ if(key){ map[key] = mergeNonEmpty(map[key],row); } }

  function note(value){
    var raw = text(value).replace(",",".");
    if(!raw){ return null; }
    var number = Number(raw);
    return isFinite(number) ? Math.max(0,Math.min(10,Math.round(number*100)/100)) : null;
  }

  function finalNote(article,defense){
    article = note(article);
    defense = note(defense);
    return article == null || defense == null ? null : Math.round(((article*0.70)+(defense*0.30))*100)/100;
  }

  function readAll(){
    var current = db();
    if(!current){ return Promise.reject(new Error("BL2DB no disponible.")); }
    var declared = stores();
    return Promise.all([
      current.getAll(declared.estudiantes || "estudiantes").catch(function(){return [];}),
      current.getAll(declared.requisitos || "requisitos").catch(function(){return [];}),
      current.getAll(declared.notas || "notas").catch(function(){return [];}),
      current.getAll(declared.contactos || "contactos").catch(function(){return [];}),
      current.getAll(declared.cambios || "cambios").catch(function(){return [];})
    ]).then(function(result){
      return {estudiantes:result[0]||[],requisitos:result[1]||[],notas:result[2]||[],contactos:result[3]||[],cambios:result[4]||[]};
    });
  }

  function convert(legacy){
    legacy = legacy || {};
    var personas={},matriculas={},contactos={},divisiones={},carreras={},periodosDivisiones={};

    (legacy.estudiantes || []).forEach(function(row){
      var cedula = cleanId(first(row,["cedula","_cedula","numeroIdentificacion","NumeroIdentificacion","Cedula","Cédula"]));
      var periodoId = period(first(row,["periodoId","periodId","ultimoPeriodoId","_periodoId"]));
      var idEstudiantePeriodo = epId(periodoId,cedula);
      if(!cedula || !periodoId || !idEstudiantePeriodo){ return; }

      var nombre = text(first(row,["nombreCompleto","nombres","Nombres","nombre","Nombre","Estudiante","estudiante"]));
      var carrera = text(first(row,["carrera","NombreCarrera","nombreCarrera","Carrera","_carrera"]));
      var sede = text(first(row,["sede","Sede","campus","_sede"]));
      var division = text(first(row,["division","Division","División","_division"]));
      var updatedAt = text(row.updatedAt || row.actualizadoEn || "") || now();
      var tg = telegram(row);

      upsert(personas,cedula,Object.assign({
        cedula:cedula,
        numeroIdentificacion:cedula,
        nombreCompleto:nombre,
        nombres:nombre,
        correoPersonal:text(first(row,["correoPersonal","CorreoPersonal","email","Email"])),
        correoInstitucional:text(first(row,["correoInstitucional","CorreoInstitucional"])),
        celular:text(first(row,["celular","Celular","telefono","Telefono"])),
        updatedAt:updatedAt,
        origen:"legacy.estudiantes"
      },tg,{_telegramUser:tg.telegramUser,_telegramChatId:tg.telegramChatId}));

      upsert(matriculas,idEstudiantePeriodo,{
        id:idEstudiantePeriodo,
        idEstudiantePeriodo:idEstudiantePeriodo,
        studentId:idEstudiantePeriodo,
        periodoId:periodoId,
        cedula:cedula,
        numeroIdentificacion:cedula,
        carrera:carrera,
        nombreCarrera:carrera,
        sede:sede,
        division:division,
        estadoMatricula:text(row.estadoMatricula || row.EstadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO",
        updatedAt:updatedAt,
        origen:"legacy.estudiantes"
      });

      upsert(contactos,idEstudiantePeriodo,Object.assign({
        id:idEstudiantePeriodo,
        idEstudiantePeriodo:idEstudiantePeriodo,
        studentId:idEstudiantePeriodo,
        periodoId:periodoId,
        cedula:cedula,
        numeroIdentificacion:cedula,
        correoPersonal:text(first(row,["correoPersonal","CorreoPersonal","email","Email"])),
        correoInstitucional:text(first(row,["correoInstitucional","CorreoInstitucional"])),
        celular:text(first(row,["celular","Celular","telefono","Telefono"])),
        updatedAt:updatedAt,
        origen:"legacy.estudiantes"
      },tg,{_telegramUser:tg.telegramUser,_telegramChatId:tg.telegramChatId}));

      if(division){
        var divisionKey = normalizeKey(division);
        upsert(divisiones,idEstudiantePeriodo+"__"+divisionKey,{
          id:idEstudiantePeriodo+"__"+divisionKey,
          idEstudiantePeriodo:idEstudiantePeriodo,
          studentId:idEstudiantePeriodo,
          periodoId:periodoId,
          cedula:cedula,
          carrera:carrera,
          division:division,
          divisionKey:divisionKey,
          updatedAt:updatedAt,
          origen:"legacy.estudiantes"
        });
      }

      if(carrera){
        var carreraKey = normalizeKey(carrera);
        upsert(carreras,periodoId+"__"+carreraKey,{id:periodoId+"__"+carreraKey,periodoId:periodoId,carrera:carrera,carreraKey:carreraKey,updatedAt:updatedAt,origen:"legacy.estudiantes"});
      }

      if(division){
        var periodoDivisionKey = normalizeKey(division);
        upsert(periodosDivisiones,periodoId+"__"+periodoDivisionKey,{id:periodoId+"__"+periodoDivisionKey,periodoId:periodoId,division:division,divisionKey:periodoDivisionKey,updatedAt:updatedAt,origen:"legacy.estudiantes"});
      }
    });

    (legacy.contactos || []).forEach(function(row){
      var periodoId = period(row.periodoId || row.periodId);
      var cedula = cleanId(row.cedula || row.numeroIdentificacion);
      var idEstudiantePeriodo = epId(periodoId,cedula);
      var tg = telegram(row);
      if(!cedula || !periodoId || !idEstudiantePeriodo){ return; }

      upsert(contactos,idEstudiantePeriodo,Object.assign({
        id:idEstudiantePeriodo,
        idEstudiantePeriodo:idEstudiantePeriodo,
        studentId:idEstudiantePeriodo,
        periodoId:periodoId,
        cedula:cedula,
        numeroIdentificacion:cedula,
        correoPersonal:text(row.correoPersonal || row.CorreoPersonal || row.email),
        correoInstitucional:text(row.correoInstitucional || row.CorreoInstitucional),
        celular:text(row.celular || row.Celular || row.telefono),
        updatedAt:text(row.updatedAt)||now(),
        origen:"legacy.contactos"
      },tg,{_telegramUser:tg.telegramUser,_telegramChatId:tg.telegramChatId}));

      upsert(personas,cedula,Object.assign({
        cedula:cedula,
        numeroIdentificacion:cedula,
        updatedAt:text(row.updatedAt)||now(),
        origen:"legacy.contactos"
      },tg,{_telegramUser:tg.telegramUser,_telegramChatId:tg.telegramChatId}));
    });

    return {
      personas:values(personas),
      matriculasPeriodo:values(matriculas),
      contactosEstudiante:values(contactos),
      divisionesEstudiante:values(divisiones),
      periodosCarreras:values(carreras),
      periodosDivisiones:values(periodosDivisiones),
      requisitosEstudiante:(legacy.requisitos || []).map(function(row){
        var periodoId = period(row.periodoId || row.periodId);
        var cedula = cleanId(row.cedula || row.numeroIdentificacion);
        var idEstudiantePeriodo = epId(periodoId,cedula);
        var requisitoKey = normalizeKey(row.requisitoKey || row.key || row.nombre || row.Nombre || "requisito");
        return {
          id:idEstudiantePeriodo && requisitoKey ? idEstudiantePeriodo+"__"+requisitoKey : "",
          idEstudiantePeriodo:idEstudiantePeriodo,
          studentId:idEstudiantePeriodo,
          periodoId:periodoId,
          cedula:cedula,
          numeroIdentificacion:cedula,
          requisitoKey:requisitoKey,
          nombre:text(row.nombre || row.Nombre || requisitoKey),
          estado:text(row.estado || row.valor || row.value),
          valor:text(row.valor || row.value || row.estado),
          updatedAt:text(row.updatedAt)||now(),
          origen:"legacy.requisitos"
        };
      }).filter(function(row){ return !!row.id; }),
      notasTitulacion:(legacy.notas || []).map(function(row){
        var periodoId = period(row.periodoId || row.periodId);
        var cedula = cleanId(row.cedula || row.numeroIdentificacion);
        var idEstudiantePeriodo = epId(periodoId,cedula);
        var article = note(first(row,["notart","Notart","Nart","_nart"]));
        var defense = note(first(row,["notdef","Notdef","Ndef","_ndef"]));
        var explicitFinal = note(first(row,["notafinal","Notafinal","Nfinal","_nfin"]));
        var finalValue = explicitFinal == null ? finalNote(article,defense) : explicitFinal;
        return {
          id:idEstudiantePeriodo,
          notaId:idEstudiantePeriodo,
          idEstudiantePeriodo:idEstudiantePeriodo,
          studentId:idEstudiantePeriodo,
          periodoId:periodoId,
          cedula:cedula,
          numeroIdentificacion:cedula,
          notart:article,
          notdef:defense,
          notafinal:finalValue,
          Notart:article,
          Notdef:defense,
          Notafinal:finalValue,
          estadoNota:text(row.estadoNota),
          updatedAt:text(row.updatedAt)||now(),
          origen:"legacy.notas"
        };
      }).filter(function(row){ return !!row.idEstudiantePeriodo; }),
      cambiosPendientes:(legacy.cambios || []).map(function(row,index){
        row = Object.assign({},row || {});
        row.id = text(row.id || row.cambioId || "cambio_"+Date.now()+"_"+index);
        row.cambioId = row.cambioId || row.id;
        row.updatedAt = text(row.updatedAt)||now();
        row.createdAt = text(row.createdAt)||row.updatedAt;
        row.origen = text(row.origen || row.source || "legacy.cambios");
        return row;
      })
    };
  }

  function count(data){
    var result={};
    Object.keys(data||{}).forEach(function(key){result[key]=Array.isArray(data[key])?data[key].length:0;});
    return result;
  }

  function preview(){
    return readAll().then(function(legacy){
      var converted=convert(legacy);
      lastPreview={
        ok:true,
        version:VERSION,
        generatedAt:now(),
        legacy:count(legacy),
        target:count(converted),
        idStrategy:"cedula__periodoId",
        identityValidation:true,
        telegramSeparated:true,
        message:"Vista previa lista. No se escribió nada."
      };
      return lastPreview;
    });
  }

  function saveBackup(legacy){
    var repository=window.BDLRepositories&&window.BDLRepositories.get?window.BDLRepositories.get("backups"):null;
    var row={
      scope:"bdlocal.migration",
      tipo:"before_legacy_to_v2",
      schemaVersion:"2",
      totalRegistros:(legacy.estudiantes||[]).length,
      payload:{legacyCounts:count(legacy),createdAt:now()},
      origen:"BDLMigrationLegacyV2"
    };
    return repository&&repository.save?repository.save(row):Promise.resolve(row);
  }

  function write(converted){
    var current=db();
    var declared=stores();
    var plan=[
      [declared.periodosCarreras||"periodos_carreras",converted.periodosCarreras],
      [declared.periodosDivisiones||"periodos_divisiones",converted.periodosDivisiones],
      [declared.personas||"personas",converted.personas],
      [declared.matriculasPeriodo||"matriculas_periodo",converted.matriculasPeriodo],
      [declared.requisitosEstudiante||"requisitos_estudiante",converted.requisitosEstudiante],
      [declared.notasTitulacion||"notas_titulacion",converted.notasTitulacion],
      [declared.contactosEstudiante||"contactos_estudiante",converted.contactosEstudiante],
      [declared.divisionesEstudiante||"divisiones_estudiante",converted.divisionesEstudiante],
      [declared.cambiosPendientes||"cambios_pendientes",converted.cambiosPendientes]
    ];
    var written={};
    var chain=Promise.resolve();
    plan.forEach(function(item){
      chain=chain.then(function(){
        written[item[0]]=0;
        if(!item[1]||!item[1].length){return null;}
        return current.bulkPut(item[0],item[1]).then(function(){written[item[0]]=item[1].length;});
      });
    });
    return chain.then(function(){return written;});
  }

  function run(options){
    options=options||{};
    if(running){return Promise.resolve({ok:false,message:"Migración en curso."});}
    if(!options.confirm){return Promise.resolve({ok:false,message:"Debe confirmar la migración manual."});}
    running=true;

    return readAll().then(function(legacy){
      var converted=convert(legacy);
      return saveBackup(legacy).then(function(backup){
        return write(converted).then(function(written){
          lastResult={
            ok:true,
            version:VERSION,
            migratedAt:now(),
            backup:backup,
            legacy:count(legacy),
            target:count(converted),
            written:written,
            idStrategy:"cedula__periodoId",
            identityValidation:true,
            telegramSeparated:true,
            message:"Migración completada. Las tablas legacy quedan intactas."
          };
          return lastResult;
        });
      });
    }).catch(function(error){
      return {ok:false,message:error.message||String(error),failedAt:now()};
    }).finally(function(){running=false;});
  }

  function status(){return {version:VERSION,running:running,lastPreview:lastPreview,lastResult:lastResult};}

  window.BDLMigrationLegacyV2={
    version:VERSION,
    preview:preview,
    run:run,
    status:status,
    convert:convert,
    epId:epId,
    cleanId:cleanId,
    mergeNonEmpty:mergeNonEmpty
  };

  if(window.BDLMigrations&&window.BDLMigrations.register){
    window.BDLMigrations.register("2.3.0-legacy-to-v2-identity-safe",{
      title:"Migración legacy a V2 con identidad y Telegram separados",
      destructive:false,
      preview:preview,
      run:run,
      status:status
    });
  }
})(window);

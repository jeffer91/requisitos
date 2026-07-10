/* =========================================================
Nombre completo: bdl.migration.legacy-v2.js
Ruta o ubicación: /BDLocal/migrations/bdl.migration.legacy-v2.js
Función o funciones:
- Migrar manualmente datos legacy hacia DB_VERSION 2.
- Conservar telegramUser y telegramChatId como campos independientes.
- Unificar idEstudiantePeriodo local como cedula__periodoId.
- Combinar duplicados sin reemplazar valores válidos por campos vacíos.
- Crear respaldo previo y mantener intactas las tablas legacy.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.2.0-telegram-safe";
  var running = false;
  var lastPreview = null;
  var lastResult = null;

  function text(v){ return String(v == null ? "" : v).trim(); }
  function now(){ return new Date().toISOString(); }
  function db(){ return window.BL2DB || null; }
  function stores(){ return window.BL2Config && window.BL2Config.stores ? window.BL2Config.stores : {}; }
  function cleanId(v){
    var raw = text(v).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }
  function period(v){
    v = text(v);
    var m = v.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return m ? m[1] + "-" + m[2] + "__" + m[3] + "-" + m[4] : v.replace(/_+/g,"__");
  }
  function epId(periodoId,cedula){
    periodoId = period(periodoId);
    cedula = cleanId(cedula);
    return periodoId && cedula ? cedula + "__" + periodoId : "";
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
      }else{ merged[key] = value; }
    });
    merged.createdAt = existing.createdAt || incoming.createdAt || now();
    merged.updatedAt = text(incoming.updatedAt || existing.updatedAt) || now();
    return merged;
  }
  function values(map){ return Object.keys(map).map(function(k){ return map[k]; }); }
  function upsert(map,key,row){ if(key){ map[key] = mergeNonEmpty(map[key],row); } }
  function note(v){
    var raw = text(v).replace(",",".");
    if(!raw){ return null; }
    var n = Number(raw);
    return isFinite(n) ? Math.max(0,Math.min(10,Math.round(n*100)/100)) : null;
  }
  function finalNote(a,b){ a=note(a);b=note(b);return a==null||b==null?null:Math.round(((a*0.70)+(b*0.30))*100)/100; }

  function readAll(){
    var current = db();
    if(!current){ return Promise.reject(new Error("BL2DB no disponible.")); }
    var s = stores();
    return Promise.all([
      current.getAll(s.estudiantes || "estudiantes").catch(function(){return [];}),
      current.getAll(s.requisitos || "requisitos").catch(function(){return [];}),
      current.getAll(s.notas || "notas").catch(function(){return [];}),
      current.getAll(s.contactos || "contactos").catch(function(){return [];}),
      current.getAll(s.cambios || "cambios").catch(function(){return [];})
    ]).then(function(r){return {estudiantes:r[0]||[],requisitos:r[1]||[],notas:r[2]||[],contactos:r[3]||[],cambios:r[4]||[]};});
  }

  function convert(legacy){
    legacy = legacy || {};
    var personas={},matriculas={},contactos={},divisiones={},carreras={},perDivs={};

    (legacy.estudiantes || []).forEach(function(row){
      var cedula = cleanId(first(row,["cedula","_cedula","numeroIdentificacion","NumeroIdentificacion","Cedula","Cédula"]));
      var periodoId = period(first(row,["periodoId","periodId","ultimoPeriodoId","_periodoId"]));
      var idEP = epId(periodoId,cedula);
      if(!cedula || !periodoId || !idEP){ return; }
      var nombre = text(first(row,["nombreCompleto","nombres","Nombres","nombre","Nombre","Estudiante","estudiante"]));
      var carrera = text(first(row,["carrera","NombreCarrera","nombreCarrera","Carrera","_carrera"]));
      var sede = text(first(row,["sede","Sede","campus","_sede"]));
      var division = text(first(row,["division","Division","División","_division"]));
      var updatedAt = text(row.updatedAt || row.actualizadoEn || "") || now();
      var tg = telegram(row);

      upsert(personas,cedula,Object.assign({
        cedula:cedula,numeroIdentificacion:cedula,nombreCompleto:nombre,nombres:nombre,
        correoPersonal:text(first(row,["correoPersonal","CorreoPersonal","email","Email"])),
        correoInstitucional:text(first(row,["correoInstitucional","CorreoInstitucional"])),
        celular:text(first(row,["celular","Celular","telefono","Telefono"])),
        updatedAt:updatedAt,origen:"legacy.estudiantes"
      },tg,{_telegramUser:tg.telegramUser,_telegramChatId:tg.telegramChatId}));

      upsert(matriculas,idEP,{idEstudiantePeriodo:idEP,periodoId:periodoId,cedula:cedula,carrera:carrera,nombreCarrera:carrera,sede:sede,division:division,estadoMatricula:text(row.estadoMatricula || row.EstadoMatricula || "ACTIVO").toUpperCase()==="RETIRADO"?"RETIRADO":"ACTIVO",updatedAt:updatedAt,origen:"legacy.estudiantes"});

      upsert(contactos,idEP,Object.assign({
        id:idEP,idEstudiantePeriodo:idEP,studentId:idEP,periodoId:periodoId,cedula:cedula,
        correoPersonal:text(first(row,["correoPersonal","CorreoPersonal","email","Email"])),
        correoInstitucional:text(first(row,["correoInstitucional","CorreoInstitucional"])),
        celular:text(first(row,["celular","Celular","telefono","Telefono"])),
        updatedAt:updatedAt,origen:"legacy.estudiantes"
      },tg,{_telegramUser:tg.telegramUser,_telegramChatId:tg.telegramChatId}));

      if(division){upsert(divisiones,idEP+"__"+division,{id:idEP+"__"+division,idEstudiantePeriodo:idEP,periodoId:periodoId,cedula:cedula,carrera:carrera,division:division,updatedAt:updatedAt,origen:"legacy.estudiantes"});}
      if(carrera){upsert(carreras,periodoId+"__"+carrera,{id:periodoId+"__"+carrera,periodoId:periodoId,carrera:carrera,updatedAt:updatedAt,origen:"legacy.estudiantes"});}
      if(division){upsert(perDivs,periodoId+"__"+division,{id:periodoId+"__"+division,periodoId:periodoId,division:division,updatedAt:updatedAt,origen:"legacy.estudiantes"});}
    });

    (legacy.contactos || []).forEach(function(row,index){
      var p=period(row.periodoId || row.periodId),c=cleanId(row.cedula || row.numeroIdentificacion),id=epId(p,c) || text(row.id) || "contacto_"+index,tg=telegram(row);
      if(!c || !p){ return; }
      upsert(contactos,id,Object.assign({
        id:id,idEstudiantePeriodo:id,studentId:id,periodoId:p,cedula:c,
        correoPersonal:text(row.correoPersonal || row.CorreoPersonal || row.email),
        correoInstitucional:text(row.correoInstitucional || row.CorreoInstitucional),
        celular:text(row.celular || row.Celular || row.telefono),
        updatedAt:text(row.updatedAt)||now(),origen:"legacy.contactos"
      },tg,{_telegramUser:tg.telegramUser,_telegramChatId:tg.telegramChatId}));
      upsert(personas,c,Object.assign({cedula:c,numeroIdentificacion:c,updatedAt:text(row.updatedAt)||now(),origen:"legacy.contactos"},tg,{_telegramUser:tg.telegramUser,_telegramChatId:tg.telegramChatId}));
    });

    return {
      personas:values(personas),
      matriculasPeriodo:values(matriculas),
      contactosEstudiante:values(contactos),
      divisionesEstudiante:values(divisiones),
      periodosCarreras:values(carreras),
      periodosDivisiones:values(perDivs),
      requisitosEstudiante:(legacy.requisitos || []).map(function(row,i){var p=period(row.periodoId),c=cleanId(row.cedula),idEP=epId(p,c),k=text(row.requisitoKey || row.key || row.nombre || row.Nombre || "requisito");return {id:text(row.id)||idEP+"__"+k||"req_"+i,idEstudiantePeriodo:idEP,periodoId:p,cedula:c,requisitoKey:k,nombre:text(row.nombre || row.Nombre || k),estado:text(row.estado || row.valor || row.value),valor:text(row.valor || row.value || row.estado),updatedAt:text(row.updatedAt)||now(),origen:"legacy.requisitos"};}).filter(function(x){return !!x.idEstudiantePeriodo;}),
      notasTitulacion:(legacy.notas || []).map(function(row,i){var p=period(row.periodoId),c=cleanId(row.cedula),idEP=epId(p,c) || text(row.id) || "nota_"+i,na=note(first(row,["notart","Notart","Nart","_nart"])),nd=note(first(row,["notdef","Notdef","Ndef","_ndef"])),nf=note(first(row,["notafinal","Notafinal","Nfinal","_nfin"]));return {id:idEP,idEstudiantePeriodo:idEP,periodoId:p,cedula:c,notart:na,notdef:nd,notafinal:nf==null?finalNote(na,nd):nf,Notart:na,Notdef:nd,Notafinal:nf==null?finalNote(na,nd):nf,estadoNota:text(row.estadoNota),updatedAt:text(row.updatedAt)||now(),origen:"legacy.notas"};}).filter(function(x){return !!x.idEstudiantePeriodo;}),
      cambiosPendientes:(legacy.cambios || []).map(function(row,i){row=Object.assign({},row||{});row.id=text(row.id || row.cambioId || "cambio_"+Date.now()+"_"+i);row.cambioId=row.cambioId||row.id;row.updatedAt=text(row.updatedAt)||now();row.createdAt=text(row.createdAt)||row.updatedAt;row.origen=text(row.origen || row.source || "legacy.cambios");return row;})
    };
  }

  function count(data){var out={};Object.keys(data||{}).forEach(function(k){out[k]=Array.isArray(data[k])?data[k].length:0;});return out;}
  function preview(){return readAll().then(function(legacy){var converted=convert(legacy);lastPreview={ok:true,version:VERSION,generatedAt:now(),legacy:count(legacy),target:count(converted),idStrategy:"cedula__periodoId",telegramSeparated:true,message:"Vista previa lista. No se escribió nada."};return lastPreview;});}
  function saveBackup(legacy){var repo=window.BDLRepositories&&window.BDLRepositories.get?window.BDLRepositories.get("backups"):null;var row={scope:"bdlocal.migration",tipo:"before_legacy_to_v2",schemaVersion:"2",totalRegistros:(legacy.estudiantes||[]).length,payload:{legacyCounts:count(legacy),createdAt:now()},origen:"BDLMigrationLegacyV2"};return repo&&repo.save?repo.save(row):Promise.resolve(row);}
  function write(converted){
    var current=db(),s=stores(),plan=[
      [s.periodosCarreras||"periodos_carreras",converted.periodosCarreras],[s.periodosDivisiones||"periodos_divisiones",converted.periodosDivisiones],
      [s.personas||"personas",converted.personas],[s.matriculasPeriodo||"matriculas_periodo",converted.matriculasPeriodo],
      [s.requisitosEstudiante||"requisitos_estudiante",converted.requisitosEstudiante],[s.notasTitulacion||"notas_titulacion",converted.notasTitulacion],
      [s.contactosEstudiante||"contactos_estudiante",converted.contactosEstudiante],[s.divisionesEstudiante||"divisiones_estudiante",converted.divisionesEstudiante],
      [s.cambiosPendientes||"cambios_pendientes",converted.cambiosPendientes]
    ],written={},chain=Promise.resolve();
    plan.forEach(function(item){chain=chain.then(function(){written[item[0]]=0;if(!item[1]||!item[1].length){return null;}return current.bulkPut(item[0],item[1]).then(function(){written[item[0]]=item[1].length;});});});
    return chain.then(function(){return written;});
  }
  function run(options){
    options=options||{};
    if(running){return Promise.resolve({ok:false,message:"Migración en curso."});}
    if(!options.confirm){return Promise.resolve({ok:false,message:"Debe confirmar la migración manual."});}
    running=true;
    return readAll().then(function(legacy){var converted=convert(legacy);return saveBackup(legacy).then(function(backup){return write(converted).then(function(written){lastResult={ok:true,version:VERSION,migratedAt:now(),backup:backup,legacy:count(legacy),target:count(converted),written:written,idStrategy:"cedula__periodoId",telegramSeparated:true,message:"Migración completada. Las tablas legacy quedan intactas."};return lastResult;});});}).catch(function(error){return {ok:false,message:error.message||String(error),failedAt:now()};}).finally(function(){running=false;});
  }
  function status(){return {version:VERSION,running:running,lastPreview:lastPreview,lastResult:lastResult};}

  window.BDLMigrationLegacyV2={version:VERSION,preview:preview,run:run,status:status,convert:convert,epId:epId,mergeNonEmpty:mergeNonEmpty};
  if(window.BDLMigrations&&window.BDLMigrations.register){window.BDLMigrations.register("2.2.0-legacy-to-v2-telegram",{title:"Migración legacy a V2 con Telegram separado",destructive:false,preview:preview,run:run,status:status});}
})(window);

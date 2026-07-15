/* =========================================================
Nombre completo: bdl.v2.mirror.js
Ruta o ubicación: /BDLocal/patches/bdl.v2.mirror.js
Función o funciones:
- Espejar datos legacy hacia tablas V2 sin borrar información existente.
- Consolidar Telegram en personas y contactos_estudiante.
- Usar cedula__periodoId como clave local única.
- Aceptar IDs antiguos invertidos al recibir notas.
- Fusionar notas duplicadas antes de escribir y evitar que una fila vacía reemplace una válida.
- Exponer actualización local de Telegram mediante BL2Core.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.3.0-notes-receive-safe";
  var FLAG = "__bdlV2MirrorInstalled";
  if(window[FLAG]){ return; }
  window[FLAG] = true;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }
  function hasValue(value){ return value !== undefined && value !== null && text(value) !== ""; }

  function normalizeCedula(value){
    var rules = window.BDLRulesPersona;
    if(rules && typeof rules.normalizeCedula === "function"){ return rules.normalizeCedula(value); }
    var utils = window.BL2Config && window.BL2Config.utils;
    return utils && typeof utils.normalizeCedula === "function"
      ? utils.normalizeCedula(value)
      : text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
  }

  function period(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match
      ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]
      : value.replace(/_+/g,"__");
  }

  function parseStudentId(value){
    value = text(value);
    var canonical = value.match(/^([0-9A-Za-z]{9,20})__(\d{4}-\d{2}__\d{4}-\d{2})$/);
    if(canonical){ return { cedula:normalizeCedula(canonical[1]), periodoId:period(canonical[2]) }; }
    var legacy = value.match(/^(\d{4}-\d{2}__\d{4}-\d{2})__([0-9A-Za-z]{9,20})$/);
    if(legacy){ return { cedula:normalizeCedula(legacy[2]), periodoId:period(legacy[1]) }; }
    return { cedula:"", periodoId:"" };
  }

  function studentIdFrom(row){
    row = row || {};
    var parsed = parseStudentId(row.idEstudiantePeriodo || row.studentId || row.notaId || row.id || "");
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || parsed.cedula || "");
    var periodoId = period(row.periodoId || row.periodId || row.periodoCanonicoId || row.ultimoPeriodoId || parsed.periodoId || "");
    return cedula && periodoId ? cedula + "__" + periodoId : "";
  }

  function key(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  }

  function first(row,names){
    row = row || {};
    for(var index = 0; index < names.length; index += 1){
      if(hasValue(row[names[index]])){ return row[names[index]]; }
    }
    return "";
  }

  function user(value){
    var rules = window.BDLRulesPersona;
    return rules && rules.normalizeTelegramUser
      ? rules.normalizeTelegramUser(value)
      : text(value).replace(/^@+/,"").replace(/\s+/g,"");
  }

  function chat(value){
    var rules = window.BDLRulesPersona;
    return rules && rules.normalizeTelegramChatId
      ? rules.normalizeTelegramChatId(value)
      : text(value).replace(/\s+/g,"");
  }

  function telegram(row){
    return {
      telegramUser:user(first(row,["telegramUser","_telegramUser","telegramUsername","usuarioTelegram","telegram","Telegram"])),
      telegramChatId:chat(first(row,["telegramChatId","_telegramChatId","chatIdTelegram","telegramChatID","chatId"])),
      telegramUpdatedAt:text(first(row,["telegramUpdatedAt","telegramActualizadoEn"])),
      telegramSource:text(first(row,["telegramSource","origenTelegram"])),
      telegramCheckedAt:text(first(row,["telegramCheckedAt","telegramRevisadoEn"])),
      telegramVerifiedAt:text(first(row,["telegramVerifiedAt","telegramVerificadoEn"]))
    };
  }

  function stores(){
    var current = window.BL2Config && window.BL2Config.stores || {};
    return {
      estudiantes:current.estudiantes || "estudiantes",
      requisitos:current.requisitos || "requisitos",
      contactos:current.contactos || "contactos",
      notas:current.notas || "notas",
      periodos:current.periodos || "periodos",
      personas:current.personas || "personas",
      matriculas:current.matriculasPeriodo || "matriculas_periodo",
      requisitosV2:current.requisitosEstudiante || "requisitos_estudiante",
      contactosV2:current.contactosEstudiante || "contactos_estudiante",
      notasV2:current.notasTitulacion || "notas_titulacion",
      divisiones:current.divisionesEstudiante || "divisiones_estudiante",
      periodosCarreras:current.periodosCarreras || "periodos_carreras",
      periodosDivisiones:current.periodosDivisiones || "periodos_divisiones"
    };
  }

  function timestamp(row){
    var value = Date.parse(text(row && (row.updatedAt || row.fechaRegistroNotas || row.fechaRegistro || row.createdAt)));
    return Number.isFinite(value) ? value : 0;
  }

  function merge(existing,incoming){
    existing = existing || {};
    incoming = incoming || {};
    var output = Object.assign({},existing);
    Object.keys(incoming).forEach(function(name){
      var value = incoming[name];
      if(hasValue(value)){ output[name] = clone(value); }
      else if(output[name] === undefined){ output[name] = clone(value); }
    });
    output.createdAt = existing.createdAt || incoming.createdAt || now();
    output.updatedAt = text(incoming.updatedAt || existing.updatedAt) || now();
    return output;
  }

  function numberOrNull(value){
    if(!hasValue(value)){ return null; }
    var number = Number(text(value).replace(",","."));
    if(!Number.isFinite(number)){ return null; }
    return Math.max(0,Math.min(10,Math.round(number * 100) / 100));
  }

  function finalNote(article,defense){
    article = numberOrNull(article);
    defense = numberOrNull(defense);
    if(article == null || defense == null || article < 7){ return null; }
    return Math.round(((article * 0.70) + (defense * 0.30)) * 100) / 100;
  }

  function noteValues(row){
    row = row || {};
    var article = numberOrNull(first(row,["Notart","Nart","notart","nart","_nart","notaArticulo","articulo"]));
    var defense = numberOrNull(first(row,["Notdef","Ndef","notdef","ndef","_ndef","notaDefensa","defensa"]));
    var finalValue = numberOrNull(first(row,["Notafinal","Nfinal","notafinal","nfinal","nfin","_nfin","notaFinal","final"]));
    if(finalValue == null){ finalValue = finalNote(article,defense); }
    return { article:article, defense:defense, finalValue:finalValue };
  }

  function noteState(article,defense,finalValue){
    if(article == null){ return "SIN_ARTICULO"; }
    if(article < 7){ return "ARTICULO_NO_APROBADO"; }
    if(defense == null){ return "PENDIENTE_DEFENSA"; }
    if(finalValue == null){ return "PENDIENTE_FINAL"; }
    return finalValue >= 7 ? "APROBADO" : "NO_APROBADO";
  }

  function normalizeNote(row){
    row = Object.assign({},row || {});
    var id = studentIdFrom(row);
    var parsed = parseStudentId(id);
    if(!id){ return null; }
    var values = noteValues(row);
    return Object.assign({},row,{
      id:id,
      notaId:id,
      idEstudiantePeriodo:id,
      studentId:id,
      cedula:parsed.cedula,
      numeroIdentificacion:parsed.cedula,
      periodoId:parsed.periodoId,
      periodId:parsed.periodoId,
      periodoCanonicoId:parsed.periodoId,
      Notart:values.article,
      Nart:values.article,
      notart:values.article,
      nart:values.article,
      Notdef:values.defense,
      Ndef:values.defense,
      notdef:values.defense,
      ndef:values.defense,
      Notafinal:values.finalValue,
      Nfinal:values.finalValue,
      notafinal:values.finalValue,
      nfinal:values.finalValue,
      estadoNota:noteState(values.article,values.defense,values.finalValue),
      source:"v2_mirror",
      updatedAt:text(row.updatedAt) || now()
    });
  }

  function mergeNote(existing,incoming){
    if(!existing){ return normalizeNote(incoming); }
    if(!incoming){ return normalizeNote(existing); }
    var left = normalizeNote(existing);
    var right = normalizeNote(incoming);
    if(!left){ return right; }
    if(!right){ return left; }

    var leftTime = timestamp(left);
    var rightTime = timestamp(right);
    var older = rightTime >= leftTime ? left : right;
    var newer = rightTime >= leftTime ? right : left;
    var output = merge(older,newer);
    var olderValues = noteValues(older);
    var newerValues = noteValues(newer);
    var article = newerValues.article != null ? newerValues.article : olderValues.article;
    var defense = newerValues.defense != null ? newerValues.defense : olderValues.defense;
    var finalValue = newerValues.finalValue != null ? newerValues.finalValue : olderValues.finalValue;
    if(finalValue == null){ finalValue = finalNote(article,defense); }

    output.Notart = output.Nart = output.notart = output.nart = article;
    output.Notdef = output.Ndef = output.notdef = output.ndef = defense;
    output.Notafinal = output.Nfinal = output.notafinal = output.nfinal = finalValue;
    output.estadoNota = noteState(article,defense,finalValue);
    output.updatedAt = text(newer.updatedAt || older.updatedAt) || now();
    return normalizeNote(output);
  }

  function primaryKey(storeName,row,currentStores){
    if(storeName === currentStores.personas){ return row.cedula; }
    if(storeName === currentStores.matriculas || storeName === currentStores.notasV2){
      return row.idEstudiantePeriodo || row.id;
    }
    return row.id || row.idEstudiantePeriodo || row.cedula;
  }

  function dedupeRows(storeName,rows,currentStores){
    var grouped = Object.create(null);
    (rows || []).filter(Boolean).forEach(function(source){
      var row = storeName === currentStores.notasV2 ? normalizeNote(source) : source;
      if(!row){ return; }
      var primary = text(primaryKey(storeName,row,currentStores));
      if(!primary){ return; }
      grouped[primary] = grouped[primary]
        ? (storeName === currentStores.notasV2 ? mergeNote(grouped[primary],row) : merge(grouped[primary],row))
        : row;
    });
    return Object.keys(grouped).map(function(primary){ return grouped[primary]; });
  }

  function mergedPut(storeName,rows,originalBulkPut){
    var currentStores = stores();
    rows = dedupeRows(storeName,rows,currentStores);
    if(!rows.length){ return Promise.resolve([]); }
    var current = window.BL2DB;
    if(!current || !current.get){ return originalBulkPut(storeName,rows); }

    return Promise.all(rows.map(function(row){
      var primary = primaryKey(storeName,row,currentStores);
      if(!text(primary)){ return row; }
      return current.get(storeName,primary).catch(function(){ return null; }).then(function(existing){
        return storeName === currentStores.notasV2 ? mergeNote(existing,row) : merge(existing,row);
      });
    })).then(function(output){
      return originalBulkPut(storeName,dedupeRows(storeName,output,currentStores));
    });
  }

  function persona(row){
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion);
    if(!cedula){ return null; }
    var base = window.BDLRulesPersona && window.BDLRulesPersona.buildPersona
      ? window.BDLRulesPersona.buildPersona(row)
      : {};
    var tg = telegram(row);
    return Object.assign({
      cedula:cedula,
      numeroIdentificacion:cedula,
      nombreCompleto:text(row.Nombres || row.nombres || row.Nombre || row.nombre),
      nombres:text(row.Nombres || row.nombres || row.Nombre || row.nombre),
      correoPersonal:text(row.CorreoPersonal || row.correoPersonal),
      correoInstitucional:text(row.CorreoInstitucional || row.correoInstitucional),
      celular:text(row.Celular || row.celular),
      source:"v2_mirror",
      updatedAt:text(row.updatedAt) || now()
    },base,tg,{ cedula:cedula, numeroIdentificacion:cedula, _telegramUser:tg.telegramUser, _telegramChatId:tg.telegramChatId });
  }

  function matricula(row){
    var id = studentIdFrom(row);
    var parsed = parseStudentId(id);
    if(!id){ return null; }
    return {
      id:id,
      idEstudiantePeriodo:id,
      studentId:id,
      cedula:parsed.cedula,
      numeroIdentificacion:parsed.cedula,
      periodoId:parsed.periodoId,
      periodId:parsed.periodoId,
      periodoLabel:text(row.periodoLabel || parsed.periodoId),
      carrera:text(row.NombreCarrera || row.nombreCarrera || row.Carrera || row.carrera),
      codigoCarrera:text(row.CodigoCarrera || row.codigoCarrera),
      division:text(row.division || row._division),
      estadoMatricula:text(row.estadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO",
      sede:text(row.Sede || row.sede),
      horarioComplexivo:text(row.HorarioComplexivo || row.horarioComplexivo),
      source:"v2_mirror",
      updatedAt:text(row.updatedAt) || now()
    };
  }

  function contacto(row){
    var id = studentIdFrom(row);
    var parsed = parseStudentId(id);
    if(!id){ return null; }
    var tg = telegram(row);
    return Object.assign({
      id:id,
      idEstudiantePeriodo:id,
      studentId:id,
      cedula:parsed.cedula,
      numeroIdentificacion:parsed.cedula,
      periodoId:parsed.periodoId,
      periodId:parsed.periodoId,
      periodoLabel:text(row.periodoLabel || parsed.periodoId),
      CorreoPersonal:text(row.CorreoPersonal || row.correoPersonal),
      CorreoInstitucional:text(row.CorreoInstitucional || row.correoInstitucional),
      Celular:text(row.Celular || row.celular),
      correoPersonal:text(row.CorreoPersonal || row.correoPersonal),
      correoInstitucional:text(row.CorreoInstitucional || row.correoInstitucional),
      celular:text(row.Celular || row.celular),
      source:"v2_mirror",
      updatedAt:text(row.updatedAt) || now()
    },tg,{ _telegramUser:tg.telegramUser, _telegramChatId:tg.telegramChatId });
  }

  function division(row){
    var id = studentIdFrom(row);
    var parsed = parseStudentId(id);
    var label = text(row.division || row._division);
    if(!id || !label){ return null; }
    return {
      id:id + "__" + key(label),
      idEstudiantePeriodo:id,
      studentId:id,
      cedula:parsed.cedula,
      periodoId:parsed.periodoId,
      division:label,
      divisionKey:key(label),
      source:"v2_mirror",
      updatedAt:text(row.updatedAt) || now()
    };
  }

  function requisito(row){
    var id = studentIdFrom(row);
    var parsed = parseStudentId(id);
    var requisitoKey = key(row.key || row.nombre || row.requisitoKey);
    if(!id || !requisitoKey){ return null; }
    return Object.assign({},row,{
      id:id + "__" + requisitoKey,
      idEstudiantePeriodo:id,
      studentId:id,
      cedula:parsed.cedula,
      numeroIdentificacion:parsed.cedula,
      periodoId:parsed.periodoId,
      requisitoKey:requisitoKey,
      estado:text(row.estado || row.valor || row.value),
      source:"v2_mirror",
      updatedAt:text(row.updatedAt) || now()
    });
  }

  function legacyContact(row){
    var id = studentIdFrom(row);
    var parsed = parseStudentId(id);
    if(!id){ return null; }
    var tg = telegram(row);
    return Object.assign({},row,{
      id:id,
      idEstudiantePeriodo:id,
      studentId:id,
      cedula:parsed.cedula,
      numeroIdentificacion:parsed.cedula,
      periodoId:parsed.periodoId,
      correoPersonal:text(row.correoPersonal || row.CorreoPersonal),
      correoInstitucional:text(row.correoInstitucional || row.CorreoInstitucional),
      celular:text(row.celular || row.Celular || row.telefono),
      telegramUser:tg.telegramUser,
      telegramChatId:tg.telegramChatId,
      telegramUpdatedAt:tg.telegramUpdatedAt,
      telegramSource:tg.telegramSource,
      telegramCheckedAt:tg.telegramCheckedAt,
      telegramVerifiedAt:tg.telegramVerifiedAt,
      _telegramUser:tg.telegramUser,
      _telegramChatId:tg.telegramChatId,
      source:"v2_mirror",
      updatedAt:text(row.updatedAt) || now()
    });
  }

  function nota(row){ return normalizeNote(row); }

  function periodRows(row){
    var periodoId = text(row.id || row.periodoId);
    var output = [];
    if(!periodoId){ return output; }
    (row.carrerasDetectadas || []).forEach(function(item){
      var label = text(item.nombre || item.label || item.carrera || item);
      if(label){ output.push({ type:"career", id:periodoId + "__" + key(label), periodoId:periodoId, carrera:label, updatedAt:now(), source:"v2_mirror" }); }
    });
    (row.divisiones || []).forEach(function(item){
      var label = text(item);
      if(label){ output.push({ type:"division", id:periodoId + "__" + key(label), periodoId:periodoId, division:label, updatedAt:now(), source:"v2_mirror" }); }
    });
    return output;
  }

  function mirrorRows(storeName,rows,originalPut,originalBulkPut){
    var currentStores = stores();
    var tasks = [];
    rows = Array.isArray(rows) ? rows : [];
    if(!rows.length){ return Promise.resolve({ mirrored:0 }); }

    if(storeName === currentStores.estudiantes){
      var people = rows.map(persona).filter(Boolean);
      var enrollments = rows.map(matricula).filter(Boolean);
      var contacts = rows.map(contacto).filter(Boolean);
      var divisions = rows.map(division).filter(Boolean);
      if(people.length){ tasks.push(mergedPut(currentStores.personas,people,originalBulkPut)); }
      if(enrollments.length){ tasks.push(mergedPut(currentStores.matriculas,enrollments,originalBulkPut)); }
      if(contacts.length){ tasks.push(mergedPut(currentStores.contactosV2,contacts,originalBulkPut)); }
      if(divisions.length){ tasks.push(mergedPut(currentStores.divisiones,divisions,originalBulkPut)); }
    }

    if(storeName === currentStores.requisitos){
      var requirements = rows.map(requisito).filter(Boolean);
      if(requirements.length){ tasks.push(mergedPut(currentStores.requisitosV2,requirements,originalBulkPut)); }
    }

    if(storeName === currentStores.contactos){
      var contactRows = rows.map(legacyContact).filter(Boolean);
      if(contactRows.length){ tasks.push(mergedPut(currentStores.contactosV2,contactRows,originalBulkPut)); }
    }

    if(storeName === currentStores.notas){
      var notes = rows.map(nota).filter(Boolean);
      if(notes.length){ tasks.push(mergedPut(currentStores.notasV2,notes,originalBulkPut)); }
    }

    if(storeName === currentStores.periodos){
      rows.forEach(function(item){
        periodRows(item).forEach(function(row){
          tasks.push(originalPut(row.type === "career" ? currentStores.periodosCarreras : currentStores.periodosDivisiones,row));
        });
      });
    }

    return tasks.length
      ? Promise.all(tasks).then(function(){ return { mirrored:tasks.length }; })
      : Promise.resolve({ mirrored:0 });
  }

  function exposeCoreTelegram(){
    var currentCore = window.BL2Core;
    var repo = window.BDLRepoContactos;
    if(!currentCore || !repo || !repo.saveTelegramForCedula){ return false; }
    currentCore.updateTelegramByCedula = function(cedula,data,options){
      return repo.saveTelegramForCedula(cedula,data,Object.assign({ source:"BL2Core.telegram_local" },options || {}));
    };
    currentCore.actualizarTelegramPorCedula = currentCore.updateTelegramByCedula;
    currentCore.guardarTelegram = currentCore.updateTelegramByCedula;
    currentCore.__telegramLocalOnly = true;
    return true;
  }

  function install(){
    var current = window.BL2DB;
    if(!current || !current.put || !current.bulkPut){ return false; }
    if(current.__v2MirrorInstalled){ exposeCoreTelegram(); return true; }

    var originalPut = current.put.bind(current);
    var originalBulkPut = current.bulkPut.bind(current);

    current.put = function(storeName,value){
      return originalPut(storeName,value).then(function(saved){
        return mirrorRows(storeName,[saved || value],originalPut,originalBulkPut)
          .catch(function(error){ try{ console.warn("[BDLV2Mirror]",error); }catch(innerError){} })
          .then(function(){ return saved; });
      });
    };

    current.bulkPut = function(storeName,rows){
      rows = Array.isArray(rows) ? rows : [];
      return originalBulkPut(storeName,rows).then(function(saved){
        return mirrorRows(storeName,saved && saved.length ? saved : rows,originalPut,originalBulkPut)
          .catch(function(error){ try{ console.warn("[BDLV2Mirror]",error); }catch(innerError){} })
          .then(function(){ return saved; });
      });
    };

    current.__v2MirrorInstalled = true;
    current.v2MirrorVersion = VERSION;
    exposeCoreTelegram();

    try{
      window.dispatchEvent(new CustomEvent("bdlocal:v2-mirror-ready",{
        detail:{ version:VERSION, at:now(), telegramSafe:true, notesSafe:true, canonicalLocalId:"cedula__periodoId" }
      }));
    }catch(error){}

    return true;
  }

  window.BDLV2Mirror = {
    version:VERSION,
    install:install,
    mirrorRows:mirrorRows,
    mergeNonEmpty:merge,
    mergeNoteRows:mergeNote,
    normalizeNote:normalizeNote,
    parseStudentId:parseStudentId,
    personaFromStudent:persona,
    contactFromStudent:contacto,
    studentIdFrom:studentIdFrom,
    exposeCoreTelegram:exposeCoreTelegram
  };

  install();
})(window);
/* =========================================================
Nombre completo: bdl.firebase.mapper.v2.js
Ruta o ubicación: /BDLocal/firebase/bdl.firebase.mapper.v2.js
Función o funciones:
- Separar una fila local en estudiante, matrícula, requisitos y notas.
- Aplicar el contrato oficial antes de sincronizar con Firebase.
- Calcular un hash estable para evitar escrituras sin cambios.
- No escribir directamente en IndexedDB ni en Firebase.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-entity-mapper";

  var DEFAULT_REQUIREMENTS = [
    "Academico","Documentacion","Financiero","Titulacion",
    "PracticasVinculacion","Vinculacion","SeguimientoGraduados","Ingles",
    "ActualizacionDatos","AprobacionTitulacion","AprobacionComplexivoProyecto"
  ];

  var NOTE_ALIASES = {
    notaTeorica:["notaTeorica","teorico","NotaTeorica","Nota 1"],
    notaPractica:["notaPractica","practico","NotaPractica","Nota 2"],
    notaComplexivo:["notaComplexivo","complexivo","NotaComplexivo"],
    notaTeoricaSupletorio:["notaTeoricaSupletorio","teoricoSupletorio"],
    notaPracticaSupletorio:["notaPracticaSupletorio","practicoSupletorio"],
    notaSupletorio:["notaSupletorio","supletorioComplexivo","Supletorio Complexivo"],
    notaEscrito:["notaEscrito","escrito","trabajoEscrito","Notart","Nart","notaArticulo"],
    notaDefensaTrabajo:["notaDefensaTrabajo","defensaTrabajo","Notdef","Ndef","notaDefensa"],
    notaTrabajoTitulacion:["notaTrabajoTitulacion","trabajoTitulacion","Notafinal","Nfinal","notaFinal"],
    notaArticulo:["notaArticulo","Notart","Nart","notart"],
    notaDefensa:["notaDefensa","Notdef","Ndef","notdef"],
    notaFinal:["notaFinal","Notafinal","Nfinal","notafinal"],
    notaOficial:["notaOficial"],
    estadoEvaluacion:["estadoEvaluacion","estadoDefensa","resultadoTitulacion"]
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function clone(value){
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function identity(){
    return window.RequisitosFirebaseIdentity || null;
  }

  function schema(){
    return window.RequisitosFirebaseSchema || null;
  }

  function first(row,names){
    row = row || {};
    names = Array.isArray(names) ? names : [];

    for(var index = 0; index < names.length; index += 1){
      var value = row[names[index]];
      if(value !== undefined && value !== null && text(value) !== ""){
        return value;
      }
    }

    return "";
  }

  function normalizeKey(value){
    var utils = window.BL2Config && window.BL2Config.utils || {};
    if(typeof utils.normalizeKey === "function"){
      return text(utils.normalizeKey(value));
    }

    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,"")
      .trim();
  }

  function clean(value){
    if(value === undefined || typeof value === "function"){ return undefined; }
    if(value === null){ return null; }

    if(Array.isArray(value)){
      return value.map(clean).filter(function(item){ return item !== undefined; });
    }

    if(typeof value === "object"){
      var output = {};
      Object.keys(value).sort().forEach(function(key){
        if(key.charAt(0) === "_" || key === "original"){ return; }
        var item = clean(value[key]);
        if(item !== undefined){ output[key] = item; }
      });
      return output;
    }

    return value;
  }

  function stableString(value){
    if(value === null || value === undefined){ return String(value); }
    if(typeof value !== "object"){ return JSON.stringify(value); }
    if(Array.isArray(value)){ return "[" + value.map(stableString).join(",") + "]"; }

    return "{" + Object.keys(value).sort().map(function(key){
      return JSON.stringify(key) + ":" + stableString(value[key]);
    }).join(",") + "}";
  }

  function dataHash(value){
    var source = stableString(value);
    var hash = 2166136261;

    for(var index = 0; index < source.length; index += 1){
      hash ^= source.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return "h" + (hash >>> 0).toString(16).padStart(8,"0");
  }

  function numberOrNull(value){
    if(value === null || value === undefined || text(value) === ""){ return null; }
    var parsed = Number(text(value).replace(",","."));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
  }

  function requirementFields(){
    var configured = window.BL2Config && window.BL2Config.fields && window.BL2Config.fields.requirements;
    return Array.isArray(configured) && configured.length ? configured.slice() : DEFAULT_REQUIREMENTS.slice();
  }

  function requirementKey(row){
    row = row || {};
    return text(
      row.requisitoKey || row.requirementKey || row.key || row.campo ||
      row.field || row.nombre || row.codigo ||
      (typeof row.requisito === "string" ? row.requisito : "")
    );
  }

  function requirementValue(row){
    row = row || {};
    var names = ["valor","value","estado","estadoKey","cumple","aprobado","resultado"];

    for(var index = 0; index < names.length; index += 1){
      var value = row[names[index]];
      if(value === undefined || value === null){ continue; }
      if(value && typeof value === "object"){
        value = value.id || value.value || value.label || "";
      }
      if(typeof value === "boolean" || typeof value === "number" || text(value) !== ""){
        return value;
      }
    }

    return "";
  }

  function commonMeta(row,entity,content){
    row = row || {};
    var now = new Date().toISOString();
    var createdAt = text(row.createdAt || row.creadoEn) || now;
    var updatedAt = text(row.updatedAt || row.actualizadoEn || row.ultimaEdicionLocal) || now;
    var version = Number(row.version || row.dataVersion || 1);
    if(!Number.isFinite(version) || version < 1){ version = 1; }

    var withoutHash = Object.assign({},content,{
      createdAt:createdAt,
      updatedAt:updatedAt,
      version:version,
      eliminado:row.eliminado === true,
      eliminadoEn:text(row.eliminadoEn || "")
    });

    withoutHash.dataHash = dataHash({ entity:entity,data:withoutHash });
    return withoutHash;
  }

  function studentDocument(row){
    row = row || {};
    var id = identity();
    var cedula = id ? id.cedulaOf(row) : text(first(row,["cedula","numeroIdentificacion"]));

    if(!cedula){ return null; }

    return commonMeta(row,"estudiantes",{
      id:cedula,
      cedula:cedula,
      nombres:text(first(row,["nombres","Nombres","nombreCompleto","NombreCompleto","nombre"])),
      correoPersonal:text(first(row,["correoPersonal","CorreoPersonal","emailPersonal"])),
      correoInstitucional:text(first(row,["correoInstitucional","CorreoInstitucional","emailInstitucional"])),
      celular:text(first(row,["celular","Celular","telefono","Telefono","Teléfono"])),
      telegramUser:text(first(row,["telegramUser","_telegramUser","usuarioTelegram","telegram"])).replace(/^@+/,""),
      telegramChatId:text(first(row,["telegramChatId","_telegramChatId","chatIdTelegram","chatId"])),
      sede:text(first(row,["sede","Sede"])),
      codigoCarreraActual:text(first(row,["codigoCarreraActual","CodigoCarrera","codigoCarrera","CódigoCarrera"])),
      nombreCarreraActual:text(first(row,["nombreCarreraActual","NombreCarrera","nombreCarrera","Carrera","carrera"]))
    });
  }

  function enrollmentDocument(row){
    row = row || {};
    var id = identity();
    var entityIdentity = id ? id.identityFromRow(row) : null;

    if(!entityIdentity || !entityIdentity.ok){ return null; }

    var status = text(first(row,["estadoMatricula","_estadoMatricula","matricula"])).toUpperCase() || "ACTIVO";
    var retired = row.retirado === true || status === "RETIRADO";

    return commonMeta(row,"matriculas",{
      id:entityIdentity.remoteId,
      localId:entityIdentity.localId,
      periodoId:entityIdentity.periodoId,
      cedula:entityIdentity.cedula,
      codigoCarrera:text(first(row,["CodigoCarrera","codigoCarrera","CódigoCarrera"])),
      nombreCarrera:text(first(row,["NombreCarrera","nombreCarrera","Carrera","carrera"])),
      sede:text(first(row,["Sede","sede"])),
      division:text(first(row,["division","_division","divisionAsignada"])),
      estadoMatricula:status,
      retirado:retired,
      retiradoEn:retired ? text(row.retiradoEn || row.estadoMatriculaActualizadaEn) : "",
      modalidadTitulacion:text(first(row,["modalidadTitulacion","modalidad","tipoTitulacion"]))
    });
  }

  function requirementsDocument(row,requirementRows){
    row = row || {};
    requirementRows = Array.isArray(requirementRows) ? requirementRows : [];
    var id = identity();
    var entityIdentity = id ? id.identityFromRow(row) : null;

    if(!entityIdentity || !entityIdentity.ok){ return null; }

    var values = {};
    var canonicalNames = Object.create(null);

    requirementFields().forEach(function(name){
      canonicalNames[normalizeKey(name)] = name;
      var value = first(row,[name]);
      if(value !== ""){ values[name] = value; }
    });

    requirementRows.forEach(function(item){
      var key = requirementKey(item);
      var normalized = normalizeKey(key);
      var value = requirementValue(item);
      if(!normalized || value === ""){ return; }
      values[canonicalNames[normalized] || key] = value;
    });

    return commonMeta(row,"requisitos",{
      id:entityIdentity.remoteId,
      localId:entityIdentity.localId,
      periodoId:entityIdentity.periodoId,
      cedula:entityIdentity.cedula,
      valores:values,
      observaciones:text(first(row,["observacionesRequisitos","observacionRequisitos","observaciones","observacion"]))
    });
  }

  function notesDocument(row,noteRow){
    row = row || {};
    noteRow = Object.assign({},row,noteRow || {});
    var id = identity();
    var entityIdentity = id ? id.identityFromRow(noteRow) : null;

    if(!entityIdentity || !entityIdentity.ok){ return null; }

    var content = {
      id:entityIdentity.remoteId,
      localId:entityIdentity.localId,
      periodoId:entityIdentity.periodoId,
      cedula:entityIdentity.cedula,
      modalidadTitulacion:text(first(noteRow,["modalidadTitulacion","modalidad","tipoTitulacion"])),
      oportunidadAplicada:text(first(noteRow,["oportunidadAplicada"])),
      notaMinimaAprobacion:numberOrNull(first(noteRow,["notaMinimaAprobacion"])),
      codigoTitulacion:text(first(noteRow,["codigoTitulacion","Código Titulación"])),
      horarioOrigen:text(first(noteRow,["horarioOrigen","Horario","HorarioComplexivo"]))
    };

    Object.keys(NOTE_ALIASES).forEach(function(field){
      var raw = first(noteRow,NOTE_ALIASES[field]);
      content[field] = field === "estadoEvaluacion" ? text(raw) : numberOrNull(raw);
    });

    return commonMeta(noteRow,"notas",content);
  }

  function bundle(row,options){
    options = options || {};
    var student = studentDocument(row);
    var enrollment = enrollmentDocument(row);
    var requirements = requirementsDocument(row,options.requirements || row && row.requisitos || row && row.requirements || []);
    var notes = notesDocument(row,options.notes || row && row.notas || row && row._notes || {});

    var valid = !!(student && enrollment && requirements && notes);

    return {
      ok:valid,
      identity:identity() ? identity().identityFromRow(row || {}) : null,
      documents:{
        estudiantes:student,
        matriculas:enrollment,
        requisitos:requirements,
        notas:notes
      },
      errors:[
        !student ? "No se pudo formar estudiantes." : "",
        !enrollment ? "No se pudo formar matriculas." : "",
        !requirements ? "No se pudo formar requisitos." : "",
        !notes ? "No se pudo formar notas." : ""
      ].filter(Boolean),
      version:VERSION
    };
  }

  var api = {
    version:VERSION,
    clean:clean,
    stableString:stableString,
    dataHash:dataHash,
    studentDocument:studentDocument,
    enrollmentDocument:enrollmentDocument,
    requirementsDocument:requirementsDocument,
    notesDocument:notesDocument,
    bundle:bundle
  };

  window.RequisitosFirebaseMapper = api;

  try{
    window.dispatchEvent(new CustomEvent("requisitos:firebase-mapper-ready",{
      detail:{ ok:true,version:VERSION,at:new Date().toISOString() }
    }));
  }catch(error){}
})(window);

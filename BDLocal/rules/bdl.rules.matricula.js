/* =========================================================
Nombre completo: bdl.rules.matricula.js
Ruta o ubicación: /BDLocal/rules/bdl.rules.matricula.js
Función o funciones:
- Normalizar datos que pertenecen a la matrícula por período.
- Crear idEstudiantePeriodo = cedula__periodoId.
- Usar la regla central de identificación validada.
- Separar carrera, sede, división, modalidad y estado de la persona.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.1.0-canonical-local-id";
  var Rules = window.BDLRules;
  var Config = window.BL2Config || {};
  var status = Config.status || { active:"ACTIVO",retired:"RETIRADO" };

  if(!Rules){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function upper(value){ return text(value).replace(/\s+/g," ").toUpperCase(); }

  function first(row,names){
    row = row || {};
    names = Array.isArray(names) ? names : [];
    for(var i=0;i<names.length;i+=1){ if(text(row[names[i]])){ return row[names[i]]; } }
    return "";
  }

  function normalizeCedula(value){
    var persona = window.BDLRulesPersona;
    if(persona && typeof persona.normalizeCedula === "function"){ return persona.normalizeCedula(value); }
    var utils = Config.utils || {};
    return typeof utils.normalizeCedula === "function" ? utils.normalizeCedula(value) : text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
  }

  function canonicalPeriodId(value){
    value = text(value);
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4] : value.replace(/_+/g,"__");
  }

  function makeId(periodoId,cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);
    return periodoId && cedula ? cedula + "__" + periodoId : "";
  }

  function normalizeEstado(value){
    var raw = upper(value || status.active);
    if(raw === "RETIRADO" || raw === "RETIRADA" || raw === "NO_APARECE_EN_ULTIMA_CARGA"){
      return status.retired || "RETIRADO";
    }
    return status.active || "ACTIVO";
  }

  function buildMatricula(row,context){
    row = row || {};
    context = context || {};

    var periodoId = canonicalPeriodId(row.periodoId || row.periodId || context.periodoId || context.periodId || "");
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || (row._bdlPersona && row._bdlPersona.cedula) || context.cedula || "");
    var idEstudiantePeriodo = makeId(periodoId,cedula);

    return {
      id:idEstudiantePeriodo,
      studentId:idEstudiantePeriodo,
      idEstudiantePeriodo:idEstudiantePeriodo,
      periodoId:periodoId,
      periodId:periodoId,
      cedula:cedula,
      numeroIdentificacion:cedula,
      carrera:upper(first(row,["carrera","Carrera","NombreCarrera","nombreCarrera"])),
      codigoCarrera:text(first(row,["codigoCarrera","CodigoCarrera","CódigoCarrera","codigo_carrera"])),
      sede:upper(first(row,["sede","Sede","campus"])),
      division:upper(first(row,["division","Division","división","División","paralelo","Paralelo"])),
      modalidad:upper(first(row,["modalidad","Modalidad"])),
      estadoMatricula:normalizeEstado(row.estadoMatricula || row.estado || row.Estado || ""),
      tipoTitulacion:upper(first(row,["tipoTitulacion","TipoTitulacion","modalidadTitulacion","ModalidadTitulacion"])),
      origen:text(row.origen || context.origen || "excel"),
      updatedAt:text(row.updatedAt || "") || new Date().toISOString(),
      _bdlMatriculaValid:!!idEstudiantePeriodo,
      _bdlMatriculaError:idEstudiantePeriodo ? "" : "No se pudo crear idEstudiantePeriodo porque falta período o identificación."
    };
  }

  function apply(payload,context){
    if(Array.isArray(payload)){
      return payload.map(function(row){
        var copy = Object.assign({},row || {});
        copy._bdlMatricula = buildMatricula(copy,context || {});
        copy.idEstudiantePeriodo = copy._bdlMatricula.idEstudiantePeriodo;
        copy.studentId = copy._bdlMatricula.studentId;
        return copy;
      });
    }
    var copy = Object.assign({},payload || {});
    copy._bdlMatricula = buildMatricula(copy,context || {});
    copy.idEstudiantePeriodo = copy._bdlMatricula.idEstudiantePeriodo;
    copy.studentId = copy._bdlMatricula.studentId;
    return copy;
  }

  Rules.register("matricula.normalize",apply);

  window.BDLRulesMatricula = {
    version:VERSION,
    normalizeCedula:normalizeCedula,
    canonicalPeriodId:canonicalPeriodId,
    makeId:makeId,
    normalizeEstado:normalizeEstado,
    buildMatricula:buildMatricula,
    apply:apply
  };
})(window);

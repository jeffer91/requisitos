/* =========================================================
Archivo: bdl.rules.matricula.js
Ruta: /BDLocal/rules/bdl.rules.matricula.js
Función:
- Normalizar datos que pertenecen a la matrícula por período.
- Crear idEstudiantePeriodo = periodoId__cedula.
- Separar carrera, sede, división, modalidad y estado de la persona.
Con qué se conecta:
- BDLocal/rules/bdl.rules.index.js
- BDLocal/rules/bdl.rules.periodo.js
- BDLocal/rules/bdl.rules.persona.js
========================================================= */
(function(window){
  "use strict";

  var Rules = window.BDLRules;
  var Config = window.BL2Config || {};
  var status = Config.status || { active: "ACTIVO", retired: "RETIRADO" };

  if(!Rules){ return; }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function upper(value){
    return text(value).replace(/\s+/g, " ").toUpperCase();
  }

  function first(row, names){
    row = row || {};
    names = Array.isArray(names) ? names : [];
    for(var i = 0; i < names.length; i++){
      if(text(row[names[i]])){ return row[names[i]]; }
    }
    return "";
  }

  function makeId(periodoId, cedula){
    periodoId = text(periodoId);
    cedula = text(cedula);
    return periodoId && cedula ? periodoId + "__" + cedula : "";
  }

  function normalizeEstado(value){
    var raw = upper(value || status.active);
    if(raw === "RETIRADO" || raw === "RETIRADA" || raw === "NO_APARECE_EN_ULTIMA_CARGA"){
      return status.retired || "RETIRADO";
    }
    return status.active || "ACTIVO";
  }

  function buildMatricula(row, context){
    row = row || {};
    context = context || {};

    var periodoId = text(row.periodoId || context.periodoId || "");
    var cedula = text(row.cedula || (row._bdlPersona && row._bdlPersona.cedula) || "");
    var idEstudiantePeriodo = makeId(periodoId, cedula);

    return {
      idEstudiantePeriodo: idEstudiantePeriodo,
      periodoId: periodoId,
      cedula: cedula,
      carrera: upper(first(row, ["carrera", "Carrera", "NombreCarrera", "nombreCarrera"])),
      codigoCarrera: text(first(row, ["codigoCarrera", "CodigoCarrera", "CódigoCarrera", "codigo_carrera"])),
      sede: upper(first(row, ["sede", "Sede", "campus"])),
      division: upper(first(row, ["division", "Division", "división", "División", "paralelo", "Paralelo"])),
      modalidad: upper(first(row, ["modalidad", "Modalidad"])),
      estadoMatricula: normalizeEstado(row.estadoMatricula || row.estado || row.Estado || ""),
      tipoTitulacion: upper(first(row, ["tipoTitulacion", "TipoTitulacion", "modalidadTitulacion", "ModalidadTitulacion"])),
      origen: text(row.origen || context.origen || "excel"),
      updatedAt: text(row.updatedAt || "") || new Date().toISOString(),
      _bdlMatriculaValid: !!idEstudiantePeriodo,
      _bdlMatriculaError: idEstudiantePeriodo ? "" : "No se pudo crear idEstudiantePeriodo porque falta período o cédula."
    };
  }

  function apply(payload, context){
    if(Array.isArray(payload)){
      return payload.map(function(row){
        var copy = Object.assign({}, row || {});
        copy._bdlMatricula = buildMatricula(copy, context || {});
        copy.idEstudiantePeriodo = copy._bdlMatricula.idEstudiantePeriodo;
        return copy;
      });
    }

    var copy = Object.assign({}, payload || {});
    copy._bdlMatricula = buildMatricula(copy, context || {});
    copy.idEstudiantePeriodo = copy._bdlMatricula.idEstudiantePeriodo;
    return copy;
  }

  Rules.register("matricula.normalize", apply);

  window.BDLRulesMatricula = {
    makeId: makeId,
    normalizeEstado: normalizeEstado,
    buildMatricula: buildMatricula,
    apply: apply
  };
})(window);

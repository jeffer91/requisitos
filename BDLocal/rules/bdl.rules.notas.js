/* =========================================================
Nombre completo: bdl.rules.notas.js
Ruta o ubicación: /BDLocal/rules/bdl.rules.notas.js
Función o funciones:
- Normalizar notas de titulación y defensas.
- Calcular nota final institucional: 70% artículo + 30% defensa.
- Usar idEstudiantePeriodo = cedula__periodoId.
- Usar la regla central de identificación validada.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.1.0-canonical-local-id";
  var Rules = window.BDLRules;
  var Config = window.BL2Config || {};
  var utils = Config.utils || {};
  if(!Rules){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }

  function parseNota(value){
    var raw = text(value).replace(",",".");
    if(!raw){ return null; }
    var number = Number(raw);
    if(!isFinite(number)){ return null; }
    if(number < 0){ return 0; }
    if(number > 10){ return 10; }
    return Math.round(number * 100) / 100;
  }

  function first(row,names){
    row = row || {};
    names = Array.isArray(names) ? names : [];
    for(var i=0;i<names.length;i+=1){ if(text(row[names[i]]) !== ""){ return row[names[i]]; } }
    return "";
  }

  function normalizeCedula(value){
    var persona = window.BDLRulesPersona;
    if(persona && typeof persona.normalizeCedula === "function"){ return persona.normalizeCedula(value); }
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

  function finalNota(notart,notdef){
    notart = parseNota(notart);
    notdef = parseNota(notdef);
    if(notart == null || notdef == null){ return null; }
    return Math.round(((notart * 0.70) + (notdef * 0.30)) * 100) / 100;
  }

  function estadoNota(notart,notdef,notafinal){
    if(notart == null){ return "SIN_ARTICULO"; }
    if(notart < 7){ return "ARTICULO_NO_APROBADO"; }
    if(notdef == null){ return "PENDIENTE_DEFENSA"; }
    if(notafinal == null){ return "PENDIENTE_FINAL"; }
    return notafinal >= 7 ? "APROBADO" : "NO_APROBADO";
  }

  function build(row,context){
    row = row || {};
    context = context || {};

    var periodoId = canonicalPeriodId(row.periodoId || row.periodId || context.periodoId || context.periodId || "");
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || context.cedula || "");
    var idEstudiantePeriodo = makeId(periodoId,cedula);
    var id = text(row.notaId || idEstudiantePeriodo);

    var notart = parseNota(first(row,["Notart","Nart","nart","notart","notaArticulo","nota_articulo","_nart"]));
    var notdef = parseNota(first(row,["Notdef","Ndef","ndef","notdef","notaDefensa","nota_defensa","_ndef"]));
    var explicitFinal = parseNota(first(row,["Notafinal","Nfinal","nfin","notafinal","notaFinal","nota_final","_nfin"]));
    var notafinal = explicitFinal != null ? explicitFinal : finalNota(notart,notdef);
    var estado = estadoNota(notart,notdef,notafinal);
    var updatedAt = text(row.updatedAt || "") || new Date().toISOString();

    return {
      id:id,
      notaId:id,
      studentId:idEstudiantePeriodo,
      idEstudiantePeriodo:idEstudiantePeriodo,
      periodoId:periodoId,
      periodId:periodoId,
      cedula:cedula,
      numeroIdentificacion:cedula,
      notart:notart,
      notdef:notdef,
      notafinal:notafinal,
      Notart:notart,
      Notdef:notdef,
      Notafinal:notafinal,
      Nart:notart,
      Ndef:notdef,
      Nfinal:notafinal,
      estadoNota:estado,
      origen:text(row.origen || context.origen || "defensas"),
      updatedAt:updatedAt,
      _bdlNotasValid:!!idEstudiantePeriodo,
      _bdlNotasError:idEstudiantePeriodo ? "" : "No se pudo crear registro de notas porque falta período o identificación."
    };
  }

  function apply(payload,context){
    if(Array.isArray(payload)){
      return payload.map(function(row){
        var copy = Object.assign({},row || {});
        copy._bdlNotas = build(copy,context || {});
        return copy;
      });
    }
    var copy = Object.assign({},payload || {});
    copy._bdlNotas = build(copy,context || {});
    return copy;
  }

  Rules.register("notas.normalize",apply);

  window.BDLRulesNotas = {
    version:VERSION,
    parseNota:parseNota,
    makeId:makeId,
    finalNota:finalNota,
    estadoNota:estadoNota,
    build:build,
    apply:apply
  };
})(window);

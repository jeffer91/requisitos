/* =========================================================
Nombre completo: bl2-requisitos.repo.js
Ruta o ubicación: /Requisitos/BaseLocal2/repositories/bl2-requisitos.repo.js
Función o funciones:
- Centralizar lectura de requisitos y notas desde filas de estudiantes BL2/V1.
- Usar BL2RequirementsEngine como regla oficial PVC/Regular.
- Usar BL2StudentNormalizer para leer alias de Excel, Firebase y Base Local.
- Calcular Nfin cuando existan Nart y Ndef aunque Notafinal venga vacío.
- Entregar utilidades reutilizables por Ficha, Stats, Tabla, Coordi y Reportes.
Con qué se conecta:
- core/bl2-student-normalizer.js
- core/bl2-requirements-engine.js
- ../BaseLocal/services/bl-notas-defensa.service.js
- Ficha/ficha.core.js
- BaseLocal2/repositories/bl2-estudiantes.repo.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-alpha.3-core";
  var DEFAULT_NOTE_FIELDS = [
    {key:"nart", label:"Nart", aliases:["Notart","notart","Nart","nart","N_ART","N-ART","NotaArt","notaArt","notaArticulo","nota_articulo"]},
    {key:"ndef", label:"Ndef", aliases:["Notdef","notdef","Ndef","ndef","N_DEF","N-DEF","NotaDef","notaDef","notaDefensa","nota_defensa"]},
    {key:"nfin", label:"Nfin", aliases:["Notafinal","notafinal","NotaFinal","notaFinal","Nfin","nfin","N_FIN","N-FIN","Nota final","nota final"]}
  ];

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g,"");}
  function notasService(){return window.BLNotasDefensa || null;}
  function normalizer(){return window.BL2StudentNormalizer || null;}
  function rules(){return window.BL2RequirementsEngine || window.StatsRules || null;}

  function pick(row, aliases, fallback){
    row = row || {}; aliases = aliases || [];
    if(normalizer() && typeof normalizer().value === "function" && aliases.length === 1){
      var normalizedValue = normalizer().value(row, aliases[0]);
      if(text(normalizedValue) !== ""){return normalizedValue;}
    }
    var keys = Object.keys(row);
    var wanted = aliases.map(compact);
    for(var i = 0; i < aliases.length; i += 1){if(Object.prototype.hasOwnProperty.call(row, aliases[i]) && text(row[aliases[i]]) !== ""){return row[aliases[i]];}}
    for(var j = 0; j < keys.length; j += 1){if(wanted.indexOf(compact(keys[j])) >= 0 && row[keys[j]] != null && text(row[keys[j]]) !== ""){return row[keys[j]];}}
    return fallback || "";
  }

  function field(row, canonical, fallback){
    try{if(normalizer() && typeof normalizer().value === "function"){var v = normalizer().value(row || {}, canonical);if(text(v) !== ""){return v;}}}catch(error){}
    try{if(rules() && typeof rules().valueOf === "function"){var r = rules().valueOf(row || {}, canonical);if(text(r) !== ""){return r;}}}catch(error){}
    try{if(window.BLCampos && typeof window.BLCampos.getValue === "function"){var b = window.BLCampos.getValue(row || {}, canonical, fallback || "");if(text(b) !== ""){return b;}}}catch(error){}
    return pick(row, [canonical], fallback || "");
  }

  function estadoCelda(value){
    if(rules() && typeof rules().cellStatus === "function"){return rules().cellStatus(value);}
    var k = norm(value);
    return ["cumple","si","s","ok","aprobado","aprobada","1","true","x","validado","validada","completo","completa"].indexOf(k) >= 0 ? "cumple" : "no_cumple";
  }

  function requirement(row, req){
    req = req || {};
    var raw = text(field(row, req.field || req.key, pick(row, [req.key], "")));
    var status = req.key && rules() && typeof rules().requirementStatus === "function" ? rules().requirementStatus(row || {}, req.key) : null;
    if(status){return {key:status.key, field:req.field || status.key, label:req.label || status.label, icon:req.icon || "", value:raw || "NO CUMPLE", estado:status.status, aplica:status.applies !== false, periodType:status.periodType};}
    return {key:req.key, field:req.field || req.key, label:req.label || req.key, icon:req.icon || "", value:raw || "NO CUMPLE", estado:estadoCelda(raw), aplica:true};
  }

  function requirementsForStudent(row){return rules() && typeof rules().requirementsForStudent === "function" ? rules().requirementsForStudent(row || {}) : [];}
  function studentApproval(row){return rules() && typeof rules().studentApproval === "function" ? rules().studentApproval(row || {}) : {approved:false,label:"No cumple",applicableRequirements:[],missingRequirements:[]};}
  function finalApproval(row){return rules() && typeof rules().finalApproval === "function" ? rules().finalApproval(row || {}) : [];}
  function requirementStatus(row,key){return rules() && typeof rules().requirementStatus === "function" ? rules().requirementStatus(row || {}, key) : requirement(row || {}, {key:key});}

  function numberValue(value){
    if(notasService() && typeof notasService().normalizarNota === "function"){return notasService().normalizarNota(value);}
    var raw = text(value).replace(",", "."); if(!raw){return null;} var n = Number(raw); return Number.isFinite(n) ? n : null;
  }
  function round2(value){if(notasService() && typeof notasService().redondear2 === "function"){return notasService().redondear2(value);}return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;}
  function calcularNfin(nart, ndef){if(notasService() && typeof notasService().calcularNfin === "function"){return notasService().calcularNfin(nart, ndef);}var art=numberValue(nart), def=numberValue(ndef);if(art === null || def === null || art < 7){return null;}return round2((art * 0.70) + (def * 0.30));}
  function estadoNota(value){var n = numberValue(value);return n != null && n >= 7 ? "cumple" : "no_cumple";}
  function valueText(value){var n = numberValue(value);return n == null ? "—" : String(round2(n));}

  function normalizedNotes(row, noteFields){
    var fields = noteFields && noteFields.length ? noteFields : DEFAULT_NOTE_FIELDS;
    var serviceNotes = notasService() && typeof notasService().extraerNotas === "function" ? notasService().extraerNotas(row || {}) : null;
    var nart = serviceNotes ? serviceNotes.nart : numberValue(pick(row, DEFAULT_NOTE_FIELDS[0].aliases, ""));
    var ndef = serviceNotes ? serviceNotes.ndef : numberValue(pick(row, DEFAULT_NOTE_FIELDS[1].aliases, ""));
    var nfin = serviceNotes ? serviceNotes.nfin : calcularNfin(nart, ndef);
    return fields.map(function(note){
      var key = compact(note.key); var raw = pick(row, note.aliases || [note.key], ""); var number = numberValue(raw);
      if(key === "nart"){number = nart;}else if(key === "ndef"){number = ndef;}else if(key === "nfin"){number = nfin;}
      return {key:note.key,label:note.label,value:number == null ? "—" : String(round2(number)),number:number,estado:estadoNota(number)};
    });
  }
  function notes(row, noteFields){return normalizedNotes(row || {}, noteFields || DEFAULT_NOTE_FIELDS);}

  window.BL2RequisitosRepo = {version:VERSION,pick:pick,field:field,estadoCelda:estadoCelda,estadoNota:estadoNota,numberValue:numberValue,valueText:valueText,calcularNfin:calcularNfin,requirement:requirement,requirementsForStudent:requirementsForStudent,requirementStatus:requirementStatus,studentApproval:studentApproval,finalApproval:finalApproval,notes:notes,DEFAULT_NOTE_FIELDS:DEFAULT_NOTE_FIELDS};
})(window);
